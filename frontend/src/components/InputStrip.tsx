'use client';

import { useState } from 'react';
import { Household, LifeEventType, LIFE_EVENTS, US_STATES, getStateFromZip } from '@/types';

interface InputStripProps {
  household: Household;
  onEditHousehold?: () => void;
  selectedEvent: LifeEventType | null;
  onEventSelect: (e: LifeEventType | null) => void;
  eventParams: Record<string, unknown>;
  onParamsChange: (params: Record<string, unknown>) => void;
  onRun: () => void;
  isLoading: boolean;
  canRun: boolean;
}

const FILING_LABELS: Record<Household['filingStatus'], string> = {
  single: 'Single',
  married_jointly: 'Married',
  married_separately: 'Married (sep.)',
  head_of_household: 'Head of HH',
};

function isMarried(filingStatus: Household['filingStatus']): boolean {
  return filingStatus === 'married_jointly' || filingStatus === 'married_separately';
}

function getEsiLabel(h: Household): string {
  if (!isMarried(h.filingStatus)) return h.hasESI ? 'Yes' : 'No';
  if (h.hasESI && h.spouseHasESI) return 'Both';
  if (h.hasESI) return 'You';
  if (h.spouseHasESI) return 'Partner';
  return 'Neither';
}

function fmt(annual: number) {
  return `$${Math.round(annual / 12).toLocaleString()}/mo`;
}

// Which chip corresponds to each event type
const EVENT_CHIP: Partial<Record<LifeEventType, string>> = {
  changing_income: 'income',
  moving_states: 'location',
  getting_married: 'filing',
  divorce: 'filing',
  losing_esi: 'esi',
  having_baby: 'children',
  ending_pregnancy: 'children',
};

function pregnancyLabel(h: Household): string | null {
  if (h.pregnantMember === 'head') return 'You';
  if (h.pregnantMember === 'spouse') return 'Partner';
  return null;
}

interface ChipProps {
  label: string;
  before: string;
  after?: string; // if set, show diff
  isOpen: boolean;
  onClick: () => void;
}

function Chip({ label, before, after, isOpen, onClick }: ChipProps) {
  const hasDiff = after !== undefined && after !== before;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative rounded-lg border px-2.5 py-2 cursor-pointer transition-all text-left w-full',
        isOpen
          ? 'bg-[#E6FFFA] border-[#319795] border-solid ring-2 ring-[#319795]/20'
          : hasDiff
          ? 'bg-[#E6FFFA] border-[#319795] border-solid'
          : 'border-dashed border-[#319795]/40 hover:border-solid hover:border-[#319795] hover:bg-[#E6FFFA]/50',
      ].join(' ')}
    >
      {/* Pencil icon — visible on hover/active */}
      <svg
        className={`absolute top-1.5 right-1.5 w-3 h-3 transition-opacity ${
          isOpen || hasDiff ? 'opacity-70 text-[#319795]' : 'opacity-30 text-[#319795] group-hover:opacity-90'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 mb-0.5 pr-4">
        {label}
      </div>
      {hasDiff ? (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-400 line-through leading-tight">{before}</span>
          <span className="text-xs text-gray-400">→</span>
          <span className="text-sm font-semibold text-[#285E61] leading-tight">{after}</span>
        </div>
      ) : (
        <div className="text-sm font-semibold text-gray-900 truncate">{before}</div>
      )}
    </button>
  );
}

interface PopoverProps {
  onClose: () => void;
  children: React.ReactNode;
}

function Popover({ onClose, children }: PopoverProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-[calc(100%+8px)] left-0 z-50 min-w-[260px] max-w-[340px]">
        <div className="relative bg-white border border-gray-200 rounded-xl shadow-xl p-4">
          <div className="absolute -top-1.5 left-4 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45" />
          {children}
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function inputClass(extra = '') {
  return `w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#319795]/30 focus:border-[#319795] ${extra}`;
}

function MoneyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#319795]/30 focus-within:border-[#319795]">
      <span className="px-2 text-gray-400 text-sm bg-gray-50 border-r border-gray-200 py-2">$</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        className="flex-1 text-sm px-2 py-2 focus:outline-none"
      />
      <span className="px-2 text-gray-400 text-xs bg-gray-50 border-l border-gray-200 py-2">/mo</span>
    </div>
  );
}

export default function InputStrip({
  household,
  onEditHousehold,
  selectedEvent,
  onEventSelect,
  eventParams,
  onParamsChange,
  onRun,
  isLoading,
  canRun,
}: InputStripProps) {
  const [openChip, setOpenChip] = useState<string | null>(null);

  const married = isMarried(household.filingStatus);

  const activeChip = selectedEvent ? EVENT_CHIP[selectedEvent] ?? null : null;

  function clearEvent() {
    onEventSelect(null);
    onParamsChange({});
  }

  function open(chip: string) {
    setOpenChip(openChip === chip ? null : chip);
  }
  function close() { setOpenChip(null); }

  // Derive "after" display values from eventParams + selectedEvent
  const locationAfter = (() => {
    if (selectedEvent !== 'moving_states') return undefined;
    const s = eventParams.newState as string | undefined;
    const z = eventParams.newZipCode as string | undefined;
    if (!s) return undefined;
    return `${s}${z ? ' · ' + z : ''}`;
  })();

  const filingAfter = (() => {
    if (selectedEvent === 'getting_married') return 'Married';
    if (selectedEvent === 'divorce') return 'Single';
    return undefined;
  })();

  const incomeAfter = (() => {
    if (selectedEvent !== 'changing_income') return undefined;
    const ni = eventParams.newIncome as number | undefined;
    const ns = eventParams.newSpouseIncome as number | undefined;
    if (ni === undefined) return undefined;
    const base = fmt(ni);
    if (married && ns !== undefined) return `${base} & ${fmt(ns)}`;
    return base;
  })();

  const esiAfter = (() => {
    if (selectedEvent !== 'losing_esi') return undefined;
    return 'No';
  })();

  const childrenAfter = (() => {
    if (selectedEvent === 'having_baby') {
      const idx = (eventParams.pregnantMemberIndex as number) ?? 0;
      const who = married ? (idx === 0 ? 'You' : 'Partner') : 'You';
      return `Pregnant: ${who}`;
    }
    if (selectedEvent === 'ending_pregnancy') {
      return 'Not pregnant';
    }
    return undefined;
  })();

  const locationBefore = `${household.state}${household.zipCode ? ' · ' + household.zipCode : ''}`;
  const filingBefore = FILING_LABELS[household.filingStatus];
  const incomeBefore = (() => {
    const yours = fmt(household.income);
    if (!married) return yours;
    return `${yours} & ${fmt(household.spouseIncome)}`;
  })();
  const esiBefore = getEsiLabel(household);
  const childrenBefore = (() => {
    const n = household.childAges.length;
    const pregLabel = pregnancyLabel(household);
    const childPart =
      n === 0 ? 'None'
      : n === 1 ? `1 (age ${household.childAges[0]})`
      : `${n} (ages ${household.childAges.join(', ')})`;
    if (pregLabel) return `${childPart} · Pregnant: ${pregLabel}`;
    return childPart;
  })();
  const selectedEventObj = LIFE_EVENTS.find(e => e.type === selectedEvent);

  return (
    <div className="relative w-full bg-white border border-gray-200 rounded-xl shadow-sm overflow-visible">
      <div className="flex items-center gap-1 px-2 pt-1.5 pb-1.5">
        <div className="input-strip-grid grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-1.5 flex-1 min-w-0">

          {/* LOCATION */}
          <div className="relative">
            <Chip label="Location" before={locationBefore} after={locationAfter} isOpen={openChip === 'location'} onClick={() => open('location')} />
            {openChip === 'location' && (
              <Popover onClose={close}>
                <LocationDiffPopover
                  household={household}
                  selectedEvent={selectedEvent}
                  eventParams={eventParams}
                  onEventSelect={onEventSelect}
                  onParamsChange={onParamsChange}
                  onClear={clearEvent}
                  onClose={close}
                  onRun={onRun}
                />
              </Popover>
            )}
          </div>

          {/* FILING */}
          <div className="relative">
            <Chip label="Filing" before={filingBefore} after={filingAfter} isOpen={openChip === 'filing'} onClick={() => open('filing')} />
            {openChip === 'filing' && (
              <Popover onClose={close}>
                <FilingDiffPopover
                  household={household}
                  selectedEvent={selectedEvent}
                  eventParams={eventParams}
                  onEventSelect={onEventSelect}
                  onParamsChange={onParamsChange}
                  onClear={clearEvent}
                  onClose={close}
                  onRun={onRun}
                />
              </Popover>
            )}
          </div>

          {/* INCOME */}
          <div className="relative">
            <Chip label="Income" before={incomeBefore} after={incomeAfter} isOpen={openChip === 'income'} onClick={() => open('income')} />
            {openChip === 'income' && (
              <Popover onClose={close}>
                <IncomeDiffPopover
                  household={household}
                  selectedEvent={selectedEvent}
                  eventParams={eventParams}
                  onEventSelect={onEventSelect}
                  onParamsChange={onParamsChange}
                  onClear={clearEvent}
                  onClose={close}
                  onRun={onRun}
                />
              </Popover>
            )}
          </div>

          {/* ESI */}
          <div className="relative">
            <Chip label="ESI" before={esiBefore} after={esiAfter} isOpen={openChip === 'esi'} onClick={() => open('esi')} />
            {openChip === 'esi' && (
              <Popover onClose={close}>
                <EsiDiffPopover
                  household={household}
                  selectedEvent={selectedEvent}
                  eventParams={eventParams}
                  onEventSelect={onEventSelect}
                  onParamsChange={onParamsChange}
                  onClear={clearEvent}
                  onClose={close}
                  onRun={onRun}
                />
              </Popover>
            )}
          </div>

          {/* CHILDREN */}
          <div className="relative">
            <Chip label="Children" before={childrenBefore} after={childrenAfter} isOpen={openChip === 'children'} onClick={() => open('children')} />
            {openChip === 'children' && (
              <Popover onClose={close}>
                <ChildrenDiffPopover
                  household={household}
                  selectedEvent={selectedEvent}
                  eventParams={eventParams}
                  onEventSelect={onEventSelect}
                  onParamsChange={onParamsChange}
                  onClear={clearEvent}
                  onClose={close}
                  onRun={onRun}
                />
              </Popover>
            )}
          </div>

        </div>

      </div>

      {/* Event summary + Calculate row — appears when an event is selected */}
      {canRun && selectedEventObj && (
        <>
          <div className="border-t border-gray-100 mx-2" />
          <div className="flex items-center gap-3 px-3 py-2">
            <p className="flex-1 text-xs text-gray-500 leading-snug">
              <span className="font-semibold text-[#285E61]">{selectedEventObj.label}:</span>{' '}
              {selectedEventObj.description}
            </p>
            <button
              type="button"
              onClick={onRun}
              disabled={isLoading}
              className="bg-[#319795] text-white rounded-lg px-4 py-1.5 font-semibold text-sm hover:bg-[#2C7A7B] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0 transition-colors"
            >
              {isLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <>
                  Calculate
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Diff popovers ────────────────────────────────────────────────────────────

interface DiffPopoverProps {
  household: Household;
  selectedEvent: LifeEventType | null;
  eventParams: Record<string, unknown>;
  onEventSelect: (e: LifeEventType | null) => void;
  onParamsChange: (p: Record<string, unknown>) => void;
  onClear: () => void;
  onClose: () => void;
  onRun: () => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">{children}</div>;
}

function BeforeValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-gray-400 bg-gray-50 rounded-lg px-3 py-2 mb-3 border border-gray-100">
      {children}
    </div>
  );
}

function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
    >
      ← Clear change
    </button>
  );
}

// LOCATION diff popover
function LocationDiffPopover({ household, selectedEvent, eventParams, onEventSelect, onParamsChange, onClear, onClose, onRun }: DiffPopoverProps) {
  const isActive = selectedEvent === 'moving_states';
  const [newState, setNewState] = useState((eventParams.newState as string) ?? '');
  const [newZip, setNewZip] = useState((eventParams.newZipCode as string) ?? '');

  function setEvent(state: string, zip: string) {
    if (!state || state === household.state) { onClear(); return; }
    onEventSelect('moving_states');
    onParamsChange({ newState: state, newZipCode: zip || undefined });
  }

  function applyAndRun() {
    if (!newState || newState === household.state) return;
    setEvent(newState, newZip);
    onClose();
    onRun();
  }

  return (
    <div>
      <SectionLabel>Where are you moving?</SectionLabel>
      <BeforeValue>Now: {household.state}{household.zipCode ? ` · ${household.zipCode}` : ''}</BeforeValue>
      <Row label="New state">
        <select
          value={newState}
          onChange={(e) => { setNewState(e.target.value); setEvent(e.target.value, newZip); }}
          className={inputClass('mb-2')}
        >
          <option value="">Pick a state…</option>
          {US_STATES.filter(s => s.code !== household.state).map(s => (
            <option key={s.code} value={s.code}>{s.name}</option>
          ))}
        </select>
      </Row>
      <Row label="New ZIP (optional)">
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={newZip}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 5);
            setNewZip(v);
            const detected = v.length === 5 ? getStateFromZip(v) : null;
            const s = detected ?? newState;
            if (s) setEvent(s, v);
            if (detected) setNewState(detected);
          }}
          className={inputClass()}
          placeholder="Optional"
        />
      </Row>
      {newState && newState !== household.state && (
        <button type="button" onClick={applyAndRun} className="w-full py-2 text-sm font-semibold bg-[#319795] text-white rounded-lg hover:bg-[#2C7A7B] transition-colors mt-3">
          Apply
        </button>
      )}
      {isActive && <ClearButton onClick={onClear} />}
    </div>
  );
}

// FILING diff popover
function FilingDiffPopover({ household, selectedEvent, eventParams, onEventSelect, onParamsChange, onClear, onClose, onRun }: DiffPopoverProps) {
  const married = isMarried(household.filingStatus);
  const isGettingMarried = selectedEvent === 'getting_married';
  const isDivorcing = selectedEvent === 'divorce';

  const [spouseAge, setSpouseAge] = useState(String((eventParams.spouseAge as number) ?? ''));
  const [spouseIncomeMo, setSpouseIncomeMo] = useState(String(Math.round(((eventParams.spouseIncome as number) ?? 0) / 12)));
  const [spouseHasESI, setSpouseHasESI] = useState((eventParams.spouseHasESI as boolean) ?? false);
  const [spouseChildAges, setSpouseChildAges] = useState<Array<number | ''>>(
    (eventParams.spouseChildAges as number[] | undefined) ?? [],
  );
  const [esiProvider, setEsiProvider] = useState((eventParams.esiProvider as string) ?? 'both');
  const [childrenKeeping, setChildrenKeeping] = useState((eventParams.childrenKeeping as number) ?? household.childAges.length);

  function selectGetMarried(overrides: { spouseChildAges?: number[] } = {}) {
    const ages = overrides.spouseChildAges ?? spouseChildAges.map(a => (a === '' ? 0 : a));
    onEventSelect('getting_married');
    onParamsChange({
      spouseAge: parseInt(spouseAge) || 30,
      spouseIncome: parseInt(spouseIncomeMo) * 12 || 0,
      spouseHasESI,
      spouseChildAges: ages,
    });
  }

  function addSpouseChild() {
    if (spouseChildAges.length >= 10) return;
    const next = [...spouseChildAges, 0 as number | ''];
    setSpouseChildAges(next);
    selectGetMarried({ spouseChildAges: next.map(a => (a === '' ? 0 : a)) });
  }

  function removeSpouseChild(index: number) {
    const next = spouseChildAges.filter((_, i) => i !== index);
    setSpouseChildAges(next);
    selectGetMarried({ spouseChildAges: next.map(a => (a === '' ? 0 : a)) });
  }

  function updateSpouseChildAge(index: number, value: string) {
    const next = [...spouseChildAges];
    if (value === '') {
      next[index] = '';
    } else {
      const parsed = parseInt(value, 10);
      next[index] = isNaN(parsed) ? '' : Math.min(17, Math.max(0, parsed));
    }
    setSpouseChildAges(next);
  }

  function selectDivorce() {
    onEventSelect('divorce');
    onParamsChange({
      esiProvider,
      headLosesEsi: esiProvider === 'spouse',
      childrenKeeping,
    });
  }

  if (!married) {
    return (
      <div>
        <SectionLabel>Change in status</SectionLabel>
        <BeforeValue>Now: Single</BeforeValue>
        <button
          type="button"
          onClick={() => selectGetMarried()}
          className={`w-full text-left px-3 py-2.5 rounded-lg border-2 font-medium text-sm mb-2 transition-all ${isGettingMarried ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]' : 'border-gray-200 hover:border-[#319795]/50'}`}
        >
          Getting married
        </button>
        {isGettingMarried && (
          <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
            <Row label="Partner's age">
              <input type="number" min={18} max={100} value={spouseAge} onChange={(e) => { setSpouseAge(e.target.value); }}
                onBlur={() => selectGetMarried()}
                className={inputClass()} placeholder="e.g. 32" />
            </Row>
            <Row label="Partner's monthly income">
              <MoneyInput value={spouseIncomeMo} onChange={(v) => { setSpouseIncomeMo(v); }} />
            </Row>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 mt-1">
              <input type="checkbox" checked={spouseHasESI} onChange={(e) => { setSpouseHasESI(e.target.checked); selectGetMarried(); }} className="accent-[#319795]" />
              Partner has employer insurance
            </label>
            <Row label="Partner's children (under 18)">
              <div className="flex flex-col gap-2">
                {spouseChildAges.length === 0 && (
                  <p className="text-xs text-gray-400">None</p>
                )}
                {spouseChildAges.map((age, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-12 shrink-0">Child {i + 1}</span>
                    <input
                      type="number"
                      min={0}
                      max={17}
                      value={age}
                      onChange={(e) => updateSpouseChildAge(i, e.target.value)}
                      onBlur={() => selectGetMarried()}
                      className={inputClass('flex-1 py-1.5')}
                      placeholder="age"
                    />
                    <button
                      type="button"
                      onClick={() => removeSpouseChild(i)}
                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
                      aria-label={`Remove partner's child ${i + 1}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSpouseChild}
                  disabled={spouseChildAges.length >= 10}
                  className="self-start inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#2C7A7B] bg-[#E6FFFA] hover:bg-[#B2F5EA] disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add child
                </button>
              </div>
            </Row>
            <button type="button" onClick={() => { selectGetMarried(); onClose(); onRun(); }} className="w-full py-2 text-sm font-semibold bg-[#319795] text-white rounded-lg hover:bg-[#2C7A7B] transition-colors mt-1">
              Apply
            </button>
          </div>
        )}
        {(isGettingMarried) && <ClearButton onClick={onClear} />}
      </div>
    );
  }

  // married → can divorce
  const bothHaveEsi = household.hasESI && household.spouseHasESI;
  return (
    <div>
      <SectionLabel>Change in status</SectionLabel>
      <BeforeValue>Now: {FILING_LABELS[household.filingStatus]}</BeforeValue>
      <button
        type="button"
        onClick={selectDivorce}
        className={`w-full text-left px-3 py-2.5 rounded-lg border-2 font-medium text-sm mb-2 transition-all ${isDivorcing ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]' : 'border-gray-200 hover:border-[#319795]/50'}`}
      >
        Divorce or separation
      </button>
      {isDivorcing && (
        <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
          {bothHaveEsi && (
            <Row label="Whose employer provides ESI?">
              <select value={esiProvider} onChange={(e) => { const v = e.target.value; setEsiProvider(v); onParamsChange({ esiProvider: v, headLosesEsi: v === 'spouse', childrenKeeping }); }} className={inputClass()}>
                <option value="both">Both (separate jobs)</option>
                <option value="yours">Yours</option>
                <option value="spouse">Partner's</option>
              </select>
            </Row>
          )}
          {household.childAges.length > 0 && (
            <Row label={`Children staying with you (of ${household.childAges.length})`}>
              <input type="number" min={0} max={household.childAges.length} value={childrenKeeping}
                onChange={(e) => { const n = parseInt(e.target.value) ?? 0; setChildrenKeeping(n); onParamsChange({ esiProvider, headLosesEsi: esiProvider === 'spouse', childrenKeeping: n }); }}
                className={inputClass()} />
            </Row>
          )}
          <button type="button" onClick={() => { selectDivorce(); onClose(); onRun(); }} className="w-full py-2 text-sm font-semibold bg-[#319795] text-white rounded-lg hover:bg-[#2C7A7B] transition-colors mt-1">
            Apply
          </button>
        </div>
      )}
      {isDivorcing && <ClearButton onClick={onClear} />}
    </div>
  );
}

// INCOME diff popover
function IncomeDiffPopover({ household, selectedEvent, eventParams, onEventSelect, onParamsChange, onClear, onClose, onRun }: DiffPopoverProps) {
  const married = isMarried(household.filingStatus);
  const isActive = selectedEvent === 'changing_income';

  const [yourMo, setYourMo] = useState(String(Math.round(((eventParams.newIncome as number) ?? household.income) / 12)));
  const [partnerMo, setPartnerMo] = useState(String(Math.round(((eventParams.newSpouseIncome as number) ?? household.spouseIncome) / 12)));

  function setEvent(y: string, p: string) {
    const ni = (parseInt(y) || 0) * 12;
    const ns = (parseInt(p) || 0) * 12;
    if (ni === household.income && (!married || ns === household.spouseIncome)) {
      onClear();
      return;
    }
    onEventSelect('changing_income');
    onParamsChange({ newIncome: ni, ...(married ? { newSpouseIncome: ns } : {}) });
  }

  function applyAndRun() {
    setEvent(yourMo, partnerMo);
    onClose();
    onRun();
  }

  return (
    <div>
      <SectionLabel>What's changing?</SectionLabel>
      <BeforeValue>
        Now: {fmt(household.income)}{married ? ` & ${fmt(household.spouseIncome)}` : ''}
      </BeforeValue>
      <div className="space-y-3">
        <Row label="Your new monthly income">
          <MoneyInput value={yourMo} onChange={(v) => { setYourMo(v); setEvent(v, partnerMo); }} />
        </Row>
        {married && (
          <Row label="Partner's new monthly income">
            <MoneyInput value={partnerMo} onChange={(v) => { setPartnerMo(v); setEvent(yourMo, v); }} />
          </Row>
        )}
      </div>
      <button type="button" onClick={applyAndRun} className="w-full py-2 text-sm font-semibold bg-[#319795] text-white rounded-lg hover:bg-[#2C7A7B] transition-colors mt-3">
        Apply
      </button>
      {isActive && <ClearButton onClick={onClear} />}
    </div>
  );
}

// ESI diff popover
function EsiDiffPopover({ household, selectedEvent, onEventSelect, onParamsChange, onClear, onClose, onRun }: DiffPopoverProps) {
  const isActive = selectedEvent === 'losing_esi';

  return (
    <div>
      <SectionLabel>Employer insurance</SectionLabel>
      <BeforeValue>Now: {getEsiLabel(household)}</BeforeValue>
      {household.hasESI ? (
        <>
          <button
            type="button"
            onClick={() => { onEventSelect('losing_esi'); onParamsChange({}); onClose(); onRun(); }}
            className={`w-full text-left px-3 py-2.5 rounded-lg border-2 font-medium text-sm transition-all ${isActive ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]' : 'border-gray-200 hover:border-[#319795]/50'}`}
          >
            Losing job-based coverage
          </button>
          {isActive && <ClearButton onClick={onClear} />}
        </>
      ) : (
        <p className="text-sm text-gray-500">No employer insurance to lose.</p>
      )}
    </div>
  );
}

// CHILDREN diff popover
function ChildrenDiffPopover({ household, selectedEvent, eventParams, onEventSelect, onParamsChange, onClear, onClose, onRun }: DiffPopoverProps) {
  const married = isMarried(household.filingStatus);
  const isHavingBaby = selectedEvent === 'having_baby';
  const isEndingPregnancy = selectedEvent === 'ending_pregnancy';
  const pregnantIndex = (eventParams.pregnantMemberIndex as number) ?? 0;
  const currentlyPregnant = household.pregnantMember === 'head' || household.pregnantMember === 'spouse';
  const currentPregnantIdx = household.pregnantMember === 'spouse' ? 1 : 0;
  const currentPregnantLabel = household.pregnantMember === 'head'
    ? 'You'
    : household.pregnantMember === 'spouse' ? 'Partner' : null;

  function selectBaby(idx: number) {
    onEventSelect('having_baby');
    onParamsChange({ pregnantMemberIndex: idx });
    onClose();
    onRun();
  }

  function selectEndPregnancy() {
    onEventSelect('ending_pregnancy');
    onParamsChange({ pregnantMemberIndex: currentPregnantIdx });
    onClose();
    onRun();
  }

  // If already pregnant per household status, the natural action is "no longer pregnant".
  if (currentlyPregnant) {
    return (
      <div>
        <SectionLabel>Pregnancy status</SectionLabel>
        <BeforeValue>Now: Pregnant ({currentPregnantLabel})</BeforeValue>
        <button
          type="button"
          onClick={selectEndPregnancy}
          className={`w-full text-left px-3 py-2.5 rounded-lg border-2 font-medium text-sm transition-all ${isEndingPregnancy ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]' : 'border-gray-200 hover:border-[#319795]/50'}`}
        >
          No longer pregnant
        </button>
        {isEndingPregnancy && <ClearButton onClick={onClear} />}
      </div>
    );
  }

  return (
    <div>
      <SectionLabel>Being pregnant</SectionLabel>
      <BeforeValue>
        Now: {household.childAges.length === 0 ? 'No children' : `${household.childAges.length} child${household.childAges.length > 1 ? 'ren' : ''}`}
      </BeforeValue>
      {!married ? (
        <button
          type="button"
          onClick={() => selectBaby(0)}
          className={`w-full text-left px-3 py-2.5 rounded-lg border-2 font-medium text-sm transition-all ${isHavingBaby ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]' : 'border-gray-200 hover:border-[#319795]/50'}`}
        >
          I&apos;m currently pregnant
        </button>
      ) : (
        <div className="space-y-2">
          {[
            { label: "You're pregnant", idx: 0 },
            { label: 'Partner is pregnant', idx: 1 },
          ].map(opt => (
            <button
              key={opt.idx}
              type="button"
              onClick={() => selectBaby(opt.idx)}
              className={`w-full text-left px-3 py-2.5 rounded-lg border-2 font-medium text-sm transition-all ${isHavingBaby && pregnantIndex === opt.idx ? 'border-[#319795] bg-[#E6FFFA] text-[#285E61]' : 'border-gray-200 hover:border-[#319795]/50'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {isHavingBaby && <ClearButton onClick={onClear} />}
    </div>
  );
}

