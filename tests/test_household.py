"""Tests for the Household model."""

import pytest

from healthcare_crossroads import Household, Person


class TestPerson:
    """Tests for the Person class."""

    def test_person_creation(self):
        """Person can be created with basic attributes."""
        person = Person(age=30, employment_income=50000)
        assert person.age == 30
        assert person.employment_income == 50000

    def test_person_to_situation_dict(self):
        """Person.to_situation_dict() produces correct format."""
        person = Person(
            age=30,
            employment_income=50000,
            self_employment_income=10000,
        )
        result = person.to_situation_dict(2024)

        assert result["age"] == {2024: 30}
        assert result["employment_income"] == {2024: 50000}
        assert result["self_employment_income"] == {2024: 10000}

    def test_person_pregnancy_in_situation(self):
        """Pregnant person includes is_pregnant in situation."""
        person = Person(age=28, is_pregnant=True)
        result = person.to_situation_dict(2024)
        assert result["is_pregnant"] == {2024: True}

    def test_person_not_pregnant_excludes_field(self):
        """Non-pregnant person doesn't include is_pregnant."""
        person = Person(age=28, is_pregnant=False)
        result = person.to_situation_dict(2024)
        assert "is_pregnant" not in result


class TestHousehold:
    """Tests for the Household class."""

    def test_household_requires_members(self):
        """Household must have at least one member."""
        with pytest.raises(ValueError, match="at least one member"):
            Household(state="CA", members=[])

    def test_household_creation(self):
        """Household can be created with basic attributes."""
        household = Household(
            state="CA",
            members=[Person(age=30, employment_income=50000)],
        )
        assert household.state == "CA"
        assert len(household.members) == 1

    def test_household_with_county_and_zip(self):
        """Household can include county and zip code."""
        household = Household(
            state="CA",
            county="Los Angeles County",
            zip_code="90210",
            members=[Person(age=30)],
        )
        assert household.county == "Los Angeles County"
        assert household.zip_code == "90210"

    def test_household_auto_assigns_head(self):
        """First adult is automatically assigned as head."""
        household = Household(
            state="CA",
            members=[Person(age=30), Person(age=28)],
        )
        assert household.members[0].is_tax_unit_head
        assert household.members[1].is_tax_unit_spouse

    def test_household_from_dict(self):
        """Household.from_dict() creates household correctly."""
        data = {
            "state": "TX",
            "county": "Harris County",
            "members": [
                {"age": 35, "employment_income": 60000},
                {"age": 10},
            ],
        }
        household = Household.from_dict(data)

        assert household.state == "TX"
        assert household.county == "Harris County"
        assert len(household.members) == 2
        assert household.members[0].employment_income == 60000

    def test_household_to_situation(self):
        """Household.to_situation() produces valid PolicyEngine format."""
        household = Household(
            state="CA",
            county="Los Angeles County",
            members=[Person(age=30, employment_income=50000)],
        )
        situation = household.to_situation()

        # Check structure
        assert "people" in situation
        assert "tax_units" in situation
        assert "families" in situation
        assert "spm_units" in situation
        assert "households" in situation

        # Check household details
        hh = situation["households"]["household"]
        assert hh["state_code"] == {2024: "CA"}
        assert hh["county"] == {2024: "Los Angeles County"}

    def test_household_copy(self):
        """Household.copy() creates a deep copy."""
        original = Household(
            state="CA",
            members=[Person(age=30, employment_income=50000)],
        )
        copied = original.copy()

        # Modify copy
        copied.state = "TX"
        copied.members[0].employment_income = 75000

        # Original unchanged
        assert original.state == "CA"
        assert original.members[0].employment_income == 50000

    def test_household_add_member(self):
        """Household.add_member() adds a member."""
        household = Household(
            state="CA",
            members=[Person(age=30)],
        )
        household.add_member(Person(age=5))

        assert len(household.members) == 2
        assert household.members[1].age == 5

    def test_household_adults_property(self):
        """Household.adults returns only adult members."""
        household = Household(
            state="CA",
            members=[
                Person(age=35),
                Person(age=33),
                Person(age=10),
                Person(age=5),
            ],
        )
        adults = household.adults
        assert len(adults) == 2
        assert all(a.age >= 18 for a in adults)

    def test_household_children_property(self):
        """Household.children returns only child members."""
        household = Household(
            state="CA",
            members=[
                Person(age=35),
                Person(age=33),
                Person(age=10),
                Person(age=5),
            ],
        )
        children = household.children
        assert len(children) == 2
        assert all(c.age < 18 for c in children)
