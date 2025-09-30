
import React, { useState, useCallback } from 'react';
import { parseWav, parseCsv } from '../services/fileParser';
import { SignalData } from '../types';
import { UploadIcon } from './icons';

interface FileUploadProps {
  onFileUpload: (data: SignalData, fileName: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, setIsLoading, setError }) => {
  const [dragActive, setDragActive] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [samplingRate, setSamplingRate] = useState<string>('44100');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  }, []);

  const handleFile = async (file: File) => {
    setError(null);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      setCsvFile(file);
      return;
    }

    if (fileExtension !== 'wav' && fileExtension !== 'csv') {
      setError("Unsupported file type. Please upload a .wav or .csv file.");
      return;
    }

    setIsLoading(true);
    try {
      let data: SignalData;
      if (fileExtension === 'wav') {
        data = await parseWav(file);
      } else {
        // This part is now handled by the modal
        return;
      }
      onFileUpload(data, file.name);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to parse file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!csvFile) return;
      
      const rate = parseInt(samplingRate, 10);
      if (isNaN(rate) || rate <= 0) {
          setError("Please enter a valid, positive sampling rate.");
          return;
      }

      setIsLoading(true);
      setCsvFile(null); // Close modal
      try {
          const data = await parseCsv(csvFile, rate);
          onFileUpload(data, csvFile.name);
      } catch (error) {
           setError(error instanceof Error ? error.message : "Failed to parse CSV file.");
      } finally {
          setIsLoading(false);
      }
  };


  return (
    <>
      <div
        className={`w-full max-w-2xl text-center p-8 border-2 border-dashed rounded-lg transition-colors duration-300 ${dragActive ? 'border-secondary bg-base-300' : 'border-base-300 hover:border-secondary'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input type="file" id="file-upload" className="hidden" accept=".wav,.csv" onChange={handleChange} />
        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-4">
          <UploadIcon />
          <p className="text-xl font-semibold">Drag & Drop your .wav or .csv file here</p>
          <p className="text-gray-400">or</p>
          <span className="bg-primary hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors">
            Browse File
          </span>
           <p className="text-sm text-gray-500 mt-4">File must contain more than 3 channels of data.</p>
        </label>
      </div>

      {csvFile && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-base-200 p-8 rounded-lg shadow-xl w-full max-w-md">
            <h2 className="text-2xl font-bold mb-4">Enter Sampling Rate for CSV</h2>
            <p className="mb-6 text-gray-300">Please provide the sampling frequency (in Hz) for <span className="font-semibold text-secondary">{csvFile.name}</span>.</p>
            <form onSubmit={handleCsvSubmit}>
              <label htmlFor="sampling-rate" className="block text-sm font-medium text-gray-400 mb-2">Sampling Rate (Hz)</label>
              <input
                id="sampling-rate"
                type="number"
                value={samplingRate}
                onChange={(e) => setSamplingRate(e.target.value)}
                className="w-full bg-base-300 border border-gray-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-secondary focus:outline-none"
                placeholder="e.g., 44100"
                required
              />
              <div className="mt-6 flex justify-end gap-4">
                <button type="button" onClick={() => setCsvFile(null)} className="py-2 px-4 rounded-lg bg-base-300 hover:bg-gray-600 transition-colors">Cancel</button>
                <button type="submit" className="py-2 px-4 rounded-lg bg-primary hover:bg-blue-700 text-white font-bold transition-colors">Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
