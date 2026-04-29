"""Flask API for Healthcare Crossroads simulations."""

import hashlib
import json
from dataclasses import dataclass
from typing import Any, Optional

from flask import Flask, jsonify, request
from flask_cors import CORS

from .aca_data import get_bronze_silver_ratio
from .compare import compare, compare_multiple, run_baseline
from .events import (
    ChildAgingOut,
    Divorce,
    EndingPregnancy,
    LosingESI,
    Marriage,
    MedicareTransition,
    Move,
    NewChild,
    Pregnancy,
    Retirement,
    Unemployment,
)
from .events.base import LifeEvent
from .household import Household, Person
from .metadata import get_category, get_label, get_priority

app = Flask(__name__)
CORS(app)


@dataclass
class IncomeChange(LifeEvent):
    """Income change event that can modify both head and spouse incomes."""

    new_head_income: Optional[float] = None
    new_spouse_income: Optional[float] = None

    @property
    def name(self) -> str:
        return "Income Change"

    @property
    def description(self) -> str:
        parts = []
        if self.new_head_income is not None:
            parts.append(f"Your income: ${self.new_head_income:,.0f}")
        if self.new_spouse_income is not None:
            parts.append(f"Partner income: ${self.new_spouse_income:,.0f}")
        return "Changing " + " and ".join(parts) if parts else "Income change"

    def apply(self, household: Household):
        new_household = household.copy()
        if self.new_head_income is not None and len(new_household.members) > 0:
            new_household.members[0].employment_income = self.new_head_income
        if self.new_spouse_income is not None and len(new_household.members) > 1:
            new_household.members[1].employment_income = self.new_spouse_income
        return new_household

    def validate(self, household: Household):
        errors = []
        if self.new_head_income is not None and self.new_head_income < 0:
            errors.append("Head income cannot be negative")
        if self.new_spouse_income is not None and self.new_spouse_income < 0:
            errors.append("Partner income cannot be negative")
        return errors


def create_household_from_request(data: dict) -> Household:
    """Convert frontend household format to backend Household."""
    members = []

    # Create head of household
    head = Person(
        age=data.get("age", 30),
        employment_income=data.get("income", 0),
        is_tax_unit_head=True,
        has_esi=data.get("hasESI", False),
    )
    members.append(head)

    # Add spouse if married
    filing_status = data.get("filingStatus", "single")
    pregnant_member = data.get("pregnantMember")  # 'head', 'spouse', or null
    head.is_pregnant = pregnant_member == "head"

    if filing_status in ("married_jointly", "married_separately"):
        spouse = Person(
            age=data.get("spouseAge", data.get("age", 30)),
            employment_income=data.get("spouseIncome", 0),
            is_tax_unit_spouse=True,
            has_esi=data.get("spouseHasESI", False),
            is_pregnant=pregnant_member == "spouse",
        )
        members.append(spouse)

    # Add children
    for age in data.get("childAges", []):
        members.append(Person(age=age))

    return Household(
        state=data.get("state", "CA"),
        members=members,
        year=data.get("year", 2024),
        zip_code=data.get("zipCode") or None,
    )


def create_event_from_request(event_type: str, params: dict, household: Household):
    """Convert frontend event type to backend LifeEvent."""
    event_map = {
        "having_baby": lambda: Pregnancy(member_index=int(params.get("pregnantMemberIndex", 0))),
        "ending_pregnancy": lambda: EndingPregnancy(member_index=int(params.get("pregnantMemberIndex", 0))),
        "moving_states": lambda: Move(new_state=params.get("newState", "TX"), new_zip_code=params.get("newZipCode") or None),
        "getting_married": lambda: Marriage(
            spouse_age=params.get("spouseAge", 30),
            spouse_employment_income=params.get("spouseIncome", 0),
            spouse_children=[Person(age=age) for age in params.get("spouseChildAges", [])],
            spouse_has_esi=params.get("spouseHasESI", False),
        ),
        "changing_income": lambda: IncomeChange(
            new_head_income=params.get("newIncome", household.members[0].employment_income),
            new_spouse_income=params.get("newSpouseIncome"),
        ),
        "retiring": lambda: Retirement(),
        "divorce": lambda: Divorce(head_loses_esi=params.get("headLosesEsi", False)),
        "pregnancy": lambda: Pregnancy(),
        "unemployment": lambda: Unemployment(
            unemployment_compensation=params.get("unemploymentBenefits", 15000)
        ),
        "medicare_transition": lambda: MedicareTransition(),
        "child_aging_out": lambda: ChildAgingOut(),
        "losing_esi": lambda: LosingESI(),
    }

    if event_type not in event_map:
        raise ValueError(f"Unknown event type: {event_type}")

    return event_map[event_type]()


def _household_hash(household_dict: dict) -> str:
    """Stable canonical-JSON SHA256 hash of a household input dict.

    Used as a cache key so the frontend can pre-warm the baseline during the
    user's "thinking time" and have the server validate that the cached
    baseline still corresponds to the current household at Apply time.
    """
    canonical = json.dumps(household_dict, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _extract_state_code(situation: dict[str, Any]) -> str:
    """Pull the state code out of a PolicyEngine situation dict."""
    state = (
        situation.get("households", {})
        .get("household", {})
        .get("state_code", {})
    )
    if isinstance(state, dict):
        return next(iter(state.values()), "US")
    return state or "US"


def _aca_premium_side(
    slcsp: float,
    lcbp: float,
    ptc: float,
    net_premium: float,
    state: str,
) -> dict[str, Any]:
    """Build one side (before or after) of the acaPremiums payload."""
    use_real_bronze = lcbp > 0 and lcbp < slcsp
    bronze_ratio = get_bronze_silver_ratio(state)
    bronze = lcbp if use_real_bronze else slcsp * bronze_ratio
    return {
        "silverGross": slcsp,
        "silverNet": net_premium,
        "bronzeGross": bronze,
        "bronzeNet": max(0.0, bronze - ptc),
        "ptc": ptc,
        "bronzeIsEstimate": not use_real_bronze,
    }


def format_result_for_frontend(result) -> dict:
    """Convert ComparisonResult to frontend-expected format."""
    metrics = []
    for var_name, change in result.changes.items():
        if var_name == "household_net_income":
            continue
        metrics.append({
            "name": var_name,
            "label": get_label(var_name),
            "before": change.before,
            "after": change.after,
            "category": get_category(var_name),
            "priority": get_priority(var_name),
        })

    # Calculate totals
    total_tax_before = sum(
        c.before for name, c in result.changes.items() if get_category(name) == "tax"
    )
    total_tax_after = sum(
        c.after for name, c in result.changes.items() if get_category(name) == "tax"
    )
    total_benefits_before = sum(
        c.before for name, c in result.changes.items()
        if get_category(name) in ("benefit", "credit")
    )
    total_benefits_after = sum(
        c.after for name, c in result.changes.items()
        if get_category(name) in ("benefit", "credit")
    )

    response = {
        "before": {
            "netIncome": result.net_income_before,
            "totalTax": total_tax_before,
            "totalBenefits": total_benefits_before,
            "metrics": metrics,
        },
        "after": {
            "netIncome": result.net_income_after,
            "totalTax": total_tax_after,
            "totalBenefits": total_benefits_after,
            "metrics": [{**m, "before": m["after"]} for m in metrics],
        },
        "diff": {
            "netIncome": result.net_income_change,
            "totalTax": total_tax_after - total_tax_before,
            "totalBenefits": total_benefits_after - total_benefits_before,
        },
        "event": {
            "name": result.event.name,
            "description": result.event.description,
        },
    }

    # Add healthcare coverage info if available
    if result.healthcare_before:
        response["healthcareBefore"] = result.healthcare_before.to_dict()
    if result.healthcare_after:
        response["healthcareAfter"] = result.healthcare_after.to_dict()

    # Add ACA premium breakdown when marketplace coverage is in play
    slcsp_change = result.changes.get("slcsp")
    lcbp_change  = result.changes.get("lcbp")
    net_change = result.changes.get("marketplace_net_premium")
    ptc_change = result.changes.get("premium_tax_credit")
    if slcsp_change and (slcsp_change.before > 0 or slcsp_change.after > 0):
        state = _extract_state_code(result.before_situation)
        response["acaPremiums"] = {
            "before": _aca_premium_side(
                slcsp=slcsp_change.before,
                lcbp=lcbp_change.before if lcbp_change else 0,
                ptc=ptc_change.before if ptc_change else 0,
                net_premium=net_change.before if net_change else 0,
                state=state,
            ),
            "after": _aca_premium_side(
                slcsp=slcsp_change.after,
                lcbp=lcbp_change.after if lcbp_change else 0,
                ptc=ptc_change.after if ptc_change else 0,
                net_premium=net_change.after if net_change else 0,
                state=state,
            ),
        }

    return response


def run_baseline_response(household_dict: dict) -> dict:
    """Run the baseline simulation for a household and build the API payload.

    Returns a dict with:
      - healthcareBefore: HealthcareCoverage.to_dict() for the household
      - metrics: per-variable before values (matches result.before.metrics)
      - acaPremiums.before: when marketplace coverage is in play
      - householdHash: stable SHA256 of the canonical household input
    """
    household = create_household_from_request(household_dict)
    baseline = run_baseline(household)

    # Build per-variable metrics in the same shape as result.before.metrics.
    metrics = []
    for var_name, before_val in baseline.results.items():
        if var_name == "household_net_income":
            continue
        metrics.append({
            "name": var_name,
            "label": get_label(var_name),
            "before": before_val,
            "after": before_val,
            "category": get_category(var_name),
            "priority": get_priority(var_name),
        })

    response: dict[str, Any] = {
        "householdHash": _household_hash(household_dict),
        "metrics": metrics,
        "netIncome": baseline.results.get("household_net_income", 0.0),
    }

    if baseline.healthcare:
        response["healthcareBefore"] = baseline.healthcare.to_dict()

    slcsp_b = baseline.results.get("slcsp", 0.0)
    if slcsp_b > 0:
        state = _extract_state_code(baseline.situation)
        response["acaPremiums"] = {
            "before": _aca_premium_side(
                slcsp=slcsp_b,
                lcbp=baseline.results.get("lcbp", 0.0),
                ptc=baseline.results.get("premium_tax_credit", 0.0),
                net_premium=baseline.results.get("marketplace_net_premium", 0.0),
                state=state,
            ),
        }

    return response


def _apply_cached_before(response: dict, cached_before: dict) -> dict:
    """Overlay cached baseline values onto a freshly-built simulate response.

    The caller has already validated that the cache hash matches the current
    household. We replace the before-side metrics, healthcareBefore, and
    acaPremiums.before with the cached values, then recompute totals/diffs.

    The point of caching is correctness *and* perf — the cached values come
    from a baseline-only sim that should match what an after-cache sim would
    have produced. We still recompute aggregates from the cached numbers so
    the response is internally consistent.
    """
    cached_metrics = cached_before.get("metrics") or []
    cached_by_name = {m["name"]: m for m in cached_metrics}

    new_metrics = []
    for m in response["before"]["metrics"]:
        cached = cached_by_name.get(m["name"])
        if cached is not None:
            m = {**m, "before": cached["before"]}
        new_metrics.append(m)
    response["before"]["metrics"] = new_metrics

    # Recompute before-side totals from the (possibly cached) metrics.
    total_tax_before = sum(
        m["before"] for m in new_metrics if m["category"] == "tax"
    )
    total_benefits_before = sum(
        m["before"] for m in new_metrics if m["category"] in ("benefit", "credit")
    )
    response["before"]["totalTax"] = total_tax_before
    response["before"]["totalBenefits"] = total_benefits_before

    # Mirror metrics into the after-side baseline column.
    response["after"]["metrics"] = [
        {**m, "before": m["after"]} for m in new_metrics
    ]

    if "netIncome" in cached_before:
        response["before"]["netIncome"] = cached_before["netIncome"]
        response["diff"]["netIncome"] = (
            response["after"]["netIncome"] - cached_before["netIncome"]
        )

    # Recompute diffs against the cached before.
    response["diff"]["totalTax"] = response["after"]["totalTax"] - total_tax_before
    response["diff"]["totalBenefits"] = (
        response["after"]["totalBenefits"] - total_benefits_before
    )

    if "healthcareBefore" in cached_before:
        response["healthcareBefore"] = cached_before["healthcareBefore"]

    aca_cached = (cached_before.get("acaPremiums") or {}).get("before")
    if aca_cached and "acaPremiums" in response:
        response["acaPremiums"]["before"] = aca_cached

    return response


@app.route("/api/simulate", methods=["POST"])
def simulate():
    """Run a life event simulation (single or multiple events)."""
    try:
        data = request.get_json()
        household_dict = data.get("household", {})
        household = create_household_from_request(household_dict)

        # Optional: client-side baseline cache pre-warmed during wizard "thinking time".
        # Only used if its hash matches the canonical hash of the current household.
        cached_before = data.get("cachedBefore")
        cache_is_valid = (
            isinstance(cached_before, dict)
            and cached_before.get("householdHash") == _household_hash(household_dict)
        )

        # Support both single event and multiple events
        life_events = data.get("lifeEvents", [])
        single_event = data.get("lifeEvent")

        if life_events:
            # Multiple events mode
            events = []
            current_household = household
            for evt in life_events:
                event = create_event_from_request(
                    evt.get("type"),
                    evt.get("params", {}),
                    current_household,
                )
                events.append(event)
                # Update household for next event's context
                current_household = event.apply(current_household)
            result = compare_multiple(household, events)
        elif single_event:
            # Single event mode (backwards compatible)
            event = create_event_from_request(
                single_event.get("type"),
                single_event.get("params", {}),
                household,
            )
            result = compare(household, event)
        else:
            raise ValueError("No life event provided")

        response = format_result_for_frontend(result)
        if cache_is_valid:
            response = _apply_cached_before(response, cached_before)
        return jsonify(response)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Simulation failed: {str(e)}"}), 500


@app.route("/api/baseline", methods=["POST"])
def baseline():
    """Run only the baseline (no-event) simulation for a household.

    Returns the before-side healthcare coverage, per-variable metrics, optional
    ACA premium breakdown, and a stable household hash so the frontend can
    pre-warm this during the wizard and pass it back into /api/simulate at
    Apply time.
    """
    try:
        data = request.get_json()
        household_dict = data.get("household", {})
        return jsonify(run_baseline_response(household_dict))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Baseline simulation failed: {str(e)}"}), 500


@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
