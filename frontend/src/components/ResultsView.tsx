'use client';

import { BenefitMetric, HealthcareCoverage, SimulationResult } from '@/types';

interface ResultsViewProps {
  result: SimulationResult;
  onReset: () => void;
}

const SUPPORT_METRIC_NAMES = new Set(['premium_tax_credit', 'wic']);

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatChange(value: number): string {
  const prefix = value >= 0 ? '+' : '';
  return `${prefix}${formatCurrency(value)}`;
}

function getCoverageLabel(type: string | null): string {
  switch (type) {
    case 'ESI':
      return 'Employer Insurance';
    case 'Marketplace':
      return 'ACA Marketplace';
    default:
      return type || 'No Identified Coverage';
  }
}

function getCoverageIcon(type: string | null): string {
  switch (type) {
    case 'ESI':
      return '💼';
    case 'Medicaid':
      return '🏥';
    case 'CHIP':
      return '👶';
    case 'Marketplace':
      return '🛒';
    default:
      return '○';
  }
}

function getCoverageForPerson(coverage: HealthcareCoverage | undefined, label: string): string | null {
  return coverage?.people.find((person) => person.label === label)?.coverage ?? null;
}

function getCoverageChanges(before?: HealthcareCoverage, after?: HealthcareCoverage) {
  const labels = new Set<string>();

  before?.people.forEach((person) => labels.add(person.label));
  after?.people.forEach((person) => labels.add(person.label));

  return Array.from(labels)
    .map((label) => ({
      label,
      before: getCoverageForPerson(before, label),
      after: getCoverageForPerson(after, label),
    }))
    .filter((change) => change.before !== change.after);
}

function SummaryCard({
  title,
  before,
  after,
  icon,
}: {
  title: string;
  before: number;
  after: number;
  icon: React.ReactNode;
}) {
  const diff = after - before;
  const tone =
    diff > 0 ? 'bg-green-50 text-green-600' : diff < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500';

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
          {icon}
        </div>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold text-gray-900">{formatCurrency(after)}</span>
        <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${tone}`}>
          {formatChange(diff)}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-gray-400">was {formatCurrency(before)}</p>
    </div>
  );
}

function CountCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
          {icon}
        </div>
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <p className="mt-1.5 text-sm text-gray-400">{subtitle}</p>
    </div>
  );
}

function CoverageOutcomeCard({
  before,
  after,
}: {
  before?: HealthcareCoverage;
  after?: HealthcareCoverage;
}) {
  if (!before && !after) return null;

  const coverageTypes = ['ESI', 'Medicaid', 'CHIP', 'Marketplace'] as const;
  const hasCoverage = coverageTypes.some((type) => (after?.summary[type]?.length || 0) > 0);

  if (!hasCoverage) {
    return (
      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Coverage After This Change</h3>
        <p className="text-sm text-gray-500">No identified Medicaid, CHIP, marketplace, or employer coverage was returned for this scenario.</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Coverage After This Change</h3>
      <div className="space-y-2">
        {coverageTypes.map((type) => {
          const afterPeople = after?.summary[type] || [];
          const beforePeople = before?.summary[type] || [];

          if (afterPeople.length === 0) return null;

          return (
            <div key={type} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-gray-50">
              <span className="text-base">{getCoverageIcon(type)}</span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-700">{getCoverageLabel(type)}</div>
                <div className="text-sm text-gray-600">
                  {afterPeople.map((person, index) => {
                    const isNew = !beforePeople.includes(person);
                    return (
                      <span key={person}>
                        {index > 0 && ', '}
                        <span className={isNew ? 'text-green-600 font-medium' : ''}>
                          {person}
                          {isNew ? ' (new)' : ''}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CoverageChangesCard({
  before,
  after,
}: {
  before?: HealthcareCoverage;
  after?: HealthcareCoverage;
}) {
  const changes = getCoverageChanges(before, after);

  if (changes.length === 0) return null;

  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Who Changed Coverage</h3>
      <div className="space-y-2">
        {changes.map((change) => (
          <div key={change.label} className="flex items-center justify-between gap-4 py-2 px-3 rounded-lg bg-[#F9FAFB]">
            <span className="text-sm font-medium text-gray-800">{change.label}</span>
            <span className="text-sm text-gray-600 text-right">
              {getCoverageLabel(change.before)}
              <span className="mx-2 text-gray-300">→</span>
              <span className="font-medium text-gray-900">{getCoverageLabel(change.after)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SupportChangesCard({ metrics }: { metrics: BenefitMetric[] }) {
  const supportMetrics = metrics
    .filter((metric) => SUPPORT_METRIC_NAMES.has(metric.name))
    .filter((metric) => metric.before !== 0 || metric.after !== 0);

  if (supportMetrics.length === 0) {
    return (
      <div className="card p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">Healthcare Support Changes</h3>
        <p className="text-sm text-gray-500">No dollar-denominated healthcare support changed in this scenario.</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">Healthcare Support Changes</h3>
      <div className="space-y-3">
        {supportMetrics.map((metric) => {
          const diff = metric.after - metric.before;
          const tone =
            diff > 0 ? 'bg-green-50 text-green-600' : diff < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500';

          return (
            <div key={metric.name} className="rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{metric.label}</h4>
                  <p className="text-xs text-gray-500">Before {formatCurrency(metric.before)} · After {formatCurrency(metric.after)}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${tone}`}>
                  {formatChange(diff)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ResultsView({ result, onReset }: ResultsViewProps) {
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
        <button onClick={onReset} className="btn btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  const metrics = result.before.metrics || [];
  const premiumTaxCredit = metrics.find((metric) => metric.name === 'premium_tax_credit');
  const coverageChanges = getCoverageChanges(result.healthcareBefore, result.healthcareAfter);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          title="Net Income"
          before={result.before.netIncome}
          after={result.after.netIncome}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <SummaryCard
          title="Premium Tax Credit"
          before={premiumTaxCredit?.before || 0}
          after={premiumTaxCredit?.after || 0}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-4.418 0-8 1.79-8 4s3.582 4 8 4 8-1.79 8-4-3.582-4-8-4zm0 0V5m0 11v3" />
            </svg>
          }
        />
        <CountCard
          title="Coverage Changes"
          value={coverageChanges.length}
          subtitle={coverageChanges.length === 1 ? '1 person moved to a new coverage type' : `${coverageChanges.length} people moved to a new coverage type`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5V4H2v16h5m10 0v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6m10 0H7" />
            </svg>
          }
        />
      </div>

      <CoverageOutcomeCard
        before={result.healthcareBefore}
        after={result.healthcareAfter}
      />

      <CoverageChangesCard
        before={result.healthcareBefore}
        after={result.healthcareAfter}
      />

      <SupportChangesCard metrics={metrics} />

      <div className="flex justify-center pt-4">
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
