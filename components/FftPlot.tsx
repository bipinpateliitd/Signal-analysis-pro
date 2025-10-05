import React, { useRef, useEffect, useMemo } from 'react';
import { calculateFFT } from '../services/signalProcessor';
import { PlotPoint } from '../types';

// FIX: Declare d3 as a global variable to fix TypeScript errors.
declare var d3: any;

const MAX_POINTS = 5000;

// Custom hook to handle responsive SVG sizing
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
        return () => { if (containerRef.current) resizeObserver.unobserve(containerRef.current); };
    }, [containerRef]);
    return size;
};

export const FftPlot: React.FC<{ data: number[], samplingRate: number, maxFrequency: number, isGridVisible: boolean; }> = ({ data, samplingRate, maxFrequency, isGridVisible }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const { width, height } = useResponsiveSVG(containerRef);

    const plotData = useMemo<PlotPoint[]>(() => {
        const { magnitudes, frequencies } = calculateFFT(data, samplingRate);
        const rawPlotData = magnitudes.map((mag, i) => ({
            x: frequencies[i],
            y: mag,
        })).filter(p => p.x <= maxFrequency);

        if (rawPlotData.length <= MAX_POINTS) return rawPlotData;
        
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

    useEffect(() => {
        if (!d3 || !svgRef.current || width === 0 || height === 0 || !plotData.length) return;

        const margin = { top: 20, right: 30, bottom: 50, left: 70 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const xDomain = [0, maxFrequency];
        const yMax = d3.max(plotData, (d: PlotPoint) => d.y);

        // --- ROBUSTNESS CHECK ---
        if (yMax === undefined || !isFinite(yMax)) {
            return; // Don't render if max value is invalid
        }

        const yDomain = [0, yMax === 0 ? 1 : yMax * 1.1];

        const xScale = d3.scaleLinear().domain(xDomain).range([0, chartWidth]);
        const yScale = d3.scaleLinear().domain(yDomain).range([chartHeight, 0]);

        const xAxis = d3.axisBottom(xScale).ticks(7).tickFormat((freq: any) => freq >= 1000 ? `${(freq/1000).toFixed(0)}k` : freq.toFixed(0));
        const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d: any) => Number(d).toExponential(1));

        const chartG = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        if (isGridVisible) {
            chartG.append("g")
                .attr("class", "grid")
                .attr("transform", `translate(0,${chartHeight})`)
                .call(d3.axisBottom(xScale).ticks(10).tickSize(-chartHeight).tickFormat(""))
                .selectAll("line, path").style("stroke", "#374151").style("stroke-dasharray", "3 3");

            chartG.append("g")
                .attr("class", "grid")
                .call(d3.axisLeft(yScale).ticks(5).tickSize(-chartWidth).tickFormat(""))
                .selectAll("line, path").style("stroke", "#374151").style("stroke-dasharray", "3 3");
        }

        const xAxisG = chartG.append("g")
            .attr("transform", `translate(0,${chartHeight})`)
            .call(xAxis);
        const yAxisG = chartG.append("g").call(yAxis);
        
        xAxisG.selectAll("text").style("fill", "#9ca3af");
        xAxisG.selectAll("line, path").style("stroke", "#374151");
        yAxisG.selectAll("text").style("fill", "#9ca3af");
        yAxisG.selectAll("line, path").style("stroke", "#374151");

        svg.append("text")
           .attr("transform", `translate(${margin.left + chartWidth / 2}, ${height - margin.bottom + 40})`)
           .style("text-anchor", "middle").style("fill", "#9ca3af")
           .text("Frequency (Hz)");

        svg.append("text")
           .attr("transform", "rotate(-90)")
           .attr("y", 0)
           .attr("x", 0 - (chartHeight / 2) - margin.top)
           .attr("dy", "1em")
           .style("text-anchor", "middle").style("fill", "#9ca3af")
           .text("Magnitude");

        const area = d3.area()
            .x((d: any) => xScale(d.x))
            .y0(chartHeight)
            .y1((d: any) => yScale(d.y));
        
        const line = d3.line()
            .x((d: any) => xScale(d.x))
            .y((d: any) => yScale(d.y));

        const defs = svg.append("defs");
        const gradient = defs.append("linearGradient")
            .attr("id", "fft-gradient")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
        gradient.append("stop").attr("offset", "0%").attr("stop-color", "#9333ea").attr("stop-opacity", 0.5);
        gradient.append("stop").attr("offset", "100%").attr("stop-color", "#9333ea").attr("stop-opacity", 0);

        // Add clip path for zooming (before chartContent)
        svg.append("defs").append("clipPath")
            .attr("id", "fft-clip")
            .append("rect")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("transform", `translate(${margin.left}, ${margin.top})`);

        const chartContent = chartG.append("g").attr("clip-path", "url(#fft-clip)");

        chartContent.append("path")
            .datum(plotData)
            .attr("fill", "url(#fft-gradient)")
            .attr("d", area);

        chartContent.append("path")
            .datum(plotData)
            .attr("fill", "none")
            .attr("stroke", "#9333ea")
            .attr("stroke-width", 1.5)
            .attr("d", line);

    }, [plotData, width, height, maxFrequency, isGridVisible]);

    return (
        <div ref={containerRef} className="w-full h-80 relative">
            <svg ref={svgRef} width={width} height={height}></svg>
        </div>
    );
};