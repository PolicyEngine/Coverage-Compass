'use client';

import { useState, useEffect, useCallback } from 'react';
import InputStrip from '@/components/InputStrip';
import ResultsView from '@/components/ResultsView';
import { Household, LifeEventType, SimulationResult, LIFE_EVENTS } from '@/types';

function encodeScenario(household: Household, event: LifeEventType, params: Record<string, unknown>): string {
  return btoa(JSON.stringify({ h: household, e: event, p: params }));
}

function decodeScenario(encoded: string): { household: Household; event: LifeEventType; params: Record<string, unknown> } | null {
  try {
    const data = JSON.parse(atob(encoded));
    if (data.h && data.e) {
      const household: Household = {
        state: data.h.state || 'CA',
        zipCode: data.h.zipCode || undefined,
        filingStatus: data.h.filingStatus || 'single',
        income: data.h.income ?? 60000,
        spouseIncome: data.h.spouseIncome ?? 0,
        spouseAge: data.h.spouseAge ?? 30,
        childAges: data.h.childAges || [],
        age: data.h.age ?? 30,
        hasESI: data.h.hasESI ?? false,
        spouseHasESI: data.h.spouseHasESI ?? false,
        year: data.h.year ?? 2026,
      };
      return { household, event: data.e, params: data.p || {} };
    }
  } catch { /* invalid */ }
  return null;
}

const DEFAULT_HOUSEHOLD: Household = {
  state: 'CA',
  filingStatus: 'single',
  income: 60000,
  spouseIncome: 0,
  spouseAge: 30,
  childAges: [],
  age: 30,
  hasESI: false,
  spouseHasESI: false,
  year: 2026,
};

export default function Home() {
  const [household, setHousehold] = useState<Household>(DEFAULT_HOUSEHOLD);
  const [selectedEvent, setSelectedEvent] = useState<LifeEventType | null>(null);
  const [eventParams, setEventParams] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);

  const runSimulation = useCallback(async (
    h: Household,
    event: LifeEventType,
    params: Record<string, unknown>,
  ) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household: h, lifeEvent: { type: event, params } }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (!data.before || !data.after) throw new Error('Invalid response from simulation');
      setResult(data);
      const encoded = encodeScenario(h, event, params);
      const url = `${window.location.origin}?s=${encoded}`;
      setShareUrl(url);
      window.history.replaceState({}, '', `?s=${encoded}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('s');
    if (encoded) {
      const scenario = decodeScenario(encoded);
      if (scenario) {
        setHousehold(scenario.household);
        setSelectedEvent(scenario.event);
        setEventParams(scenario.params);
        runSimulation(scenario.household, scenario.event, scenario.params);
      }
    }
  }, [runSimulation]);

  const handleRun = () => {
    if (selectedEvent) runSimulation(household, selectedEvent, eventParams);
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleReset = () => {
    setSelectedEvent(null);
    setEventParams({});
    setResult(null);
    setError(null);
    setShareUrl(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const canRun = selectedEvent !== null;
  const eventLabel = LIFE_EVENTS.find(e => e.type === selectedEvent)?.label;

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      <div className="max-w-[1100px] mx-auto px-6 pb-16">

        {/* Hero card */}
        <div className="bg-white border border-gray-200 rounded-xl p-7 shadow-sm mb-4 mt-6">
          {result && selectedEvent ? (
            <>
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase text-[#285E61] bg-[#E6FFFA] px-3 py-1.5 rounded-full mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#319795]" />
                {LIFE_EVENTS.find(e => e.type === selectedEvent)?.label ?? selectedEvent}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
                {getHeroHeadline(selectedEvent, result)}
              </h1>
              <p className="text-[15px] text-gray-500 leading-relaxed">
                {household.state}{household.zipCode ? ` · ${household.zipCode}` : ''} ·{' '}
                {household.filingStatus === 'married_jointly' || household.filingStatus === 'married_separately'
                  ? `Married · ${household.age} & ${household.spouseAge}`
                  : `Single · age ${household.age}`} ·{' '}
                ${Math.round(household.income / 12).toLocaleString()}/mo income
              </p>
              <div className="flex gap-5 flex-wrap mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                <span>Year: <b className="text-gray-900">{household.year}</b></span>
                <span>Model: <b className="text-gray-900">PolicyEngine US</b></span>
                <button onClick={handleShare} className="ml-auto text-[#319795] hover:text-[#285E61] font-medium flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  {showCopied ? 'Copied!' : 'Share'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase text-[#285E61] bg-[#E6FFFA] px-3 py-1.5 rounded-full mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-[#319795]" />
                New briefing
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
                See how a life event changes your healthcare coverage and costs.
              </h1>
              <p className="text-[15px] text-gray-500 leading-relaxed max-w-2xl">
                Fill in your household below, pick a coverage change, and hit Run — we&apos;ll model it with PolicyEngine and give you the numbers.
              </p>
            </>
          )}
        </div>

        {/* Input strip */}
        <InputStrip
          household={household}
          onHouseholdChange={setHousehold}
          selectedEvent={selectedEvent}
          onEventSelect={(e) => { setSelectedEvent(e); setEventParams({}); }}
          eventParams={eventParams}
          onParamsChange={setEventParams}
          onRun={handleRun}
          isLoading={isLoading}
          canRun={canRun}
        />

        {/* Results area */}
        {isLoading && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 shadow-sm flex flex-col items-center justify-center">
            <div className="relative mb-6">
              <div className="w-14 h-14 border-4 border-[#E6FFFA] rounded-full" />
              <div className="absolute inset-0 w-14 h-14 border-4 border-[#319795] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-gray-500 text-center">
              Calculating how {eventLabel?.toLowerCase() ?? 'this change'} affects coverage…
            </p>
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center">
            <p className="text-red-600 font-medium mb-1">Simulation failed</p>
            <p className="text-gray-500 text-sm mb-4">{error}</p>
            <button onClick={handleRun} disabled={!canRun} className="text-sm text-[#319795] hover:text-[#285E61] font-medium">
              Try again →
            </button>
          </div>
        )}

        {!isLoading && !error && result && selectedEvent && (
          <ResultsView result={result} eventType={selectedEvent} onReset={handleReset} />
        )}

        {!isLoading && !error && !result && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['Headline impact', 'What changed', 'Analyst note'].map((title) => (
              <div key={title} className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm overflow-hidden relative">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">{title}</p>
                <div className="space-y-2">
                  <div className="h-2.5 bg-gray-100 rounded w-2/5" />
                  <div className="h-9 bg-gray-100 rounded w-3/5" />
                  <div className="h-2.5 bg-gray-100 rounded w-4/5" />
                  <div className="h-2.5 bg-gray-100 rounded w-3/5 mt-1" />
                </div>
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white" />
              </div>
            ))}
          </div>
        )}

        <footer className="mt-10 flex justify-between text-xs text-gray-400">
          <span>Powered by <a href="https://policyengine.org" target="_blank" rel="noopener noreferrer" className="text-[#319795] font-medium">PolicyEngine</a></span>
          <span>Estimates · not legal or financial advice</span>
        </footer>
      </div>
    </div>
  );
}

function getHeroHeadline(eventType: LifeEventType, result: SimulationResult): string {
  const anyMedicaidAfter = (result.healthcareAfter?.people ?? []).some(p => p.coverage === 'Medicaid');
  const anyMedicaidBefore = (result.healthcareBefore?.people ?? []).some(p => p.coverage === 'Medicaid');
  const metrics = result.before.metrics ?? [];
  const ptcAfter = metrics.find(m => m.name === 'premium_tax_credit')?.after ?? 0;
  const ptcBefore = metrics.find(m => m.name === 'premium_tax_credit')?.before ?? 0;
  const netChangeMo = result.diff.netIncome / 12;

  switch (eventType) {
    case 'losing_esi':
      if (anyMedicaidAfter) return 'Losing job coverage qualifies you for Medicaid.';
      if (ptcAfter > 0) return 'Losing job coverage makes you eligible for ACA marketplace subsidies.';
      return 'Losing job coverage opens a marketplace enrollment window.';

    case 'having_baby':
      if (anyMedicaidAfter && !anyMedicaidBefore) return 'Being pregnant triggers Medicaid eligibility.';
      if (anyMedicaidAfter) return 'Pregnancy strengthens your Medicaid eligibility.';
      return 'Being pregnant shifts your household eligibility thresholds.';

    case 'getting_married':
      if (ptcBefore > 0 && ptcAfter === 0) return 'Getting married pushes you over the ACA subsidy cliff.';
      if (anyMedicaidAfter && !anyMedicaidBefore) return 'Getting married qualifies your household for Medicaid.';
      if (!anyMedicaidAfter && anyMedicaidBefore) return 'Getting married moves your household out of Medicaid.';
      if (netChangeMo > 100) return 'Getting married improves your household\'s net financial picture.';
      return 'Getting married changes your coverage and eligibility picture.';

    case 'divorce':
      if (anyMedicaidAfter && !anyMedicaidBefore) return 'Separating qualifies you for Medicaid as a single filer.';
      if (ptcAfter > 0 && ptcBefore === 0) return 'Separating makes you eligible for ACA marketplace subsidies.';
      return 'Separating changes your coverage options as a single filer.';

    case 'moving_states':
      if (anyMedicaidAfter && !anyMedicaidBefore) return 'Your new state\'s Medicaid rules cover your income.';
      if (!anyMedicaidAfter && anyMedicaidBefore) return 'Your new state has stricter Medicaid rules.';
      return 'Moving states changes which programs and premiums apply.';

    case 'changing_income':
      if (anyMedicaidAfter && !anyMedicaidBefore) return 'Your new income qualifies you for Medicaid.';
      if (!anyMedicaidAfter && anyMedicaidBefore) return 'Your new income moves you out of Medicaid.';
      if (ptcBefore > 0 && ptcAfter === 0) return 'Your new income crosses the ACA subsidy threshold.';
      if (netChangeMo > 50) return 'Your higher income improves your net financial picture.';
      if (netChangeMo < -50) return 'Your lower income affects your coverage and benefit eligibility.';
      return 'Your new income shifts your coverage and eligibility.';
  }
}
