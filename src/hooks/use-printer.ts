import { PrinterDevice, PrinterJobType, usePrinterStore } from '@/store/printer-store';
import { useEffect, useState } from 'react';
// Import the specific functions from the v2 plugin
import { getPrinters, printPdf, printHtml } from 'tauri-plugin-printer-v2'; 
import { Order, BusinessSettings } from '@/store/store';
import { generateReceiptPDF, savePdfToTempFile } from '@/lib/receipt-generator';
import { PrintJob, PrintResult } from '@/types/print-types';
import { v4 as uuidv4 } from 'uuid';

export const usePrinter = () => {
  const store = usePrinterStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPrinters = async () => {
  setLoading(true);
  setError(null);
  try {
    // 1. Get the list (returns a JSON string)
    const list = await getPrinters();
    const printers = JSON.parse(JSON.parse(JSON.stringify(list)));
    // console.log(printers);

    // 2. Format specifically for this plugin's structure
    const formatted: PrinterDevice[] = printers.map((p: any) => ({
      id: p.Name, // Capitalized property name
      name: p.Name,
      description: p.ComputerName || '', // Using ComputerName as description
      driver_name: p.DriverName || 'System Driver',
      // Optional: Capture status if available
      status: p.PrinterStatus?.toString() || 'unknown' 
    }));
    
    store.setPrinters(formatted);
  } catch (err: any) {
    console.error("Printer Error:", err);
    setError("Failed to load printers.");
  } finally {
    setLoading(false);
  }
};

  /**
   * Main Print Function
   * @param type - 'receipt', 'invoice', etc.
   * @param data - Either an absolute file path (for PDFs) or an HTML string (for Receipts)
   * @param isPdf - boolean flag to explicitly tell the system this is a PDF path
   */
  const printDocument = async (
    type: PrinterJobType, 
    data: string, 
    isPdf: boolean = false, // Added flag to distinguish methods
    options?: any
  ) => {
    const printerId = store.assignments[type];

    if (!printerId) {
      throw new Error(`No printer assigned for ${type}s. Please configure in settings.`);
    }

    try {
      console.log(`Printing ${type} to ${printerId}...`);
      
      let result;

      if (isPdf) {
        // --- PDF STRATEGY ---
        // The plugin requires an absolute path. 
        // options can include { pages: '1-3', subset: 'odd' }
        result = await printPdf({
          path: data, 
          printer: printerId,
          ...options 
        });
      } else {
        // --- HTML STRATEGY ---
        // Used for thermal receipts or dynamic HTML generation
        result = await printHtml({
          id: printerId,
          html: data,
          printer: printerId
        });
      }
      
      console.log("Print Job Success:", result);
      return true;
    } catch (err) {
      console.error("Print Failed:", err);
      throw err;
    }
  };

  /**
   * Print a PDF receipt for an order
   */
  const printPdfReceipt = async (
    order: Order,
    settings: BusinessSettings,
    copies: number = 1
  ): Promise<PrintResult> => {
    const jobId = uuidv4();
    const printJob: PrintJob = {
      id: jobId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      timestamp: new Date(),
      status: 'pending',
      format: 'pdf',
      retryCount: 0,
      maxRetries: 2,
      jobType: 'customer',
    };

    try {
      // Add job to history
      store.addPrintJob({ ...printJob, status: 'printing' });

      // Generate PDF
      const pdfBlob = await generateReceiptPDF(order, settings);
      
      // Save to temp file
      const pdfPath = await savePdfToTempFile(pdfBlob, order.id);

      // Print the specified number of copies
      for (let i = 0; i < copies; i++) {
        await printDocument('receipt', pdfPath, true);
      }

      // Update job status
      store.updatePrintJob(jobId, { status: 'success' });

      return { success: true, jobId };
    } catch (error) {
      console.error('Print PDF receipt error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update job status
      store.updatePrintJob(jobId, { 
        status: 'failed', 
        error: errorMessage 
      });

      return { 
        success: false, 
        jobId, 
        error: errorMessage,
        requiresRetry: true 
      };
    }
  };

  /**
   * Retry a failed print job from the queue
   */
  const retryPrintJob = async (queueItem: any): Promise<PrintResult> => {
    const { id, orderId, retryCount, maxRetries, orderData } = queueItem;
    console.log(orderId);
    if (retryCount >= maxRetries) {
      return {
        success: false,
        error: 'Maximum retry attempts reached',
        requiresRetry: false,
      };
    }

    // Update retry count
    store.updatePrintJob(id, { 
      retryCount: retryCount + 1,
      status: 'printing' 
    });

    // Attempt to print again
    const result = await printPdfReceipt(
      orderData,
      orderData.settings,
      orderData.copies || 1
    );

    if (!result.success) {
      // Keep in queue if retry is needed
      store.updatePrintJob(id, { status: 'queued' });
    } else {
      // Remove from queue on success
      store.removeFromQueue(id);
    }

    return result;
  };

  useEffect(() => {
    refreshPrinters();
  }, []);

  return {
    ...store,
    loading,
    error,
    refreshPrinters,
    printDocument,
    printPdfReceipt,
    retryPrintJob,
  };
};