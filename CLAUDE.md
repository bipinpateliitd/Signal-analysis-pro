# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Signal Analysis Pro is a specialized React-based web application for Acoustic Vector Sensor (AVS) signal processing and Direction of Arrival (DoA) estimation. It performs multi-channel signal analysis with advanced features including noise estimation, tonal detection, DoA calculation with orientation correction using IMU data, and 3D visualization of sensor orientation. Built with TypeScript, Vite, Tailwind CSS, and multiple visualization libraries (Recharts, D3.js).

## Development Commands

- `npm install` - Install dependencies
- `npm run dev` - Start development server (runs on port 3000, host 0.0.0.0)
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Architecture Overview

### Core Data Flow

1. **File Upload** → `FileUpload.tsx` component (supports WAV, CSV, XLSX)
2. **Parsing** → `services/fileParser.ts`
   - WAV: Browser AudioContext API for decoding
   - CSV: Custom parser for metadata + multi-channel data
   - XLSX: Orientation data (time, roll, pitch, yaw)
3. **Preprocessing** → DC offset removal (zero-mean centering)
4. **Signal Processing** → `services/signalProcessor.ts`
   - Filtering (IIR Butterworth: lowpass, highpass, bandpass)
   - FFT (Cooley-Tukey radix-2, power-of-2 padding)
   - STFT with Hann windowing for spectrograms
   - Welch PSD estimation
   - Noise estimation and tonal detection
   - DoA calculation using hydrophone + velocity sensors (vx, vy)
5. **State Management** → `App.tsx` (React hooks)
   - Raw signal data in `signalData` state
   - Processed/filtered data in `processedData` state
   - Filter application is async (setTimeout) to prevent UI blocking
6. **Visualization** → Multiple plot components + D3.js for advanced plots

### Key Components

- **App.tsx**: Main container, manages all global state including signal data, filter settings, channel selection, orientation data, and time synchronization
- **ControlPanel.tsx**: Left sidebar with file info, channel selection, filter configuration, normalization toggle, channel role assignment (hydrophone/vx/vy), orientation file upload, and time offset controls
- **ChannelAnalysis.tsx**: Per-channel analysis container with tabbed interface (Waveform/FFT/Spectrogram/Noise/Tonals/DoA). Includes download functionality for plots and CSV data. DoA tab supports dual view modes (time series and polar plot)
- **OrientationView.tsx**: 3D dolphin visualization showing IMU orientation (roll, pitch, yaw) with time slider, playback controls, and variable playback speed (0.5x, 1x, 2x, 5x)
- **Plot Components**:
  - `WaveformPlot`, `FftPlot`, `SpectrogramPlot` (use Recharts)
  - `PsdPlot`, `SignalActivityPlot`, `DoaPlot`, `DoaPolarPlot` (use D3.js directly for advanced features)

### Services Layer

**fileParser.ts**:
- `parseWav()`: Uses browser AudioContext.decodeAudioData() to decode WAV files
  - Generates default channel names: "Channel 1", "Channel 2", etc.
- `parseCsv()`: Custom parser that:
  - Extracts metadata rows before data header (e.g., "Sample Rate: 51200")
  - Finds data header row (starts with "Sample, Time..." or "Sample   Time...")
  - Supports both comma and whitespace delimited formats (detects separator automatically)
  - Skips first two columns (Sample, Time) and filters out "Unnamed" columns
  - Creates "Info-{number}" keys for non-colon-delimited metadata rows
  - Parses "Start Time" into separate Date (dd-mm-yyyy), Time (HH:MM:SS), and Day Type (AM/PM) fields
  - Returns error if no valid data channels found or sample rate missing
- `parseXlsx()`: Parses orientation data files (requires XLSX library loaded globally)
  - Expects first four columns: Time, Roll, Pitch, Yaw
  - Sorts data by time after parsing
- All parsers apply `removeDCOffset()` to create zero-mean signals

**signalProcessor.ts**:
- `fft()`: Iterative Cooley-Tukey FFT (requires power-of-2 input length)
- `calculateFFT()`: Pads to power of 2, returns magnitudes and frequencies
- `calculateWelchPsd()`: Welch's method with Hann windowing and 50% overlap
- `applyFilter()`: 2nd-order IIR Butterworth filters (lowpass, highpass, bandpass)
- `normalizeRms()`: RMS normalization for amplitude-independent analysis
- `estimateNoise()`: Frame-based energy analysis with percentile thresholding
- `detectTonals()`: Peak detection in PSD with SNR calculation and persistence tracking
- `calculateDoaVsTime()`: DoA estimation using cross-power spectral density between hydrophone and velocity sensors (vx, vy)
- `getInterpolatedOrientation()`: Binary search interpolation of orientation data
- `correctDoa()`: 3D rotation matrix correction of DoA using IMU orientation (roll, pitch, yaw)
- Matrix utilities: `invert3x3()`, `matmul3x3()`, `matVecMul3x3()` for orientation calculations

### Type System

Central types in `types.ts`:
- `SignalData`: Main structure with samplingRate, channels array, optional channelNames and headerInfo
- `FilterType`: Enum (NONE, LOWPASS, HIGHPASS, BANDPASS)
- `FilterSettings`: Configuration with type and cutoff (single number or [low, high] tuple)
- `ChannelRoles`: Assigns physical meaning to channels (hydrophone, vx, vy) for DoA analysis
- `OrientationData`: Time-series orientation data (time, roll, pitch, yaw)
- `DoaPoint`: DoA result with time, azimuth angle, confidence, and optional raw value
- `NoiseInfo`: Comprehensive noise analysis results with PSD, frame energies, and mask
- `PersistentTonal`: Detected tonal with mean frequency, SNR, power, and detection count

## Important Implementation Details

### External Library Dependencies

The app relies on globally loaded libraries (via CDN in index.html):
- **D3.js**: Used for advanced plots (PSD, signal activity, DoA) with custom axes and styling
- **html-to-image**: Used for PNG/SVG plot downloads
- **XLSX**: Used for parsing orientation data files
- These are declared with `declare var` in components to avoid TypeScript errors

### CSV File Format Requirements

- Must contain metadata rows before data header
- Data header must start with "Sample, Time..." or "Sample   Time..." (not just "Sample Rate")
- Requires "Sample Rate: [value]" in metadata
- Supports both comma and whitespace delimited files
- Filters out columns starting with "Unnamed"
- Optional "Start Time" metadata parsed into separate Date, Time, Day Type fields

### Signal Processing Specifics

- **FFT**: Zero-pads to next power of 2 for efficiency (Cooley-Tukey algorithm)
- **Filters**: 2nd-order Butterworth IIR filters (not first-order as might be implied elsewhere)
  - Default cutoffs: Lowpass 5000 Hz, Highpass 500 Hz, Bandpass [500, 6000] Hz
  - Applied with 50ms setTimeout delay to prevent UI blocking
- **Spectrograms**: Uses STFT with Hann window in a Web Worker for non-blocking calculation
  - Window size options: 256, 512, 1024 (default), 2048, 4096 samples
  - Hop size options: 64, 128, 256 (default), 512, 1024, 2048 samples
  - Magnitude calculation in dB scale (20*log10)
  - 80 dB dynamic range with d3.interpolateInferno color scale
  - User-configurable via dropdowns in SpectrogramPlot component
- **Welch PSD**: Default segment size 256 samples, 50% overlap, Hann windowing
- **Noise Estimation**:
  - Frame-based energy analysis with percentile thresholding
  - Default frame length: 0.1 seconds, percentile threshold: 30
  - 50% overlap (hopLength = frameLength / 2)
- **Tonal Detection**:
  - Default frequency range: [100, 6000] Hz
  - Default minimum SNR: 15 dB
  - Default frame duration: 1.0 second with 25% overlap (hopSize = frameSize / 4)
  - Default minimum frames present: 2
  - SNR calculated using local median noise floor (50 Hz window on each side of peak)
  - Tonal association across frames uses 50 Hz frequency tolerance
- **DoA Calculation**:
  - Requires channel role assignment (hydrophone, vx, vy)
  - Default frame duration: 5.0 seconds with 25% overlap
  - Uses cross-power spectral density at selected tonal frequency
  - Computes azimuth from atan2(G_pv.real, G_ph.real)
  - Confidence based on geometric mean of cross-channel coherence
  - Auto-selects first detected tonal if available
  - Dual visualization modes:
    - Time series: DoA angle plotted against time with confidence color-coding
    - Polar plot: DoA distribution in circular polar coordinates with statistics
- **Orientation Correction**:
  - Applies 3D rotation matrix (yaw → pitch → roll sequence)
  - Uses matrix inversion to transform from body frame to earth frame
  - Supports fixed elevation angle (default: 0°)
  - Linear interpolation between orientation data points

### State Management Pattern

- Raw signal data in `signalData` state (never modified after upload)
- Processed data in `processedData` state (recalculated when filters change)
- Filter application uses 50ms setTimeout to prevent UI blocking on large datasets
- Initial channel selection: first 4 channels (or fewer if less available)
- File upload validates >3 channels requirement (rejects if ≤3 channels)
- Normalization enabled by default
- Grid visibility enabled by default
- Max frequency default: min(6000, samplingRate / 2) Hz
- Welcome screen displays for 1500ms before fading
- Orientation data managed separately with time offset synchronization
- Channel roles prevent duplicate assignments (selecting a channel unassigns it from other roles)

### Visualization & UI Details

- **D3.js Plots**: Use ResizeObserver for responsive sizing with 80px right margin for legends
  - DoA time series plot: d3.interpolateViridis color scale for confidence gradient legend, scatter plot over time
  - DoA polar plot: Circular polar coordinate visualization with angle labels (0-360°), confidence-based coloring, statistics panel showing count, average/min/max DoA, and average confidence
  - Tonal plot: Yellow (#facc15) markers with hover tooltips showing frequency, SNR, power
  - Signal activity plot: Purple (#9333ea) shaded areas for detected noise regions
  - PSD plot: Blue (#3b82f6) line plot with optional grid overlay
  - All plots include robustness checks for invalid/infinite values
- **Layout**: Responsive grid with sticky control panel (lg:col-span-3 + lg:col-span-9)
- **Tabs**: Collapsible sections in ChannelAnalysis for Waveform, FFT, Spectrogram, Noise, Tonals, DoA
  - DoA tab includes view mode toggle (Time Series / Polar Plot) for switching between visualizations
- **Downloads**:
  - PNG/SVG downloads use `htmlToImage` library
  - CSV exports available for waveform, FFT, and DoA data (not spectrogram)
  - DoA CSV includes both raw and corrected values
  - Filenames include channel ID and plot type
- **Orientation Upload**: Accepts .xlsx files only via hidden file input
- **Orientation Viewer**:
  - 3D dolphin model replaces submarine visualization for more intuitive orientation display
  - Fixed axis labels (X, Y, Z) overlay on rotating dolphin body
  - Play/pause controls with Reset button
  - Variable playback speed (0.5x, 1x, 2x, 5x)
  - Displays both signal time and corresponding orientation file time
  - Enhanced play/pause icons with circular blue background

### Time Synchronization

- Signal data has implicit time domain (sample count / sampling rate)
- Orientation data has explicit timestamps
- `analysisStartTime`: User-configurable offset into signal data for DoA analysis
- `orientationStartTimeOffset`: Alignment offset between signal and orientation timelines
- `currentTime`: Shared time cursor for coordinated visualization

## Path Aliases

The project uses `@/` as an alias for the root directory (configured in vite.config.ts and tsconfig.json).

## Environment Variables

- `GEMINI_API_KEY`: Required for Gemini API integration (set in .env.local)
- Exposed to app as both `process.env.API_KEY` and `process.env.GEMINI_API_KEY`

## Project-Specific Requirements

- **Minimum 3 channels** required per file (validated on upload with `channels.length <= 3` check)
  - Displays error: "The uploaded file must have more than 3 channels."
- **Results saving**: Should be saved to `@result` folder with filename-based organization (user requirement)

## Python Reference Implementation

The repository includes `complete_avs_doa.py`, a Python implementation of the complete AVS DoA pipeline using scipy and numpy. This serves as a reference for the signal processing algorithms implemented in JavaScript/TypeScript. Key similarities:
- Preprocessing: DC removal, filtering, normalization
- Noise estimation: Frame-based energy percentile thresholding
- Tonal detection: Peak finding with SNR calculation
- DoA calculation: Cross-power spectral density method
- Orientation correction: 3D rotation matrix transformation

## Styling

- Uses Tailwind CSS via CDN (configured inline in index.html)
- Custom color palette: base-100/200/300 for dark theme backgrounds, primary/secondary/accent for highlights
- Responsive design with breakpoints (sm, lg)
- Custom CSS for 3D orientation viewer (dolphin model with perspective transforms)
  - Coordinate axes with red (X), green (Y), blue (Z) color coding
  - Fixed axis labels positioned as 2D overlays on 3D scene
  - Dolphin body parts: main body, nose, dorsal fin, tail, left/right fins
  - Scene perspective: 800px with 3D transforms for realistic rotation

## Important Implementation Patterns

### Async Processing
- All heavy computations use `setTimeout(fn, 50)` to yield to UI thread
- Spectrogram calculation uses dedicated Web Worker for complete non-blocking operation
- Loading states with spinner animations during processing

### Data Validation
- Robustness checks in D3 plots: verify finite values before rendering using `isFinite()` and `d3.extent()` validation
- FFT validates power-of-2 input length
- Filter design validates bandpass frequency order (lowCutoff < highCutoff < nyquist)
- CSV parser validates sample rate presence and data row format

### Error Handling
- Try-catch blocks with user-friendly error messages
- Fallback behaviors: invalid filters pass through unmodified data
- Graceful degradation: missing orientation data = no correction applied

### Performance Optimizations
- `React.memo()` wrapping for ChannelAnalysis component
- `useMemo()` for expensive calculations (FFT, PSD, plot data transformations)
- `useEffect()` cleanup functions to terminate workers and remove D3 tooltips
- ResizeObserver for responsive D3 plots instead of window resize listeners

### User Experience
- Auto-selection of first tonal for DoA analysis when tonals detected
- Tooltip removal on component unmount prevents DOM leak
- File input value reset after upload to allow re-uploading same file
- Disabled states on controls during processing
- Sticky control panel for easy access while scrolling through channels
