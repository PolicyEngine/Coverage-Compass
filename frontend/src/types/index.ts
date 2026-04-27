/** Returns the two-letter state code for a 5-digit zip, or null if unrecognised. */
export function getStateFromZip(zip: string): string | null {
  if (zip.length < 3) return null;
  const p = parseInt(zip.slice(0, 3), 10);
  if (p >= 10  && p <= 27)  return 'MA';
  if (p >= 28  && p <= 29)  return 'RI';
  if (p >= 30  && p <= 38)  return 'NH';
  if (p >= 39  && p <= 49)  return 'ME';
  if (p >= 50  && p <= 59)  return 'VT';
  if (p >= 60  && p <= 69)  return 'CT';
  if (p >= 70  && p <= 89)  return 'NJ';
  if (p >= 100 && p <= 149) return 'NY';
  if (p >= 150 && p <= 196) return 'PA';
  if (p >= 197 && p <= 199) return 'DE';
  if (p >= 200 && p <= 205) return 'DC';
  if (p >= 206 && p <= 219) return 'MD';
  if (p >= 220 && p <= 246) return 'VA';
  if (p >= 247 && p <= 268) return 'WV';
  if (p >= 270 && p <= 289) return 'NC';
  if (p >= 290 && p <= 299) return 'SC';
  if (p >= 300 && p <= 319) return 'GA';
  if (p === 398 || p === 399) return 'GA';
  if (p >= 320 && p <= 349) return 'FL';
  if (p >= 350 && p <= 369) return 'AL';
  if (p >= 370 && p <= 385) return 'TN';
  if (p >= 386 && p <= 397) return 'MS';
  if (p >= 400 && p <= 427) return 'KY';
  if (p >= 430 && p <= 459) return 'OH';
  if (p >= 460 && p <= 479) return 'IN';
  if (p >= 480 && p <= 499) return 'MI';
  if (p >= 500 && p <= 528) return 'IA';
  if (p >= 530 && p <= 549) return 'WI';
  if (p >= 550 && p <= 567) return 'MN';
  if (p >= 570 && p <= 577) return 'SD';
  if (p >= 580 && p <= 588) return 'ND';
  if (p >= 590 && p <= 599) return 'MT';
  if (p >= 600 && p <= 629) return 'IL';
  if (p >= 630 && p <= 658) return 'MO';
  if (p >= 660 && p <= 679) return 'KS';
  if (p >= 680 && p <= 693) return 'NE';
  if (p >= 700 && p <= 714) return 'LA';
  if (p >= 716 && p <= 729) return 'AR';
  if (p >= 730 && p <= 749) return 'OK';
  if (p >= 750 && p <= 799) return 'TX';
  if (p === 885)             return 'TX';
  if (p >= 800 && p <= 816) return 'CO';
  if (p >= 820 && p <= 831) return 'WY';
  if (p >= 832 && p <= 838) return 'ID';
  if (p >= 840 && p <= 847) return 'UT';
  if (p >= 850 && p <= 865) return 'AZ';
  if (p >= 870 && p <= 884) return 'NM';
  if (p >= 889 && p <= 898) return 'NV';
  if (p >= 900 && p <= 961) return 'CA';
  if (p >= 967 && p <= 968) return 'HI';
  if (p >= 970 && p <= 979) return 'OR';
  if (p >= 980 && p <= 994) return 'WA';
  if (p >= 995 && p <= 999) return 'AK';
  return null;
}

export interface Household {
  state: string;
  zipCode?: string;
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

export type EventIconName =
  | 'baby'
  | 'marriage'
  | 'divorce'
  | 'move'
  | 'income'
  | 'esi_loss';

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
  icon: EventIconName;
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
  acaPremiums?: {
    before: { silverGross: number; silverNet: number; bronzeGross: number; bronzeNet: number; ptc: number; bronzeIsEstimate?: boolean };
    after:  { silverGross: number; silverNet: number; bronzeGross: number; bronzeNet: number; ptc: number; bronzeIsEstimate?: boolean };
  };
  event?: {
    name: string;
    description: string;
  };
}

export const LIFE_EVENTS: LifeEvent[] = [
  {
    type: 'having_baby',
    label: 'Being Pregnant',
    description: 'See how pregnancy affects your Medicaid eligibility and coverage right now',
    icon: 'baby',
  },
  {
    type: 'getting_married',
    label: 'Getting Married',
    description: 'Combine households and compare the new coverage picture',
    icon: 'marriage',
  },
  {
    type: 'divorce',
    label: 'Divorce or Separation',
    description: 'Model how separating households changes coverage options',
    icon: 'divorce',
  },
  {
    type: 'moving_states',
    label: 'Moving States',
    description: 'Compare healthcare support before and after relocating',
    icon: 'move',
  },
  {
    type: 'changing_income',
    label: 'Changing Income',
    description: 'Test how income changes affect Medicaid and ACA subsidy eligibility',
    icon: 'income',
  },
  {
    type: 'losing_esi',
    label: 'Losing Job-Based Coverage',
    description: 'See what happens when employer-sponsored insurance goes away',
    icon: 'esi_loss',
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
