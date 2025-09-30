import React, { useRef, useEffect, useState, useMemo } from 'react';

// The worker code is self-contained plain JavaScript for STFT calculation.
const workerCode = `
// A simple FFT implementation (Cooley-Tukey Radix-2)
const fft = (input) => {
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

const calculateFFT = (data, samplingRate) => {
    const power = Math.ceil(Math.log2(data.length));
    const paddedLength = Math.pow(2, power);
    const paddedData = [...data, ...Array(paddedLength - data.length).fill(0)];
    
    const { real, imag } = fft(paddedData);

    const magnitudes = real.map((r, i) => 20 * Math.log10(Math.sqrt(r * r + imag[i] * imag[i])));
    
    return { magnitudes };
};

const calculateSTFT = (data, samplingRate, windowSize, hopSize) => {
    const stft = [];
    let maxMagnitude = 0;

    for (let i = 0; i + windowSize <= data.length; i += hopSize) {
        const windowedData = data.slice(i, i + windowSize);
        const hannWindow = windowedData.map((val, idx) => val * 0.5 * (1 - Math.cos(2 * Math.PI * idx / windowSize)));
        
        const { magnitudes } = calculateFFT(hannWindow, samplingRate);
        const halfMagnitudes = magnitudes.slice(0, windowSize / 2);
        
        const currentMax = Math.max(...halfMagnitudes.filter(m => isFinite(m)));
        if (currentMax > maxMagnitude) maxMagnitude = currentMax;
        
        stft.push(halfMagnitudes);
    }
    
    return { stft, maxMagnitude };
};

self.onmessage = ({ data: { data, samplingRate, windowSize, hopSize } }) => {
    try {
        const result = calculateSTFT(data, samplingRate, windowSize, hopSize);
        self.postMessage({ type: 'SUCCESS', payload: result });
    } catch (e) {
        self.postMessage({ type: 'ERROR', payload: e.message });
    }
};
`;

interface StftData {
  stft: number[][];
  maxMagnitude: number;
}

interface SpectrogramPlotProps {
  data: number[];
  samplingRate: number;
}

const WINDOW_OPTIONS = [256, 512, 1024, 2048, 4096];
const HOP_OPTIONS = [64, 128, 256, 512, 1024, 2048];

export const SpectrogramPlot: React.FC<SpectrogramPlotProps> = ({ data, samplingRate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const workerRef = useRef<Worker | null>(null);

  const [windowSize, setWindowSize] = useState<number>(1024);
  const [hopSize, setHopSize] = useState<number>(256);
  const [stftData, setStftData] = useState<StftData | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Effect to perform STFT calculation in a Web Worker
  useEffect(() => {
    // Terminate any existing worker before starting a new one
    if (workerRef.current) {
        workerRef.current.terminate();
    }

    if (data.length < windowSize) {
        setStftData(null);
        setError(`Signal length (${data.length}) is too short for the selected window size (${windowSize}).`);
        return;
    }
    
    setError(null);
    setIsCalculating(true);
    
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    workerRef.current = worker;

    worker.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'SUCCESS') {
            setStftData(payload);
        } else {
            console.error('Error in STFT worker:', payload);
            setError(payload);
            setStftData(null);
        }
        setIsCalculating(false);
    };

    worker.onerror = (err) => {
        console.error('STFT Worker Error:', err);
        setError('An unexpected error occurred during calculation.');
        setIsCalculating(false);
        setStftData(null);
    };
    
    worker.postMessage({ data, samplingRate, windowSize, hopSize });

    // Cleanup function to terminate the worker
    return () => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
    };
  }, [data, samplingRate, windowSize, hopSize]);


  // Effect for drawing the spectrogram on canvas
  useEffect(() => {
    if (!stftData || !canvasRef.current || !containerRef.current) return;

    const { stft, maxMagnitude } = stftData;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    const width = container.clientWidth;
    const height = 320;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // @ts-ignore
    const colorScale = d3.scaleSequential(d3.interpolateInferno).domain([0, maxMagnitude * 0.75]);
    
    const numTimeBins = stft.length;
    if (numTimeBins === 0) return;
    const numFreqBins = stft[0].length;
    
    const colWidth = width / numTimeBins;
    const rowHeight = height / numFreqBins;

    ctx.clearRect(0, 0, width, height);

    for (let t = 0; t < numTimeBins; t++) {
      for (let f = 0; f < numFreqBins; f++) {
        const magnitude = stft[t][f];
        // Invert frequency axis for conventional display (low freq at bottom)
        const y = height - ((f + 1) * rowHeight);
        
        ctx.fillStyle = colorScale(magnitude);
        ctx.fillRect(t * colWidth, y, Math.ceil(colWidth), Math.ceil(rowHeight));
      }
    }

  }, [stftData]);
  
  const timeLabels = useMemo(() => {
    if (!data) return [];
    const duration = data.length / samplingRate;
    return [0, 0.25, 0.5, 0.75, 1].map(d => (d * duration).toFixed(2));
  }, [data, samplingRate]);
  
  const freqLabels = useMemo(() => {
     const maxFreq = samplingRate / 2;
     return [0, 0.25, 0.5, 0.75, 1].map(d => {
       const freq = d * maxFreq;
       return freq > 1000 ? `${(freq / 1000).toFixed(1)}k` : `${Math.round(freq)}`;
     });
  }, [samplingRate]);


  const renderContent = () => {
    if (isCalculating) {
      return (
        <div className="w-full h-80 flex items-center justify-center bg-base-300 rounded-lg p-4 text-center">
            <div className="flex flex-col items-center gap-4">
                <svg className="animate-spin h-8 w-8 text-secondary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-gray-400">Calculating Spectrogram...</p>
            </div>
        </div>
      );
    }

    if (error) {
       return (
        <div className="w-full h-80 flex items-center justify-center bg-base-300 rounded-lg p-4 text-center">
            <div>
                <p className="text-red-400 mb-2 font-semibold">Calculation Error</p>
                <p className="text-sm text-gray-400">{error}</p>
            </div>
        </div>
    );
    }
    
    if(!stftData) {
        return <div className="w-full h-80 flex items-center justify-center bg-base-300 rounded-lg"></div>;
    }

    return (
      <div className="relative w-full" ref={containerRef} style={{ height: '320px' }}>
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
        <div className="absolute top-0 left-[-50px] h-full flex flex-col justify-between text-xs text-gray-400 py-1">
          {freqLabels.slice().reverse().map((label, i) => <span key={i}>{label}</span>)}
        </div>
        <div className="absolute top-1/2 left-[-70px] -translate-y-1/2 -rotate-90 text-sm text-gray-400">Frequency (Hz)</div>
        <div className="absolute bottom-[-25px] w-full flex justify-between text-xs text-gray-400 px-1">
          {timeLabels.map((label, i) => <span key={i}>{label}</span>)}
        </div>
        <div className="absolute bottom-[-45px] left-1/2 -translate-x-1/2 text-sm text-gray-400">Time (s)</div>
      </div>
    );
  };

  return (
    <div style={{ paddingLeft: '70px', paddingBottom: '50px' }}>
      <div className="flex justify-end items-center gap-x-6 gap-y-2 flex-wrap mb-4">
        <div>
            <label htmlFor={`window-size-${samplingRate}`} className="block text-sm font-medium text-gray-400 mb-1">Window Size</label>
            <select
                id={`window-size-${samplingRate}`}
                value={windowSize}
                onChange={e => {
                    const newWindowSize = Number(e.target.value);
                    setWindowSize(newWindowSize);
                    if (hopSize >= newWindowSize) {
                        setHopSize(newWindowSize / 4);
                    }
                }}
                className="bg-base-300 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:ring-2 focus:ring-secondary focus:outline-none disabled:opacity-50"
                disabled={isCalculating}
            >
                {WINDOW_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
        </div>
        <div>
            <label htmlFor={`hop-size-${samplingRate}`} className="block text-sm font-medium text-gray-400 mb-1">Hop Size</label>
            <select
                id={`hop-size-${samplingRate}`}
                value={hopSize}
                onChange={e => setHopSize(Number(e.target.value))}
                className="bg-base-300 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:ring-2 focus:ring-secondary focus:outline-none disabled:opacity-50"
                disabled={isCalculating}
            >
                {HOP_OPTIONS.filter(size => size <= windowSize).map(size => (
                    <option key={size} value={size}>{size}</option>
                ))}
            </select>
        </div>
      </div>
      {renderContent()}
    </div>
  );
};
