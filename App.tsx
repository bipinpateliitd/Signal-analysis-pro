import React, { useState, useMemo, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { ControlPanel } from './components/ControlPanel';
import { ChannelAnalysis } from './components/ChannelAnalysis';
import { SignalData, FilterType, FilterSettings } from './types';
import { applyFilter } from './services/signalProcessor';
import { LogoIcon } from './components/icons';

const App: React.FC = () => {
    const [signalData, setSignalData] = useState<SignalData | null>(null);
    const [selectedChannels, setSelectedChannels] = useState<number[]>([]);
    const [filterSettings, setFilterSettings] = useState<FilterSettings>({ type: FilterType.NONE, cutoff: 1000 });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [processedData, setProcessedData] = useState<number[][] | null>(null);
    const [maxFrequency, setMaxFrequency] = useState<number>(22050);


    const handleFileUpload = (data: SignalData, name: string) => {
        if (data.channels.length < 3) {
            setError("The uploaded file must have more than 3 channels.");
            setSignalData(null);
            return;
        }
        setError(null);
        setSignalData(data);
        setFileName(name);
        setMaxFrequency(data.samplingRate / 2);
        const initialChannels = Array.from({ length: Math.min(3, data.channels.length) }, (_, i) => i);
        setSelectedChannels(initialChannels);
        setProcessedData(data.channels); // Initially, processed data is raw data
    };
    
    const handleReset = () => {
        setSignalData(null);
        setSelectedChannels([]);
        setFilterSettings({ type: FilterType.NONE, cutoff: 1000 });
        setFileName('');
        setProcessedData(null);
        setError(null);
    };

    const handleApplyFilters = useCallback(() => {
        if (!signalData) return;
        setIsLoading(true);
        setError(null);

        // Use a timeout to allow the UI to update to the loading state
        setTimeout(() => {
            try {
                const newProcessedData = signalData.channels.map(channelData => {
                    if (filterSettings.type === FilterType.NONE) {
                        return channelData;
                    }
                    return applyFilter(channelData, filterSettings.type, filterSettings, signalData.samplingRate);
                });
                setProcessedData(newProcessedData);
            } catch (e) {
                setError(e instanceof Error ? e.message : "An unknown error occurred during processing.");
            } finally {
                setIsLoading(false);
            }
        }, 50);
    }, [signalData, filterSettings]);


    return (
        <div className="min-h-screen bg-base-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <header className="w-full max-w-7xl mb-6 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <LogoIcon />
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Signal Analysis Pro</h1>
                </div>
                {signalData && (
                    <button
                        onClick={handleReset}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-200"
                    >
                        Upload New File
                    </button>
                )}
            </header>
            
            <main className="w-full max-w-7xl flex-grow">
                {!signalData ? (
                    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] bg-base-200 rounded-xl p-8 border border-dashed border-base-300">
                         {error && (
                            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
                                <strong className="font-bold">Error:</strong>
                                <span className="block sm:inline ml-2">{error}</span>
                            </div>
                        )}
                        <FileUpload onFileUpload={handleFileUpload} setIsLoading={setIsLoading} setError={setError} />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <aside className="lg:col-span-3">
                            <ControlPanel
                                fileName={fileName}
                                samplingRate={signalData.samplingRate}
                                numChannels={signalData.channels.length}
                                selectedChannels={selectedChannels}
                                onChannelSelectionChange={setSelectedChannels}
                                filterSettings={filterSettings}
                                onFilterSettingsChange={setFilterSettings}
                                onApplyFilters={handleApplyFilters}
                                isLoading={isLoading}
                                maxFrequency={maxFrequency}
                                onMaxFrequencyChange={setMaxFrequency}
                            />
                        </aside>
                        <section className="lg:col-span-9">
                           {isLoading && (
                                <div className="flex items-center justify-center h-full min-h-[60vh] bg-base-200 rounded-xl p-8">
                                    <div className="flex flex-col items-center gap-4">
                                        <svg className="animate-spin h-10 w-10 text-secondary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <p className="text-lg font-semibold">Processing Data...</p>
                                    </div>
                                </div>
                            )}
                            {!isLoading && error && (
                                <div className="flex items-center justify-center h-full min-h-[60vh] bg-base-200 rounded-xl p-8">
                                     <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
                                        <strong className="font-bold">Processing Error:</strong>
                                        <span className="block sm:inline ml-2">{error}</span>
                                    </div>
                                </div>
                            )}
                            {!isLoading && !error && processedData && (
                                <div className="space-y-6">
                                    {selectedChannels.length > 0 ? (
                                        selectedChannels.map(channelIndex => (
                                            <ChannelAnalysis
                                                key={channelIndex}
                                                channelId={channelIndex}
                                                channelData={processedData[channelIndex]}
                                                samplingRate={signalData.samplingRate}
                                                maxFrequency={maxFrequency}
                                            />
                                        ))
                                    ) : (
                                        <div className="flex items-center justify-center h-full min-h-[60vh] bg-base-200 rounded-xl p-8">
                                            <p className="text-xl text-gray-400">Select one or more channels to begin analysis.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;