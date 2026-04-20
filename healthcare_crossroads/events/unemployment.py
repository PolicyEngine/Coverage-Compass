"""Life event for job loss / unemployment."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from ..household import Household

from .base import LifeEvent


@dataclass
class Unemployment(LifeEvent):
    """
    Life event representing job loss and unemployment.

    This is distinct from JobChange because unemployment triggers
    different benefit eligibility (unemployment insurance, potentially
    Medicaid, SNAP) and involves unemployment compensation income
    rather than employment income.
    """

    member_index: int = 0
    unemployment_compensation: float = 0.0
    severance_pay: Optional[float] = None

    @property
    def name(self) -> str:
        return "Unemployment"

    @property
    def description(self) -> str:
        return "Losing job and becoming unemployed"

    def apply(self, household: Household) -> Household:
        """Apply job loss to the specified household member."""
        new_household = household.copy()
        member = new_household.members[self.member_index]

        # Zero out employment income
        member.employment_income = 0.0

        # Add unemployment compensation
        member.unemployment_compensation = self.unemployment_compensation

        return new_household

    def validate(self, household: Household) -> list[str]:
        """Validate the unemployment event."""
        errors = []
        if self.member_index < 0 or self.member_index >= len(household.members):
            errors.append(f"Invalid member index: {self.member_index}")
            return errors

        member = household.members[self.member_index]
        if member.employment_income == 0:
            errors.append("Member has no employment income to lose")

        if self.unemployment_compensation < 0:
            errors.append("Unemployment compensation cannot be negative")

        return errors
