'use client';

import { useState, useEffect, useCallback } from 'react';
import HouseholdWizard from '@/components/HouseholdWizard';
import ChangeWizard from '@/components/ChangeWizard';
import ResultsView from '@/components/ResultsView';
import { Household, LifeEventType, SimulationResult, LIFE_EVENTS } from '@/types';

interface SavedScenario {
  id: string;
  event: LifeEventType;
  params: Record<string, unknown>;
  result: SimulationResult;
}

function newScenarioId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);

  const result = scenarios.find((s) => s.id === currentScenarioId)?.result ?? null;
  const otherScenarios = scenarios.filter((s) => s.id !== currentScenarioId);

  // Fire a no-op /api/baseline request when the wizard completes. This
  // doesn't return useful data anymore, but it warms the Modal container
  // so the subsequent /api/simulate call on Apply doesn't pay a cold start.
  const warmBackend = useCallback(async (h: Household) => {
    try {
      await fetch('/api/baseline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ household: h }),
      });
    } catch {
      // Best-effort warm-up; ignore failures.
    }
  }, []);

  const runSimulation = useCallback(async (
    h: Household,
    event: LifeEventType,
    params: Record<string, unknown>,
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          household: h,
          lifeEvent: { type: event, params },
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (!data.before || !data.after) throw new Error('Invalid response from simulation');
      const id = newScenarioId();
      setScenarios((prev) => [...prev, { id, event, params, result: data }]);
      setCurrentScenarioId(id);
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

  const restoreScenario = useCallback((s: SavedScenario, h: Household) => {
    setCurrentScenarioId(s.id);
    setSelectedEvent(s.event);
    setEventParams(s.params);
    setError(null);
    const encoded = encodeScenario(h, s.event, s.params);
    setShareUrl(`${window.location.origin}?s=${encoded}`);
    window.history.replaceState({}, '', `?s=${encoded}`);
  }, []);

  const removeScenario = useCallback((id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    setCurrentScenarioId((curr) => (curr === id ? null : curr));
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
    setScenarios([]);
    setCurrentScenarioId(null);
    setError(null);
    // Warm the Modal container in the background so the Apply spinner is
    // shorter (avoids paying a cold start on the /api/simulate call).
    warmBackend(h);
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

  const handleTryAnother = () => {
    // Keep household + scenario history. Clear the active event/result so
    // the user can model a new what-if.
    setSelectedEvent(null);
    setEventParams({});
    setCurrentScenarioId(null);
    setError(null);
    setShareUrl(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleReset = () => {
    setHousehold(null);
    setSelectedEvent(null);
    setEventParams({});
    setScenarios([]);
    setCurrentScenarioId(null);
    setError(null);
    setShareUrl(null);
    window.history.replaceState({}, '', window.location.pathname);
  };

  const eventLabel = LIFE_EVENTS.find(e => e.type === selectedEvent)?.label;

  return (
    <div className="min-h-screen bg-[#F1F5F9]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 pb-16">

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
              {describeScenario(selectedEvent, eventParams, household) && (
                <p className="mt-2 text-sm text-gray-700">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mr-2">What changed</span>
                  {describeScenario(selectedEvent, eventParams, household)}
                </p>
              )}
              <div className="flex gap-5 flex-wrap mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
                <span>Year: <b className="text-gray-900">{household.year}</b></span>
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
                    Tap any field below (<b className="text-gray-700">income</b>, <b className="text-gray-700">filing status</b>, <b className="text-gray-700">location</b>, <b className="text-gray-700">job coverage</b>, or <b className="text-gray-700">children</b>) to see how it changes your healthcare picture.
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

        {/* Wizard (no household yet) */}
        {!household && (
          <>
            <PartialSummary partial={partialHousehold} />
            <HouseholdWizard
              onComplete={handleWizardComplete}
              onPartialChange={setPartialHousehold}
            />
          </>
        )}

        {/* Household entered: show change wizard until results are ready */}
        {household && !isLoading && !result && (
          <ChangeWizard
            household={household}
            onApply={(event, params) => {
              setSelectedEvent(event);
              setEventParams(params);
              runSimulation(household, event, params);
            }}
            onReset={handleReset}
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
            <ResultsView result={result} eventType={selectedEvent} onTryAnother={handleTryAnother} onReset={handleReset} />
          </div>
        )}

        {/* Saved scenarios: older results from this household */}
        {household && otherScenarios.length > 0 && (
          <div className="mt-6">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2 px-1">
              Compared scenarios
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {otherScenarios.map((s) => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  onClick={() => restoreScenario(s, household)}
                  onRemove={() => removeScenario(s.id)}
                />
              ))}
            </div>
          </div>
        )}

        <footer className="mt-10 text-xs text-gray-400">
          <span>Powered by <a href="https://policyengine.org" target="_blank" rel="noopener noreferrer" className="text-[#319795] font-medium">PolicyEngine</a></span>
        </footer>
      </div>
    </div>
  );
}

function PartialSummary({ partial }: { partial: Partial<Household> }) {
  const items: { label: string; value: string }[] = [];
  if (partial.state) {
    items.push({
      label: 'Location',
      value: `${partial.state}${partial.zipCode ? ' · ' + partial.zipCode : ''}`,
    });
  }
  if (partial.filingStatus) {
    const married =
      partial.filingStatus === 'married_jointly' || partial.filingStatus === 'married_separately';
    items.push({ label: 'Status', value: married ? 'Married' : 'Single' });
  }
  if (partial.age && partial.age > 0) {
    const married =
      partial.filingStatus === 'married_jointly' || partial.filingStatus === 'married_separately';
    items.push({
      label: 'Age',
      value:
        married && partial.spouseAge
          ? `${partial.age} & ${partial.spouseAge}`
          : `${partial.age}`,
    });
  }
  if (partial.income !== undefined && partial.income > 0) {
    const married =
      partial.filingStatus === 'married_jointly' || partial.filingStatus === 'married_separately';
    const yours = `$${Math.round(partial.income / 12).toLocaleString()}/mo`;
    const partner =
      married && partial.spouseIncome !== undefined && partial.spouseIncome > 0
        ? ` & $${Math.round(partial.spouseIncome / 12).toLocaleString()}/mo`
        : '';
    items.push({ label: 'Income', value: yours + partner });
  }
  if (partial.hasESI !== undefined || partial.spouseHasESI !== undefined) {
    const married =
      partial.filingStatus === 'married_jointly' || partial.filingStatus === 'married_separately';
    let value: string;
    if (!married) {
      value = partial.hasESI ? 'Yes' : 'No';
    } else if (partial.hasESI && partial.spouseHasESI) {
      value = 'Both';
    } else if (partial.hasESI) {
      value = 'You only';
    } else if (partial.spouseHasESI) {
      value = 'Partner only';
    } else {
      value = 'Neither';
    }
    items.push({ label: 'Job coverage', value });
  }
  if (partial.childAges && partial.childAges.length > 0) {
    items.push({
      label: 'Children',
      value: `${partial.childAges.length} (ages ${partial.childAges.join(', ')})`,
    });
  }

  if (items.length === 0) return null;

  return (
    <div className="mb-4 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
        So far
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {items.map((item) => (
          <div key={item.label}>
            <div className="text-[10px] uppercase tracking-wider text-gray-400">{item.label}</div>
            <div className="text-sm font-semibold text-gray-900">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ScenarioCardProps {
  scenario: SavedScenario;
  onClick: () => void;
  onRemove: () => void;
}

function ScenarioCard({ scenario, onClick, onRemove }: ScenarioCardProps) {
  const label = LIFE_EVENTS.find((e) => e.type === scenario.event)?.label ?? scenario.event;
  // Use silver net premium from acaPremiums (annual) so the delta matches the
  // hero number on the result page. Falls back to 0 when ACA isn't in play.
  const netBefore = scenario.result.acaPremiums?.before?.silverNet ?? 0;
  const netAfter = scenario.result.acaPremiums?.after?.silverNet ?? 0;
  const monthlyDelta = (netAfter - netBefore) / 12;
  const isCost = monthlyDelta > 0.5;
  const isSavings = monthlyDelta < -0.5;
  const tone = isCost ? 'text-red-600' : isSavings ? 'text-green-600' : 'text-gray-500';
  const sign = isCost ? '+' : isSavings ? '−' : '';
  const amount = `$${Math.abs(Math.round(monthlyDelta)).toLocaleString()}`;
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left bg-white border border-gray-200 hover:border-[#319795] hover:shadow-sm rounded-xl p-3 pr-8 transition-all"
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[#285E61] mb-1">
          {label}
        </div>
        <div className={`text-base font-semibold tabular-nums ${tone}`}>
          {monthlyDelta === 0 ? 'No monthly change' : `${sign}${amount}/mo`}
        </div>
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        aria-label="Remove scenario"
        className="absolute top-2 right-2 p-1 text-gray-300 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors opacity-0 group-hover:opacity-100"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// One-liner describing what the user actually entered for the scenario
// (so the result page reflects "what changed", not just the original
// household state).
function describeScenario(
  eventType: LifeEventType,
  params: Record<string, unknown>,
  household: Household,
): string | null {
  const fmt = (annual: number) => `$${Math.round(annual / 12).toLocaleString()}/mo`;
  const married =
    household.filingStatus === 'married_jointly' || household.filingStatus === 'married_separately';

  switch (eventType) {
    case 'changing_income': {
      const newIncome = (params.newIncome as number) ?? household.income;
      const newSpouseIncome = (params.newSpouseIncome as number) ?? household.spouseIncome;
      const yourPart = `${fmt(household.income)} → ${fmt(newIncome)}`;
      if (married) {
        return `Income ${yourPart}; partner ${fmt(household.spouseIncome)} → ${fmt(newSpouseIncome)}`;
      }
      return `Income ${yourPart}`;
    }
    case 'moving_states': {
      const newState = (params.newState as string) ?? household.state;
      const newZip = (params.newZipCode as string) ?? '';
      const before = `${household.state}${household.zipCode ? ' · ' + household.zipCode : ''}`;
      const after = `${newState}${newZip ? ' · ' + newZip : ''}`;
      return `Location ${before} → ${after}`;
    }
    case 'getting_married': {
      const spouseAge = params.spouseAge as number | undefined;
      const spouseIncome = params.spouseIncome as number | undefined;
      const spouseChildAges = (params.spouseChildAges as number[] | undefined) ?? [];
      const parts = [];
      if (spouseAge) parts.push(`age ${spouseAge}`);
      if (spouseIncome !== undefined) parts.push(`${fmt(spouseIncome)} income`);
      if (spouseChildAges.length > 0) parts.push(`${spouseChildAges.length} child${spouseChildAges.length > 1 ? 'ren' : ''}`);
      return parts.length > 0 ? `Adding partner: ${parts.join(', ')}` : 'Adding a partner';
    }
    case 'divorce': {
      const childrenKeeping = params.childrenKeeping as number | undefined;
      if (household.childAges.length > 0 && childrenKeeping !== undefined) {
        const leaving = household.childAges.length - childrenKeeping;
        return `Separating, keeping ${childrenKeeping} of ${household.childAges.length} child${household.childAges.length > 1 ? 'ren' : ''}${leaving > 0 ? ` (${leaving} with partner)` : ''}`;
      }
      return 'Separating from partner';
    }
    case 'losing_esi':
      return 'Job-based coverage ending';
    case 'having_baby': {
      const idx = (params.pregnantMemberIndex as number) ?? 0;
      if (married) return idx === 1 ? 'Partner becomes pregnant' : 'You become pregnant';
      return 'You become pregnant';
    }
    case 'ending_pregnancy':
      return 'Pregnancy ends';
    default:
      return null;
  }
}

// Build the hero headline strictly from observable transitions in the
// simulation result so the copy can't contradict the table beneath it.
function getHeroHeadline(eventType: LifeEventType, result: SimulationResult): string {
  const beforePeople = result.healthcareBefore?.people ?? [];
  const afterPeople = result.healthcareAfter?.people ?? [];
  const head = (label: string) => label === 'You';

  // Per-person transitions for the head of household.
  const headBefore = beforePeople.find((p) => head(p.label))?.coverage ?? null;
  const headAfter = afterPeople.find((p) => head(p.label))?.coverage ?? null;

  // Household-level transitions (any person).
  const anyMedicaidBefore = beforePeople.some((p) => p.coverage === 'Medicaid');
  const anyMedicaidAfter = afterPeople.some((p) => p.coverage === 'Medicaid');
  const anyMarketplaceBefore = beforePeople.some((p) => p.coverage === 'Marketplace');
  const anyMarketplaceAfter = afterPeople.some((p) => p.coverage === 'Marketplace');

  // Metric-level transitions.
  const metrics = result.before.metrics ?? [];
  const ptcAfter = metrics.find((m) => m.name === 'premium_tax_credit')?.after ?? 0;
  const ptcBefore = metrics.find((m) => m.name === 'premium_tax_credit')?.before ?? 0;
  const lostPTC = ptcBefore > 0 && ptcAfter === 0;
  const gainedPTC = ptcAfter > 0 && ptcBefore === 0;

  // Verb describing the event in present tense.
  const verbs: Record<LifeEventType, string> = {
    losing_esi: 'Losing job-based coverage',
    having_baby: 'Pregnancy',
    ending_pregnancy: 'Ending pregnancy',
    getting_married: 'Getting married',
    divorce: 'Divorce',
    moving_states: 'Moving',
    changing_income: 'Your new income',
  };
  const subject = verbs[eventType];

  // Salient transition takes priority over generic copy.
  if (!anyMedicaidBefore && anyMedicaidAfter) return `${subject} qualifies you for Medicaid.`;
  if (anyMedicaidBefore && !anyMedicaidAfter) return `${subject} moves you out of Medicaid.`;
  if (lostPTC) return `${subject} ends your ACA tax credit.`;
  if (gainedPTC) return `${subject} qualifies you for an ACA tax credit.`;
  if (headBefore === 'ESI' && headAfter !== 'ESI') return `${subject} ends your employer health insurance.`;
  if (headBefore !== 'ESI' && headAfter === 'ESI') return `${subject} starts employer health insurance.`;
  if (!anyMarketplaceBefore && anyMarketplaceAfter) return `${subject} moves you onto the ACA marketplace.`;
  if (anyMarketplaceBefore && !anyMarketplaceAfter) return `${subject} moves you off the ACA marketplace.`;

  // Fallback when no salient transition: describe the change without overpromising.
  return `${subject} changes your coverage picture.`;
}
