'use client';

import { useState } from 'react';
import { BenefitMetric, LifeEventType, SimulationResult } from '@/types';

type Tier = 'bronze' | 'silver';

interface ResultsViewProps {
  result: SimulationResult;
  eventType?: LifeEventType;
  onTryAnother: () => void; // keep household, clear event so user can model another what-if
  onReset: () => void;       // full reset back to the wizard
}

// Per-month financial rows we surface in the statement table.
// CHIP and Medicaid program-cost dollar amounts are intentionally omitted:
// they're shown via per-person coverage pills above; the dollar value to
// the family (premium contribution) isn't directly modeled.
const FINANCIAL_METRIC_NAMES = new Set([
  'premium_tax_credit',
  'marketplace_net_premium',
]);

// Each metric's category tag, for the small label shown next to the row name.
const METRIC_CATEGORY: Record<string, string> = {
  full_premium: 'premium',
  premium_tax_credit: 'tax credit',
  marketplace_net_premium: 'net cost',
  chip_premium: 'enrollment fee',
  total_monthly_cost: 'sum of above',
};

// Each metric's diff-chip kind (drives the chip color + suffix word).
type ChipKind = 'credit' | 'cost' | 'benefit';
const METRIC_CHIP_KIND: Record<string, ChipKind> = {
  full_premium: 'cost',
  premium_tax_credit: 'credit',
  marketplace_net_premium: 'cost',
  chip_premium: 'cost',
  total_monthly_cost: 'cost',
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonthly(annual: number): string {
  return formatCurrency(annual / 12);
}

function getCoverageLabel(type: string | null): string {
  switch (type) {
    case 'ESI':
      return 'Employer-sponsored';
    case 'Marketplace':
      return 'Marketplace';
    case 'Medicaid':
      return 'Medicaid';
    case 'CHIP':
      return 'CHIP';
    default:
      return 'No coverage';
  }
}

// Color per coverage type so the eye separates "Marketplace" from "Medicaid"
// from "ESI" instead of relying on text alone. Each tone is distinct enough
// to scan quickly but still soft (no alarming saturation).
const COVERAGE_TONES: Record<string, string> = {
  ESI: 'bg-blue-50 text-blue-800 border-blue-200',
  Marketplace: 'bg-[#E6FFFA] text-[#285E61] border-[#319795]/40',
  Medicaid: 'bg-violet-50 text-violet-800 border-violet-200',
  CHIP: 'bg-pink-50 text-pink-800 border-pink-200',
};

function CoveragePill({ type, exists }: { type: string | null; exists: boolean }) {
  if (!exists) {
    return <span className="text-sm text-gray-300">Not applicable</span>;
  }
  const label = getCoverageLabel(type);
  const tone = type && COVERAGE_TONES[type]
    ? COVERAGE_TONES[type]
    : 'bg-gray-50 text-gray-500 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${tone}`}>
      {label}
    </span>
  );
}

function DiffChip({ kind, monthlyDelta }: { kind: ChipKind; monthlyDelta: number }) {
  if (Math.abs(monthlyDelta) < 0.5) return null;
  const sign = monthlyDelta > 0 ? '+' : '−';
  const amount = formatCurrency(Math.abs(monthlyDelta));
  const word = kind;
  const tone =
    kind === 'credit'
      ? 'bg-[#E6FFFA] text-[#285E61]'
      : kind === 'benefit'
      ? 'bg-[#E6FFFA] text-[#285E61]'
      : 'bg-amber-50 text-amber-800';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium tabular-nums ${tone}`}>
      {sign}{amount} {word}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={4} className="px-5 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {children}
      </td>
    </tr>
  );
}

// Render a signed monthly delta. Cost metrics (premium): negative delta = green.
// Credit/benefit metrics: positive delta = green. Zero = gray.
function ChangeCell({ kind, monthlyDelta }: { kind: ChipKind; monthlyDelta: number }) {
  if (Math.abs(monthlyDelta) < 0.5) {
    return <span className="text-sm text-gray-300">No change</span>;
  }
  const isCost = kind === 'cost';
  const favorable = isCost ? monthlyDelta < 0 : monthlyDelta > 0;
  const sign = monthlyDelta > 0 ? '+' : '−';
  const tone = favorable ? 'text-green-600' : 'text-red-600';
  return (
    <span className={`text-sm font-semibold tabular-nums ${tone}`}>
      {sign}{formatCurrency(Math.abs(monthlyDelta))}/mo
    </span>
  );
}

function PersonRow({
  label,
  beforeCoverage,
  afterCoverage,
  existsBefore,
  existsAfter,
}: {
  label: string;
  beforeCoverage: string | null;
  afterCoverage: string | null;
  existsBefore: boolean;
  existsAfter: boolean;
}) {
  const changed = beforeCoverage !== afterCoverage || existsBefore !== existsAfter;
  return (
    <tr className="border-t border-gray-100">
      <td className="px-5 py-3 text-sm font-medium text-gray-900 align-middle w-44">{label}</td>
      <td className="px-5 py-3 align-middle">
        <CoveragePill type={beforeCoverage} exists={existsBefore} />
      </td>
      <td className="px-5 py-3 align-middle">
        <CoveragePill type={afterCoverage} exists={existsAfter} />
      </td>
      <td className="px-5 py-3 align-middle text-sm">
        {changed ? (
          <span className="text-[#285E61] font-medium">Changed</span>
        ) : (
          <span className="text-gray-300">No change</span>
        )}
      </td>
    </tr>
  );
}

function TierToggle({ selected, onChange }: { selected: Tier; onChange: (t: Tier) => void }) {
  return (
    <div className="inline-flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 mt-1.5">
      {(['silver', 'bronze'] as Tier[]).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          className={`px-2 py-0.5 rounded-md text-[11px] font-medium capitalize transition-all ${
            selected === t
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function MetricRow({
  metric,
  showTierToggle = false,
  selectedTier,
  onTierChange,
}: {
  metric: BenefitMetric;
  showTierToggle?: boolean;
  selectedTier?: Tier;
  onTierChange?: (t: Tier) => void;
}) {
  const category = METRIC_CATEGORY[metric.name] ?? metric.category.replace('_', ' ');
  const chipKind = METRIC_CHIP_KIND[metric.name] ?? 'cost';
  const monthlyBefore = metric.before / 12;
  const monthlyAfter = metric.after / 12;
  const monthlyDelta = monthlyAfter - monthlyBefore;

  return (
    <tr className="border-t border-gray-100">
      <td className="px-5 py-3 align-middle">
        <div className="text-sm font-medium text-gray-900">{metric.label}</div>
        <div className="text-[11px] text-gray-400">{category}</div>
        {showTierToggle && selectedTier && onTierChange && (
          <TierToggle selected={selectedTier} onChange={onTierChange} />
        )}
      </td>
      <td className="px-5 py-3 align-middle text-sm tabular-nums text-gray-500">
        {`${formatCurrency(monthlyBefore)}/mo`}
      </td>
      <td className="px-5 py-3 align-middle text-sm tabular-nums text-gray-700">
        {`${formatCurrency(monthlyAfter)}/mo`}
      </td>
      <td className="px-5 py-3 align-middle">
        <ChangeCell kind={chipKind} monthlyDelta={monthlyDelta} />
      </td>
    </tr>
  );
}

function MobilePersonCard({
  label,
  beforeCoverage,
  afterCoverage,
  existsBefore,
  existsAfter,
}: {
  label: string;
  beforeCoverage: string | null;
  afterCoverage: string | null;
  existsBefore: boolean;
  existsAfter: boolean;
}) {
  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/40">
      <div className="text-sm font-medium text-gray-900 mb-2">{label}</div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Before</div>
          <CoveragePill type={beforeCoverage} exists={existsBefore} />
        </div>
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">After</div>
          <CoveragePill type={afterCoverage} exists={existsAfter} />
        </div>
      </div>
    </div>
  );
}

function MobileMetricCard({
  metric,
  showTierToggle = false,
  selectedTier,
  onTierChange,
}: {
  metric: BenefitMetric;
  showTierToggle?: boolean;
  selectedTier?: Tier;
  onTierChange?: (t: Tier) => void;
}) {
  const category = METRIC_CATEGORY[metric.name] ?? metric.category.replace('_', ' ');
  const chipKind = METRIC_CHIP_KIND[metric.name] ?? 'cost';
  const monthlyBefore = metric.before / 12;
  const monthlyAfter = metric.after / 12;
  const monthlyDelta = monthlyAfter - monthlyBefore;

  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-gray-50/40">
      <div className="flex items-baseline justify-between gap-2 mb-2 flex-wrap">
        <div>
          <div className="text-sm font-medium text-gray-900">{metric.label}</div>
          <div className="text-[11px] text-gray-400">{category}</div>
          {showTierToggle && selectedTier && onTierChange && (
            <TierToggle selected={selectedTier} onChange={onTierChange} />
          )}
        </div>
        <DiffChip kind={chipKind} monthlyDelta={monthlyDelta} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Before</div>
          <div className="text-sm tabular-nums text-gray-700">
            {`${formatCurrency(monthlyBefore)}/mo`}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">After</div>
          <div className="text-sm tabular-nums text-gray-700">
            {`${formatCurrency(monthlyAfter)}/mo`}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResultsView({ result, eventType, onTryAnother, onReset }: ResultsViewProps) {
  if (!result?.before || !result?.after) {
    return (
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
        <p className="text-gray-500 mb-4">The simulation returned incomplete data. Please try again.</p>
        <button onClick={onTryAnother} className="btn btn-primary">Try again</button>
      </div>
    );
  }

  const [selectedTier, setSelectedTier] = useState<Tier>('silver');

  const metrics = result.before.metrics || [];

  // ACA plan options.
  const acaBefore = result.acaPremiums?.before;
  const acaAfter = result.acaPremiums?.after;
  const acaScope = acaAfter && (acaAfter.silverGross ?? 0) > 0 ? acaAfter : acaBefore;
  const showAcaPlans = !!acaScope && (acaScope.silverGross ?? 0) > 0;

  // Tier-aware net premium (annual). Falls back to backend's marketplace_net_premium
  // when no ACA data is available (e.g. Medicaid-only households).
  const tierNetPremium = (side: 'before' | 'after'): number => {
    const aca = side === 'before' ? acaBefore : acaAfter;
    if (!aca) return 0;
    return selectedTier === 'bronze' ? aca.bronzeNet : aca.silverNet;
  };

  // Hero metric: monthly out-of-pocket the household pays. Sum of the
  // tier-aware ACA marketplace cost (after PTC) and any CHIP enrollment fee.
  const netPremiumMetric = metrics.find((m) => m.name === 'marketplace_net_premium');
  const tierNetBefore = showAcaPlans ? tierNetPremium('before') : (netPremiumMetric?.before ?? 0);
  const tierNetAfter = showAcaPlans ? tierNetPremium('after') : (netPremiumMetric?.after ?? 0);
  const chipPremiumBefore = metrics.find((m) => m.name === 'chip_premium')?.before ?? 0;
  const chipPremiumAfter = metrics.find((m) => m.name === 'chip_premium')?.after ?? 0;
  const totalBefore = tierNetBefore + chipPremiumBefore;
  const totalAfter = tierNetAfter + chipPremiumAfter;
  const netBefore = totalBefore / 12;
  const netAfter = totalAfter / 12;
  const monthlyDelta = netAfter - netBefore;
  const hasHero = Math.abs(netBefore) > 0.5 || Math.abs(netAfter) > 0.5;
  const isCost = monthlyDelta > 0.5;
  const isSavings = monthlyDelta < -0.5;
  const heroTone = isCost ? 'text-red-600' : isSavings ? 'text-green-600' : 'text-gray-900';
  const heroSign = isCost ? '+' : isSavings ? '−' : '';
  const heroAmount = formatCurrency(Math.abs(monthlyDelta));

  // Person rows.
  const isPregnancyScenario = eventType === 'having_baby';
  const beforeLabels = new Set((result.healthcareBefore?.people || []).map((p) => p.label));
  const afterLabels = new Set((result.healthcareAfter?.people || []).map((p) => p.label));
  const allLabels = isPregnancyScenario
    ? Array.from(beforeLabels)
    : Array.from(new Set([...beforeLabels, ...afterLabels]));

  // Detect ESI transitions. These make the hero net-change number incomplete
  // because we don't model employer premium contributions.
  const beforeESI = (result.healthcareBefore?.people || []).some((p) => p.coverage === 'ESI');
  const afterESI = (result.healthcareAfter?.people || []).some((p) => p.coverage === 'ESI');
  const esiInPlay = beforeESI || afterESI;

  // Tier-aware ACA premium values (annual).
  const tierGrossBefore = showAcaPlans
    ? (selectedTier === 'bronze' ? acaBefore?.bronzeGross ?? 0 : acaBefore?.silverGross ?? 0)
    : 0;
  const tierGrossAfter = showAcaPlans
    ? (selectedTier === 'bronze' ? acaAfter?.bronzeGross ?? 0 : acaAfter?.silverGross ?? 0)
    : 0;
  const ptcBeforeAnnual = metrics.find((m) => m.name === 'premium_tax_credit')?.before ?? 0;
  const ptcAfterAnnual = metrics.find((m) => m.name === 'premium_tax_credit')?.after ?? 0;

  // Build the financial rows. When ACA is in play, expand into three rows
  // (Full premium / Tax credit / Your cost) so the user sees how the net is
  // computed. Otherwise just show the existing PTC row if non-zero.
  const financialMetrics: BenefitMetric[] = [];
  if (showAcaPlans) {
    const tierName = selectedTier === 'bronze' ? 'Bronze' : 'Silver';
    financialMetrics.push({
      name: 'full_premium',
      label: `${tierName} full premium`,
      before: tierGrossBefore,
      after: tierGrossAfter,
      category: 'state_credit',
      priority: 1,
    });
    financialMetrics.push({
      name: 'premium_tax_credit',
      label: 'Premium tax credit',
      before: ptcBeforeAnnual,
      after: ptcAfterAnnual,
      category: 'credit',
      priority: 1,
    });
    financialMetrics.push({
      name: 'marketplace_net_premium',
      label: 'Your cost (after credit)',
      before: tierNetBefore,
      after: tierNetAfter,
      category: 'state_credit',
      priority: 1,
    });
  } else {
    // No ACA in play: show PTC only if it's non-zero (rare).
    const ptcMetric = metrics.find((m) => m.name === 'premium_tax_credit');
    if (ptcMetric && (ptcMetric.before !== 0 || ptcMetric.after !== 0)) {
      financialMetrics.push(ptcMetric);
    }
  }

  // CHIP premium: family enrollment fee in states that charge one. Show
  // whenever non-zero either side, regardless of marketplace state.
  const chipPremiumMetric = metrics.find((m) => m.name === 'chip_premium');
  const hasChipPremium = chipPremiumMetric && (chipPremiumMetric.before !== 0 || chipPremiumMetric.after !== 0);
  if (hasChipPremium && chipPremiumMetric) {
    financialMetrics.push({
      ...chipPremiumMetric,
      label: 'CHIP premium (your cost)',
    });
  }

  // Total monthly cost row when there's more than one out-of-pocket item to sum.
  if (showAcaPlans && hasChipPremium) {
    financialMetrics.push({
      name: 'total_monthly_cost',
      label: 'Total monthly cost',
      before: totalBefore,
      after: totalAfter,
      category: 'state_credit',
      priority: 1,
    });
  }

  return (
    <div className="space-y-4">
      {/* Hero net-change card */}
      {hasHero && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-baseline gap-3 sm:gap-6 flex-col sm:flex-row sm:flex-wrap">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Change in monthly cost
              </div>
              <div className={`text-3xl sm:text-4xl font-bold tabular-nums ${heroTone}`}>
                {heroSign}{heroAmount}
                <span className="text-sm sm:text-base font-medium ml-1">/mo</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed flex-1 sm:min-w-[260px] max-w-prose">
              Your total monthly out-of-pocket changes from{' '}
              <b className="text-gray-700 tabular-nums">{formatCurrency(netBefore)}</b> to{' '}
              <b className="text-gray-700 tabular-nums">{formatCurrency(netAfter)}</b>
              {chipPremiumBefore > 0 || chipPremiumAfter > 0 ? ' (marketplace premium plus CHIP enrollment fee)' : ', after applying any tax credits'}.
            </p>
          </div>
        </div>
      )}

      {esiInPlay && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-[#92400E] leading-relaxed">
            <b>Note:</b> employer-sponsored insurance is in play here.
            We don&apos;t model the employee premium contribution your employer charges, so the net-change number above only
            reflects ACA marketplace premiums and may understate or overstate your real out-of-pocket change.
          </p>
        </div>
      )}

      {/* Unified statement: desktop table */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[24%]" />
            <col className="w-[24%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/40">
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Coverage
              </th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Before
              </th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                After
              </th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Change
              </th>
            </tr>
          </thead>
          <tbody>
            <SectionLabel>Who is covered</SectionLabel>
            {allLabels.map((label) => {
              const beforeCoverage = result.healthcareBefore?.people.find((p) => p.label === label)?.coverage ?? null;
              const afterCoverage = result.healthcareAfter?.people.find((p) => p.label === label)?.coverage ?? null;
              return (
                <PersonRow
                  key={label}
                  label={label}
                  beforeCoverage={beforeCoverage}
                  afterCoverage={afterCoverage}
                  existsBefore={beforeLabels.has(label)}
                  existsAfter={afterLabels.has(label)}
                />
              );
            })}

            {financialMetrics.length > 0 && (
              <>
                <SectionLabel>Per-month financial impact</SectionLabel>
                {financialMetrics.map((m) => (
                  <MetricRow
                    key={m.name}
                    metric={m}
                    showTierToggle={m.name === 'full_premium' && (acaScope?.bronzeGross ?? 0) > 0}
                    selectedTier={selectedTier}
                    onTierChange={setSelectedTier}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Unified statement: mobile stacked cards */}
      <div className="sm:hidden bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
            Who is covered
          </div>
          <div className="space-y-2">
            {allLabels.map((label) => {
              const beforeCoverage = result.healthcareBefore?.people.find((p) => p.label === label)?.coverage ?? null;
              const afterCoverage = result.healthcareAfter?.people.find((p) => p.label === label)?.coverage ?? null;
              return (
                <MobilePersonCard
                  key={label}
                  label={label}
                  beforeCoverage={beforeCoverage}
                  afterCoverage={afterCoverage}
                  existsBefore={beforeLabels.has(label)}
                  existsAfter={afterLabels.has(label)}
                />
              );
            })}
          </div>
        </div>

        {financialMetrics.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Per-month financial impact
            </div>
            <div className="space-y-2">
              {financialMetrics.map((m) => (
                <MobileMetricCard
                  key={m.name}
                  metric={m}
                  showTierToggle={m.name === 'full_premium' && (acaScope?.bronzeGross ?? 0) > 0}
                  selectedTier={selectedTier}
                  onTierChange={setSelectedTier}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ACA marketplace context note: visible only when marketplace is in play */}
      {showAcaPlans && acaScope && (
        <p className="text-[11px] text-gray-400 leading-relaxed px-1">
          Silver is the ACA&apos;s benchmark plan: your tax credit is set to keep its monthly cost at a fixed share of your
          income, so silver&apos;s cost doesn&apos;t change when only your state or area changes.
          {acaScope.bronzeGross > 0 && ' Bronze costs less per month but has higher deductibles, and its cost floats with local premiums.'}
        </p>
      )}

      <div className="flex justify-center gap-3 flex-wrap pt-2">
        <button onClick={onTryAnother} className="btn btn-secondary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try another scenario
        </button>
        <button onClick={onReset} className="btn btn-ghost">
          Start over with a new household
        </button>
      </div>
    </div>
  );
}
