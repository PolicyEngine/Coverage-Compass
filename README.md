# Healthcare Crossroads

Explore how common household changes affect health coverage, marketplace subsidies, and related healthcare support.

## Installation

```bash
pip install -e .
```

## Quick Start

```python
from healthcare_crossroads import Household, Person, compare
from healthcare_crossroads.events import LosingESI

# Define a household
household = Household(
    state="CA",
    members=[Person(age=30, employment_income=50000)],
)

# Simulate losing employer coverage
result = compare(household, LosingESI())

print(result.healthcare_after.to_dict())

# Get JSON-serializable output for APIs
api_response = result.to_dict()
```

## Focus

- Coverage transitions after losing employer-sponsored insurance
- Household changes like marriage, divorce, childbirth, and moving states
- Income changes that affect Medicaid, CHIP, and ACA marketplace support
- Conference-friendly frontend for showing before/after healthcare outcomes

## License

MIT
