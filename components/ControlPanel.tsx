import React from 'react';
import { FilterType, FilterSettings } from '../types';
import { InfoIcon } from './icons';

interface ControlPanelProps {
  fileName: string;
  samplingRate: number;
  numChannels: number;
  selectedChannels: number[];
  onChannelSelectionChange: (selected: number[]) => void;
  filterSettings: FilterSettings;
  onFilterSettingsChange: (settings: FilterSettings) => void;
  onApplyFilters: () => void;
  isLoading: boolean;
  maxFrequency: number;
  onMaxFrequencyChange: (freq: number) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  fileName,
  samplingRate,
  numChannels,
  selectedChannels,
  onChannelSelectionChange,
  filterSettings,
  onFilterSettingsChange,
  onApplyFilters,
  isLoading,
  maxFrequency,
  onMaxFrequencyChange
}) => {
  const handleChannelToggle = (channelIndex: number) => {
    const newSelection = selectedChannels.includes(channelIndex)
      ? selectedChannels.filter(c => c !== channelIndex)
      : [...selectedChannels, channelIndex];
    onChannelSelectionChange(newSelection);
  };
  
  const allChannels = Array.from({ length: numChannels }, (_, i) => i);
  const nyquist = samplingRate / 2;

  const handleMaxFreqChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = Number(e.target.value);
    if (isNaN(value)) return;
    if (value <= 0) value = 1;
    if (value > nyquist) value = nyquist;
    onMaxFrequencyChange(value);
  };

  return (
    <div className="bg-base-200 p-4 rounded-xl shadow-lg space-y-6 sticky top-8">
      <div>
        <h2 className="text-xl font-bold mb-2 text-white">File Information</h2>
        <div className="space-y-1 text-sm text-gray-300">
          <p><span className="font-semibold text-gray-400">Name:</span> <span className="break-all">{fileName}</span></p>
          <p><span className="font-semibold text-gray-400">Sampling Rate:</span> {samplingRate.toLocaleString()} Hz</p>
          <p><span className="font-semibold text-gray-400">Channels:</span> {numChannels}</p>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-3 text-white">Channel Selection</h2>
        <div className="max-h-48 overflow-y-auto pr-2 space-y-2">
          {allChannels.map(index => (
            <label key={index} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedChannels.includes(index)}
                onChange={() => handleChannelToggle(index)}
                className="form-checkbox h-5 w-5 text-secondary bg-base-300 border-gray-600 rounded focus:ring-secondary"
              />
              <span className="text-gray-200">Channel {index + 1}</span>
            </label>
          ))}
        </div>
      </div>

       <div>
        <h2 className="text-xl font-bold mb-3 text-white">Display Settings</h2>
        <div>
          <label htmlFor="max-freq" className="block text-sm font-medium text-gray-400 mb-1">Max Frequency (Hz)</label>
          <input
            type="number"
            id="max-freq"
            value={Math.round(maxFrequency)}
            onChange={handleMaxFreqChange}
            max={nyquist}
            min={1}
            className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-secondary focus:outline-none"
          />
          <p className="text-xs text-gray-500 mt-1">Max possible: {nyquist.toLocaleString()} Hz</p>
        </div>
      </div>
      
      <div>
        <h2 className="text-xl font-bold mb-3 text-white">Filtering</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="filter-type" className="block text-sm font-medium text-gray-400 mb-1">Filter Type</label>
            <select
              id="filter-type"
              value={filterSettings.type}
              onChange={e => onFilterSettingsChange({ ...filterSettings, type: e.target.value as FilterType })}
              className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-secondary focus:outline-none"
            >
              <option value={FilterType.NONE}>None</option>
              <option value={FilterType.LOWPASS}>Low-pass</option>
              <option value={FilterType.HIGHPASS}>High-pass</option>
              <option value={FilterType.BANDPASS}>Band-pass</option>
            </select>
          </div>

          {filterSettings.type === FilterType.LOWPASS && (
            <div>
              <label htmlFor="cutoff" className="block text-sm font-medium text-gray-400 mb-1">Cutoff Frequency (Hz)</label>
              <input
                type="number"
                id="cutoff"
                value={Array.isArray(filterSettings.cutoff) ? filterSettings.cutoff[0] : filterSettings.cutoff}
                onChange={e => onFilterSettingsChange({ ...filterSettings, cutoff: Number(e.target.value) })}
                className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-secondary focus:outline-none"
              />
            </div>
          )}
          
          {filterSettings.type === FilterType.HIGHPASS && (
            <div>
              <label htmlFor="cutoff" className="block text-sm font-medium text-gray-400 mb-1">Cutoff Frequency (Hz)</label>
              <input
                type="number"
                id="cutoff"
                value={Array.isArray(filterSettings.cutoff) ? filterSettings.cutoff[0] : filterSettings.cutoff}
                onChange={e => onFilterSettingsChange({ ...filterSettings, cutoff: Number(e.target.value) })}
                className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-secondary focus:outline-none"
              />
            </div>
          )}
          
          {filterSettings.type === FilterType.BANDPASS && (
            <div className="space-y-2">
              <div>
                <label htmlFor="low-cutoff" className="block text-sm font-medium text-gray-400 mb-1">Low Cutoff (Hz)</label>
                <input
                  type="number"
                  id="low-cutoff"
                  value={Array.isArray(filterSettings.cutoff) ? filterSettings.cutoff[0] : 100}
                  onChange={e => onFilterSettingsChange({ ...filterSettings, cutoff: [Number(e.target.value), (Array.isArray(filterSettings.cutoff) ? filterSettings.cutoff[1] : 1000)] })}
                  className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-secondary focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="high-cutoff" className="block text-sm font-medium text-gray-400 mb-1">High Cutoff (Hz)</label>
                <input
                  type="number"
                  id="high-cutoff"
                  value={Array.isArray(filterSettings.cutoff) ? filterSettings.cutoff[1] : 1000}
                  onChange={e => onFilterSettingsChange({ ...filterSettings, cutoff: [(Array.isArray(filterSettings.cutoff) ? filterSettings.cutoff[0] : 100), Number(e.target.value)] })}
                  className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-secondary focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
      
      <button
        onClick={onApplyFilters}
        disabled={isLoading}
        className="w-full bg-secondary hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center disabled:bg-gray-500 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          'Apply Filters'
        )}
      </button>
       <div className="flex items-start gap-2 text-xs text-gray-500 pt-2">
            <InfoIcon/>
            <span>Note: Filtering large files may take a moment. The analysis will update after processing.</span>
        </div>
    </div>
  );
};