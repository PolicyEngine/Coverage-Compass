"""Life event for having a new child."""

from __future__ import annotations

from dataclasses import dataclass

from ..household import Household, Person

from .base import LifeEvent


@dataclass
class NewChild(LifeEvent):
    """
    Life event representing having or adopting a new child.

    This adds a new child to the household, which may affect
    eligibility for child-related tax credits and benefits.
    """

    age: int = 0

    @property
    def name(self) -> str:
        return "New Child"

    @property
    def description(self) -> str:
        return "Adding a new child to the household"

    def apply(self, household: Household) -> Household:
        """Add a new child to the household."""
        new_household = household.copy()
        new_child = Person(age=self.age)
        new_household.add_member(new_child)
        return new_household

    def validate(self, household: Household) -> list[str]:
        """Validate the household can have a new child."""
        errors = []
        if not household.adults:
            errors.append("Household must have at least one adult to add a child")
        if self.age < 0:
            errors.append("Child age cannot be negative")
        if self.age >= 18:
            errors.append("New child must be under 18")
        return errors
