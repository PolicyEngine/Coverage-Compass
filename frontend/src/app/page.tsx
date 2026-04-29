'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import HouseholdWizard from '@/components/HouseholdWizard';
import InputStrip from '@/components/InputStrip';
import ResultsView from '@/components/ResultsView';
import { Household, LifeEventType, SimulationResult, LIFE_EVENTS } from '@/types';

interface CachedBaseline {
  householdHash: string;
  metrics?: unknown;
  netIncome?: number;
  healthcareBefore?: unknown;
  acaPremiums?: { before?: unknown };
}

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

export default function Home() {
  const [household, setHousehold] = useState<Household | null>(null);
  const [partialHousehold, setPartialHousehold] = useState<Partial<Household>>({});
  const [selectedEvent, setSelectedEvent] = useState<LifeEventType | null>(null);
  const [eventParams, setEventParams] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);

  // Pre-warmed baseline cache. Populated by /api/baseline during the user's
  // "thinking time" between wizard completion and Apply, then sent with the
  // simulate request so the server can skip the before-sim.
  const baselineCacheRef = useRef<CachedBaseline | null>(null);
  const baselineHouseholdRef = useRef<Household | null>(null);

  const prewarmBaseline = useCallback(async (h: Household) => {
    baselineCacheRef.current = null;
    baselineHouseholdRef.current = h;
    try {
      const response = await fetch('/api/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household: h }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.householdHash && baselineHouseholdRef.current === h) {
        baselineCacheRef.current = data as CachedBaseline;
      }
    } catch {
      // Pre-warm is opportunistic; ignore failures and fall back to full sim.
    }
  }, []);

  const runSimulation = useCallback(async (
    h: Household,
    event: LifeEventType,
    params: Record<string, unknown>,
  ) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const cachedBefore =
        baselineCacheRef.current && baselineHouseholdRef.current === h
          ? baselineCacheRef.current
          : undefined;
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household: h,
          lifeEvent: { type: event, params },
          ...(cachedBefore ? { cachedBefore } : {}),
        }),
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

  const handleWizardComplete = (h: Household) => {
    setHousehold(h);
    setSelectedEvent(null);
    setEventParams({});
    setResult(null);
    setError(null);
    // Pre-warm the baseline simulation in the background while the user
    // picks a life event. By the time they click Apply, only the after-sim
    // is needed.
    prewarmBaseline(h);
  };

  const handleRun = () => {
    if (household && selectedEvent) {
      runSimulation(household, selectedEvent, eventParams);
    }
  };

  const handleShare = async () => {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); } catch {
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
    setHousehold(null);
    setSelectedEvent(null);
    setEventParams({});
    setResult(null);
    setError(null);
    setShareUrl(null);
    baselineCacheRef.current = null;
    baselineHouseholdRef.current = null;
    window.history.replaceState({}, '', window.location.pathname);
  };

  const eventLabel = LIFE_EVENTS.find(e => e.type === selectedEvent)?.label;

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      <div className="max-w-[1100px] mx-auto px-6 pb-16">

        {/* Hero card */}
        <div className="bg-white border border-gray-200 rounded-xl p-7 shadow-sm mb-4 mt-6">
          {result && selectedEvent && household ? (
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
          ) : household ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-widest uppercase text-[#285E61] bg-[#E6FFFA] px-3 py-1.5 rounded-full mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#319795]" />
                    Your household
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
                    What if something changed?
                  </h1>
                  <p className="text-[15px] text-gray-500 leading-relaxed">
                    Tap any field below — <b className="text-gray-700">income</b>, <b className="text-gray-700">filing status</b>, <b className="text-gray-700">location</b>, <b className="text-gray-700">job coverage</b>, or <b className="text-gray-700">children</b> — to see how it changes your healthcare picture.
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  className="shrink-0 text-sm text-gray-400 hover:text-gray-600 transition-colors mt-1"
                >
                  Start over
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
                Tell us about your household and we&apos;ll model it with PolicyEngine.
              </p>
            </>
          )}
        </div>

        {/* Preview strip during wizard — non-interactive */}
        {!household && Object.keys(partialHousehold).length > 0 && (
          <div className="pointer-events-none opacity-60 mb-4">
            <InputStrip
              household={{ state: 'CA', filingStatus: 'single', income: 0, spouseIncome: 0, spouseAge: 30, childAges: [], age: 30, hasESI: false, spouseHasESI: false, year: 2026, ...partialHousehold } as Household}
              selectedEvent={null}
              onEventSelect={() => {}}
              eventParams={{}}
              onParamsChange={() => {}}
              onRun={() => {}}
              isLoading={false}
              canRun={false}
            />
          </div>
        )}

        {/* Wizard (no household yet) */}
        {!household && (
          <HouseholdWizard
            onComplete={handleWizardComplete}
            onPartialChange={setPartialHousehold}
          />
        )}

        {/* Household entered — show input strip */}
        {household && (
          <InputStrip
            household={household}
            onEditHousehold={handleReset}
            selectedEvent={selectedEvent}
            onEventSelect={(e) => { setSelectedEvent(e); setResult(null); }}
            eventParams={eventParams}
            onParamsChange={setEventParams}
            onRun={handleRun}
            isLoading={isLoading}
            canRun={selectedEvent !== null}
          />
        )}

        {/* Loading */}
        {isLoading && (
          <div className="mt-4 bg-white border border-gray-200 rounded-xl p-12 shadow-sm flex flex-col items-center justify-center">
            <div className="relative mb-6">
              <div className="w-14 h-14 border-4 border-[#E6FFFA] rounded-full" />
              <div className="absolute inset-0 w-14 h-14 border-4 border-[#319795] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-gray-500 text-center">
              Calculating how {eventLabel?.toLowerCase() ?? 'this change'} affects coverage…
            </p>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="mt-4 bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center">
            <p className="text-red-600 font-medium mb-1">Simulation failed</p>
            <p className="text-gray-500 text-sm mb-4">{error}</p>
            <button onClick={handleRun} disabled={!selectedEvent} className="text-sm text-[#319795] hover:text-[#285E61] font-medium">
              Try again →
            </button>
          </div>
        )}

        {/* Results */}
        {!isLoading && !error && result && selectedEvent && (
          <div className="mt-4">
            <ResultsView result={result} eventType={selectedEvent} onReset={handleReset} />
          </div>
        )}

        <footer className="mt-10 text-xs text-gray-400">
          <span>Powered by <a href="https://policyengine.org" target="_blank" rel="noopener noreferrer" className="text-[#319795] font-medium">PolicyEngine</a></span>
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
      return 'Your new income shifts your coverage and eligibility.';
    case 'ending_pregnancy':
      if (anyMedicaidBefore && !anyMedicaidAfter) return 'Ending pregnancy ends your Medicaid pregnancy coverage.';
      if (ptcAfter > 0) return 'After pregnancy, ACA marketplace coverage applies.';
      return 'Coverage shifts once pregnancy ends.';
  }
}
