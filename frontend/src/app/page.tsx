'use client';

import { useState, useEffect, useCallback } from 'react';
import HouseholdForm from '@/components/HouseholdForm';
import LifeEventSelector from '@/components/LifeEventSelector';
import ResultsView from '@/components/ResultsView';
import { Household, LifeEventType, SimulationResult, LIFE_EVENTS } from '@/types';

type Step = 'household' | 'event' | 'results';

// URL encoding/decoding helpers
function encodeScenario(household: Household, event: LifeEventType, params: Record<string, unknown>): string {
  const data = { h: household, e: event, p: params };
  return btoa(JSON.stringify(data));
}

function decodeScenario(encoded: string): { household: Household; event: LifeEventType; params: Record<string, unknown> } | null {
  try {
    const data = JSON.parse(atob(encoded));
    if (data.h && data.e) {
      // Ensure all required household fields have defaults (for backwards compatibility)
      const household: Household = {
        state: data.h.state || 'CA',
        zipCode: data.h.zipCode || undefined,
        filingStatus: data.h.filingStatus || 'single',
        income: data.h.income ?? 50000,
        spouseIncome: data.h.spouseIncome ?? 0,
        spouseAge: data.h.spouseAge ?? 30,
        childAges: data.h.childAges || [],
        age: data.h.age ?? 30,
        hasESI: data.h.hasESI ?? false,
        spouseHasESI: data.h.spouseHasESI ?? false,
        year: data.h.year ?? 2025,
      };
      return { household, event: data.e, params: data.p || {} };
    }
  } catch {
    // Invalid encoding
  }
  return null;
}

const DEFAULT_HOUSEHOLD: Household = {
  state: 'CA',
  filingStatus: 'single',
  income: 50000,
  spouseIncome: 0,
  spouseAge: 30,
  childAges: [],
  age: 30,
  hasESI: false,
  spouseHasESI: false,
  year: 2025,
};

const STEPS = [
  { key: 'household' as const, label: 'Household', number: 1 },
  { key: 'event' as const, label: 'Coverage Change', number: 2 },
  { key: 'results' as const, label: 'Results', number: 3 },
];

export default function Home() {
  const [step, setStep] = useState<Step>('household');
  const [household, setHousehold] = useState<Household>(DEFAULT_HOUSEHOLD);
  const [selectedEvent, setSelectedEvent] = useState<LifeEventType | null>(null);
  const [eventParams, setEventParams] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);

  // Run a single healthcare-focused scenario
  const runSimulation = useCallback(async (
    h: Household,
    event: LifeEventType,
    params: Record<string, unknown>,
  ) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setStep('results');

    try {
      const body: Record<string, unknown> = {
        household: h,
        lifeEvent: { type: event, params },
      };

      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Simulation failed');
      }

      const data = await response.json();

      // Check if API returned an error
      if (data.error) {
        throw new Error(data.error);
      }

      // Validate the response has expected structure
      if (!data.before || !data.after) {
        throw new Error('Invalid response from simulation');
      }

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

  // Check URL for shared scenario on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get('s');
    if (encoded) {
      const scenario = decodeScenario(encoded);
      if (scenario) {
        setHousehold(scenario.household);
        setSelectedEvent(scenario.event);
        setEventParams(scenario.params);
        // Auto-run simulation
        runSimulation(scenario.household, scenario.event, scenario.params);
      }
    }
  }, [runSimulation]);

  const handleSimulate = async () => {
    if (!selectedEvent) return;
    await runSimulation(household, selectedEvent, eventParams);
  };

  const handleShare = async () => {
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      } catch {
        // Fallback for browsers that don't support clipboard API
        const input = document.createElement('input');
        input.value = shareUrl;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      }
    }
  };

  const handleReset = () => {
    setStep('household');
    setSelectedEvent(null);
    setEventParams({});
    setResult(null);
    setError(null);
    setShareUrl(null);
    // Clear URL params
    window.history.replaceState({}, '', window.location.pathname);
  };

  const canProceedToEvent = household.income >= 0;
  const canSimulate = selectedEvent !== null;

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      {step === 'household' && (
        <div className="relative overflow-hidden bg-gradient-to-br from-[#319795] via-[#2C7A7B] to-[#285E61]">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23ffffff%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
          <div className="relative max-w-3xl mx-auto px-6 py-16 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 tracking-tight">
              How does a household change reshape healthcare coverage?
            </h1>
            <p className="text-lg text-white/90 max-w-xl mx-auto leading-relaxed">
              Compare before-and-after coverage, Medicaid and CHIP access, and ACA marketplace support
              for a single scenario using PolicyEngine&apos;s simulation engine.
            </p>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center">
            {STEPS.map((s, i) => {
              const isActive = s.key === step;
              const isCompleted = currentStepIndex > i;
              // Allow navigation: always to step 1, to step 2 if household exists, to step 3 if results exist
              const canNavigate =
                s.key === 'household' ||
                (s.key === 'event' && canProceedToEvent) ||
                (s.key === 'results' && result !== null);

              return (
                <div key={s.key} className="flex items-center">
                  <button
                    onClick={() => canNavigate && !isActive && setStep(s.key)}
                    disabled={!canNavigate}
                    className={`flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-[#319795] text-white shadow-sm'
                        : canNavigate
                        ? 'bg-[#E6FFFA] text-[#285E61] hover:bg-[#B2F5EA] cursor-pointer'
                        : 'bg-[#F2F4F7] text-[#9CA3AF]'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-semibold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : isCompleted
                          ? 'bg-[#319795] text-white'
                          : canNavigate
                          ? 'bg-[#81E6D9] text-[#285E61]'
                          : 'bg-[#E2E8F0] text-[#9CA3AF]'
                      }`}
                    >
                      {isCompleted ? (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        s.number
                      )}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`w-8 sm:w-12 h-0.5 mx-1 sm:mx-2 rounded-full transition-colors ${
                        currentStepIndex > i ? 'bg-[#319795]' : 'bg-[#E2E8F0]'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Step Content */}
        {step === 'household' && (
          <div className="animate-fadeIn">
            <HouseholdForm
              household={household}
              onChange={setHousehold}
              disabled={isLoading}
            />
            <div className="mt-8 flex justify-end">
              <button
                onClick={() => setStep('event')}
                disabled={!canProceedToEvent}
                className="btn btn-primary px-8"
              >
                Continue
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {step === 'event' && (
          <div className="animate-fadeIn">
            <LifeEventSelector
              selectedEvent={selectedEvent}
              onSelect={setSelectedEvent}
              eventParams={eventParams}
              onParamsChange={setEventParams}
              household={household}
              disabled={isLoading}
            />
            <div className="mt-8 flex justify-between">
              <button
                onClick={() => setStep('household')}
                disabled={isLoading}
                className="btn btn-secondary"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <button
                onClick={handleSimulate}
                disabled={!canSimulate || isLoading}
                className="btn btn-primary px-8"
              >
                {isLoading ? (
                  <>
                    <span className="spinner" />
                    Simulating...
                  </>
                ) : (
                  <>
                    See Results
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {step === 'results' && (
          <div className="animate-fadeIn">
            {isLoading ? (
              /* Loading State */
              <div className="card p-8 sm:p-12">
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative mb-6">
                    <div className="w-16 h-16 border-4 border-[#E6FFFA] rounded-full"></div>
                    <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#319795] rounded-full border-t-transparent animate-spin"></div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Running Simulation</h3>
                  <p className="text-gray-500 text-center max-w-sm">
                    Calculating how {LIFE_EVENTS.find(e => e.type === selectedEvent)?.label?.toLowerCase() ?? 'this change'} affects healthcare coverage and support...
                  </p>
                </div>
              </div>
            ) : error ? (
              /* Error State */
              <div className="card p-8 sm:p-12">
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Simulation Failed</h3>
                  <p className="text-gray-500 text-center max-w-sm mb-6">
                    {error}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setStep('event')}
                      className="btn btn-secondary"
                    >
                      Back to Coverage Change
                    </button>
                    <button
                      onClick={handleSimulate}
                      className="btn btn-primary"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            ) : result ? (
              <>
                {/* Scenario Summary */}
                <div className="mb-8 p-5 bg-[#E6FFFA] rounded-xl border border-[#319795]/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Your Scenario</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setStep('household')}
                        className="text-sm text-[#285E61] hover:text-[#319795] font-medium"
                      >
                        Edit Household
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => setStep('event')}
                        className="text-sm text-[#285E61] hover:text-[#319795] font-medium"
                      >
                        Change Event
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={handleShare}
                        className="text-sm text-[#285E61] hover:text-[#319795] font-medium inline-flex items-center gap-1"
                      >
                        {showCopied ? (
                          <>
                            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            Share
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">State</span>
                      <p className="font-medium text-gray-900">
                        {selectedEvent === 'moving_states' && eventParams.newState
                          ? `${household.state} → ${eventParams.newState}`
                          : household.state}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Coverage Year</span>
                      <p className="font-medium text-gray-900">
                        {household.year || 2025}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Filing Status</span>
                      <p className="font-medium text-gray-900 capitalize">
                        {household.filingStatus.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500">Coverage Change</span>
                      <p className="font-medium text-gray-900 capitalize">
                        {selectedEvent?.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mt-3 pt-3 border-t border-[#319795]/10">
                    <div>
                      <span className="text-gray-500">Your Income</span>
                      <p className="font-medium text-gray-900">
                        {selectedEvent === 'changing_income' && eventParams.newIncome !== undefined
                          ? `$${household.income.toLocaleString()} → $${(eventParams.newIncome as number).toLocaleString()}`
                          : `$${household.income.toLocaleString()}`}
                      </p>
                    </div>
                    {(household.filingStatus === 'married_jointly' || household.filingStatus === 'married_separately') && (
                      <div>
                        <span className="text-gray-500">Partner Income</span>
                        <p className="font-medium text-gray-900">
                          {selectedEvent === 'changing_income' && eventParams.newSpouseIncome !== undefined
                            ? `$${(household.spouseIncome ?? 0).toLocaleString()} → $${(eventParams.newSpouseIncome as number).toLocaleString()}`
                            : `$${(household.spouseIncome ?? 0).toLocaleString()}`}
                        </p>
                      </div>
                    )}
                    {household.childAges.length > 0 && (
                      <div>
                        <span className="text-gray-500">Children</span>
                        <p className="font-medium text-gray-900">
                          {household.childAges.length} (ages {household.childAges.join(', ')})
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <ResultsView result={result} eventType={selectedEvent ?? undefined} onReset={handleReset} />
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-auto py-10 text-center">
        <p className="text-sm text-gray-500">
          Powered by{' '}
          <a
            href="https://policyengine.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#319795] hover:text-[#285E61] font-medium transition-colors"
          >
            PolicyEngine
          </a>
        </p>
      </footer>
    </div>
  );
}
