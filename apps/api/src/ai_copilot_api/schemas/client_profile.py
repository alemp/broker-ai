"""Insurance-oriented enriched client profile (PRODUCT.md §5.3). Stored as JSON on Client."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class ClientProfileGeneralInsuranceFireProtections(BaseModel):
    """Protecionais (incêndio e demais danos) para risco PJ."""

    model_config = ConfigDict(extra="ignore")

    extinguishers: bool | None = None
    hydrants: bool | None = None
    sprinklers: bool | None = None
    trained_fire_brigade: bool | None = None
    detectors_alarms: bool | None = None
    fire_technical_reserve_liters: int | None = Field(default=None, ge=0)
    elevated_water_tank: bool | None = None
    ground_or_underground_water_tank: bool | None = None
    trained_personnel: bool | None = None
    mobile_pump_hose_reels_pam: bool | None = None


class ClientProfileGeneralInsuranceTheftProtections(BaseModel):
    """Protecionais (roubo) para risco PJ."""

    model_config = ConfigDict(extra="ignore")

    vehicle_access_control: bool | None = None
    tire_killer: bool | None = None
    gates_barriers: bool | None = None
    armored_guardhouses: bool | None = None
    armed_guards_24h: bool | None = None
    unarmed_guards_24h: bool | None = None
    alarm: bool | None = None
    cctv: bool | None = None
    sensors: bool | None = None
    panic_button: bool | None = None
    alarm_connected_to_security_center: bool | None = None
    nearby_police_station: bool | None = None
    people_access_control: bool | None = None
    thermometry_aeration: bool | None = None


class ClientProfileGeneralInsuranceValuesAtRisk(BaseModel):
    """Valores em risco (PREDIO + MMU + MMP)."""

    model_config = ConfigDict(extra="ignore")

    building: float | None = Field(default=None, ge=0)
    mmu: float | None = Field(default=None, ge=0)
    mmp: float | None = Field(default=None, ge=0)
    total: float | None = Field(default=None, ge=0)


class ClientProfileGeneralInsuranceClaim(BaseModel):
    """Sinistros (últimos 5 anos) para risco PJ."""

    model_config = ConfigDict(extra="ignore")

    occurred_at: date | None = None
    claimed_amount: float | None = Field(default=None, ge=0)
    paid_amount: float | None = Field(default=None, ge=0)
    status: str | None = Field(default=None, max_length=32)  # e.g. CLAIMED / PAID / DECLINED
    notes: str | None = Field(default=None, max_length=512)


class ClientProfileGeneralInsuranceCompany(BaseModel):
    """Dados PJ para Ramos Elementares / Multirrisco (questionário de risco)."""

    model_config = ConfigDict(extra="ignore")

    activity: str | None = Field(default=None, max_length=512)
    has_existing_insurance: bool | None = None
    existing_policies_note: str | None = Field(default=None, max_length=2000)
    existing_policies_document_ids: list[str] | None = None

    values_at_risk: ClientProfileGeneralInsuranceValuesAtRisk | None = None
    fire_protections: ClientProfileGeneralInsuranceFireProtections | None = None
    theft_protections: ClientProfileGeneralInsuranceTheftProtections | None = None

    claims_last_5y_note: str | None = Field(default=None, max_length=4000)

    # Structured claims: preferred for reporting; note remains for free-form details.
    # Each entry is optional; UI should allow partial capture while typing.
    claims_last_5y: list[ClientProfileGeneralInsuranceClaim] | None = None

    current_insurer: str | None = Field(default=None, max_length=255)
    current_annual_premium: float | None = Field(default=None, ge=0)
    target_premium: float | None = Field(default=None, ge=0)
    target_commission: float | None = Field(default=None, ge=0)


class ClientProfileGeneralInsuranceIndividual(BaseModel):
    """Dados PF para Ramos Elementares (apólices atuais, anexos e observações)."""

    model_config = ConfigDict(extra="ignore")

    has_existing_insurance: bool | None = None
    existing_policies_note: str | None = Field(default=None, max_length=2000)
    existing_policies_document_ids: list[str] | None = None


class ClientProfilePersonal(BaseModel):
    model_config = ConfigDict(extra="ignore")

    marital_status: str | None = Field(default=None, max_length=64)
    number_of_children: int | None = Field(default=None, ge=0, le=30)
    children_ages_summary: str | None = Field(default=None, max_length=255)
    financial_dependents: int | None = Field(default=None, ge=0)
    main_income_provider: str | None = Field(default=None, max_length=255)
    has_partner: bool | None = None
    life_stage: str | None = Field(default=None, max_length=128)


class ClientProfileProfessional(BaseModel):
    model_config = ConfigDict(extra="ignore")

    profession: str | None = Field(default=None, max_length=255)
    employment_type: str | None = Field(default=None, max_length=64)
    approximate_income_band: str | None = Field(default=None, max_length=64)
    income_stability: str | None = Field(default=None, max_length=64)
    wealth_band: str | None = Field(default=None, max_length=64)
    has_company_stake: bool | None = None


class ClientProfileResidence(BaseModel):
    model_config = ConfigDict(extra="ignore")

    owns_property: bool | None = None
    property_type: str | None = Field(default=None, max_length=64)
    property_use: str | None = Field(default=None, max_length=64)
    property_value_band: str | None = Field(default=None, max_length=64)
    property_location: str | None = Field(default=None, max_length=255)
    property_style: str | None = Field(default=None, max_length=64)
    high_value_items: bool | None = None


class ClientProfileMobility(BaseModel):
    model_config = ConfigDict(extra="ignore")

    owns_vehicle: bool | None = None
    vehicle_count: int | None = Field(default=None, ge=0, le=50)
    vehicle_type: str | None = Field(default=None, max_length=64)
    vehicle_year: int | None = Field(default=None, ge=1950, le=2100)
    vehicle_primary_use: str | None = Field(default=None, max_length=64)
    primary_driver: str | None = Field(default=None, max_length=255)
    has_garage: bool | None = None
    circulation_city: str | None = Field(default=None, max_length=128)


class ClientProfileHealth(BaseModel):
    model_config = ConfigDict(extra="ignore")

    has_health_plan: bool | None = None
    health_plan_type: str | None = Field(default=None, max_length=64)
    health_lives_count: int | None = Field(default=None, ge=0)
    dependents_age_band: str | None = Field(default=None, max_length=128)
    health_plan_satisfaction: str | None = Field(default=None, max_length=64)
    health_plan_interest: str | None = Field(default=None, max_length=128)


class ClientProfileBusiness(BaseModel):
    model_config = ConfigDict(extra="ignore")

    owns_business: bool | None = None
    business_segment: str | None = Field(default=None, max_length=255)
    estimated_revenue_band: str | None = Field(default=None, max_length=64)
    employee_count: int | None = Field(default=None, ge=0)
    participates_bids: bool | None = None
    contracts_require_guarantee: bool | None = None
    needs_performance_bond: bool | None = None


class ClientProfilePet(BaseModel):
    model_config = ConfigDict(extra="ignore")

    has_pet: bool | None = None
    pet_species: str | None = Field(default=None, max_length=64)
    pet_breed: str | None = Field(default=None, max_length=128)
    pet_age: str | None = Field(default=None, max_length=64)
    pet_count: int | None = Field(default=None, ge=0)
    vet_usage_frequency: str | None = Field(default=None, max_length=64)


class ClientProfileBehavior(BaseModel):
    model_config = ConfigDict(extra="ignore")

    preferred_contact_channel: str | None = Field(default=None, max_length=64)
    preferred_contact_time: str | None = Field(default=None, max_length=128)
    football_team: str | None = Field(default=None, max_length=128)
    relevant_dates_note: str | None = Field(default=None, max_length=512)
    communication_preferences: str | None = Field(default=None, max_length=512)
    life_events_note: str | None = Field(default=None, max_length=512)


class ClientInsuranceProfile(BaseModel):
    """Full profile document aligned to PRODUCT §5.3 blocks A–H."""

    model_config = ConfigDict(extra="ignore")

    personal: ClientProfilePersonal | None = None
    professional: ClientProfileProfessional | None = None
    residence: ClientProfileResidence | None = None
    mobility: ClientProfileMobility | None = None
    health: ClientProfileHealth | None = None
    business: ClientProfileBusiness | None = None
    pet: ClientProfilePet | None = None
    behavior: ClientProfileBehavior | None = None
    general_insurance_company: ClientProfileGeneralInsuranceCompany | None = None
    general_insurance_individual: ClientProfileGeneralInsuranceIndividual | None = None


class ClientProfileOut(BaseModel):
    profile: ClientInsuranceProfile
    completeness_score: int = Field(ge=0, le=100)
    alerts: list[str]
