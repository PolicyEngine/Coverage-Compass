export interface Household {
  state: string;
  filingStatus: 'single' | 'married_jointly' | 'married_separately' | 'head_of_household';
  income: number;
  spouseIncome: number;
  spouseAge: number;
  childAges: number[]; // Array of child ages
  age: number;
  hasESI: boolean;
  spouseHasESI: boolean;
  year: number;
}

export type LifeEventType =
  | 'having_baby'
  | 'moving_states'
  | 'getting_married'
  | 'changing_income'
  | 'divorce'
  | 'losing_esi';

export interface LifeEvent {
  type: LifeEventType;
  label: string;
  description: string;
  icon: string;
  params?: Record<string, unknown>;
}

export interface BenefitMetric {
  name: string;
  label: string;
  before: number;
  after: number;
  category: 'income' | 'tax' | 'benefit' | 'credit' | 'state_credit' | 'state_benefit';
  priority: 1 | 2; // 1 = primary (always shown), 2 = secondary (in "More" tab)
}

export interface PersonHealthcare {
  index: number;
  label: string; // "You", "Spouse", "Child 1", etc.
  coverage: 'ESI' | 'Medicaid' | 'CHIP' | 'Marketplace' | null;
}

export interface HealthcareCoverage {
  people: PersonHealthcare[];
  summary: Record<string, string[]>; // e.g., { "Medicaid": ["You", "Child 1"], "CHIP": ["Child 2"] }
  has_ptc: boolean;
}

export interface SimulationResult {
  before: {
    netIncome: number;
    totalTax: number;
    totalBenefits: number;
    metrics: BenefitMetric[];
  };
  after: {
    netIncome: number;
    totalTax: number;
    totalBenefits: number;
    metrics: BenefitMetric[];
  };
  diff: {
    netIncome: number;
    totalTax: number;
    totalBenefits: number;
  };
  healthcareBefore?: HealthcareCoverage;
  healthcareAfter?: HealthcareCoverage;
}

export const LIFE_EVENTS: LifeEvent[] = [
  {
    type: 'having_baby',
    label: 'Having a Baby',
    description: 'See how a new child changes Medicaid, CHIP, and marketplace support',
    icon: '👶',
  },
  {
    type: 'getting_married',
    label: 'Getting Married',
    description: 'Combine households and compare the new coverage picture',
    icon: '💍',
  },
  {
    type: 'divorce',
    label: 'Divorce or Separation',
    description: 'Model how separating households changes coverage options',
    icon: '💔',
  },
  {
    type: 'moving_states',
    label: 'Moving States',
    description: 'Compare healthcare support before and after relocating',
    icon: '🏠',
  },
  {
    type: 'changing_income',
    label: 'Changing Income',
    description: 'Test how income changes affect Medicaid and ACA subsidy eligibility',
    icon: '💰',
  },
  {
    type: 'losing_esi',
    label: 'Losing Job-Based Coverage',
    description: 'See what happens when employer-sponsored insurance goes away',
    icon: '🏥',
  },
];

export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];
