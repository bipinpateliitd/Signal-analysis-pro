
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateFFT } from '../services/signalProcessor';
import { PlotPoint } from '../types';

interface FftPlotProps {
  data: number[];
  samplingRate: number;
}

export const FftPlot: React.FC<FftPlotProps> = ({ data, samplingRate }) => {
  const plotData = useMemo<PlotPoint[]>(() => {
    const { magnitudes, frequencies } = calculateFFT(data, samplingRate);
    // We only need to plot the first half of the FFT results (Nyquist frequency)
    const halfLength = Math.floor(magnitudes.length / 2);
    return magnitudes.slice(0, halfLength).map((mag, i) => ({
      x: frequencies[i],
      y: mag,
    }));
  }, [data, samplingRate]);

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={plotData}
          margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="x" 
            type="number"
            domain={[0, samplingRate / 2]}
            label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -15, fill: '#9ca3af' }}
            stroke="#9ca3af"
            tickFormatter={(freq) => freq > 1000 ? `${(freq/1000).toFixed(1)}k` : freq}
          />
          <YAxis 
            label={{ value: 'Magnitude (dB)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} 
            stroke="#9ca3af"
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
            labelStyle={{ color: '#d1d5db' }}
            formatter={(value: number) => [`${value.toFixed(2)} dB`, "Magnitude"]}
            labelFormatter={(label: number) => `Frequency: ${label.toFixed(2)} Hz`}
          />
          <Legend wrapperStyle={{color: '#d1d5db'}} />
          <Line 
            type="monotone" 
            dataKey="y" 
            name="Magnitude"
            stroke="#9333ea" 
            strokeWidth={1.5}
            dot={false} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
