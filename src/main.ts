import './styles/main.css';
import { getSunTimes, calcSunCoords } from './astronomy/sun';
import { getMoonAge, getMoonPath, calcMoonCoords } from './astronomy/moon';
import { getSeoulSiderealTime, getStarRotation } from './astronomy/sidereal';
import { calcSkyColors, calcTwilight } from './astronomy/sky';
import { setupInfoPanel, formatDateToYYYYMMDD, formatMinutes } from './ui/info';
import { setupUIControls, type UIControlsState } from './ui/controls';
import { setupSatelliteLoops } from './satellites/satellite';
import { initAudio, initVisualizer, startVisualizer, setVisualizerColor, setVisualizerPerfMode } from './audio/visualizer';
import type { FlareElements } from './types/astronomy';

const root = document.documentElement.style;
const skyLayer = document.getElementById('skyLayer') as HTMLElement;
const clockEl = document.getElementById('clockT') as HTMLElement;
const timeRangeEl = document.getElementById('timeRange') as HTMLInputElement;
const datePickerEl = document.getElementById('datePicker') as HTMLInputElement;
const autoCheckEl = document.getElementById('autoCheck') as HTMLInputElement;
const perfCheckEl = document.getElementById('perfCheck') as HTMLInputElement | null;
const manualSectionEl = document.getElementById('manualSection') as HTMLElement;
const dateYY = document.getElementById('dateYY') as HTMLInputElement;
const dateMM = document.getElementById('dateMM') as HTMLInputElement;
const dateDD = document.getElementById('dateDD') as HTMLInputElement;
const speedValEl = document.getElementById('speedVal') as HTMLElement;
const infoPanelEl = document.getElementById('infoPanel') as HTMLElement;
const infoRiseEl = document.getElementById('infoRise') as HTMLElement;
const infoSetEl = document.getElementById('infoSet') as HTMLElement;
const infoDateEl = document.getElementById('infoDate') as HTMLElement;
const satLayer = document.getElementById('satLayer') as HTMLElement;
const canvas = document.getElementById('vizCanvas') as HTMLCanvasElement;
const clockContainer = document.getElementById('clock') as HTMLElement;
const moonCrescentPathEl = document.getElementById('moonCrescentPath') as SVGPathElement | null;

const flareEls: FlareElements = {
  'h-1': document.getElementById('h-1'),
  'r-1': document.getElementById('r-1'),
  'g-1': document.getElementById('g-1'),
  'g-2': document.getElementById('g-2'),
  't-1': document.getElementById('t-1'),
  'mg-1': document.getElementById('mg-1'),
  'mh-1': document.getElementById('mh-1'),
  sunFC: document.getElementById('sunFlareCont'),
  moonFC: document.getElementById('moonFlareCont'),
};

const state: UIControlsState = {
  manualMinutes: 720,
  currentSpeed: 1,
  isCatchingUp: false,
  catchUpStartMinutes: 0,
  catchUpStartTime: 0,
  isPerfMode: false,
};

let lastTimestamp = performance.now();
const CATCHUP_DURATION = 2000;
let lastClockText = '';
let lastZenith = '';
let lastHorizon = '';
let frameCounter = -1;

function updateOptics(dx: number, dy: number, alt: number, isMoon = false, moonGlowFactor = 1) {
  const cont = isMoon ? flareEls.moonFC : flareEls.sunFC;
  if (!cont) return;

  const fadeStart = 0;
  const visibleRange = 0.3;
  const rawOpacity = (alt - fadeStart) / visibleRange;
  const finalOpacity = Math.max(0, Math.min(1, rawOpacity));

  const maxOpacity = isMoon ? 0.4 * moonGlowFactor : 0.95;
  cont.style.opacity = (finalOpacity * maxOpacity).toString();

  if (finalOpacity <= 0) return;

  const setFP = (id: keyof FlareElements, s: number) => {
    const el = flareEls[id];
    if (el) {
      const px = dx * (1 - s);
      const py = dy * (1 - s);
      el.style.transform = `translate3d(calc(50vw + ${px}vmax), calc(50vh + ${py}vmax), 0) translate(-50%, -50%)`;
    }
  };

  if (!isMoon) {
    setFP('h-1', 0.5);
    setFP('r-1', 1.3);
    setFP('g-1', 1.6);
    setFP('g-2', 1.1);
    setFP('t-1', 0.25);
  } else {
    setFP('mg-1', 1.2);
    setFP('mh-1', 0.5);
  }
}

export function updateSky(m: number, simDate: Date): void {
  const mG = ((m % 1440) + 1440) % 1440;
  const solar = getSunTimes(simDate);
  const { zenith, horizon, brightness, colors } = calcSkyColors(mG, solar);

  root.setProperty('--glass-bg', `rgba(${colors[0]}, ${colors[1]}, ${colors[2]}, ${colors[3]})`);
  root.setProperty('--text-main', `rgb(${colors[4]}, ${colors[5]}, ${colors[6]})`);
  root.setProperty('--text-sub', `rgba(${colors[7]}, ${colors[8]}, ${colors[9]}, 0.7)`);
  root.setProperty('--primary', `rgb(${colors[10]}, ${colors[11]}, ${colors[12]})`);
  root.setProperty('--on-primary-container', `rgb(${colors[13]}, ${colors[14]}, ${colors[15]})`);
  root.setProperty('--glass-border', `rgba(${colors[16]}, ${colors[16]}, ${colors[16]}, ${colors[17]})`);
  root.setProperty('--chip-bg', `rgba(${colors[16]}, ${colors[16]}, ${colors[16]}, 0.1)`);

  setVisualizerColor(colors[4], colors[5], colors[6]);

  const earthshineOpacity = Math.max(0, Math.min(1, 1 - (brightness - 21.67) / 8));
  const moonAuraOpacity = Math.max(0, Math.min(1, 1 - (brightness - 21.67) / 15));
  root.setProperty('--moon-earthshine-opacity', earthshineOpacity.toString());
  root.setProperty('--moon-aura-opacity', moonAuraOpacity.toString());

  if (brightness > 30) {
    root.setProperty('--moon-crescent-glow', 'none');
  } else {
    root.setProperty(
      '--moon-crescent-glow',
      'drop-shadow(0 0 5px rgba(255, 245, 220, 0.85)) drop-shadow(0 0 15px rgba(200, 225, 255, 0.4))'
    );
  }

  if (zenith !== lastZenith || horizon !== lastHorizon) {
    skyLayer.style.background = `linear-gradient(to bottom, ${zenith} 0%, ${horizon} 100%)`;
    root.setProperty('--sky-zenith', zenith);
    root.setProperty('--sky-horizon', horizon);
    lastZenith = zenith;
    lastHorizon = horizon;
  }

  // 1. 태양 좌표 및 렌더링
  const sunCoords = calcSunCoords(mG, solar);
  const sunOpacity = Math.max(0, Math.min(1, (sunCoords.altitude - -2) / 7));
  root.setProperty('--sun-opacity', sunOpacity.toString());

  if (sunCoords.altitude >= -2.0) {
    root.setProperty('--sun-x', sunCoords.x);
    root.setProperty('--sun-y', sunCoords.y);

    const maxAltFactor = solar.maxAlt / 90;
    const normalizedAlt = Math.max(0, sunCoords.altitude / 90);
    root.setProperty(
      '--atm-opacity',
      Math.max(0, Math.min(0.85, (normalizedAlt / maxAltFactor) * 1.2)).toString()
    );

    updateOptics(sunCoords.dx, sunCoords.dy, sunCoords.altitude, false);
  } else {
    root.setProperty('--sun-y', '150vh');
    root.setProperty('--atm-opacity', '0');
    if (flareEls.sunFC) flareEls.sunFC.style.opacity = '0';
  }

  // 2. 달 좌표 및 렌더링 (24시간 연속 시간각)
  const moonAge = getMoonAge(simDate);
  const { coords: moonCoords } = calcMoonCoords(mG, solar, moonAge);

  const moonOpacity = Math.max(0, Math.min(1, (moonCoords.altitude - -2) / 7));
  root.setProperty('--moon-opacity', moonOpacity.toString());

  if (moonCoords.altitude >= -2.0) {
    root.setProperty('--moon-x', moonCoords.x);
    root.setProperty('--moon-y', moonCoords.y);

    const moonPath = getMoonPath(moonAge);
    if (moonCrescentPathEl) {
      moonCrescentPathEl.setAttribute('d', moonPath);
    }

    const moonGlowFactor = Math.max(0, Math.min(1, 1 - (brightness - 21.67) / 20));
    updateOptics(moonCoords.dx, moonCoords.dy, moonCoords.altitude, true, moonGlowFactor * moonOpacity);
  } else {
    root.setProperty('--moon-y', '150vh');
    if (flareEls.moonFC) flareEls.moonFC.style.opacity = '0';
  }

  // 3. 밤하늘 은하수 / 황혼 페이딩
  const { starOpacity, starMaskY } = calcTwilight(mG, solar);
  const lst = getSeoulSiderealTime(simDate);
  const starRot = getStarRotation(lst);

  root.setProperty('--star-opacity', starOpacity.toString());
  root.setProperty('--star-mask-y', `${starMaskY}%`);
  root.setProperty('--star-rot', `${starRot}deg`);
}

// UI 컨트롤러 초기화
const { getSimDate, adjustSpeed } = setupUIControls(
  state,
  {
    autoCheckEl,
    perfCheckEl,
    manualSectionEl,
    timeRangeEl,
    datePickerEl,
    dateYY,
    dateMM,
    dateDD,
    speedValEl,
  },
  () => {
    updateSky(state.manualMinutes, getSimDate(state.manualMinutes));
  },
  (isPerf) => {
    setVisualizerPerfMode(isPerf);
  }
);

// 정보 패널 초기화
const { toggleInfo } = setupInfoPanel(infoPanelEl, infoRiseEl, infoSetEl, infoDateEl, datePickerEl);
clockContainer.onclick = () => toggleInfo();

// 전역 속도 조절 버튼 바인딩
(window as unknown as { adjustSpeed: (f: number) => void }).adjustSpeed = adjustSpeed;

// 애니메이션 메인 루프
function loop(now: number) {
  const dt = now - lastTimestamp;
  lastTimestamp = now;
  frameCounter++;

  let m: number;
  const d = new Date();
  const target = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;

  if (autoCheckEl.checked) {
    if (state.isCatchingUp) {
      const t = Math.min((now - state.catchUpStartTime) / CATCHUP_DURATION, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      let dist = (target - state.catchUpStartMinutes + 1440) % 1440;
      if (dist > 720) dist -= 1440;
      m = state.catchUpStartMinutes + dist * ease;
      if (t >= 1) state.isCatchingUp = false;
      state.manualMinutes = m;
    } else {
      m = target;
      state.manualMinutes = m;
    }
  } else {
    state.manualMinutes += (dt / 60000) * state.currentSpeed;

    // 자동 날짜 롤오버 (24시간 초과/미만 시 다음날/이전날로 변경)
    if (state.manualMinutes >= 1440) {
      const daysToShift = Math.floor(state.manualMinutes / 1440);
      state.manualMinutes = state.manualMinutes % 1440;

      if (datePickerEl.value) {
        const [y, mStr, dStr] = datePickerEl.value.split('-').map(Number);
        const currentDate = new Date(y, mStr - 1, dStr);
        currentDate.setDate(currentDate.getDate() + daysToShift);

        const newDateStr = formatDateToYYYYMMDD(currentDate);
        datePickerEl.value = newDateStr;
        datePickerEl.dataset.prevValue = newDateStr;
        
        const s = getSunTimes(currentDate);
        infoRiseEl.textContent = formatMinutes(s.sunrise);
        infoSetEl.textContent = formatMinutes(s.sunset);
        infoDateEl.textContent = currentDate.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
        });
      }
    } else if (state.manualMinutes < 0) {
      const daysToShift = Math.ceil(-state.manualMinutes / 1440);
      state.manualMinutes = ((state.manualMinutes % 1440) + 1440) % 1440;

      if (datePickerEl.value) {
        const [y, mStr, dStr] = datePickerEl.value.split('-').map(Number);
        const currentDate = new Date(y, mStr - 1, dStr);
        currentDate.setDate(currentDate.getDate() - daysToShift);

        const newDateStr = formatDateToYYYYMMDD(currentDate);
        datePickerEl.value = newDateStr;
        datePickerEl.dataset.prevValue = newDateStr;

        const s = getSunTimes(currentDate);
        infoRiseEl.textContent = formatMinutes(s.sunrise);
        infoSetEl.textContent = formatMinutes(s.sunset);
        infoDateEl.textContent = currentDate.toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric',
          weekday: 'short',
        });
      }
    }

    m = state.manualMinutes;
  }

  const mG = ((m % 1440) + 1440) % 1440;
  timeRangeEl.value = mG.toString();

  const hRaw = Math.floor(mG / 60);
  const mins = Math.floor(mG % 60);
  const secs = Math.round((mG * 60) % 60);
  const newText = `${hRaw.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  if (newText !== lastClockText) {
    clockEl.textContent = newText;
    lastClockText = newText;
  }

  const simDate = getSimDate(m);
  if (autoCheckEl.checked) {
    datePickerEl.value = formatDateToYYYYMMDD(d);
    datePickerEl.dataset.prevValue = datePickerEl.value;
  }

  if (
    !state.isPerfMode ||
    state.isCatchingUp ||
    (!autoCheckEl.checked && Math.abs(state.currentSpeed) > 2) ||
    frameCounter % 30 === 0
  ) {
    updateSky(m, simDate);
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// 인공위성 루프 시작
if (satLayer) {
  setupSatelliteLoops(
    satLayer,
    getSimDate,
    () => state.manualMinutes,
    () => autoCheckEl.checked,
    () => state.currentSpeed,
    () => state.isPerfMode
  );
}

// 오디오 및 비주얼라이저 시작
initAudio().then(() => {
  if (canvas) {
    initVisualizer(canvas);
    setVisualizerPerfMode(state.isPerfMode);
    startVisualizer();
  }
});
