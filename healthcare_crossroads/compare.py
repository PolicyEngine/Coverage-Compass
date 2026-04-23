"""Compare function for running before/after simulations."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any

from policyengine_us import Simulation

from .events.base import LifeEvent
from .events.marriage import Marriage
from .household import Household, Person


# All variables to track in comparisons - comprehensive list
OUTPUT_VARIABLES = [
    # Net income (summary)
    "household_net_income",
    # Gross income
    "employment_income",
    "self_employment_income",
    # === FEDERAL TAXES ===
    "income_tax",
    "employee_payroll_tax",
    "self_employment_tax",
    # === STATE TAXES ===
    "state_income_tax",
    # === FEDERAL BENEFITS ===
    # Food assistance
    "snap",
    "free_school_meals",
    "reduced_price_school_meals",
    "school_meal_subsidy",
    "wic",
    # Cash assistance
    "tanf",
    "ssi",
    "social_security",
    # Housing
    "spm_unit_capped_housing_subsidy",
    # Healthcare
    "medicaid",
    "chip",
    # ACA marketplace premiums
    "slcsp",               # gross silver benchmark plan (annual)
    "marketplace_net_premium",  # net after PTC (annual)
    # Energy/utilities
    "liheap",  # Low Income Home Energy Assistance
    "lifeline",  # Phone/broadband subsidy
    "acp",  # Affordable Connectivity Program
    # Childcare
    "ccdf",  # Child Care Development Fund subsidy
    # === FEDERAL TAX CREDITS ===
    "earned_income_tax_credit",
    "ctc",  # Total Child Tax Credit
    "non_refundable_ctc",  # CTC portion that reduces tax liability
    "refundable_ctc",  # CTC portion that can be refunded
    "cdcc",  # Child and Dependent Care Credit
    "premium_tax_credit",
    # Other credits
    "savers_credit",
    "american_opportunity_credit",
    "lifetime_learning_credit",
    # === STATE BENEFITS & CREDITS ===
    # Aggregates (auto-filled based on state)
    "state_eitc",  # State EITC (aggregates all state EITCs)
    "state_ctc",  # State CTC (aggregates all state CTCs)
    # California
    "ca_eitc",
    "ca_yctc",  # Young Child Tax Credit
    "ca_renter_credit",
    "ca_tanf",  # CalWORKs cash assistance
    "ca_state_supplement",  # SSI state supplement
    # New York
    "ny_eitc",
    "ny_ctc",
    "ny_tanf",
    # Colorado
    "co_eitc",
    "co_ctc",
    "co_tanf",
    "co_state_supplement",  # SSI supplement
    "co_ccap_subsidy",  # Childcare assistance
    "co_family_affordability_credit",
    # Maryland
    "md_eitc",
    "md_ctc",
    # New Jersey
    "nj_eitc",
    "nj_ctc",
    # Illinois
    "il_eitc",
    "il_ctc",
    # DC
    "dc_eitc",
    "dc_ctc",
    "dc_tanf",
    "dc_snap_temporary_local_benefit",  # DC SNAP supplement
    # Oregon
    "or_eitc",
    "or_ctc",
    # New Mexico
    "nm_eitc",
    "nm_ctc",
    # Massachusetts
    "ma_eitc",
    "ma_child_and_family_credit",
    # Washington (no income tax but has this)
    "wa_working_families_tax_credit",
    # Connecticut
    "ct_child_tax_rebate",
    "ct_property_tax_credit",
    # Minnesota
    "mn_child_and_working_families_credits",
    # Other states with EITC
    "vt_eitc",
    "vt_ctc",
    "me_eitc",
    "ri_eitc",
    "oh_eitc",
    "ne_eitc",
    "sc_eitc",
    "ok_eitc",
    "hi_eitc",
    "ut_eitc",
    "ut_ctc",
]


@dataclass
class PersonHealthcare:
    """Healthcare coverage info for a single person."""

    person_index: int
    label: str  # "You", "Spouse", "Child 1", etc.
    medicaid: bool = False
    chip: bool = False
    marketplace: bool = False  # ACA marketplace (inferred from PTC)
    esi: bool = False  # Employer-sponsored insurance

    @property
    def coverage_type(self) -> str | None:
        """Return the primary coverage type for this person."""
        if self.esi:
            return "ESI"
        if self.medicaid:
            return "Medicaid"
        if self.chip:
            return "CHIP"
        if self.marketplace:
            return "Marketplace"
        return None


@dataclass
class HealthcareCoverage:
    """Healthcare coverage breakdown for the household."""

    people: list[PersonHealthcare]
    has_ptc: bool = False  # Whether household receives Premium Tax Credit

    def get_coverage_summary(self) -> dict[str, list[str]]:
        """Return dict mapping coverage type to list of person labels."""
        summary: dict[str, list[str]] = {
            "ESI": [],
            "Medicaid": [],
            "CHIP": [],
            "Marketplace": [],
        }
        for p in self.people:
            if p.esi:
                summary["ESI"].append(p.label)
            elif p.medicaid:
                summary["Medicaid"].append(p.label)
            elif p.chip:
                summary["CHIP"].append(p.label)
            elif p.marketplace:
                summary["Marketplace"].append(p.label)
        return {k: v for k, v in summary.items() if v}

    def to_dict(self) -> dict[str, Any]:
        """Convert to JSON-serializable dictionary."""
        return {
            "people": [
                {
                    "index": p.person_index,
                    "label": p.label,
                    "coverage": p.coverage_type,
                }
                for p in self.people
            ],
            "summary": self.get_coverage_summary(),
            "has_ptc": self.has_ptc,
        }


@dataclass
class BenefitChange:
    """Represents a change in a specific benefit or tax."""

    name: str
    before: float
    after: float

    @property
    def change(self) -> float:
        return self.after - self.before

    @property
    def percent_change(self) -> float | None:
        if self.before == 0:
            return None
        return (self.after - self.before) / self.before * 100

    def to_dict(self) -> dict[str, Any]:
        """Convert to JSON-serializable dictionary."""
        return {
            "name": self.name,
            "before": self.before,
            "after": self.after,
            "change": self.change,
            "percent_change": self.percent_change,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "BenefitChange":
        """Create from dictionary."""
        return cls(
            name=data["name"],
            before=data["before"],
            after=data["after"],
        )


@dataclass
class ComparisonResult:
    """Result of comparing a household before and after a life event."""

    event: LifeEvent
    before_situation: dict[str, Any]
    after_situation: dict[str, Any]
    changes: dict[str, BenefitChange] = field(default_factory=dict)
    healthcare_before: HealthcareCoverage | None = None
    healthcare_after: HealthcareCoverage | None = None

    @property
    def net_income_before(self) -> float:
        return self.changes.get("household_net_income", BenefitChange("", 0, 0)).before

    @property
    def net_income_after(self) -> float:
        return self.changes.get("household_net_income", BenefitChange("", 0, 0)).after

    @property
    def net_income_change(self) -> float:
        return self.net_income_after - self.net_income_before

    @property
    def tax_liability_before(self) -> float:
        """Total tax liability before the event."""
        taxes = ["income_tax", "state_income_tax", "employee_payroll_tax", "self_employment_tax"]
        return sum(
            self.changes.get(t, BenefitChange("", 0, 0)).before
            for t in taxes
        )

    @property
    def tax_liability_after(self) -> float:
        """Total tax liability after the event."""
        taxes = ["income_tax", "state_income_tax", "employee_payroll_tax", "self_employment_tax"]
        return sum(
            self.changes.get(t, BenefitChange("", 0, 0)).after
            for t in taxes
        )

    @property
    def tax_change(self) -> float:
        return self.tax_liability_after - self.tax_liability_before

    @property
    def new_benefits(self) -> list[str]:
        """Benefits that were zero before but positive after."""
        result = []
        benefit_vars = [
            "snap", "tanf", "ssi", "earned_income_tax_credit",
            "child_tax_credit", "refundable_ctc", "premium_tax_credit",
        ]
        for var in benefit_vars:
            if var in self.changes:
                change = self.changes[var]
                if change.before == 0 and change.after > 0:
                    result.append(var)
        return result

    @property
    def lost_benefits(self) -> list[str]:
        """Benefits that were positive before but zero after."""
        result = []
        benefit_vars = [
            "snap", "tanf", "ssi", "earned_income_tax_credit",
            "child_tax_credit", "refundable_ctc", "premium_tax_credit",
        ]
        for var in benefit_vars:
            if var in self.changes:
                change = self.changes[var]
                if change.before > 0 and change.after == 0:
                    result.append(var)
        return result

    def summary(self) -> str:
        """Generate a human-readable summary of the comparison."""
        lines = [
            f"Life Event: {self.event.name}",
            f"  {self.event.description}",
            "",
            "Net Income:",
            f"  Before: ${self.net_income_before:,.2f}",
            f"  After:  ${self.net_income_after:,.2f}",
            f"  Change: ${self.net_income_change:+,.2f}",
            "",
            "Tax Liability:",
            f"  Before: ${self.tax_liability_before:,.2f}",
            f"  After:  ${self.tax_liability_after:,.2f}",
            f"  Change: ${self.tax_change:+,.2f}",
        ]

        if self.new_benefits:
            lines.append("")
            lines.append("New Benefits Gained:")
            for b in self.new_benefits:
                amount = self.changes[b].after
                lines.append(f"  - {b}: ${amount:,.2f}")

        if self.lost_benefits:
            lines.append("")
            lines.append("Benefits Lost:")
            for b in self.lost_benefits:
                amount = self.changes[b].before
                lines.append(f"  - {b}: ${amount:,.2f}")

        return "\n".join(lines)

    def to_dict(self) -> dict[str, Any]:
        """
        Convert to JSON-serializable dictionary for API responses.

        Returns a dictionary with computed properties included for
        frontend consumption.
        """
        result = {
            "event": {
                "name": self.event.name,
                "description": self.event.description,
                "type": self.event.__class__.__name__,
            },
            "before_situation": self.before_situation,
            "after_situation": self.after_situation,
            "changes": {k: v.to_dict() for k, v in self.changes.items()},
            "summary": {
                "net_income": {
                    "before": self.net_income_before,
                    "after": self.net_income_after,
                    "change": self.net_income_change,
                },
                "tax_liability": {
                    "before": self.tax_liability_before,
                    "after": self.tax_liability_after,
                    "change": self.tax_change,
                },
                "new_benefits": self.new_benefits,
                "lost_benefits": self.lost_benefits,
            },
        }
        if self.healthcare_before:
            result["healthcare_before"] = self.healthcare_before.to_dict()
        if self.healthcare_after:
            result["healthcare_after"] = self.healthcare_after.to_dict()
        return result


def _run_simulation(situation: dict[str, Any], year: int) -> tuple[dict[str, float], Simulation]:
    """Run a PolicyEngine simulation and extract key outputs.

    Returns both the aggregated results and the simulation object for
    further per-person analysis.
    """
    sim = Simulation(situation=situation)
    results = {}

    for var in OUTPUT_VARIABLES:
        try:
            value = sim.calculate(var, year)
            # Sum across all entities if array
            if hasattr(value, "__iter__"):
                results[var] = float(sum(value))
            else:
                results[var] = float(value)
        except Exception:
            results[var] = 0.0

    return results, sim


def _get_person_label(index: int, household: Household) -> str:
    """Get a human-readable label for a person by index."""
    if index >= len(household.members):
        return f"Person {index + 1}"

    member = household.members[index]
    if member.is_tax_unit_head:
        return "You"
    if member.is_tax_unit_spouse:
        return "Spouse"

    # Count children to get child number
    child_num = 0
    for i, m in enumerate(household.members):
        if not m.is_tax_unit_head and not m.is_tax_unit_spouse:
            child_num += 1
            if i == index:
                return f"Child {child_num}"

    return f"Person {index + 1}"


def _extract_healthcare_coverage(
    sim: Simulation,
    household: Household,
    year: int,
) -> HealthcareCoverage:
    """Extract per-person healthcare coverage from a simulation."""
    num_people = len(household.members)

    # Get per-person healthcare values
    try:
        medicaid_values = sim.calculate("medicaid", year)
    except Exception:
        medicaid_values = [0.0] * num_people

    try:
        chip_values = sim.calculate("chip", year)
    except Exception:
        chip_values = [0.0] * num_people

    # Get household-level PTC
    try:
        ptc_value = float(sum(sim.calculate("premium_tax_credit", year)))
    except Exception:
        ptc_value = 0.0

    has_ptc = ptc_value > 0

    # Build per-person coverage
    people = []
    for i in range(num_people):
        member = household.members[i]
        medicaid_amount = float(medicaid_values[i]) if i < len(medicaid_values) else 0.0
        chip_amount = float(chip_values[i]) if i < len(chip_values) else 0.0

        # Check ESI first (from household member data)
        has_esi = member.has_esi

        on_medicaid = medicaid_amount > 0 and not has_esi
        on_chip = chip_amount > 0 and not has_esi
        # If not on ESI/Medicaid/CHIP but household has PTC, person is on marketplace
        on_marketplace = has_ptc and not has_esi and not on_medicaid and not on_chip

        people.append(PersonHealthcare(
            person_index=i,
            label=_get_person_label(i, household),
            esi=has_esi,
            medicaid=on_medicaid,
            chip=on_chip,
            marketplace=on_marketplace,
        ))

    return HealthcareCoverage(people=people, has_ptc=has_ptc)


def _extract_counterfactual_before_coverage(
    household: Household,
    after_household: Household,
    event: LifeEvent,
) -> HealthcareCoverage | None:
    """Estimate pre-event coverage for people joining the household via marriage."""
    if not isinstance(event, Marriage):
        return None

    spouse_household = Household(
        state=household.state,
        members=[
            Person(
                age=event.spouse_age,
                employment_income=event.spouse_employment_income,
                self_employment_income=event.spouse_self_employment_income,
                is_tax_unit_head=True,
                has_esi=event.spouse_has_esi,
            ),
            *[deepcopy(child) for child in event.spouse_children],
        ],
        year=household.year,
        county=household.county,
        zip_code=household.zip_code,
    )
    _, spouse_sim = _run_simulation(
        spouse_household.to_situation(), spouse_household.year
    )
    spouse_coverage = _extract_healthcare_coverage(
        spouse_sim,
        spouse_household,
        spouse_household.year,
    )

    starting_index = len(household.members)
    remapped_people = []
    for offset, person in enumerate(spouse_coverage.people):
        after_index = starting_index + offset
        remapped_people.append(
            PersonHealthcare(
                person_index=after_index,
                label=_get_person_label(after_index, after_household),
                medicaid=person.medicaid,
                chip=person.chip,
                marketplace=person.marketplace,
                esi=person.esi,
            )
        )

    return HealthcareCoverage(
        people=remapped_people,
        has_ptc=spouse_coverage.has_ptc,
    )


def _merge_healthcare_coverage(
    primary: HealthcareCoverage,
    extra: HealthcareCoverage | None,
) -> HealthcareCoverage:
    """Merge in extra per-person coverage without overwriting actual household members."""
    if extra is None or not extra.people:
        return primary

    merged_people = {person.label: person for person in primary.people}
    for person in extra.people:
        merged_people.setdefault(person.label, person)

    return HealthcareCoverage(
        people=sorted(merged_people.values(), key=lambda person: person.person_index),
        has_ptc=primary.has_ptc or extra.has_ptc,
    )


def compare(
    household: Household,
    event: LifeEvent,
    variables: list[str] | None = None,
) -> ComparisonResult:
    """
    Compare a household's taxes and benefits before and after a life event.

    Args:
        household: The baseline household before the event.
        event: The life event to simulate.
        variables: Optional list of variables to compare. Defaults to
            OUTPUT_VARIABLES.

    Returns:
        A ComparisonResult containing the before/after comparison.

    Raises:
        ValueError: If the life event cannot be applied to the household.
    """
    # Validate the event can be applied
    errors = event.validate(household)
    if errors:
        raise ValueError(f"Cannot apply {event.name}: {'; '.join(errors)}")

    # Get before and after situations
    before_situation = household.to_situation()
    after_household = event.apply(household)
    after_situation = after_household.to_situation()

    # Run simulations
    before_results, before_sim = _run_simulation(before_situation, household.year)
    after_results, after_sim = _run_simulation(after_situation, after_household.year)

    # Extract healthcare coverage
    healthcare_before = _extract_healthcare_coverage(before_sim, household, household.year)
    healthcare_after = _extract_healthcare_coverage(after_sim, after_household, after_household.year)
    healthcare_before = _merge_healthcare_coverage(
        healthcare_before,
        _extract_counterfactual_before_coverage(household, after_household, event),
    )

    # Build changes dictionary
    vars_to_compare = variables or OUTPUT_VARIABLES
    changes = {}
    for var in vars_to_compare:
        before_val = before_results.get(var, 0.0)
        after_val = after_results.get(var, 0.0)
        changes[var] = BenefitChange(
            name=var,
            before=before_val,
            after=after_val,
        )

    return ComparisonResult(
        event=event,
        before_situation=before_situation,
        after_situation=after_situation,
        changes=changes,
        healthcare_before=healthcare_before,
        healthcare_after=healthcare_after,
    )


@dataclass
class CombinedEvent(LifeEvent):
    """A wrapper that combines multiple life events into one."""

    events: list[LifeEvent] = field(default_factory=list)

    @property
    def name(self) -> str:
        if not self.events:
            return "No events"
        return " + ".join(e.name for e in self.events)

    @property
    def description(self) -> str:
        if not self.events:
            return "No life events selected"
        return ", ".join(e.description for e in self.events)

    def apply(self, household: Household) -> Household:
        """Apply all events in sequence."""
        current = household
        for event in self.events:
            current = event.apply(current)
        return current

    def validate(self, household: Household) -> list[str]:
        """Validate all events can be applied in sequence."""
        errors = []
        current = household
        for i, event in enumerate(self.events):
            event_errors = event.validate(current)
            if event_errors:
                errors.extend([f"Event {i+1} ({event.name}): {e}" for e in event_errors])
            else:
                # Apply event to validate next one against updated household
                current = event.apply(current)
        return errors


def compare_multiple(
    household: Household,
    events: list[LifeEvent],
    variables: list[str] | None = None,
) -> ComparisonResult:
    """
    Compare a household before and after multiple life events.

    Events are applied in sequence, and the result shows the baseline
    household compared to the final state after all events.

    Args:
        household: The baseline household before events.
        events: List of life events to apply in order.
        variables: Optional list of variables to compare.

    Returns:
        A ComparisonResult with the combined event.
    """
    if not events:
        raise ValueError("At least one life event is required")

    if len(events) == 1:
        return compare(household, events[0], variables)

    combined = CombinedEvent(events=events)
    return compare(household, combined, variables)


def calculate_cliff_analysis(
    household: Household,
    income_min: int = 0,
    income_max: int = 150000,
    num_points: int = 30,
) -> list[dict[str, Any]]:
    """
    Calculate taxes and benefits at multiple income levels to show cliff effects.

    This helps users visualize how their benefits change as income increases,
    revealing "benefit cliffs" where a small income increase can result in
    a large loss of benefits.

    Args:
        household: The baseline household (income will be varied).
        income_min: Minimum income to simulate.
        income_max: Maximum income to simulate.
        num_points: Number of data points to calculate.

    Returns:
        A list of data points, each containing:
        - income: the gross income level
        - netIncome: total after taxes and benefits
        - totalTax: sum of all taxes
        - totalBenefits: sum of all benefits
        - totalCredits: sum of all tax credits
        - breakdown: dict of individual program amounts
    """
    from .metadata import get_category

    # Generate income points (use more points near common cliff areas)
    step = (income_max - income_min) / (num_points - 1)
    income_points = [int(income_min + i * step) for i in range(num_points)]

    results = []

    for income in income_points:
        # Create a modified household with the new income
        modified_household = household.copy()
        if modified_household.members:
            modified_household.members[0].employment_income = float(income)

        # Run simulation
        situation = modified_household.to_situation()
        sim_results, _ = _run_simulation(situation, modified_household.year)

        # Categorize results
        total_tax = 0.0
        total_benefits = 0.0
        total_credits = 0.0
        breakdown = {}

        for var, value in sim_results.items():
            if var == "household_net_income":
                continue
            if value == 0:
                continue

            category = get_category(var)
            breakdown[var] = value

            if category == "tax":
                total_tax += value
            elif category == "benefit":
                total_benefits += value
            elif category in ("credit", "state_credit"):
                total_credits += value
            elif category == "state_benefit":
                total_benefits += value

        # Calculate net income
        net_income = income - total_tax + total_benefits + total_credits

        results.append({
            "income": income,
            "netIncome": round(net_income, 2),
            "totalTax": round(total_tax, 2),
            "totalBenefits": round(total_benefits, 2),
            "totalCredits": round(total_credits, 2),
            "marginalRate": 0,  # Will calculate after
            "breakdown": {k: round(v, 2) for k, v in breakdown.items() if v != 0},
        })

    # Calculate marginal rates and identify cliff causes
    for i in range(1, len(results)):
        income_change = results[i]["income"] - results[i - 1]["income"]
        net_change = results[i]["netIncome"] - results[i - 1]["netIncome"]
        if income_change > 0:
            # Marginal rate = 1 - (net income gain / gross income gain)
            # A rate > 100% means you lose money by earning more
            marginal_rate = 1 - (net_change / income_change)
            results[i]["marginalRate"] = round(marginal_rate * 100, 1)

            # Find which programs changed the most (cliff causes)
            cliff_causes = []
            prev_breakdown = results[i - 1]["breakdown"]
            curr_breakdown = results[i]["breakdown"]

            # Get all programs from both points
            all_programs = set(prev_breakdown.keys()) | set(curr_breakdown.keys())

            for prog in all_programs:
                prev_val = prev_breakdown.get(prog, 0)
                curr_val = curr_breakdown.get(prog, 0)
                change = curr_val - prev_val

                # Track significant changes (benefits lost or taxes increased)
                if abs(change) > 100:  # More than $100 change
                    cliff_causes.append({
                        "program": prog,
                        "change": round(change, 0),
                    })

            # Sort by impact (biggest losses first)
            cliff_causes.sort(key=lambda x: x["change"])
            results[i]["cliffCauses"] = cliff_causes[:5]  # Top 5 causes

    return results
