"""Unit tests for import header normalization (Portuguese titles, accents)."""

from __future__ import annotations

import pytest

from ai_copilot_api.domain.client_import import normalize_header


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("full_name", "full_name"),
        ("Nome completo", "full_name"),
        ("NOME_COMPLETO", "full_name"),
        ("nome", "full_name"),
        ("E-mail", "email"),
        ("Correio eletrónico", "email"),
        ("correio", "email"),
        ("ID Externo", "external_id"),
        ("identificador externo", "external_id"),
        ("Telefone", "phone"),
        ("Telemóvel", "phone"),
        ("Observações", "notes"),
        ("Razão social", "company_legal_name"),
        ("NIF", "company_tax_id"),
        ("Matrícula fiscal", "company_tax_id"),
        ("Produtos detidos", "held_products"),
        ("Email do corretor", "owner_email"),
        ("Tipo de cliente", "client_kind"),
        ("Consentimento marketing", "marketing_opt_in"),
        ("Canal preferido", "preferred_marketing_channel"),
        ("Perfil JSON", "profile_json"),
        ("Segurados JSON", "insured_persons_json"),
    ],
)
def test_normalize_header_portuguese(raw: str, expected: str) -> None:
    assert normalize_header(raw) == expected
