'use client';

import { useState } from 'react';
import { Household, LifeEventType, LIFE_EVENTS, US_STATES, getStateFromZip } from '@/types';
import { EventIcon } from '@/components/ScenarioIcons';

interface EventCardsProps {
  household: Household;
  selectedEvent: LifeEventType | null;
  onEventSelect: (event: LifeEventType | null) => void;
  eventParams: Record<string, unknown>;
  onParamsChange: (params: Record<string, unknown>) => void;
  onRun: () => void;
  isLoading: boolean;
}

const INPUT_CLASS =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]';
const LABEL_CLASS = 'text-xs font-medium text-gray-600 mb-1 block';

function CurrencyInput({
  value,
  onChange,
  onFocus,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
      <span className="px-3 py-2 bg-gray-50 text-gray-500 text-sm border-r border-gray-200">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className="flex-1 px-3 py-2 text-sm focus:outline-none"
      />
    </div>
  );
}

function DiffRow({
  label,
  oldVal,
  newVal,
}: {
  label: string;
  oldVal: string;
  newVal: string;
}) {
  return (
    <div className="flex items-baseline gap-1 text-sm">
      <span className="text-gray-500 w-28 shrink-0">{label}</span>
      <span className="line-through text-red-400">{oldVal}</span>
      <span className="text-gray-400 mx-1">→</span>
      <span className="font-semibold text-[#285E61]">{newVal}</span>
    </div>
  );
}

function fmt(monthly: number): string {
  return `$${Math.round(monthly).toLocaleString('en-US')}/mo`;
}

function DiffSummary({
  eventType,
  household,
  params,
}: {
  eventType: LifeEventType;
  household: Household;
  params: Record<string, unknown>;
}) {
  const rows: { label: string; oldVal: string; newVal: string }[] = [];

  switch (eventType) {
    case 'losing_esi':
      if (household.hasESI) {
        rows.push({ label: 'Employer insurance', oldVal: 'Yes', newVal: 'No' });
      }
      break;

    case 'having_baby': {
      const numBabies = (params.numBabies as number) || 1;
      rows.push({
        label: 'Children',
        oldVal: String(household.childAges.length),
        newVal: `${household.childAges.length + numBabies} (expecting)`,
      });
      break;
    }

    case 'getting_married': {
      const spouseAge = (params.spouseAge as number) ?? household.age;
      const spouseIncome = (params.spouseIncome as number) ?? 0;
      rows.push({ label: 'Filing', oldVal: 'Single', newVal: 'Married, jointly' });
      rows.push({
        label: 'Partner',
        oldVal: 'None',
        newVal: `age ${spouseAge}, ${fmt(spouseIncome / 12)}`,
      });
      break;
    }

    case 'changing_income': {
      const newIncome = params.newIncome as number | undefined;
      const newSpouseIncome = params.newSpouseIncome as number | undefined;
      if (newIncome !== undefined) {
        rows.push({
          label: 'Your income',
          oldVal: fmt(household.income / 12),
          newVal: fmt(newIncome / 12),
        });
      }
      const isMarried =
        household.filingStatus === 'married_jointly' ||
        household.filingStatus === 'married_separately';
      if (isMarried && newSpouseIncome !== undefined) {
        rows.push({
          label: 'Partner income',
          oldVal: fmt(household.spouseIncome / 12),
          newVal: fmt(newSpouseIncome / 12),
        });
      }
      break;
    }

    case 'divorce': {
      rows.push({ label: 'Filing', oldVal: 'Married', newVal: 'Single' });
      const headLosesEsi = params.headLosesEsi as boolean | undefined;
      if (headLosesEsi) {
        rows.push({ label: 'ESI', oldVal: "Spouse's plan", newVal: 'None' });
      }
      break;
    }

    case 'moving_states': {
      const newState = (params.newState as string) || '';
      if (newState) {
        rows.push({ label: 'Location', oldVal: household.state, newVal: newState });
      }
      break;
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        What changes
      </p>
      {rows.map((r) => (
        <DiffRow key={r.label} label={r.label} oldVal={r.oldVal} newVal={r.newVal} />
      ))}
    </div>
  );
}

function IncompatibilityMessage({ message }: { message: string }) {
  return (
    <div className="mt-4 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
      {message}
    </div>
  );
}

function EventEditFields({
  eventType,
  household,
  params,
  onParamsChange,
}: {
  eventType: LifeEventType;
  household: Household;
  params: Record<string, unknown>;
  onParamsChange: (p: Record<string, unknown>) => void;
}) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const isMarried =
    household.filingStatus === 'married_jointly' ||
    household.filingStatus === 'married_separately';

  const getNumValue = (key: string, fallback: number): number =>
    (params[key] as number) ?? fallback;

  const getEditableNum = (key: string, fallback: number): string | number =>
    editingField === key ? editingValue : getNumValue(key, fallback);

  const getIncomeDisplay = (key: string, annualFallback: number): string => {
    if (editingField === key) return editingValue;
    const annual = (params[key] as number) ?? annualFallback;
    return Math.round(annual / 12).toLocaleString('en-US');
  };

  const handleNumChange = (key: string, raw: string, min = 0, max?: number) => {
    setEditingValue(raw);
    const parsed = parseInt(raw.replace(/,/g, ''), 10);
    if (!isNaN(parsed)) {
      const clamped = max !== undefined ? Math.min(max, Math.max(min, parsed)) : Math.max(min, parsed);
      onParamsChange({ ...params, [key]: clamped });
    }
  };

  const handleNumBlur = (key: string, fallback: number, min = 0, max?: number) => {
    const parsed = parseInt(editingValue.replace(/,/g, ''), 10);
    const val = isNaN(parsed) || editingValue === '' ? fallback : parsed;
    const clamped = max !== undefined ? Math.min(max, Math.max(min, val)) : Math.max(min, val);
    onParamsChange({ ...params, [key]: clamped });
    setEditingField(null);
    setEditingValue('');
  };

  const handleIncomeChange = (key: string, raw: string) => {
    setEditingValue(raw);
    const monthly = parseInt(raw.replace(/,/g, ''), 10);
    if (!isNaN(monthly)) {
      onParamsChange({ ...params, [key]: monthly * 12 });
    }
  };

  const handleIncomeBlur = (key: string, annualFallback: number) => {
    const monthly = parseInt(editingValue.replace(/,/g, ''), 10);
    onParamsChange({
      ...params,
      [key]: isNaN(monthly) || editingValue === '' ? annualFallback : monthly * 12,
    });
    setEditingField(null);
    setEditingValue('');
  };

  switch (eventType) {
    case 'losing_esi':
      return (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-600">Your employer insurance ends.</p>
        </div>
      );

    case 'having_baby':
      return (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <label className={LABEL_CLASS}>Babies expected</label>
          <select
            value={(params.numBabies as number) || 1}
            onChange={(e) =>
              onParamsChange({ ...params, numBabies: parseInt(e.target.value, 10) })
            }
            className={INPUT_CLASS}
          >
            <option value={1}>1 (Single)</option>
            <option value={2}>2 (Twins)</option>
            <option value={3}>3 (Triplets)</option>
          </select>
        </div>
      );

    case 'getting_married':
      return (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Partner&apos;s age</label>
              <input
                type="number"
                min={18}
                max={100}
                value={getEditableNum('spouseAge', household.age)}
                onChange={(e) => handleNumChange('spouseAge', e.target.value, 18, 100)}
                onFocus={() => {
                  setEditingField('spouseAge');
                  setEditingValue(String(getNumValue('spouseAge', household.age)));
                }}
                onBlur={() => handleNumBlur('spouseAge', household.age, 18, 100)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Partner&apos;s monthly income</label>
              <CurrencyInput
                value={getIncomeDisplay('spouseIncome', 0)}
                onChange={(v) => handleIncomeChange('spouseIncome', v)}
                onFocus={() => {
                  setEditingField('spouseIncome');
                  setEditingValue(
                    String(Math.round(((params.spouseIncome as number) ?? 0) / 12))
                  );
                }}
                onBlur={() => handleIncomeBlur('spouseIncome', 0)}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={(params.spouseHasESI as boolean) || false}
              onChange={(e) =>
                onParamsChange({ ...params, spouseHasESI: e.target.checked })
              }
              className="rounded border-gray-300 text-[#319795] focus:ring-[#319795]/30"
            />
            <span className="text-sm text-gray-700">Partner has job-based insurance</span>
          </label>
        </div>
      );

    case 'changing_income':
      return (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div>
            <label className={LABEL_CLASS}>
              {isMarried ? 'Your new monthly income' : 'New monthly income'}
            </label>
            <CurrencyInput
              value={getIncomeDisplay('newIncome', household.income)}
              onChange={(v) => handleIncomeChange('newIncome', v)}
              onFocus={() => {
                setEditingField('newIncome');
                setEditingValue(
                  String(
                    Math.round(((params.newIncome as number) ?? household.income) / 12)
                  )
                );
              }}
              onBlur={() => handleIncomeBlur('newIncome', household.income)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Current: {fmt(household.income / 12)}
            </p>
          </div>
          {isMarried && (
            <div>
              <label className={LABEL_CLASS}>Partner&apos;s new monthly income</label>
              <CurrencyInput
                value={getIncomeDisplay('newSpouseIncome', household.spouseIncome)}
                onChange={(v) => handleIncomeChange('newSpouseIncome', v)}
                onFocus={() => {
                  setEditingField('newSpouseIncome');
                  setEditingValue(
                    String(
                      Math.round(
                        ((params.newSpouseIncome as number) ?? household.spouseIncome) / 12
                      )
                    )
                  );
                }}
                onBlur={() => handleIncomeBlur('newSpouseIncome', household.spouseIncome)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Current: {fmt(household.spouseIncome / 12)}
              </p>
            </div>
          )}
        </div>
      );

    case 'divorce': {
      const bothHaveEsi = household.hasESI && household.spouseHasESI;
      return (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          {bothHaveEsi && (
            <div>
              <label className={LABEL_CLASS}>Whose employer provides coverage?</label>
              <select
                value={(params.esiProvider as string) || 'both'}
                onChange={(e) => {
                  const provider = e.target.value;
                  onParamsChange({
                    ...params,
                    esiProvider: provider,
                    headLosesEsi: provider === 'spouse',
                  });
                }}
                className={INPUT_CLASS}
              >
                <option value="both">Both — separate jobs</option>
                <option value="yours">Yours</option>
                <option value="spouse">Partner&apos;s</option>
              </select>
            </div>
          )}
          {household.childAges.length > 0 && (
            <div>
              <label className={LABEL_CLASS}>Children staying with you</label>
              <input
                type="number"
                min={0}
                max={household.childAges.length}
                value={getEditableNum('childrenKeeping', household.childAges.length)}
                onChange={(e) =>
                  handleNumChange('childrenKeeping', e.target.value, 0, household.childAges.length)
                }
                onFocus={() => {
                  setEditingField('childrenKeeping');
                  setEditingValue(
                    String(getNumValue('childrenKeeping', household.childAges.length))
                  );
                }}
                onBlur={() =>
                  handleNumBlur('childrenKeeping', household.childAges.length, 0, household.childAges.length)
                }
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-gray-500">
                Out of {household.childAges.length} children
              </p>
            </div>
          )}
        </div>
      );
    }

    case 'moving_states': {
      const currentNewState = (params.newState as string) || (
        US_STATES.find((s) => s.code !== household.state)?.code ?? 'TX'
      );
      return (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>New state</label>
              <select
                value={currentNewState}
                onChange={(e) =>
                  onParamsChange({ ...params, newState: e.target.value, newZipCode: undefined })
                }
                className={INPUT_CLASS}
              >
                {US_STATES.filter((s) => s.code !== household.state).map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>New ZIP code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={(params.newZipCode as string) ?? ''}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                  const detectedState = v.length === 5 ? getStateFromZip(v) : null;
                  onParamsChange({
                    ...params,
                    newZipCode: v || undefined,
                    ...(detectedState ? { newState: detectedState } : {}),
                  });
                }}
                className={INPUT_CLASS}
              />
            </div>
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

function getIncompatibilityMessage(
  eventType: LifeEventType,
  household: Household
): string | null {
  const isMarried =
    household.filingStatus === 'married_jointly' ||
    household.filingStatus === 'married_separately';
  if (eventType === 'getting_married' && isMarried) {
    return "You're already married in your household details.";
  }
  if (eventType === 'divorce' && !isMarried) {
    return "Your household isn't currently married.";
  }
  if (eventType === 'losing_esi' && !household.hasESI) {
    return "You don't currently have employer insurance.";
  }
  return null;
}

export default function EventCards({
  household,
  selectedEvent,
  onEventSelect,
  eventParams,
  onParamsChange,
  onRun,
  isLoading,
}: EventCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {LIFE_EVENTS.map((event) => {
        const isSelected = selectedEvent === event.type;
        const isDimmed = selectedEvent !== null && !isSelected;
        const incompatibility = isSelected
          ? getIncompatibilityMessage(event.type, household)
          : null;

        return (
          <div
            key={event.type}
            className={`
              bg-white rounded-xl border p-4 transition-all
              ${isSelected
                ? 'border-[#319795] bg-[#E6FFFA]/30 ring-2 ring-[#319795]/20 sm:col-span-2'
                : isDimmed
                ? 'border-gray-200 opacity-40'
                : 'border-gray-200 hover:border-[#319795]/50 cursor-pointer'
              }
            `}
            onClick={() => {
              if (!isSelected && !isDimmed) {
                onEventSelect(event.type);
                onParamsChange({});
              }
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg ${
                  isSelected ? 'bg-[#B2F5EA] text-[#285E61]' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <EventIcon name={event.icon} className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm leading-snug">
                  {event.label}
                </p>
                <p className="text-xs text-gray-500 mt-0.5 leading-snug">
                  {event.description}
                </p>
              </div>
              {isSelected ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventSelect(null);
                    onParamsChange({});
                  }}
                  className="shrink-0 text-xs font-medium text-gray-500 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  × Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventSelect(event.type);
                    onParamsChange({});
                  }}
                  className="shrink-0 text-xs font-medium text-gray-500 hover:text-[#319795] px-2 py-1 rounded-lg hover:bg-[#E6FFFA] transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {isSelected && (
              <>
                {incompatibility ? (
                  <IncompatibilityMessage message={incompatibility} />
                ) : (
                  <>
                    <EventEditFields
                      eventType={event.type}
                      household={household}
                      params={eventParams}
                      onParamsChange={onParamsChange}
                    />
                    <DiffSummary
                      eventType={event.type}
                      household={household}
                      params={eventParams}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRun();
                      }}
                      disabled={isLoading}
                      className="mt-4 w-full bg-[#319795] text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#2C7A7B] transition-colors disabled:opacity-60"
                    >
                      {isLoading ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          Calculating…
                        </>
                      ) : (
                        'Calculate'
                      )}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
