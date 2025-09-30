
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush } from 'recharts';
import { PlotPoint } from '../types';

interface WaveformPlotProps {
  data: number[];
  samplingRate: number;
}

// To avoid crashing the browser with too many points, we can downsample for visualization
const MAX_POINTS = 5000; 

export const WaveformPlot: React.FC<WaveformPlotProps> = ({ data, samplingRate }) => {
  const plotData = useMemo<PlotPoint[]>(() => {
    const step = data.length > MAX_POINTS ? Math.floor(data.length / MAX_POINTS) : 1;
    const sampledData: PlotPoint[] = [];
    for (let i = 0; i < data.length; i += step) {
      sampledData.push({ x: i / samplingRate, y: data[i] });
    }
    return sampledData;
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
            domain={['dataMin', 'dataMax']}
            label={{ value: 'Time (s)', position: 'insideBottom', offset: -15, fill: '#9ca3af' }}
            stroke="#9ca3af"
            tickFormatter={(time) => time.toFixed(3)}
          />
          <YAxis 
            label={{ value: 'Amplitude', angle: -90, position: 'insideLeft', fill: '#9ca3af' }} 
            stroke="#9ca3af"
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
            labelStyle={{ color: '#d1d5db' }}
            formatter={(value: number) => [value.toFixed(4), "Amplitude"]}
            labelFormatter={(label: number) => `Time: ${label.toFixed(4)}s`}
          />
          <Legend wrapperStyle={{color: '#d1d5db'}}/>
          <Line 
            type="monotone" 
            dataKey="y" 
            name="Amplitude" 
            stroke="#3b82f6" 
            strokeWidth={1.5}
            dot={false} 
          />
          <Brush 
            dataKey="x" 
            height={30} 
            stroke="#9333ea" 
            fill="#1f2937" 
            travellerWidth={10}
            tickFormatter={(time) => time.toFixed(2)}
           />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
