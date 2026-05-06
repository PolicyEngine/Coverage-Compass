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
        year=data.get("year", 2026),
        zip_code=data.get("zipCode") or None,
    )


def _divorce_children_leaving(params: dict, household: Household) -> list[int] | None:
    """Map the frontend's `childrenKeeping` to the indices of children who leave with the spouse.

    Children appear in `household.members` after the head and spouse. If the user keeps
    the first K children, the remaining ones (in original order) leave with the ex-spouse.
    """
    if "childrenKeeping" not in params:
        return None
    children_indices = [
        i for i, m in enumerate(household.members)
        if not m.is_tax_unit_head and not m.is_tax_unit_spouse
    ]
    keeping = max(0, min(int(params["childrenKeeping"]), len(children_indices)))
    leaving = children_indices[keeping:]
    return leaving or None


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
        "divorce": lambda: Divorce(
            head_loses_esi=params.get("headLosesEsi", False),
            children_leave_with_spouse=_divorce_children_leaving(params, household),
        ),
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


def _household_hash(household_dict: dict) -> str:
    """Stable canonical-JSON SHA256 hash of a household input dict.

    Returned by /api/baseline so the frontend can opaquely cache results.
    No longer used to short-circuit /api/simulate (the overlay never
    actually skipped work, just rewrote response numbers).
    """
    canonical = json.dumps(household_dict, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def _aca_premium_side(
    slcsp: float,
    lcbp: float,
    ptc: float,
    state: str,
) -> dict[str, Any]:
    """Build one side (before or after) of the acaPremiums payload.

    PolicyEngine US has reliable lcbp (lowest-cost bronze plan) data for
    HC.gov states from 2026 onward. State-exchange states (CA, NY, CO,
    DC, MA, NJ, etc.) currently get no lcbp data, so we estimate bronze
    from the state-average bronze/silver ratio.

    Silver net is computed from slcsp - ptc rather than PolicyEngine's
    `marketplace_net_premium` because the latter returns 0 when the
    household isn't enrolled (e.g. on Medicaid). For the plan-options
    card we want the hypothetical cost.
    """
    if 0 < lcbp < slcsp:
        bronze = lcbp
        bronze_is_estimate = False
    elif slcsp > 0:
        bronze = slcsp * get_bronze_silver_ratio(state)
        bronze_is_estimate = True
    else:
        bronze = 0.0
        bronze_is_estimate = False

    # Always compute net = gross - PTC. PolicyEngine's marketplace_net_premium
    # returns 0 when the household isn't enrolled (Medicaid or above-400%-FPL
    # without PTC), but the user wants to see the *hypothetical* out-of-pocket
    # cost of marketplace coverage in those cases.
    silver_net = max(0.0, slcsp - ptc)
    bronze_net = max(0.0, bronze - ptc)

    return {
        "silverGross": slcsp,
        "silverNet": silver_net,
        "bronzeGross": bronze,
        "bronzeNet": bronze_net,
        "ptc": ptc,
        "bronzeIsEstimate": bronze_is_estimate,
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
    ptc_change = result.changes.get("premium_tax_credit")
    if slcsp_change and (slcsp_change.before > 0 or slcsp_change.after > 0):
        state = _extract_state_code(result.before_situation)
        response["acaPremiums"] = {
            "before": _aca_premium_side(
                slcsp=slcsp_change.before,
                lcbp=lcbp_change.before if lcbp_change else 0,
                ptc=ptc_change.before if ptc_change else 0,
                state=state,
            ),
            "after": _aca_premium_side(
                slcsp=slcsp_change.after,
                lcbp=lcbp_change.after if lcbp_change else 0,
                ptc=ptc_change.after if ptc_change else 0,
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
                state=state,
            ),
        }

    return response


@app.route("/api/simulate", methods=["POST"])
def simulate():
    """Run a life event simulation (single or multiple events)."""
    try:
        data = request.get_json()
        household = create_household_from_request(data.get("household", {}))

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

        return jsonify(format_result_for_frontend(result))
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
