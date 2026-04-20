"""Life event for retirement."""

from __future__ import annotations

from dataclasses import dataclass

from ..household import Household

from .base import LifeEvent


@dataclass
class Retirement(LifeEvent):
    """
    Life event representing retirement.

    This converts employment income to Social Security retirement
    benefits for a household member.
    """

    member_index: int = 0
    social_security_amount: float = 0.0
    keep_partial_employment: bool = False
    partial_employment_income: float = 0.0

    @property
    def name(self) -> str:
        return "Retirement"

    @property
    def description(self) -> str:
        return f"Retiring with ${self.social_security_amount:,.0f} annual Social Security"

    def apply(self, household: Household) -> Household:
        """Apply retirement to the specified household member."""
        new_household = household.copy()
        member = new_household.members[self.member_index]

        if self.keep_partial_employment:
            member.employment_income = self.partial_employment_income
        else:
            member.employment_income = 0.0

        member.social_security_retirement = self.social_security_amount

        return new_household

    def validate(self, household: Household) -> list[str]:
        """Validate the retirement is valid."""
        errors = []
        if self.member_index < 0 or self.member_index >= len(household.members):
            errors.append(f"Invalid member index: {self.member_index}")
            return errors

        member = household.members[self.member_index]
        if member.age < 62:
            errors.append("Member must be at least 62 to claim Social Security retirement")

        if self.social_security_amount < 0:
            errors.append("Social Security amount cannot be negative")

        if self.keep_partial_employment and self.partial_employment_income < 0:
            errors.append("Partial employment income cannot be negative")

        return errors
