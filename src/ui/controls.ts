import { formatDateToYYYYMMDD } from './info';

export interface UIControlsState {
  manualMinutes: number;
  currentSpeed: number;
  isCatchingUp: boolean;
  catchUpStartMinutes: number;
  catchUpStartTime: number;
  isPerfMode: boolean;
}

export function setupUIControls(
  state: UIControlsState,
  elements: {
    autoCheckEl: HTMLInputElement;
    perfCheckEl?: HTMLInputElement | null;
    manualSectionEl: HTMLElement;
    timeRangeEl: HTMLInputElement;
    datePickerEl: HTMLInputElement;
    dateYY: HTMLInputElement;
    dateMM: HTMLInputElement;
    dateDD: HTMLInputElement;
    speedValEl: HTMLElement;
  },
  onUpdateCallback: () => void,
  onPerfToggleCallback?: (isPerf: boolean) => void
): {
  getSimDate: (m: number) => Date;
  handleSyncToggle: () => void;
  adjustSpeed: (factor: number) => void;
} {
  const {
    autoCheckEl,
    perfCheckEl,
    manualSectionEl,
    timeRangeEl,
    datePickerEl,
    dateYY,
    dateMM,
    dateDD,
    speedValEl,
  } = elements;

  function getSimDate(m: number): Date {
    const nowD = new Date();
    if (autoCheckEl.checked) {
      const realM = nowD.getHours() * 60 + nowD.getMinutes() + nowD.getSeconds() / 60;
      const diffM = m - realM;
      return new Date(nowD.getTime() + diffM * 60 * 1000);
    } else {
      if (!datePickerEl.value) return nowD;
      const [y, mStr, dStr] = datePickerEl.value.split('-').map(Number);
      const h = Math.floor(m / 60);
      const mins = Math.floor(m % 60);
      const secs = Math.round((m * 60) % 60);
      return new Date(y, mStr - 1, dStr, h, mins, secs);
    }
  }

  function handleSyncToggle() {
    if (autoCheckEl.checked) {
      state.isCatchingUp = true;
      state.catchUpStartTime = performance.now();
      state.catchUpStartMinutes = state.manualMinutes;
      manualSectionEl.classList.add('disabled');
    } else {
      state.isCatchingUp = false;
      manualSectionEl.classList.remove('disabled');
      const d = new Date();
      state.manualMinutes = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    }
  }

  function adjustSpeed(factor: number) {
    const currentSign = state.currentSpeed * factor > 0 ? 1 : -1;
    state.currentSpeed = currentSign * Math.max(0.5, Math.min(2048, Math.abs(state.currentSpeed * factor)));
    speedValEl.textContent = state.currentSpeed.toString();
  }

  timeRangeEl.oninput = function () {
    if (!autoCheckEl.checked) {
      state.manualMinutes = parseFloat(timeRangeEl.value);
      onUpdateCallback();
    }
  };

  const originalValueDescriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  );

  Object.defineProperty(datePickerEl, 'value', {
    get() {
      return originalValueDescriptor?.get?.call(this);
    },
    set(val: string) {
      originalValueDescriptor?.set?.call(this, val);
      if (val) {
        const [y, m, d] = val.split('-');
        if (dateYY && dateMM && dateDD) {
          dateYY.value = parseInt(y, 10).toString();
          dateMM.value = parseInt(m, 10).toString();
          dateDD.value = parseInt(d, 10).toString();
        }
      }
    },
  });

  function onDateUIInput() {
    const y = (dateYY.value || '2026').padStart(4, '0');
    const m = (dateMM.value || '01').padStart(2, '0');
    const d = (dateDD.value || '01').padStart(2, '0');
    const newDateStr = `${y}-${m}-${d}`;
    originalValueDescriptor?.set?.call(datePickerEl, newDateStr);
    datePickerEl.dataset.prevValue = newDateStr;
    onUpdateCallback();
  }

  dateYY.oninput = () => onDateUIInput();

  dateMM.oninput = () => {
    let y = parseInt(dateYY.value, 10) || new Date().getFullYear();
    let m = parseInt(dateMM.value, 10) || 1;

    if (m > 12) {
      m = 1;
      y += 1;
      dateYY.value = y.toString();
      dateMM.value = m.toString();
    } else if (m < 1) {
      m = 12;
      y -= 1;
      dateYY.value = y.toString();
      dateMM.value = m.toString();
    }
    onDateUIInput();
  };

  dateDD.oninput = () => {
    let y = parseInt(dateYY.value, 10) || new Date().getFullYear();
    let m = parseInt(dateMM.value, 10) || 1;
    let d = parseInt(dateDD.value, 10) || 1;

    const lastDay = new Date(y, m, 0).getDate();

    if (d > lastDay) {
      d = 1;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      dateYY.value = y.toString();
      dateMM.value = m.toString();
      dateDD.value = d.toString();
    } else if (d < 1) {
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
      const prevLastDay = new Date(y, m, 0).getDate();
      d = prevLastDay;
      dateYY.value = y.toString();
      dateMM.value = m.toString();
      dateDD.value = d.toString();
    }
    onDateUIInput();
  };

  if (datePickerEl.value) {
    datePickerEl.value = datePickerEl.value;
  } else {
    datePickerEl.value = formatDateToYYYYMMDD(new Date());
  }

  // 저사양 모드 로컬 스토리지 불러오기 및 초기화
  const savedPerf = localStorage.getItem('planetarium_perf_mode');
  if (savedPerf !== null) {
    state.isPerfMode = savedPerf === 'true';
  }
  document.body.classList.toggle('perf-active', state.isPerfMode);

  if (perfCheckEl) {
    perfCheckEl.checked = state.isPerfMode;
    perfCheckEl.onchange = () => {
      state.isPerfMode = perfCheckEl.checked;
      document.body.classList.toggle('perf-active', state.isPerfMode);
      localStorage.setItem('planetarium_perf_mode', state.isPerfMode.toString());
      if (onPerfToggleCallback) onPerfToggleCallback(state.isPerfMode);
      onUpdateCallback();
    };
  }

  autoCheckEl.onchange = () => handleSyncToggle();

  return { getSimDate, handleSyncToggle, adjustSpeed };
}
