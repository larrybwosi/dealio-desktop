'use client';

import { usePosStore, type Order } from '@/store/store';
import { format } from 'date-fns';
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils'; // Assuming you have cn utility, if not just use template literal

interface ReceiptPreviewProps {
  order: Order;
  className?: string;
}

export function ReceiptPreview({ order, className = '' }: ReceiptPreviewProps) {
  const settings = usePosStore(state => state.settings);
  // Use the config from store, or fallback if this component is used in isolation
  const receiptConfig = settings.receiptConfig;
  const qrCodeRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (receiptConfig?.showQrCode && qrCodeRef.current) {
      const qrData = JSON.stringify({
        orderNumber: order.orderNumber,
        total: order.total,
        date: format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm'),
      });

      QRCode.toCanvas(qrCodeRef.current, qrData, {
        width: 80,
        margin: 0,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      }).catch(err => console.error('QR Code generation error:', err));
    }
  }, [receiptConfig?.showQrCode, order.orderNumber, order.total, order.createdAt]);

  if (!receiptConfig) return <div className="p-4 text-center text-sm text-gray-500">Loading configuration...</div>;

  const fontSizeClass = {
    small: 'text-[10px] leading-tight',
    medium: 'text-xs leading-normal',
    large: 'text-sm leading-relaxed',
  }[receiptConfig.fontSize];

  // Exact CSS width for preview to match PDF visual weight
  const paperWidth = receiptConfig.paperSize === '80mm' ? '300px' : '210px';

  return (
    <div
      className={cn(`font-mono ${fontSizeClass} text-black bg-white select-none`, className)}
      style={{ width: paperWidth }}
    >
      <div className="p-4">
        {' '}
        {/* Inner padding simulation */}
        {/* Header */}
        <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
          {receiptConfig.showLogo && receiptConfig.logoUrl && (
            <div className="mb-3 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptConfig.logoUrl} alt="Logo" className="h-12 object-contain grayscale" />
            </div>
          )}
          <div className="font-bold text-base mb-1">{settings.businessName}</div>
          {receiptConfig.headerText && <div className="whitespace-pre-wrap mb-1">{receiptConfig.headerText}</div>}

          <div className="text-gray-600 mt-2 space-y-0.5">
            {receiptConfig.showAddress && <div>{receiptConfig.address}</div>}
            {receiptConfig.showPhone && <div>Tel: {receiptConfig.phone}</div>}
            {receiptConfig.showEmail && <div>{receiptConfig.email}</div>}
            {receiptConfig.showWebsite && <div>{receiptConfig.website}</div>}
            {receiptConfig.showTaxNumber && <div>Tax ID: {receiptConfig.taxNumber}</div>}
          </div>
        </div>
        {/* Order Info */}
        <div className="mb-4 space-y-1">
          <div className="flex justify-between">
            <span>Order:</span>
            <span className="font-bold">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{format(new Date(order.createdAt), 'dd/MM/yyyy HH:mm')}</span>
          </div>
          {order.customerName && (
            <div className="flex justify-between">
              <span>Customer:</span>
              <span>{order.customerName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Type:</span>
            <span className="uppercase">{order.orderType}</span>
          </div>
        </div>
        {/* Items */}
        <div className="border-t-2 border-dashed border-gray-300 pt-3 mb-4">
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="pb-2 font-bold w-[45%]">Item</th>
                <th className="pb-2 font-bold text-center w-[15%]">Qty</th>
                <th className="pb-2 font-bold text-right w-[20%]">Price</th>
                <th className="pb-2 font-bold text-right w-[20%]">Total</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {order.items.map((item, index) => {
                const itemTotal = (item.selectedUnit?.price || 0) * item.quantity;
                return (
                  <tr key={index} className="align-top">
                    <td className="py-1 pr-1">
                      <div className="font-semibold">{item.productName}</div>
                      <div className="text-[0.9em] text-gray-500">{item.variantName}</div>
                    </td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">{(item.selectedUnit?.price || 0).toLocaleString()}</td>
                    <td className="py-1 text-right font-medium">{itemTotal.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Totals */}
        <div className="border-t-2 border-dashed border-gray-300 pt-3 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>
              {settings.currency} {order.subTotal.toLocaleString()}
            </span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Discount:</span>
              <span>
                -{settings.currency} {order.discount.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Tax ({settings.taxRate}%):</span>
            <span>
              {settings.currency} {order.taxes.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t-2 border-gray-800 pt-3 mt-2">
            <span>TOTAL:</span>
            <span>
              {settings.currency} {order.total.toLocaleString()}
            </span>
          </div>
        </div>
        {/* Footer */}
        <div className="text-center border-t-2 border-dashed border-gray-300 mt-4 pt-4">
          {receiptConfig.footerText && (
            <div className="mb-4 whitespace-pre-wrap font-medium">{receiptConfig.footerText}</div>
          )}

          {receiptConfig.showBarcode && (
            <div className="my-3 flex flex-col items-center">
              {/* Simple SVG Barcode simulation */}
              <svg viewBox="0 0 100 30" className="w-48 h-12 mb-1">
                <g fill="#000">
                  {[...Array(40)].map((_, i) => (
                    <rect key={i} x={i * 2.5} y="0" width={Math.random() > 0.5 ? 1.5 : 0.8} height="30" />
                  ))}
                </g>
              </svg>
              <div className="text-[10px] tracking-widest">{order.orderNumber}</div>
            </div>
          )}

          {receiptConfig.showQrCode && (
            <div className="my-3 flex justify-center">
              <canvas ref={qrCodeRef} />
            </div>
          )}

          <div className="text-[9px] mt-4 text-gray-400 uppercase tracking-wider">Powered by Dealio ERP</div>
        </div>
      </div>
    </div>
  );
}
