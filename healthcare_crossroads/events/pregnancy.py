"""Life event for pregnancy."""

from __future__ import annotations

from dataclasses import dataclass

from ..household import Household

from .base import LifeEvent


@dataclass
class Pregnancy(LifeEvent):
    """
    Life event representing pregnancy.

    This is distinct from NewChild because Medicaid pregnancy coverage
    eligibility kicks in during pregnancy, before birth. Many states
    have higher income limits for pregnant women.
    """

    member_index: int = 0

    @property
    def name(self) -> str:
        return "Pregnancy"

    @property
    def description(self) -> str:
        return "Becoming pregnant (triggers Medicaid pregnancy coverage eligibility)"

    def apply(self, household: Household) -> Household:
        """Mark a household member as pregnant."""
        new_household = household.copy()
        new_household.members[self.member_index].is_pregnant = True
        return new_household

    def validate(self, household: Household) -> list[str]:
        """Validate the pregnancy event."""
        errors = []
        if self.member_index < 0 or self.member_index >= len(household.members):
            errors.append(f"Invalid member index: {self.member_index}")
            return errors

        member = household.members[self.member_index]
        if member.is_pregnant:
            errors.append("Member is already pregnant")
        return errors
