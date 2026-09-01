export interface SunTimes {
  sunrise: number;
  sunset: number;
  solarNoon: number;
  maxAlt: number;
  declDeg: number;
}

export interface HorizontalCoords {
  altitude: number;
  azimuth: number;
}

export interface ScreenCoords {
  x: string;
  y: string;
  dx: number;
  dy: number;
  altitude: number;
  azimuth?: number;
}

export interface FlareElements {
  'h-1': HTMLElement | null;
  'r-1': HTMLElement | null;
  'g-1': HTMLElement | null;
  'g-2': HTMLElement | null;
  't-1': HTMLElement | null;
  'mg-1': HTMLElement | null;
  'mh-1': HTMLElement | null;
  sunFC: HTMLElement | null;
  moonFC: HTMLElement | null;
}
