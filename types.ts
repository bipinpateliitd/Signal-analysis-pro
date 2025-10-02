
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

export interface SignalData {
  samplingRate: number;
  channels: number[][];
  channelNames?: string[];
  headerInfo?: Record<string, string>;
}

export interface PlotPoint {
  x: number;
  y: number;
}

export interface NoiseInfo {
  noise_power_db: number;
  noise_percentage: number;
  noise_samples_count: number;
  freqs: number[];
  psd_db: number[];
  frameEnergies: number[];
  frameTimes: number[];
  threshold: number;
  noiseMask: boolean[];
}

export interface Tonal {
  frequency: number;
  power: number;
  snr: number;
}

export interface PersistentTonal {
  frequency_mean: number;
  snr_mean: number;
  power_mean: number;
  n_detections: number;
}

export type ChannelRole = 'hydrophone' | 'vx' | 'vy';

export interface ChannelRoles {
  hydrophone: number | null;
  vx: number | null;
  vy: number | null;
}

export interface DoaPoint {
    time: number;
    doa: number;
    confidence: number;
}

export interface OrientationData {
    time: number;
    roll: number;
    pitch: number;
    yaw: number;
}