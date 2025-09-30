
import React, { useState, useMemo, useRef } from 'react';
import { WaveformPlot } from './WaveformPlot';
import { FftPlot } from './FftPlot';
import { SpectrogramPlot } from './SpectrogramPlot';
import { DownloadIcon } from './icons';

interface ChannelAnalysisProps {
  channelId: number;
  channelData: number[];
  samplingRate: number;
}

type Tab = 'waveform' | 'fft' | 'spectrogram';

export const ChannelAnalysis: React.FC<ChannelAnalysisProps> = ({ channelId, channelData, samplingRate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('waveform');
  const plotRef = useRef<HTMLDivElement>(null);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'waveform', label: 'Waveform' },
    { id: 'fft', label: 'FFT' },
    { id: 'spectrogram', label: 'Spectrogram' },
  ];

  const handleDownload = () => {
    if (plotRef.current === null) {
      return;
    }

    // @ts-ignore
    htmlToImage.toPng(plotRef.current, { cacheBust: true, backgroundColor: '#1f2937' })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `channel_${channelId + 1}_${activeTab}_plot.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error('Failed to download plot', err);
      });
  };

  const plotContent = useMemo(() => {
    switch (activeTab) {
      case 'waveform':
        return <WaveformPlot data={channelData} samplingRate={samplingRate} />;
      case 'fft':
        return <FftPlot data={channelData} samplingRate={samplingRate} />;
      case 'spectrogram':
        return <SpectrogramPlot data={channelData} samplingRate={samplingRate} />;
      default:
        return null;
    }
  }, [activeTab, channelData, samplingRate]);

  return (
    <div className="bg-base-200 p-4 rounded-xl shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-2xl font-bold text-white">Channel {channelId + 1}</h3>
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
          <button
            onClick={handleDownload}
            title="Download Plot"
            className="p-2 rounded-lg bg-base-300 hover:bg-gray-600 transition-colors"
          >
            <DownloadIcon />
          </button>
        </div>
      </div>
      <div ref={plotRef} className="bg-base-200 p-2 rounded-lg">
        {plotContent}
      </div>
    </div>
  );
};
