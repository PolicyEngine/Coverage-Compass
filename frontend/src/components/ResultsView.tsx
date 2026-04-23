'use client';

import { BenefitMetric, HealthcareCoverage, LifeEventType, SimulationResult } from '@/types';

interface ResultsViewProps {
  result: SimulationResult;
  eventType?: LifeEventType;
  onReset: () => void;
}

const SUPPORT_METRIC_NAMES = new Set(['premium_tax_credit']);

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatMonthly(value: number): string {
  return formatCurrency(value / 12);
}

function formatMonthlyChange(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${formatMonthly(value)}`;
}

function getCoverageLabel(type: string | null): string {
  switch (type) {
    case 'ESI':
      return 'Employer-Sponsored Insurance';
    case 'Marketplace':
      return 'ACA Marketplace';
    default:
      return type || '—';
  }
}

function generateSummary(result: SimulationResult, eventType?: LifeEventType): string | null {
  const metrics = result.before.metrics || [];
  const ptcBefore = metrics.find(m => m.name === 'premium_tax_credit')?.before ?? 0;
  const ptcAfter  = metrics.find(m => m.name === 'premium_tax_credit')?.after  ?? 0;

  const anyMarketplaceAfter = (result.healthcareAfter?.people || []).some(p => p.coverage === 'Marketplace');
  const anyMedicaidAfter    = (result.healthcareAfter?.people || []).some(p => p.coverage === 'Medicaid');
  const anyMedicaidBefore   = (result.healthcareBefore?.people || []).some(p => p.coverage === 'Medicaid');

  switch (eventType) {
    case 'losing_esi':
      if (anyMedicaidAfter) {
        return 'Without employer coverage, your income qualifies you for Medicaid — there\'s no monthly premium.';
      }
      if (ptcAfter > 0) {
        return `Without employer coverage, you qualify for a ${formatMonthly(ptcAfter)}/month ACA tax credit toward a marketplace plan.`;
      }
      return 'Without employer coverage, you can enroll in an ACA marketplace plan during a special enrollment period.';

    case 'having_baby':
      if (anyMedicaidAfter && !anyMedicaidBefore) {
        return 'During pregnancy, your household size increases for eligibility purposes, qualifying you for Medicaid with no monthly premium.';
      }
      if (anyMedicaidAfter) {
        return 'During pregnancy, your household size increases for eligibility purposes, which may strengthen your Medicaid eligibility.';
      }
      return 'During pregnancy, your household size increases for eligibility purposes. The baby\'s coverage would begin at birth.';

    case 'getting_married': {
      const netChange = result.diff.netIncome;
      if (ptcAfter === 0 && ptcBefore > 0) {
        return `Combining households raises your income above the ACA subsidy threshold, eliminating the ${formatMonthly(ptcBefore)}/month tax credit.`;
      }
      if (ptcAfter > ptcBefore) {
        return `Combining households improves your ACA eligibility, increasing your tax credit to ${formatMonthly(ptcAfter)}/month.`;
      }
      if (netChange > 0) {
        return `Combining households adds ${formatMonthly(netChange)}/month in net income to the household.`;
      }
      return 'Combining households changes your coverage options based on your new combined income.';
    }

    case 'divorce': {
      if (anyMedicaidAfter && !anyMedicaidBefore) {
        return 'As a single filer, your income qualifies you for Medicaid with no monthly premium.';
      }
      if (ptcAfter > 0) {
        return `As a single filer, you qualify for an ACA tax credit of ${formatMonthly(ptcAfter)}/month toward a marketplace plan.`;
      }
      return 'After separating, your coverage is based on your individual income as a single filer.';
    }

    case 'moving_states':
      if (anyMedicaidAfter && !anyMedicaidBefore) {
        return 'Your new state qualifies you for Medicaid, which has no monthly premium.';
      }
      if (!anyMedicaidAfter && anyMedicaidBefore) {
        return 'Your new state has different Medicaid eligibility rules — you no longer qualify.';
      }
      if (ptcAfter !== ptcBefore) {
        return `Your new state changes your ACA tax credit from ${formatMonthly(ptcBefore)} to ${formatMonthly(ptcAfter)}/month.`;
      }
      return 'Your new state may have different benefit programs and eligibility rules.';

    case 'changing_income': {
      const ptcChange = ptcAfter - ptcBefore;
      if (anyMedicaidAfter && !anyMedicaidBefore) {
        return 'Your lower income now qualifies you for Medicaid with no monthly premium.';
      }
      if (!anyMedicaidAfter && anyMedicaidBefore) {
        return 'Your higher income moves you out of Medicaid eligibility. You can enroll in an ACA marketplace plan instead.';
      }
      if (Math.abs(ptcChange) > 10) {
        const direction = ptcChange > 0 ? 'increases' : 'reduces';
        return `Your new income ${direction} your ACA tax credit by ${formatMonthly(Math.abs(ptcChange))}/month.`;
      }
      return null;
    }

    default:
      return null;
  }
}

function SectionRow({ label }: { label: string }) {
  return (
    <tr className="bg-gray-50">
      <td colSpan={4} className="px-5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </td>
    </tr>
  );
}

function CoverageRow({
  label,
  beforeCoverage,
  afterCoverage,
  existsBefore,
  existsAfter,
  striped,
}: {
  label: string;
  beforeCoverage: string | null;
  afterCoverage: string | null;
  existsBefore: boolean;
  existsAfter: boolean;
  striped: boolean;
}) {
  const beforeText = existsBefore ? getCoverageLabel(beforeCoverage) : '—';
  const afterText = existsAfter ? getCoverageLabel(afterCoverage) : '—';
  const changed = beforeCoverage !== afterCoverage || existsBefore !== existsAfter;

  return (
    <tr className={striped ? 'bg-gray-50/50' : 'bg-white'}>
      <td className="px-5 py-3 text-sm font-medium text-gray-800 w-40">{label}</td>
      <td className="px-5 py-3 text-sm text-gray-500">{beforeText}</td>
      <td className={`px-5 py-3 text-sm ${changed ? 'font-semibold text-[#2C7A7B]' : 'text-gray-500'}`}>
        {afterText}
      </td>
      <td className="px-5 py-3 text-sm text-gray-400" />
    </tr>
  );
}

function FinancialRow({
  label,
  before,
  after,
  striped,
}: {
  label: string;
  before: number;
  after: number;
  striped: boolean;
}) {
  const diff = after - before;
  const tone = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-400';

  return (
    <tr className={striped ? 'bg-gray-50/50' : 'bg-white'}>
      <td className="px-5 py-3 text-sm font-medium text-gray-800 w-40">{label}</td>
      <td className="px-5 py-3 text-sm text-gray-500 tabular-nums">{formatMonthly(before)}</td>
      <td className="px-5 py-3 text-sm text-gray-500 tabular-nums">{formatMonthly(after)}</td>
      <td className={`px-5 py-3 text-sm font-semibold tabular-nums ${tone}`}>
        {diff !== 0 ? formatMonthlyChange(diff) : '—'}
      </td>
    </tr>
  );
}

function PlanCostBlock({ label, gross, net, ptc }: { label: string; gross: number; net: number; ptc: number }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3 space-y-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-600">Full cost: <span className="font-medium text-gray-900">{formatMonthly(gross)}/mo</span></p>
      {ptc > 0 && (
        <p className="text-sm text-gray-600">Tax credit: <span className="font-medium text-[#2C7A7B]">−{formatMonthly(ptc)}/mo</span></p>
      )}
      <p className="text-sm font-semibold text-gray-900">Your cost: {formatMonthly(net)}/mo</p>
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
        <button onClick={onReset} className="btn btn-primary">Try Again</button>
      </div>
    );
  }

  const metrics = result.before.metrics || [];
  const financialRows = [
    { label: 'Net income', before: result.before.netIncome, after: result.after.netIncome },
    ...metrics
      .filter((m) => SUPPORT_METRIC_NAMES.has(m.name))
      .filter((m) => m.before !== 0 || m.after !== 0)
      .map((m: BenefitMetric) => ({ label: m.label, before: m.before, after: m.after })),
  ];

  const isPregnancyScenario = result.event?.name === 'Pregnancy';
  const beforeLabels = new Set((result.healthcareBefore?.people || []).map((p) => p.label));
  const afterLabels = new Set((result.healthcareAfter?.people || []).map((p) => p.label));
  // For pregnancy, only show existing members — the fetus is not yet a person with coverage
  const allLabels = isPregnancyScenario
    ? Array.from(beforeLabels)
    : Array.from(new Set([...beforeLabels, ...afterLabels]));

  const summary = generateSummary(result, eventType);

  // Show ACA premium callout when there's a non-zero silver plan in before or after
  const acaBefore = result.acaPremiums?.before;
  const acaAfter  = result.acaPremiums?.after;
  const showAcaBefore = (acaBefore?.silverGross ?? 0) > 0;
  const showAcaAfter  = (acaAfter?.silverGross  ?? 0) > 0;

  return (
    <div className="space-y-6">
      {summary && (
        <div className="card px-5 py-4 text-sm text-gray-700 border-l-4 border-[#319795] bg-[#F0FAFA]">
          {summary}
        </div>
      )}

      {(showAcaBefore || showAcaAfter) && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">ACA Marketplace Plan Costs</h3>
          <div className={`grid gap-6 ${showAcaBefore && showAcaAfter ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {showAcaBefore && (
              <div className="space-y-3">
                {showAcaAfter && <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Before</p>}
                <PlanCostBlock label="Bronze plan" gross={acaBefore!.bronzeGross} net={acaBefore!.bronzeNet} ptc={acaBefore!.ptc} />
                <PlanCostBlock label="Silver plan" gross={acaBefore!.silverGross} net={acaBefore!.silverNet} ptc={acaBefore!.ptc} />
              </div>
            )}
            {showAcaAfter && (
              <div className="space-y-3">
                {showAcaBefore && <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">After</p>}
                <PlanCostBlock label="Bronze plan" gross={acaAfter!.bronzeGross} net={acaAfter!.bronzeNet} ptc={acaAfter!.ptc} />
                <PlanCostBlock label="Silver plan" gross={acaAfter!.silverGross} net={acaAfter!.silverNet} ptc={acaAfter!.ptc} />
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 pt-1 border-t border-gray-100">
            Your tax credit applies to any metal tier. Bronze costs less per month but has higher deductibles; silver costs more but covers more of your care costs. Bronze estimate is based on state averages and will improve once rating-area data is available (<a href="https://github.com/PolicyEngine/policyengine-us/issues/8145" target="_blank" rel="noopener noreferrer" className="underline">tracked here</a>).
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-40" />
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Before</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">After</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            <SectionRow label="Coverage" />
            {allLabels.map((label, i) => {
              const beforeCoverage = result.healthcareBefore?.people.find((p) => p.label === label)?.coverage ?? null;
              const afterCoverage = result.healthcareAfter?.people.find((p) => p.label === label)?.coverage ?? null;
              return (
                <CoverageRow
                  key={label}
                  label={label}
                  beforeCoverage={beforeCoverage}
                  afterCoverage={afterCoverage}
                  existsBefore={beforeLabels.has(label)}
                  existsAfter={afterLabels.has(label)}
                  striped={i % 2 === 1}
                />
              );
            })}

            <SectionRow label="Financial (per month)" />
            {financialRows.map(({ label, before, after }, i) => (
              <FinancialRow
                key={label}
                label={label}
                before={before}
                after={after}
                striped={i % 2 === 1}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center pt-2">
        <button onClick={onReset} className="btn btn-secondary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Try Another Scenario
        </button>
      </div>
    </div>
  );
}
