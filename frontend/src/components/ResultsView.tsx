'use client';

import { BenefitMetric, LifeEventType, SimulationResult } from '@/types';

interface ResultsViewProps {
  result: SimulationResult;
  eventType?: LifeEventType;
  onReset: () => void;
}

// Per-month financial rows we surface in the statement table.
const FINANCIAL_METRIC_NAMES = new Set([
  'premium_tax_credit',
  'marketplace_net_premium',
  'medicaid',
  'chip',
]);

// Each metric's category tag, for the small label shown next to the row name.
const METRIC_CATEGORY: Record<string, string> = {
  premium_tax_credit: 'tax credit',
  marketplace_net_premium: 'premium',
  medicaid: 'benefit',
  chip: 'benefit',
};

// Each metric's diff-chip kind (drives the chip color + suffix word).
type ChipKind = 'credit' | 'cost' | 'benefit';
const METRIC_CHIP_KIND: Record<string, ChipKind> = {
  premium_tax_credit: 'credit',
  marketplace_net_premium: 'cost',
  medicaid: 'benefit',
  chip: 'benefit',
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
        <div className="flex items-center gap-2 flex-wrap">
          <CoveragePill type={beforeCoverage} exists={existsBefore} />
          <span className="text-gray-300 text-sm">→</span>
          <CoveragePill type={afterCoverage} exists={existsAfter} />
        </div>
      </td>
      <td />
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
        <div className="flex items-center gap-2 justify-between flex-wrap">
          <span className="text-sm tabular-nums text-gray-700">
            {monthlyAfter === 0 ? <span className="text-gray-300">—</span> : `${formatCurrency(monthlyAfter)}/mo`}
          </span>
          <DiffChip kind={chipKind} monthlyDelta={monthlyDelta} />
        </div>
      </td>
    </tr>
  );
}

function PlanCard({
  tier,
  gross,
  ptc,
  net,
}: {
  tier: 'Bronze' | 'Silver';
  gross: number;
  ptc: number;
  net: number;
}) {
  const dotColor = tier === 'Bronze' ? 'bg-[#B45309]' : 'bg-[#64748B]';
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2.5 h-2.5 rounded-sm ${dotColor}`} />
        <span className="text-sm font-semibold text-gray-900">{tier}</span>
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
    </div>
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

  const metrics = result.before.metrics || [];

  // Hero metric: monthly net premium cost (after applying tax credits).
  const netPremiumMetric = metrics.find((m) => m.name === 'marketplace_net_premium');
  const netBefore = (netPremiumMetric?.before ?? 0) / 12;
  const netAfter = (netPremiumMetric?.after ?? 0) / 12;
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

  // Financial rows.
  const financialMetrics = metrics
    .filter((m) => FINANCIAL_METRIC_NAMES.has(m.name))
    .filter((m) => m.before !== 0 || m.after !== 0);

  // ACA plan options.
  const acaBefore = result.acaPremiums?.before;
  const acaAfter = result.acaPremiums?.after;
  const acaScope = acaAfter && (acaAfter.silverGross ?? 0) > 0 ? acaAfter : acaBefore;
  const showAcaPlans = !!acaScope && (acaScope.silverGross ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Hero net-change card */}
      {hasHero && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-baseline gap-6 flex-wrap">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">
                Net change
              </div>
              <div className={`text-4xl font-bold tabular-nums ${heroTone}`}>
                {heroSign}{heroAmount}
                <span className="text-base font-medium ml-1">/mo</span>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed flex-1 min-w-[260px] max-w-prose">
              After this event, your household&apos;s monthly out-of-pocket changes from{' '}
              <b className="text-gray-700 tabular-nums">{formatCurrency(netBefore)}</b> to{' '}
              <b className="text-gray-700 tabular-nums">{formatCurrency(netAfter)}</b>, after applying any tax credits.
            </p>
          </div>
        </div>
      )}

      {/* Unified statement table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/40">
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest w-44">
                Coverage
              </th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-widest w-1/3">
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
            <PlanCard tier="Bronze" gross={acaScope.bronzeGross} ptc={acaScope.ptc} net={acaScope.bronzeNet} />
            <PlanCard tier="Silver" gross={acaScope.silverGross} ptc={acaScope.ptc} net={acaScope.silverNet} />
          </div>
          <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
            Bronze costs less per month but has higher deductibles. Silver covers more of your care costs and is the basis
            for cost-sharing reductions if you qualify.
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
