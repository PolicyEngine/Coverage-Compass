"""Modal app for Healthcare Crossroads simulations."""

import hashlib
import json
import modal

app = modal.App("healthcare-crossroads-api")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("policyengine-us>=1.0.0", "fastapi")
    .add_local_dir("healthcare_crossroads", "/root/healthcare_crossroads")
)

# Persistent cache for simulation results (survives container restarts)
cache = modal.Dict.from_name("healthcare-crossroads-cache", create_if_missing=True)


def get_cache_key(data: dict) -> str:
    """Generate a cache key from the request data."""
    # Normalize and hash the request
    normalized = json.dumps(data, sort_keys=True)
    return hashlib.md5(normalized.encode()).hexdigest()


@app.function(
    image=image,
    min_containers=1,
    timeout=300,
    memory=2048,
)
@modal.fastapi_endpoint(method="POST", docs=True)
def simulate(data: dict) -> dict:
    """Run a life event simulation."""
    import sys
    sys.path.insert(0, "/root")

    from healthcare_crossroads.compare import compare, compare_multiple
    from healthcare_crossroads.events import (
        ChildAgingOut,
        Divorce,
        JobChange,
        LosingESI,
        Marriage,
        MedicareTransition,
        Move,
        NewChild,
        Pregnancy,
        Retirement,
        Unemployment,
    )
    from healthcare_crossroads.events.base import LifeEvent
    from dataclasses import dataclass
    from typing import Optional

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
                parts.append(f"Spouse income: ${self.new_spouse_income:,.0f}")
            return "Changing " + " and ".join(parts) if parts else "Income change"

        def apply(self, household):
            new_household = household.copy()
            if self.new_head_income is not None and len(new_household.members) > 0:
                new_household.members[0].employment_income = self.new_head_income
            if self.new_spouse_income is not None and len(new_household.members) > 1:
                new_household.members[1].employment_income = self.new_spouse_income
            return new_household

        def validate(self, household):
            errors = []
            if self.new_head_income is not None and self.new_head_income < 0:
                errors.append("Head income cannot be negative")
            if self.new_spouse_income is not None and self.new_spouse_income < 0:
                errors.append("Spouse income cannot be negative")
            return errors
    from healthcare_crossroads.household import Household, Person
    from healthcare_crossroads.metadata import get_category, get_label, get_priority

    def create_household_from_request(data: dict) -> Household:
        """Convert frontend household format to backend Household."""
        members = []

        head = Person(
            age=data.get("age", 30),
            employment_income=data.get("income", 0),
            is_tax_unit_head=True,
            has_esi=data.get("hasESI", False),
        )
        members.append(head)

        filing_status = data.get("filingStatus", "single")
        if filing_status in ("married_jointly", "married_separately"):
            spouse = Person(
                age=data.get("spouseAge", data.get("age", 30)),
                employment_income=data.get("spouseIncome", 0),
                is_tax_unit_spouse=True,
                has_esi=data.get("spouseHasESI", False),
            )
            members.append(spouse)

        for age in data.get("childAges", []):
            members.append(Person(age=age))

        return Household(
            state=data.get("state", "CA"),
            members=members,
            year=data.get("year", 2025),
        )

    def create_event_from_request(event_type: str, params: dict, household: Household):
        """Convert frontend event type to backend LifeEvent."""
        event_map = {
            "having_baby": lambda: NewChild(),
            "moving_states": lambda: Move(new_state=params.get("newState", "TX")),
            "getting_married": lambda: Marriage(
                spouse_age=params.get("spouseAge", 30),
                spouse_employment_income=params.get("spouseIncome", 0),
                spouse_children=[Person(age=age) for age in params.get("spouseChildAges", [])],
                spouse_has_esi=params.get("spouseHasESI", False),
            ),
            "changing_income": lambda: IncomeChange(
                new_head_income=params.get("newIncome"),
                new_spouse_income=params.get("newSpouseIncome"),
            ),
            "retiring": lambda: Retirement(),
            "divorce": lambda: Divorce(),
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

        return response

    try:
        # Check cache first
        cache_key = get_cache_key(data)
        try:
            cached = cache[cache_key]
            if cached:
                return cached
        except KeyError:
            pass  # Not in cache

        # Run simulation
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

        # Cache the result
        try:
            cache[cache_key] = response
        except Exception:
            pass  # Don't fail if caching fails

        return response
    except ValueError as e:
        return {"error": str(e)}
    except Exception as e:
        return {"error": f"Simulation failed: {str(e)}"}

@app.function(image=image)
@modal.fastapi_endpoint(method="GET", docs=True)
def health() -> dict:
    """Health check endpoint."""
    return {"status": "ok"}
