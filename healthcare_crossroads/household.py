"""Household model that wraps PolicyEngine US situations."""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Person:
    """A person in a household."""

    age: int
    employment_income: float = 0.0
    self_employment_income: float = 0.0
    social_security_retirement: float = 0.0
    unemployment_compensation: float = 0.0
    is_pregnant: bool = False
    is_tax_unit_head: bool = False
    is_tax_unit_spouse: bool = False
    has_esi: bool = False  # Has employer-sponsored health insurance

    def to_situation_dict(self, year: int) -> dict[str, Any]:
        """Convert to PolicyEngine situation format."""
        result = {
            "age": {year: self.age},
            "employment_income": {year: self.employment_income},
            "self_employment_income": {year: self.self_employment_income},
            "social_security_retirement": {year: self.social_security_retirement},
            "unemployment_compensation": {year: self.unemployment_compensation},
        }
        if self.is_pregnant:
            result["is_pregnant"] = {year: True}
        # Note: has_esi is tracked on the Person object for healthcare coverage
        # display, but not passed to PolicyEngine (no such variable exists)
        return result


@dataclass
class Household:
    """
    A household that can be simulated through PolicyEngine US.

    This class provides a convenient interface for building household
    situations and converting them to PolicyEngine's situation format.
    """

    state: str
    members: list[Person] = field(default_factory=list)
    year: int = 2024
    county: str | None = None  # County name for ACA SLCSP lookups
    zip_code: str | None = None  # ZIP code for more precise geographic targeting

    def __post_init__(self):
        """Validate and set up the household."""
        if not self.members:
            raise ValueError("Household must have at least one member")
        self._assign_tax_unit_roles()

    def _assign_tax_unit_roles(self) -> None:
        """Assign head and spouse roles if not already set."""
        adults = [m for m in self.members if m.age >= 18]
        if adults and not any(m.is_tax_unit_head for m in self.members):
            adults[0].is_tax_unit_head = True
            if len(adults) > 1 and not any(m.is_tax_unit_spouse for m in self.members):
                adults[1].is_tax_unit_spouse = True

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Household:
        """
        Create a Household from a dictionary.

        Args:
            data: Dictionary with keys:
                - state: Two-letter state code
                - members: List of person dictionaries
                - year: Optional tax year (default 2024)

        Returns:
            A new Household instance
        """
        members = [
            Person(**m) if isinstance(m, dict) else m for m in data.get("members", [])
        ]
        return cls(
            state=data["state"],
            members=members,
            year=data.get("year", 2024),
            county=data.get("county"),
            zip_code=data.get("zip_code"),
        )

    def to_situation(self) -> dict[str, Any]:
        """
        Convert to PolicyEngine US situation format.

        Returns:
            A dictionary in PolicyEngine situation format ready for simulation.
        """
        people = {}
        tax_unit_members = []
        family_members = []
        spm_unit_members = []
        household_members = []

        for i, member in enumerate(self.members):
            person_id = f"person_{i}"
            people[person_id] = member.to_situation_dict(self.year)
            tax_unit_members.append(person_id)
            family_members.append(person_id)
            spm_unit_members.append(person_id)
            household_members.append(person_id)

        # Build the head and spouse lists for tax unit
        head = None
        spouse = None
        dependents = []
        for i, member in enumerate(self.members):
            person_id = f"person_{i}"
            if member.is_tax_unit_head:
                head = person_id
            elif member.is_tax_unit_spouse:
                spouse = person_id
            else:
                dependents.append(person_id)

        tax_unit = {"members": tax_unit_members}
        # Mark head/spouse roles on the people, not on tax_unit
        if head:
            people[head]["is_tax_unit_head"] = {self.year: True}
        if spouse:
            people[spouse]["is_tax_unit_spouse"] = {self.year: True}
        for dep in dependents:
            people[dep]["is_tax_unit_dependent"] = {self.year: True}

        household_dict = {
            "members": household_members,
            "state_code": {self.year: self.state},
        }
        if self.county:
            household_dict["county"] = {self.year: self.county}
        if self.zip_code:
            household_dict["zip_code"] = {self.year: self.zip_code}

        return {
            "people": people,
            "tax_units": {"tax_unit": tax_unit},
            "families": {"family": {"members": family_members}},
            "spm_units": {"spm_unit": {"members": spm_unit_members}},
            "households": {"household": household_dict},
        }

    def copy(self) -> Household:
        """Create a deep copy of this household."""
        return Household(
            state=self.state,
            members=[copy.deepcopy(m) for m in self.members],
            year=self.year,
            county=self.county,
            zip_code=self.zip_code,
        )

    def add_member(self, person: Person) -> None:
        """Add a member to the household."""
        self.members.append(person)
        self._assign_tax_unit_roles()

    @property
    def adults(self) -> list[Person]:
        """Return all adult members (age >= 18)."""
        return [m for m in self.members if m.age >= 18]

    @property
    def children(self) -> list[Person]:
        """Return all child members (age < 18)."""
        return [m for m in self.members if m.age < 18]
