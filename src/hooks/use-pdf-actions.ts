import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { isTauri } from '@tauri-apps/api/core';
import { documentDir } from '@tauri-apps/api/path';
import { BaseDirectory, writeFile, mkdir, exists, remove } from '@tauri-apps/plugin-fs';
import { usePrinter } from '@/hooks/use-printer';
import { processFileDownload } from '@/lib/utils';

export function usePdfActions() {
    const { printDocument } = usePrinter();
    const [isPrinting, setIsPrinting] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const handlePrint = async (docInstance: React.ReactElement<any>, fileNamePrefix: string) => {
        if (!docInstance) return;
        
        // Web Fallback
        if (!isTauri()) {
            toast.info('Sending to browser print...');
            window.print();
            return;
        }

        if (isPrinting) return;
        setIsPrinting(true);
        toast.info('Generating print job...');

        let filePath = '';

        try {
            const blob = await pdf(docInstance).toBlob();
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            const fileName = `${fileNamePrefix}_${Date.now()}.pdf`;
            const documentDirPath = await documentDir();
            const dealioFolderPath = `${documentDirPath}/Dealio`;

            if (!(await exists('Dealio', { baseDir: BaseDirectory.Document }))) {
                await mkdir('Dealio', { baseDir: BaseDirectory.Document, recursive: true });
            }

            filePath = `${dealioFolderPath}/${fileName}`;
            await writeFile(filePath, uint8Array, { baseDir: BaseDirectory.Document });

            printDocument('receipt', filePath, true);
            toast.success('Sent to printer!');
        } catch (error) {
            console.error('Print failed:', error);
            toast.error(`Print failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            try {
                if (filePath && (await exists(filePath, { baseDir: BaseDirectory.Document }))) {
                    await remove(filePath, { baseDir: BaseDirectory.Document });
                }
            } catch (e) {
                console.log('Printer error', e instanceof Error ? e.message : 'Unknown error');
            }
            setIsPrinting(false);
        }
    };

    const handleDownload = async (docInstance: React.ReactElement<any>, fileNamePrefix: string) => {
        if (!docInstance) return;
        if (isDownloading) return;

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
