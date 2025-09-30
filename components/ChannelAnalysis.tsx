import React, { useState, useMemo, useRef, useEffect } from 'react';
import { WaveformPlot } from './WaveformPlot';
import { FftPlot } from './FftPlot';
import { SpectrogramPlot } from './SpectrogramPlot';
import { DownloadIcon, ChevronDownIcon } from './icons';
import { calculateFFT } from '../services/signalProcessor';

interface ChannelAnalysisProps {
  channelId: number;
  channelName?: string;
  channelData: number[];
  samplingRate: number;
  maxFrequency: number;
}

type Tab = 'waveform' | 'fft' | 'spectrogram';

export const ChannelAnalysis: React.FC<ChannelAnalysisProps> = ({ channelId, channelName, channelData, samplingRate, maxFrequency }) => {
  const [activeTab, setActiveTab] = useState<Tab>('waveform');
  const [isDownloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const plotRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'waveform', label: 'Waveform' },
    { id: 'fft', label: 'FFT' },
    { id: 'spectrogram', label: 'Spectrogram' },
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDownloadPng = () => {
    if (plotRef.current === null) return;
    setDownloadMenuOpen(false);
    // @ts-ignore
    htmlToImage.toPng(plotRef.current, { cacheBust: true, backgroundColor: '#1f2937', pixelRatio: 2 })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `channel_${channelId + 1}_${activeTab}_plot.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => console.error('Failed to download PNG', err));
  };

  const handleDownloadSvg = () => {
    if (plotRef.current === null) return;
    setDownloadMenuOpen(false);
     // @ts-ignore
    htmlToImage.toSvg(plotRef.current, { cacheBust: true })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `channel_${channelId + 1}_${activeTab}_plot.svg`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => console.error('Failed to download SVG', err));
  };
  
  const handleDownloadCsv = () => {
    if (activeTab === 'spectrogram') return;
    setDownloadMenuOpen(false);

    let headers = '';
    let dataRows: string[] = [];
    
    if (activeTab === 'waveform') {
        headers = 'Time (s),Amplitude\n';
        const plotData = channelData.map((y, i) => ({ x: i / samplingRate, y }));
        dataRows = plotData.map(p => `${p.x.toExponential(6)},${p.y.toExponential(6)}`);
    } else if (activeTab === 'fft') {
        headers = 'Frequency (Hz),Magnitude\n';
        const { magnitudes, frequencies } = calculateFFT(channelData, samplingRate);
        const halfLength = Math.floor(magnitudes.length / 2);
        dataRows = frequencies.slice(0, halfLength).map((freq, i) => `${freq.toFixed(2)},${magnitudes[i].toExponential(6)}`);
    }
    
    const csvContent = headers + dataRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `channel_${channelId + 1}_${activeTab}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  const plotContent = useMemo(() => {
    switch (activeTab) {
      case 'waveform':
        return <WaveformPlot data={channelData} samplingRate={samplingRate} />;
      case 'fft':
        return <FftPlot data={channelData} samplingRate={samplingRate} maxFrequency={maxFrequency} />;
      case 'spectrogram':
        return <SpectrogramPlot data={channelData} samplingRate={samplingRate} maxFrequency={maxFrequency} />;
      default:
        return null;
    }
  }, [activeTab, channelData, samplingRate, maxFrequency]);

  return (
    <div className="bg-base-200 p-4 rounded-xl shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-white">{channelName || `Channel ${channelId + 1}`}</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-base-300 rounded-lg p-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${activeTab === tab.id ? 'bg-secondary text-white' : 'text-gray-300 hover:bg-gray-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative" ref={downloadMenuRef}>
            <button
              onClick={() => setDownloadMenuOpen(!isDownloadMenuOpen)}
              title="Download Options"
              className="p-2 rounded-lg bg-base-300 hover:bg-gray-600 transition-colors flex items-center gap-1"
            >
              <DownloadIcon />
              <ChevronDownIcon />
            </button>
            {isDownloadMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-base-300 border border-gray-600 rounded-lg shadow-xl z-10 py-1">
                <a onClick={handleDownloadPng} className="block px-4 py-2 text-sm text-gray-200 hover:bg-secondary hover:text-white cursor-pointer">Download as PNG</a>
                <a onClick={handleDownloadSvg} className="block px-4 py-2 text-sm text-gray-200 hover:bg-secondary hover:text-white cursor-pointer">Download as SVG</a>
                <div 
                    onClick={activeTab !== 'spectrogram' ? handleDownloadCsv : undefined} 
                    title={activeTab === 'spectrogram' ? 'CSV export is not available for spectrograms' : 'Download raw plot data'}
                    className={`block px-4 py-2 text-sm ${activeTab === 'spectrogram' ? 'text-gray-500 cursor-not-allowed' : 'text-gray-200 hover:bg-secondary hover:text-white cursor-pointer'}`}
                >
                    Download as CSV
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div ref={plotRef} className="bg-base-200 p-2 rounded-lg">
        {plotContent}
      </div>
    </div>
  );
};
