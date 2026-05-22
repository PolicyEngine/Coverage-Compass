"""Tests for API request event construction."""

import pytest

from healthcare_crossroads.api import create_event_from_request
from healthcare_crossroads.household import Household, Person


def pregnant_household() -> Household:
    return Household(
        state="FL",
        members=[Person(age=25, employment_income=15660, is_pregnant=True)],
    )


class TestEndingPregnancyEvent:
    """Tests for ending pregnancy with optional newborns."""

    def test_zero_newborns_only_ends_pregnancy(self):
        household = pregnant_household()
        event = create_event_from_request(
            "ending_pregnancy",
            {"pregnantMemberIndex": 0, "newbornCount": 0},
            household,
        )

        after = event.apply(household)

        assert len(after.members) == 1
        assert not after.members[0].is_pregnant

    def test_newborn_count_adds_babies(self):
        household = pregnant_household()
        event = create_event_from_request(
            "ending_pregnancy",
            {"pregnantMemberIndex": 0, "newbornCount": 2},
            household,
        )

        after = event.apply(household)

        assert len(after.members) == 3
        assert not after.members[0].is_pregnant
        assert [member.age for member in after.members[1:]] == [0, 0]

    def test_newborn_count_must_be_in_supported_range(self):
        with pytest.raises(ValueError, match="between 0 and 3"):
            create_event_from_request(
                "ending_pregnancy",
                {"pregnantMemberIndex": 0, "newbornCount": 4},
                pregnant_household(),
            )
