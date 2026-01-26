import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';
import { Order, BusinessSettings } from '@/store/store';
import { ReceiptPdfDocument } from '@/components/receipt-pdf';
import QRCode from 'qrcode';

/**
 * Generate a PDF receipt blob from an order
 */
export async function generateReceiptPDF(
  order: Order,
  settings: BusinessSettings
): Promise<Blob> {
  try {
    // Generate QR code if enabled
    let qrCodeUrl: string | undefined;
    if (settings.receiptConfig.showQrCode) {
      const qrData = settings.receiptConfig.qrCodeTarget === 'order-link'
        ? `${window.location.origin}/order/${order.id}`
        : settings.receiptConfig.qrCodeCustomUrl || window.location.origin;
      
      qrCodeUrl = await QRCode.toDataURL(qrData, { width: 100, margin: 1 });
    }

    // Generate PDF document using react-pdf
    const doc = createElement(ReceiptPdfDocument, { order, settings, qrCodeUrl });
    console.log("Document:", doc);
    //@ts-expect-error
    const blob = await pdf(doc).toBlob();
    console.log("Blob:", blob);
    return blob;
  } catch (error) {
    console.error('Error generating PDF receipt:', error);
    throw new Error(`Failed to generate PDF receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Save PDF blob to a temporary file and return the path
 * This is needed for the printer plugin which requires a file path
 */
export async function savePdfToTempFile(blob: Blob, orderId: string): Promise<string> {
  try {
    const { BaseDirectory, writeFile, mkdir } = await import('@tauri-apps/plugin-fs');
    // Switched 'documentDir' to 'tempDir'
    const { join, tempDir } = await import('@tauri-apps/api/path');

    // Convert blob to array buffer
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 1. Define a folder structure inside Temp to keep things organized
    const folderName = 'Dealio_Temp';

    // 2. Ensure the directory exists in the Temp folder
    await mkdir(folderName, {
      baseDir: BaseDirectory.Temp, // Changed to Temp
      recursive: true
    });

    // 3. Construct the relative file path
    const fileName = `receipt_${orderId}_${Date.now()}.pdf`;
    const filePath = await join(folderName, fileName);

    // 4. Write file to Temp directory
    await writeFile(filePath, uint8Array, { baseDir: BaseDirectory.Temp }); // Changed to Temp

    // 5. Resolve absolute path for the return value
    const tempRoot = await tempDir();
    const absolutePath = await join(tempRoot, folderName, fileName);

    return absolutePath;
  } catch (error) {
    console.error('Error saving PDF to Temp:', error);
    throw new Error(`Failed to save PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
/**
 * Format order data for receipt templates
 */
export function formatOrderData(order: Order) {
  return {
    ...order,
    formattedDate: new Date(order.createdAt).toLocaleDateString(),
    formattedTime: new Date(order.createdAt).toLocaleTimeString(),
    formattedTotal: order.total.toFixed(2),
    formattedSubtotal: order.subTotal.toFixed(2),
    formattedTax: order.taxes.toFixed(2),
    formattedDiscount: order.discount.toFixed(2),
  };
}

/**
 * Generate kitchen receipt data (simplified version for kitchen staff)
 */
export function generateKitchenReceiptData(order: Order) {
  return {
    orderNumber: order.orderNumber,
    orderType: order.orderType,
    tableNumber: order.tableNumber,
    items: order.items.map(item => ({
      productName: item.productName,
      variantName: item.variantName,
      quantity: item.quantity,
      note: item.notes,
    })),
    instructions: order.instructions,
    timestamp: new Date(order.createdAt),
  };
}
