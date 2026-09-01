import { LAT, LON } from './constants';
import type { SunTimes, ScreenCoords } from '../types/astronomy';

let cachedSunTimes: SunTimes | null = null;
let lastCachedDateStr = '';

export function getSunTimes(date: Date): SunTimes {
  const dateStr = date.toDateString();
  if (cachedSunTimes && lastCachedDateStr === dateStr) return cachedSunTimes;

  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000);
  const rad = Math.PI / 180;
  const gamma = (2 * Math.PI / 365) * (dayOfYear - 1);
  const eqtime = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma)
  );

  // 태양 적위 (declination)
  const decl = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma);
  const ha_rad = Math.acos(
    Math.cos(90.833 * rad) / (Math.cos(LAT * rad) * Math.cos(decl)) -
    Math.tan(LAT * rad) * Math.tan(decl)
  );
  const ha = ha_rad / rad;

  // 태양의 최대 남중고도 (서울 기준 여름/겨울 편차 반영)
  const maxAlt = 90 - LAT + (decl / rad);

  lastCachedDateStr = dateStr;
  cachedSunTimes = {
    sunrise: 720 - 4 * (LON + ha) - eqtime + 540,
    sunset: 720 - 4 * (LON - ha) - eqtime + 540,
    solarNoon: 720 - 4 * LON - eqtime + 540,
    maxAlt,
    declDeg: decl / rad,
  };
  return cachedSunTimes;
}

export function calcSunCoords(mG: number, solar: SunTimes): ScreenCoords {
  const dayLength = solar.sunset - solar.sunrise;
  const sunT = (mG - solar.sunrise) / dayLength; // 0 (sunrise) to 1 (sunset)

  let sunCoords: ScreenCoords = { x: '0vw', y: '150vh', dx: 0, dy: 100, altitude: -10 };

  if (mG >= solar.sunrise - 20 && mG <= solar.sunset + 20) {
    const progAngle = (sunT * 2 - 1) * 90; // -90 to +90 degrees
    const rad = (progAngle * Math.PI) / 180;

    const dx = 38 * Math.sin(rad);
    const maxAlt = solar.maxAlt;
    const R_y = 25 + maxAlt * 0.45;
    const dy = 25 - R_y * Math.cos(rad);
    const alt = (25 - dy) / 0.62;

    sunCoords = {
      x: `calc(50vw + ${dx}vmax)`,
      y: `calc(50vh + ${dy}vmax)`,
      dx,
      dy,
      altitude: alt,
    };
  }

  return sunCoords;
}
