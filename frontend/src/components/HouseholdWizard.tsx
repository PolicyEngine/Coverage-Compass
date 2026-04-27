'use client';

import { useState } from 'react';
import { Household, US_STATES, getStateFromZip } from '@/types';

interface HouseholdWizardProps {
  onComplete: (household: Household) => void;
  onBack?: () => void;
  onPartialChange?: (partial: Partial<Household>) => void;
}

type FilingStatus = Household['filingStatus'];

const TOTAL_STEPS = 6;

function isMarriedStatus(status: FilingStatus): boolean {
  return status === 'married_jointly' || status === 'married_separately';
}

export default function HouseholdWizard({ onComplete, onBack, onPartialChange }: HouseholdWizardProps) {
  const [step, setStep] = useState(1);

  const [zip, setZip] = useState('');
  const [detectedState, setDetectedState] = useState<string | null>(null);

  const [filingStatus, setFilingStatus] = useState<FilingStatus>('single');

  const [age, setAge] = useState<string>('');
  const [partnerAge, setPartnerAge] = useState<string>('');

  const [monthlyIncome, setMonthlyIncome] = useState<string>('');
  const [partnerMonthlyIncome, setPartnerMonthlyIncome] = useState<string>('');

  const [hasESI, setHasESI] = useState<boolean>(false);
  const [spouseHasESI, setSpouseHasESI] = useState<boolean>(false);

  const [childAges, setChildAges] = useState<Array<number | ''>>([]);

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

  function goNext() {
    const next = step + 1;
    setStep(next);
    // Emit partial household for live preview
    onPartialChange?.({
      state: detectedState ?? undefined,
      zipCode: zip || undefined,
      filingStatus,
      age: parseInt(age) || undefined,
      spouseAge: parseInt(partnerAge) || parseInt(age) || undefined,
      income: (parseFloat(monthlyIncome.replace(/,/g, '')) || 0) * 12,
      spouseIncome: (parseFloat(partnerMonthlyIncome.replace(/,/g, '')) || 0) * 12,
      hasESI,
      spouseHasESI,
      childAges: childAges.map(Number).filter((n) => !isNaN(n)),
      year: 2026,
    });
  }

  function selectFilingStatus(status: FilingStatus) {
    setFilingStatus(status);
    setStep(3);
    onPartialChange?.({ filingStatus: status, state: detectedState ?? undefined, zipCode: zip || undefined, year: 2026 });
  }

  function selectESI(selfESI: boolean, partnerESI: boolean) {
    setHasESI(selfESI);
    setSpouseHasESI(partnerESI);
    setStep(6);
    onPartialChange?.({
      state: detectedState ?? undefined, zipCode: zip || undefined,
      filingStatus, age: parseInt(age) || undefined,
      spouseAge: parseInt(partnerAge) || parseInt(age) || undefined,
      income: (parseFloat(monthlyIncome.replace(/,/g, '')) || 0) * 12,
      spouseIncome: (parseFloat(partnerMonthlyIncome.replace(/,/g, '')) || 0) * 12,
      hasESI: selfESI, spouseHasESI: partnerESI, year: 2026,
    });
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

  function handleComplete() {
    const myAge = parseInt(age, 10) || 18;
    const myPartnerAge = married ? (parseInt(partnerAge, 10) || myAge) : myAge;
    const income = (parseFloat(monthlyIncome) || 0) * 12;
    const spouseIncome = married ? (parseFloat(partnerMonthlyIncome) || 0) * 12 : 0;

    const household: Household = {
      state: detectedState ?? 'CA',
      zipCode: zip,
      filingStatus,
      age: myAge,
      spouseAge: myPartnerAge,
      income,
      spouseIncome,
      hasESI,
      spouseHasESI,
      childAges: childAges.map((a) => (a === '' ? 0 : a)),
      year: 2026,
    };

    onComplete(household);
  }

  const progressPercent = (step / TOTAL_STEPS) * 100;

  const step1Valid = zip.length === 5 && detectedState !== null;
  const step3Valid = age !== '' && parseInt(age, 10) >= 18 && (!married || (partnerAge !== '' && parseInt(partnerAge, 10) >= 18));
  const step4Valid = monthlyIncome !== '' && (!married || partnerMonthlyIncome !== '');

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">Step {step} of {TOTAL_STEPS}</span>
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
          <div>
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
                  📍 {stateName}
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
                type="button"
                onClick={goNext}
                disabled={!step1Valid}
                className="btn btn-primary"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">What&apos;s your filing status?</h2>
            <p className="text-sm text-gray-500 mb-6" />
            <div className="flex flex-col gap-0">
              {(
                [
                  { label: 'Single', value: 'single' },
                  { label: 'Married, filing jointly', value: 'married_jointly' },
                  { label: 'Head of household', value: 'head_of_household' },
                  { label: 'Married, filing separately', value: 'married_separately' },
                ] as { label: string; value: FilingStatus }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => selectFilingStatus(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all mb-2 ${
                    filingStatus === opt.value
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
          <div>
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
                type="button"
                onClick={goNext}
                disabled={!step3Valid}
                className="btn btn-primary"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">What&apos;s your monthly income?</h2>
            <p className="text-sm text-gray-500 mb-6">Before taxes. Include wages, self-employment, etc.</p>
            <div className="flex flex-col gap-4">
              <div>
                <label className="label">Your monthly income</label>
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
              {married && (
                <div>
                  <label className="label">Your partner&apos;s monthly income</label>
                  <div className="currency-input">
                    <span className="currency-prefix">$</span>
                    <input
                      type="number"
                      min={0}
                      value={partnerMonthlyIncome}
                      onChange={(e) => setPartnerMonthlyIncome(e.target.value)}
                      className="currency-field text-lg"
                      placeholder=""
                    />
                  </div>
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
                type="button"
                onClick={goNext}
                disabled={!step4Valid}
                className="btn btn-primary"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Who has health insurance through an employer?</h2>
            <p className="text-sm text-gray-500 mb-6" />
            {!married ? (
              <div className="flex flex-col gap-0">
                <button
                  type="button"
                  onClick={() => selectESI(true, false)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all mb-2 ${
                    hasESI
                      ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]'
                      : 'border-gray-200 text-gray-900 hover:border-[#319795] hover:bg-[#E6FFFA]'
                  }`}
                >
                  Yes, I do
                </button>
                <button
                  type="button"
                  onClick={() => selectESI(false, false)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all mb-2 ${
                    !hasESI
                      ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]'
                      : 'border-gray-200 text-gray-900 hover:border-[#319795] hover:bg-[#E6FFFA]'
                  }`}
                >
                  No, I don&apos;t
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-0">
                {(
                  [
                    { label: 'Just me', self: true, partner: false },
                    { label: 'Just my partner', self: false, partner: true },
                    { label: 'Both of us', self: true, partner: true },
                    { label: 'Neither of us', self: false, partner: false },
                  ] as { label: string; self: boolean; partner: boolean }[]
                ).map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => selectESI(opt.self, opt.partner)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 font-medium transition-all mb-2 ${
                      hasESI === opt.self && spouseHasESI === opt.partner
                        ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]'
                        : 'border-gray-200 text-gray-900 hover:border-[#319795] hover:bg-[#E6FFFA]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
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

        {step === 6 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Do you have any children under 18?</h2>
            <p className="text-sm text-gray-500 mb-6" />
            <div className="flex flex-col gap-3">
              {childAges.length === 0 && (
                <p className="text-sm text-gray-500 py-2">No children</p>
              )}
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
                onClick={goBack}
                className="btn btn-ghost"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleComplete}
                className="btn btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
