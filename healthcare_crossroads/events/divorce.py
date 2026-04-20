"""Life event for divorce."""

from __future__ import annotations

from dataclasses import dataclass

from ..household import Household

from .base import LifeEvent


@dataclass
class Divorce(LifeEvent):
    """
    Life event representing divorce.

    This removes the spouse from the household, changing filing status
    and potentially affecting benefit eligibility. Children can optionally
    remain with the primary filer or leave with the spouse.
    """

    children_leave_with_spouse: list[int] | None = None

    @property
    def name(self) -> str:
        return "Divorce"

    @property
    def description(self) -> str:
        return "Getting divorced and separating households"

    def apply(self, household: Household) -> Household:
        """Remove the spouse (and optionally some children) from the household."""
        new_household = household.copy()

        # Find and remove spouse
        spouse_idx = None
        for i, member in enumerate(new_household.members):
            if member.is_tax_unit_spouse:
                spouse_idx = i
                break

        # Collect indices to remove (spouse + any children leaving)
        indices_to_remove = set()
        if spouse_idx is not None:
            indices_to_remove.add(spouse_idx)

        if self.children_leave_with_spouse:
            indices_to_remove.update(self.children_leave_with_spouse)

        # Remove in reverse order to maintain correct indices
        for idx in sorted(indices_to_remove, reverse=True):
            new_household.members.pop(idx)

        return new_household

    def validate(self, household: Household) -> list[str]:
        """Validate the divorce event."""
        errors = []

        has_spouse = any(m.is_tax_unit_spouse for m in household.members)
        if not has_spouse:
            errors.append("Household has no spouse to divorce")

        if self.children_leave_with_spouse:
            for idx in self.children_leave_with_spouse:
                if idx < 0 or idx >= len(household.members):
                    errors.append(f"Invalid child index: {idx}")
                elif household.members[idx].is_tax_unit_head:
                    errors.append("Cannot remove the tax unit head")
                elif household.members[idx].is_tax_unit_spouse:
                    errors.append(
                        "Spouse is already being removed; "
                        "don't include in children_leave_with_spouse"
                    )

        return errors
