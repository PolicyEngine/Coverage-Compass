'use client';

import { useState } from 'react';
import { BenefitMetric, LifeEventType, SimulationResult } from '@/types';

type Tier = 'bronze' | 'silver';

interface ResultsViewProps {
  result: SimulationResult;
  eventType?: LifeEventType;
  onReset: () => void;
}

// Per-month financial rows we surface in the statement table.
// CHIP and Medicaid program-cost dollar amounts are intentionally omitted —
// they're shown via per-person coverage pills above; the dollar value to
// the family (premium contribution) isn't directly modeled.
const FINANCIAL_METRIC_NAMES = new Set([
  'premium_tax_credit',
  'marketplace_net_premium',
]);

// Each metric's category tag, for the small label shown next to the row name.
const METRIC_CATEGORY: Record<string, string> = {
  premium_tax_credit: 'tax credit',
  marketplace_net_premium: 'premium',
};

// Each metric's diff-chip kind (drives the chip color + suffix word).
type ChipKind = 'credit' | 'cost' | 'benefit';
const METRIC_CHIP_KIND: Record<string, ChipKind> = {
  premium_tax_credit: 'credit',
  marketplace_net_premium: 'cost',
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

function CoveragePill({ type, exists }: { type: string | null; exists: boolean }) {
  if (!exists) {
    return <span className="text-sm text-gray-300">—</span>;
  }
  const label = getCoverageLabel(type);
  const tone = type === null
    ? 'bg-gray-50 text-gray-500 border-gray-200'
    : 'bg-gray-100 text-gray-800 border-gray-200';
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
      <td colSpan={3} className="px-5 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
        {children}
      </td>
    </tr>
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
  return (
    <tr className="border-t border-gray-100">
      <td className="px-5 py-3 text-sm font-medium text-gray-900 align-middle w-44">{label}</td>
      <td className="px-5 py-3 align-middle">
        <CoveragePill type={beforeCoverage} exists={existsBefore} />
      </td>
      <td className="px-5 py-3 align-middle">
        <CoveragePill type={afterCoverage} exists={existsAfter} />
      </td>
    </tr>
  );
}

function MetricRow({
  metric,
}: {
  metric: BenefitMetric;
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
      </td>
      <td className="px-5 py-3 align-middle text-sm tabular-nums text-gray-500">
        {monthlyBefore === 0 ? <span className="text-gray-300">—</span> : `${formatCurrency(monthlyBefore)}/mo`}
      </td>
      <td className="px-5 py-3 align-middle">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm tabular-nums text-gray-700">
            {monthlyAfter === 0 ? <span className="text-gray-300">—</span> : `${formatCurrency(monthlyAfter)}/mo`}
          </span>
          <DiffChip kind={chipKind} monthlyDelta={monthlyDelta} />
        </div>
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

function MobileMetricCard({ metric }: { metric: BenefitMetric }) {
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
        </div>
        <DiffChip kind={chipKind} monthlyDelta={monthlyDelta} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Before</div>
          <div className="text-sm tabular-nums text-gray-700">
            {monthlyBefore === 0 ? <span className="text-gray-300">—</span> : `${formatCurrency(monthlyBefore)}/mo`}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">After</div>
          <div className="text-sm tabular-nums text-gray-700">
            {monthlyAfter === 0 ? <span className="text-gray-300">—</span> : `${formatCurrency(monthlyAfter)}/mo`}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCard({
  tier,
  gross,
  ptc,
  net,
  selected,
  onClick,
}: {
  tier: 'Bronze' | 'Silver';
  gross: number;
  ptc: number;
  net: number;
  selected: boolean;
  onClick: () => void;
}) {
  const dotColor = tier === 'Bronze' ? 'bg-[#B45309]' : 'bg-[#64748B]';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`text-left rounded-xl p-4 bg-white border-2 transition-all cursor-pointer ${
        selected
          ? 'border-[#319795] ring-2 ring-[#319795]/20'
          : 'border-gray-200 hover:border-[#319795]/50'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-sm ${dotColor}`} />
        <span className="text-sm font-semibold text-gray-900">{tier}</span>
        {selected && (
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest text-[#285E61]">Selected</span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-900 tabular-nums mb-0.5">
        {formatCurrency(net / 12)} <span className="text-xs font-medium text-gray-500">/mo your cost</span>
      </div>
      <div className="border-t border-gray-100 mt-3 pt-3 space-y-1.5 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>Full premium</span>
          <span className="tabular-nums text-gray-700">{formatCurrency(gross / 12)}/mo</span>
        </div>
        <div className="flex justify-between">
          <span>Your tax credit</span>
          <span className="tabular-nums text-[#285E61]">−{formatCurrency(ptc / 12)}/mo</span>
        </div>
      </div>
    </button>
  );
}

export default function ResultsView({ result, eventType, onReset }: ResultsViewProps) {
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
        <button onClick={onReset} className="btn btn-primary">Try again</button>
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

  // Hero metric: monthly net premium cost for the selected tier (after applying tax credits).
  const netPremiumMetric = metrics.find((m) => m.name === 'marketplace_net_premium');
  const tierNetBefore = showAcaPlans ? tierNetPremium('before') : (netPremiumMetric?.before ?? 0);
  const tierNetAfter = showAcaPlans ? tierNetPremium('after') : (netPremiumMetric?.after ?? 0);
  const netBefore = tierNetBefore / 12;
  const netAfter = tierNetAfter / 12;
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

  // Financial rows. Marketplace premium row uses the selected tier's net cost.
  const tierLabel = selectedTier === 'bronze' ? 'Bronze plan (your cost)' : 'Silver plan (your cost)';
  const financialMetrics = metrics
    .filter((m) => FINANCIAL_METRIC_NAMES.has(m.name))
    .map((m): BenefitMetric => {
      if (m.name === 'marketplace_net_premium' && showAcaPlans) {
        return { ...m, label: tierLabel, before: tierNetBefore, after: tierNetAfter };
      }
      return m;
    })
    .filter((m) => m.before !== 0 || m.after !== 0);

  return (
    <div className="space-y-4">
      {/* Hero net-change card */}
      {hasHero && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 sm:p-6 shadow-sm">
          <div className="flex items-baseline gap-3 sm:gap-6 flex-col sm:flex-row sm:flex-wrap">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Net change
              </div>
              <div className={`text-3xl sm:text-4xl font-bold tabular-nums ${heroTone}`}>
                {heroSign}{heroAmount}
                <span className="text-sm sm:text-base font-medium ml-1">/mo</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed flex-1 sm:min-w-[260px] max-w-prose">
              After this event, your household&apos;s monthly out-of-pocket changes from{' '}
              <b className="text-gray-700 tabular-nums">{formatCurrency(netBefore)}</b> to{' '}
              <b className="text-gray-700 tabular-nums">{formatCurrency(netAfter)}</b>, after applying any tax credits.
            </p>
          </div>
        </div>
      )}

      {/* Unified statement — desktop table */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <colgroup>
            <col className="w-[28%]" />
            <col className="w-[36%]" />
            <col className="w-[36%]" />
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
                  <MetricRow key={m.name} metric={m} />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Unified statement — mobile stacked cards */}
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
                <MobileMetricCard key={m.name} metric={m} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ACA marketplace plans sub-card */}
      {showAcaPlans && acaScope && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-3 gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">ACA marketplace plan options</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Same tax credit applies to any tier</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PlanCard
              tier="Bronze"
              gross={acaScope.bronzeGross}
              ptc={acaScope.ptc}
              net={acaScope.bronzeNet}
              selected={selectedTier === 'bronze'}
              onClick={() => setSelectedTier('bronze')}
            />
            <PlanCard
              tier="Silver"
              gross={acaScope.silverGross}
              ptc={acaScope.ptc}
              net={acaScope.silverNet}
              selected={selectedTier === 'silver'}
              onClick={() => setSelectedTier('silver')}
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
            Silver is the ACA&apos;s benchmark plan: your tax credit is set to keep its monthly cost at a fixed share of
            your income, so silver&apos;s &ldquo;your cost&rdquo; doesn&apos;t change when only your state or area changes.
            Bronze costs less per month but has higher deductibles, and its cost floats with local premiums.
          </p>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <button onClick={onReset} className="btn btn-secondary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try another scenario
        </button>
      </div>
    </div>
  );
}
