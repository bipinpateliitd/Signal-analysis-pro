import { SignalData } from '../types';

// Use browser-native AudioContext for robust WAV parsing
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

/**
 * Removes the DC offset from each channel by making it zero-mean.
 * @param channels - The raw channel data.
 * @returns The processed channel data with DC offset removed.
 */
const removeDCOffset = (channels: number[][]): number[][] => {
  return channels.map(channel => {
    if (channel.length === 0) {
      return [];
    }
    const sum = channel.reduce((acc, val) => acc + val, 0);
    const mean = sum / channel.length;
    // This creates a new array with the mean subtracted from each value.
    return channel.map(val => val - mean);
  });
};

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
          let channels: number[][] = [];
          for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            channels.push(Array.from(audioBuffer.getChannelData(i)));
          }
          
          const processedChannels = removeDCOffset(channels);
          
          resolve({
            samplingRate: audioBuffer.sampleRate,
            channels: processedChannels,
            channelNames: Array.from({ length: audioBuffer.numberOfChannels }, (_, i) => `Channel ${i + 1}`),
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

export const parseCsv = (file: File): Promise<SignalData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split(/\r?\n/);

        let samplingRate: number | null = null;
        const headerInfo: Record<string, string> = {};
        let channelNames: string[] = [];
        let channels: number[][] = [];
        
        let dataHeaderIndex = -1;
        // Find the row with the data column headers.
        // It should start with "Sample" followed by "Time", separated by comma or whitespace.
        for (let i = 0; i < rows.length; i++) {
          const trimmedLowerRow = rows[i].trim().toLowerCase();
          // This more specific check avoids matching metadata lines like "Sample Rate".
          if (trimmedLowerRow.startsWith('sample,') || /^sample\s+time/.test(trimmedLowerRow)) {
            dataHeaderIndex = i;
            break;
          }
        }

        if (dataHeaderIndex === -1) {
          return reject(new Error('Could not find a data header row (e.g., starting with "Sample, Time..." or "Sample   Time...") in the CSV file.'));
        }

        // Parse metadata from rows before the data header
        const metadataRows = rows.slice(0, dataHeaderIndex).filter(row => row.trim() !== '');
        metadataRows.forEach(row => {
          const parts = row.split(':');
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim();
            headerInfo[key] = value;
            if (key.toLowerCase().includes('sample rate')) {
              samplingRate = parseInt(value, 10);
            }
          } else if(row.trim()) {
            headerInfo[`Info-${Object.keys(headerInfo).length}`] = row.trim();
          }
        });
        
        // Specifically parse the Start Time field like the Python script
        const rawStartTime = headerInfo['Start Time'];
        if (rawStartTime) {
          try {
            const dt = new Date(rawStartTime);
            if (isNaN(dt.getTime())) {
              throw new Error('Invalid Date');
            }
            
            // Format Date: dd-mm-yyyy
            const day = String(dt.getDate()).padStart(2, '0');
            const month = String(dt.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
            const year = dt.getFullYear();
            headerInfo['Date'] = `${day}-${month}-${year}`;

            // Format Time: HH:MM:SS (24-hour)
            const hours = String(dt.getHours()).padStart(2, '0');
            const minutes = String(dt.getMinutes()).padStart(2, '0');
            const seconds = String(dt.getSeconds()).padStart(2, '0');
            headerInfo['Time'] = `${hours}:${minutes}:${seconds}`;

            // Format Day Type: AM/PM
            headerInfo['Day Type'] = dt.getHours() >= 12 ? 'PM' : 'AM';

            // Remove the original long-form key to avoid redundancy
            delete headerInfo['Start Time'];
          } catch (e) {
            console.warn("Could not parse 'Start Time' from CSV header:", rawStartTime, e);
            // If parsing fails, just leave the original 'Start Time' in the headerInfo.
          }
        }


        if (samplingRate === null || isNaN(samplingRate)) {
          return reject(new Error('Sample Rate not found or is invalid in the CSV header. Please ensure a line like "Sample Rate: 51200" exists.'));
        }
        
        // Parse the data header row to get all column names
        const dataHeaderRow = rows[dataHeaderIndex].trim();
        let allColumnNames: string[];
        const isCommaSeparated = dataHeaderRow.includes(',');
        
        if (isCommaSeparated) {
            allColumnNames = dataHeaderRow.split(',').map(s => s.trim());
        } else {
            // Split by 2 or more whitespace characters to handle names with single spaces
            allColumnNames = dataHeaderRow.split(/\s{2,}/).map(s => s.trim());
        }
        
        // Filter out columns that start with "Unnamed" or have no name (from trailing delimiters)
        const validDataColumns = allColumnNames
            .map((name, index) => ({ name, originalIndex: index }))
            .slice(2) // Skip first two assumed columns (Sample, Time)
            .filter(col => col.name && !/^unnamed/i.test(col.name));

        if (validDataColumns.length === 0) {
            return reject(new Error('No valid data channels found after filtering "Unnamed" columns.'));
        }
        
        channelNames = validDataColumns.map(col => col.name);
        channels = Array.from({ length: channelNames.length }, () => []);


        // Parse the actual data rows
        const dataRows = rows.slice(dataHeaderIndex + 1).filter(row => row.trim() !== '');
        dataRows.forEach((row, rowIndex) => {
          // Split based on the detected separator
          const values = isCommaSeparated
            ? row.trim().split(',')
            : row.trim().split(/\s+/);
            
          // Iterate through only the valid columns and use their original index to get the data
          validDataColumns.forEach(({ name, originalIndex }, channelIndex) => {
            const valueStr = values[originalIndex];
            if (valueStr === undefined || valueStr.trim() === '') {
              // Handle cases where a row might be shorter or have empty values for valid columns
              channels[channelIndex].push(0); // or NaN, depending on desired behavior
              return;
            }
            const value = parseFloat(valueStr);
            if (isNaN(value)) {
              return reject(new Error(`Invalid number found at data row ${rowIndex + 1}, column ${originalIndex + 1} ("${name}"): "${valueStr}"`));
            }
            channels[channelIndex].push(value);
          });
        });

        if (channels.some(ch => ch.length === 0)) {
          return reject(new Error('No valid data rows could be parsed from the CSV file.'));
        }
        
        const processedChannels = removeDCOffset(channels);

        resolve({ samplingRate, channels: processedChannels, channelNames, headerInfo });
      } catch (error) {
        reject(error instanceof Error ? error : new Error('An unexpected error occurred during CSV parsing.'));
      }
    };
    reader.onerror = () => {
      reject(new Error('Error reading the file.'));
    };
    reader.readAsText(file);
  });
};