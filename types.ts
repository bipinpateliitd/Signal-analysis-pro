
export interface SignalData {
  samplingRate: number;
  channels: number[][];
}

export enum FilterType {
  NONE = 'none',
  LOWPASS = 'lowpass',
  HIGHPASS = 'highpass',
  BANDPASS = 'bandpass',
}

export interface FilterSettings {
  type: FilterType;
  cutoff: number | [number, number];
}

export interface PlotPoint {
  x: number;
  y: number;
}
