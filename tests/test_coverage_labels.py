"""Tests for per-person coverage labels.

Most tests feed fixed outputs through a fake simulation, so PolicyEngine
computes nothing. The last class runs real single-household PolicyEngine
simulations, like tests/test_compare.py.
"""

import importlib
from types import SimpleNamespace

import pytest

from healthcare_crossroads import Household, Person
from healthcare_crossroads.api import (
    create_event_from_request,
    create_household_from_request,
)
from healthcare_crossroads.compare import (
    COVERAGE_CHIP,
    COVERAGE_ESI,
    COVERAGE_GAP,
    COVERAGE_MARKETPLACE,
    COVERAGE_MARKETPLACE_FULL_PRICE,
    COVERAGE_MARKETPLACE_NO_CREDIT,
    COVERAGE_MEDICAID,
    COVERAGE_MEDICARE,
    COVERAGE_MEDICARE_MEDICAID,
    PTC_INCOME_ABOVE_LIMIT,
    PTC_INCOME_BELOW_FLOOR,
    PTC_INCOME_ELIGIBLE,
    HealthcareCoverage,
    PersonHealthcare,
    classify_ptc_income,
    compare,
    ptc_income_range,
    run_baseline,
)

compare_module = importlib.import_module("healthcare_crossroads.compare")

# Brackets of PolicyEngine's gov.aca.ptc_income_eligibility parameter, as
# income-to-FPL ratios: 2026 caps eligibility at 400% FPL; 2021-2025 had no
# upper cap.
SCHEDULE_2026 = ([0.0, 1.0, 4.0], [False, True, False])
SCHEDULE_2025 = ([0.0, 1.0, 4.0], [False, True, True])


class FakeSimulation:
    """Stands in for policyengine_us.Simulation with fixed outputs."""

    def __init__(self, values: dict, schedule=SCHEDULE_2026):
        self.values = values
        if schedule is not None:
            thresholds, amounts = schedule
            scale = SimpleNamespace(thresholds=thresholds, amounts=amounts)
            params = SimpleNamespace(
                gov=SimpleNamespace(aca=SimpleNamespace(ptc_income_eligibility=scale))
            )
            self.tax_benefit_system = SimpleNamespace(parameters=lambda instant: params)

    def calculate(self, variable: str, year: int, map_to: str | None = None):
        if variable not in self.values:
            raise KeyError(variable)
        return self.values[variable]


def labels_for(
    household: Household,
    *,
    fraction: float,
    medicaid=None,
    chip=None,
    ptc: float = 0.0,
    ptc_eligible=None,
    medicare=None,
    schedule=SCHEDULE_2026,
):
    """Run the coverage extraction on fake outputs; return labels by person."""
    n = len(household.members)
    values = {
        "medicaid": medicaid or [0.0] * n,
        "chip": chip or [0.0] * n,
        "basic_health_program_enrolled": [False] * n,
        "premium_tax_credit": [ptc],
        "is_medicare_eligible": medicare or [m.age >= 65 for m in household.members],
        "is_aca_ptc_eligible": ptc_eligible or [False] * n,
        "aca_magi_fraction": [fraction] * n,
    }
    coverage = compare_module._extract_healthcare_coverage(
        FakeSimulation(values, schedule), household, household.year
    )
    return {p.label: p.coverage_type for p in coverage.people}, coverage


def single(age: int, state: str = "TX", has_esi: bool = False) -> Household:
    return Household(state=state, members=[Person(age=age, has_esi=has_esi)])


def couple(age: int = 40, state: str = "TX") -> Household:
    return Household(
        state=state,
        members=[
            Person(age=age, is_tax_unit_head=True),
            Person(age=age, is_tax_unit_spouse=True),
        ],
    )


class TestClassifyPtcIncome:
    """Placing an income-to-FPL ratio on PolicyEngine's PTC schedule."""

    @pytest.mark.parametrize(
        "fraction, expected",
        [
            (0.5, PTC_INCOME_BELOW_FLOOR),
            (0.99, PTC_INCOME_BELOW_FLOOR),
            (1.0, PTC_INCOME_ELIGIBLE),
            (2.5, PTC_INCOME_ELIGIBLE),
            (3.99, PTC_INCOME_ELIGIBLE),
            # PolicyEngine's bracket lookup puts exactly 4.00 in the
            # ineligible bracket; the label follows the model.
            (4.0, PTC_INCOME_ABOVE_LIMIT),
            (12.77, PTC_INCOME_ABOVE_LIMIT),
        ],
    )
    def test_2026_schedule(self, fraction, expected):
        assert classify_ptc_income(fraction, *SCHEDULE_2026) == expected

    def test_no_upper_limit_when_schedule_has_none(self):
        """2021-2025 had no cap, so high incomes are eligible, not above a limit."""
        assert classify_ptc_income(12.77, *SCHEDULE_2025) == PTC_INCOME_ELIGIBLE

    def test_no_eligible_bracket(self):
        assert classify_ptc_income(2.0, [0.0], [False]) is None

    def test_range_2026(self):
        assert ptc_income_range(*SCHEDULE_2026) == (1.0, 4.0)

    def test_range_without_cap(self):
        assert ptc_income_range(*SCHEDULE_2025) == (1.0, None)


class TestCoverageLabels:
    """Each label comes from PolicyEngine outputs, not a catch-all."""

    def test_full_price_above_income_limit(self):
        labels, _ = labels_for(single(40), fraction=12.77)
        assert labels == {"You": COVERAGE_MARKETPLACE_FULL_PRICE}

    def test_subsidized_marketplace_below_limit(self):
        labels, _ = labels_for(
            single(40), fraction=2.55, ptc=4401.66, ptc_eligible=[True]
        )
        assert labels == {"You": COVERAGE_MARKETPLACE}

    def test_coverage_gap(self):
        """Below 100% FPL in a non-expansion state: no Medicaid, no PTC."""
        labels, _ = labels_for(couple(), fraction=0.70)
        assert labels == {"You": COVERAGE_GAP, "Spouse": COVERAGE_GAP}

    def test_medicaid(self):
        labels, _ = labels_for(
            single(40, state="CA"), fraction=0.95, medicaid=[6439.11]
        )
        assert labels == {"You": COVERAGE_MEDICAID}

    def test_medicare(self):
        labels, _ = labels_for(single(66), fraction=3.83, medicare=[True])
        assert labels == {"You": COVERAGE_MEDICARE}

    def test_medicare_and_medicaid(self):
        labels, _ = labels_for(
            single(66, state="CA"), fraction=0.63, medicaid=[22373.06], medicare=[True]
        )
        assert labels == {"You": COVERAGE_MEDICARE_MEDICAID}

    def test_chip(self):
        household = Household(
            state="TX",
            members=[Person(age=40, has_esi=True), Person(age=8)],
        )
        labels, _ = labels_for(household, fraction=2.0, chip=[0.0, 3000.0])
        assert labels == {"You": COVERAGE_ESI, "Child 1": COVERAGE_CHIP}

    def test_esi_takes_precedence(self):
        labels, _ = labels_for(single(40, has_esi=True), fraction=12.77)
        assert labels == {"You": COVERAGE_ESI}

    def test_eligible_without_credit_is_not_full_price(self):
        """Inside the PTC income range, a $0 credit never reads as full price."""
        labels, _ = labels_for(
            couple(state="CA"), fraction=1.46, ptc_eligible=[True, True]
        )
        assert labels == {
            "You": COVERAGE_MARKETPLACE_NO_CREDIT,
            "Spouse": COVERAGE_MARKETPLACE_NO_CREDIT,
        }

    def test_high_income_without_cap_is_not_full_price(self):
        """The limit comes from the year's schedule, not a hard-coded 400%."""
        labels, _ = labels_for(
            single(22), fraction=5.0, ptc_eligible=[True], schedule=SCHEDULE_2025
        )
        assert labels == {"You": COVERAGE_MARKETPLACE_NO_CREDIT}

    def test_unknown_schedule_does_not_guess(self):
        """If the PTC schedule can't be read, no reason-naming label is used."""
        labels, coverage = labels_for(single(40), fraction=12.77, schedule=None)
        assert labels == {"You": None}
        assert coverage.ptc_income_floor is None
        assert coverage.ptc_income_limit is None

    def test_to_dict_reports_ptc_income_range(self):
        _, coverage = labels_for(single(40), fraction=12.77)
        data = coverage.to_dict()
        assert data["ptc_income_floor"] == 1.0
        assert data["ptc_income_limit"] == 4.0
        assert data["summary"] == {COVERAGE_MARKETPLACE_FULL_PRICE: ["You"]}


class TestCounterfactualRemap:
    """Marriage and divorce remaps keep every coverage field."""

    def test_merge_keeps_income_range_and_band(self):
        primary = HealthcareCoverage(
            people=[PersonHealthcare(person_index=0, label="You", marketplace=True)],
            has_ptc=True,
            ptc_income_floor=1.0,
            ptc_income_limit=4.0,
        )
        extra = HealthcareCoverage(
            people=[
                PersonHealthcare(
                    person_index=1,
                    label="Spouse",
                    ptc_income_band=PTC_INCOME_ABOVE_LIMIT,
                )
            ],
        )
        merged = compare_module._merge_healthcare_coverage(primary, extra)
        assert merged.ptc_income_limit == 4.0
        assert [p.coverage_type for p in merged.people] == [
            COVERAGE_MARKETPLACE,
            COVERAGE_MARKETPLACE_FULL_PRICE,
        ]


def _request(**overrides):
    request = {
        "zipCode": "",
        "filingStatus": "single",
        "spouseIncome": 0,
        "childAges": [],
        "hasESI": False,
        "spouseHasESI": False,
        "year": 2026,
    }
    request.update(overrides)
    return request


class TestCoverageLabelsWithPolicyEngine:
    """Single-household PolicyEngine runs through the API's household builder."""

    @pytest.mark.parametrize(
        "request_data, expected",
        [
            (
                _request(state="TX", income=200_000, age=40),
                {"You": COVERAGE_MARKETPLACE_FULL_PRICE},
            ),
            (
                _request(state="TX", income=40_000, age=40),
                {"You": COVERAGE_MARKETPLACE},
            ),
            (
                _request(
                    state="TX",
                    filingStatus="married_jointly",
                    income=15_000,
                    age=40,
                    spouseAge=40,
                ),
                {"You": COVERAGE_GAP, "Spouse": COVERAGE_GAP},
            ),
            (
                _request(state="CA", zipCode="94110", income=15_000, age=40),
                {"You": COVERAGE_MEDICAID},
            ),
            (
                _request(state="TX", income=60_000, age=66),
                {"You": COVERAGE_MEDICARE},
            ),
            (
                _request(state="CA", zipCode="94110", income=10_000, age=66),
                {"You": COVERAGE_MEDICARE_MEDICAID},
            ),
        ],
        ids=[
            "tx-above-limit",
            "tx-subsidized",
            "tx-coverage-gap",
            "ca-medicaid",
            "tx-medicare",
            "ca-medicare-medicaid",
        ],
    )
    def test_labels(self, request_data, expected):
        baseline = run_baseline(create_household_from_request(request_data))
        labels = {p.label: p.coverage_type for p in baseline.healthcare.people}
        assert labels == expected


class TestCaliforniaCoupleRegression:
    """Married couple, both 40, San Francisco (94110), no employer coverage.

    At $31,000 (146% of the prior-year FPL) they are above Medi-Cal's adult
    limit and inside the premium tax credit's range, but below the joint
    filing threshold. policyengine-us before 2.42.2 zeroed the credit for
    households that weren't otherwise filers, so the tool showed $0 and
    "No coverage". The tool now marks the tax unit as filing a return, as
    claiming the credit requires (26 CFR 1.6011-8(a)).
    """

    @staticmethod
    def household(income: float):
        return create_household_from_request(
            _request(
                state="CA",
                zipCode="94110",
                filingStatus="married_jointly",
                income=income,
                age=40,
                spouseAge=40,
            )
        )

    def test_couple_at_31k_gets_tax_credit(self):
        baseline = run_baseline(self.household(31_000))
        # Benchmark of about $17,441 less a required contribution of about
        # $1,222 (3.94% of $31,000) under the pinned policyengine-us.
        assert baseline.results["premium_tax_credit"] > 10_000
        assert baseline.results["medicaid"] == 0
        labels = {p.label: p.coverage_type for p in baseline.healthcare.people}
        assert labels == {"You": COVERAGE_MARKETPLACE, "Spouse": COVERAGE_MARKETPLACE}

    def test_income_drop_to_31k_keeps_tax_credit(self):
        household = self.household(36_000)
        event = create_event_from_request(
            "changing_income", {"newIncome": 31_000}, household
        )
        result = compare(household, event)
        ptc = result.changes["premium_tax_credit"]
        assert ptc.before > 0
        assert ptc.after > ptc.before  # lower income, larger credit
        after = {p.label: p.coverage_type for p in result.healthcare_after.people}
        assert after == {"You": COVERAGE_MARKETPLACE, "Spouse": COVERAGE_MARKETPLACE}
