import { FilterType, FilterSettings, Tonal, PersistentTonal, DoaPoint } from '../types';

// Iterative FFT (Cooley-Tukey)
const fft = (input: number[]): { real: number[], imag: number[] } => {
    const n = input.length;
    // The calling function (calculateFFT) pads to a power of 2, so this check is a safeguard.
    if ((n & (n - 1)) !== 0 && n !== 0) {
        console.error("FFT input length must be a power of 2.");
        return { real: [], imag: [] };
    }

    // Bit-reversal permutation
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

    // Cooley-Tukey FFT
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


export const calculateFFT = (data: number[], samplingRate: number) => {
    // Pad with zeros to the next power of 2 for FFT efficiency
    const power = data.length > 0 ? Math.ceil(Math.log2(data.length)) : 0;
    const paddedLength = Math.pow(2, power);
    const paddedData = new Array(paddedLength).fill(0);
    for (let i = 0; i < data.length; i++) {
        paddedData[i] = data[i];
    }
    
    const { real, imag } = fft(paddedData);
    
    const N = paddedLength;
    const halfLength = Math.floor(N / 2) + 1;
    const magnitudes = new Array(halfLength);
    const frequencies = new Array(halfLength);

    for (let i = 0; i < halfLength; i++) {
        const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        if (i === 0 || i === N / 2) { // DC and Nyquist
            magnitudes[i] = mag / N;
        } else { // Other frequencies
            magnitudes[i] = (2 * mag) / N;
        }
        frequencies[i] = i * samplingRate / N;
    }

    return { magnitudes, frequencies };
};

export const normalizeRms = (signal: number[]): number[] => {
  if (signal.length === 0) {
    return [];
  }

  const sumOfSquares = signal.reduce((acc, val) => acc + val * val, 0);
  const meanOfSquares = sumOfSquares / signal.length;
  const rms = Math.sqrt(meanOfSquares);

  const epsilon = 1e-15;
  const denominator = rms + epsilon;

  // If RMS is effectively zero, return an array of zeros to avoid artifacts
  if (rms < epsilon) {
    return new Array(signal.length).fill(0);
  }

  return signal.map(val => val / denominator);
};

const percentile = (arr: number[], p: number): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * (p / 100);
    const base = Math.floor(pos);
    const rest = pos - base;
    if (sorted[base + 1] !== undefined) {
        return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
    } else {
        return sorted[base];
    }
};

const median = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const _detect_signal_activity = (signal: number[], samplingRate: number, frameLength: number, percentileThreshold: number) => {
    const frameSamples = Math.floor(frameLength * samplingRate);
    if (frameSamples <= 0) {
        return { noiseMask: [], frameEnergies: [], frameTimes: [], threshold: 0 };
    }
    const nFrames = Math.floor(signal.length / frameSamples);
    
    const frameEnergies = new Array(nFrames).fill(0);
    const frameTimes = new Array(nFrames).fill(0);

    for (let i = 0; i < nFrames; i++) {
        const start = i * frameSamples;
        const end = start + frameSamples;
        let energy = 0;
        for (let j = start; j < end; j++) {
            energy += signal[j] * signal[j];
        }
        frameEnergies[i] = energy;
        frameTimes[i] = (start + end) / 2 / samplingRate;
    }

    const threshold = percentile(frameEnergies, percentileThreshold);
    const noiseMask = frameEnergies.map(energy => energy <= threshold);
    
    return { noiseMask, frameEnergies, frameTimes, threshold };
};

export const calculateWelchPsd = (data: number[], samplingRate: number, nperseg: number) => {
    if (data.length < nperseg) {
        return { freqs: [], psd: [] };
    }

    const noverlap = Math.floor(nperseg / 2);
    const step = nperseg - noverlap;
    const numSegments = Math.floor((data.length - noverlap) / step);
    
    if (numSegments <= 0) {
        return { freqs: [], psd: [] };
    }

    const hannWindow = new Array(nperseg);
    for (let i = 0; i < nperseg; i++) {
        hannWindow[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / nperseg));
    }
    
    const S2 = hannWindow.reduce((acc, val) => acc + val * val, 0);
    const scale = 1.0 / (samplingRate * S2);

    const halfLength = Math.floor(nperseg / 2) + 1;
    const avgPsd = new Array(halfLength).fill(0);

    for (let i = 0; i < numSegments; i++) {
        const segment = data.slice(i * step, i * step + nperseg);
        const windowedSegment = segment.map((val, idx) => val * hannWindow[idx]);
        
        // nperseg is a power of 2, so existing fft is fine
        const { real, imag } = fft(windowedSegment); 
        
        for (let k = 0; k < halfLength; k++) {
            const periodogram = real[k] * real[k] + imag[k] * imag[k];
            if (k > 0 && k < halfLength -1) {
                avgPsd[k] += 2 * periodogram;
            } else {
                 avgPsd[k] += periodogram;
            }
        }
    }
    
    const freqs = new Array(halfLength);
    for (let i = 0; i < halfLength; i++) {
        freqs[i] = i * samplingRate / nperseg;
        avgPsd[i] /= numSegments;
        avgPsd[i] *= scale;
    }
    
    return { freqs, psd: avgPsd };
};

export const estimateNoise = (signal: number[], samplingRate: number, frameLength: number, percentileThreshold: number) => {
    const { noiseMask, frameEnergies, frameTimes, threshold } = _detect_signal_activity(signal, samplingRate, frameLength, percentileThreshold);

    const frameSamples = Math.floor(frameLength * samplingRate);
    const noiseSamples: number[] = [];
    
    if (frameSamples > 0) {
        noiseMask.forEach((isNoise, i) => {
            if (isNoise) {
                const start = i * frameSamples;
                const end = start + frameSamples;
                for (let j = start; j < end && j < signal.length; j++) {
                    noiseSamples.push(signal[j]);
                }
            }
        });
    }

    let noise_power: number;
    let noise_power_db: number;
    
    if (noiseSamples.length === 0) {
        noise_power = signal.length > 0 ? (signal.reduce((acc, val) => acc + val * val, 0) / signal.length) * 0.1 : 0;
        noise_power_db = 10 * Math.log10(noise_power + 1e-15);
    } else {
        noise_power = noiseSamples.reduce((acc, val) => acc + val * val, 0) / noiseSamples.length;
        noise_power_db = 10 * Math.log10(noise_power + 1e-15);
    }
    const noise_percentage = signal.length > 0 ? (100 * noiseSamples.length / signal.length) : 0;

    let freqs: number[] = [];
    let psd_db: number[] = [];
    const nperseg = 1024;
    
    if (noiseSamples.length > nperseg) {
        const { freqs: noise_freqs, psd } = calculateWelchPsd(noiseSamples, samplingRate, nperseg);
        freqs = noise_freqs;
        psd_db = psd.map(val => 10 * Math.log10(val + 1e-15));
    }
    
    return {
        noise_power_db,
        noise_percentage,
        noise_samples_count: noiseSamples.length,
        freqs,
        psd_db,
        frameEnergies,
        frameTimes,
        threshold,
        noiseMask,
    };
};

/**
 * Finds peaks in a 1D array based on height, prominence, and distance.
 * This is a simplified implementation inspired by SciPy's find_peaks.
 */
const findPeaks = (x: number[], options: { height: number; prominence: number; distance: number }): number[] => {
    const { height, prominence, distance } = options;
    const peaks: number[] = [];

    // 1. Find all local maxima
    for (let i = 1; i < x.length - 1; i++) {
        if (x[i] > x[i - 1] && x[i] > x[i + 1]) {
            if (x[i] >= height) {
                peaks.push(i);
            }
        }
    }
     if (x.length > 1 && x[0] > x[1] && x[0] >= height) peaks.unshift(0);
     if (x.length > 1 && x[x.length - 1] > x[x.length - 2] && x[x.length-1] >= height) peaks.push(x.length - 1);


    // 2. Filter by prominence
    const prominentPeaks: number[] = [];
    for (const peak of peaks) {
        let leftBase = x[peak];
        for (let i = peak - 1; i >= 0; i--) {
            if (x[i] < leftBase) leftBase = x[i];
            if (x[i] > x[peak]) break;
        }

        let rightBase = x[peak];
        for (let i = peak + 1; i < x.length; i++) {
            if (x[i] < rightBase) rightBase = x[i];
            if (x[i] > x[peak]) break;
        }

        const calculatedProminence = x[peak] - Math.max(leftBase, rightBase);
        if (calculatedProminence >= prominence) {
            prominentPeaks.push(peak);
        }
    }

    // 3. Filter by distance
    const finalPeaks: number[] = [];
    const sortedByHeight = prominentPeaks.sort((a, b) => x[b] - x[a]);
    const isPeakEliminated = new Array(x.length).fill(false);

    for (const peak of sortedByHeight) {
        if (!isPeakEliminated[peak]) {
            finalPeaks.push(peak);
            // Eliminate peaks within the distance
            const start = Math.max(0, peak - distance);
            const end = Math.min(x.length - 1, peak + distance);
            for (let i = start; i <= end; i++) {
                if (i !== peak) {
                    isPeakEliminated[i] = true;
                }
            }
        }
    }

    return finalPeaks.sort((a, b) => a - b);
};


const _detectTonalsInFrame = (frame: number[], samplingRate: number, options: { freqRange: [number, number]; minSnrDb: number }): Tonal[] => {
    const { freqRange, minSnrDb } = options;
    const nperseg = Math.min(frame.length, 2048);

    const { freqs, psd } = calculateWelchPsd(frame, samplingRate, nperseg);
    if (freqs.length === 0) return [];
    
    const psd_db = psd.map(p => 10 * Math.log10(p + 1e-15));

    const [fmin, fmax] = freqRange;
    const relevantIndices: number[] = [];
    const relevantFreqs: number[] = [];
    const relevantPsdDb: number[] = [];

    for (let i = 0; i < freqs.length; i++) {
        if (freqs[i] >= fmin && freqs[i] <= fmax) {
            relevantIndices.push(i);
            relevantFreqs.push(freqs[i]);
            relevantPsdDb.push(psd_db[i]);
        }
    }

    if (relevantPsdDb.length === 0) return [];

    const noiseFloorDb = median(relevantPsdDb);

    const peakIndicesInSubset = findPeaks(relevantPsdDb, {
        height: noiseFloorDb + minSnrDb,
        prominence: 5,
        distance: 5
    });

    const tonals: Tonal[] = [];
    for (const peakIdx of peakIndicesInSubset) {
        const freq = relevantFreqs[peakIdx];
        const powerDb = relevantPsdDb[peakIdx];
        const snrDb = powerDb - noiseFloorDb;

        tonals.push({
            frequency: freq,
            power: powerDb,
            snr: snrDb
        });
    }
    return tonals;
};

const _trackTonals = (frameDetections: Tonal[][], minFrames: number, freqTolerance: number = 10): PersistentTonal[] => {
    const freqBins: { [key: number]: Tonal[] } = {};

    for (const tonals of frameDetections) {
        for (const tonal of tonals) {
            let matched = false;
            for (const binFreqStr in freqBins) {
                const binFreq = Number(binFreqStr);
                if (Math.abs(tonal.frequency - binFreq) <= freqTolerance) {
                    freqBins[binFreq].push(tonal);
                    // Update the bin's representative frequency to be the mean
                    const newMeanFreq = freqBins[binFreq].reduce((sum, t) => sum + t.frequency, 0) / freqBins[binFreq].length;
                    if (newMeanFreq !== binFreq) {
                         freqBins[newMeanFreq] = freqBins[binFreq];
                         delete freqBins[binFreq];
                    }
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                freqBins[tonal.frequency] = [tonal];
            }
        }
    }

    const persistent: PersistentTonal[] = [];
    for (const binFreqStr in freqBins) {
        const occurrences = freqBins[binFreqStr];
        if (occurrences.length >= minFrames) {
            const n_detections = occurrences.length;
            const frequency_mean = occurrences.reduce((sum, t) => sum + t.frequency, 0) / n_detections;
            const snr_mean = occurrences.reduce((sum, t) => sum + t.snr, 0) / n_detections;
            const power_mean = occurrences.reduce((sum, t) => sum + t.power, 0) / n_detections;
            persistent.push({ frequency_mean, snr_mean, power_mean, n_detections });
        }
    }
    return persistent;
};

export const detectTonals = (signal: number[], samplingRate: number, options: {
    freqRange: [number, number];
    minSnrDb: number;
    frameDuration: number;
    minFramesPresent: number;
}): PersistentTonal[] => {
    const { frameDuration, minFramesPresent } = options;
    const frameSamples = Math.floor(frameDuration * samplingRate);
    if (signal.length < frameSamples) return [];

    const hopSamples = Math.floor(frameSamples / 2); // 50% overlap
    const nFrames = Math.floor((signal.length - frameSamples) / hopSamples) + 1;

    const frameDetections: Tonal[][] = [];

    for (let i = 0; i < nFrames; i++) {
        const startIdx = i * hopSamples;
        const endIdx = startIdx + frameSamples;
        if (endIdx > signal.length) break;
        
        const frame = signal.slice(startIdx, endIdx);
        const tonals = _detectTonalsInFrame(frame, samplingRate, options);
        frameDetections.push(tonals);
    }
    
    return _trackTonals(frameDetections, minFramesPresent);
};

export const calculateDoaVsTime = (
    hydrophone: number[], 
    vx: number[], 
    vy: number[], 
    samplingRate: number, 
    centerFreq: number, 
    bandwidth: number = 20,
    frameDuration: number = 0.5,
): DoaPoint[] => {
    const nperseg = 2048; // Use a fixed segment length for CSD consistency
    const frameSamples = Math.floor(frameDuration * samplingRate);
    if (hydrophone.length < frameSamples) return [];
    
    const hopSamples = Math.floor(frameSamples / 2); // 50% overlap
    const nFrames = Math.floor((hydrophone.length - frameSamples) / hopSamples) + 1;

    const doaResults: DoaPoint[] = [];

    for (let i = 0; i < nFrames; i++) {
        const startIdx = i * hopSamples;
        const endIdx = startIdx + frameSamples;
        if (endIdx > hydrophone.length) break;

        const hFrame = hydrophone.slice(startIdx, endIdx);
        const vxFrame = vx.slice(startIdx, endIdx);
        const vyFrame = vy.slice(startIdx, endIdx);

        // Compute cross-spectra for this frame
        const { freqs, S_hx_real, S_hx_imag } = csd(hFrame, vxFrame, samplingRate, nperseg);
        const { S_hy_real, S_hy_imag } = csd(hFrame, vyFrame, samplingRate, nperseg);
        if (freqs.length === 0) continue;
        
        // Select frequency band
        const fmin = centerFreq - bandwidth / 2;
        const fmax = centerFreq + bandwidth / 2;
        
        let weighted_x = 0;
        let weighted_y = 0;
        let total_mag_hx = 0;
        let total_mag_hy = 0;
        
        for(let k = 0; k < freqs.length; k++) {
            if(freqs[k] >= fmin && freqs[k] <= fmax) {
                const mag_hx = Math.sqrt(S_hx_real[k]**2 + S_hx_imag[k]**2) + 1e-15;
                const mag_hy = Math.sqrt(S_hy_real[k]**2 + S_hy_imag[k]**2) + 1e-15;

                weighted_x += S_hx_real[k] * mag_hx;
                weighted_y += S_hy_real[k] * mag_hy;
                
                total_mag_hx += mag_hx;
                total_mag_hy += mag_hy;
            }
        }
        
        // Compute azimuth
        const azimuth_rad = Math.atan2(weighted_y, weighted_x);
        const azimuth_deg = (azimuth_rad * 180 / Math.PI + 360) % 360;

        // Confidence metric
        const total_mag = total_mag_hx + total_mag_hy;
        const coherent_mag = Math.sqrt(weighted_x**2 + weighted_y**2);
        let confidence = total_mag > 1e-15 ? coherent_mag / total_mag : 0;
        confidence = Math.max(0, Math.min(1, confidence)); // clip
        
        const frameTime = (startIdx + endIdx) / 2 / samplingRate;
        doaResults.push({ time: frameTime, doa: azimuth_deg, confidence });
    }

    return doaResults;
};

// Cross-Spectral Density using Welch's method
const csd = (x: number[], y: number[], samplingRate: number, nperseg: number) => {
    if (x.length < nperseg || y.length < nperseg) return { freqs: [], S_hx_real: [], S_hx_imag: [], S_hy_real: [], S_hy_imag: [] };
    
    const noverlap = Math.floor(nperseg / 2);
    const step = nperseg - noverlap;
    const numSegments = Math.floor((x.length - noverlap) / step);

    if (numSegments <= 0) return { freqs: [], S_hx_real: [], S_hx_imag: [], S_hy_real: [], S_hy_imag: [] };

    const hannWindow = new Array(nperseg).fill(0).map((_, i) => 0.5 * (1 - Math.cos(2 * Math.PI * i / nperseg)));
    const S2 = hannWindow.reduce((acc, val) => acc + val * val, 0);
    const scale = 1.0 / (samplingRate * S2);

    const halfLength = Math.floor(nperseg / 2) + 1;
    const avg_S_real = new Array(halfLength).fill(0);
    const avg_S_imag = new Array(halfLength).fill(0);
    
    for (let i = 0; i < numSegments; i++) {
        const seg_x = x.slice(i * step, i * step + nperseg).map((v, idx) => v * hannWindow[idx]);
        const seg_y = y.slice(i * step, i * step + nperseg).map((v, idx) => v * hannWindow[idx]);

        const fft_x = fft(seg_x);
        const fft_y = fft(seg_y);
        
        for(let k = 0; k < halfLength; k++) {
            // CSD = Fx * conj(Fy)
            const S_real = fft_x.real[k] * fft_y.real[k] + fft_x.imag[k] * fft_y.imag[k];
            const S_imag = fft_x.imag[k] * fft_y.real[k] - fft_x.real[k] * fft_y.imag[k];
            
            if (k > 0 && k < halfLength - 1) {
                avg_S_real[k] += 2 * S_real;
                avg_S_imag[k] += 2 * S_imag;
            } else {
                avg_S_real[k] += S_real;
                avg_S_imag[k] += S_imag;
            }
        }
    }
    
    const freqs = new Array(halfLength);
    for (let i = 0; i < halfLength; i++) {
        freqs[i] = i * samplingRate / nperseg;
        avg_S_real[i] /= numSegments;
        avg_S_imag[i] /= numSegments;
        avg_S_real[i] *= scale;
        avg_S_imag[i] *= scale;
    }
    
    return { freqs, S_hx_real: avg_S_real, S_hx_imag: avg_S_imag, S_hy_real: avg_S_real, S_hy_imag: avg_S_imag };
}


// Simplified IIR Filter implementation (Butterworth-like, 1st order)
const applyIIRFilter = (data: number[], a: number[], b: number[]): number[] => {
    const filteredData = new Array(data.length).fill(0);
    for (let i = 0; i < data.length; i++) {
        let y = b[0] * data[i];
        if (i > 0) y += b[1] * data[i - 1] - a[1] * filteredData[i - 1];
        filteredData[i] = y;
    }
    return filteredData;
};

export const applyFilter = (data: number[], type: FilterType, settings: FilterSettings, samplingRate: number): number[] => {
    if (type === FilterType.NONE) return data;

    let cutoff: number | [number, number];
    if (typeof settings.cutoff === 'number') {
        cutoff = settings.cutoff;
    } else {
        cutoff = settings.cutoff;
    }

    if (type === FilterType.LOWPASS) {
        const wc = 2 * Math.PI * (cutoff as number) / samplingRate;
        const gamma = Math.cos(wc) / (1 + Math.sin(wc));
        const b0 = (1 - gamma) / 2;
        const b1 = (1 - gamma) / 2;
        const a1 = -gamma;
        return applyIIRFilter(data, [1, a1], [b0, b1]);
    }
    
    if (type === FilterType.HIGHPASS) {
        const wc = 2 * Math.PI * (cutoff as number) / samplingRate;
        const gamma = Math.cos(wc) / (1 + Math.sin(wc));
        const b0 = (1 + gamma) / 2;
        const b1 = -(1 + gamma) / 2;
        const a1 = -gamma;
        return applyIIRFilter(data, [1, a1], [b0, b1]);
    }

    if (type === FilterType.BANDPASS) {
        const lowCutoff = (cutoff as [number, number])[0];
        const highCutoff = (cutoff as [number, number])[1];
        const highpassed = applyFilter(data, FilterType.HIGHPASS, { type: FilterType.HIGHPASS, cutoff: lowCutoff }, samplingRate);
        const bandpassed = applyFilter(highpassed, FilterType.LOWPASS, { type: FilterType.LOWPASS, cutoff: highCutoff }, samplingRate);
        return bandpassed;
    }

    return data;
};
