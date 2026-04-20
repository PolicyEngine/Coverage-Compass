"""Life event for a child aging out of various programs."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from ..household import Household

from .base import LifeEvent


class AgingOutType(Enum):
    """Types of aging-out thresholds."""

    DEPENDENT_18 = 18  # General dependent status
    DEPENDENT_19 = 19  # Some tax credits (e.g., CTC)
    HEALTH_INSURANCE_26 = 26  # ACA dependent coverage


@dataclass
class ChildAgingOut(LifeEvent):
    """
    Life event representing a child aging out of program eligibility.

    Different programs have different age thresholds:
    - 18: General dependent status for many programs
    - 19: Child Tax Credit, some state programs
    - 26: ACA dependent health insurance coverage

    This event ages a child to the threshold age to show the impact
    of losing that eligibility.
    """

    member_index: int
    aging_out_type: AgingOutType = AgingOutType.DEPENDENT_18

    @property
    def name(self) -> str:
        return "Child Aging Out"

    @property
    def description(self) -> str:
        age = self.aging_out_type.value
        if self.aging_out_type == AgingOutType.HEALTH_INSURANCE_26:
            return f"Child turning {age} (loses dependent health coverage)"
        elif self.aging_out_type == AgingOutType.DEPENDENT_19:
            return f"Child turning {age} (loses child tax credit eligibility)"
        else:
            return f"Child turning {age} (loses dependent status)"

    def apply(self, household: Household) -> Household:
        """Age the child to the threshold age."""
        new_household = household.copy()
        member = new_household.members[self.member_index]
        member.age = self.aging_out_type.value
        return new_household

    def validate(self, household: Household) -> list[str]:
        """Validate the child aging out event."""
        errors = []
        if self.member_index < 0 or self.member_index >= len(household.members):
            errors.append(f"Invalid member index: {self.member_index}")
            return errors

        member = household.members[self.member_index]
        threshold = self.aging_out_type.value

        if member.age >= threshold:
            errors.append(f"Member is already {threshold} or older")

        if member.is_tax_unit_head or member.is_tax_unit_spouse:
            errors.append("Cannot apply child aging out to head or spouse")

        return errors
