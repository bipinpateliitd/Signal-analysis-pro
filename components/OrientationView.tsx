import React, { useState, useEffect, useMemo, useRef } from 'react';
import { OrientationData } from '../types';
import { PlayIcon, PauseIcon } from './icons';
import { getInterpolatedOrientation } from '../services/signalProcessor';

interface OrientationViewProps {
    data: OrientationData[];
    currentTime: number;
    setCurrentTime: (time: number) => void;
    orientationStartTimeOffset: number;
    signalDuration: number;
}

export const OrientationView: React.FC<OrientationViewProps> = ({ data, currentTime, setCurrentTime, orientationStartTimeOffset, signalDuration }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const animationFrameRef = useRef<number>();

    const { minTime, maxTime } = useMemo(() => {
        if (!data || data.length === 0) return { minTime: 0, maxTime: 0 };
        return { minTime: 0, maxTime: signalDuration };
    }, [data, signalDuration]);
    
    const correspondingOrientationTime = currentTime + orientationStartTimeOffset;
    const { roll, pitch, yaw } = getInterpolatedOrientation(correspondingOrientationTime, data);
    
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
                const newTime = prevTime + (deltaTime * playbackSpeed);
                if (newTime >= maxTime) {
                    setIsPlaying(false);
                    return maxTime;
                }
                return newTime;
            });

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        if (isPlaying) {
            if (currentTime >= maxTime && maxTime > 0) {
                 setCurrentTime(minTime); // Loop back to start
            }
            animationFrameRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, playbackSpeed, setCurrentTime, minTime, maxTime]);

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
                <div className="w-80 h-80 mx-auto flex items-center justify-center mb-8 orientation-viewer">
                    <div className="scene">
                        {/* Fixed 2D Labels - Always visible, never rotate */}
                        <div className="axis-label-x-fixed">X</div>
                        <div className="axis-label-y-fixed">Y</div>
                        <div className="axis-label-z-fixed">Z</div>

                        <div
                            className="submarine"
                            style={{ transform: `rotateX(${-pitch}deg) rotateY(${yaw}deg) rotateZ(${-roll}deg)` }}
                        >
                            {/* Coordinate Axes (lines only, labels are fixed overlays) */}
                            <div className="axes">
                                {/* X-Axis (Red - Right/Starboard) */}
                                <div className="axis axis-x">
                                    <div className="axis-x-line"></div>
                                    <div className="axis-x-arrow"></div>
                                </div>

                                {/* Y-Axis (Green - Up/Dorsal) */}
                                <div className="axis axis-y">
                                    <div className="axis-y-line"></div>
                                    <div className="axis-y-arrow"></div>
                                </div>

                                {/* Z-Axis (Blue - Forward/Bow) */}
                                <div className="axis axis-z">
                                    <div className="axis-z-line"></div>
                                    <div className="axis-z-arrow"></div>
                                </div>
                            </div>

                            {/* Dolphin Parts */}
                            <div className="dolphin-body"></div>
                            <div className="dolphin-nose"></div>
                            <div className="dolphin-dorsal-fin"></div>
                            <div className="dolphin-tail"></div>
                            <div className="dolphin-fin-left"></div>
                            <div className="dolphin-fin-right"></div>
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
                    <div className="space-y-3">
                        <div className="flex items-center justify-center gap-4">
                            <button onClick={handlePlayPause} className="hover:scale-110 transition-transform">
                                {isPlaying ? <PauseIcon className="w-14 h-14"/> : <PlayIcon className="w-14 h-14"/>}
                            </button>
                            <button
                                onClick={() => setCurrentTime(minTime)}
                                className="px-3 py-1 bg-base-300 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                                disabled={currentTime === minTime}
                            >
                                Reset
                            </button>
                            <div className="flex items-center gap-2 bg-base-300 px-3 py-1 rounded-lg">
                                <span className="text-sm text-gray-400">Speed:</span>
                                {[0.5, 1, 2, 5].map(speed => (
                                    <button
                                        key={speed}
                                        onClick={() => setPlaybackSpeed(speed)}
                                        className={`px-2 py-1 rounded text-sm transition-colors ${
                                            playbackSpeed === speed
                                                ? 'bg-secondary text-white'
                                                : 'text-gray-400 hover:text-white'
                                        }`}
                                    >
                                        {speed}x
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
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
                        <div className="text-center text-sm text-gray-400 pt-1">
                            <p>
                                Signal Time: <span className="font-mono text-gray-300">{currentTime.toFixed(2)}s</span>
                                <span className="mx-2 text-gray-500">|</span>
                                Orientation File Time: <span className="font-mono text-gray-300">{correspondingOrientationTime.toFixed(2)}s</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
