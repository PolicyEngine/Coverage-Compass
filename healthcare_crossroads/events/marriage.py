"""Life event for getting married."""

from __future__ import annotations

from dataclasses import dataclass, field

from ..household import Household, Person

from .base import LifeEvent


@dataclass
class Marriage(LifeEvent):
    """
    Life event representing getting married.

    This adds a spouse to the household, which affects filing status
    and may affect benefit eligibility.
    """

    spouse_age: int = 30
    spouse_employment_income: float = 0.0
    spouse_self_employment_income: float = 0.0
    spouse_children: list[Person] = field(default_factory=list)
    spouse_has_esi: bool = False  # Spouse has employer-sponsored insurance

    @property
    def name(self) -> str:
        return "Marriage"

    @property
    def description(self) -> str:
        return "Getting married and combining households"

    def apply(self, household: Household) -> Household:
        """Add a spouse (and optionally their children) to the household."""
        new_household = household.copy()

        # Spouse joins head's ESI plan if head has one
        head_has_esi = any(m.has_esi and m.is_tax_unit_head for m in household.members)
        spouse_has_esi = self.spouse_has_esi or head_has_esi

        spouse = Person(
            age=self.spouse_age,
            employment_income=self.spouse_employment_income,
            self_employment_income=self.spouse_self_employment_income,
            is_tax_unit_spouse=True,
            has_esi=spouse_has_esi,
        )
        new_household.add_member(spouse)

        for child in self.spouse_children:
            new_household.add_member(child)

        return new_household

    def validate(self, household: Household) -> list[str]:
        """Validate the marriage is valid."""
        errors = []
        if any(m.is_tax_unit_spouse for m in household.members):
            errors.append("Household already has a spouse")
        if self.spouse_age < 18:
            errors.append("Spouse must be 18 or older")
        if self.spouse_employment_income < 0:
            errors.append("Spouse employment income cannot be negative")
        return errors
