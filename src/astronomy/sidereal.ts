import { LON, J2000_EPOCH_JD } from './constants';

// 서울 경도(126.9780 East) 기준 지방항성시(LST) 및 실시간 일주/연주운동 연동 엔진
export function getSeoulSiderealTime(simDate: Date): number {
  // Julian Date 계산 (UTC 기준 일수 계산)
  const jd = (simDate.getTime() / 86400000) + 2440587.5;
  const d = jd - J2000_EPOCH_JD; // J2000.0 Epoch 기준 경과 일수

  // 그리니치 평균 항성시(GMST) 계산 (도 단위)
  let gmst = (280.46061837 + 360.98564736629 * d) % 360;
  if (gmst < 0) gmst += 360;

  // 서울 경도를 더해 지방항성시(LST) 계산
  let lst = (gmst + LON) % 360;
  if (lst < 0) lst += 360;

  return lst;
}

// Serge Brunier 전천 이미지의 방향성을 서울의 실시간 밤하늘과 일치시키기 위한 보정값 (357도)
export function getStarRotation(lst: number): number {
  return (357 - lst) % 360;
}
