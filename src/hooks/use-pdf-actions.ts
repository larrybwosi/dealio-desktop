import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { toast } from 'sonner';
import { isTauri } from '@tauri-apps/api/core';
import { usePrinter } from '@/hooks/use-printer';
import { processFileDownload } from '@/lib/utils';
import { usePosStore } from '@/store/store';
import { useAuthStore } from '@/store/pos-auth-store';
import { PrinterJobType } from '@/store/printer-store';

export function usePdfActions() {
  const { printNative } = usePrinter();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handlePrint = async (
    docInstance: React.ReactElement<any>,
    _fileNamePrefix: string,
    orderData?: any,
    jobType: PrinterJobType = 'receipt'
  ) => {
    if (!docInstance) return;

    if (isPrinting) return;
    setIsPrinting(true);
    const toastId = toast.loading('Preparing print job...');

    try {
      // Use native thermal printing if on Tauri
      if (isTauri() && orderData) {
        const settings = usePosStore.getState().settings;
        const branchName = useAuthStore.getState().currentLocation?.name;

        const result = await printNative(jobType, orderData, settings, branchName);

        if (result.success) {
          toast.success('Sent to printer!', { id: toastId });
        } else {
          throw new Error(result.error || 'Native print failed');
        }
        return;
      }

      // Web Fallback: Open PDF in new tab to print
      // We open the window immediately to avoid popup blockers
      const printWindow = window.open('', '_blank');

      if (!printWindow) {
        toast.error('Pop-up blocked. Please allow pop-ups to print.', { id: toastId });
        setIsPrinting(false);
        return;
      }

      const blob = await pdf(docInstance).toBlob();
      const url = URL.createObjectURL(blob);

      printWindow.location.href = url;
      toast.success('Print preview opened', { id: toastId });
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
    handleDownload,
  };
}
