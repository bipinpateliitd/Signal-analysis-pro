import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { ControlPanel } from './components/ControlPanel';
import { ChannelAnalysis } from './components/ChannelAnalysis';
import { SignalData, FilterType, FilterSettings, ChannelRoles, OrientationData } from './types';
import { applyFilter, normalizeRms } from './services/signalProcessor';
import { KairosHeaderLogo } from './components/icons';
import { WelcomeScreen } from './components/WelcomeScreen';
import { OrientationView } from './components/OrientationView';
import { parseXlsx } from './services/fileParser';

const App: React.FC = () => {
    const [signalData, setSignalData] = useState<SignalData | null>(null);
    const [selectedChannels, setSelectedChannels] = useState<number[]>([]);
    const [filterSettings, setFilterSettings] = useState<FilterSettings>({ type: FilterType.NONE, cutoff: 1000 });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [processedData, setProcessedData] = useState<number[][] | null>(null);
    const [maxFrequency, setMaxFrequency] = useState<number>(6000);
    const [showWelcome, setShowWelcome] = useState(true);
    const [isNormalizationEnabled, setIsNormalizationEnabled] = useState<boolean>(true);
    const [channelRoles, setChannelRoles] = useState<ChannelRoles>({ hydrophone: null, vx: null, vy: null });
    const [isGridVisible, setIsGridVisible] = useState<boolean>(true);
    const [orientationData, setOrientationData] = useState<OrientationData[] | null>(null);
    const [orientationFileName, setOrientationFileName] = useState<string>('');
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [analysisStartTime, setAnalysisStartTime] = useState<number>(0);
    const [orientationStartTimeOffset, setOrientationStartTimeOffset] = useState<number>(0);

    useEffect(() => {
        if (showWelcome && !isLoading) {
            const timer = setTimeout(() => setShowWelcome(false), 1500);
            return () => clearTimeout(timer);
        }
    }, [isLoading, showWelcome]);


    const handleFileUpload = (data: SignalData, name: string) => {
        setIsLoading(true);
        if (data.channels.length <= 3) {
            setError("The uploaded file must have more than 3 channels.");
            setSignalData(null);
            setIsLoading(false);
            return;
        }
        setError(null);
        setSignalData(data);
        setFileName(name);
        setMaxFrequency(Math.min(6000, data.samplingRate / 2));
        const initialChannels = Array.from({ length: Math.min(4, data.channels.length) }, (_, i) => i);
        setSelectedChannels(initialChannels);
        setProcessedData(data.channels);
        setFilterSettings({ type: FilterType.NONE, cutoff: 1000 });
        setIsNormalizationEnabled(true);
        setChannelRoles({ hydrophone: null, vx: null, vy: null });
        setOrientationData(null);
        setOrientationFileName('');
        setCurrentTime(0);
        setAnalysisStartTime(0);
        setOrientationStartTimeOffset(0);
        setIsLoading(false);
        setShowWelcome(false);
    };
    
    const handleReset = () => {
        setSignalData(null);
        setSelectedChannels([]);
        setFilterSettings({ type: FilterType.NONE, cutoff: 1000 });
        setFileName('');
        setProcessedData(null);
        setError(null);
        setOrientationData(null);
        setOrientationFileName('');
        setCurrentTime(0);
        setAnalysisStartTime(0);
        setOrientationStartTimeOffset(0);
        setShowWelcome(true);
    };
    
    const handleOrientationUpload = async (file: File) => {
        setError(null);
        setIsLoading(true);
        try {
            const data = await parseXlsx(file);
            setOrientationData(data);
            setOrientationFileName(file.name);
            // Don't set currentTime from file anymore, keep it in signal's time domain
        } catch(e) {
            setError(e instanceof Error ? e.message : "Failed to parse orientation file.");
            setOrientationData(null);
            setOrientationFileName('');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleClearOrientation = () => {
        setOrientationData(null);
        setOrientationFileName('');
        setOrientationStartTimeOffset(0);
    };

    const handleApplyFilters = useCallback(() => {
        if (!signalData) return;
        setIsLoading(true);
        setError(null);

        setTimeout(() => {
            try {
                let newProcessedData = signalData.channels.map(channelData => {
                    if (filterSettings.type === FilterType.NONE) {
                        return channelData;
                    }
                    return applyFilter(channelData, filterSettings.type, filterSettings, signalData.samplingRate);
                });
                
                if (isNormalizationEnabled) {
                    newProcessedData = newProcessedData.map(channelData => normalizeRms(channelData));
                }

                setProcessedData(newProcessedData);
            } catch (e) {
                setError(e instanceof Error ? e.message : "An unknown error occurred during processing.");
            } finally {
                setIsLoading(false);
            }
        }, 50);
    }, [signalData, filterSettings, isNormalizationEnabled]);
    
    const ChannelAnalysisWrapper = React.memo(ChannelAnalysis);
    
    const signalDuration = useMemo(() => {
        if (!signalData) return 0;
        return signalData.channels[0].length / signalData.samplingRate;
    }, [signalData]);


    return (
        <div className="relative min-h-screen">
             <WelcomeScreen isVisible={showWelcome || isLoading} />
            <div className={`min-h-screen bg-base-100 flex flex-col items-center p-4 sm:p-6 lg:p-8 transition-opacity duration-500 ${showWelcome || isLoading ? 'opacity-0' : 'opacity-100'}`}>
                <header className="w-full max-w-7xl mb-6 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <KairosHeaderLogo className="w-10 h-10" />
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">AiKairos Signal Analysis</h1>
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
                     {error && (
                        <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
                            <strong className="font-bold">Error:</strong>
                            <span className="block sm:inline ml-2">{error}</span>
                             <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
                                <span className="text-2xl">×</span>
                            </button>
                        </div>
                    )}
                    {!signalData ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] bg-base-200 rounded-xl p-8 border border-dashed border-base-300">
                            <FileUpload onFileUpload={handleFileUpload} setIsLoading={setShowWelcome} setError={setError} />
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
                                    headerInfo={signalData.headerInfo}
                                    channelNames={signalData.channelNames}
                                    isNormalizationEnabled={isNormalizationEnabled}
                                    onNormalizationChange={setIsNormalizationEnabled}
                                    channelRoles={channelRoles}
                                    onChannelRolesChange={setChannelRoles}
                                    isGridVisible={isGridVisible}
                                    onGridVisibilityChange={setIsGridVisible}
                                    onOrientationUpload={handleOrientationUpload}
                                    onClearOrientation={handleClearOrientation}
                                    orientationFileName={orientationFileName}
                                    analysisStartTime={analysisStartTime}
                                    onAnalysisStartTimeChange={setAnalysisStartTime}
                                    signalDuration={signalDuration}
                                    orientationStartTimeOffset={orientationStartTimeOffset}
                                    onOrientationStartTimeOffsetChange={setOrientationStartTimeOffset}
                                />
                            </aside>
                            <section className="lg:col-span-9">
                                {processedData && (
                                    <div className="space-y-6">
                                        {orientationData && (
                                            <OrientationView 
                                                data={orientationData}
                                                currentTime={currentTime}
                                                setCurrentTime={setCurrentTime}
                                                orientationStartTimeOffset={orientationStartTimeOffset}
                                                signalDuration={signalDuration}
                                            />
                                        )}
                                        {selectedChannels.length > 0 ? (
                                            selectedChannels.map(channelIndex => (
                                                <ChannelAnalysisWrapper
                                                    key={channelIndex}
                                                    channelId={channelIndex}
                                                    channelName={signalData.channelNames?.[channelIndex]}
                                                    channelData={processedData[channelIndex]}
                                                    allChannelsData={processedData}
                                                    samplingRate={signalData.samplingRate}
                                                    maxFrequency={maxFrequency}
                                                    channelRoles={channelRoles}
                                                    isGridVisible={isGridVisible}
                                                    currentTime={currentTime}
                                                    analysisStartTime={analysisStartTime}
                                                    orientationData={orientationData}
                                                    orientationStartTimeOffset={orientationStartTimeOffset}
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
        </div>
    );
};

export default App;