import { FilterType, FilterSettings } from '../types';

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

export const calculateSTFT = (data: number[], samplingRate: number, windowSize: number, hopSize: number) => {
    const stft: number[][] = [];
    let maxMagnitude = 0;

    for (let i = 0; i + windowSize <= data.length; i += hopSize) {
        const windowedData = data.slice(i, i + windowSize);
        // Apply a Hann window for better frequency resolution
        const hannWindow = windowedData.map((val, idx) => val * 0.5 * (1 - Math.cos(2 * Math.PI * idx / windowSize)));
        
        const { magnitudes } = calculateFFT(hannWindow, samplingRate);
        const halfMagnitudes = magnitudes.slice(0, windowSize / 2);
        
        const currentMax = Math.max(...halfMagnitudes.filter(m => isFinite(m)));
        if(currentMax > maxMagnitude) maxMagnitude = currentMax;
        
        stft.push(halfMagnitudes);
    }
    
    return { stft, maxMagnitude };
};

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