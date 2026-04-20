"""Base class for life events."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..household import Household


class LifeEvent(ABC):
    """
    Abstract base class for life events that transform a household.

    A life event represents a significant change in a household's
    circumstances that may affect their taxes and benefits.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of the life event."""
        ...

    @property
    @abstractmethod
    def description(self) -> str:
        """Description of what this life event represents."""
        ...

    @abstractmethod
    def apply(self, household: Household) -> Household:
        """
        Apply this life event to a household.

        This method should create a new Household representing the
        state after the life event occurs. The original household
        should not be modified.

        Args:
            household: The baseline household before the event.

        Returns:
            A new Household representing the state after the event.
        """
        ...

    def validate(self, household: Household) -> list[str]:
        """
        Validate that this life event can be applied to the household.

        Args:
            household: The household to validate against.

        Returns:
            A list of validation error messages. Empty list if valid.
        """
        return []

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}()"
