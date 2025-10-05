import React, { useRef, useEffect, useMemo } from 'react';
import { DoaPoint } from '../types';

declare var d3: any;

const useResponsiveSVG = (containerRef: React.RefObject<HTMLDivElement>) => {
    const [size, setSize] = React.useState({ width: 0, height: 0 });
    useEffect(() => {
        const resizeObserver = new ResizeObserver(entries => {
            if (entries && entries.length > 0) {
                const { width, height } = entries[0].contentRect;
                setSize({ width, height });
            }
        });
        if (containerRef.current) resizeObserver.observe(containerRef.current);
        return () => {
            if (containerRef.current) resizeObserver.unobserve(containerRef.current);
        };
    }, [containerRef]);
    return size;
};

interface DoaPolarPlotProps {
    data: DoaPoint[];
    isGridVisible: boolean;
}

export const DoaPolarPlot: React.FC<DoaPolarPlotProps> = ({ data, isGridVisible }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const { width, height } = useResponsiveSVG(containerRef);

    useEffect(() => {
        if (!d3 || !svgRef.current || width === 0 || height === 0 || data.length === 0) return;

        const margin = { top: 40, right: 80, bottom: 40, left: 40 };
        const size = Math.min(width - margin.left - margin.right, height - margin.top - margin.bottom);
        const radius = size / 2;
        const centerX = width / 2;
        const centerY = height / 2;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const chartG = svg.append("g").attr("transform", `translate(${centerX},${centerY})`);

        // Color scale for confidence
        const colorScale = d3.scaleSequential(d3.interpolateViridis).domain([0, 1]);

        // Draw circular grid
        if (isGridVisible) {
            const circles = [0.25, 0.5, 0.75, 1.0];
            circles.forEach(fraction => {
                chartG.append("circle")
                    .attr("r", radius * fraction)
                    .attr("fill", "none")
                    .attr("stroke", "#374151")
                    .attr("stroke-dasharray", "3 3")
                    .attr("stroke-width", 1);
            });

            // Draw radial lines for angles (every 30 degrees)
            for (let angle = 0; angle < 360; angle += 30) {
                const rad = (angle - 90) * Math.PI / 180;
                chartG.append("line")
                    .attr("x1", 0)
                    .attr("y1", 0)
                    .attr("x2", radius * Math.cos(rad))
                    .attr("y2", radius * Math.sin(rad))
                    .attr("stroke", "#374151")
                    .attr("stroke-dasharray", "3 3")
                    .attr("stroke-width", 1);
            }
        }

        // Draw outer circle
        chartG.append("circle")
            .attr("r", radius)
            .attr("fill", "none")
            .attr("stroke", "#9ca3af")
            .attr("stroke-width", 2);

        // Draw angle labels
        const angles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
        angles.forEach(angle => {
            const rad = (angle - 90) * Math.PI / 180;
            const labelRadius = radius + 20;
            const x = labelRadius * Math.cos(rad);
            const y = labelRadius * Math.sin(rad);

            chartG.append("text")
                .attr("x", x)
                .attr("y", y)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle")
                .style("fill", "#9ca3af")
                .style("font-size", "12px")
                .style("font-weight", "bold")
                .text(`${angle}°`);
        });

        // Add title
        svg.append("text")
            .attr("x", centerX)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .style("fill", "#9ca3af")
            .style("font-size", "14px")
            .style("font-weight", "bold")
            .text("DoA Polar Distribution");

        // Create tooltip
        const tooltip = d3.select("body").append("div")
            .attr("class", "doa-polar-tooltip")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "#1f2937")
            .style("border", "1px solid #4b5563")
            .style("border-radius", "8px")
            .style("padding", "8px")
            .style("color", "#e5e7eb")
            .style("font-size", "12px")
            .style("pointer-events", "none")
            .style("z-index", "1000");

        // Plot data points
        // For polar plot, we distribute points radially
        // We can either:
        // 1. Plot all points at the edge (r = radius) at their angle
        // 2. Use time or another metric for radius
        // Let's use option 1: all points at edge, colored by confidence

        const points = data.map(d => {
            const angleRad = (d.doa - 90) * Math.PI / 180; // Convert to radians, offset by 90° for proper orientation
            return {
                x: radius * Math.cos(angleRad),
                y: radius * Math.sin(angleRad),
                original: d
            };
        });

        chartG.selectAll(".doa-polar-point")
            .data(points)
            .enter().append("circle")
            .attr("class", "doa-polar-point")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", 4)
            .attr("fill", d => colorScale(d.original.confidence))
            .attr("opacity", 0.7)
            .attr("stroke", "#111827")
            .attr("stroke-width", 1)
            .style("cursor", "pointer")
            .on("mouseover", (event, d) => {
                d3.select(event.currentTarget)
                    .transition()
                    .duration(100)
                    .attr("r", 6)
                    .attr("opacity", 1);

                tooltip.style("visibility", "visible")
                    .html(`<strong>DoA Point</strong><br/>
                           Time: ${d.original.time.toFixed(3)} s<br/>
                           Corrected DoA: ${d.original.doa.toFixed(1)}°<br/>
                           Raw DoA: ${d.original.doa_raw?.toFixed(1) ?? 'N/A'}°<br/>
                           Confidence: ${d.original.confidence.toFixed(3)}`);
            })
            .on("mousemove", (event) => {
                tooltip.style("top", (event.pageY - 10) + "px")
                    .style("left", (event.pageX + 10) + "px");
            })
            .on("mouseout", (event) => {
                d3.select(event.currentTarget)
                    .transition()
                    .duration(100)
                    .attr("r", 4)
                    .attr("opacity", 0.7);

                tooltip.style("visibility", "hidden");
            });

        // Add color legend
        const legendWidth = 20;
        const legendHeight = 150;
        const legendG = svg.append("g")
            .attr("transform", `translate(${width - margin.right + 20}, ${centerY - legendHeight / 2})`);

        const linearGradient = svg.append("defs")
            .append("linearGradient")
            .attr("id", "doa-polar-gradient")
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
            .attr("height", legendHeight)
            .style("fill", "url(#doa-polar-gradient)");

        const legendYScale = d3.scaleLinear()
            .domain([0, 1])
            .range([legendHeight, 0]);

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

    const stats = useMemo(() => {
        if (data.length === 0) return null;

        const avgDoa = data.reduce((sum, d) => sum + d.doa, 0) / data.length;
        const avgConfidence = data.reduce((sum, d) => sum + d.confidence, 0) / data.length;
        const minDoa = Math.min(...data.map(d => d.doa));
        const maxDoa = Math.max(...data.map(d => d.doa));

        return { avgDoa, avgConfidence, minDoa, maxDoa, count: data.length };
    }, [data]);

    return (
        <div className="space-y-4">
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div className="bg-base-300 p-3 rounded-lg">
                        <p className="text-xs text-gray-400">Points</p>
                        <p className="text-lg font-bold text-white">{stats.count}</p>
                    </div>
                    <div className="bg-base-300 p-3 rounded-lg">
                        <p className="text-xs text-gray-400">Avg DoA</p>
                        <p className="text-lg font-bold text-white">{stats.avgDoa.toFixed(1)}°</p>
                    </div>
                    <div className="bg-base-300 p-3 rounded-lg">
                        <p className="text-xs text-gray-400">Min DoA</p>
                        <p className="text-lg font-bold text-white">{stats.minDoa.toFixed(1)}°</p>
                    </div>
                    <div className="bg-base-300 p-3 rounded-lg">
                        <p className="text-xs text-gray-400">Max DoA</p>
                        <p className="text-lg font-bold text-white">{stats.maxDoa.toFixed(1)}°</p>
                    </div>
                    <div className="bg-base-300 p-3 rounded-lg">
                        <p className="text-xs text-gray-400">Avg Confidence</p>
                        <p className="text-lg font-bold text-white">{stats.avgConfidence.toFixed(3)}</p>
                    </div>
                </div>
            )}
            <div ref={containerRef} className="w-full h-96 relative">
                <svg ref={svgRef} width={width} height={height}></svg>
            </div>
        </div>
    );
};
