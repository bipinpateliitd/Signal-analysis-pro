import React, { useRef, useEffect, useMemo, useState } from 'react';
import { PlotPoint } from '../types';

// To avoid performance issues, we downsample the data for visualization
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

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                // eslint-disable-next-line react-hooks/exhaustive-deps
                resizeObserver.unobserve(containerRef.current);
            }
        };
    }, [containerRef]);

    return size;
};

export const WaveformPlot: React.FC<{ data: number[]; samplingRate: number }> = ({ data, samplingRate }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const { width, height } = useResponsiveSVG(containerRef);

    const [currentDomain, setCurrentDomain] = useState<[number, number] | null>(null);

    const plotData = useMemo<PlotPoint[]>(() => {
        const step = data.length > MAX_POINTS ? Math.floor(data.length / MAX_POINTS) : 1;
        const sampledData: PlotPoint[] = [];
        for (let i = 0; i < data.length; i += step) {
            sampledData.push({ x: i / samplingRate, y: data[i] });
        }
        return sampledData;
    }, [data, samplingRate]);

    useEffect(() => {
        // @ts-ignore
        const d3 = window.d3;
        if (!d3 || !svgRef.current || width === 0 || height === 0 || !plotData.length) return;

        const margin = { top: 20, right: 30, bottom: 60, left: 60 };
        const chartWidth = width - margin.left - margin.right;
        const brushHeight = 30;
        const mainChartHeight = height - margin.top - margin.bottom - brushHeight - 20;

        const fullXDomain = d3.extent(plotData, (d: PlotPoint) => d.x);
        if (!fullXDomain || fullXDomain[0] === undefined || fullXDomain[1] === undefined) return;

        const yExtent = d3.extent(plotData, (d: PlotPoint) => d.y);
        if(!yExtent || yExtent[0] === undefined || yExtent[1] === undefined) return;
        
        const padding = (yExtent[1] - yExtent[0]) * 0.1 || 1;
        const fullYDomain: [number, number] = [yExtent[0] - padding, yExtent[1] + padding];
        
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove(); // Clear previous render

        const xDomain = currentDomain || fullXDomain;

        const xScale = d3.scaleLinear().domain(xDomain).range([0, chartWidth]);
        const yScale = d3.scaleLinear().domain(fullYDomain).range([mainChartHeight, 0]);

        const xAxis = d3.axisBottom(xScale).ticks(7).tickFormat((d: any) => `${Number(d).toFixed(3)}s`);
        const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d: any) => Number(d).toExponential(2));

        const chartG = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        chartG.append("defs").append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", chartWidth)
            .attr("height", mainChartHeight);

        const xAxisG = chartG.append("g")
            .attr("transform", `translate(0,${mainChartHeight})`)
            .call(xAxis);
        
        const yAxisG = chartG.append("g").call(yAxis);
        
        xAxisG.selectAll("text").style("fill", "#9ca3af");
        xAxisG.selectAll("line, path").style("stroke", "#374151");
        yAxisG.selectAll("text").style("fill", "#9ca3af");
        yAxisG.selectAll("line, path").style("stroke", "#374151");

        svg.append("text")
           .attr("transform", `translate(${margin.left + chartWidth / 2}, ${height - margin.bottom + 10})`)
           .style("text-anchor", "middle")
           .style("fill", "#9ca3af")
           .text("Time (s)");

        svg.append("text")
           .attr("transform", "rotate(-90)")
           .attr("y", 0)
           .attr("x", 0 - (mainChartHeight / 2) - margin.top)
           .attr("dy", "1em")
           .style("text-anchor", "middle")
           .style("fill", "#9ca3af")
           .text("Amplitude");


        const line = d3.line()
            .x((d: any) => xScale(d.x))
            .y((d: any) => yScale(d.y));

        chartG.append("path")
            .datum(plotData)
            .attr("fill", "none")
            .attr("stroke", "#3b82f6")
            .attr("stroke-width", 1.5)
            .attr("d", line)
            .attr("clip-path", "url(#clip)");
        
        // Brush
        const brushXScale = d3.scaleLinear().domain(fullXDomain).range([0, chartWidth]);
        const brushYScale = d3.scaleLinear().domain(fullYDomain).range([brushHeight, 0]);

        const brushContext = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top + mainChartHeight + 20})`);
        
        const brushLine = d3.line()
            .x((d: any) => brushXScale(d.x))
            .y((d: any) => brushYScale(d.y));
            
        brushContext.append("path")
            .datum(plotData)
            .attr("fill", "none")
            .attr("stroke", "#9333ea")
            .attr("stroke-width", 1)
            .attr("d", brushLine);

        const brush = d3.brushX()
            .extent([[0, 0], [chartWidth, brushHeight]])
            .on("brush end", (event: any) => {
                if (event.selection) {
                    const newXDomain = event.selection.map(brushXScale.invert);
                    setCurrentDomain(newXDomain);
                } else if (!event.sourceEvent) {
                    setCurrentDomain(null);
                }
            });

        brushContext.append("g")
            .attr("class", "brush")
            .call(brush)
            .call(brush.move, currentDomain ? currentDomain.map(brushXScale) : fullXDomain.map(brushXScale));

    }, [plotData, width, height, currentDomain]);

    return (
        <div ref={containerRef} className="w-full h-80">
            <svg ref={svgRef} width={width} height={height}></svg>
        </div>
    );
};