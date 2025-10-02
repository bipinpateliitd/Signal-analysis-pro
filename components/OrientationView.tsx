import React, { useState, useEffect, useMemo, useRef } from 'react';
import { OrientationData } from '../types';
import { PlayIcon, PauseIcon } from './icons';

interface OrientationViewProps {
    data: OrientationData[];
    currentTime: number;
    setCurrentTime: (time: number) => void;
}

const getInterpolatedOrientation = (time: number, data: OrientationData[]): { roll: number, pitch: number, yaw: number } => {
    if (data.length === 0) return { roll: 0, pitch: 0, yaw: 0 };
    if (time <= data[0].time) return data[0];
    if (time >= data[data.length - 1].time) return data[data.length - 1];

    let low = 0, high = data.length - 1;
    let index = -1;

    // Binary search to find the two points to interpolate between
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (data[mid].time <= time) {
            index = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    
    const p1 = data[index];
    const p2 = data[index + 1];

    if (!p2) return p1;

    const t = (time - p1.time) / (p2.time - p1.time);
    const roll = p1.roll + t * (p2.roll - p1.roll);
    const pitch = p1.pitch + t * (p2.pitch - p1.pitch);
    const yaw = p1.yaw + t * (p2.yaw - p1.yaw);

    return { roll, pitch, yaw };
};

export const OrientationView: React.FC<OrientationViewProps> = ({ data, currentTime, setCurrentTime }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const animationFrameRef = useRef<number>();

    const { minTime, maxTime } = useMemo(() => {
        if (!data || data.length === 0) return { minTime: 0, maxTime: 0 };
        return { minTime: data[0].time, maxTime: data[data.length - 1].time };
    }, [data]);
    
    const { roll, pitch, yaw } = getInterpolatedOrientation(currentTime, data);
    
    useEffect(() => {
        let lastTime: number | null = null;
        
        const animate = (timestamp: number) => {
            if (lastTime === null) {
                lastTime = timestamp;
                animationFrameRef.current = requestAnimationFrame(animate);
                return;
            }
            
            const deltaTime = (timestamp - lastTime) / 1000.0; // seconds
            lastTime = timestamp;

            setCurrentTime(prevTime => {
                const newTime = prevTime + deltaTime;
                if (newTime >= maxTime) {
                    setIsPlaying(false);
                    return maxTime;
                }
                return newTime;
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        if (isPlaying) {
            if (currentTime >= maxTime) {
                 setCurrentTime(minTime); // Loop back to start
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, setCurrentTime, minTime, maxTime]);

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCurrentTime(parseFloat(e.target.value));
    };

    return (
        <div className="bg-base-200 p-4 rounded-xl shadow-lg">
            <h3 className="text-2xl font-bold text-white mb-4 text-center">Orientation Viewer</h3>
            <div className="flex flex-col items-center">
                <div className="w-full h-64 flex items-center justify-center mb-4 orientation-viewer">
                    <div className="scene">
                        <div 
                            className="cube"
                            style={{ transform: `translateZ(-6.25rem) rotateX(${-pitch}deg) rotateY(${yaw}deg) rotateZ(${-roll}deg)` }}
                        >
                            <div className="cube__face cube__face--front">FRONT</div>
                            <div className="cube__face cube__face--back"><span>BACK</span></div>
                            <div className="cube__face cube__face--right">RIGHT</div>
                            <div className="cube__face cube__face--left">LEFT</div>
                            <div className="cube__face cube__face--top">TOP</div>
                            <div className="cube__face cube__face--bottom">BOTTOM</div>
                        </div>
                    </div>
                </div>

                <div className="w-full max-w-2xl space-y-4">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="bg-base-300 p-2 rounded-lg">
                            <p className="text-sm text-gray-400">Roll</p>
                            <p className="text-xl font-mono text-white">{roll.toFixed(2)}°</p>
                        </div>
                        <div className="bg-base-300 p-2 rounded-lg">
                            <p className="text-sm text-gray-400">Pitch</p>
                            <p className="text-xl font-mono text-white">{pitch.toFixed(2)}°</p>
                        </div>
                         <div className="bg-base-300 p-2 rounded-lg">
                            <p className="text-sm text-gray-400">Yaw</p>
                            <p className="text-xl font-mono text-white">{yaw.toFixed(2)}°</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handlePlayPause} className="text-secondary hover:text-blue-400 transition-colors">
                            {isPlaying ? <PauseIcon className="w-8 h-8"/> : <PlayIcon className="w-8 h-8"/>}
                        </button>
                        <span className="text-sm font-mono text-gray-400 w-20 text-center">{currentTime.toFixed(2)}s</span>
                        <input
                            type="range"
                            min={minTime}
                            max={maxTime}
                            step="0.01"
                            value={currentTime}
                            onChange={handleSliderChange}
                            className="w-full h-2 bg-base-300 rounded-lg appearance-none cursor-pointer accent-secondary"
                        />
                        <span className="text-sm font-mono text-gray-400 w-20 text-center">{maxTime.toFixed(2)}s</span>
                    </div>
                </div>
            </div>
        </div>
    );
};