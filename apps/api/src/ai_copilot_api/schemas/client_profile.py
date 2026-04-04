"""Insurance-oriented enriched client profile (PRODUCT.md §5.3). Stored as JSON on Client."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


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


class ClientProfileOut(BaseModel):
    profile: ClientInsuranceProfile
    completeness_score: int = Field(ge=0, le=100)
    alerts: list[str]
