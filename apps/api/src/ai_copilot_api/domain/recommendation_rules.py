"""Rule-based consultative recommendations (PRODUCT.md §5.7 — layer 1)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ai_copilot_api.db.enums import ProductCategory
from ai_copilot_api.db.models import (
    Client,
    ClientHeldProduct,
    ClientLineOfBusiness,
    LineOfBusiness,
    Opportunity,
    Product,
)
from ai_copilot_api.schemas.client_profile import ClientInsuranceProfile


def _profile(client: Client) -> ClientInsuranceProfile:
    return ClientInsuranceProfile.model_validate(client.profile_data or {})


def _held_active(h: ClientHeldProduct) -> bool:
    if not h.policy_status:
        return True
    s = h.policy_status.strip().lower()
    return s not in ("cancelled", "canceled", "lapsed", "expired", "inactive")


def _lob_suggests_auto(lob: LineOfBusiness) -> bool:
    c = (lob.code or "").upper()
    n = (lob.name or "").upper()
    keys = ("AUTO", "MOTOR", "VIATURA", "AUTOM")
    return any(k in c for k in keys) or any(k in n for k in keys)


def _client_has_auto_lob_without_product(client: Client) -> bool:
    """CRM linked LOB indicates auto/motor portfolio line but no active auto policy held."""
    has_auto_lob = False
    for link in client.line_of_business_links:
        lob = link.line_of_business
        if lob is not None and _lob_suggests_auto(lob):
            has_auto_lob = True
            break
    if not has_auto_lob:
        return False
    return not _has_active_category(client, ProductCategory.AUTO_INSURANCE)


def _profile_high_earner_life_gap(client: Client) -> tuple[bool, str]:
    """
    Phase 6 — profile-only signal when professional block signals higher capacity
    but no active life product (complements family-based RULE_FAMILY_PROTECTION).
    """
    prof = _profile(client)
    pr = prof.professional
    if pr is None:
        return False, "professional block empty"
    band = (pr.approximate_income_band or "").lower()
    wealth = (pr.wealth_band or "").lower()
    markers = (
        "high",
        "alto",
        "elevado",
        "top",
        "tier_3",
        "tier_4",
        "tier_5",
        "100k",
        "150k",
        "200k",
    )
    income_hit = any(m in band for m in markers)
    wealth_hit = any(m in wealth for m in ("high", "alto", "elevado", "top"))
    life_held = _has_active_category(client, ProductCategory.LIFE_INSURANCE)
    if (income_hit or wealth_hit) and not life_held:
        return True, (
            f"approximate_income_band={band!r}, wealth_band={wealth!r}, life_held={life_held}"
        )
    return False, f"approximate_income_band={band!r}, wealth_band={wealth!r}, life_held={life_held}"


def _has_active_category(client: Client, category: ProductCategory) -> bool:
    for h in client.held_products:
        if not _held_active(h):
            continue
        if h.product_id is None:
            continue
        if h.product and h.product.category == category:
            return True
    return False


@dataclass(frozen=True)
class RuleResult:
    rule_id: str
    fired: bool
    detail: str


@dataclass(frozen=True)
class ProtectionGaps:
    want_life: bool
    want_home: bool
    want_auto: bool
    want_health: bool
    want_commercial: bool
    want_lob_auto: bool


@dataclass
class RecommendationItemData:
    product: Product
    priority: int
    rule_ids: list[str]
    rationale: str
    protection_gaps: str
    predictable_objections: str
    next_best_action: str


_OBJECTIONS_BY_CAT: dict[ProductCategory, str] = {
    ProductCategory.LIFE_INSURANCE: (
        "Preço percebido vs necessidade; adiamento por falta de urgência."
    ),
    ProductCategory.HEALTH_INSURANCE: "Custo mensal; rede credenciada; portabilidade.",
    ProductCategory.AUTO_INSURANCE: "Franquia; concorrência por preço; histórico de sinistros.",
    ProductCategory.GENERAL_INSURANCE: (
        "Complexidade da cobertura; necessidade de leitura fina do risco."
    ),
}


def _nba_for_category(cat: ProductCategory) -> str:
    return {
        ProductCategory.LIFE_INSURANCE: (
            "Agendar conversa de proteção familiar com simulação simples."
        ),
        ProductCategory.HEALTH_INSURANCE: (
            "Comparar plano atual vs necessidade da família; "
            "proposta de upgrade/portabilidade."
        ),
        ProductCategory.AUTO_INSURANCE: (
            "Rever uso do veículo e coberturas essenciais; cotação alinhada ao perfil."
        ),
        ProductCategory.GENERAL_INSURANCE: (
            "Mapear patrimônio/risco e apresentar pacote multirisco / RC."
        ),
    }.get(cat, "Agendar follow-up consultivo com base no perfil.")


def assess_protection_gaps(client: Client) -> tuple[ProtectionGaps, list[RuleResult]]:
    """Profile vs carteira detida — usado em recomendações (§5.7) e semáforo (§5.8)."""
    prof = _profile(client)
    personal = prof.personal
    res = prof.residence
    mob = prof.mobility
    health = prof.health
    bus = prof.business

    children = (personal.number_of_children if personal else None) or 0
    dependents = (personal.financial_dependents if personal else None) or 0
    owns_property = bool(res.owns_property) if res and res.owns_property is not None else False
    owns_vehicle = bool(mob.owns_vehicle) if mob and mob.owns_vehicle is not None else False
    has_health = (
        bool(health.has_health_plan) if health and health.has_health_plan is not None else False
    )
    bids = bool(bus.participates_bids) if bus and bus.participates_bids is not None else False
    guarantee = (
        bool(bus.contracts_require_guarantee)
        if bus and bus.contracts_require_guarantee is not None
        else False
    )
    needs_bond = (
        bool(bus.needs_performance_bond)
        if bus and bus.needs_performance_bond is not None
        else False
    )

    trace: list[RuleResult] = []
    family_exposure = children > 0 or dependents > 0
    life_held = _has_active_category(client, ProductCategory.LIFE_INSURANCE)
    want_life = family_exposure and not life_held
    trace.append(
        RuleResult(
            "RULE_FAMILY_PROTECTION",
            want_life,
            f"children={children}, financial_dependents={dependents}, life_held={life_held}",
        ),
    )
    general_held = _has_active_category(client, ProductCategory.GENERAL_INSURANCE)
    want_home = owns_property and not general_held
    trace.append(
        RuleResult(
            "RULE_PROPERTY_RISK",
            want_home,
            f"owns_property={owns_property}, general_held={general_held}",
        ),
    )
    auto_held = _has_active_category(client, ProductCategory.AUTO_INSURANCE)
    want_auto = owns_vehicle and not auto_held
    trace.append(
        RuleResult(
            "RULE_AUTO_GAP",
            want_auto,
            f"owns_vehicle={owns_vehicle}, auto_held={auto_held}",
        ),
    )
    want_health = (not has_health) and (
        children > 0 or (personal and personal.life_stage in ("young_family", "family_with_teens"))
    )
    trace.append(
        RuleResult(
            "RULE_HEALTH_GAP",
            want_health,
            f"has_health_plan={has_health}",
        ),
    )
    commercial_signals = bids or guarantee or needs_bond
    want_commercial = commercial_signals and not _has_active_category(
        client,
        ProductCategory.GENERAL_INSURANCE,
    )
    trace.append(
        RuleResult(
            "RULE_COMMERCIAL_GUARANTEE",
            want_commercial,
            f"bids={bids}, guarantee={guarantee}, bond={needs_bond}",
        ),
    )

    want_lob_auto = _client_has_auto_lob_without_product(client)
    trace.append(
        RuleResult(
            "RULE_LOB_AUTO_PORTFOLIO_GAP",
            want_lob_auto,
            "linked LOB suggests motor/auto line; no active AUTO_INSURANCE in held products",
        ),
    )

    gaps = ProtectionGaps(
        want_life=want_life,
        want_home=want_home,
        want_auto=want_auto,
        want_health=want_health,
        want_commercial=want_commercial,
        want_lob_auto=want_lob_auto,
    )
    return gaps, trace


def evaluate_rules_for_client(
    client: Client,
    opportunity: Opportunity | None,
    products: list[Product],
) -> tuple[list[RecommendationItemData], list[RuleResult]]:
    """Return ranked recommendation items and a diagnostic trace."""
    gaps, trace = assess_protection_gaps(client)
    want_life = gaps.want_life
    want_home = gaps.want_home
    want_auto = gaps.want_auto
    want_health = gaps.want_health
    want_commercial = gaps.want_commercial
    want_lob_auto = gaps.want_lob_auto

    want_profile_life, prof_life_detail = _profile_high_earner_life_gap(client)
    trace.append(
        RuleResult(
            "RULE_PROFILE_HIGH_EARNER_PROTECTION",
            want_profile_life,
            prof_life_detail,
        ),
    )

    candidates: dict[uuid.UUID, RecommendationItemData] = {}

    def add_product(prod: Product, priority: int, rule_id: str, rationale: str, gap: str) -> None:
        if not prod.active:
            return
        cur = candidates.get(prod.id)
        objections = _OBJECTIONS_BY_CAT.get(
            prod.category,
            "Objeções de preço e timing.",
        )
        nba = _nba_for_category(prod.category)
        item = RecommendationItemData(
            product=prod,
            priority=priority,
            rule_ids=[rule_id],
            rationale=rationale,
            protection_gaps=gap,
            predictable_objections=objections,
            next_best_action=nba,
        )
        if cur is None:
            candidates[prod.id] = item
            return
        if priority < cur.priority:
            merged_ids = [rule_id]
            for rid in cur.rule_ids:
                if rid not in merged_ids:
                    merged_ids.append(rid)
            candidates[prod.id] = RecommendationItemData(
                product=prod,
                priority=priority,
                rule_ids=merged_ids,
                rationale=rationale,
                protection_gaps=gap,
                predictable_objections=objections,
                next_best_action=nba,
            )
        elif rule_id not in cur.rule_ids:
            cur.rule_ids.append(rule_id)

    active_products = [p for p in products if p.active]

    for p in active_products:
        if want_life and p.category == ProductCategory.LIFE_INSURANCE:
            add_product(
                p,
                10,
                "RULE_FAMILY_PROTECTION",
                "Cliente com dependentes e possível lacuna de proteção de vida.",
                "Proteção de renda e família ante sinistralidade ou incapacidade.",
            )
        if want_home and p.category == ProductCategory.GENERAL_INSURANCE:
            add_product(
                p,
                20,
                "RULE_PROPERTY_RISK",
                "Imóvel identificado sem evidência de multirisco / ramos gerais adequados.",
                "Patrimônio habitacional exposto a danos e responsabilidade.",
            )
        if want_auto and p.category == ProductCategory.AUTO_INSURANCE:
            add_product(
                p,
                30,
                "RULE_AUTO_GAP",
                "Veículo na mobilidade do cliente sem auto detido no portfólio.",
                "Responsabilidade civil e danos próprios.",
            )
        if want_lob_auto and p.category == ProductCategory.AUTO_INSURANCE:
            add_product(
                p,
                28,
                "RULE_LOB_AUTO_PORTFOLIO_GAP",
                "Ramo de automóveis ligado ao cliente (CRM) sem apólice de auto ativa na carteira.",
                "Alinhar cobertura ao ramo declarado na relação comercial.",
            )
        if want_profile_life and p.category == ProductCategory.LIFE_INSURANCE:
            add_product(
                p,
                11,
                "RULE_PROFILE_HIGH_EARNER_PROTECTION",
                (
                    "Perfil profissional com sinais de maior capacidade patrimonial — "
                    "reforçar proteção de vida."
                ),
                "Continuidade patrimonial e substituição de rendimentos.",
            )
        if want_health and p.category == ProductCategory.HEALTH_INSURANCE:
            add_product(
                p,
                25,
                "RULE_HEALTH_GAP",
                "Contexto familiar sem plano de saúde declarado.",
                "Proteção saúde da família e previsibilidade de custos médicos.",
            )
        if want_commercial and p.category == ProductCategory.GENERAL_INSURANCE:
            add_product(
                p,
                15,
                "RULE_COMMERCIAL_GUARANTEE",
                "Sinais de negócio com licitações ou garantias sem ramo geral associado.",
                "Garantias, RC e multirisco empresarial.",
            )

    if opportunity and opportunity.product_id:
        opp_prod = next((x for x in active_products if x.id == opportunity.product_id), None)
        if opp_prod:
            rid = "CONTEXT_OPPORTUNITY"
            msg = "Produto já em foco na oportunidade em curso — reforçar narrativa consultiva."
            if opp_prod.id not in candidates:
                candidates[opp_prod.id] = RecommendationItemData(
                    product=opp_prod,
                    priority=5,
                    rule_ids=[rid],
                    rationale=msg,
                    protection_gaps="Alinhar coberturas ao estágio do funil.",
                    predictable_objections=_OBJECTIONS_BY_CAT.get(
                        opp_prod.category,
                        "Objeções de preço e timing.",
                    ),
                    next_best_action=_nba_for_category(opp_prod.category),
                )
            else:
                ex = candidates[opp_prod.id]
                if rid not in ex.rule_ids:
                    ex.rule_ids.insert(0, rid)
                ex.rationale = f"{msg} {ex.rationale}"

    items = sorted(candidates.values(), key=lambda x: (x.priority, x.product.name))
    return items, trace


@dataclass(frozen=True)
class BuiltinRecommendationRule:
    """Operator-facing description of a code-defined rule (GET /v1/recommendation-rules)."""

    rule_id: str
    title: str
    description: str
    inputs: tuple[str, ...]


def list_builtin_recommendation_rules() -> list[BuiltinRecommendationRule]:
    """Stable catalog aligned with `assess_protection_gaps` and `evaluate_rules_for_client`."""
    return [
        BuiltinRecommendationRule(
            rule_id="RULE_FAMILY_PROTECTION",
            title="Proteção familiar (vida)",
            description=(
                "Dispara quando há filhos ou dependentes financeiros declarados no perfil e "
                "não há produto de vida ativo na carteira detida."
            ),
            inputs=("Perfil: filhos e dependentes", "Carteira: produtos detidos (categoria vida)"),
        ),
        BuiltinRecommendationRule(
            rule_id="RULE_PROPERTY_RISK",
            title="Risco patrimonial (ramos gerais)",
            description=(
                "Cliente declara imóvel no perfil e não há produto de ramos gerais/multirisco "
                "ativo associado na carteira."
            ),
            inputs=("Perfil: residência", "Carteira: ramos gerais"),
        ),
        BuiltinRecommendationRule(
            rule_id="RULE_AUTO_GAP",
            title="Lacuna de automóvel",
            description="Perfil indica veículo e não há seguro auto ativo na carteira.",
            inputs=("Perfil: mobilidade", "Carteira: auto"),
        ),
        BuiltinRecommendationRule(
            rule_id="RULE_HEALTH_GAP",
            title="Plano de saúde",
            description=(
                "Contexto familiar (filhos ou fase de vida) sem plano de saúde declarado no perfil."
            ),
            inputs=("Perfil: familiar e saúde",),
        ),
        BuiltinRecommendationRule(
            rule_id="RULE_COMMERCIAL_GUARANTEE",
            title="Garantias e negócios",
            description=(
                "Sinais de licitações, garantias contratuais ou performance bond no perfil "
                "empresarial, sem ramo geral ativo na carteira."
            ),
            inputs=("Perfil: empresa e garantias", "Carteira: ramos gerais"),
        ),
        BuiltinRecommendationRule(
            rule_id="RULE_LOB_AUTO_PORTFOLIO_GAP",
            title="LOB automóvel vs carteira",
            description=(
                "Linha de negócio vinculada ao cliente sugere automóvel, mas não há apólice "
                "de auto ativa nos produtos detidos."
            ),
            inputs=("CRM: linhas de negócio", "Carteira: auto"),
        ),
        BuiltinRecommendationRule(
            rule_id="RULE_PROFILE_HIGH_EARNER_PROTECTION",
            title="Perfil de maior capacidade patrimonial",
            description=(
                "Faixa de renda ou patrimônio no perfil profissional sugere capacidade elevada; "
                "reforço de proteção de vida se não houver vida ativo."
            ),
            inputs=("Perfil: profissional (renda/patrimônio)", "Carteira: vida"),
        ),
        BuiltinRecommendationRule(
            rule_id="CONTEXT_OPPORTUNITY",
            title="Contexto da oportunidade",
            description=(
                "Quando há oportunidade com produto em foco, ele é priorizado na narrativa "
                "consultiva (não substitui lacunas de proteção)."
            ),
            inputs=("Oportunidade: produto de interesse",),
        ),
    ]


def load_client_for_intel(db: Session, org_id: uuid.UUID, client_id: uuid.UUID) -> Client | None:
    return db.scalar(
        select(Client)
        .options(
            selectinload(Client.held_products).selectinload(ClientHeldProduct.product),
            selectinload(Client.line_of_business_links).selectinload(
                ClientLineOfBusiness.line_of_business,
            ),
        )
        .where(Client.id == client_id, Client.organization_id == org_id),
    )


def load_products_for_org(db: Session, org_id: uuid.UUID) -> list[Product]:
    return list(
        db.scalars(
            select(Product).where(Product.organization_id == org_id).order_by(Product.name),
        ).all(),
    )
