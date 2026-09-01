import type { SunTimes } from '../types/astronomy';

interface SkyKeyframe {
  m: number;
  z: [number, number, number];
  hz: [number, number, number];
}

export function calcSkyColors(mG: number, solar: SunTimes): {
  zenith: string;
  horizon: string;
  brightness: number;
  colors: number[];
} {
  const dawnStart = solar.sunrise - 135;
  const preSunset = solar.sunset - 135;
  const sunsetEnd = solar.sunset + 30;

  const kf: SkyKeyframe[] = [
    { m: -1440, z: [5, 10, 25], hz: [10, 20, 35] },
    { m: dawnStart, z: [5, 10, 25], hz: [10, 20, 35] },
    { m: solar.sunrise, z: [40, 80, 140], hz: [255, 150, 100] },
    { m: (solar.sunrise + solar.sunset) / 2, z: [25, 90, 180], hz: [180, 230, 255] },
    { m: preSunset, z: [25, 90, 180], hz: [180, 230, 255] },
    { m: solar.sunset, z: [20, 30, 80], hz: [245, 125, 75] },
    { m: solar.sunset + 15, z: [10, 15, 40], hz: [60, 30, 60] },
    { m: sunsetEnd, z: [5, 10, 25], hz: [10, 20, 35] },
    { m: 1440, z: [5, 10, 25], hz: [10, 20, 35] },
  ];

  let r = 10, g = 20, b = 35;
  let zr = 5, zg = 10, zb = 25;
  let zenith = 'rgb(5, 10, 25)';
  let horizon = 'rgb(10, 20, 35)';
  let brightness = 15;

  for (let i = 0; i < kf.length - 1; i++) {
    if (mG >= kf[i].m && mG < kf[i + 1].m) {
      const t = (mG - kf[i].m) / (kf[i + 1].m - kf[i].m);
      const l = (c1: number, c2: number) => c1 + (c2 - c1) * t;
      r = Math.round(l(kf[i].hz[0], kf[i + 1].hz[0]));
      g = Math.round(l(kf[i].hz[1], kf[i + 1].hz[1]));
      b = Math.round(l(kf[i].hz[2], kf[i + 1].hz[2]));
      zr = Math.round(l(kf[i].z[0], kf[i + 1].z[0]));
      zg = Math.round(l(kf[i].z[1], kf[i + 1].z[1]));
      zb = Math.round(l(kf[i].z[2], kf[i + 1].z[2]));
      zenith = `rgb(${zr}, ${zg}, ${zb})`;
      horizon = `rgb(${r}, ${g}, ${b})`;
      brightness = (r + g + b) / 3;
      break;
    }
  }

  let tContrast = Math.min(1, Math.max(0, (brightness - 22) / 200));
  if (tContrast < 0.5) tContrast *= 0.5;
  if (tContrast > 0.5) tContrast = tContrast * 0.5 + 0.5;

  const dark_colors = [20, 25, 35, 0.65, 255, 255, 255, 255, 255, 255, 0x90, 0xca, 0xf9, 0x00, 0x33, 0x54, 255, 0.1];
  const bright_colors = [235, 245, 255, 0.45, 0, 20, 40, 0, 20, 50, 0x00, 0x7a, 0xff, 0xfa, 0xfa, 0xfa, 55, 0.2];
  const colors = dark_colors.map((e, i) => e * (1 - tContrast) + bright_colors[i] * tContrast);

  return { zenith, horizon, brightness, colors };
}

export function calcTwilight(mG: number, solar: SunTimes): { starOpacity: number; starMaskY: number } {
  let sOp = 0;
  let sMaskY = -50;
  const twilightDuration = 45;

  if (mG >= solar.sunset - 15 && mG <= solar.sunset - 15 + twilightDuration) {
    // 일몰 15분 전부터 황혼: 별들이 나타나기 시작
    sOp = (mG - (solar.sunset - 15)) / twilightDuration;
    sMaskY = -50 + (200 * sOp);
  } else if (mG >= solar.sunrise + 15 - twilightDuration && mG <= solar.sunrise + 15) {
    // 일출 15분 후까지 새벽: 별들이 사라짐
    sOp = 1 - (mG - (solar.sunrise + 15 - twilightDuration)) / twilightDuration;
    sMaskY = -50 + (200 * sOp);
  } else if (mG > solar.sunset - 15 + twilightDuration || mG < solar.sunrise + 15 - twilightDuration) {
    // 한밤중/황혼 이후: 별들이 100% 보임
    sOp = 1;
    sMaskY = 150;
  } else {
    // 한낮: 별들이 보이지 않음
    sOp = 0;
    sMaskY = -50;
  }

  return {
    starOpacity: Math.max(0, Math.min(1, sOp)),
    starMaskY: sMaskY,
  };
}
