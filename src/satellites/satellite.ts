import { getSunTimes } from '../astronomy/sun';

export function setupSatelliteLoops(
  satLayer: HTMLElement,
  getSimDateFn: (m: number) => Date,
  getManualMinutesFn: () => number,
  isAutoSyncFn: () => boolean,
  getCurrentSpeedFn: () => number,
  isPerfModeFn: () => boolean
): void {
  function animateObject(isStarlink = false) {
    const manualMinutes = getManualMinutesFn();
    const solar = getSunTimes(getSimDateFn(manualMinutes));
    const mG = ((manualMinutes % 1440) + 1440) % 1440;
    let tempSunAlt = -1;

    if (mG >= solar.sunrise && mG <= solar.sunset) {
      const prog = (mG - solar.sunrise) / (solar.sunset - solar.sunrise);
      tempSunAlt = Math.sin(prog * Math.PI);
    }
    if (tempSunAlt > 0.05) return;

    const side = Math.floor(Math.random() * 4);
    let sx = 0, sy = 0, ex = 0, ey = 0;
    if (side === 0) {
      sx = -15; sy = Math.random() * 100; ex = 115; ey = Math.random() * 100;
    } else if (side === 1) {
      sx = 115; sy = Math.random() * 100; ex = -15; ey = Math.random() * 100;
    } else if (side === 2) {
      sx = Math.random() * 100; sy = -15; ex = Math.random() * 100; ey = 115;
    } else {
      sx = Math.random() * 100; sy = 115; ex = Math.random() * 100; ey = -15;
    }

    const currentSpeed = getCurrentSpeedFn();
    const isAutoSync = isAutoSyncFn();
    const duration =
      (Math.random() * 20000 + 40000) /
      (isAutoSync ? 1 : Math.min(Math.abs(currentSpeed), 256));

    const isPerfMode = isPerfModeFn();
    const count = isStarlink ? (isPerfMode ? 8 : 18) : 1;

    for (let i = 0; i < count; i++) {
      const delay = isStarlink
        ? (i * (700 + Math.random() * 400)) / (isAutoSync ? 1 : Math.min(Math.abs(currentSpeed), 256))
        : 0;

      setTimeout(() => {
        const sat = document.createElement('div');
        sat.className = 'satellite';
        sat.style.opacity = (Math.random() * 0.5 + 0.3).toString();
        satLayer.appendChild(sat);

        const startT = performance.now();
        const move = (now: number) => {
          const t = (now - startT) / duration;
          if (t < 1) {
            sat.style.transform = `translate3d(${sx + (ex - sx) * t}vw, ${sy + (ey - sy) * t}vh, 0)`;
            requestAnimationFrame(move);
          } else {
            sat.remove();
          }
        };
        requestAnimationFrame(move);
      }, delay);
    }
  }

  setTimeout(() => {
    const satLoop = () => {
      animateObject(false);
      const isAutoSync = isAutoSyncFn();
      const currentSpeed = getCurrentSpeedFn();
      setTimeout(
        satLoop,
        (Math.random() * 60000 + 40000) / (isAutoSync ? 1 : Math.abs(currentSpeed))
      );
    };

    const starlinkLoop = () => {
      animateObject(true);
      const isAutoSync = isAutoSyncFn();
      const currentSpeed = getCurrentSpeedFn();
      setTimeout(
        starlinkLoop,
        (Math.random() * 120000 + 120000) / (isAutoSync ? 1 : Math.abs(currentSpeed))
      );
    };

    satLoop();
    starlinkLoop();
  }, 5000);
}
