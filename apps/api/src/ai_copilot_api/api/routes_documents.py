from __future__ import annotations

import hashlib
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
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


def _validate_product_in_org(db: Session, org_id: uuid.UUID, product_id: uuid.UUID) -> None:
    exists = db.scalar(
        select(Product.id).where(Product.id == product_id, Product.organization_id == org_id),
    )
    if exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")


def _read_upload_with_limits(file: UploadFile) -> tuple[bytes, str, int]:
    """
    Read the uploaded file into memory with:
    - magic-bytes validation (PDF)
    - size limit enforcement
    Returns (payload, sha256hex, size_bytes).
    """
    hasher = hashlib.sha256()
    buf = bytearray()

    # Read first chunk to validate magic bytes.
    first = file.file.read(8)
    if not first.startswith(_PDF_MAGIC):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file: only PDF is supported",
        )
    hasher.update(first)
    buf.extend(first)

    while True:
        chunk = file.file.read(1024 * 1024)  # 1MB
        if not chunk:
            break
        if len(buf) + len(chunk) > _MAX_PDF_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="PDF too large",
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
            storage.put_object(storage_key, payload, content_type="application/pdf")
    else:
        storage_key = f"orgs/{org_id}/documents/{uuid.uuid4()}.pdf"
        storage.put_object(storage_key, payload, content_type="application/pdf")

    if existing_doc is None:
        doc_id = uuid.uuid4()
        doc = Document(
            id=doc_id,
            organization_id=org_id,
            uploaded_by_id=current_user.id,
            product_id=product_id,
            document_type=document_type,
            original_filename=file.filename,
            content_type="application/pdf",
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
                content_type="application/pdf",
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
        existing_doc.content_type = "application/pdf"
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
                content_type="application/pdf",
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

