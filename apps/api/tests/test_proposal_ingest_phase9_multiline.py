"""Phase 9 — multi-line proposal payloads + adapter selector.

Covers the deliverables in `docs/PROPOSAL-INGEST-IMPLEMENTATION.md` Phase 9
(multi-line adapters): the canonical schemas and the adapter selector are
ready for non-AUTO lines so future carrier adapters can plug in without
touching the API layer. The PDF channel still produces a clean 422 for
lines that don't have a working extractor yet.
"""

from __future__ import annotations

from decimal import Decimal

import pytest


def test_select_payload_class_dispatches_by_insurance_line() -> None:
    from ai_copilot_api.db.enums import ProductCategory
    from ai_copilot_api.schemas.proposal_ingest import (
        AutoProposalPayload,
        BusinessProposalPayload,
        HomeProposalPayload,
        LifeProposalPayload,
        select_proposal_payload_class,
    )

    assert select_proposal_payload_class(ProductCategory.AUTO_INSURANCE) is AutoProposalPayload
    assert select_proposal_payload_class(ProductCategory.LIFE_INSURANCE) is LifeProposalPayload
    assert (
        select_proposal_payload_class(
            ProductCategory.GENERAL_INSURANCE,
            subject_kind="home",
        )
        is HomeProposalPayload
    )
    assert (
        select_proposal_payload_class(
            ProductCategory.GENERAL_INSURANCE,
            subject_kind="business",
        )
        is BusinessProposalPayload
    )


def test_select_payload_class_requires_subject_kind_for_general() -> None:
    from ai_copilot_api.db.enums import ProductCategory
    from ai_copilot_api.schemas.proposal_ingest import select_proposal_payload_class

    with pytest.raises(NotImplementedError, match="subject_kind"):
        select_proposal_payload_class(ProductCategory.GENERAL_INSURANCE)


def test_select_payload_class_health_not_implemented() -> None:
    from ai_copilot_api.db.enums import ProductCategory
    from ai_copilot_api.schemas.proposal_ingest import select_proposal_payload_class

    with pytest.raises(NotImplementedError, match="HEALTH_INSURANCE"):
        select_proposal_payload_class(ProductCategory.HEALTH_INSURANCE)


def test_life_proposal_payload_validates() -> None:
    from ai_copilot_api.db.enums import ProductCategory
    from ai_copilot_api.schemas.proposal_ingest import LifeProposalPayload

    payload = LifeProposalPayload.model_validate(
        {
            "quote": {"number": "LF-1", "insurer_name": "Bradesco Vida"},
            "applicant": {"full_name": "Maria Souza", "tax_id": "12345678909"},
            "insured": {
                "full_name": "Maria Souza",
                "tax_id": "12345678909",
                "smoker": False,
            },
            "beneficiaries_count": 2,
            "coverages": {"death": "100000.00", "accidental_death": "200000.00"},
            "premium": {"total_payable": "150.50"},
        },
    )
    assert payload.insurance_line == ProductCategory.LIFE_INSURANCE
    assert payload.insured.full_name == "Maria Souza"
    assert payload.coverages.death == Decimal("100000.00")
    assert payload.beneficiaries_count == 2


def test_home_proposal_payload_validates_with_subject_kind() -> None:
    from ai_copilot_api.db.enums import ProductCategory
    from ai_copilot_api.schemas.proposal_ingest import HomeProposalPayload

    payload = HomeProposalPayload.model_validate(
        {
            "subject_kind": "home",
            "quote": {"number": "HM-1", "insurer_name": "Bradesco Multirisco"},
            "applicant": {"full_name": "Joao Silva", "tax_id": "11122233344"},
            "subject": {
                "address_line": "Rua A, 100",
                "postal_code": "01000-000",
                "occupancy": "owner",
                "construction_type": "alvenaria",
                "declared_value": "350000.00",
            },
            "coverages": {"fire": "350000.00", "water_damage": "20000.00"},
            "premium": {"total_payable": "85.00"},
        },
    )
    assert payload.insurance_line == ProductCategory.GENERAL_INSURANCE
    assert payload.subject_kind == "home"
    assert payload.subject.declared_value == Decimal("350000.00")


def test_business_proposal_payload_validates_with_subject_kind() -> None:
    from ai_copilot_api.db.enums import ProductCategory
    from ai_copilot_api.schemas.proposal_ingest import BusinessProposalPayload

    payload = BusinessProposalPayload.model_validate(
        {
            "subject_kind": "business",
            "quote": {"number": "BZ-1", "insurer_name": "Bradesco Empresarial"},
            "applicant": {"full_name": "Empresa LTDA", "tax_id": "11222333000181"},
            "subject": {
                "legal_name": "Empresa LTDA",
                "tax_id": "11222333000181",
                "segment": "varejo",
                "annual_revenue": "1000000.00",
                "headcount": 12,
            },
            "coverages": {"fire": "500000.00", "civil_liability": "100000.00"},
            "premium": {"total_payable": "1200.00"},
        },
    )
    assert payload.insurance_line == ProductCategory.GENERAL_INSURANCE
    assert payload.subject_kind == "business"
    assert payload.subject.headcount == 12


def test_select_adapter_for_pdf_dispatches_per_line() -> None:
    from ai_copilot_api.db.enums import ProductCategory
    from ai_copilot_api.domain.proposal_adapters import select_adapter_for_pdf

    auto = select_adapter_for_pdf(ProductCategory.AUTO_INSURANCE)
    assert auto.source == "bradesco_pdf_v1"
    assert auto.insurance_line == ProductCategory.AUTO_INSURANCE

    life = select_adapter_for_pdf(ProductCategory.LIFE_INSURANCE)
    assert life.source == "tokio_life_pdf_v1"
    assert life.insurance_line == ProductCategory.LIFE_INSURANCE

    for line in (ProductCategory.HEALTH_INSURANCE, ProductCategory.GENERAL_INSURANCE):
        with pytest.raises(NotImplementedError, match="No PDF proposal adapter"):
            select_adapter_for_pdf(line)


def test_select_adapter_for_json_supports_canonical_for_all_lines() -> None:
    from ai_copilot_api.db.enums import ProductCategory
    from ai_copilot_api.domain.proposal_adapters import select_adapter_for_json

    auto = select_adapter_for_json("canonical_auto_v1")
    life = select_adapter_for_json("canonical_life_v1")
    home = select_adapter_for_json("canonical_home_v1")
    biz = select_adapter_for_json("canonical_business_v1")

    assert auto.source == "canonical_auto_v1"
    assert auto.insurance_line == ProductCategory.AUTO_INSURANCE
    assert life.source == "canonical_life_v1"
    assert life.insurance_line == ProductCategory.LIFE_INSURANCE
    assert home.source == "canonical_home_v1"
    assert home.insurance_line == ProductCategory.GENERAL_INSURANCE
    assert biz.source == "canonical_business_v1"
    assert biz.insurance_line == ProductCategory.GENERAL_INSURANCE


def test_canonical_passthrough_returns_dict_copy() -> None:
    from ai_copilot_api.domain.proposal_adapters import select_adapter_for_json

    adapter = select_adapter_for_json("canonical_life_v1")
    raw = {"insurance_line": "LIFE_INSURANCE", "applicant": {"full_name": "X", "tax_id": "1" * 11}}
    out = adapter.to_canonical_dict(raw)

    assert out == raw
    assert out is not raw  # caller must be free to mutate the result


def test_select_adapter_for_json_rejects_unknown_source() -> None:
    from ai_copilot_api.domain.proposal_adapters import select_adapter_for_json

    with pytest.raises(NotImplementedError, match="Unknown proposal JSON source"):
        select_adapter_for_json("acme_v1")
