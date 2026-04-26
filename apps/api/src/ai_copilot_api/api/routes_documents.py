from __future__ import annotations

import hashlib
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ai_copilot_api.api.deps import get_current_user, require_admin
from ai_copilot_api.config import Settings, get_settings
from ai_copilot_api.db.enums import DocumentType
from ai_copilot_api.db.models import Document, DocumentVersion, Product, User
from ai_copilot_api.db.session import get_db
from ai_copilot_api.schemas.documents import DocumentOut, DocumentVersionOut
from ai_copilot_api.storage.factory import get_object_storage

router = APIRouter(prefix="/documents", tags=["documents"])

_MAX_PDF_BYTES = 100 * 1024 * 1024  # 100MB
_PDF_MAGIC = b"%PDF-"
_MAX_GENERIC_BYTES = 25 * 1024 * 1024  # 25MB (images/spreadsheets/etc.)

_ALLOWED_CONTENT_TYPES: set[str] = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _validate_product_in_org(db: Session, org_id: uuid.UUID, product_id: uuid.UUID) -> None:
    exists = db.scalar(
        select(Product.id).where(Product.id == product_id, Product.organization_id == org_id),
    )
    if exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")


def _is_pdf_upload(file: UploadFile) -> bool:
    ct = (file.content_type or "").lower().strip()
    if ct == "application/pdf":
        return True
    name = (file.filename or "").lower()
    return name.endswith(".pdf")


def _read_upload_with_limits(file: UploadFile) -> tuple[bytes, str, int]:
    """Read upload into memory, enforcing per-type limits and PDF magic validation."""
    content_type = (file.content_type or "").lower().strip()
    if content_type and content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type",
        )

    is_pdf = _is_pdf_upload(file)
    max_bytes = _MAX_PDF_BYTES if is_pdf else _MAX_GENERIC_BYTES
    too_large_detail = "PDF too large" if is_pdf else "File too large"

    hasher = hashlib.sha256()
    buf = bytearray()

    if is_pdf:
        first = file.file.read(8)
        if not first.startswith(_PDF_MAGIC):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid PDF file",
            )
        hasher.update(first)
        buf.extend(first)

    while True:
        chunk = file.file.read(1024 * 1024)  # 1MB
        if not chunk:
            break
        if len(buf) + len(chunk) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=too_large_detail,
            )
        hasher.update(chunk)
        buf.extend(chunk)

    payload = bytes(buf)
    return payload, hasher.hexdigest(), len(payload)


@router.get("", response_model=list[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentOut]:
    stmt = (
        select(Document)
        .options(joinedload(Document.uploaded_by_user))
        .where(Document.organization_id == current_user.organization_id)
        .order_by(Document.updated_at.desc())
    )
    rows = db.scalars(stmt).unique().all()
    return [DocumentOut.model_validate(r) for r in rows]


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
def upload_document(
    document_type: DocumentType = Form(...),
    product_id: uuid.UUID | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(require_admin),
) -> DocumentOut:
    org_id = current_user.organization_id

    if product_id is not None:
        _validate_product_in_org(db, org_id, product_id)

    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing filename")

    payload, sha256hex, size_bytes = _read_upload_with_limits(file)
    content_type = (file.content_type or "application/octet-stream").strip().lower()
    if content_type not in _ALLOWED_CONTENT_TYPES and not _is_pdf_upload(file):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid file type")
    if _is_pdf_upload(file):
        content_type = "application/pdf"

    # "Documento lógico": org + tipo + produto + nome do arquivo.
    existing_doc = db.scalar(
        select(Document).where(
            Document.organization_id == org_id,
            Document.document_type == document_type,
            Document.product_id == product_id,
            Document.original_filename == file.filename,
        ),
    )

    # Reuse the same stored blob if we already have it anywhere for this org.
    existing_blob = db.scalar(
        select(DocumentVersion.storage_key).where(
            DocumentVersion.organization_id == org_id,
            DocumentVersion.sha256 == sha256hex,
        ),
    )
    storage = get_object_storage(settings)
    storage_key: str
    if existing_blob is not None:
        storage_key = existing_blob
        if not storage.exists_object(storage_key):
            # Heal missing blobs (e.g. local path changed / volume was recreated).
            storage.put_object(storage_key, payload, content_type=content_type)
    else:
        suffix = ".pdf" if content_type == "application/pdf" else ""
        storage_key = f"orgs/{org_id}/documents/{uuid.uuid4()}{suffix}"
        storage.put_object(storage_key, payload, content_type=content_type)

    if existing_doc is None:
        doc_id = uuid.uuid4()
        doc = Document(
            id=doc_id,
            organization_id=org_id,
            uploaded_by_id=current_user.id,
            product_id=product_id,
            document_type=document_type,
            original_filename=file.filename,
            content_type=content_type,
            size_bytes=size_bytes,
            sha256=sha256hex,
            storage_key=storage_key,
            current_version=1,
        )
        db.add(doc)
        db.flush()
        db.add(
            DocumentVersion(
                id=uuid.uuid4(),
                document_id=doc.id,
                organization_id=org_id,
                uploaded_by_id=current_user.id,
                version=1,
                content_type=content_type,
                size_bytes=size_bytes,
                sha256=sha256hex,
                storage_key=storage_key,
            ),
        )
        db.commit()
    else:
        # Same content -> no new version; just return current state.
        if existing_doc.sha256 == sha256hex:
            row = db.scalar(
                select(Document)
                .options(joinedload(Document.uploaded_by_user))
                .where(Document.id == existing_doc.id),
            )
            assert row is not None
            return DocumentOut.model_validate(row)

        next_version = existing_doc.current_version + 1
        existing_doc.uploaded_by_id = current_user.id
        existing_doc.content_type = content_type
        existing_doc.size_bytes = size_bytes
        existing_doc.sha256 = sha256hex
        existing_doc.storage_key = storage_key
        existing_doc.current_version = next_version
        db.add(
            DocumentVersion(
                id=uuid.uuid4(),
                document_id=existing_doc.id,
                organization_id=org_id,
                uploaded_by_id=current_user.id,
                version=next_version,
                content_type=content_type,
                size_bytes=size_bytes,
                sha256=sha256hex,
                storage_key=storage_key,
            ),
        )
        db.commit()

    row = db.scalar(
        select(Document)
        .options(joinedload(Document.uploaded_by_user))
        .where(
            Document.organization_id == org_id,
            Document.document_type == document_type,
            Document.product_id == product_id,
            Document.original_filename == file.filename,
        ),
    )
    assert row is not None
    return DocumentOut.model_validate(row)


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DocumentOut:
    row = db.scalar(
        select(Document)
        .options(joinedload(Document.uploaded_by_user))
        .where(
            Document.id == document_id,
            Document.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return DocumentOut.model_validate(row)


@router.get("/{document_id}/download")
def download_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(get_current_user),
) -> Response:
    row = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.organization_id == current_user.organization_id,
        ),
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    storage = get_object_storage(settings)
    try:
        payload = storage.get_object(row.storage_key)
    except FileNotFoundError:
        # Fallback: use current version storage key.
        current_key = db.scalar(
            select(DocumentVersion.storage_key).where(
                DocumentVersion.document_id == row.id,
                DocumentVersion.organization_id == current_user.organization_id,
                DocumentVersion.version == row.current_version,
            ),
        )
        if current_key:
            try:
                payload = storage.get_object(current_key)
            except FileNotFoundError:
                payload = b""
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document file not found in storage",
            ) from None
    headers = {
        "Content-Disposition": f'attachment; filename="{row.original_filename}"',
    }
    return Response(content=payload, media_type=row.content_type, headers=headers)


@router.get("/{document_id}/versions", response_model=list[DocumentVersionOut])
def list_document_versions(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentVersionOut]:
    doc_exists = db.scalar(
        select(Document.id).where(
            Document.id == document_id,
            Document.organization_id == current_user.organization_id,
        ),
    )
    if doc_exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    rows = db.scalars(
        select(DocumentVersion)
        .options(joinedload(DocumentVersion.uploaded_by_user))
        .where(
            DocumentVersion.document_id == document_id,
            DocumentVersion.organization_id == current_user.organization_id,
        )
        .order_by(DocumentVersion.version.desc()),
    ).all()
    return [DocumentVersionOut.model_validate(r) for r in rows]


def _delete_storage_object_if_unreferenced(
    db: Session,
    *,
    org_id: uuid.UUID,
    storage_key: str,
    settings: Settings,
) -> None:
    remaining = db.scalar(
        select(func.count()).select_from(DocumentVersion).where(
            DocumentVersion.organization_id == org_id,
            DocumentVersion.storage_key == storage_key,
        ),
    )
    if isinstance(remaining, int) and remaining > 0:
        return
    storage = get_object_storage(settings)
    try:
        storage.delete_object(storage_key)
    except FileNotFoundError:
        # Best-effort; the DB is the source of truth.
        return


@router.delete("/{document_id}/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document_version(
    document_id: uuid.UUID,
    version_id: uuid.UUID,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(require_admin),
) -> None:
    org_id = current_user.organization_id

    doc = db.scalar(
        select(Document).where(Document.id == document_id, Document.organization_id == org_id),
    )
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    version = db.scalar(
        select(DocumentVersion).where(
            DocumentVersion.id == version_id,
            DocumentVersion.document_id == document_id,
            DocumentVersion.organization_id == org_id,
        ),
    )
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document version not found",
        )

    total_versions = db.scalar(
        select(func.count()).select_from(DocumentVersion).where(
            DocumentVersion.document_id == document_id,
            DocumentVersion.organization_id == org_id,
        ),
    )
    if isinstance(total_versions, int) and total_versions <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the only version of a document",
        )

    deleted_storage_key = version.storage_key
    deleted_version_number = version.version
    db.delete(version)
    db.flush()

    # If we deleted the current version, promote the latest remaining version.
    if doc.current_version == deleted_version_number:
        promoted = db.scalar(
            select(DocumentVersion)
            .where(
                DocumentVersion.document_id == document_id,
                DocumentVersion.organization_id == org_id,
            )
            .order_by(DocumentVersion.version.desc())
            .limit(1),
        )
        if promoted is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot promote a new current version",
            )
        doc.uploaded_by_id = promoted.uploaded_by_id
        doc.content_type = promoted.content_type
        doc.size_bytes = promoted.size_bytes
        doc.sha256 = promoted.sha256
        doc.storage_key = promoted.storage_key
        doc.current_version = promoted.version

    db.commit()
    _delete_storage_object_if_unreferenced(
        db,
        org_id=org_id,
        storage_key=deleted_storage_key,
        settings=settings,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current_user: User = Depends(require_admin),
) -> None:
    org_id = current_user.organization_id

    doc = db.scalar(
        select(Document).where(Document.id == document_id, Document.organization_id == org_id),
    )
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    storage_keys = db.scalars(
        select(DocumentVersion.storage_key).where(
            DocumentVersion.document_id == document_id,
            DocumentVersion.organization_id == org_id,
        ),
    ).all()

    db.delete(doc)
    db.commit()

    for key in set(storage_keys):
        _delete_storage_object_if_unreferenced(
            db,
            org_id=org_id,
            storage_key=key,
            settings=settings,
        )

