import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { isTauri } from '@tauri-apps/api/core';
import { documentDir, join } from '@tauri-apps/api/path';
import { BaseDirectory, writeFile, mkdir, exists } from '@tauri-apps/plugin-fs';
import { usePrinter } from '@/hooks/use-printer';
import { processFileDownload } from '@/lib/utils';

export function usePdfActions() {
    const { printDocument } = usePrinter();
    const [isPrinting, setIsPrinting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const handlePrint = async (docInstance: React.ReactElement<any>, fileNamePrefix: string) => {
        if (!docInstance) return;
        
        // Web Fallback: Open PDF in new tab to print
        if (!isTauri()) {
            try {
                const blob = await pdf(docInstance).toBlob();
                const url = URL.createObjectURL(blob);
                const printWindow = window.open(url);
                if (printWindow) {
                     // printWindow.print(); // Optional: attempts to trigger print dialog automatically
                } else {
                    toast.error('Pop-up blocked. Please allow pop-ups to print.');
                }
            } catch {
                toast.error('Failed to generate web print preview');
            }
            return;
        }

        if (isPrinting) return;
        setIsPrinting(true);
        const toastId = toast.loading('Preparing print job...');

        try {
            // 1. Generate Binary
            const blob = await pdf(docInstance).toBlob();
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // 2. Setup Paths
            const fileName = `${fileNamePrefix}_${Date.now()}.pdf`;
            const folderName = 'Dealio';
            
            // RELATIVE path for Tauri FS write (e.g., "Dealio/file.pdf")
            const relativePath = `${folderName}/${fileName}`; 

            // Check/Create Directory
            if (!(await exists(folderName, { baseDir: BaseDirectory.Document }))) {
                await mkdir(folderName, { baseDir: BaseDirectory.Document, recursive: true });
            }

            // 3. Write File using RELATIVE path + BaseDirectory scope
            await writeFile(relativePath, uint8Array, { baseDir: BaseDirectory.Document });

            // 4. Construct ABSOLUTE path for the Printer (Printer needs full OS path)
            // We use the join API to ensure OS-specific separators (\ vs /)
            const docDir = await documentDir();
            const absoluteFilePath = await join(docDir, folderName, fileName);

            // 5. Send to Printer
            // IMPORTANT: validPath needs to be absolute for external printer commands
            await printDocument('receipt', absoluteFilePath, true);
            
            toast.success('Sent to printer!', { id: toastId });

            // NOTE: We do NOT delete the file here. 
            // Deleting immediately causes "File not found" errors in the print spooler.
            // It is better to implement a cleanup routine on app startup 
            // that deletes files in the 'Dealio' folder older than 24 hours.

        } catch (error) {
            console.error('Print failed:', error);
            toast.error(`Print failed: ${error instanceof Error ? error.message : 'Unknown error'}`, { id: toastId });
        } finally {
            setIsPrinting(false);
        }
    };


    const handleDownload = async (docInstance: React.ReactElement<any>, fileNamePrefix: string) => {
        if (!docInstance) return toast.error('No document instance provided');
        if (isDownloading) return toast.error('Already downloading');

        setIsDownloading(true);
        const loadingToastId = toast.loading('Generating PDF...');

        try {
            const blob = await pdf(docInstance).toBlob();
            const fileName = `${fileNamePrefix}_${Date.now()}.pdf`;
            await processFileDownload(blob, fileName, loadingToastId);
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to save PDF', { id: loadingToastId });
        } finally {
            setIsDownloading(false);
        }
    };

    return {
        isPrinting,
        isDownloading,
        handlePrint,
        handleDownload
    };
}
