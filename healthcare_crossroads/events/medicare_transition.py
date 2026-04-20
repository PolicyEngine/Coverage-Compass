"""Life event for turning 65 and Medicare transition."""

from __future__ import annotations

from dataclasses import dataclass

from ..household import Household

from .base import LifeEvent


@dataclass
class MedicareTransition(LifeEvent):
    """
    Life event representing turning 65 and transitioning to Medicare.

    This affects healthcare coverage eligibility—the person becomes
    eligible for Medicare and typically loses ACA marketplace subsidies.
    """

    member_index: int = 0

    @property
    def name(self) -> str:
        return "Medicare Transition"

    @property
    def description(self) -> str:
        return "Turning 65 and becoming eligible for Medicare"

    def apply(self, household: Household) -> Household:
        """Age the member to 65."""
        new_household = household.copy()
        member = new_household.members[self.member_index]
        member.age = 65
        return new_household

    def validate(self, household: Household) -> list[str]:
        """Validate the Medicare transition event."""
        errors = []
        if self.member_index < 0 or self.member_index >= len(household.members):
            errors.append(f"Invalid member index: {self.member_index}")
            return errors

        member = household.members[self.member_index]
        if member.age >= 65:
            errors.append("Member is already 65 or older")

        return errors
