"""Life event for moving to a new state."""

from __future__ import annotations

from dataclasses import dataclass

from ..household import Household

from .base import LifeEvent

# Valid US state codes
VALID_STATE_CODES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC",
}


@dataclass
class Move(LifeEvent):
    """
    Life event representing moving to a new state.

    This changes the household's state, which affects state-specific
    taxes and benefits.
    """

    new_state: str

    @property
    def name(self) -> str:
        return "Move"

    @property
    def description(self) -> str:
        return f"Moving to {self.new_state}"

    def apply(self, household: Household) -> Household:
        """Move the household to a new state."""
        new_household = household.copy()
        new_household.state = self.new_state
        return new_household

    def validate(self, household: Household) -> list[str]:
        """Validate the move is valid."""
        errors = []
        if self.new_state not in VALID_STATE_CODES:
            errors.append(f"Invalid state code: {self.new_state}")
        if self.new_state == household.state:
            errors.append("New state is the same as current state")
        return errors
