'use client';

import { useState } from 'react';
import { EventIcon } from '@/components/ScenarioIcons';
import { LifeEvent, LifeEventType, LIFE_EVENTS, US_STATES, Household } from '@/types';

interface LifeEventSelectorProps {
  selectedEvent: LifeEventType | null;
  onSelect: (event: LifeEventType) => void;
  eventParams: Record<string, unknown>;
  onParamsChange: (params: Record<string, unknown>) => void;
  household: Household;
  disabled?: boolean;
}

export default function LifeEventSelector({
  selectedEvent,
  onSelect,
  eventParams,
  onParamsChange,
  household,
  disabled = false,
}: LifeEventSelectorProps) {
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingChildIndex, setEditingChildIndex] = useState<number | null>(null);
  const [editingChildValue, setEditingChildValue] = useState('');

  const formatWithCommas = (value: number): string => value.toLocaleString('en-US');

  const handleParamChange = (key: string, value: string) => {
    setEditingValue(value);
    const parsed = parseInt(value.replace(/,/g, ''));
    if (!isNaN(parsed)) {
      onParamsChange({ ...eventParams, [key]: parsed });
    }
  };

  const handleParamFocus = (key: string, currentValue: number) => {
    setEditingField(key);
    setEditingValue(String(currentValue));
  };

  const handleParamBlur = (key: string, defaultVal: number, min = 0, max?: number) => {
    const parsed = parseInt(editingValue.replace(/,/g, ''));
    if (isNaN(parsed) || editingValue === '') {
      onParamsChange({ ...eventParams, [key]: defaultVal });
    } else {
      const clamped = max !== undefined ? Math.min(max, Math.max(min, parsed)) : Math.max(min, parsed);
      onParamsChange({ ...eventParams, [key]: clamped });
    }
    setEditingField(null);
    setEditingValue('');
  };

  const getInputValue = (key: string, fallback: number) => {
    return editingField === key ? editingValue : (eventParams[key] as number) ?? fallback;
  };

  const getIncomeInputValue = (key: string, fallback: number) => {
    if (editingField === key) {
      return editingValue;
    }
    const value = (eventParams[key] as number) ?? fallback;
    return formatWithCommas(value);
  };

  const renderEventParams = (event: LifeEvent) => {
    if (!selectedEvent || selectedEvent !== event.type) return null;

    switch (event.type) {
      case 'having_baby':
        return (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="label">Number of babies expected</label>
            <select
              value={(eventParams.numBabies as number) || 1}
              onChange={(e) =>
                onParamsChange({ ...eventParams, numBabies: parseInt(e.target.value) })
              }
              disabled={disabled}
              className="select-field"
            >
              <option value={1}>1 (Single)</option>
              <option value={2}>2 (Twins)</option>
              <option value={3}>3 (Triplets)</option>
            </select>
            <p className="mt-1.5 text-xs text-gray-500">
              Affects household size for Medicaid eligibility — babies not yet included in coverage results
            </p>
          </div>
        );

      case 'getting_married':
        return (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
            <h4 className="text-sm font-semibold text-gray-900">Partner Details</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Partner&apos;s Age</label>
                <input
                  type="number"
                  min="18"
                  max="100"
                  value={getInputValue('spouseAge', 30)}
                  onChange={(e) => handleParamChange('spouseAge', e.target.value)}
                  onFocus={() => handleParamFocus('spouseAge', (eventParams.spouseAge as number) || 30)}
                  onBlur={() => handleParamBlur('spouseAge', 30, 18, 100)}
                  disabled={disabled}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label">Partner&apos;s Annual Income</label>
                <div className={`currency-input ${disabled ? 'disabled' : ''}`}>
                  <span className="currency-prefix">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={getIncomeInputValue('spouseIncome', 0)}
                    onChange={(e) => handleParamChange('spouseIncome', e.target.value)}
                    onFocus={() => handleParamFocus('spouseIncome', (eventParams.spouseIncome as number) || 0)}
                    onBlur={() => handleParamBlur('spouseIncome', 0)}
                    disabled={disabled}
                    className="currency-field"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Partner&apos;s Children</label>
                <button
                  type="button"
                  onClick={() => {
                    const currentAges = (eventParams.spouseChildAges as number[]) || [];
                    if (currentAges.length < 10) {
                      onParamsChange({ ...eventParams, spouseChildAges: [...currentAges, 10] });
                    }
                  }}
                  disabled={disabled || ((eventParams.spouseChildAges as number[])?.length || 0) >= 10}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#2C7A7B] bg-[#E6FFFA] hover:bg-[#B2F5EA] disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add
                </button>
              </div>
              {((eventParams.spouseChildAges as number[])?.length || 0) === 0 ? (
                <p className="text-xs text-gray-500">No additional children</p>
              ) : (
                <div className="space-y-2">
                  {((eventParams.spouseChildAges as number[]) || []).map((age, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-[#F9FAFB] rounded-lg">
                      <span className="text-xs font-medium text-gray-500 w-14">Child {index + 1}</span>
                      <input
                        type="number"
                        min="0"
                        max="17"
                        value={editingChildIndex === index ? editingChildValue : age}
                        onChange={(e) => {
                          setEditingChildValue(e.target.value);
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) {
                            const newAges = [...((eventParams.spouseChildAges as number[]) || [])];
                            newAges[index] = Math.min(17, Math.max(0, val));
                            onParamsChange({ ...eventParams, spouseChildAges: newAges });
                          }
                        }}
                        onFocus={() => {
                          setEditingChildIndex(index);
                          setEditingChildValue(String(age));
                        }}
                        onBlur={() => {
                          const parsed = parseInt(editingChildValue);
                          const newAges = [...((eventParams.spouseChildAges as number[]) || [])];
                          if (isNaN(parsed) || editingChildValue === '') {
                            newAges[index] = 0;
                          } else {
                            newAges[index] = Math.min(17, Math.max(0, parsed));
                          }
                          onParamsChange({ ...eventParams, spouseChildAges: newAges });
                          setEditingChildIndex(null);
                          setEditingChildValue('');
                        }}
                        disabled={disabled}
                        className="input-field flex-1 !py-1.5 text-sm"
                      />
                      <span className="text-xs text-gray-500">yrs</span>
                      <button
                        type="button"
                        onClick={() => {
                          const newAges = ((eventParams.spouseChildAges as number[]) || []).filter((_, i) => i !== index);
                          onParamsChange({ ...eventParams, spouseChildAges: newAges });
                        }}
                        disabled={disabled}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 rounded transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={(eventParams.spouseHasESI as boolean) || false}
                onChange={(e) =>
                  onParamsChange({ ...eventParams, spouseHasESI: e.target.checked })
                }
                disabled={disabled}
                className="checkbox"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                Partner has job-based insurance
              </span>
            </label>
          </div>
        );

      case 'divorce':
        return (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {household.childAges.length > 0 && (
              <div>
                <label className="label">Children staying with you</label>
                <input
                  type="number"
                  min="0"
                  max={household.childAges.length}
                  value={getInputValue('childrenKeeping', household.childAges.length)}
                  onChange={(e) => handleParamChange('childrenKeeping', e.target.value)}
                  onFocus={() => handleParamFocus('childrenKeeping', (eventParams.childrenKeeping as number) ?? household.childAges.length)}
                  onBlur={() => handleParamBlur('childrenKeeping', household.childAges.length, 0, household.childAges.length)}
                  disabled={disabled}
                  className="input-field"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Out of {household.childAges.length} children
                </p>
              </div>
            )}
          </div>
        );

      case 'moving_states':
        return (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="label">New State</label>
            <select
              value={(eventParams.newState as string) || 'TX'}
              onChange={(e) =>
                onParamsChange({ ...eventParams, newState: e.target.value })
              }
              disabled={disabled}
              className="select-field"
            >
              {US_STATES.filter((state) => state.code !== household.state).map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>
        );

      case 'changing_income': {
        const isMarried = household.filingStatus === 'married_jointly' || household.filingStatus === 'married_separately';
        return (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
            <div>
              <label className="label">{isMarried ? 'Your New Income' : 'New Annual Income'}</label>
              <div className={`currency-input ${disabled ? 'disabled' : ''}`}>
                <span className="currency-prefix">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={getIncomeInputValue('newIncome', household.income)}
                  onChange={(e) => handleParamChange('newIncome', e.target.value)}
                  onFocus={() => handleParamFocus('newIncome', (eventParams.newIncome as number) ?? household.income)}
                  onBlur={() => handleParamBlur('newIncome', household.income)}
                  disabled={disabled}
                  className="currency-field"
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Current: ${household.income.toLocaleString()}
              </p>
            </div>

            {isMarried && (
              <div>
                <label className="label">Partner&apos;s New Income</label>
                <div className={`currency-input ${disabled ? 'disabled' : ''}`}>
                  <span className="currency-prefix">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={getIncomeInputValue('newSpouseIncome', household.spouseIncome)}
                    onChange={(e) => handleParamChange('newSpouseIncome', e.target.value)}
                    onFocus={() => handleParamFocus('newSpouseIncome', (eventParams.newSpouseIncome as number) ?? household.spouseIncome)}
                    onBlur={() => handleParamBlur('newSpouseIncome', household.spouseIncome)}
                    disabled={disabled}
                    className="currency-field"
                  />
                </div>
                <p className="mt-1.5 text-xs text-gray-500">
                  Current: ${household.spouseIncome.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        );
      }

      case 'losing_esi':
        return null;

      default:
        return null;
    }
  };

  return (
    <div className="card p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Choose a Coverage Change</h2>
        <p className="mt-1.5 text-sm text-gray-500">
          Pick the household change you want to present and we&apos;ll show how healthcare coverage shifts before and after.
        </p>
      </div>

      <div className="space-y-3">
        {LIFE_EVENTS.map((event) => {
          const isSelected = selectedEvent === event.type;

          return (
            <div key={event.type}>
              <button
                onClick={() => onSelect(event.type)}
                disabled={disabled}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-[#319795] bg-[#E6FFFA] shadow-sm'
                    : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F9FAFB]'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 flex items-center justify-center rounded-lg ${
                      isSelected
                        ? 'bg-[#B2F5EA] text-[#285E61]'
                        : 'bg-[#F2F4F7] text-[#64748B]'
                    }`}
                  >
                    <EventIcon name={event.icon} className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900">{event.label}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{event.description}</p>
                  </div>
                  {isSelected && (
                    <svg className="w-5 h-5 text-[#319795] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </button>
              {renderEventParams(event)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
