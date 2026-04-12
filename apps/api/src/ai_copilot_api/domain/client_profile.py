"""Merge, completeness, and gap alerts for client insurance profile."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from ai_copilot_api.schemas.client_profile import (
    ClientInsuranceProfile,
    ClientProfileBehavior,
    ClientProfileBusiness,
    ClientProfileHealth,
    ClientProfileMobility,
    ClientProfilePersonal,
    ClientProfilePet,
    ClientProfileProfessional,
    ClientProfileResidence,
)

_BLOCK_MODELS: list[tuple[str, type[BaseModel]]] = [
    ("personal", ClientProfilePersonal),
    ("professional", ClientProfileProfessional),
    ("residence", ClientProfileResidence),
    ("mobility", ClientProfileMobility),
    ("health", ClientProfileHealth),
    ("business", ClientProfileBusiness),
    ("pet", ClientProfilePet),
    ("behavior", ClientProfileBehavior),
]


def parse_profile(raw: dict[str, Any] | None) -> ClientInsuranceProfile:
    if not raw:
        return ClientInsuranceProfile()
    return ClientInsuranceProfile.model_validate(raw)


def _merge_block(
    existing: dict[str, Any] | None,
    patch: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if patch is None:
        return existing
    if existing is None:
        return dict(patch)
    out = dict(existing)
    for k, v in patch.items():
        if v is None:
            out.pop(k, None)
        else:
            out[k] = v
    return out or None


def merge_profile_dict(existing: dict[str, Any] | None, patch: dict[str, Any]) -> dict[str, Any]:
    """Deep-merge top-level blocks; None in patch removes a scalar key; omitted keys unchanged."""
    base = dict(existing or {})
    for block_key, _cls in _BLOCK_MODELS:
        if block_key not in patch:
            continue
        pb = patch[block_key]
        if pb is None:
            base.pop(block_key, None)
            continue
        if not isinstance(pb, dict):
            continue
        existing_block = base.get(block_key)
        prev = existing_block if isinstance(existing_block, dict) else None
        merged = _merge_block(prev, pb)
        if merged:
            base[block_key] = merged
        else:
            base.pop(block_key, None)
    return base


def completeness_score(profile: ClientInsuranceProfile) -> int:
    """0–100 from average fill ratio across the eight blocks."""
    ratios: list[float] = []
    for attr, cls in _BLOCK_MODELS:
        block = getattr(profile, attr)
        n_fields = len(cls.model_fields)
        if n_fields == 0:
            continue
        if block is None:
            ratios.append(0.0)
            continue
        filled = sum(1 for name in cls.model_fields if getattr(block, name) is not None)
        ratios.append(filled / n_fields)
    if not ratios:
        return 0
    return min(100, round(100 * (sum(ratios) / len(ratios))))


def profile_alerts(profile: ClientInsuranceProfile) -> list[str]:
    """Stable machine codes; UI or docs map to copy."""
    codes: list[str] = []
    per = profile.personal
    if per is not None:
        if per.number_of_children is not None and per.number_of_children > 0 and not per.life_stage:
            codes.append("life_stage_missing_when_children")
        if per.number_of_children is not None and per.number_of_children > 0:
            ages = (per.children_ages_summary or "").strip()
            if not ages:
                codes.append("children_ages_missing_when_children")
    res = profile.residence
    if res is not None:
        if res.owns_property is True and not res.property_type:
            codes.append("property_type_missing_when_owns_property")
        if res.owns_property is True and not (res.property_use and str(res.property_use).strip()):
            codes.append("property_use_missing_when_owns_property")
    mob = profile.mobility
    if mob is not None:
        if mob.owns_vehicle is True and not mob.vehicle_primary_use:
            codes.append("vehicle_use_missing_when_owns_vehicle")
        if mob.owns_vehicle is True and not (mob.vehicle_type and str(mob.vehicle_type).strip()):
            codes.append("vehicle_type_missing_when_owns_vehicle")
    pro = profile.professional
    if pro is not None:
        if pro.employment_type and not pro.profession:
            codes.append("profession_missing_when_employment_set")
    bus = profile.business
    if bus is not None:
        if bus.owns_business is True and not bus.business_segment:
            codes.append("business_segment_missing_when_owns_business")
    pet = profile.pet
    if pet is not None:
        if pet.has_pet is True and not pet.pet_species:
            codes.append("pet_species_missing_when_has_pet")
    return codes


def coerce_profile_dict(raw: Any) -> dict[str, Any]:
    """Normalize JSONB / API profile payload to a plain dict for merge/parse."""
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    return {}


def profile_bundle_from_raw(raw: Any) -> tuple[ClientInsuranceProfile, int, list[str]]:
    d = coerce_profile_dict(raw)
    prof = parse_profile(d)
    return prof, completeness_score(prof), profile_alerts(prof)
