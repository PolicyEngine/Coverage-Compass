'use client';

import { useState } from 'react';
import { Household, LifeEventType, LIFE_EVENTS, US_STATES, getStateFromZip } from '@/types';

interface InputStripProps {
  household: Household;
  onHouseholdChange: (h: Household) => void;
  selectedEvent: LifeEventType | null;
  onEventSelect: (e: LifeEventType) => void;
  eventParams: Record<string, unknown>;
  onParamsChange: (params: Record<string, unknown>) => void;
  onRun: () => void;
  isLoading: boolean;
  canRun: boolean;
}

type FieldKey = 'location' | 'year' | 'filing' | 'age' | 'income' | 'esi' | 'children' | 'event';

const FILING_LABELS: Record<Household['filingStatus'], string> = {
  single: 'Single',
  married_jointly: 'Married, joint',
  married_separately: 'Married, separate',
  head_of_household: 'Head of household',
};

function isMarried(filingStatus: Household['filingStatus']): boolean {
  return filingStatus === 'married_jointly' || filingStatus === 'married_separately';
}

function getEsiLabel(household: Household): string {
  if (!isMarried(household.filingStatus)) {
    return household.hasESI ? 'Yes' : 'No';
  }
  if (household.hasESI && household.spouseHasESI) return 'Both';
  if (household.hasESI) return 'You';
  if (household.spouseHasESI) return 'Partner';
  return 'Neither';
}

function getEventHighlightedChip(event: LifeEventType | null): FieldKey | null {
  if (!event) return null;
  const map: Record<LifeEventType, FieldKey> = {
    having_baby: 'children',
    moving_states: 'location',
    getting_married: 'filing',
    changing_income: 'income',
    divorce: 'filing',
    losing_esi: 'esi',
  };
  return map[event];
}

interface ChipProps {
  label: string;
  value: string;
  isOpen: boolean;
  isHighlighted: boolean;
  onClick: () => void;
}

function Chip({ label, value, isOpen, isHighlighted, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg border px-2.5 py-2 cursor-pointer transition-all text-left w-full',
        isOpen
          ? 'bg-[#E6FFFA] border-[#319795] ring-2 ring-[#319795]/20'
          : isHighlighted
          ? 'bg-[#E6FFFA] border-transparent hover:bg-[#E6FFFA]'
          : 'border-transparent hover:bg-gray-50',
      ].join(' ')}
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-0.5">
        {label}
      </div>
      <div
        className={[
          'text-sm font-semibold truncate',
          isHighlighted && !isOpen ? 'text-[#285E61]' : 'text-gray-900',
        ].join(' ')}
      >
        {value}
      </div>
    </button>
  );
}

interface PopoverProps {
  onClose: () => void;
  children: React.ReactNode;
  onApply: () => void;
}

function Popover({ onClose, children, onApply }: PopoverProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-[calc(100%+8px)] left-0 z-50 min-w-[240px] max-w-[320px]">
        <div className="relative bg-white border border-gray-200 rounded-lg shadow-xl p-3.5">
          <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45" />
          {children}
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              className="px-3 py-1.5 text-xs font-medium bg-[#319795] text-white rounded-md hover:bg-[#2C7A7B] transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function PopoverLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
      {children}
    </div>
  );
}

export default function InputStrip({
  household,
  onHouseholdChange,
  selectedEvent,
  onEventSelect,
  eventParams,
  onParamsChange,
  onRun,
  isLoading,
  canRun,
}: InputStripProps) {
  const [editField, setEditField] = useState<FieldKey | null>(null);

  const highlightedChip = getEventHighlightedChip(selectedEvent);

  const openField = (field: FieldKey) => setEditField(field);
  const closeField = () => setEditField(null);

  const married = isMarried(household.filingStatus);

  const incomeDisplay = (() => {
    const yours = `$${Math.round(household.income / 12).toLocaleString()}/mo`;
    if (!married) return yours;
    const spouse = `$${Math.round(household.spouseIncome / 12).toLocaleString()}/mo`;
    return `${yours} & ${spouse}`;
  })();

  const ageDisplay = married
    ? `${household.age} & ${household.spouseAge}`
    : `${household.age}`;

  const childDisplay = (() => {
    const n = household.childAges.length;
    if (n === 0) return '0';
    if (n === 1) return `1 (age ${household.childAges[0]})`;
    return `${n} (ages ${household.childAges.join(', ')})`;
  })();

  const eventLabel =
    selectedEvent
      ? (LIFE_EVENTS.find((e) => e.type === selectedEvent)?.label ?? 'Pick event')
      : 'Pick event';

  const locationDisplay = `${household.state}${household.zipCode ? ' · ' + household.zipCode : ''}`;

  return (
    <div className="relative w-full bg-white border border-gray-200 rounded-xl shadow-sm px-2 py-1.5">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-9 sm:gap-1">
        {/* 1. LOCATION */}
        <div className="relative">
          <Chip
            label="Location"
            value={locationDisplay}
            isOpen={editField === 'location'}
            isHighlighted={highlightedChip === 'location'}
            onClick={() => openField('location')}
          />
          {editField === 'location' && (
            <LocationPopover
              household={household}
              onHouseholdChange={onHouseholdChange}
              onClose={closeField}
            />
          )}
        </div>

        {/* 2. YEAR */}
        <div className="relative">
          <Chip
            label="Year"
            value={`${household.year}`}
            isOpen={editField === 'year'}
            isHighlighted={false}
            onClick={() => openField('year')}
          />
          {editField === 'year' && (
            <YearPopover
              household={household}
              onHouseholdChange={onHouseholdChange}
              onClose={closeField}
            />
          )}
        </div>

        {/* 3. FILING */}
        <div className="relative">
          <Chip
            label="Filing"
            value={FILING_LABELS[household.filingStatus]}
            isOpen={editField === 'filing'}
            isHighlighted={highlightedChip === 'filing'}
            onClick={() => openField('filing')}
          />
          {editField === 'filing' && (
            <FilingPopover
              household={household}
              onHouseholdChange={onHouseholdChange}
              onClose={closeField}
            />
          )}
        </div>

        {/* 4. AGE */}
        <div className="relative">
          <Chip
            label="Age"
            value={ageDisplay}
            isOpen={editField === 'age'}
            isHighlighted={false}
            onClick={() => openField('age')}
          />
          {editField === 'age' && (
            <AgePopover
              household={household}
              onHouseholdChange={onHouseholdChange}
              onClose={closeField}
            />
          )}
        </div>

        {/* 5. INCOME */}
        <div className="relative">
          <Chip
            label="Income"
            value={incomeDisplay}
            isOpen={editField === 'income'}
            isHighlighted={highlightedChip === 'income'}
            onClick={() => openField('income')}
          />
          {editField === 'income' && (
            <IncomePopover
              household={household}
              onHouseholdChange={onHouseholdChange}
              onClose={closeField}
            />
          )}
        </div>

        {/* 6. ESI */}
        <div className="relative">
          <Chip
            label="ESI"
            value={getEsiLabel(household)}
            isOpen={editField === 'esi'}
            isHighlighted={highlightedChip === 'esi'}
            onClick={() => openField('esi')}
          />
          {editField === 'esi' && (
            <EsiPopover
              household={household}
              onHouseholdChange={onHouseholdChange}
              onClose={closeField}
            />
          )}
        </div>

        {/* 7. CHILDREN */}
        <div className="relative">
          <Chip
            label="Children"
            value={childDisplay}
            isOpen={editField === 'children'}
            isHighlighted={highlightedChip === 'children'}
            onClick={() => openField('children')}
          />
          {editField === 'children' && (
            <ChildrenPopover
              household={household}
              onHouseholdChange={onHouseholdChange}
              onClose={closeField}
            />
          )}
        </div>

        {/* 8. EVENT */}
        <div className="relative">
          <Chip
            label="Event"
            value={eventLabel}
            isOpen={editField === 'event'}
            isHighlighted={false}
            onClick={() => openField('event')}
          />
          {editField === 'event' && (
            <EventPopover
              household={household}
              selectedEvent={selectedEvent}
              onEventSelect={onEventSelect}
              eventParams={eventParams}
              onParamsChange={onParamsChange}
              onClose={closeField}
            />
          )}
        </div>

        {/* 9. RUN */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun || isLoading}
            className="bg-[#319795] text-white rounded-lg px-3 py-2 font-semibold text-sm cursor-pointer hover:bg-[#2C7A7B] disabled:opacity-50 flex items-center justify-center gap-1.5 w-full h-full"
          >
            {isLoading ? (
              <svg
                className="w-4 h-4 animate-spin"
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
            ) : (
              '→'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface HouseholdPopoverProps {
  household: Household;
  onHouseholdChange: (h: Household) => void;
  onClose: () => void;
}

function LocationPopover({ household, onHouseholdChange, onClose }: HouseholdPopoverProps) {
  const [state, setState] = useState(household.state);
  const [zip, setZip] = useState(household.zipCode ?? '');

  const apply = () => {
    onHouseholdChange({ ...household, state, zipCode: zip || undefined });
    onClose();
  };

  return (
    <Popover onClose={onClose} onApply={apply}>
      <PopoverLabel>Location</PopoverLabel>
      <div className="space-y-2">
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
        >
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="ZIP code (optional)"
          value={zip}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 5);
            setZip(v);
            if (v.length === 5) {
              const detected = getStateFromZip(v);
              if (detected) setState(detected);
            }
          }}
          className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
        />
      </div>
    </Popover>
  );
}

function YearPopover({ household, onHouseholdChange, onClose }: HouseholdPopoverProps) {
  const [year, setYear] = useState(household.year);

  const apply = () => {
    onHouseholdChange({ ...household, year });
    onClose();
  };

  return (
    <Popover onClose={onClose} onApply={apply}>
      <PopoverLabel>Coverage year</PopoverLabel>
      <select
        value={year}
        onChange={(e) => setYear(parseInt(e.target.value))}
        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
      >
        <option value={2026}>2026</option>
        <option value={2025}>2025</option>
        <option value={2024}>2024</option>
        <option value={2023}>2023</option>
      </select>
    </Popover>
  );
}

function FilingPopover({ household, onHouseholdChange, onClose }: HouseholdPopoverProps) {
  const [filing, setFiling] = useState(household.filingStatus);

  const apply = () => {
    onHouseholdChange({ ...household, filingStatus: filing });
    onClose();
  };

  return (
    <Popover onClose={onClose} onApply={apply}>
      <PopoverLabel>Filing status</PopoverLabel>
      <select
        value={filing}
        onChange={(e) => setFiling(e.target.value as Household['filingStatus'])}
        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
      >
        <option value="single">Single</option>
        <option value="married_jointly">Married, jointly</option>
        <option value="married_separately">Married, separately</option>
        <option value="head_of_household">Head of household</option>
      </select>
    </Popover>
  );
}

function AgePopover({ household, onHouseholdChange, onClose }: HouseholdPopoverProps) {
  const [age, setAge] = useState(String(household.age));
  const [spouseAge, setSpouseAge] = useState(String(household.spouseAge));
  const married = isMarried(household.filingStatus);

  const clamp = (v: string, min: number, max: number) => {
    const n = parseInt(v);
    if (isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  };

  const apply = () => {
    onHouseholdChange({
      ...household,
      age: clamp(age, 18, 100),
      spouseAge: married ? clamp(spouseAge, 18, 100) : household.spouseAge,
    });
    onClose();
  };

  return (
    <Popover onClose={onClose} onApply={apply}>
      <PopoverLabel>Age</PopoverLabel>
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Your age</label>
          <input
            type="number"
            min={18}
            max={100}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
          />
        </div>
        {married && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Partner&apos;s age</label>
            <input
              type="number"
              min={18}
              max={100}
              value={spouseAge}
              onChange={(e) => setSpouseAge(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
            />
          </div>
        )}
      </div>
    </Popover>
  );
}

function IncomePopover({ household, onHouseholdChange, onClose }: HouseholdPopoverProps) {
  const [income, setIncome] = useState(String(Math.round(household.income / 12)));
  const [spouseIncome, setSpouseIncome] = useState(
    String(Math.round(household.spouseIncome / 12))
  );
  const married = isMarried(household.filingStatus);

  const parseMonthly = (v: string) => {
    const n = parseInt(v.replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const apply = () => {
    onHouseholdChange({
      ...household,
      income: parseMonthly(income) * 12,
      spouseIncome: married ? parseMonthly(spouseIncome) * 12 : household.spouseIncome,
    });
    onClose();
  };

  return (
    <Popover onClose={onClose} onApply={apply}>
      <PopoverLabel>Monthly income</PopoverLabel>
      <div className="space-y-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Your monthly income</label>
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#319795]/30 focus-within:border-[#319795]">
            <span className="px-2 text-gray-400 text-sm bg-gray-50 border-r border-gray-200 py-1.5">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={income}
              onChange={(e) => setIncome(e.target.value.replace(/[^0-9]/g, ''))}
              className="flex-1 text-sm px-2 py-1.5 focus:outline-none"
            />
          </div>
        </div>
        {married && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Partner&apos;s monthly income</label>
            <div className="flex items-center border border-gray-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#319795]/30 focus-within:border-[#319795]">
              <span className="px-2 text-gray-400 text-sm bg-gray-50 border-r border-gray-200 py-1.5">$</span>
              <input
                type="text"
                inputMode="numeric"
                value={spouseIncome}
                onChange={(e) => setSpouseIncome(e.target.value.replace(/[^0-9]/g, ''))}
                className="flex-1 text-sm px-2 py-1.5 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </Popover>
  );
}

function EsiPopover({ household, onHouseholdChange, onClose }: HouseholdPopoverProps) {
  const married = isMarried(household.filingStatus);

  type EsiChoice = 'You' | 'Partner' | 'Both' | 'Neither' | 'Yes' | 'No';

  const currentChoice = (): EsiChoice => {
    if (!married) return household.hasESI ? 'Yes' : 'No';
    if (household.hasESI && household.spouseHasESI) return 'Both';
    if (household.hasESI) return 'You';
    if (household.spouseHasESI) return 'Partner';
    return 'Neither';
  };

  const [choice, setChoice] = useState<EsiChoice>(currentChoice());

  const options: EsiChoice[] = married
    ? ['You', 'Partner', 'Both', 'Neither']
    : ['Yes', 'No'];

  const apply = () => {
    let hasESI = false;
    let spouseHasESI = false;
    if (choice === 'You' || choice === 'Yes') { hasESI = true; }
    else if (choice === 'Partner') { spouseHasESI = true; }
    else if (choice === 'Both') { hasESI = true; spouseHasESI = true; }
    onHouseholdChange({ ...household, hasESI, spouseHasESI });
    onClose();
  };

  return (
    <Popover onClose={onClose} onApply={apply}>
      <PopoverLabel>Employer-sponsored insurance</PopoverLabel>
      <div className="space-y-1.5">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="esi"
              value={opt}
              checked={choice === opt}
              onChange={() => setChoice(opt)}
              className="accent-[#319795]"
            />
            <span className="text-sm text-gray-700 group-hover:text-gray-900">
              {opt}
            </span>
          </label>
        ))}
      </div>
    </Popover>
  );
}

function ChildrenPopover({ household, onHouseholdChange, onClose }: HouseholdPopoverProps) {
  const [childAges, setChildAges] = useState<number[]>([...household.childAges]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');

  const addChild = () => {
    if (childAges.length < 10) {
      setChildAges([...childAges, 5]);
    }
  };

  const removeChild = (i: number) => {
    setChildAges(childAges.filter((_, idx) => idx !== i));
  };

  const updateAge = (i: number, v: number) => {
    const next = [...childAges];
    next[i] = Math.min(17, Math.max(0, v));
    setChildAges(next);
  };

  const apply = () => {
    onHouseholdChange({ ...household, childAges });
    onClose();
  };

  return (
    <Popover onClose={onClose} onApply={apply}>
      <PopoverLabel>Children</PopoverLabel>
      <div className="space-y-1.5 mb-2">
        {childAges.length === 0 && (
          <p className="text-xs text-gray-400">No children added</p>
        )}
        {childAges.map((age, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-12">Child {i + 1}</span>
            <input
              type="number"
              min={0}
              max={17}
              value={editingIndex === i ? editingValue : age}
              onChange={(e) => {
                setEditingValue(e.target.value);
                const n = parseInt(e.target.value);
                if (!isNaN(n)) updateAge(i, n);
              }}
              onFocus={() => { setEditingIndex(i); setEditingValue(String(age)); }}
              onBlur={() => {
                const n = parseInt(editingValue);
                updateAge(i, isNaN(n) ? 0 : n);
                setEditingIndex(null);
                setEditingValue('');
              }}
              className="w-14 text-sm border border-gray-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
            />
            <span className="text-xs text-gray-400">yrs</span>
            <button
              type="button"
              onClick={() => removeChild(i)}
              className="ml-auto p-1 text-gray-300 hover:text-gray-500 rounded transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      {childAges.length < 10 && (
        <button
          type="button"
          onClick={addChild}
          className="w-full py-1.5 text-xs font-medium text-[#2C7A7B] border border-dashed border-[#81E6D9] rounded-md hover:bg-[#E6FFFA] transition-colors"
        >
          + Add child
        </button>
      )}
    </Popover>
  );
}

interface EventPopoverProps {
  household: Household;
  selectedEvent: LifeEventType | null;
  onEventSelect: (e: LifeEventType) => void;
  eventParams: Record<string, unknown>;
  onParamsChange: (params: Record<string, unknown>) => void;
  onClose: () => void;
}

function EventPopover({
  household,
  selectedEvent,
  onEventSelect,
  eventParams,
  onParamsChange,
  onClose,
}: EventPopoverProps) {
  const [draftEvent, setDraftEvent] = useState<LifeEventType | null>(selectedEvent);
  const [draftParams, setDraftParams] = useState<Record<string, unknown>>({ ...eventParams });

  const apply = () => {
    if (draftEvent) {
      onEventSelect(draftEvent);
      onParamsChange(draftParams);
    }
    onClose();
  };

  const updateParam = (key: string, value: unknown) => {
    setDraftParams((prev) => ({ ...prev, [key]: value }));
  };

  const married = isMarried(household.filingStatus);

  const renderParams = () => {
    if (!draftEvent) return null;

    switch (draftEvent) {
      case 'having_baby':
        return (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <label className="text-xs text-gray-500 mb-1 block">Babies expected</label>
            <select
              value={(draftParams.numBabies as number) ?? 1}
              onChange={(e) => updateParam('numBabies', parseInt(e.target.value))}
              className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
            >
              <option value={1}>1</option>
              <option value={2}>2 (twins)</option>
              <option value={3}>3 (triplets)</option>
            </select>
          </div>
        );

      case 'moving_states': {
        const newState = (draftParams.newState as string) ?? (US_STATES.find((s) => s.code !== household.state)?.code ?? 'TX');
        const newZip = (draftParams.newZipCode as string) ?? '';
        return (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">New state</label>
                <select
                  value={newState}
                  onChange={(e) => updateParam('newState', e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
                >
                  {US_STATES.filter((s) => s.code !== household.state).map((s) => (
                    <option key={s.code} value={s.code}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">New ZIP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  value={newZip}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 5);
                    const detected = v.length === 5 ? getStateFromZip(v) : null;
                    setDraftParams((prev) => ({
                      ...prev,
                      newZipCode: v || undefined,
                      ...(detected ? { newState: detected } : {}),
                    }));
                  }}
                  className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
                  placeholder="ZIP"
                />
              </div>
            </div>
          </div>
        );
      }

      case 'getting_married': {
        const spouseAge = (draftParams.spouseAge as number) ?? 30;
        const spouseIncomeMonthly = Math.round(((draftParams.spouseIncome as number) ?? 0) / 12);
        const spouseHasESI = (draftParams.spouseHasESI as boolean) ?? false;
        return (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Partner&apos;s age</label>
              <input
                type="number"
                min={18}
                max={100}
                value={spouseAge}
                onChange={(e) => updateParam('spouseAge', parseInt(e.target.value) || 30)}
                className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Partner&apos;s monthly income</label>
              <div className="flex items-center border border-gray-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#319795]/30 focus-within:border-[#319795]">
                <span className="px-2 text-gray-400 text-sm bg-gray-50 border-r border-gray-200 py-1.5">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={spouseIncomeMonthly}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                    updateParam('spouseIncome', n * 12);
                  }}
                  className="flex-1 text-sm px-2 py-1.5 focus:outline-none"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={spouseHasESI}
                onChange={(e) => updateParam('spouseHasESI', e.target.checked)}
                className="accent-[#319795]"
              />
              <span className="text-xs text-gray-700">Partner has ESI</span>
            </label>
          </div>
        );
      }

      case 'changing_income': {
        const newIncomeMo = Math.round(((draftParams.newIncome as number) ?? household.income) / 12);
        const newSpouseIncomeMo = Math.round(((draftParams.newSpouseIncome as number) ?? household.spouseIncome) / 12);
        return (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">
                Your new monthly income
                <span className="ml-1 text-gray-400">(current: ${Math.round(household.income / 12).toLocaleString()}/mo)</span>
              </label>
              <div className="flex items-center border border-gray-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#319795]/30 focus-within:border-[#319795]">
                <span className="px-2 text-gray-400 text-sm bg-gray-50 border-r border-gray-200 py-1.5">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newIncomeMo}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                    updateParam('newIncome', n * 12);
                  }}
                  className="flex-1 text-sm px-2 py-1.5 focus:outline-none"
                />
              </div>
            </div>
            {married && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Partner&apos;s new monthly income
                  <span className="ml-1 text-gray-400">(current: ${Math.round(household.spouseIncome / 12).toLocaleString()}/mo)</span>
                </label>
                <div className="flex items-center border border-gray-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#319795]/30 focus-within:border-[#319795]">
                  <span className="px-2 text-gray-400 text-sm bg-gray-50 border-r border-gray-200 py-1.5">$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newSpouseIncomeMo}
                    onChange={(e) => {
                      const n = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                      updateParam('newSpouseIncome', n * 12);
                    }}
                    className="flex-1 text-sm px-2 py-1.5 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        );
      }

      case 'divorce': {
        const bothHaveEsi = household.hasESI && household.spouseHasESI;
        const esiProvider = (draftParams.esiProvider as string) ?? 'both';
        const childrenKeeping = (draftParams.childrenKeeping as number) ?? household.childAges.length;
        return (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
            {bothHaveEsi && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Whose employer provides coverage?</label>
                <select
                  value={esiProvider}
                  onChange={(e) => {
                    const provider = e.target.value;
                    setDraftParams((prev) => ({
                      ...prev,
                      esiProvider: provider,
                      headLosesEsi: provider === 'spouse',
                    }));
                  }}
                  className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
                >
                  <option value="both">Both (separate jobs)</option>
                  <option value="yours">Yours</option>
                  <option value="spouse">Partner&apos;s</option>
                </select>
              </div>
            )}
            {household.childAges.length > 0 && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Children staying with you (of {household.childAges.length})</label>
                <input
                  type="number"
                  min={0}
                  max={household.childAges.length}
                  value={childrenKeeping}
                  onChange={(e) => updateParam('childrenKeeping', parseInt(e.target.value) ?? household.childAges.length)}
                  className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
                />
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
    <Popover onClose={onClose} onApply={apply}>
      <PopoverLabel>Coverage change</PopoverLabel>
      <select
        value={draftEvent ?? ''}
        onChange={(e) => {
          const val = e.target.value as LifeEventType;
          setDraftEvent(val);
          setDraftParams({});
        }}
        className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795]"
      >
        <option value="" disabled>Pick event…</option>
        {LIFE_EVENTS.map((e) => (
          <option key={e.type} value={e.type}>{e.label}</option>
        ))}
      </select>
      {renderParams()}
    </Popover>
  );
}
