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
  infoDateEl: HTMLElement,
  datePickerEl: HTMLInputElement
): { toggleInfo: () => void } {
  function toggleInfo() {
    infoPanelEl.classList.toggle('active');
    let currentDate = null;
    if (datePickerEl.value) {
      const [y, mStr, dStr] = datePickerEl.value.split('-').map(Number);
      currentDate = new Date(y, mStr - 1, dStr);
    } else {
      currentDate = new Date();
    }
    const s = getSunTimes(currentDate);
    infoRiseEl.textContent = formatMinutes(s.sunrise);
    infoSetEl.textContent = formatMinutes(s.sunset);
    infoDateEl.textContent = currentDate.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    });
  }

  return { toggleInfo };
}
