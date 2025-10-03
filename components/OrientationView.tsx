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
                <div className="w-full h-[24rem] flex items-center justify-center mb-4 orientation-viewer">
                    <div className="scene">
                        <div 
                            className="submarine"
                            style={{ transform: `rotateX(${-pitch}deg) rotateY(${yaw}deg) rotateZ(${-roll}deg)` }}
                        >
                            <div className="sub-part hull">
                                <div className="sub-face hull-front"></div>
                                <div className="sub-face hull-back"></div>
                                <div className="sub-face hull-right"></div>
                                <div className="sub-face hull-left"></div>
                                <div className="sub-face hull-top"></div>
                                <div className="sub-face hull-bottom"></div>
                            </div>
                            <div className="sub-part tower">
                                <div className="sub-face tower-front"></div>
                                <div className="sub-face tower-back"></div>
                                <div className="sub-face tower-right"></div>
                                <div className="sub-face tower-left"></div>
                                <div className="sub-face tower-top"></div>
                                <div className="sub-face tower-bottom"></div>
                            </div>
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
                    <div className="space-y-2">
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
