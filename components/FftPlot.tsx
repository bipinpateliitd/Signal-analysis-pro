import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { calculateFFT } from '../services/signalProcessor';
import { PlotPoint } from '../types';

interface FftPlotProps {
  data: number[];
  samplingRate: number;
  maxFrequency: number;
}

const MAX_POINTS = 5000; // Can use more points now with AreaChart

const formatMagnitudeTick = (value: number): string => {
    if (value === 0) return '0';
    return value.toExponential(1);
};

const formatMagnitudeTooltip = (value: number): string => {
    if (value === 0) return '0';
    return value.toExponential(3);
};


export const FftPlot: React.FC<FftPlotProps> = ({ data, samplingRate, maxFrequency }) => {
  const plotData = useMemo<PlotPoint[]>(() => {
    const { magnitudes, frequencies } = calculateFFT(data, samplingRate);
    
    const rawPlotData = magnitudes.map((mag, i) => ({
      x: frequencies[i],
      y: mag,
    })).filter(p => p.x <= maxFrequency);


    if (rawPlotData.length <= MAX_POINTS) {
      return rawPlotData;
    }

    // Downsample using a max-hold approach to preserve peaks
    const step = Math.ceil(rawPlotData.length / MAX_POINTS);
    const binnedData: PlotPoint[] = [];
     for (let i = 0; i < rawPlotData.length; i += step) {
        const chunk = rawPlotData.slice(i, i + step);
        if (chunk.length > 0) {
            const maxPoint = chunk.reduce((max, p) => p.y > max.y ? p : max, chunk[0]);
            binnedData.push(maxPoint);
        }
    }
    return binnedData;

  }, [data, samplingRate, maxFrequency]);

  return (
    <div className="w-full h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={plotData}
          margin={{ top: 5, right: 30, left: 20, bottom: 25 }}
        >
          <defs>
            <linearGradient id="colorMagnitude" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#9333ea" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="x" 
            type="number"
            domain={[0, maxFrequency]}
            allowDataOverflow={true}
            label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -15, fill: '#9ca3af' }}
            stroke="#9ca3af"
            tickFormatter={(freq) => freq >= 1000 ? `${(freq/1000).toFixed(0)}k` : freq.toFixed(0)}
          />
          <YAxis 
            label={{ value: 'Magnitude', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} 
            stroke="#9ca3af"
            tickFormatter={formatMagnitudeTick}
            domain={[0, 'auto']}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
            labelStyle={{ color: '#d1d5db' }}
            formatter={(value: number) => [formatMagnitudeTooltip(value), "Magnitude"]}
            labelFormatter={(label: number) => `Frequency: ${label.toFixed(2)} Hz`}
            cursor={{ fill: 'rgba(147, 51, 234, 0.1)' }}
          />
          <Legend wrapperStyle={{color: '#d1d5db'}} />
          <Area 
            type="monotone"
            dataKey="y" 
            name="Magnitude"
            stroke="#9333ea"
            strokeWidth={1.5}
            fillOpacity={1} 
            fill="url(#colorMagnitude)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};