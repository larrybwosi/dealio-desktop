'use client';

import { useMemo, useState, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Printer, Download, CheckCircle2, Loader2, Receipt, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'qrcode'; 

// UI Components
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

import { ReceiptPdfDocument } from '@/components/receipt-pdf';
import { ReceiptPreview } from '@/components/receipt-preview'; 
import { usePosStore, type Order, type ReceiptConfig } from '@/store/store';

// Tauri / System Imports
import { BaseDirectory, writeFile, mkdir, exists, remove } from '@tauri-apps/plugin-fs';
import { isTauri } from '@tauri-apps/api/core';
import { documentDir } from '@tauri-apps/api/path';
import { usePrinter } from '@/hooks/use-printer';

// --- Types ---
interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completedOrder: any; // Raw order object from checkout
  onClose: () => void;
}

// --- Utility: Mapper ---
/**
 * Maps the raw checkout object to the strict 'Order' interface
 * used by the Receipt System.
 */
const formatOrderForReceipt = (order: any): Order | null => {
  if (!order) return null;


  return {
    id: order.id || 'temp-id',
    orderNumber: order.orderNumber || `#${Math.floor(Math.random() * 10000)}`,
    customerName: order.customer?.name || order.customerName || 'Guest',

    // Enterprise Metadata
    orderType: order.orderType || 'Walk-in',
    cashierName: order.cashierName || 'Staff', // Ensure your checkout passes this
    paymentMethod: order.paymentMethod || 'Cash', // Ensure your checkout passes this
    status: 'completed',

    items: (order.items || []).map((item: any) => {
        return {
            productId: item.productId || item.id,
            productName: item.productName || item.name || 'Unknown Product',
            variantName: item.variantName || item.variant || '',
            sku: item.sku || '',
            quantity: item.quantity || 1,
            selectedUnit: {
                unitName: item.unitName || item.unit || item.selectedUnit?.unitName || 'Unit',
                price: parseFloat(item.price || item.selectedUnit?.price || '0'),
            },
            note: item.note || item.notes || '',
        };
    }),

    subTotal: parseFloat(order.subtotal || order.subTotal || '0'),
    discount: parseFloat(order.discount || '0'),
    taxes: parseFloat(order.tax || order.taxes || '0'),
    total: parseFloat(order.total || '0'),
    createdAt: order.datetime ? new Date(order.datetime) : new Date(),
  };
};

// --- Sub-component: Action Panel ---
interface ActionPanelProps {
  completedOrder: any;
  orderNumber: string;
  onPrint: () => void;
  onDownload: () => void;
  onClose: () => void;
  isPrinting: boolean;
  isDownloading: boolean;
  currency: string;
}

const ActionPanel = ({
  completedOrder,
  orderNumber,
  onPrint,
  onDownload,
  onClose,
  isPrinting,
  isDownloading,
  currency,
}: ActionPanelProps) => (
  <div className="flex flex-col h-full justify-between p-1 pt-4 md:pt-1">
    <div className="text-center space-y-6">
      {/* Success Header */}
      <div className="space-y-2">
        <div className="h-16 w-16 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto animate-in zoom-in duration-300">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-foreground">Payment Successful</DialogTitle>
          <p className="text-muted-foreground">Transaction #{orderNumber} completed.</p>
        </DialogHeader>
      </div>

      {/* Change Due Display */}
      <div className="bg-card border border-border p-6 rounded-xl shadow-sm">
        <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Change Due</p>
        <p className="text-4xl font-extrabold text-foreground mt-2">
          <span className="text-lg font-medium text-muted-foreground mr-1">{currency}</span>
          {completedOrder.change?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ||
            '0.00'}
        </p>
      </div>
    </div>

    {/* Actions */}
    <div className="space-y-3 pt-8 md:pt-0">
      <Button onClick={onPrint} disabled={isPrinting} className="w-full h-12 text-base shadow-sm" size="lg">
        {isPrinting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Printer className="mr-2 h-5 w-5" />}
        {isPrinting ? 'Printing...' : 'Print Receipt'}
      </Button>

      <Button
        variant="outline"
        onClick={onDownload}
        disabled={isDownloading}
        className="w-full h-12 border-input bg-background hover:bg-accent hover:text-accent-foreground"
      >
        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
        {isDownloading ? 'Generating PDF...' : 'Download PDF'}
      </Button>

      <Separator className="my-4 bg-border" />

      <Button
        variant="ghost"
        onClick={onClose}
        size="sm"
        className="w-full text-muted-foreground hover:text-foreground group"
      >
        Start New Order <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Button>
    </div>
  </div>
);

// --- Main Component ---
export function ReceiptDialog({ open, onOpenChange, completedOrder, onClose }: ReceiptDialogProps) {
  const settings = usePosStore(state => state.settings);
  const receiptConfig = settings.receiptConfig as ReceiptConfig;

  const { printDocument } = usePrinter();

  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [qrCodePdfUrl, setQrCodePdfUrl] = useState<string>('');

  // 1. Map Data
  const formattedOrder = useMemo(() => formatOrderForReceipt(completedOrder), [completedOrder]);

  // 2. Generate QR for PDF (Base64)
  // We do this here because the PDF renderer needs a string, it can't render a Canvas ref like the Preview does.
  useEffect(() => {
    if (formattedOrder && receiptConfig?.showQrCode) {
      const qrData =
        receiptConfig.qrCodeTarget === 'website' && receiptConfig.qrCodeCustomUrl
          ? receiptConfig.qrCodeCustomUrl
          : JSON.stringify({ id: formattedOrder.orderNumber, tot: formattedOrder.total });

      QRCode.toDataURL(qrData, { width: 150, margin: 1 })
        .then(url => setQrCodePdfUrl(url))
        .catch(err => console.error('QR Generation failed', err));
    }
  }, [formattedOrder, receiptConfig]);

  // 3. Document Instance (Memoized)
  const DocumentInstance = useMemo(() => {
    if (!formattedOrder) return null;
    return <ReceiptPdfDocument order={formattedOrder} settings={settings} qrCodeUrl={qrCodePdfUrl} />;
  }, [formattedOrder, settings, qrCodePdfUrl]);

  // --- 🖨️ Print Handler ---
  const handlePrint = async () => {
    if (!formattedOrder || !DocumentInstance) return;

    // Web Fallback
    if (!isTauri()) {
      toast.info('Sending to browser print...');
      window.print();
      // Note: Ideally, you'd render the component to a hidden iframe for web printing,
      // but standard window.print() works if the ReceiptPreview is styled with @media print.
      return;
    }

    if (isPrinting) return;
    setIsPrinting(true);
    toast.info('Generating print job...');

    let filePath = '';

    try {
      // Generate Blob
      const blob = await pdf(DocumentInstance).toBlob();
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Sanitize Filename
      const safeOrderNum = formattedOrder.orderNumber.replace(/[^a-z0-9]/gi, '_');
      const fileName = `Receipt_${safeOrderNum}.pdf`;

      // Directory Handling
      const documentDirPath = await documentDir();
      const dealioFolderPath = `${documentDirPath}/Dealio`;

      if (!(await exists('Dealio', { baseDir: BaseDirectory.Document }))) {
        await mkdir('Dealio', { baseDir: BaseDirectory.Document, recursive: true });
      }

      // Write & Print
      filePath = `${dealioFolderPath}/${fileName}`;
      await writeFile(filePath, uint8Array, { baseDir: BaseDirectory.Document });

      printDocument('receipt', filePath, true);

      toast.success('Sent to printer!');
    } catch (error) {
      console.error('Silent print error:', error);
      toast.error(`Print failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Cleanup
      try {
        if (filePath && (await exists(filePath, { baseDir: BaseDirectory.Document }))) {
          await remove(filePath, { baseDir: BaseDirectory.Document });
        }
      } catch (e) {
        console.error('Failed to remove file:', e);
        /* ignore cleanup errors */
      }
      setIsPrinting(false);
    }
  };

  // --- 📥 Download Handler ---
  const handleDownload = async () => {
    if (!formattedOrder || !DocumentInstance) return;
    if (isDownloading) return;

    setIsDownloading(true);

    try {
      const blob = await pdf(DocumentInstance).toBlob();
      const safeOrderNum = formattedOrder.orderNumber.replace(/[^a-z0-9]/gi, '_');
      const fileName = `Receipt_${safeOrderNum}.pdf`;

      if (isTauri()) {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const documentDirPath = await documentDir();
        const dealioFolderPath = `${documentDirPath}/Dealio`;

        if (!(await exists('Dealio', { baseDir: BaseDirectory.Download }))) {
          await mkdir('Dealio', { baseDir: BaseDirectory.Download, recursive: true });
        }

        const filePath = `${dealioFolderPath}/${fileName}`;
        await writeFile(filePath, uint8Array, { baseDir: BaseDirectory.Download });

        toast.success('Saved to Downloads', {
          action: {
            label: 'Open',
            onClick: async () => {
              try {
                const { openPath } = await import('@tauri-apps/plugin-opener');
                await openPath(filePath);
              } catch (e) {
                console.error('Could not open file', e);
              }
            },
          },
        });
      } else {
        // Browser Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Download started');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to save receipt');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!formattedOrder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] md:max-w-[950px] p-0 overflow-hidden gap-0 border-border bg-background">
        <div className="grid grid-cols-1 md:grid-cols-2 h-full md:h-[650px] max-h-[90vh]">
          {/* Left: Actions */}
          <div className="p-6 md:p-8 flex flex-col h-full overflow-y-auto bg-background order-2 md:order-1">
            <ActionPanel
              completedOrder={completedOrder}
              orderNumber={formattedOrder.orderNumber}
              onPrint={handlePrint}
              onDownload={handleDownload}
              onClose={onClose}
              isPrinting={isPrinting}
              isDownloading={isDownloading}
              currency={settings.currency}
            />
          </div>

          {/* Right: Live Preview */}
          <div className="bg-neutral-100/80 p-6 md:p-8 border-b md:border-b-0 md:border-l border-border flex flex-col items-center justify-start h-full overflow-hidden order-1 md:order-2 relative">
            <div className="absolute top-4 left-4 flex items-center gap-1.5 text-xs font-bold text-muted-foreground/60 uppercase tracking-wider z-10">
              <Receipt className="h-3.5 w-3.5" />
              <span>Preview</span>
            </div>

            <ScrollArea className="h-full w-full pt-6">
              <div className="pb-8 flex justify-center min-h-full">
                {/* We use the same ReceiptPreview component from the Settings page.
                   We pass the specific order and the global settings.
                 */}
                <div
                  className="bg-white shadow-xl transition-all duration-200 ease-out origin-top"
                  style={{
                    width:
                      receiptConfig?.paperSize === '80mm'
                        ? '370px'
                        : receiptConfig?.paperSize === '58mm'
                        ? '280px'
                        : '480px',
                    transform: 'scale(0.9)', // Slight scale down to fit dialog nicely
                  }}
                >
                  <ReceiptPreview
                    order={formattedOrder}
                    settings={settings} // Pass full settings so it reads receiptConfig
                  />
                </div>
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
