from __future__ import annotations

from enum import StrEnum


class OpportunityStage(StrEnum):
    LEAD = "LEAD"
    QUALIFIED = "QUALIFIED"
    PROPOSAL_SENT = "PROPOSAL_SENT"
    NEGOTIATION = "NEGOTIATION"
    CLOSED_WON = "CLOSED_WON"
    CLOSED_LOST = "CLOSED_LOST"


class OpportunityStatus(StrEnum):
    OPEN = "OPEN"
    WON = "WON"
    LOST = "LOST"


class IngestionSource(StrEnum):
    INTERNAL_CRM = "internal_crm"
    CSV_IMPORT = "csv_import"
    EXCEL_IMPORT = "excel_import"
    EXTERNAL_CRM = "external_crm"
    DOCUMENT_EXTRACTION = "document_extraction"


class ProductCategory(StrEnum):
    LIFE_INSURANCE = "LIFE_INSURANCE"
    HEALTH_INSURANCE = "HEALTH_INSURANCE"
    AUTO_INSURANCE = "AUTO_INSURANCE"
    PENSION = "PENSION"
    INVESTMENT = "INVESTMENT"
    OTHER = "OTHER"


class ProductRiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
