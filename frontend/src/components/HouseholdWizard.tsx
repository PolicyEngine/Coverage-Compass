'use client';

import { useState } from 'react';
import { Household, US_STATES, getStateFromZip } from '@/types';

interface HouseholdWizardProps {
  onComplete: (household: Household) => void;
  onBack?: () => void;
  onPartialChange?: (partial: Partial<Household>) => void;
}

type FilingStatus = Household['filingStatus'];

const TOTAL_STEPS = 7;
// The change-wizard adds 2 more steps after household entry (event picker,
// event details). Display the household steps as part of the same 9-step
// flow so the user sees a continuous progress bar.
const TOTAL_STEPS_INCLUDING_CHANGE = 9;

function isMarriedStatus(status: FilingStatus): boolean {
  return status === 'married_jointly' || status === 'married_separately';
}

export default function HouseholdWizard({ onComplete, onBack, onPartialChange }: HouseholdWizardProps) {
  const [step, setStep] = useState(1);

  const [zip, setZip] = useState('');
  const [detectedState, setDetectedState] = useState<string | null>(null);

  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');
  const [filingTouched, setFilingTouched] = useState(false);

  const [age, setAge] = useState<string>('');
  const [partnerAge, setPartnerAge] = useState<string>('');

  const [monthlyIncome, setMonthlyIncome] = useState<string>('');

  const [hasESI, setHasESI] = useState<boolean>(false);
  const [spouseHasESI, setSpouseHasESI] = useState<boolean>(false);
  const [esiTouched, setEsiTouched] = useState(false);

  const [childAges, setChildAges] = useState<Array<number | ''>>([]);
  const [hasKids, setHasKids] = useState<'yes' | 'no' | null>(null);
  const [pregnantMember, setPregnantMember] = useState<'head' | 'spouse' | null>(null);
  const [pregnancyTouched, setPregnancyTouched] = useState(false);

  const married = isMarriedStatus(filingStatus);

  const stateName = detectedState
    ? (US_STATES.find((s) => s.code === detectedState)?.name ?? detectedState)
    : null;

  function handleZipChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 5);
    setZip(digits);
    if (digits.length === 5) {
      setDetectedState(getStateFromZip(digits));
    } else {
      setDetectedState(null);
    }
  }

  function goBack() {
    if (step === 1) {
      onBack?.();
    } else {
      setStep((s) => s - 1);
    }
  }

  function buildPartial(overrides: Partial<Household> = {}): Partial<Household> {
    const partial: Partial<Household> = { year: 2026 };
    if (detectedState) partial.state = detectedState;
    if (zip) partial.zipCode = zip;
    if (filingTouched) partial.filingStatus = filingStatus;
    const myAge = parseInt(age, 10);
    if (!isNaN(myAge) && myAge > 0) partial.age = myAge;
    const myPartnerAge = parseInt(partnerAge, 10);
    if (!isNaN(myPartnerAge) && myPartnerAge > 0) partial.spouseAge = myPartnerAge;
    const myIncome = parseFloat(monthlyIncome.replace(/,/g, ''));
    if (!isNaN(myIncome) && myIncome > 0) partial.income = myIncome * 12;
    if (esiTouched) {
      partial.hasESI = hasESI;
      partial.spouseHasESI = spouseHasESI;
    }
    const enteredChildAges = childAges.map(Number).filter((n) => !isNaN(n));
    if (enteredChildAges.length > 0) partial.childAges = enteredChildAges;
    return { ...partial, ...overrides };
  }

  function goNext() {
    const next = step + 1;
    setStep(next);
    onPartialChange?.(buildPartial());
  }

  function selectFilingStatus(status: FilingStatus) {
    setFilingStatus(status);
    setFilingTouched(true);
    setStep(3);
    // Pass overrides because the React state setters above are async and our
    // buildPartial() reads stale state on this render.
    onPartialChange?.(buildPartial({ filingStatus: status }));
  }

  function selectESI(selfESI: boolean, partnerESI: boolean) {
    setHasESI(selfESI);
    setSpouseHasESI(partnerESI);
    setEsiTouched(true);
    setStep(6);
    onPartialChange?.(buildPartial({ hasESI: selfESI, spouseHasESI: partnerESI }));
  }

  function addChild() {
    if (childAges.length < 10) {
      setChildAges((prev) => [...prev, 0]);
    }
  }

  function removeChild(index: number) {
    setChildAges((prev) => prev.filter((_, i) => i !== index));
  }

  function updateChildAge(index: number, value: string) {
    setChildAges((prev) => {
      const next = [...prev];
      if (value === '') {
        next[index] = '';
      } else {
        const parsed = parseInt(value, 10);
        next[index] = isNaN(parsed) ? '' : Math.min(17, Math.max(0, parsed));
      }
      return next;
    });
  }

  function handleComplete(overrides: { pregnantMember?: 'head' | 'spouse' | null } = {}) {
    const myAge = parseInt(age, 10) || 18;
    const myPartnerAge = married ? (parseInt(partnerAge, 10) || myAge) : myAge;
    // Total household income, all assigned to the head's employment_income.
    // For joint filers PolicyEngine aggregates head+spouse anyway; we don't
    // try to split because the user just gives us one number.
    const income = (parseFloat(monthlyIncome) || 0) * 12;
    const spouseIncome = 0;
    const numericChildAges = childAges.map((a) => (a === '' ? 0 : a));
    // Allow callers to pass a fresh pregnantMember value because the
    // setPregnantMember setter above won't have flushed yet.
    const finalPregnantMember =
      overrides.pregnantMember !== undefined ? overrides.pregnantMember : pregnantMember;

    // Auto-derive filing status: a single filer with at least one dependent
    // qualifies for head-of-household, which has more favorable brackets.
    // We don't surface MFS in the wizard because it's almost always worse
    // than MFJ for our calculator's purposes.
    const resolvedFilingStatus: FilingStatus =
      filingStatus === 'single' && numericChildAges.length > 0
        ? 'head_of_household'
        : filingStatus;

    const household: Household = {
      state: detectedState ?? 'CA',
      zipCode: zip,
      filingStatus: resolvedFilingStatus,
      age: myAge,
      spouseAge: myPartnerAge,
      income,
      spouseIncome,
      hasESI,
      spouseHasESI,
      childAges: numericChildAges,
      year: 2026,
      pregnantMember: finalPregnantMember ?? null,
    };

    onComplete(household);
  }

  const progressPercent = (step / TOTAL_STEPS_INCLUDING_CHANGE) * 100;

  const step1Valid = zip.length === 5 && detectedState !== null;
  const step3Valid = age !== '' && parseInt(age, 10) >= 18 && (!married || (partnerAge !== '' && parseInt(partnerAge, 10) >= 18));
  const step4Valid = monthlyIncome !== '';

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">Step {step} of {TOTAL_STEPS_INCLUDING_CHANGE}</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#319795] rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="card p-8 animate-fadeIn" key={step}>
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); if (step1Valid) goNext(); }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">What&apos;s your ZIP code?</h2>
            <p className="text-sm text-gray-500 mb-6">We use this to find ACA premiums in your area.</p>
            <div className="flex flex-col items-center gap-3">
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => handleZipChange(e.target.value)}
                className="input-field text-center text-2xl tracking-widest py-4"
                placeholder=""
                autoFocus
              />
              {stateName && (
                <p className="text-sm font-medium text-[#285E61]">
                  {stateName}
                </p>
              )}
            </div>
            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={goBack}
                className="btn btn-ghost"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!step1Valid}
                className="btn btn-primary"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Are you single or married?</h2>
            <p className="text-sm text-gray-500 mb-6" />
            <div className="flex flex-col gap-0">
              {(
                [
                  { label: 'Single', value: 'single' },
                  { label: 'Married', value: 'married_jointly' },
                ] as { label: string; value: FilingStatus }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectFilingStatus(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all mb-2 ${
                    filingTouched && filingStatus === opt.value
                      ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]'
                      : 'border-gray-200 text-gray-900 hover:border-[#319795] hover:bg-[#E6FFFA]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-4">
              <button
                type="button"
                onClick={goBack}
                className="btn btn-ghost"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <form onSubmit={(e) => { e.preventDefault(); if (step3Valid) goNext(); }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">How old are you?</h2>
            <p className="text-sm text-gray-500 mb-6" />
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Your age</label>
                <input
                  type="number"
                  min={18}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  onBlur={() => {
                    const parsed = parseInt(age, 10);
                    if (!isNaN(parsed)) {
                      setAge(String(Math.min(100, Math.max(18, parsed))));
                    }
                  }}
                  className="input-field text-lg"
                  placeholder=""
                  autoFocus
                />
              </div>
              {married && (
                <div>
                  <label className="label">How old is your partner?</label>
                  <input
                    type="number"
                    min={18}
                    max={100}
                    value={partnerAge}
                    onChange={(e) => setPartnerAge(e.target.value)}
                    onBlur={() => {
                      const parsed = parseInt(partnerAge, 10);
                      if (!isNaN(parsed)) {
                        setPartnerAge(String(Math.min(100, Math.max(18, parsed))));
                      }
                    }}
                    className="input-field text-lg"
                    placeholder=""
                  />
                </div>
              )}
            </div>
            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={goBack}
                className="btn btn-ghost"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!step3Valid}
                className="btn btn-primary"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 4 && (
          <form onSubmit={(e) => { e.preventDefault(); if (step4Valid) goNext(); }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">What&apos;s your household&apos;s monthly income?</h2>
            <p className="text-sm text-gray-500 mb-6">Before taxes. Add up everyone in the household: wages, self-employment, etc.</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Total household monthly income</label>
                <div className="currency-input">
                  <span className="currency-prefix">$</span>
                  <input
                    type="number"
                    min={0}
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="currency-field text-lg"
                    placeholder=""
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={goBack}
                className="btn btn-ghost"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!step4Valid}
                className="btn btn-primary"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Does anyone in your household have health insurance through an employer?
            </h2>
            <p className="text-sm text-gray-500 mb-6" />
            <div className="flex flex-col gap-0">
              <button
                type="button"
                onClick={() => selectESI(true, married)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all mb-2 ${
                  esiTouched && (hasESI || spouseHasESI)
                    ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]'
                    : 'border-gray-200 text-gray-900 hover:border-[#319795] hover:bg-[#E6FFFA]'
                }`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => selectESI(false, false)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all mb-2 ${
                  esiTouched && !hasESI && !spouseHasESI
                    ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]'
                    : 'border-gray-200 text-gray-900 hover:border-[#319795] hover:bg-[#E6FFFA]'
                }`}
              >
                No
              </button>
            </div>
            <div className="flex justify-between mt-4">
              <button
                type="button"
                onClick={goBack}
                className="btn btn-ghost"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 6 && hasKids !== 'yes' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Do you have any children under 18?</h2>
            <p className="text-sm text-gray-500 mb-6" />
            <div className="flex flex-col gap-0">
              <button
                type="button"
                onClick={() => { setHasKids('yes'); if (childAges.length === 0) addChild(); }}
                className="w-full text-left px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-900 font-medium transition-all mb-2 hover:border-[#319795] hover:bg-[#E6FFFA]"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => { setHasKids('no'); setChildAges([]); setStep(7); }}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all mb-2 ${
                  hasKids === 'no'
                    ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]'
                    : 'border-gray-200 text-gray-900 hover:border-[#319795] hover:bg-[#E6FFFA]'
                }`}
              >
                No
              </button>
            </div>
            <div className="flex justify-between mt-4">
              <button
                type="button"
                onClick={goBack}
                className="btn btn-ghost"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 6 && hasKids === 'yes' && (
          <form onSubmit={(e) => { e.preventDefault(); goNext(); }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">How old are your children?</h2>
            <p className="text-sm text-gray-500 mb-6" />
            <div className="flex flex-col gap-3">
              {childAges.map((childAge, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-600 w-16 shrink-0">
                    Child {index + 1}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={17}
                    value={childAge}
                    onChange={(e) => updateChildAge(index, e.target.value)}
                    onBlur={() => {
                      if (childAge === '') {
                        updateChildAge(index, '0');
                      }
                    }}
                    className="input-field flex-1 py-2"
                    placeholder=""
                  />
                  <button
                    type="button"
                    onClick={() => removeChild(index)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
                    aria-label={`Remove child ${index + 1}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addChild}
                disabled={childAges.length >= 10}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#2C7A7B] bg-[#E6FFFA] hover:bg-[#B2F5EA] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors self-start"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add child
              </button>
            </div>
            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={() => { setHasKids(null); setChildAges([]); }}
                className="btn btn-ghost"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={childAges.length === 0}
                className="btn btn-primary"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 7 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Is anyone currently pregnant?</h2>
            <p className="text-sm text-gray-500 mb-6">Pregnancy expands Medicaid eligibility in most states.</p>
            <div className="flex flex-col gap-0">
              {married ? (
                <>
                  {(
                    [
                      { label: 'Yes, me', value: 'head' as const },
                      { label: 'Yes, my partner', value: 'spouse' as const },
                      { label: 'No', value: null as null },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        setPregnantMember(opt.value);
                        setPregnancyTouched(true);
                        handleComplete({ pregnantMember: opt.value });
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all mb-2 ${
                        pregnancyTouched && pregnantMember === opt.value
                          ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]'
                          : 'border-gray-200 text-gray-900 hover:border-[#319795] hover:bg-[#E6FFFA]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </>
              ) : (
                <>
                  {(
                    [
                      { label: 'Yes', value: 'head' as const },
                      { label: 'No', value: null as null },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        setPregnantMember(opt.value);
                        setPregnancyTouched(true);
                        handleComplete({ pregnantMember: opt.value });
                      }}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all mb-2 ${
                        pregnancyTouched && pregnantMember === opt.value
                          ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]'
                          : 'border-gray-200 text-gray-900 hover:border-[#319795] hover:bg-[#E6FFFA]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </>
              )}
            </div>
            <div className="flex justify-between mt-4">
              <button
                type="button"
                onClick={goBack}
                className="btn btn-ghost"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
