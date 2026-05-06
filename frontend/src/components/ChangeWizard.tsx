'use client';

import { useState } from 'react';
import { Household, LifeEventType, US_STATES, getStateFromZip } from '@/types';

interface ChangeWizardProps {
  household: Household;
  onApply: (event: LifeEventType, params: Record<string, unknown>) => void;
  onReset: () => void;
}

interface EventOption {
  type: LifeEventType;
  label: string;
  description: string;
}

function isMarried(h: Household) {
  return h.filingStatus === 'married_jointly' || h.filingStatus === 'married_separately';
}

function getAvailableEvents(h: Household): EventOption[] {
  const events: EventOption[] = [
    {
      type: 'changing_income',
      label: 'Income change',
      description: 'A raise, a job loss, going part-time, or starting self-employment.',
    },
    {
      type: 'moving_states',
      label: 'Move',
      description: 'Compare coverage rules and premiums in a different state or area.',
    },
  ];

  // Marriage and divorce events are temporarily hidden from the picker.
  // The simulation logic still works (counterfactual sims for the
  // partner-side household) — re-enable here when ready to re-launch.
  // if (isMarried(h)) events.push({ type: 'divorce', label: 'Divorce or separation', description: 'Split into separate households.' });
  // else events.push({ type: 'getting_married', label: 'Getting married', description: 'Combine households with a partner.' });

  if (h.hasESI || h.spouseHasESI) {
    events.push({
      type: 'losing_esi',
      label: 'Losing job-based coverage',
      description: 'Employer health insurance ends.',
    });
  }

  if (!h.pregnantMember) {
    events.push({
      type: 'having_baby',
      label: 'Becoming pregnant',
      description: 'Pregnancy expands Medicaid eligibility.',
    });
  } else {
    events.push({
      type: 'ending_pregnancy',
      label: 'No longer pregnant',
      description: 'Pregnancy-based Medicaid coverage ends.',
    });
  }

  return events;
}

// ─── Common form helpers ──────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5">{children}</div>;
}

function MoneyInput({ value, onChange, autoFocus = false }: { value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#319795]/30 focus-within:border-[#319795]">
      <span className="px-3 text-gray-400 text-sm bg-gray-50 border-r border-gray-200 py-2.5">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        autoFocus={autoFocus}
        className="flex-1 text-base px-3 py-2.5 focus:outline-none"
      />
      <span className="px-3 text-gray-400 text-xs bg-gray-50 border-l border-gray-200 py-2.5">/mo</span>
    </div>
  );
}

function inputClass() {
  return 'w-full text-base border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChangeWizard({ household, onApply, onReset }: ChangeWizardProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [eventType, setEventType] = useState<LifeEventType | null>(null);

  // Event-specific state (over-allocated; only the relevant fields per event are used)
  const married = isMarried(household);

  // changing_income
  const [yourIncomeMo, setYourIncomeMo] = useState(String(Math.round(household.income / 12)));
  const [partnerIncomeMo, setPartnerIncomeMo] = useState(String(Math.round(household.spouseIncome / 12)));

  // moving_states
  const [newState, setNewState] = useState('');
  const [newZip, setNewZip] = useState('');

  // getting_married
  const [spouseAge, setSpouseAge] = useState('');
  const [spouseIncomeMo, setSpouseIncomeMo] = useState('');
  const [spouseHasESI, setSpouseHasESI] = useState(false);
  const [spouseChildAges, setSpouseChildAges] = useState<Array<number | ''>>([]);

  // divorce
  const [esiProvider, setEsiProvider] = useState<'yours' | 'spouse' | 'both'>('both');
  const [childrenKeeping, setChildrenKeeping] = useState(household.childAges.length);

  // having_baby / ending_pregnancy
  const [pregnantMemberIndex, setPregnantMemberIndex] = useState<0 | 1>(
    household.pregnantMember === 'spouse' ? 1 : 0,
  );

  const events = getAvailableEvents(household);

  function pickEvent(t: LifeEventType) {
    setEventType(t);
    setStep(2);
  }

  function goBack() {
    setStep(1);
  }

  function apply() {
    if (!eventType) return;
    const params = buildParams();
    onApply(eventType, params);
  }

  function buildParams(): Record<string, unknown> {
    switch (eventType) {
      case 'changing_income':
        return {
          newIncome: (parseInt(yourIncomeMo) || 0) * 12,
          ...(married ? { newSpouseIncome: (parseInt(partnerIncomeMo) || 0) * 12 } : {}),
        };
      case 'moving_states':
        return {
          // Stay in the same state if only the ZIP changes.
          newState: newState || household.state,
          newZipCode: newZip || undefined,
        };
      case 'getting_married':
        return {
          spouseAge: parseInt(spouseAge) || 30,
          spouseIncome: (parseInt(spouseIncomeMo) || 0) * 12,
          spouseHasESI,
          spouseChildAges: spouseChildAges.map((a) => (a === '' ? 0 : a)),
        };
      case 'divorce':
        return {
          esiProvider,
          headLosesEsi: esiProvider === 'spouse',
          childrenKeeping,
        };
      case 'losing_esi':
        return {};
      case 'having_baby':
        return { pregnantMemberIndex };
      case 'ending_pregnancy':
        return { pregnantMemberIndex };
      default:
        return {};
    }
  }

  // Validation per event
  function canApply(): boolean {
    switch (eventType) {
      case 'changing_income':
        if (yourIncomeMo === '' || (married && partnerIncomeMo === '')) return false;
        const sameYour = (parseInt(yourIncomeMo) || 0) * 12 === household.income;
        const sameSpouse = (parseInt(partnerIncomeMo) || 0) * 12 === household.spouseIncome;
        return !(sameYour && (!married || sameSpouse));
      case 'moving_states':
        // Allow same-state moves when only the ZIP changes (different area within the state).
        return (newState !== '' && newState !== household.state) ||
               (newZip !== '' && newZip !== household.zipCode);
      case 'getting_married':
        return spouseAge !== '' && parseInt(spouseAge) >= 18;
      case 'divorce':
      case 'losing_esi':
      case 'having_baby':
      case 'ending_pregnancy':
        return true;
      default:
        return false;
    }
  }

  const selectedLabel = events.find((e) => e.type === eventType)?.label ?? '';

  // Display step number continues from the household wizard (steps 1-7).
  const wizardStep = step === 1 ? 8 : 9;
  const progressPercent = (wizardStep / 9) * 100;

  // Hard block ESI households. The tool models ACA marketplace, Medicaid,
  // and CHIP coverage; we don't have data on employer plan options or
  // employee premium contributions, so any modeling would be misleading.
  if (household.hasESI || household.spouseHasESI) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white border border-amber-300 rounded-xl p-6 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-700 mb-2">
            Heads up
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            Coverage Compass isn&apos;t designed for households with employer health insurance.
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            We model how life events affect <b>ACA marketplace coverage</b>, <b>Medicaid</b>, and <b>CHIP</b>.
            We don&apos;t have data on your employer&apos;s premium contribution, plan options, or out-of-pocket
            costs, so any comparison we showed would be incomplete.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed">
            If you&apos;re thinking about losing employer coverage and want to see what the marketplace
            would look like, click below to start over and re-enter without employer coverage.
          </p>
          <div className="mt-5">
            <button type="button" onClick={onReset} className="btn btn-primary">
              Start over with a new household
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">Step {wizardStep} of 9</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#319795] rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
      {step === 1 && (
        <>
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">What&apos;s changing?</h2>
            <p className="text-sm text-gray-500 mt-1">Pick the life event you want to model.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {events.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => pickEvent(opt.type)}
                className="text-left rounded-xl border-2 border-gray-200 hover:border-[#319795] hover:bg-[#E6FFFA]/50 p-4 transition-all"
              >
                <div className="text-sm font-semibold text-gray-900 mb-1">{opt.label}</div>
                <div className="text-xs text-gray-500 leading-snug">{opt.description}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {step === 2 && eventType && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canApply()) apply();
          }}
        >
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">{getStep2Heading(eventType)}</h2>
          </div>

          <div className="space-y-4">
            {eventType === 'changing_income' && (
              <>
                <div>
                  <FieldLabel>Your new monthly income</FieldLabel>
                  <MoneyInput value={yourIncomeMo} onChange={setYourIncomeMo} autoFocus />
                </div>
                {married && (
                  <div>
                    <FieldLabel>Partner&apos;s new monthly income</FieldLabel>
                    <MoneyInput value={partnerIncomeMo} onChange={setPartnerIncomeMo} />
                  </div>
                )}
              </>
            )}

            {eventType === 'moving_states' && (
              <>
                <div>
                  <FieldLabel>New state (optional, keep same to move within state)</FieldLabel>
                  <select
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    autoFocus
                    className={inputClass()}
                  >
                    <option value="">Same state ({household.state})</option>
                    {US_STATES.filter((s) => s.code !== household.state).map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>New ZIP (optional)</FieldLabel>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    value={newZip}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                      setNewZip(v);
                      if (v.length === 5) {
                        const detected = getStateFromZip(v);
                        if (detected) setNewState(detected);
                      }
                    }}
                    className={inputClass()}
                    placeholder="Optional, used for more accurate ACA premiums"
                  />
                </div>
              </>
            )}

            {eventType === 'getting_married' && (
              <>
                <div>
                  <FieldLabel>Partner&apos;s age</FieldLabel>
                  <input
                    type="number"
                    min={18}
                    max={100}
                    value={spouseAge}
                    onChange={(e) => setSpouseAge(e.target.value)}
                    autoFocus
                    className={inputClass()}
                    placeholder="e.g. 32"
                  />
                </div>
                <div>
                  <FieldLabel>Partner&apos;s monthly income</FieldLabel>
                  <MoneyInput value={spouseIncomeMo} onChange={setSpouseIncomeMo} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 py-1">
                  <input
                    type="checkbox"
                    checked={spouseHasESI}
                    onChange={(e) => setSpouseHasESI(e.target.checked)}
                    className="accent-[#319795]"
                  />
                  Partner has employer health insurance
                </label>
                <div>
                  <FieldLabel>Partner&apos;s children (under 18)</FieldLabel>
                  <div className="flex flex-col gap-2">
                    {spouseChildAges.length === 0 && <p className="text-xs text-gray-400">None</p>}
                    {spouseChildAges.map((age, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-16 shrink-0">Child {i + 1}</span>
                        <input
                          type="number"
                          min={0}
                          max={17}
                          value={age}
                          onChange={(e) => {
                            const next = [...spouseChildAges];
                            const v = e.target.value;
                            if (v === '') next[i] = '';
                            else {
                              const n = parseInt(v, 10);
                              next[i] = isNaN(n) ? '' : Math.min(17, Math.max(0, n));
                            }
                            setSpouseChildAges(next);
                          }}
                          className={inputClass()}
                          placeholder="age"
                        />
                        <button
                          type="button"
                          onClick={() => setSpouseChildAges(spouseChildAges.filter((_, j) => j !== i))}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                          aria-label={`Remove partner's child ${i + 1}`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => spouseChildAges.length < 10 && setSpouseChildAges([...spouseChildAges, 0])}
                      className="self-start inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[#2C7A7B] bg-[#E6FFFA] hover:bg-[#B2F5EA] rounded-lg transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      Add child
                    </button>
                  </div>
                </div>
              </>
            )}

            {eventType === 'divorce' && (
              <>
                {household.hasESI && household.spouseHasESI && (
                  <div>
                    <FieldLabel>Whose employer provides health insurance?</FieldLabel>
                    <select
                      value={esiProvider}
                      onChange={(e) => setEsiProvider(e.target.value as typeof esiProvider)}
                      className={inputClass()}
                    >
                      <option value="both">Both have separate plans</option>
                      <option value="yours">Yours</option>
                      <option value="spouse">Partner&apos;s</option>
                    </select>
                  </div>
                )}
                {household.childAges.length > 0 && (
                  <div>
                    <FieldLabel>Children staying with you (of {household.childAges.length})</FieldLabel>
                    <input
                      type="number"
                      min={0}
                      max={household.childAges.length}
                      value={childrenKeeping}
                      onChange={(e) => setChildrenKeeping(parseInt(e.target.value) || 0)}
                      className={inputClass()}
                    />
                  </div>
                )}
                {!household.hasESI && !household.spouseHasESI && household.childAges.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Click apply to model the divorce.
                  </p>
                )}
              </>
            )}

            {eventType === 'losing_esi' && (
              <p className="text-sm text-gray-600">
                Your employer health insurance ends. Click Apply to see your post-loss coverage options.
              </p>
            )}

            {(eventType === 'having_baby' || eventType === 'ending_pregnancy') && married && (
              <div className="flex flex-col gap-0">
                <FieldLabel>Who?</FieldLabel>
                {[
                  { label: 'Me', value: 0 as const },
                  { label: 'Partner', value: 1 as const },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPregnantMemberIndex(opt.value)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border-2 font-medium text-sm mb-2 transition-all ${
                      pregnantMemberIndex === opt.value
                        ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]'
                        : 'border-gray-200 hover:border-[#319795]/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {(eventType === 'having_baby' || eventType === 'ending_pregnancy') && !married && (
              <p className="text-sm text-gray-600">
                {eventType === 'having_baby'
                  ? 'Click Apply to see how pregnancy affects your coverage.'
                  : 'Click Apply to see how the end of pregnancy affects your coverage.'}
              </p>
            )}
          </div>

          <div className="flex justify-between mt-6">
            <button type="button" onClick={goBack} className="btn btn-ghost">
              ← Pick different event
            </button>
            <button type="submit" disabled={!canApply()} className="btn btn-primary">
              Run scenario
            </button>
          </div>

          <p className="text-[11px] text-gray-400 mt-3">
            Modeling: <b className="text-gray-600">{selectedLabel}</b>
          </p>
        </form>
      )}
      </div>
    </div>
  );
}

function getStep2Heading(eventType: LifeEventType): string {
  switch (eventType) {
    case 'changing_income': return "What's your new income?";
    case 'moving_states': return 'Where are you moving?';
    case 'getting_married': return "Tell us about your partner";
    case 'divorce': return 'A few details about the split';
    case 'losing_esi': return 'Confirm';
    case 'having_baby': return 'Pregnancy';
    case 'ending_pregnancy': return 'End of pregnancy';
  }
}
