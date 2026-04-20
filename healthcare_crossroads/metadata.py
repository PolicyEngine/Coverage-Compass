"""Shared metadata for variable labels, categories, and priorities."""

# Variable metadata: label, category, priority (1=primary, 2=secondary)
VARIABLE_METADATA = {
    # Income
    "household_net_income": ("Net Income", "income", 1),
    "employment_income": ("Employment Income", "income", 1),
    "self_employment_income": ("Self-Employment Income", "income", 2),
    # Taxes
    "income_tax": ("Federal Income Tax", "tax", 1),
    "state_income_tax": ("State Income Tax", "tax", 1),
    "employee_payroll_tax": ("Payroll Tax", "tax", 1),
    "self_employment_tax": ("Self-Employment Tax", "tax", 2),
    # Food assistance
    "snap": ("SNAP (Food Stamps)", "benefit", 1),
    "free_school_meals": ("Free School Meals", "benefit", 2),
    "reduced_price_school_meals": ("Reduced Price Meals", "benefit", 2),
    "school_meal_subsidy": ("School Meal Subsidy", "benefit", 2),
    "wic": ("WIC", "benefit", 1),
    # Cash assistance
    "tanf": ("TANF", "benefit", 1),
    "ssi": ("SSI", "benefit", 1),
    "social_security": ("Social Security", "benefit", 1),
    # Housing
    "spm_unit_capped_housing_subsidy": ("Housing Subsidy", "benefit", 1),
    # Healthcare
    "medicaid": ("Medicaid", "benefit", 1),
    "chip": ("CHIP", "benefit", 1),
    # Energy/utilities
    "liheap": ("LIHEAP (Energy)", "benefit", 2),
    "lifeline": ("Lifeline (Phone)", "benefit", 2),
    "acp": ("ACP (Broadband)", "benefit", 2),
    # Childcare
    "ccdf": ("Childcare Subsidy (CCDF)", "benefit", 2),
    # Tax credits - primary
    "earned_income_tax_credit": ("Earned Income Tax Credit", "credit", 1),
    "ctc": ("Child Tax Credit", "credit", 1),
    # CTC components - hide by default to avoid double-counting with total
    "non_refundable_ctc": ("CTC (non-refundable portion)", "credit", 2),
    "refundable_ctc": ("CTC (refundable portion)", "credit", 2),
    "cdcc": ("Child & Dependent Care Credit", "credit", 1),
    "premium_tax_credit": ("Premium Tax Credit (ACA)", "credit", 1),
    # Tax credits - secondary
    "savers_credit": ("Saver's Credit", "credit", 2),
    "american_opportunity_credit": ("American Opportunity Credit", "credit", 2),
    "lifetime_learning_credit": ("Lifetime Learning Credit", "credit", 2),
    # State benefits & credits
    "state_eitc": ("State EITC", "state_credit", 1),
    "state_ctc": ("State CTC", "state_credit", 1),
    # California
    "ca_eitc": ("CalEITC", "state_credit", 1),
    "ca_yctc": ("CA Young Child Tax Credit", "state_credit", 1),
    "ca_renter_credit": ("CA Renter Credit", "state_credit", 2),
    "ca_tanf": ("CalWORKs (CA TANF)", "state_benefit", 1),
    "ca_state_supplement": ("CA SSI Supplement", "state_benefit", 1),
    # New York
    "ny_eitc": ("NY EITC", "state_credit", 1),
    "ny_ctc": ("NY Child Tax Credit", "state_credit", 1),
    "ny_tanf": ("NY TANF", "state_benefit", 1),
    # Colorado
    "co_eitc": ("CO EITC", "state_credit", 1),
    "co_ctc": ("CO Child Tax Credit", "state_credit", 1),
    "co_tanf": ("CO TANF", "state_benefit", 1),
    "co_state_supplement": ("CO SSI Supplement", "state_benefit", 1),
    "co_ccap_subsidy": ("CO Childcare Assistance", "state_benefit", 1),
    "co_family_affordability_credit": ("CO Family Affordability Credit", "state_credit", 1),
    # Maryland
    "md_eitc": ("MD EITC", "state_credit", 1),
    "md_ctc": ("MD Child Tax Credit", "state_credit", 1),
    # New Jersey
    "nj_eitc": ("NJ EITC", "state_credit", 1),
    "nj_ctc": ("NJ Child Tax Credit", "state_credit", 1),
    # Illinois
    "il_eitc": ("IL EITC", "state_credit", 1),
    "il_ctc": ("IL Child Tax Credit", "state_credit", 1),
    # DC
    "dc_eitc": ("DC EITC", "state_credit", 1),
    "dc_ctc": ("DC Child Tax Credit", "state_credit", 1),
    "dc_tanf": ("DC TANF", "state_benefit", 1),
    "dc_snap_temporary_local_benefit": ("DC SNAP Supplement", "state_benefit", 1),
    # Oregon
    "or_eitc": ("OR EITC", "state_credit", 1),
    "or_ctc": ("OR Child Tax Credit", "state_credit", 1),
    # New Mexico
    "nm_eitc": ("NM EITC", "state_credit", 1),
    "nm_ctc": ("NM Child Tax Credit", "state_credit", 1),
    # Massachusetts
    "ma_eitc": ("MA EITC", "state_credit", 1),
    "ma_child_and_family_credit": ("MA Child & Family Credit", "state_credit", 1),
    # Washington
    "wa_working_families_tax_credit": ("WA Working Families Credit", "state_credit", 1),
    # Connecticut
    "ct_child_tax_rebate": ("CT Child Tax Rebate", "state_credit", 1),
    "ct_property_tax_credit": ("CT Property Tax Credit", "state_credit", 2),
    # Minnesota
    "mn_child_and_working_families_credits": ("MN Working Family Credit", "state_credit", 1),
    # Other states
    "vt_eitc": ("VT EITC", "state_credit", 1),
    "vt_ctc": ("VT Child Tax Credit", "state_credit", 1),
    "me_eitc": ("ME EITC", "state_credit", 1),
    "ri_eitc": ("RI EITC", "state_credit", 1),
    "oh_eitc": ("OH EITC", "state_credit", 1),
    "ne_eitc": ("NE EITC", "state_credit", 1),
    "sc_eitc": ("SC EITC", "state_credit", 1),
    "ok_eitc": ("OK EITC", "state_credit", 1),
    "hi_eitc": ("HI EITC", "state_credit", 1),
    "ut_eitc": ("UT EITC", "state_credit", 1),
    "ut_ctc": ("UT Child Tax Credit", "state_credit", 1),
}


def get_label(var_name: str) -> str:
    """Get human-readable label for a variable."""
    return VARIABLE_METADATA.get(var_name, (var_name, "benefit", 2))[0]


def get_category(var_name: str) -> str:
    """Get category for a variable (tax, benefit, credit, etc)."""
    return VARIABLE_METADATA.get(var_name, (var_name, "benefit", 2))[1]


def get_priority(var_name: str) -> int:
    """Get display priority for a variable (1=primary, 2=secondary)."""
    return VARIABLE_METADATA.get(var_name, (var_name, "benefit", 2))[2]
