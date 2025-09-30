import React from 'react';
import { KairosFullLogo } from './icons';

interface WelcomeScreenProps {
    isVisible: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ isVisible }) => {
    return (
        <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-base-100 transition-opacity duration-500 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <KairosFullLogo className="w-80 h-auto" />
            <div className="text-center mt-8">
                <p className="text-lg text-blue-300">Analyzing the Depths of Underwater Signals</p>
            </div>
            <div className="absolute bottom-16 text-center">
                 <p className="text-gray-400 text-lg animate-pulse">Loading...</p>
            </div>
        </div>
    );
};
