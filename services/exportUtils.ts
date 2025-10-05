// Declare htmlToImage for TypeScript
declare var htmlToImage: any;

export interface ExportProgress {
    current: number;
    total: number;
    currentFile: string;
}

export interface PlotExportData {
    channelId: number;
    channelName: string;
    plotType: string;
    element: HTMLElement;
}

/**
 * Extract filename without extension from full filename
 */
export function getFileNameWithoutExtension(fileName: string): string {
    return fileName.replace(/\.[^/.]+$/, '');
}

/**
 * Check if File System Access API is supported
 */
export function isFileSystemAccessSupported(): boolean {
    return 'showDirectoryPicker' in window;
}

/**
 * Request directory handle from user (must be called directly from user gesture)
 */
export async function requestDirectoryHandle(): Promise<any> {
    if (!isFileSystemAccessSupported()) {
        throw new Error('File System Access API is not supported in this browser');
    }

    try {
        // @ts-ignore - File System Access API
        const dirHandle = await window.showDirectoryPicker();
        return dirHandle;
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error('Export cancelled by user');
        }
        throw error;
    }
}

/**
 * Export all plots to a previously-selected directory using File System Access API
 */
export async function exportPlotsToDirectoryHandle(
    dirHandle: any,
    plots: PlotExportData[],
    baseFileName: string,
    onProgress?: (progress: ExportProgress) => void
): Promise<void> {
    try {
        const baseFileNameClean = getFileNameWithoutExtension(baseFileName);

        // Export each plot directly to selected directory
        for (let i = 0; i < plots.length; i++) {
            const plot = plots[i];
            const fileName = `${baseFileNameClean}_channel_${plot.channelId + 1}_${plot.plotType}.png`;

            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: plots.length,
                    currentFile: fileName
                });
            }

            // Generate PNG using htmlToImage
            const dataUrl = await htmlToImage.toPng(plot.element, {
                cacheBust: true,
                backgroundColor: '#1f2937',
                pixelRatio: 2
            });

            // Convert data URL to blob
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            // Write file to directory
            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
        }
    } catch (error: any) {
        throw error;
    }
}

/**
 * Fallback: Export all plots as ZIP file (for browsers without File System Access API)
 * Note: Requires JSZip library to be loaded
 */
export async function exportAllPlotsAsZip(
    plots: PlotExportData[],
    baseFileName: string,
    onProgress?: (progress: ExportProgress) => void
): Promise<void> {
    // @ts-ignore - JSZip is loaded via CDN
    if (typeof JSZip === 'undefined') {
        throw new Error('JSZip library is not loaded');
    }

    try {
        // @ts-ignore
        const zip = new JSZip();
        const folderName = getFileNameWithoutExtension(baseFileName);
        const folder = zip.folder(folderName);

        // Generate PNGs and add to ZIP
        for (let i = 0; i < plots.length; i++) {
            const plot = plots[i];
            const fileName = `channel_${plot.channelId + 1}_${plot.plotType}.png`;

            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total: plots.length,
                    currentFile: fileName
                });
            }

            try {
                console.log(`Capturing ${fileName}...`, plot.element);

                // Add extra wait for rendering to complete
                await new Promise(resolve => setTimeout(resolve, 200));

                const dataUrl = await htmlToImage.toPng(plot.element, {
                    cacheBust: true,
                    backgroundColor: '#1f2937',
                    pixelRatio: 2,
                    skipFonts: false
                });

                console.log(`Data URL length for ${fileName}:`, dataUrl?.length || 0);

                if (!dataUrl || dataUrl.length < 100) {
                    console.error(`Failed to capture ${fileName} - empty or invalid data URL`);
                    continue; // Skip this plot
                }

                // Convert data URL to blob
                const response = await fetch(dataUrl);
                const blob = await response.blob();

                console.log(`Blob size for ${fileName}:`, blob.size);

                if (blob.size === 0) {
                    console.error(`Failed to create blob for ${fileName} - 0 bytes`);
                    continue; // Skip this plot
                }

                folder!.file(fileName, blob);
            } catch (error) {
                console.error(`Error capturing ${fileName}:`, error);
                // Continue with next plot instead of failing completely
            }
        }

        // Generate ZIP and download
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `${folderName}_plots.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        throw error;
    }
}

/**
 * Main export function - exports to directory handle (File System Access API)
 */
export async function exportAllPlotsToDirectory(
    dirHandle: any,
    plots: PlotExportData[],
    baseFileName: string,
    onProgress?: (progress: ExportProgress) => void
): Promise<{ success: boolean; message: string; method: 'directory' }> {
    try {
        if (plots.length === 0) {
            return { success: false, message: 'No plots to export', method: 'directory' };
        }

        await exportPlotsToDirectoryHandle(dirHandle, plots, baseFileName, onProgress);
        return {
            success: true,
            message: `Successfully exported ${plots.length} plots to selected folder`,
            method: 'directory'
        };
    } catch (error: any) {
        console.error('Export error:', error);
        return {
            success: false,
            message: error.message || 'Failed to export plots',
            method: 'directory'
        };
    }
}

/**
 * Main export function - exports as ZIP (fallback)
 */
export async function exportAllPlotsAsZipFile(
    plots: PlotExportData[],
    baseFileName: string,
    onProgress?: (progress: ExportProgress) => void
): Promise<{ success: boolean; message: string; method: 'zip' }> {
    try {
        if (plots.length === 0) {
            return { success: false, message: 'No plots to export', method: 'zip' };
        }

        await exportAllPlotsAsZip(plots, baseFileName, onProgress);
        const folderName = getFileNameWithoutExtension(baseFileName);
        return {
            success: true,
            message: `Successfully exported ${plots.length} plots as ${folderName}_plots.zip`,
            method: 'zip'
        };
    } catch (error: any) {
        console.error('Export error:', error);
        return {
            success: false,
            message: error.message || 'Failed to export plots',
            method: 'zip'
        };
    }
}
