"""State-level ACA bronze/silver premium ratios.

Derived from CMS 2024 Open Enrollment Period State Metal Status PUF via
policyengine-us-data PR #618. Ratio = avg bronze premium / avg silver premium
for HC.gov states. State-exchange states (CA, NY, CO, etc.) fall back to the
enrollment-weighted national average across all HC.gov states.
"""

# Ratio of average bronze plan premium to average silver plan premium, by state.
# Missing states use NATIONAL_BRONZE_SILVER_RATIO as fallback.
BRONZE_SILVER_RATIOS: dict[str, float] = {
    "AK": 0.6579,
    "AL": 0.7814,
    "AR": 0.9358,
    "AZ": 0.8872,
    "DE": 0.8442,
    "FL": 0.9344,
    "GA": 0.9073,
    "HI": 0.7672,
    "IA": 0.8279,
    "IL": 0.9835,
    "IN": 0.9372,
    "KS": 0.8899,
    "LA": 0.8625,
    "MI": 0.8777,
    "MO": 0.8868,
    "MS": 0.9790,
    "MT": 0.8308,
    "NC": 0.8556,
    "ND": 0.7928,
    "NE": 0.8577,
    "NH": 0.8417,
    "OH": 0.8984,
    "OK": 0.8270,
    "OR": 0.7622,
    "SC": 0.8385,
    "SD": 0.8202,
    "TN": 0.8920,
    "TX": 0.8145,
    "UT": 0.9229,
    "WI": 0.9174,
    "WV": 0.8603,
    "WY": 0.7598,
}

# Enrollment-weighted average across all HC.gov states (fallback for
# state-exchange states: CA, CO, CT, DC, ID, KY, MA, MD, ME, MN, NJ,
# NM, NV, NY, PA, RI, VA, VT, WA).
NATIONAL_BRONZE_SILVER_RATIO = 0.9034


def get_bronze_silver_ratio(state: str) -> float:
    """Return the bronze/silver premium ratio for a given state code."""
    return BRONZE_SILVER_RATIOS.get(state, NATIONAL_BRONZE_SILVER_RATIO)
