export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-2YHG89FY0N';
export const TOOL_NAME = 'coverage-compass';

type GTagEvent = {
  action: string;
  category?: string;
  label?: string;
  value?: number;
  [key: string]: string | number | undefined;
};

export function event({ action, category, label, value, ...rest }: GTagEvent) {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', action, {
    event_category: category,
    event_label: label,
    value,
    tool_name: TOOL_NAME,
    ...rest,
  });
}

export function trackWizardComplete(state: string, filingStatus: string) {
  event({
    action: 'wizard_complete',
    category: 'engagement',
    label: `${state}_${filingStatus}`,
  });
}

export function trackLifeEventSelected(eventType: string) {
  event({
    action: 'life_event_selected',
    category: 'engagement',
    label: eventType,
  });
}

export function trackSimulationRun(eventType: string, state: string) {
  event({
    action: 'simulation_run',
    category: 'engagement',
    label: eventType,
    state,
  });
}

export function trackSimulationComplete(eventType: string, monthlyDelta: number) {
  event({
    action: 'simulation_complete',
    category: 'engagement',
    label: eventType,
    value: Math.round(monthlyDelta),
  });
}

export function trackSimulationError(eventType: string, errorMessage: string) {
  event({
    action: 'simulation_error',
    category: 'engagement',
    label: `${eventType}: ${errorMessage}`,
  });
}

export function trackShareClick() {
  event({ action: 'share_click', category: 'engagement' });
}

export function trackTryAnother() {
  event({ action: 'try_another', category: 'engagement' });
}

export function trackReset() {
  event({ action: 'reset', category: 'engagement' });
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
