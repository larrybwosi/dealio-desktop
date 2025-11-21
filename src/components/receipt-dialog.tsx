'use client';

import { JSX, useMemo } from 'react';
import { PDFDownloadLink, usePDF, Document, Page } from '@react-pdf/renderer';
import { Printer, Download, CheckCircle2, Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ReceiptPdfDocument } from './receipt-pdf';
import { usePosStore } from '@/store/store';

// Types
interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completedOrder: any;
  onClose: () => void;
}

interface FormattedOrderItem {
  productName: string;
  variantName: string;
  quantity: number;
  selectedUnit: {
    price: number;
  };
}

interface FormattedOrder {
  orderNumber: string;
  createdAt: string;
  customerName: string;
  orderType: string;
  items: FormattedOrderItem[];
  subTotal: number;
  discount: number;
  taxes: number;
  total: number;
}

// Utility Functions
const formatOrderForReceipt = (order: any): FormattedOrder | null => {
  if (!order) return null;

  return {
    orderNumber: order.orderNumber,
    createdAt: order.datetime,
    customerName: order.customer?.name || 'Guest',
    orderType: order.orderType,
    items: order.items.map((item: any) => ({
      productName: item.productName,
      variantName: item.variant || '',
      quantity: item.quantity,
      selectedUnit: {
        price: parseFloat(item.price),
      },
    })),
    subTotal: parseFloat(order.subtotal),
    discount: parseFloat(order.discount),
    taxes: parseFloat(order.tax),
    total: parseFloat(order.total),
  };
};

const generateQrCodeUrl = (orderNumber: string): string => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${orderNumber}`;
};

// Sub-components
const SuccessHeader = () => (
  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
    <CheckCircle2 className="h-8 w-8 text-green-600" />
  </div>
);

interface OrderSummaryProps {
  order: FormattedOrder;
  paymentMethod: string;
  currency: string;
}

const OrderSummary = ({ order, paymentMethod, currency }: OrderSummaryProps) => (
  <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
    <div className="flex justify-between">
      <span className="text-muted-foreground">Order No:</span>
      <span className="font-medium">{order.orderNumber}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-muted-foreground">Total Paid:</span>
      <span className="font-bold text-lg">
        {currency} {order.total.toLocaleString()}
      </span>
    </div>
    <div className="flex justify-between">
      <span className="text-muted-foreground">Payment Method:</span>
      <span>{paymentMethod}</span>
    </div>
  </div>
);

interface ActionButtonsProps {
  pdfDocument: JSX.Element;
  orderNumber: string;
  onPrint: () => void;
  onClose: () => void;
  isLoading: boolean;
}

const ActionButtons = ({ pdfDocument, orderNumber, onPrint, onClose, isLoading }: ActionButtonsProps) => (
  <>
    <div className="grid grid-cols-2 gap-2 w-full">
      <PDFDownloadLink document={pdfDocument} fileName={`receipt-${orderNumber}.pdf`} className="w-full">
        {({ loading }) => (
          <Button variant="outline" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download
          </Button>
        )}
      </PDFDownloadLink>

      <Button onClick={onPrint} disabled={isLoading} className="w-full">
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
        Print Receipt
      </Button>
    </div>

    <Button variant="ghost" onClick={onClose} className="w-full sm:mt-0 mt-2">
      Start New Order
    </Button>
  </>
);

// Main Component
export function ReceiptDialog({ open, onOpenChange, completedOrder, onClose }: ReceiptDialogProps) {
  const settings = usePosStore(state => state.settings);

  // Format order data
  const formattedOrder = useMemo(() => formatOrderForReceipt(completedOrder), [completedOrder]);

  // Generate QR code URL
  const qrCodeUrl = useMemo(
    () => (completedOrder ? generateQrCodeUrl(completedOrder.orderNumber) : ''),
    [completedOrder]
  );

  // Create PDF document
  const pdfDocument = useMemo(() => {
    if (!formattedOrder) {
      return (
        <Document>
          <Page />
        </Document>
      );
    }
    return <ReceiptPdfDocument order={formattedOrder} settings={settings} qrCodeUrl={qrCodeUrl} />;
  }, [formattedOrder, settings, qrCodeUrl]);

  // Generate PDF instance
  const [instance] = usePDF({ document: pdfDocument });

  // Handlers
  const handlePrint = () => {
    if (!instance.url) return;

    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = instance.url;
    document.body.appendChild(iframe);

    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 2000);
  };

  if (!formattedOrder) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center space-y-4 pb-4 border-b">
          <SuccessHeader />
          <div className="text-center">
            <DialogTitle className="text-xl">Payment Successful!</DialogTitle>
            <DialogDescription className="pt-2">
              Change Due:{' '}
              <span className="font-bold text-foreground">
                {settings.currency} {completedOrder.change}
              </span>
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <OrderSummary
            order={formattedOrder}
            paymentMethod={completedOrder.paymentMethod}
            currency={settings.currency}
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <ActionButtons
            pdfDocument={pdfDocument}
            orderNumber={formattedOrder.orderNumber}
            onPrint={handlePrint}
            onClose={onClose}
            isLoading={instance.loading}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
