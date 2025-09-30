
import { SignalData } from '../types';

// Use browser-native AudioContext for robust WAV parsing
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

export const parseWav = (file: File): Promise<SignalData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!(event.target?.result instanceof ArrayBuffer)) {
        return reject(new Error('Failed to read file as ArrayBuffer.'));
      }
      audioContext.decodeAudioData(
        event.target.result,
        (audioBuffer) => {
          const channels: number[][] = [];
          for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            channels.push(Array.from(audioBuffer.getChannelData(i)));
          }
          resolve({
            samplingRate: audioBuffer.sampleRate,
            channels,
          });
        },
        (error) => {
          reject(new Error(`Could not decode audio data: ${error.message}`));
        }
      );
    };
    reader.onerror = () => {
      reject(new Error('Error reading the file.'));
    };
    reader.readAsArrayBuffer(file);
  });
};

export const parseCsv = (file: File, samplingRate: number): Promise<SignalData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split(/\r?\n/).filter(row => row.trim() !== '');
        
        if (rows.length === 0) {
          return reject(new Error('CSV file is empty.'));
        }
        
        // Use first row to determine number of channels
        const numChannels = rows[0].split(',').length;
        const channels: number[][] = Array.from({ length: numChannels }, () => []);

        rows.forEach((row, rowIndex) => {
          const values = row.split(',');
          if (values.length !== numChannels) {
            // Allow for trailing commas
            if(values.length === numChannels + 1 && values[numChannels] === '') {
              // do nothing
            } else {
              return reject(new Error(`Inconsistent number of columns at row ${rowIndex + 1}. Expected ${numChannels}, found ${values.length}.`));
            }
          }
          for (let i = 0; i < numChannels; i++) {
            const value = parseFloat(values[i]);
            if (isNaN(value)) {
              // Try to skip header row
              if (rowIndex === 0) continue;
              return reject(new Error(`Invalid number found at row ${rowIndex + 1}, column ${i + 1}: "${values[i]}"`));
            }
            channels[i].push(value);
          }
        });
        
        // check if header row was skipped and channels are now empty
        if (channels.some(ch => ch.length === 0)) {
            return reject(new Error('CSV file seems to contain only a header or is empty.'));
        }

        resolve({ samplingRate, channels });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => {
      reject(new Error('Error reading the file.'));
    };
    reader.readAsText(file);
  });
};
