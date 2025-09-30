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

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = async (file: File) => {
    setError(null);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension !== 'wav' && fileExtension !== 'csv') {
      setError("Unsupported file type. Please upload a .wav or .csv file.");
      return;
    }

    setIsLoading(true);
    try {
      let data: SignalData;
      if (fileExtension === 'wav') {
        data = await parseWav(file);
      } else { // It's a csv
        data = await parseCsv(file);
      }
      onFileUpload(data, file.name);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to parse file.");
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  }, []);

  return (
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
  );
};
