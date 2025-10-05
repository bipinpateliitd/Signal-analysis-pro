import React from 'react';
import { ExportProgress } from '../services/exportUtils';

interface ExportProgressModalProps {
    isOpen: boolean;
    progress: ExportProgress | null;
    onCancel?: () => void;
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({ isOpen, progress, onCancel }) => {
    if (!isOpen) return null;

    const percentComplete = progress ? Math.round((progress.current / progress.total) * 100) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-base-200 rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
                <h3 className="text-2xl font-bold text-white mb-4">Exporting Plots</h3>

                {progress && (
                    <>
                        <div className="mb-6">
                            <div className="flex justify-between text-sm text-gray-400 mb-2">
                                <span>Progress</span>
                                <span>{progress.current} / {progress.total}</span>
                            </div>
                            <div className="w-full bg-base-300 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-secondary h-full transition-all duration-300 ease-out"
                                    style={{ width: `${percentComplete}%` }}
                                />
                            </div>
                            <div className="mt-2 text-center">
                                <p className="text-lg font-bold text-white">{percentComplete}%</p>
                            </div>
                        </div>

                        <div className="mb-6 bg-base-300 p-3 rounded-lg">
                            <p className="text-sm text-gray-400 mb-1">Current File:</p>
                            <p className="text-white font-mono text-sm break-all">{progress.currentFile}</p>
                        </div>

                        <div className="flex items-center justify-center gap-3">
                            <div className="animate-spin h-5 w-5 border-2 border-secondary border-t-transparent rounded-full"></div>
                            <p className="text-gray-300">Please wait...</p>
                        </div>
                    </>
                )}

                {!progress && (
                    <div className="flex items-center justify-center gap-3 py-8">
                        <div className="animate-spin h-8 w-8 border-3 border-secondary border-t-transparent rounded-full"></div>
                        <p className="text-white text-lg">Initializing export...</p>
                    </div>
                )}

                {onCancel && (
                    <button
                        onClick={onCancel}
                        className="mt-6 w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                        Cancel Export
                    </button>
                )}
            </div>
        </div>
    );
};
