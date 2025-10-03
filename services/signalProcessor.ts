import { FilterType, FilterSettings, NoiseInfo, Tonal, PersistentTonal, DoaPoint, OrientationData } from '../types';

// --- UTILITY/MATH FUNCTIONS ---

/**
 * Iterative Fast Fourier Transform (Cooley-Tukey Radix-2).
 * Input length MUST be a power of 2.
 */
const fft = (input: number[]): { real: number[], imag: number[] } => {
    const n = input.length;
    if ((n & (n - 1)) !== 0 && n !== 0) {
        throw new Error("FFT input length must be a power of 2.");
    }

    const real = input.slice();
    const imag = new Array(n).fill(0);
    let j = 0;

    for (let i = 0; i < n; i++) {
        if (i < j) {
            [real[i], real[j]] = [real[j], real[i]];
        }
        let m = n >> 1;
        while (j >= m && m > 0) {
            j -= m;
            m >>= 1;
        }
        j += m;
    }

    for (let len = 2; len <= n; len <<= 1) {
        const halfLen = len >> 1;
        const angle = -2 * Math.PI / len;
        const w_real = Math.cos(angle);
        const w_imag = Math.sin(angle);
        for (let i = 0; i < n; i += len) {
            let wk_real = 1;
            let wk_imag = 0;
            for (let k = 0; k < halfLen; k++) {
                const u_real = real[i + k];
                const u_imag = imag[i + k];
                const v_real = real[i + k + halfLen] * wk_real - imag[i + k + halfLen] * wk_imag;
                const v_imag = real[i + k + halfLen] * wk_imag + imag[i + k + halfLen] * wk_real;
                
                real[i + k] = u_real + v_real;
                imag[i + k] = u_imag + v_imag;
                real[i + k + halfLen] = u_real - v_real;
                imag[i + k + halfLen] = u_imag - v_imag;

                const next_wk_real = wk_real * w_real - wk_imag * w_imag;
                wk_imag = wk_real * w_imag + wk_imag * w_real;
                wk_real = next_wk_real;
            }
        }
    }
    return { real, imag };
};

// --- MATRIX UTILITIES (for internal use) ---

const invert3x3 = (A: number[][]): number[][] | null => {
    const a = A[0][0], b = A[0][1], c = A[0][2];
    const d = A[1][0], e = A[1][1], f = A[1][2];
    const g = A[2][0], h = A[2][1], i = A[2][2];
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (det === 0) return null;
    const invDet = 1 / det;
    return [
        [(e * i - f * h) * invDet, (c * h - b * i) * invDet, (b * f - c * e) * invDet],
        [(f * g - d * i) * invDet, (a * i - c * g) * invDet, (c * d - a * f) * invDet],
        [(d * h - e * g) * invDet, (b * g - a * h) * invDet, (a * e - b * d) * invDet]
    ];
};

const matmul3x3 = (A: number[][], B: number[][]): number[][] => {
    const C: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
                C[i][j] += A[i][k] * B[k][j];
            }
        }
    }
    return C;
};

const matVecMul3x3 = (A: number[][], x: number[]): number[] => {
    const y: number[] = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            y[i] += A[i][j] * x[j];
        }
    }
    return y;
};


// --- EXPORTED FUNCTIONS ---

/**
 * Calculates the Fast Fourier Transform of a signal.
 */
export const calculateFFT = (data: number[], samplingRate: number): { magnitudes: number[], frequencies: number[] } => {
    const power = data.length > 0 ? Math.ceil(Math.log2(data.length)) : 0;
    const paddedLength = Math.pow(2, power);
    const paddedData = new Array(paddedLength).fill(0);
    for (let i = 0; i < data.length; i++) {
        paddedData[i] = data[i];
    }

    const { real, imag } = fft(paddedData);
    
    const halfLength = paddedLength / 2;
    const magnitudes = new Array(halfLength);
    const frequencies = new Array(halfLength);

    for (let i = 0; i < halfLength; i++) {
        magnitudes[i] = (2 / paddedLength) * Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        frequencies[i] = i * samplingRate / paddedLength;
    }
    return { magnitudes, frequencies };
};

/**
 * Applies a digital IIR filter.
 * Simplified version assuming 'a[0]' is 1.
 */
const applyIIRFilter = (data: number[], b: number[], a: number[]): number[] => {
    const output = new Array(data.length).fill(0);
    const na = a.length;
    const nb = b.length;
    const x = data;

    for (let i = 0; i < data.length; i++) {
        let y_i = 0;
        // Apply numerator (b) coefficients to input signal (x)
        for (let j = 0; j < nb; j++) {
            if (i - j >= 0) {
                y_i += b[j] * x[i - j];
            }
        }
        // Apply denominator (a) coefficients to past output signal (y)
        for (let j = 1; j < na; j++) {
            if (i - j >= 0) {
                y_i -= a[j] * output[i - j];
            }
        }
        output[i] = y_i;
    }
    return output;
};


/**
 * Designs a 2nd order Butterworth filter.
 * This is a simplified implementation. Real-world applications often use more complex designs.
 */
const designButterworthFilter = (type: FilterType, cutoff: number | [number, number], samplingRate: number): { b: number[], a: number[] } => {
    
    const getCoeffs = (wc: number) => {
        const C = 1 / Math.tan(wc / 2);
        const C2 = C * C;
        const sqrt2C = Math.sqrt(2) * C;
        const a0 = C2 + sqrt2C + 1;
        const a1 = 2 * (1 - C2);
        const a2 = C2 - sqrt2C + 1;
        return {a0, a1, a2};
    };

    let b: number[] = [], a: number[] = [];

    if (type === FilterType.LOWPASS && typeof cutoff === 'number') {
        const wc = 2 * Math.PI * cutoff / samplingRate;
        const { a0, a1, a2 } = getCoeffs(wc);
        b = [1, 2, 1].map(v => v / a0);
        a = [1, a1 / a0, a2 / a0];
    } else if (type === FilterType.HIGHPASS && typeof cutoff === 'number') {
        const wc = 2 * Math.PI * cutoff / samplingRate;
        const { a0, a1, a2 } = getCoeffs(wc);
        const C = 1 / Math.tan(wc / 2);
        const C2 = C * C;
        b = [C2, -2 * C2, C2].map(v => v / a0);
        a = [1, a1 / a0, a2 / a0];
    } else if (type === FilterType.BANDPASS && Array.isArray(cutoff)) {
        const [lowCutoff, highCutoff] = cutoff;
        
        if (lowCutoff <= 0 || highCutoff <= lowCutoff || highCutoff >= samplingRate / 2) {
            console.warn("Invalid bandpass filter settings. Returning unfiltered signal.");
            return { b: [1], a: [1] };
        }

        const f0 = Math.sqrt(lowCutoff * highCutoff); // Center frequency (geometric mean)
        const Q = f0 / (highCutoff - lowCutoff); // Q factor

        const w0 = 2 * Math.PI * f0 / samplingRate;
        const alpha = Math.sin(w0) / (2 * Q);

        const b0 = alpha;
        const b1 = 0;
        const b2 = -alpha;
        
        const a0_val = 1 + alpha;
        const a1 = -2 * Math.cos(w0);
        const a2 = 1 - alpha;
        
        // Return normalized coefficients
        b = [b0 / a0_val, b1 / a0_val, b2 / a0_val];
        a = [1, a1 / a0_val, a2 / a0_val];
    } else {
         return { b: [1], a: [1] };
    }
    
    return { b, a };
};

/**
 * Applies a filter to the signal data.
 */
export const applyFilter = (
  channelData: number[],
  filterType: FilterType,
  filterSettings: FilterSettings,
  samplingRate: number
): number[] => {
    if (filterType === FilterType.NONE) {
        return channelData;
    }
    const { b, a } = designButterworthFilter(filterType, filterSettings.cutoff, samplingRate);
    if (b.length === 1 && a.length === 1 && b[0] === 1 && a[0] === 1) {
        return channelData; // Pass-through for unimplemented or invalid filters
    }
    return applyIIRFilter(channelData, b, a);
};


/**
 * Normalizes a signal using its Root Mean Square (RMS).
 */
export const normalizeRms = (channelData: number[]): number[] => {
    if (channelData.length === 0) return [];
    
    const sumOfSquares = channelData.reduce((acc, val) => acc + val * val, 0);
    const rms = Math.sqrt(sumOfSquares / channelData.length);

    if (rms === 0) {
        return channelData; // Avoid division by zero
    }
    
    return channelData.map(val => val / rms);
};


/**
 * Calculates the Power Spectral Density (PSD) using Welch's method.
 */
export const calculateWelchPsd = (data: number[], samplingRate: number, nperseg: number = 256): { freqs: number[], psd: number[] } => {
    if (data.length < nperseg) {
        nperseg = Math.pow(2, Math.floor(Math.log2(data.length)));
        if (nperseg === 0) return { freqs: [], psd: [] };
    }
    
    const nfft = Math.pow(2, Math.ceil(Math.log2(nperseg)));
    const hopSize = Math.floor(nperseg / 2);
    const window = new Array(nperseg).fill(0).map((_, i) => 0.5 * (1 - Math.cos(2 * Math.PI * i / (nperseg - 1)))); // Hann window
    
    const freqs = Array.from({ length: nfft / 2 + 1 }, (_, i) => i * samplingRate / nfft);
    const psd = new Array(nfft / 2 + 1).fill(0);
    let numSegments = 0;

    for (let i = 0; i + nperseg <= data.length; i += hopSize) {
        const segment = data.slice(i, i + nperseg);
        const windowedSegment = segment.map((val, idx) => val * window[idx]);
        
        const paddedData = new Array(nfft).fill(0);
        windowedSegment.forEach((val, idx) => paddedData[idx] = val);
        
        const { real, imag } = fft(paddedData);
        
        for (let j = 0; j <= nfft / 2; j++) {
            psd[j] += (real[j] * real[j] + imag[j] * imag[j]);
        }
        numSegments++;
    }

    if (numSegments > 0) {
        const windowPower = window.reduce((acc, val) => acc + val * val, 0);
        const scale = 1 / (samplingRate * windowPower * numSegments);
        for (let i = 0; i < psd.length; i++) {
            psd[i] *= scale;
            if (i > 0 && i < psd.length - 1) {
                psd[i] *= 2; // Account for two-sided spectrum
            }
        }
    }
    
    return { freqs, psd };
};


/**
 * Estimates noise characteristics of a signal.
 */
export const estimateNoise = (channelData: number[], samplingRate: number, frameLengthSec: number, percentile: number): NoiseInfo => {
    const frameLength = Math.floor(frameLengthSec * samplingRate);
    const hopLength = Math.floor(frameLength / 2);
    
    const frameEnergies: number[] = [];
    const frameTimes: number[] = [];

    for (let i = 0; i + frameLength <= channelData.length; i += hopLength) {
        const frame = channelData.slice(i, i + frameLength);
        const energy = frame.reduce((sum, val) => sum + val * val, 0) / frameLength;
        frameEnergies.push(energy);
        frameTimes.push((i + frameLength / 2) / samplingRate);
    }

    if (frameEnergies.length === 0) {
        return {
            noise_power_db: -Infinity,
            noise_percentage: 0,
            noise_samples_count: 0,
            freqs: [],
            psd_db: [],
            frameEnergies: [],
            frameTimes: [],
            threshold: 0,
            noiseMask: [],
        };
    }

    const sortedEnergies = [...frameEnergies].sort((a, b) => a - b);
    const threshold = sortedEnergies[Math.floor(percentile / 100 * sortedEnergies.length)];
    
    const noiseMask = frameEnergies.map(e => e <= threshold);
    let noiseSamples: number[] = [];
    let noiseSamplesCount = 0;

    for (let i = 0; i < noiseMask.length; i++) {
        if (noiseMask[i]) {
            const start = i * hopLength;
            const end = start + frameLength;
            const frame = channelData.slice(start, end);
            noiseSamples.push(...frame);
            noiseSamplesCount += frame.length;
        }
    }

    const noisePower = noiseSamples.length > 0 ? noiseSamples.reduce((sum, val) => sum + val * val, 0) / noiseSamples.length : 0;
    const noise_power_db = 10 * Math.log10(noisePower || 1e-12);
    const noise_percentage = (noiseSamplesCount / channelData.length) * 100;

    const { freqs, psd } = noiseSamples.length > 0 ? calculateWelchPsd(noiseSamples, samplingRate) : { freqs: [], psd: [] };
    const psd_db = psd.map(p => 10 * Math.log10(p + 1e-15));
    
    return {
        noise_power_db,
        noise_percentage,
        noise_samples_count: noiseSamplesCount,
        freqs,
        psd_db,
        frameEnergies,
        frameTimes,
        threshold,
        noiseMask,
    };
};

/**
 * Detects persistent tonals in a signal.
 */
export const detectTonals = (
    channelData: number[],
    samplingRate: number,
    options: {
        freqRange: [number, number];
        minSnrDb: number;
        frameDuration: number;
        minFramesPresent: number;
    }
): PersistentTonal[] => {
    const { freqRange, minSnrDb, frameDuration, minFramesPresent } = options;
    const frameSize = Math.pow(2, Math.round(Math.log2(frameDuration * samplingRate)));
    if (channelData.length < frameSize) return [];
    const hopSize = Math.floor(frameSize / 4);
    
    const allFramesTonals: Tonal[][] = [];
    const freqResolution = samplingRate / frameSize;

    for (let i = 0; i + frameSize <= channelData.length; i += hopSize) {
        const frameData = channelData.slice(i, i + frameSize);
        const { freqs, psd } = calculateWelchPsd(frameData, samplingRate, frameSize);
        const psd_db = psd.map(p => 10 * Math.log10(p + 1e-15));
        
        // Simple peak detection
        const frameTonals: Tonal[] = [];
        for (let k = 1; k < psd_db.length - 1; k++) {
            if (freqs[k] >= freqRange[0] && freqs[k] <= freqRange[1]) {
                if (psd_db[k] > psd_db[k - 1] && psd_db[k] > psd_db[k + 1]) {
                    
                    // Estimate noise floor from local neighborhood median
                    const noiseWindowHz = 50; // Hz on each side of the peak
                    const noiseWindowBins = Math.round(noiseWindowHz / freqResolution);
                    
                    const noiseEstimateValues: number[] = [];
                    // Bins before the peak, excluding the peak itself
                    for (let j = Math.max(0, k - noiseWindowBins); j < k - 1; j++) {
                        noiseEstimateValues.push(psd_db[j]);
                    }
                    // Bins after the peak, excluding the peak itself
                    for (let j = k + 2; j <= Math.min(psd_db.length - 1, k + noiseWindowBins); j++) {
                        noiseEstimateValues.push(psd_db[j]);
                    }

                    let noiseFloor: number;
                    if (noiseEstimateValues.length > 5) { // Need enough samples for a stable estimate
                        const sortedNoiseValues = [...noiseEstimateValues].sort((a, b) => a - b);
                        noiseFloor = sortedNoiseValues[Math.floor(sortedNoiseValues.length / 2)]; // Median is robust
                    } else {
                        // Fallback to global median if local window is too small (e.g., at edges)
                        const globalSortedPsd = [...psd_db].sort((a, b) => a - b);
                        noiseFloor = globalSortedPsd[Math.floor(globalSortedPsd.length / 2)];
                    }

                    const snr = psd_db[k] - noiseFloor;
                    if (snr >= minSnrDb) {
                        frameTonals.push({ frequency: freqs[k], power: psd_db[k], snr });
                    }
                }
            }
        }
        allFramesTonals.push(frameTonals);
    }
    
    // Tonal association logic (simplified)
    const persistentTonals: { [key: number]: Tonal[] } = {};
    const freqTolerance = 50; // Hz

    for (const frame of allFramesTonals) {
        for (const tonal of frame) {
            let found = false;
            for (const keyFreq in persistentTonals) {
                if (Math.abs(tonal.frequency - Number(keyFreq)) < freqTolerance) {
                    persistentTonals[keyFreq].push(tonal);
                    found = true;
                    break;
                }
            }
            if (!found) {
                persistentTonals[Math.round(tonal.frequency)] = [tonal];
            }
        }
    }

    const result: PersistentTonal[] = [];
    for (const keyFreq in persistentTonals) {
        const tonals = persistentTonals[keyFreq];
        if (tonals.length >= minFramesPresent) {
            const n_detections = tonals.length;
            const frequency_mean = tonals.reduce((sum, t) => sum + t.frequency, 0) / n_detections;
            const snr_mean = tonals.reduce((sum, t) => sum + t.snr, 0) / n_detections;
            const power_mean = tonals.reduce((sum, t) => sum + t.power, 0) / n_detections;
            result.push({ frequency_mean, snr_mean, power_mean, n_detections });
        }
    }

    return result;
};

/**
 * Calculates Direction of Arrival (DOA) over time.
 */
export const calculateDoaVsTime = (
    hData: number[],
    vxData: number[],
    vyData: number[],
    samplingRate: number,
    tonalFreq: number,
    frameDuration: number
): Omit<DoaPoint, 'doa_raw'>[] => {
    const frameSize = Math.pow(2, Math.round(Math.log2(frameDuration * samplingRate)));
    if (hData.length < frameSize) return [];
    const hopSize = Math.floor(frameSize / 4);
    const freqBin = Math.round(tonalFreq * frameSize / samplingRate);

    const doaPoints: Omit<DoaPoint, 'doa_raw'>[] = [];
    
    // Create padded arrays for FFT
    const hPadded = new Array(frameSize).fill(0);
    const vxPadded = new Array(frameSize).fill(0);
    const vyPadded = new Array(frameSize).fill(0);

    for (let i = 0; i + frameSize <= hData.length; i += hopSize) {
        for(let j=0; j<frameSize; j++) {
            hPadded[j] = hData[i+j];
            vxPadded[j] = vxData[i+j];
            vyPadded[j] = vyData[i+j];
        }

        const hFft = fft(hPadded);
        const vxFft = fft(vxPadded);
        const vyFft = fft(vyPadded);

        const h_complex = { real: hFft.real[freqBin], imag: hFft.imag[freqBin] };
        const vx_complex = { real: vxFft.real[freqBin], imag: vxFft.imag[freqBin] };
        const vy_complex = { real: vyFft.real[freqBin], imag: vyFft.imag[freqBin] };
        
        // G_ph = Vx * H_conj
        const G_ph = {
            real: vx_complex.real * h_complex.real + vx_complex.imag * h_complex.imag,
            imag: vx_complex.imag * h_complex.real - vx_complex.real * h_complex.imag,
        };
        // G_pv = Vy * H_conj
        const G_pv = {
            real: vy_complex.real * h_complex.real + vy_complex.imag * h_complex.imag,
            imag: vy_complex.imag * h_complex.real - vy_complex.real * h_complex.imag,
        };

        const doaRad = Math.atan2(G_pv.real, G_ph.real);
        let doaDeg = (doaRad * 180 / Math.PI + 360) % 360; // Convert to 0-360 degrees
        
        // Confidence calculation (simplified coherence)
        const S_pp = h_complex.real**2 + h_complex.imag**2;
        const S_xx = vx_complex.real**2 + vx_complex.imag**2;
        const S_yy = vy_complex.real**2 + vy_complex.imag**2;

        const coherence_h = (G_ph.real**2 + G_ph.imag**2) / (S_pp * S_xx + 1e-9);
        const coherence_v = (G_pv.real**2 + G_pv.imag**2) / (S_pp * S_yy + 1e-9);
        const confidence = Math.sqrt(Math.max(0, Math.min(1, coherence_h)) * Math.max(0, Math.min(1, coherence_v)));

        const time = (i + frameSize / 2) / samplingRate;
        
        if (isFinite(doaDeg) && isFinite(confidence)) {
            doaPoints.push({ time, doa: doaDeg, confidence });
        }
    }

    return doaPoints;
};


/**
 * Interpolates orientation data to find roll, pitch, and yaw at a specific time.
 */
export const getInterpolatedOrientation = (time: number, data: OrientationData[]): { roll: number, pitch: number, yaw: number } => {
    if (!data || data.length === 0) return { roll: 0, pitch: 0, yaw: 0 };
    if (time <= data[0].time) return { roll: data[0].roll, pitch: data[0].pitch, yaw: data[0].yaw };
    if (time >= data[data.length - 1].time) return { roll: data[data.length - 1].roll, pitch: data[data.length - 1].pitch, yaw: data[data.length - 1].yaw };

    let low = 0, high = data.length - 1, index = -1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (data[mid].time <= time) {
            index = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    
    const p1 = data[index];
    const p2 = data[index + 1];
    if (!p2) return p1;

    const t = (time - p1.time) / (p2.time - p1.time);
    if (isNaN(t) || !isFinite(t)) return p1;

    const roll = p1.roll + t * (p2.roll - p1.roll);
    const pitch = p1.pitch + t * (p2.pitch - p1.pitch);
    const yaw = p1.yaw + t * (p2.yaw - p1.yaw);

    return { roll, pitch, yaw };
};


/**
 * Corrects a raw DOA azimuth using IMU orientation data.
 */
export const correctDoa = (doaAzimuth: number, imuRoll: number, imuPitch: number, imuYaw: number, elevationFixed: number = 0): number => {
    const doaRad = (doaAzimuth * Math.PI) / 180;
    const rollRad = (imuRoll * Math.PI) / 180;
    const pitchRad = (imuPitch * Math.PI) / 180;
    const yawRad = (imuYaw * Math.PI) / 180;
    const elevationRad = (elevationFixed * Math.PI) / 180;
    
    const x_prime = Math.cos(doaRad);
    const y_prime = Math.sin(doaRad);
    const z_prime = Math.sin(elevationRad);
    const vector = [x_prime, y_prime, z_prime];

    const cosY = Math.cos(yawRad), sinY = Math.sin(yawRad);
    const R_yaw = [[cosY, -sinY, 0], [sinY, cosY, 0], [0, 0, 1]];
    
    const cosP = Math.cos(pitchRad), sinP = Math.sin(pitchRad);
    const R_pitch = [[cosP, 0, sinP], [0, 1, 0], [-sinP, 0, cosP]];
    
    const cosR = Math.cos(rollRad), sinR = Math.sin(rollRad);
    const R_roll = [[1, 0, 0], [0, cosR, -sinR], [0, sinR, cosR]];

    const R_total = matmul3x3(matmul3x3(R_yaw, R_pitch), R_roll);
    const R_inverse = invert3x3(R_total);

    if (!R_inverse) return doaAzimuth;

    const corrected_vector = matVecMul3x3(R_inverse, vector);
    let corrected_azimuth = Math.atan2(corrected_vector[1], corrected_vector[0]);
    corrected_azimuth = (corrected_azimuth * 180) / Math.PI;

    return (corrected_azimuth + 360) % 360;
};