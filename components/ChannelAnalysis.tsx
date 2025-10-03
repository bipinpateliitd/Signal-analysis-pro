import React, { useState, useMemo, useRef, useEffect } from 'react';
import { WaveformPlot } from './WaveformPlot';
import { FftPlot } from './FftPlot';
import { SpectrogramPlot } from './SpectrogramPlot';
import { DownloadIcon, ChevronDownIcon } from './icons';
import { calculateFFT, calculateWelchPsd, estimateNoise, detectTonals, calculateDoaVsTime, getInterpolatedOrientation, correctDoa } from '../services/signalProcessor';
import { NoiseInfo, PlotPoint, PersistentTonal, ChannelRoles, DoaPoint, OrientationData } from '../types';

// FIX: Add declarations for global libraries d3 and htmlToImage to avoid TypeScript errors.
declare var d3: any;
declare var htmlToImage: any;

const useResponsiveSVG = (containerRef: React.RefObject<HTMLDivElement>) => {
    const [size, setSize] = useState({ width: 0, height: 0 });
    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries && entries.length > 0) {
                const { width, height } = entries[0].contentRect;
                setSize({ width, height });
            }
        });
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            if (containerRef.current) resizeObserver.unobserve(containerRef.current);
        };
    }, [containerRef]);
    return size;
};

const PsdPlot: React.FC<{ freqs: number[]; psd_db: number[]; maxFrequency: number; isGridVisible: boolean; }> = ({ freqs, psd_db, maxFrequency, isGridVisible }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const { width, height } = useResponsiveSVG(containerRef);

    const plotData = useMemo<PlotPoint[]>(() => {
        return freqs.map((f, i) => ({ x: f, y: psd_db[i] })).filter(p => p.x <= maxFrequency && isFinite(p.y));
    }, [freqs, psd_db, maxFrequency]);

    useEffect(() => {
        if (!d3 || !svgRef.current || width === 0 || height === 0 || plotData.length === 0) return;

        const margin = { top: 20, right: 30, bottom: 50, left: 70 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const xDomain = [0, maxFrequency];
        const yExtent = d3.extent(plotData, (d: PlotPoint) => d.y);

        // --- ROBUSTNESS CHECK ---
        if (!yExtent || yExtent.some(v => v === undefined || !isFinite(v))) {
            return;
        }

        const yPadding = (yExtent[1] - yExtent[0]) * 0.1 || 10;
        const yDomain = [yExtent[0] - yPadding, yExtent[1] + yPadding];

        const xScale = d3.scaleLinear().domain(xDomain).range([0, chartWidth]);
        const yScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]);

        const xAxis = d3.axisBottom(xScale).ticks(7).tickFormat((freq: any) => freq >= 1000 ? `${(freq/1000).toFixed(0)}k` : freq.toFixed(0));
        const yAxis = d3.axisLeft(yScale).ticks(5);

        const chartG = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        if (isGridVisible) {
            chartG.append("g").attr("class", "grid").attr("transform", `translate(0,${chartHeight})`).call(d3.axisBottom(xScale).ticks(7).tickSize(-chartHeight).tickFormat("")).selectAll("line, path").style("stroke", "#374151").style("stroke-dasharray", "3 3");
            chartG.append("g").attr("class", "grid").call(d3.axisLeft(yScale).ticks(5).tickSize(-chartWidth).tickFormat("")).selectAll("line, path").style("stroke", "#374151").style("stroke-dasharray", "3 3");
        }

        const xAxisG = chartG.append("g").attr("transform", `translate(0,${chartHeight})`).call(xAxis);
        const yAxisG = chartG.append("g").call(yAxis);
        
        xAxisG.selectAll("text, line, path").style("stroke", "#9ca3af").style("fill", "#9ca3af");
        yAxisG.selectAll("text, line, path").style("stroke", "#9ca3af").style("fill", "#9ca3af");

        svg.append("text").attr("transform", `translate(${margin.left + chartWidth / 2}, ${height - margin.bottom + 40})`).style("text-anchor", "middle").style("fill", "#9ca3af").text("Frequency (Hz)");
        svg.append("text").attr("transform", "rotate(-90)").attr("y", 0).attr("x", 0 - (chartHeight / 2) - margin.top).attr("dy", "1em").style("text-anchor", "middle").style("fill", "#9ca3af").text("PSD (dB/Hz)");

        const line = d3.line().x((d: any) => xScale(d.x)).y((d: any) => yScale(d.y));

        chartG.append("path").datum(plotData).attr("fill", "none").attr("stroke", "#3b82f6").attr("stroke-width", 1.5).attr("d", line);

    }, [plotData, width, height, maxFrequency, isGridVisible]);

    return <div ref={containerRef} className="w-full h-80"><svg ref={svgRef} width={width} height={height}></svg></div>;
};

const SignalActivityPlot: React.FC<{ frameTimes: number[]; frameEnergies: number[]; threshold: number; noiseMask: boolean[]; isGridVisible: boolean; }> = ({ frameTimes, frameEnergies, threshold, noiseMask, isGridVisible }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const { width, height } = useResponsiveSVG(containerRef);

    const plotData = useMemo(() => frameTimes.map((t, i) => ({ time: t, energy: frameEnergies[i], isNoise: noiseMask[i] })), [frameTimes, frameEnergies, noiseMask]);

    useEffect(() => {
        if (!d3 || !svgRef.current || width === 0 || height === 0 || plotData.length === 0) return;

        const margin = { top: 20, right: 30, bottom: 50, left: 70 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const xDomain = d3.extent(plotData, d => d.time);
        const yMax = d3.max(plotData, d => d.energy);
        
        // --- ROBUSTNESS CHECK ---
        if (!xDomain || xDomain.some(v => v === undefined || !isFinite(v)) || yMax === undefined || !isFinite(yMax)) {
            return;
        }

        const yDomain = [0, yMax * 1.1];

        const xScale = d3.scaleLinear().domain(xDomain).range([0, chartWidth]);
        const yScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]);

        const xAxis = d3.axisBottom(xScale).ticks(7).tickFormat(d => `${Number(d).toFixed(2)}s`);
        const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d => Number(d).toExponential(1));

        const chartG = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        if (isGridVisible) {
            chartG.append("g").attr("class", "grid").attr("transform", `translate(0,${chartHeight})`).call(d3.axisBottom(xScale).ticks(7).tickSize(-chartHeight).tickFormat("")).selectAll("line, path").style("stroke", "#374151").style("stroke-dasharray", "3 3");
            chartG.append("g").attr("class", "grid").call(d3.axisLeft(yScale).ticks(5).tickSize(-chartWidth).tickFormat("")).selectAll("line, path").style("stroke", "#374151").style("stroke-dasharray", "3 3");
        }

        const xAxisG = chartG.append("g").attr("transform", `translate(0,${chartHeight})`).call(xAxis);
        const yAxisG = chartG.append("g").call(yAxis);

        xAxisG.selectAll("text, line, path").style("stroke", "#9ca3af").style("fill", "#9ca3af");
        yAxisG.selectAll("text, line, path").style("stroke", "#9ca3af").style("fill", "#9ca3af");
        
        svg.append("text").attr("transform", `translate(${margin.left + chartWidth / 2}, ${height - margin.bottom + 40})`).style("text-anchor", "middle").style("fill", "#9ca3af").text("Time (s)");
        svg.append("text").attr("transform", "rotate(-90)").attr("y", 0).attr("x", 0 - (chartHeight / 2) - margin.top).attr("dy", "1em").style("text-anchor", "middle").style("fill", "#9ca3af").text("Frame Energy");

        const line = d3.line().x(d => xScale(d.time)).y(d => yScale(d.energy));
        
        const noiseArea = d3.area().x(d => xScale(d.time)).y0(chartHeight).y1(d => d.isNoise ? yScale(d.energy) : chartHeight);

        chartG.append("path").datum(plotData).attr("fill", "#9333ea").attr("opacity", 0.3).attr("d", noiseArea);
        chartG.append("path").datum(plotData).attr("fill", "none").attr("stroke", "#3b82f6").attr("stroke-width", 1.5).attr("d", line);
        
        chartG.append("line")
            .attr("x1", 0).attr("x2", chartWidth)
            .attr("y1", yScale(threshold)).attr("y2", yScale(threshold))
            .attr("stroke", "#facc15").attr("stroke-width", 2).attr("stroke-dasharray", "5,5");

    }, [plotData, width, height, threshold, isGridVisible]);

    return <div ref={containerRef} className="w-full h-80"><svg ref={svgRef} width={width} height={height}></svg></div>;
};

const NoiseAnalysisTab: React.FC<{ channelData: number[]; samplingRate: number; maxFrequency: number; isGridVisible: boolean; }> = ({ channelData, samplingRate, maxFrequency, isGridVisible }) => {
    const [frameLength, setFrameLength] = useState(0.1);
    const [percentile, setPercentile] = useState(30);
    const [noiseInfo, setNoiseInfo] = useState<NoiseInfo | null>(null);
    const [isCalculating, setIsCalculating] = useState(true);

    useEffect(() => {
        setIsCalculating(true);
        const timer = setTimeout(() => {
            try {
                const result = estimateNoise(channelData, samplingRate, frameLength, percentile);
                setNoiseInfo(result);
            } catch (e) {
                console.error("Noise estimation failed", e);
            } finally {
                setIsCalculating(false);
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [channelData, samplingRate, frameLength, percentile]);

    const renderContent = () => {
        if (isCalculating) {
            return (
                <div className="w-full h-96 flex items-center justify-center">
                    <svg className="animate-spin h-8 w-8 text-secondary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            );
        }
        if (!noiseInfo) return <div className="w-full h-96 flex items-center justify-center"><p>Could not calculate noise statistics.</p></div>;

        return (
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div className="bg-base-300 p-4 rounded-lg">
                        <p className="text-sm text-gray-400">Noise Power</p>
                        <p className="text-2xl font-bold text-white">{noiseInfo.noise_power_db.toFixed(2)} dB</p>
                    </div>
                    <div className="bg-base-300 p-4 rounded-lg">
                        <p className="text-sm text-gray-400">Noise Percentage</p>
                        <p className="text-2xl font-bold text-white">{noiseInfo.noise_percentage.toFixed(1)}%</p>
                    </div>
                    <div className="bg-base-300 p-4 rounded-lg">
                        <p className="text-sm text-gray-400">Noise Samples</p>
                        <p className="text-2xl font-bold text-white">{noiseInfo.noise_samples_count.toLocaleString()}</p>
                    </div>
                </div>

                <div>
                    <h4 className="text-lg font-bold text-white mb-2">Signal Activity</h4>
                    <p className="text-sm text-gray-400 mb-4">Frame energy over time. The yellow dashed line is the threshold. Purple shaded areas are detected as noise.</p>
                    <SignalActivityPlot frameTimes={noiseInfo.frameTimes} frameEnergies={noiseInfo.frameEnergies} threshold={noiseInfo.threshold} noiseMask={noiseInfo.noiseMask} isGridVisible={isGridVisible} />
                </div>
                
                <div>
                     <h4 className="text-lg font-bold text-white mb-2">Noise Spectrum (PSD)</h4>
                     <p className="text-sm text-gray-400 mb-4">The Power Spectral Density of the noise-only portions of the signal, calculated using Welch's method.</p>
                     {noiseInfo.freqs.length > 0 ? (
                        <PsdPlot freqs={noiseInfo.freqs} psd_db={noiseInfo.psd_db} maxFrequency={maxFrequency} isGridVisible={isGridVisible} />
                     ) : (
                        <div className="w-full h-80 flex items-center justify-center bg-base-300 rounded-lg"><p>Not enough noise samples to calculate spectrum.</p></div>
                     )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-start items-center gap-x-6 gap-y-2 flex-wrap p-2 rounded-lg bg-base-300">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Frame Length (s)</label>
                    <input type="number" value={frameLength} onChange={e => setFrameLength(Number(e.target.value))} step="0.05" min="0.01" className="bg-base-100 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm w-28"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Percentile Threshold</label>
                    <input type="number" value={percentile} onChange={e => setPercentile(Number(e.target.value))} max="100" min="1" className="bg-base-100 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm w-28"/>
                </div>
            </div>
            {renderContent()}
        </div>
    );
};

const TonalPlot: React.FC<{ channelData: number[], samplingRate: number, maxFrequency: number, tonals: PersistentTonal[], isGridVisible: boolean; }> = ({ channelData, samplingRate, maxFrequency, tonals, isGridVisible }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const { width, height } = useResponsiveSVG(containerRef);

    const plotData = useMemo(() => {
        const { freqs, psd } = calculateWelchPsd(channelData, samplingRate, Math.min(channelData.length, 4096));
        const psd_db = psd.map(p => 10 * Math.log10(p + 1e-15));
        return freqs.map((f, i) => ({ x: f, y: psd_db[i] })).filter(p => p.x <= maxFrequency && isFinite(p.y));
    }, [channelData, samplingRate, maxFrequency]);
    
    useEffect(() => {
        if (!d3 || !svgRef.current || width === 0 || height === 0 || plotData.length === 0) return;

        const margin = { top: 20, right: 30, bottom: 50, left: 70 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const xDomain = [0, maxFrequency];
        const yExtent = d3.extent(plotData, (d: PlotPoint) => d.y);
        
        // --- ROBUSTNESS CHECK ---
        if (!yExtent || yExtent.some(v => v === undefined || !isFinite(v))) {
            return;
        }
        
        const yPadding = (yExtent[1] - yExtent[0]) * 0.1 || 10;
        const yDomain = [yExtent[0] - yPadding, yExtent[1] + yPadding];

        const xScale = d3.scaleLinear().domain(xDomain).range([0, chartWidth]);
        const yScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]);

        const xAxis = d3.axisBottom(xScale).ticks(7).tickFormat((freq: any) => freq >= 1000 ? `${(freq/1000).toFixed(0)}k` : freq.toFixed(0));
        const yAxis = d3.axisLeft(yScale).ticks(5);

        const chartG = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        if (isGridVisible) {
            chartG.append("g").attr("class", "grid").attr("transform", `translate(0,${chartHeight})`).call(d3.axisBottom(xScale).ticks(7).tickSize(-chartHeight).tickFormat("")).selectAll("line, path").style("stroke", "#374151").style("stroke-dasharray", "3 3");
            chartG.append("g").attr("class", "grid").call(d3.axisLeft(yScale).ticks(5).tickSize(-chartWidth).tickFormat("")).selectAll("line, path").style("stroke", "#374151").style("stroke-dasharray", "3 3");
        }

        const xAxisG = chartG.append("g").attr("transform", `translate(0,${chartHeight})`).call(xAxis);
        const yAxisG = chartG.append("g").call(yAxis);
        
        xAxisG.selectAll("text, line, path").style("stroke", "#9ca3af").style("fill", "#9ca3af");
        yAxisG.selectAll("text, line, path").style("stroke", "#9ca3af").style("fill", "#9ca3af");

        svg.append("text").attr("transform", `translate(${margin.left + chartWidth / 2}, ${height - margin.bottom + 40})`).style("text-anchor", "middle").style("fill", "#9ca3af").text("Frequency (Hz)");
        svg.append("text").attr("transform", "rotate(-90)").attr("y", 0).attr("x", 0 - (chartHeight / 2) - margin.top).attr("dy", "1em").style("text-anchor", "middle").style("fill", "#9ca3af").text("PSD (dB/Hz)");

        const line = d3.line().x((d: any) => xScale(d.x)).y((d: any) => yScale(d.y));

        chartG.append("path").datum(plotData).attr("fill", "none").attr("stroke", "#3b82f6").attr("stroke-width", 1.5).attr("d", line);
        
        const tooltip = d3.select("body").append("div")
            .attr("class", "tonal-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "#1f2937")
            .style("border", "1px solid #4b5563")
            .style("border-radius", "8px")
            .style("padding", "8px")
            .style("color", "#e5e7eb")
            .style("font-size", "12px")
            .style("pointer-events", "none");

        chartG.selectAll(".tonal-marker")
            .data(tonals)
            .enter().append("circle")
            .attr("class", "tonal-marker")
            .attr("cx", d => xScale(d.frequency_mean))
            .attr("cy", d => yScale(d.power_mean))
            .attr("r", 5)
            .attr("fill", "#facc15")
            .attr("stroke", "#111827")
            .attr("stroke-width", 1.5)
            .style("cursor", "pointer")
            .on("mouseover", (event, d) => {
                tooltip.style("visibility", "visible")
                    .html(`<strong>Tonal</strong><br/>
                           Freq: ${d.frequency_mean.toFixed(1)} Hz<br/>
                           SNR: ${d.snr_mean.toFixed(1)} dB<br/>
                           Power: ${d.power_mean.toFixed(1)} dB`);
            })
            .on("mousemove", (event) => {
                tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", () => {
                tooltip.style("visibility", "hidden");
            });
    
    // Cleanup tooltip on component unmount
    return () => { tooltip.remove(); };

    }, [plotData, width, height, maxFrequency, tonals, isGridVisible]);

    return <div ref={containerRef} className="w-full h-80"><svg ref={svgRef} width={width} height={height}></svg></div>;
};

const TonalDetectionTab: React.FC<{ channelData: number[]; samplingRate: number; maxFrequency: number; onTonalsDetected: (tonals: PersistentTonal[]) => void; isGridVisible: boolean; }> = ({ channelData, samplingRate, maxFrequency, onTonalsDetected, isGridVisible }) => {
    const [options, setOptions] = useState({
        freqRange: [100, 6000] as [number, number],
        minSnrDb: 15,
        frameDuration: 1.0,
        minFramesPresent: 2,
    });
    const [tonals, setTonals] = useState<PersistentTonal[] | null>(null);
    const [isCalculating, setIsCalculating] = useState(true);

    useEffect(() => {
        setIsCalculating(true);
        const timer = setTimeout(() => {
            try {
                const result = detectTonals(channelData, samplingRate, options);
                setTonals(result);
                onTonalsDetected(result);
            } catch (e) {
                console.error("Tonal detection failed", e);
                setTonals(null);
                onTonalsDetected([]);
            } finally {
                setIsCalculating(false);
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [channelData, samplingRate, options, onTonalsDetected]);
    
    const renderContent = () => {
        if (isCalculating) {
            return (
                <div className="w-full h-96 flex items-center justify-center">
                    <svg className="animate-spin h-8 w-8 text-secondary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            );
        }
        if (!tonals || tonals.length === 0) {
            return <div className="w-full h-96 flex items-center justify-center"><p>No persistent tonals detected with the current settings.</p></div>;
        }

        return (
            <div className="space-y-8">
                <div>
                     <h4 className="text-lg font-bold text-white mb-2">Detected Tonals on PSD</h4>
                     <p className="text-sm text-gray-400 mb-4">The Power Spectral Density of the entire signal, with persistent tonals marked in yellow.</p>
                     <TonalPlot channelData={channelData} samplingRate={samplingRate} maxFrequency={maxFrequency} tonals={tonals} isGridVisible={isGridVisible} />
                </div>
                <div>
                    <h4 className="text-lg font-bold text-white mb-2">Persistent Tonals List</h4>
                     <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-700">
                            <thead className="bg-base-300">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Frequency (Hz)</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">SNR (dB)</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Power (dB)</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Detections</th>
                                </tr>
                            </thead>
                            <tbody className="bg-base-200 divide-y divide-gray-700">
                                {tonals.sort((a,b) => b.snr_mean - a.snr_mean).map((tonal, idx) => (
                                    <tr key={idx} className="hover:bg-base-300">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{tonal.frequency_mean.toFixed(1)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tonal.snr_mean.toFixed(1)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tonal.power_mean.toFixed(1)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{tonal.n_detections}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    return (
         <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 justify-start items-center gap-x-6 gap-y-4 p-2 rounded-lg bg-base-300">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Freq Range (Hz)</label>
                    <div className="flex items-center gap-1">
                        <input type="number" value={options.freqRange[0]} onChange={e => setOptions(o => ({...o, freqRange: [Number(e.target.value), o.freqRange[1]]}))} className="bg-base-100 border border-gray-600 rounded-lg px-2 py-1 text-white text-sm w-20"/>
                        <span className="text-gray-400">-</span>
                        <input type="number" value={options.freqRange[1]} onChange={e => setOptions(o => ({...o, freqRange: [o.freqRange[0], Number(e.target.value)]}))} className="bg-base-100 border border-gray-600 rounded-lg px-2 py-1 text-white text-sm w-20"/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Min SNR (dB)</label>
                    <input type="number" value={options.minSnrDb} onChange={e => setOptions(o => ({...o, minSnrDb: Number(e.target.value)}))} min="0" className="bg-base-100 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm w-28"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Frame Duration (s)</label>
                    <input type="number" value={options.frameDuration} onChange={e => setOptions(o => ({...o, frameDuration: Number(e.target.value)}))} step="0.1" min="0.1" className="bg-base-100 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm w-28"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Min Frames Present</label>
                    <input type="number" value={options.minFramesPresent} onChange={e => setOptions(o => ({...o, minFramesPresent: Number(e.target.value)}))} min="1" className="bg-base-100 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm w-28"/>
                </div>
            </div>
            {renderContent()}
        </div>
    );
}

const DoaPlot: React.FC<{ data: DoaPoint[]; isGridVisible: boolean; }> = ({ data, isGridVisible }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const { width, height } = useResponsiveSVG(containerRef);

    useEffect(() => {
        if (!d3 || !svgRef.current || width === 0 || height === 0 || data.length === 0) return;

        const margin = { top: 20, right: 80, bottom: 50, left: 70 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const xDomain = d3.extent(data, d => d.time);
        
        // --- ROBUSTNESS CHECK ---
        if (!xDomain || xDomain.some(v => v === undefined || !isFinite(v))) {
            return;
        }
        
        const yDomain = [0, 360];

        const xScale = d3.scaleLinear().domain(xDomain).range([0, chartWidth]);
        const yScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]);
        const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, 1]);

        const xAxis = d3.axisBottom(xScale).ticks(7).tickFormat(d => `${Number(d).toFixed(2)}s`);
        const yAxis = d3.axisLeft(yScale).tickValues([0, 90, 180, 270, 360]);

        const chartG = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        if (isGridVisible) {
            chartG.append("g").attr("class", "grid").attr("transform", `translate(0,${chartHeight})`).call(d3.axisBottom(xScale).ticks(7).tickSize(-chartHeight).tickFormat("")).selectAll("line, path").style("stroke", "#374151").style("stroke-dasharray", "3 3");
            chartG.append("g").attr("class", "grid").call(d3.axisLeft(yScale).tickValues([0, 90, 180, 270, 360]).tickSize(-chartWidth).tickFormat("")).selectAll("line, path").style("stroke", "#374151").style("stroke-dasharray", "3 3");
        }

        const xAxisG = chartG.append("g").attr("transform", `translate(0,${chartHeight})`).call(xAxis);
        const yAxisG = chartG.append("g").call(yAxis);
        
        xAxisG.selectAll("text, line, path").style("stroke", "#9ca3af").style("fill", "#9ca3af");
        yAxisG.selectAll("text, line, path").style("stroke", "#9ca3af").style("fill", "#9ca3af");

        svg.append("text").attr("transform", `translate(${margin.left + chartWidth / 2}, ${height - margin.bottom + 40})`).style("text-anchor", "middle").style("fill", "#9ca3af").text("Time (s)");
        svg.append("text").attr("transform", "rotate(-90)").attr("y", 0).attr("x", 0 - (chartHeight / 2) - margin.top).attr("dy", "1em").style("text-anchor", "middle").style("fill", "#9ca3af").text("Corrected DOA (°)");

        const tooltip = d3.select("body").append("div")
            .attr("class", "doa-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "#1f2937")
            .style("border", "1px solid #4b5563")
            .style("border-radius", "8px")
            .style("padding", "8px")
            .style("color", "#e5e7eb")
            .style("font-size", "12px")
            .style("pointer-events", "none");

        chartG.selectAll(".doa-point")
            .data(data)
            .enter().append("circle")
            .attr("class", "doa-point")
            .attr("cx", d => xScale(d.time))
            .attr("cy", d => yScale(d.doa))
            .attr("r", 3)
            .attr("fill", d => colorScale(d.confidence))
            .attr("opacity", 0.8)
            .style("cursor", "pointer")
            .on("mouseover", (event, d) => {
                d3.select(event.currentTarget).transition().duration(100).attr("r", 5);
                tooltip.style("visibility", "visible")
                    .html(`<strong>DOA Point</strong><br/>
                           Time: ${d.time.toFixed(3)} s<br/>
                           Corrected DOA: ${d.doa.toFixed(1)}°<br/>
                           Raw DOA: ${d.doa_raw?.toFixed(1) ?? 'N/A'}°<br/>
                           Confidence: ${d.confidence.toFixed(2)}`);
            })
            .on("mousemove", (event) => {
                tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", (event) => {
                d3.select(event.currentTarget).transition().duration(100).attr("r", 3);
                tooltip.style("visibility", "hidden");
            });
            
        // Add a color legend
        const legendWidth = 20;
        const legendG = svg.append("g")
            .attr("transform", `translate(${margin.left + chartWidth + 20}, ${margin.top})`);

        const linearGradient = svg.append("defs")
            .append("linearGradient")
            .attr("id", "doa-gradient")
            .attr("x1", "0%").attr("y1", "100%")
            .attr("x2", "0%").attr("y2", "0%");

        const numStops = 10;
        const colorRange = d3.range(numStops).map(i => i / (numStops - 1));
        linearGradient.selectAll("stop")
            .data(colorRange)
            .enter().append("stop")
            .attr("offset", d => `${d * 100}%`)
            .attr("stop-color", d => colorScale(d));

        legendG.append("rect")
            .attr("width", legendWidth)
            .attr("height", chartHeight)
            .style("fill", "url(#doa-gradient)");

        const legendYScale = d3.scaleLinear()
            .domain([0, 1])
            .range([chartHeight, 0]);

        const legendYAxis = d3.axisRight(legendYScale)
            .ticks(5)
            .tickFormat(d3.format(".1f"));

        legendG.append("g")
            .attr("class", "legend-axis")
            .attr("transform", `translate(${legendWidth}, 0)`)
            .call(legendYAxis)
            .selectAll("text, line, path")
            .style("stroke", "#9ca3af")
            .style("fill", "#9ca3af");
            
        legendG.append("text")
            .attr("x", legendWidth / 2)
            .attr("y", -8)
            .style("text-anchor", "middle")
            .style("fill", "#9ca3af")
            .style("font-size", "12px")
            .text("Confidence");

        // Cleanup tooltip on component unmount
        return () => { tooltip.remove(); };

    }, [data, width, height, isGridVisible]);

    return <div ref={containerRef} className="w-full h-80"><svg ref={svgRef} width={width} height={height}></svg></div>;
};


const DoaAnalysisTab: React.FC<{
    allChannelsData: number[][];
    samplingRate: number;
    channelRoles: ChannelRoles;
    persistentTonals: PersistentTonal[];
    isGridVisible: boolean;
    analysisStartTime: number;
    orientationData: OrientationData[] | null;
    orientationStartTimeOffset: number;
}> = ({ allChannelsData, samplingRate, channelRoles, persistentTonals, isGridVisible, analysisStartTime, orientationData, orientationStartTimeOffset }) => {
    const [selectedTonalFreq, setSelectedTonalFreq] = useState<number | null>(null);
    const [confidence, setConfidence] = useState(0.5);
    const [frameDuration, setFrameDuration] = useState(5.0);
    const [doaData, setDoaData] = useState<DoaPoint[]>([]);
    const [isCalculating, setIsCalculating] = useState(false);

    useEffect(() => {
        // Auto-select the first tonal if available and none is selected
        if (persistentTonals.length > 0 && selectedTonalFreq === null) {
            setSelectedTonalFreq(persistentTonals[0].frequency_mean);
        } else if (persistentTonals.length === 0) {
            setSelectedTonalFreq(null);
        }
    }, [persistentTonals, selectedTonalFreq]);

    useEffect(() => {
        const { hydrophone, vx, vy } = channelRoles;
        if (selectedTonalFreq === null || hydrophone === null || vx === null || vy === null) {
            setDoaData([]);
            return;
        }

        setIsCalculating(true);
        const timer = setTimeout(() => {
            try {
                const hData = allChannelsData[hydrophone];
                const vxData = allChannelsData[vx];
                const vyData = allChannelsData[vy];
                const rawResult = calculateDoaVsTime(hData, vxData, vyData, samplingRate, selectedTonalFreq, frameDuration);
                
                const correctedResult = rawResult.map(p => {
                    const time = p.time + analysisStartTime;
                    let correctedDoa = p.doa;
                    
                    if (orientationData) {
                        const orientationTime = time + orientationStartTimeOffset;
                        const { roll, pitch, yaw } = getInterpolatedOrientation(orientationTime, orientationData);
                        correctedDoa = correctDoa(p.doa, roll, pitch, yaw);
                    }

                    return { 
                        ...p, 
                        time,
                        doa_raw: p.doa,
                        doa: correctedDoa,
                    };
                });

                setDoaData(correctedResult);
            } catch(e) {
                console.error("DOA calculation failed", e);
                setDoaData([]);
            } finally {
                setIsCalculating(false);
            }
        }, 50);
        return () => clearTimeout(timer);

    }, [selectedTonalFreq, channelRoles, allChannelsData, samplingRate, frameDuration, analysisStartTime, orientationData, orientationStartTimeOffset]);

    const filteredDoaData = useMemo(() => {
        return doaData.filter(d => d.confidence >= confidence);
    }, [doaData, confidence]);

    const renderContent = () => {
        const { hydrophone, vx, vy } = channelRoles;
        if (hydrophone === null || vx === null || vy === null) {
            return <div className="w-full h-96 flex items-center justify-center"><p>Please assign Hydrophone, Vx, and Vy roles in the Control Panel to enable DOA analysis.</p></div>;
        }
        if (persistentTonals.length === 0) {
             return <div className="w-full h-96 flex items-center justify-center"><p>No persistent tonals detected on this channel. Please run Tonal Detection first.</p></div>;
        }
        
        if (isCalculating) {
             return (
                <div className="w-full h-96 flex items-center justify-center">
                    <svg className="animate-spin h-8 w-8 text-secondary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </div>
            );
        }
        
        return (
            <div>
                 <h4 className="text-lg font-bold text-white mb-2">DOA vs. Time</h4>
                 <p className="text-sm text-gray-400 mb-4">Direction of Arrival for the selected tonal over time. Color indicates confidence. Orientation correction is applied if data is available.</p>
                 {filteredDoaData.length > 0 ? (
                    <DoaPlot data={filteredDoaData} isGridVisible={isGridVisible} />
                 ) : (
                    <div className="w-full h-80 flex items-center justify-center bg-base-300 rounded-lg"><p>No DOA points above the current confidence threshold.</p></div>
                 )}
            </div>
        )
    }

    return (
        <div className="space-y-4">
             <div className="flex justify-start items-center gap-x-6 gap-y-2 flex-wrap p-2 rounded-lg bg-base-300">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Target Tonal</label>
                    <select 
                        value={selectedTonalFreq ?? ''} 
                        onChange={e => setSelectedTonalFreq(Number(e.target.value))}
                        className="bg-base-100 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm w-48"
                        disabled={persistentTonals.length === 0}
                    >
                       {persistentTonals.map(t => (
                           <option key={t.frequency_mean} value={t.frequency_mean}>
                               {t.frequency_mean.toFixed(1)} Hz (SNR: {t.snr_mean.toFixed(1)} dB)
                           </option>
                       ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Confidence Threshold ({confidence.toFixed(2)})</label>
                    <input type="range" min="0" max="1" step="0.05" value={confidence} onChange={e => setConfidence(Number(e.target.value))} className="w-48"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Frame Duration (s)</label>
                    <input 
                        type="number" 
                        value={frameDuration} 
                        onChange={e => setFrameDuration(Number(e.target.value))} 
                        step="0.1" 
                        min="0.1" 
                        className="bg-base-100 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm w-28"
                    />
                </div>
            </div>
            {renderContent()}
        </div>
    )
};


interface ChannelAnalysisProps {
  channelId: number;
  channelName?: string;
  channelData: number[];
  allChannelsData: number[][];
  samplingRate: number;
  maxFrequency: number;
  channelRoles: ChannelRoles;
  isGridVisible: boolean;
  currentTime: number;
  analysisStartTime: number;
  orientationData: OrientationData[] | null;
  orientationStartTimeOffset: number;
}

type Tab = 'waveform' | 'fft' | 'spectrogram' | 'noise' | 'tonals' | 'doa';

export const ChannelAnalysis: React.FC<ChannelAnalysisProps> = ({ channelId, channelName, channelData, allChannelsData, samplingRate, maxFrequency, channelRoles, isGridVisible, currentTime, analysisStartTime, orientationData, orientationStartTimeOffset }) => {
  const [activeTab, setActiveTab] = useState<Tab>('waveform');
  const [isDownloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const plotRef = useRef<HTMLDivElement>(null);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const [persistentTonals, setPersistentTonals] = useState<PersistentTonal[]>([]);
  
  const allRolesAssigned = channelRoles.hydrophone !== null && channelRoles.vx !== null && channelRoles.vy !== null;

  const TABS: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'waveform', label: 'Waveform', visible: true },
    { id: 'fft', label: 'FFT', visible: true },
    { id: 'spectrogram', label: 'Spectrogram', visible: true },
    { id: 'noise', label: 'Noise Analysis', visible: true },
    { id: 'tonals', label: 'Tonal Detection', visible: true },
    { id: 'doa', label: 'DOA vs. Time', visible: allRolesAssigned },
  ];
  
  const visibleTabs = TABS.filter(t => t.visible);

  const slicedAllChannelsData = useMemo(() => {
    const startIndex = Math.floor(analysisStartTime * samplingRate);
    if (startIndex <= 0 || startIndex >= allChannelsData[0].length) return allChannelsData;
    return allChannelsData.map(ch => ch.slice(startIndex));
}, [allChannelsData, analysisStartTime, samplingRate]);
  
  useEffect(() => {
      // If the current tab becomes hidden (e.g., role changed), switch back to waveform
      if (!visibleTabs.some(t => t.id === activeTab)) {
          setActiveTab('waveform');
      }
  }, [visibleTabs, activeTab]);

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
    if (['spectrogram', 'noise', 'tonals', 'doa'].includes(activeTab)) return;
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
        return <WaveformPlot data={channelData} samplingRate={samplingRate} isGridVisible={isGridVisible} currentTime={currentTime} />;
      case 'fft':
        return <FftPlot data={channelData} samplingRate={samplingRate} maxFrequency={maxFrequency} isGridVisible={isGridVisible} />;
      case 'spectrogram':
        return <SpectrogramPlot data={channelData} samplingRate={samplingRate} maxFrequency={maxFrequency} />;
      case 'noise':
        return <NoiseAnalysisTab channelData={channelData} samplingRate={samplingRate} maxFrequency={maxFrequency} isGridVisible={isGridVisible} />;
      case 'tonals':
        return <TonalDetectionTab channelData={channelData} samplingRate={samplingRate} maxFrequency={maxFrequency} onTonalsDetected={setPersistentTonals} isGridVisible={isGridVisible} />;
      case 'doa':
        return allRolesAssigned ? <DoaAnalysisTab allChannelsData={slicedAllChannelsData} samplingRate={samplingRate} channelRoles={channelRoles} persistentTonals={persistentTonals} isGridVisible={isGridVisible} analysisStartTime={analysisStartTime} orientationData={orientationData} orientationStartTimeOffset={orientationStartTimeOffset} /> : null;
      default:
        return null;
    }
  }, [activeTab, channelData, samplingRate, maxFrequency, allRolesAssigned, slicedAllChannelsData, channelRoles, persistentTonals, isGridVisible, currentTime, analysisStartTime, orientationData, orientationStartTimeOffset]);

  return (
    <div className="bg-base-200 p-4 rounded-xl shadow-lg">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-y-2">
        <h3 className="text-2xl font-bold text-white">{channelName || `Channel ${channelId + 1}`}</h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-base-300 rounded-lg p-1 flex-wrap">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 text-sm font-semibold rounded-md transition-colors ${activeTab === tab.id ? 'bg-secondary text-white' : 'text-gray-300 hover:bg-gray-700'}`}
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
                    onClick={!['spectrogram', 'noise', 'tonals', 'doa'].includes(activeTab) ? handleDownloadCsv : undefined} 
                    title={['spectrogram', 'noise', 'tonals', 'doa'].includes(activeTab) ? 'CSV export not available for this view' : 'Download raw plot data'}
                    className={`block px-4 py-2 text-sm ${['spectrogram', 'noise', 'tonals', 'doa'].includes(activeTab) ? 'text-gray-500 cursor-not-allowed' : 'text-gray-200 hover:bg-secondary hover:text-white cursor-pointer'}`}
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