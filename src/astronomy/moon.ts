import { LAT, SYNODIC_MONTH } from './constants';
import type { SunTimes, ScreenCoords } from '../types/astronomy';

// 실제 날짜 기준의 달의 위상 계산 엔진 (New Moon Epoch: 2000-01-06 18:14 UTC)
export function getMoonAge(date: Date): number {
  const time = date.getTime();
  const jd = (time / 86400000) + 2440587.5;
  let age = (jd - 2451550.26) % SYNODIC_MONTH;
  if (age < 0) age += SYNODIC_MONTH;
  return age;
}

// 달의 황도상 위상을 수학적 SVG Path 데이터로 변환하는 생성기
export function getMoonPath(age: number): string {
  const r = 16;
  const phase = age / SYNODIC_MONTH; // 0 to 1
  const rx = Math.abs(Math.cos(phase * 2 * Math.PI)) * r;
  const sweep2 = (phase < 0.25 || phase >= 0.75) ? 0 : 1;

  if (phase < 0.5) {
    // Waxing Moon (오른쪽이 차오름)
    return `M 16 0 A 16 16 0 0 1 16 32 A ${rx} 16 0 0 ${sweep2} 16 0 Z`;
  } else {
    // Waning Moon (왼쪽이 차오름)
    return `M 16 0 A ${rx} 16 0 0 ${sweep2} 16 32 A 16 16 0 0 1 16 0 Z`;
  }
}

export function calcMoonCoords(
  mG: number,
  solar: SunTimes,
  moonAge: number
): { coords: ScreenCoords; haMoon: number; elongation: number } {
  const elongation = (moonAge / SYNODIC_MONTH) * 360;

  // 태양의 24시간 연속 시간각 계산 (태양 남중 기준, 1440분 = 360도 연속 회전)
  const solarNoon = (solar.sunrise + solar.sunset) / 2;
  let haSun = ((mG - solarNoon) * 0.25) % 360;
  haSun = ((haSun + 180) % 360 + 360) % 360 - 180;

  // 달의 시간각 (Hour Angle): 태양의 연속 시간각에서 이각(elongation)을 차감하여 자정(12시) 경계에서도 텔레포트 없이 완벽히 연속 회전
  let haMoon = haSun - elongation;
  haMoon = ((haMoon + 180) % 360 + 360) % 360 - 180; // 범위 [-180, 180] 보정

  let moonCoords: ScreenCoords = { x: '0vw', y: '150vh', dx: 0, dy: 100, altitude: -10 };

  if (haMoon >= -105 && haMoon <= 105) {
    const rad = (haMoon * Math.PI) / 180;

    const dx = 38 * Math.sin(rad);
    // 황도상 달의 위치에 따른 적위 및 남중고도 계산 (보름달은 태양 반대 적위, 신월은 태양과 같은 적위)
    const moonDeclDeg = -solar.declDeg * Math.cos((elongation * Math.PI) / 180);
    const moonMaxAlt = Math.max(15, Math.min(80, 90 - LAT + moonDeclDeg));
    const R_y = 25 + moonMaxAlt * 0.45;
    const dy = 25 - R_y * Math.cos(rad);
    const alt = (25 - dy) / 0.62;

    moonCoords = {
      x: `calc(50vw + ${dx}vmax)`,
      y: `calc(50vh + ${dy}vmax)`,
      dx,
      dy,
      altitude: alt,
    };
  }

  return { coords: moonCoords, haMoon, elongation };
}
