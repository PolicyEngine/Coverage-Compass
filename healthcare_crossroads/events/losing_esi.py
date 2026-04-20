"""Life event for losing employer-sponsored health insurance."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from ..household import Household

from .base import LifeEvent


class ESILossType(str, Enum):
    """Who is losing ESI coverage."""

    HEAD = "head"
    SPOUSE = "spouse"
    BOTH = "both"


@dataclass
class LosingESI(LifeEvent):
    """
    Life event representing loss of employer-sponsored health insurance.

    This event models scenarios where a household member loses their
    employer health coverage, which may affect eligibility for ACA
    premium tax credits, Medicaid, and other healthcare-related benefits.
    """

    who: ESILossType = ESILossType.HEAD

    @property
    def name(self) -> str:
        return "Losing Health Insurance"

    @property
    def description(self) -> str:
        if self.who == ESILossType.HEAD:
            return "Losing employer-sponsored health insurance"
        elif self.who == ESILossType.SPOUSE:
            return "Spouse losing employer-sponsored health insurance"
        return "Both losing employer-sponsored health insurance"

    def apply(self, household: Household) -> Household:
        """
        Apply loss of ESI to the household.

        Note: ESI status is tracked externally. This event returns
        the same household but signals to the API layer that ESI
        status should change in the simulation.
        """
        # The actual ESI flag handling happens in the API layer
        # when constructing the PolicyEngine situation
        return household.copy()

    def validate(self, household: Household) -> list[str]:
        """Validate that the event can be applied."""
        errors = []
        if self.who == ESILossType.SPOUSE:
            # Check if there's a spouse
            spouses = [m for m in household.members if m.is_tax_unit_spouse]
            if not spouses:
                errors.append("Cannot lose spouse ESI without a spouse in the household")
        return errors
