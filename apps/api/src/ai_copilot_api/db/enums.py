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
    # Ramos elementares / general insurance (multirisco, RC, acidentes pessoais, etc.)
    GENERAL_INSURANCE = "GENERAL_INSURANCE"


class ProductRiskLevel(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class InteractionType(StrEnum):
    CALL = "CALL"
    WHATSAPP = "WHATSAPP"
    EMAIL = "EMAIL"
    MEETING = "MEETING"
    VISIT = "VISIT"
    PROPOSAL_SENT = "PROPOSAL_SENT"
    CLIENT_REPLY = "CLIENT_REPLY"
    NOTE = "NOTE"
    POST_SALE = "POST_SALE"
    CAMPAIGN_TOUCH = "CAMPAIGN_TOUCH"


class LeadStatus(StrEnum):
    NEW = "NEW"
    CONTACTING = "CONTACTING"
    QUALIFIED = "QUALIFIED"
    CONVERTED = "CONVERTED"
    LOST = "LOST"


class ClientKind(StrEnum):
    INDIVIDUAL = "INDIVIDUAL"
    COMPANY = "COMPANY"


class InsuredRelation(StrEnum):
    HOLDER = "HOLDER"
    DEPENDENT = "DEPENDENT"
    OTHER = "OTHER"


class CrmEntityType(StrEnum):
    CLIENT = "CLIENT"
    LEAD = "LEAD"
    OPPORTUNITY = "OPPORTUNITY"
    INSURED_PERSON = "INSURED_PERSON"


class CrmAuditAction(StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    CONVERT = "CONVERT"
