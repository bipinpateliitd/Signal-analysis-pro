
import { FilterType, FilterSettings } from '../types';

// A simple FFT implementation (Cooley-Tukey Radix-2)
const fft = (input: number[]): { real: number[], imag: number[] } => {
    const n = input.length;
    if (n <= 1) return { real: [...input], imag: Array(n).fill(0) };

    const even = fft(input.filter((_, i) => i % 2 === 0));
    const odd = fft(input.filter((_, i) => i % 2 !== 0));

    const real = Array(n);
    const imag = Array(n);

    for (let k = 0; k < n / 2; k++) {
        const angle = -2 * Math.PI * k / n;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        
        const tReal = cos * odd.real[k] - sin * odd.imag[k];
        const tImag = sin * odd.real[k] + cos * odd.imag[k];

        real[k] = even.real[k] + tReal;
        imag[k] = even.imag[k] + tImag;
        real[k + n / 2] = even.real[k] - tReal;
        imag[k + n / 2] = even.imag[k] - tImag;
    }
    return { real, imag };
};

export const calculateFFT = (data: number[], samplingRate: number) => {
    // Pad with zeros to the next power of 2 for FFT efficiency
    const power = Math.ceil(Math.log2(data.length));
    const paddedLength = Math.pow(2, power);
    const paddedData = [...data, ...Array(paddedLength - data.length).fill(0)];
    
    const { real, imag } = fft(paddedData);

    const magnitudes = real.map((r, i) => 20 * Math.log10(Math.sqrt(r * r + imag[i] * imag[i])));
    const frequencies = real.map((_, i) => i * samplingRate / paddedLength);
    
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
