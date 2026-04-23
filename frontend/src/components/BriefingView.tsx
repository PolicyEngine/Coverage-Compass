'use client';

import { BenefitMetric, LifeEventType, SimulationResult } from '@/types';

interface BriefingViewProps {
  result: SimulationResult;
  eventType: LifeEventType;
  onReset: () => void;
}

const COVERAGE_LABEL: Record<string, string> = {
  ESI: 'Employer-Sponsored Insurance',
  Marketplace: 'ACA Marketplace',
  Medicaid: 'Medicaid',
  CHIP: 'CHIP',
};

function coverageLabel(c: string | null): string {
  if (c === null) return '—';
  return COVERAGE_LABEL[c] ?? c;
}

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtMo(annual: number): string {
  return fmt(annual / 12);
}

function fmtMoChange(annual: number): string {
  const mo = annual / 12;
  return (mo >= 0 ? '+' : '') + fmt(mo);
}

const METRIC_ORDER: { name: string; label: string; invertColor: boolean }[] = [
  { name: 'premium_tax_credit', label: 'Premium tax credit', invertColor: false },
  { name: 'medicaid', label: 'Medicaid', invertColor: false },
  { name: 'chip', label: 'CHIP', invertColor: false },
];

const SKIP_METRICS = new Set(['slcsp', 'marketplace_net_premium']);

function buildLineItems(result: SimulationResult): {
  label: string;
  before: number;
  after: number;
  delta: number;
  invertColor: boolean;
}[] {
  const metricsMap = new Map<string, BenefitMetric>();
  for (const m of result.before.metrics ?? []) {
    metricsMap.set(m.name, m);
  }
  for (const m of result.after.metrics ?? []) {
    if (!metricsMap.has(m.name)) metricsMap.set(m.name, m);
  }

  const rows: { label: string; before: number; after: number; delta: number; invertColor: boolean }[] = [];

  for (const spec of METRIC_ORDER) {
    if (SKIP_METRICS.has(spec.name)) continue;

    const beforeM = result.before.metrics?.find(m => m.name === spec.name);
    const afterM = result.after.metrics?.find(m => m.name === spec.name);
    const before = beforeM?.before ?? 0;
    const after = afterM?.after ?? 0;

    if (before === 0 && after === 0) continue;
    if (before === after) continue;

    rows.push({ label: spec.label, before, after, delta: after - before, invertColor: spec.invertColor });
  }

  return rows;
}

function generateAnalystNote(result: SimulationResult, eventType: LifeEventType): string {
  const allMetrics = [...(result.before.metrics ?? []), ...(result.after.metrics ?? [])];

  const ptcBefore = result.before.metrics?.find(m => m.name === 'premium_tax_credit')?.before
    ?? allMetrics.find(m => m.name === 'premium_tax_credit')?.before
    ?? 0;
  const ptcAfter = result.after.metrics?.find(m => m.name === 'premium_tax_credit')?.after
    ?? allMetrics.find(m => m.name === 'premium_tax_credit')?.after
    ?? 0;

  const anyMedicaidBefore = (result.healthcareBefore?.people ?? []).some(p => p.coverage === 'Medicaid');
  const anyMedicaidAfter = (result.healthcareAfter?.people ?? []).some(p => p.coverage === 'Medicaid');
  const anyMarketplaceAfter = (result.healthcareAfter?.people ?? []).some(p => p.coverage === 'Marketplace');

  const ptcBeforeMo = ptcBefore / 12;
  const ptcAfterMo = ptcAfter / 12;
  const ptcDiffMo = ptcAfterMo - ptcBeforeMo;

  switch (eventType) {
    case 'losing_esi': {
      if (anyMedicaidAfter) {
        return 'Without employer coverage, your income qualifies for Medicaid — no monthly premium.';
      }
      if (ptcAfter > 0) {
        const silverNet = result.acaPremiums?.after?.silverNet;
        const ptcStr = fmtMo(ptcAfter);
        if (silverNet !== undefined && silverNet > 0) {
          return `Without employer coverage, you qualify for a ${ptcStr}/month ACA credit. A silver plan would cost you ${fmtMo(silverNet)}/month after that credit.`;
        }
        return `Without employer coverage, you qualify for a ${ptcStr}/month ACA credit toward a marketplace plan.`;
      }
      if (anyMarketplaceAfter) {
        return 'Your income is above the ACA subsidy range — you\'d pay the full marketplace rate.';
      }
      return 'Losing employer coverage opens a 60-day special enrollment window to find a new plan.';
    }

    case 'having_baby': {
      if (anyMedicaidAfter && !anyMedicaidBefore) {
        return 'During pregnancy, household size increases for eligibility — that\'s what qualifies you for Medicaid, even without an income change.';
      }
      if (anyMedicaidBefore && anyMedicaidAfter) {
        return 'Pregnancy adds to your household count, which can strengthen your Medicaid eligibility going into birth.';
      }
      if (ptcDiffMo > 10) {
        return `The larger household size increases your ACA credit by ${fmt(ptcDiffMo)}/month.`;
      }
      return 'Adding a dependent shifts eligibility thresholds for Medicaid and CHIP.';
    }

    case 'getting_married': {
      if (ptcBefore > 0 && ptcAfter === 0) {
        return `Combining income lifts you over the ACA subsidy threshold — the ${fmtMo(ptcBefore)}/month credit disappears entirely.`;
      }
      if (ptcDiffMo < -10) {
        return `Your combined income reduces your ACA credit from ${fmt(ptcBeforeMo)} to ${fmt(ptcAfterMo)}/month.`;
      }
      if (ptcAfter > ptcBefore) {
        return `Combining households improves your ACA eligibility, adding ${fmt(ptcDiffMo)}/month in credits.`;
      }
      if (anyMedicaidAfter && !anyMedicaidBefore) {
        return 'Your combined household income falls within Medicaid eligibility — no monthly premium.';
      }
      if (!anyMedicaidAfter && anyMedicaidBefore) {
        return 'Combined income moves you out of Medicaid. You\'ll need a marketplace plan.';
      }
      return 'Combining households changes your filing status and may affect coverage eligibility.';
    }

    case 'divorce': {
      const anyESIBefore = (result.healthcareBefore?.people ?? []).some(
        p => p.label === 'You' && p.coverage === 'ESI'
      );
      const anyESIAfter = (result.healthcareAfter?.people ?? []).some(
        p => p.label === 'You' && p.coverage === 'ESI'
      );
      if (anyMedicaidAfter) {
        return 'As a single filer, your individual income now qualifies for Medicaid.';
      }
      if (ptcAfter > 0) {
        return `As a single filer, you qualify for a ${fmtMo(ptcAfter)}/month ACA credit toward a marketplace plan.`;
      }
      if (anyESIBefore && !anyESIAfter) {
        return 'You lose employer coverage in the separation — enroll in a marketplace plan within 60 days.';
      }
      return 'After separating, your coverage is based on your individual income as a single filer.';
    }

    case 'moving_states': {
      if (anyMedicaidAfter && !anyMedicaidBefore) {
        return 'Your new state\'s Medicaid rules cover your income — no monthly premium.';
      }
      if (!anyMedicaidAfter && anyMedicaidBefore) {
        return 'Your new state has stricter Medicaid eligibility — you\'d need a marketplace plan.';
      }
      if (Math.abs(ptcDiffMo) > 10) {
        const direction = ptcDiffMo > 0 ? 'higher' : 'lower';
        const changeDir = ptcDiffMo > 0 ? 'increase' : 'decrease';
        return `${direction.charAt(0).toUpperCase() + direction.slice(1)} premiums in your new state ${changeDir} your ACA credit from ${fmt(ptcBeforeMo)} to ${fmt(ptcAfterMo)}/month.`;
      }
      return 'Your new state has similar ACA rules and program eligibility.';
    }

    case 'changing_income': {
      const ptcReduced = ptcBeforeMo - ptcAfterMo;
      const ptcIncreased = ptcAfterMo - ptcBeforeMo;
      if (anyMedicaidAfter && !anyMedicaidBefore) {
        return 'Your lower income now qualifies for Medicaid — no monthly premium.';
      }
      if (!anyMedicaidAfter && anyMedicaidBefore) {
        return 'Your higher income moves you above Medicaid eligibility. A marketplace plan would apply.';
      }
      if (ptcBefore > 0 && ptcAfter === 0) {
        return `This income crosses the threshold where your ${fmtMo(ptcBefore)}/month ACA credit phases out entirely — a common benefit cliff.`;
      }
      if (ptcReduced > 10) {
        return `Your higher income reduces your ACA credit by ${fmt(ptcReduced)}/month.`;
      }
      if (ptcIncreased > 10) {
        return `Your lower income increases your ACA credit by ${fmt(ptcIncreased)}/month.`;
      }
      return 'Your new income has limited effect on coverage eligibility at this level.';
    }
  }
}

function HeadlineStat({ result }: { result: SimulationResult }) {
  const changeAnnual = result.diff.netIncome;
  const changeMo = changeAnnual / 12;
  const absChangeMo = Math.abs(changeMo);

  const anyMedicaidBefore = (result.healthcareBefore?.people ?? []).some(p => p.coverage === 'Medicaid');
  const anyMedicaidAfter = (result.healthcareAfter?.people ?? []).some(p => p.coverage === 'Medicaid');
  const anyCHIPAfter = (result.healthcareAfter?.people ?? []).some(p => p.coverage === 'CHIP');

  const coverageChanged =
    JSON.stringify(result.healthcareBefore?.people ?? []) !==
    JSON.stringify(result.healthcareAfter?.people ?? []);

  if (absChangeMo < 20 && coverageChanged) {
    let gainedLabel: string | null = null;
    if (!anyMedicaidBefore && anyMedicaidAfter) gainedLabel = 'Medicaid';
    else if (anyCHIPAfter) gainedLabel = 'CHIP';
    else if ((result.healthcareAfter?.people ?? []).some(p => p.coverage === 'Marketplace')) gainedLabel = 'ACA Marketplace';
    if (gainedLabel) {
      return (
        <span className="text-5xl font-bold tabular-nums text-[#2C7A7B] break-words">
          {gainedLabel}
        </span>
      );
    }
  }

  const positive = changeMo >= 0;
  const colorClass = positive ? 'text-[#2C7A7B]' : 'text-red-500';
  const prefix = positive ? '+' : '−';
  const display = `${prefix}${fmt(Math.abs(changeMo))}/mo`;

  return (
    <span className={`text-5xl font-bold tabular-nums ${colorClass}`}>
      {display}
    </span>
  );
}

function CoverageFlow({ result }: { result: SimulationResult }) {
  const beforePeople = result.healthcareBefore?.people ?? [];
  const afterPeople = result.healthcareAfter?.people ?? [];

  const isPregnancy = result.event?.name === 'Pregnancy';
  const beforeLabels = new Set(beforePeople.map(p => p.label));
  const afterLabels = new Set(afterPeople.map(p => p.label));
  const allLabels = isPregnancy
    ? Array.from(beforeLabels)
    : Array.from(new Set([...beforeLabels, ...afterLabels]));

  if (allLabels.length === 0) return null;

  return (
    <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-teal-700 mb-2">Coverage flow</p>
      <div className="space-y-1.5">
        {allLabels.map(label => {
          const before = beforePeople.find(p => p.label === label)?.coverage ?? null;
          const after = afterPeople.find(p => p.label === label)?.coverage ?? null;
          return (
            <div key={label} className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-semibold text-gray-800 min-w-[56px]">{label}</span>
              <span className="text-gray-500">{coverageLabel(before)}</span>
              <span className="text-teal-500">→</span>
              <span className="font-semibold text-teal-700">{coverageLabel(after)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineItemsCard({ result }: { result: SimulationResult }) {
  const rows = buildLineItems(result);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">What changed</p>
      <div className="divide-y divide-gray-100">
        {rows.map(row => {
          const isGain = row.invertColor ? row.delta < 0 : row.delta > 0;
          const isLoss = row.invertColor ? row.delta > 0 : row.delta < 0;
          const deltaColorClass = isGain
            ? 'text-[#2C7A7B]'
            : isLoss
            ? 'text-red-500'
            : 'text-gray-400';

          const deltaMo = row.delta / 12;
          const absDeltaMo = Math.abs(deltaMo);
          const deltaPrefix = deltaMo >= 0 ? '+' : '−';
          const deltaStr = row.invertColor
            ? (row.delta > 0 ? '−' : '+') + fmt(absDeltaMo) + '/mo'
            : `${deltaPrefix}${fmt(absDeltaMo)}/mo`;

          const beforeMo = fmtMo(row.before);
          const afterMo = fmtMo(row.after);

          return (
            <div key={row.label} className="py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{row.label}</p>
                <p className="text-xs text-gray-400 mt-0.5 tabular-nums">{beforeMo} → {afterMo}/mo</p>
              </div>
              <p className={`text-sm font-semibold tabular-nums shrink-0 ${deltaColorClass}`}>
                {deltaStr}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalystCard({ result, eventType }: { result: SimulationResult; eventType: LifeEventType }) {
  const note = generateAnalystNote(result, eventType);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Analyst note</p>
      <blockquote className="border-l-4 border-[#319795] bg-[#F0FAFA] px-4 py-3 rounded-r-lg text-sm text-gray-700">
        {note}
      </blockquote>
      <p className="text-xs text-gray-400 mt-3">Modeled by PolicyEngine · U.S. rules</p>
      <div className="border-t border-gray-100 mt-4 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Caveats</p>
        <p className="text-xs text-gray-500">
          Estimates use federal parameters for the selected year. Actual plan costs vary by rating area.
        </p>
      </div>
    </div>
  );
}

export default function BriefingView({ result, eventType, onReset }: BriefingViewProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr_0.9fr] gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Headline impact</p>
          <p className="text-xs text-gray-400 mt-0.5 mb-3">Net change · per month</p>
          <HeadlineStat result={result} />
          <CoverageFlow result={result} />
        </div>

        <LineItemsCard result={result} />

        <AnalystCard result={result} eventType={eventType} />
      </div>

      <div className="flex justify-center pt-2">
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg border border-[#319795] text-[#2C7A7B] bg-white hover:bg-teal-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try another scenario
        </button>
      </div>
    </div>
  );
}
