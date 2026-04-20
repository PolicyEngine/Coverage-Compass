"""Life event for changing jobs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from ..household import Household

from .base import LifeEvent


@dataclass
class JobChange(LifeEvent):
    """
    Life event representing a job change.

    This modifies the employment income for a household member,
    which affects taxes and income-based benefits.
    """

    member_index: int = 0
    new_employment_income: Optional[float] = None
    income_change: Optional[float] = None

    @property
    def name(self) -> str:
        return "Job Change"

    @property
    def description(self) -> str:
        if self.new_employment_income is not None:
            return f"Changing job to earn ${self.new_employment_income:,.0f}"
        elif self.income_change is not None:
            direction = "increase" if self.income_change > 0 else "decrease"
            return f"Job change with ${abs(self.income_change):,.0f} income {direction}"
        return "Changing jobs"

    def apply(self, household: Household) -> Household:
        """Apply the job change to the specified household member."""
        new_household = household.copy()
        member = new_household.members[self.member_index]

        if self.new_employment_income is not None:
            member.employment_income = self.new_employment_income
        elif self.income_change is not None:
            member.employment_income += self.income_change

        return new_household

    def validate(self, household: Household) -> list[str]:
        """Validate the job change is valid."""
        errors = []
        if self.member_index < 0 or self.member_index >= len(household.members):
            errors.append(f"Invalid member index: {self.member_index}")
            return errors

        member = household.members[self.member_index]
        if member.age < 16:
            errors.append("Member must be at least 16 to have employment income")

        if self.new_employment_income is None and self.income_change is None:
            errors.append(
                "Must specify either new_employment_income or income_change"
            )

        if self.new_employment_income is not None and self.new_employment_income < 0:
            errors.append("New employment income cannot be negative")

        if self.income_change is not None:
            new_income = member.employment_income + self.income_change
            if new_income < 0:
                errors.append("Resulting employment income cannot be negative")

        return errors
