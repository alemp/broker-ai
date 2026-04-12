"""Sale adequacy traffic light (PRODUCT.md §5.8) — rule layer aligned with protection gaps."""

from __future__ import annotations

from dataclasses import dataclass

from ai_copilot_api.db.enums import AdequacyTrafficLight
from ai_copilot_api.db.models import Client
from ai_copilot_api.domain.client_profile import completeness_score, parse_profile, profile_alerts
from ai_copilot_api.domain.recommendation_rules import assess_protection_gaps


@dataclass(frozen=True)
class AdequacyAssessment:
    traffic_light: AdequacyTrafficLight
    summary: str
    reasons: list[str]
    needs_human_review: bool
    profile_completeness_score: int
    profile_alert_codes: list[str]


def evaluate_adequacy(client: Client) -> AdequacyAssessment:
    """
    Map protection gaps + qualidade de perfil to GREEN / YELLOW / RED.

    - RED: lacunas críticas (vida, patrimônio habitacional, garantias empresariais).
    - YELLOW: lacunas moderadas (auto, saúde), alertas de perfil ou base incompleta.
    - GREEN: sem lacunas materializadas pelas regras e perfil razoavelmente coerente.
    """
    gaps, _trace = assess_protection_gaps(client)
    prof = parse_profile(client.profile_data if isinstance(client.profile_data, dict) else None)
    score = completeness_score(prof)
    alerts = profile_alerts(prof)

    reasons: list[str] = []
    if gaps.want_life:
        reasons.append(
            "Dependentes identificados sem seguro de vida ativo na carteira detida.",
        )
    if gaps.want_home:
        reasons.append(
            "Imóvel declarado sem evidência de ramos gerais / multirisco habitacional ativo.",
        )
    if gaps.want_commercial:
        reasons.append(
            "Negócio com licitações ou garantias sem ramo geral associado na carteira.",
        )
    if gaps.want_auto:
        reasons.append(
            "Veículo declarado sem apólice de automóvel ativa.",
        )
    if gaps.want_health:
        reasons.append(
            "Contexto familiar sem plano de saúde declarado — rever necessidade de saúde.",
        )
    for code in alerts:
        reasons.append(f"Alerta de consistência do perfil: {code}.")

    critical = gaps.want_life or gaps.want_home or gaps.want_commercial
    moderate = gaps.want_auto or gaps.want_health
    thin_profile = score < 40 and score >= 0

    if critical:
        light = AdequacyTrafficLight.RED
        summary = (
            "Carteira provavelmente desalinhada com exposições relevantes do perfil "
            "(proteção patrimonial, familiar ou empresarial)."
        )
    elif moderate or alerts or thin_profile:
        light = AdequacyTrafficLight.YELLOW
        summary = (
            "Oportunidade de complemento ou revisão: lacunas secundárias, "
            "inconsistências no perfil ou dados ainda incompletos."
        )
    else:
        light = AdequacyTrafficLight.GREEN
        summary = (
            "Com base nas regras atuais, não há lacunas de proteção prioritárias "
            "face ao perfil declarado e à carteira detida."
        )

    needs_review = light != AdequacyTrafficLight.GREEN

    return AdequacyAssessment(
        traffic_light=light,
        summary=summary,
        reasons=reasons,
        needs_human_review=needs_review,
        profile_completeness_score=score,
        profile_alert_codes=list(alerts),
    )
