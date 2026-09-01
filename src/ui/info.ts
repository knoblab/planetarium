import { getSunTimes } from '../astronomy/sun';

export function formatMinutes(minutes: number): string {
  const mSafe = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(mSafe / 60).toString().padStart(2, '0');
  const m = Math.floor(mSafe % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function formatDateToYYYYMMDD(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function setupInfoPanel(
  infoPanelEl: HTMLElement,
  infoRiseEl: HTMLElement,
  infoSetEl: HTMLElement,
  infoDateEl: HTMLElement
): { toggleInfo: () => void } {
  function toggleInfo() {
    infoPanelEl.classList.toggle('active');
    const s = getSunTimes(new Date());
    infoRiseEl.textContent = formatMinutes(s.sunrise);
    infoSetEl.textContent = formatMinutes(s.sunset);
    infoDateEl.textContent = new Date().toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  }

  return { toggleInfo };
}
