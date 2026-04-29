"""Life event for ending pregnancy."""

from __future__ import annotations

from dataclasses import dataclass

from ..household import Household

from .base import LifeEvent


@dataclass
class EndingPregnancy(LifeEvent):
    """Life event for clearing pregnancy from a household member.

    Counterpart to Pregnancy. Lets a user who set pregnancy as a household
    status see how dropping it affects coverage (e.g., losing the expanded
    Medicaid / FAMIS Moms eligibility threshold).
    """

    member_index: int = 0

    @property
    def name(self) -> str:
        return "Ending pregnancy"

    @property
    def description(self) -> str:
        return "No longer pregnant (Medicaid pregnancy coverage no longer applies)"

    def apply(self, household: Household) -> Household:
        new_household = household.copy()
        new_household.members[self.member_index].is_pregnant = False
        return new_household

    def validate(self, household: Household) -> list[str]:
        errors = []
        if self.member_index < 0 or self.member_index >= len(household.members):
            errors.append(f"Invalid member index: {self.member_index}")
            return errors
        if not household.members[self.member_index].is_pregnant:
            errors.append("Member is not currently pregnant")
        return errors
