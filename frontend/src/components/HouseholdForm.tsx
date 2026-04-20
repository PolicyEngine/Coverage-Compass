'use client';

import { useState } from 'react';
import { Household, US_STATES } from '@/types';

interface HouseholdFormProps {
  household: Household;
  onChange: (household: Household) => void;
  disabled?: boolean;
}

export default function HouseholdForm({
  household,
  onChange,
  disabled = false,
}: HouseholdFormProps) {
  const updateField = <K extends keyof Household>(
    field: K,
    value: Household[K]
  ) => {
    onChange({ ...household, [field]: value });
  };

  const isMarried = household.filingStatus === 'married_jointly' || household.filingStatus === 'married_separately';

  const addChild = () => {
    if (household.childAges.length < 10) {
      updateField('childAges', [...household.childAges, 10]);
    }
  };

  const removeChild = (index: number) => {
    const newAges = household.childAges.filter((_, i) => i !== index);
    updateField('childAges', newAges);
  };

  const updateChildAge = (index: number, age: number) => {
    const newAges = [...household.childAges];
    newAges[index] = Math.min(17, Math.max(0, age));
    updateField('childAges', newAges);
  };

  // Track child age editing separately (field name + index)
  const [editingChildIndex, setEditingChildIndex] = useState<number | null>(null);
  const [editingChildValue, setEditingChildValue] = useState<string>('');

  // Track which field is being edited (to allow empty during typing)
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // Format number with commas
  const formatWithCommas = (value: number): string => {
    return value.toLocaleString('en-US');
  };

  // Parse number from string with commas
  const parseFromCommas = (value: string): number => {
    return parseInt(value.replace(/,/g, '')) || 0;
  };

  // Handle number input - allow empty during typing
  const handleNumberChange = (
    field: 'income' | 'spouseIncome' | 'age' | 'spouseAge',
    value: string,
  ) => {
    setEditingValue(value);
    const parsed = parseInt(value.replace(/,/g, ''));
    if (!isNaN(parsed)) {
      updateField(field, parsed);
    }
  };

  const handleNumberFocus = (field: string, currentValue: number) => {
    setEditingField(field);
    setEditingValue(String(currentValue));
  };

  // Validate and clamp on blur
  const handleNumberBlur = (
    field: 'income' | 'spouseIncome' | 'age' | 'spouseAge',
    min: number,
    max?: number
  ) => {
    const parsed = parseFromCommas(editingValue);
    if (isNaN(parsed) || editingValue === '') {
      updateField(field, min);
    } else {
      const clamped = max !== undefined ? Math.min(max, Math.max(min, parsed)) : Math.max(min, parsed);
      updateField(field, clamped);
    }
    setEditingField(null);
    setEditingValue('');
  };

  // Get display value for income fields (with commas when not editing)
  const getIncomeDisplayValue = (field: 'income' | 'spouseIncome', value: number): string => {
    if (editingField === field) {
      return editingValue;
    }
    return formatWithCommas(value);
  };

  return (
    <div className="card p-6 sm:p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Household Details
      </h2>

      <div className="space-y-6">
        {/* State, Year & Filing Status Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label htmlFor="state" className="label">
              State
            </label>
            <select
              id="state"
              value={household.state}
              onChange={(e) => updateField('state', e.target.value)}
              disabled={disabled}
              className="select-field"
            >
              {US_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="year" className="label">
              Coverage Year
            </label>
            <select
              id="year"
              value={household.year || 2025}
              onChange={(e) => updateField('year', parseInt(e.target.value))}
              disabled={disabled}
              className="select-field"
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
              <option value={2023}>2023</option>
            </select>
          </div>

          <div>
            <label htmlFor="filingStatus" className="label">
              Filing Status
            </label>
            <select
              id="filingStatus"
              value={household.filingStatus}
              onChange={(e) =>
                updateField(
                  'filingStatus',
                  e.target.value as Household['filingStatus']
                )
              }
              disabled={disabled}
              className="select-field"
            >
              <option value="single">Single</option>
              <option value="married_jointly">Married Filing Jointly</option>
              <option value="married_separately">Married Filing Separately</option>
              <option value="head_of_household">Head of Household</option>
            </select>
          </div>
        </div>

        {/* Age & Income Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="age" className="label">
              Your Age
            </label>
            <input
              id="age"
              type="number"
              min="18"
              max="100"
              value={editingField === 'age' ? editingValue : household.age}
              onChange={(e) => handleNumberChange('age', e.target.value)}
              onFocus={() => handleNumberFocus('age', household.age)}
              onBlur={() => handleNumberBlur('age', 18, 100)}
              disabled={disabled}
              className="input-field"
            />
          </div>

          <div>
            <label htmlFor="income" className="label">
              Annual Earned Income
            </label>
            <div className={`currency-input ${disabled ? 'disabled' : ''}`}>
              <span className="currency-prefix">$</span>
              <input
                id="income"
                type="text"
                inputMode="numeric"
                value={getIncomeDisplayValue('income', household.income)}
                onChange={(e) => handleNumberChange('income', e.target.value)}
                onFocus={() => handleNumberFocus('income', household.income)}
                onBlur={() => handleNumberBlur('income', 0)}
                disabled={disabled}
                className="currency-field"
              />
            </div>
          </div>
        </div>

        {/* ESI Checkbox */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <input
            id="hasESI"
            type="checkbox"
            checked={household.hasESI}
            onChange={(e) => updateField('hasESI', e.target.checked)}
            disabled={disabled}
            className="checkbox"
          />
          <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
            I currently have job-based health insurance
          </span>
        </label>

        {/* Spouse Section */}
        {isMarried && (
          <div className="section-divider">
            <h3 className="text-base font-semibold text-gray-900 mb-5">
              Partner Information
            </h3>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="spouseAge" className="label">
                    Partner&apos;s Age
                  </label>
                  <input
                    id="spouseAge"
                    type="number"
                    min="18"
                    max="100"
                    value={editingField === 'spouseAge' ? editingValue : (household.spouseAge || 30)}
                    onChange={(e) => handleNumberChange('spouseAge', e.target.value)}
                    onFocus={() => handleNumberFocus('spouseAge', household.spouseAge || 30)}
                    onBlur={() => handleNumberBlur('spouseAge', 18, 100)}
                    disabled={disabled}
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="spouseIncome" className="label">
                    Partner&apos;s Annual Earned Income
                  </label>
                  <div className={`currency-input ${disabled ? 'disabled' : ''}`}>
                    <span className="currency-prefix">$</span>
                    <input
                      id="spouseIncome"
                      type="text"
                      inputMode="numeric"
                      value={getIncomeDisplayValue('spouseIncome', household.spouseIncome ?? 0)}
                      onChange={(e) => handleNumberChange('spouseIncome', e.target.value)}
                      onFocus={() => handleNumberFocus('spouseIncome', household.spouseIncome ?? 0)}
                      onBlur={() => handleNumberBlur('spouseIncome', 0)}
                      disabled={disabled}
                      className="currency-field"
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  id="spouseHasESI"
                  type="checkbox"
                  checked={household.spouseHasESI}
                  onChange={(e) => updateField('spouseHasESI', e.target.checked)}
                  disabled={disabled}
                  className="checkbox"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                  Partner currently has job-based health insurance
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Children Section */}
        <div className="section-divider">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-gray-900">Children</h3>
            <button
              type="button"
              onClick={addChild}
              disabled={disabled || household.childAges.length >= 10}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#2C7A7B] bg-[#E6FFFA] hover:bg-[#B2F5EA] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Child
            </button>
          </div>

          {household.childAges.length === 0 ? (
            <p className="text-sm text-gray-500 py-3">No children added</p>
          ) : (
            <div className="space-y-3">
              {household.childAges.map((age, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-[#F9FAFB] rounded-lg">
                  <span className="text-sm font-medium text-gray-600 w-16">
                    Child {index + 1}
                  </span>
                  <input
                    type="number"
                    min="0"
                    max="17"
                    value={editingChildIndex === index ? editingChildValue : age}
                    onChange={(e) => {
                      setEditingChildValue(e.target.value);
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) {
                        updateChildAge(index, val);
                      }
                    }}
                    onFocus={() => {
                      setEditingChildIndex(index);
                      setEditingChildValue(String(age));
                    }}
                    onBlur={() => {
                      const parsed = parseInt(editingChildValue);
                      if (isNaN(parsed) || editingChildValue === '') {
                        updateChildAge(index, 0);
                      } else {
                        updateChildAge(index, parsed);
                      }
                      setEditingChildIndex(null);
                      setEditingChildValue('');
                    }}
                    disabled={disabled}
                    className="input-field flex-1 !py-2"
                    placeholder="Age"
                  />
                  <span className="text-sm text-gray-500">years</span>
                  <button
                    type="button"
                    onClick={() => removeChild(index)}
                    disabled={disabled}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 rounded-md transition-colors"
                    aria-label={`Remove child ${index + 1}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
