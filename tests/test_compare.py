"""Smoke tests for the compare function."""

import json

import pytest

from healthcare_crossroads import Household, Person, compare
from healthcare_crossroads.events import (
    ChildAgingOut,
    Divorce,
    JobChange,
    Marriage,
    MedicareTransition,
    Move,
    NewChild,
    Pregnancy,
    Retirement,
    Unemployment,
)


@pytest.fixture
def single_adult_household():
    """A single adult household in California."""
    return Household(
        state="CA",
        members=[Person(age=30, employment_income=50000)],
    )


@pytest.fixture
def married_household():
    """A married couple household in California."""
    return Household(
        state="CA",
        members=[
            Person(age=35, employment_income=60000, is_tax_unit_head=True),
            Person(age=33, employment_income=40000, is_tax_unit_spouse=True),
        ],
    )


@pytest.fixture
def family_household():
    """A family with children in California."""
    return Household(
        state="CA",
        members=[
            Person(age=35, employment_income=60000, is_tax_unit_head=True),
            Person(age=33, employment_income=40000, is_tax_unit_spouse=True),
            Person(age=10),
            Person(age=5),
        ],
    )


class TestCompareNewChild:
    """Tests for NewChild life event."""

    def test_new_child_runs(self, single_adult_household):
        """Smoke test: compare() runs without error for NewChild."""
        result = compare(single_adult_household, NewChild())
        assert result is not None
        assert result.event.name == "New Child"

    def test_new_child_adds_member(self, single_adult_household):
        """NewChild should add a member to the household."""
        event = NewChild(age=0)
        result = compare(single_adult_household, event)
        # After situation should have more people
        before_people = len(result.before_situation["people"])
        after_people = len(result.after_situation["people"])
        assert after_people == before_people + 1


class TestCompareMove:
    """Tests for Move life event."""

    def test_move_runs(self, single_adult_household):
        """Smoke test: compare() runs without error for Move."""
        result = compare(single_adult_household, Move(new_state="TX"))
        assert result is not None
        assert result.event.name == "Move"

    def test_move_changes_state(self, single_adult_household):
        """Move should change the state in the situation."""
        result = compare(single_adult_household, Move(new_state="TX"))
        after_state = result.after_situation["households"]["household"]["state_code"]
        assert after_state[2024] == "TX"


class TestCompareMarriage:
    """Tests for Marriage life event."""

    def test_marriage_runs(self, single_adult_household):
        """Smoke test: compare() runs without error for Marriage."""
        result = compare(
            single_adult_household,
            Marriage(spouse_age=28, spouse_employment_income=45000),
        )
        assert result is not None
        assert result.event.name == "Marriage"

    def test_marriage_adds_spouse(self, single_adult_household):
        """Marriage should add a spouse to the household."""
        result = compare(
            single_adult_household,
            Marriage(spouse_age=28, spouse_employment_income=45000),
        )
        before_people = len(result.before_situation["people"])
        after_people = len(result.after_situation["people"])
        assert after_people == before_people + 1


class TestCompareDivorce:
    """Tests for Divorce life event."""

    def test_divorce_runs(self, married_household):
        """Smoke test: compare() runs without error for Divorce."""
        result = compare(married_household, Divorce())
        assert result is not None
        assert result.event.name == "Divorce"

    def test_divorce_removes_spouse(self, married_household):
        """Divorce should remove the spouse from the household."""
        result = compare(married_household, Divorce())
        before_people = len(result.before_situation["people"])
        after_people = len(result.after_situation["people"])
        assert after_people == before_people - 1


class TestCompareJobChange:
    """Tests for JobChange life event."""

    def test_job_change_runs(self, single_adult_household):
        """Smoke test: compare() runs without error for JobChange."""
        result = compare(
            single_adult_household, JobChange(new_employment_income=75000)
        )
        assert result is not None
        assert result.event.name == "Job Change"


class TestCompareUnemployment:
    """Tests for Unemployment life event."""

    def test_unemployment_runs(self, single_adult_household):
        """Smoke test: compare() runs without error for Unemployment."""
        result = compare(
            single_adult_household, Unemployment(unemployment_compensation=20000)
        )
        assert result is not None
        assert result.event.name == "Unemployment"


class TestCompareRetirement:
    """Tests for Retirement life event."""

    def test_retirement_runs(self):
        """Smoke test: compare() runs without error for Retirement."""
        household = Household(
            state="CA",
            members=[Person(age=64, employment_income=80000)],
        )
        result = compare(household, Retirement(social_security_amount=30000))
        assert result is not None
        assert result.event.name == "Retirement"


class TestComparePregnancy:
    """Tests for Pregnancy life event."""

    def test_pregnancy_runs(self, single_adult_household):
        """Smoke test: compare() runs without error for Pregnancy."""
        result = compare(single_adult_household, Pregnancy())
        assert result is not None
        assert result.event.name == "Pregnancy"


class TestCompareMedicareTransition:
    """Tests for MedicareTransition life event."""

    def test_medicare_transition_runs(self):
        """Smoke test: compare() runs without error for MedicareTransition."""
        household = Household(
            state="CA",
            members=[Person(age=64, employment_income=50000)],
        )
        result = compare(household, MedicareTransition())
        assert result is not None
        assert result.event.name == "Medicare Transition"


class TestCompareChildAgingOut:
    """Tests for ChildAgingOut life event."""

    def test_child_aging_out_runs(self, family_household):
        """Smoke test: compare() runs without error for ChildAgingOut."""
        result = compare(family_household, ChildAgingOut(member_index=2))
        assert result is not None
        assert result.event.name == "Child Aging Out"


class TestComparisonResultSerialization:
    """Tests for ComparisonResult JSON serialization."""

    def test_to_dict_is_json_serializable(self, single_adult_household):
        """ComparisonResult.to_dict() should be JSON-serializable."""
        result = compare(single_adult_household, NewChild())
        result_dict = result.to_dict()

        # Should not raise
        json_str = json.dumps(result_dict)
        assert json_str is not None

        # Should round-trip
        parsed = json.loads(json_str)
        assert parsed["event"]["name"] == "New Child"
        assert "summary" in parsed
        assert "net_income" in parsed["summary"]
        assert "tax_liability" in parsed["summary"]

    def test_to_dict_structure(self, single_adult_household):
        """ComparisonResult.to_dict() should have expected structure."""
        result = compare(single_adult_household, NewChild())
        result_dict = result.to_dict()

        # Top-level keys
        assert "event" in result_dict
        assert "before_situation" in result_dict
        assert "after_situation" in result_dict
        assert "changes" in result_dict
        assert "summary" in result_dict

        # Event structure
        assert "name" in result_dict["event"]
        assert "description" in result_dict["event"]
        assert "type" in result_dict["event"]

        # Summary structure
        summary = result_dict["summary"]
        assert "before" in summary["net_income"]
        assert "after" in summary["net_income"]
        assert "change" in summary["net_income"]
        assert "new_benefits" in summary
        assert "lost_benefits" in summary


class TestValidationErrors:
    """Tests for validation error handling."""

    def test_divorce_without_spouse_raises(self, single_adult_household):
        """Divorce on a household without a spouse should raise ValueError."""
        with pytest.raises(ValueError, match="no spouse"):
            compare(single_adult_household, Divorce())

    def test_invalid_member_index_raises(self, single_adult_household):
        """Invalid member index should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid member index"):
            compare(single_adult_household, JobChange(member_index=5))

    def test_move_same_state_raises(self, single_adult_household):
        """Moving to the same state should raise ValueError."""
        with pytest.raises(ValueError, match="same as current"):
            compare(single_adult_household, Move(new_state="CA"))
