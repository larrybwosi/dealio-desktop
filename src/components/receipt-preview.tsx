'use client';

import { usePosStore, type Order, type ReceiptConfig } from '@/store/store';
import { format } from 'date-fns';
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';

interface ReceiptPreviewProps {
  order: Order;
  className?: string;
  settings?: any;
}

export function ReceiptPreview({ order, className = '', settings: propSettings }: ReceiptPreviewProps) {
  const storeSettings = usePosStore(state => state.settings);
  const activeSettings = propSettings || storeSettings;
  const config = activeSettings.receiptConfig as ReceiptConfig;
  const qrCodeRef = useRef<HTMLCanvasElement>(null);

  const getFormattedDate = (date: Date | string) => {
    try {
      return format(new Date(date), config?.dateFormat || 'yyyy-MM-dd HH:mm');
    } catch (e) {
      return format(new Date(), 'yyyy-MM-dd HH:mm');
    }
  };

  // Generate QR Code with Enterprise Context
  useEffect(() => {
    if (config?.showQrCode && qrCodeRef.current) {
      let qrPayload = '';

      // Decide QR payload based on enterprise setting
      if (config.qrCodeTarget === 'website' && config.qrCodeCustomUrl) {
        qrPayload = config.qrCodeCustomUrl;
      } else if (config.qrCodeTarget === 'review-link' && config.qrCodeCustomUrl) {
        qrPayload = config.qrCodeCustomUrl;
      } else {
        // Default: Order tracking
        qrPayload = JSON.stringify({
          id: order.orderNumber,
          t: order.total,
          d: getFormattedDate(order.createdAt),
        });
      }

      QRCode.toCanvas(qrCodeRef.current, qrPayload, {
        width: 100,
        margin: 0,
        color: { dark: '#000000', light: '#FFFFFF' },
      }).catch(err => console.error('QR error:', err));
    }
  }, [config?.showQrCode, config?.qrCodeTarget, config?.qrCodeCustomUrl, order]);

  if (!config) return <div>Initializing...</div>;

  // Visual Mappers
  const fontSizeClass =
    {
      small: 'text-[10px] leading-tight',
      medium: 'text-xs leading-normal',
      large: 'text-sm leading-relaxed',
    }[config.fontSize] || 'text-xs';

  const fontFamilyClass =
    {
      monospace: 'font-mono',
      sans: 'font-sans',
      serif: 'font-serif',
    }[config.fontFamily] || 'font-mono';

  // Dynamic Alignment Logic
  const alignClass = config.textAlignment === 'center' ? 'text-center' : 'text-left';
  const logoJustify =
    config.logoPosition === 'center'
      ? 'justify-center'
      : config.logoPosition === 'right'
      ? 'justify-end'
      : 'justify-start';

  return (
    <div
      className={cn(
        'bg-white text-black select-none overflow-hidden h-full',
        fontFamilyClass,
        fontSizeClass,
        className
      )}
    >
      <div className="p-4 flex flex-col h-full">
        {/* --- HEADER --- */}
        <div className={cn('border-b-2 border-dashed border-gray-300 pb-4 mb-3', alignClass)}>
          {config.showLogo && config.logoUrl && (
            <div className={cn('mb-3 flex', logoJustify)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.logoUrl}
                alt="Logo"
                style={{ width: `${config.logoWidth}%` }}
                className="object-contain grayscale"
              />
            </div>
          )}

          <div className="font-bold text-base uppercase mb-1">{activeSettings.businessName}</div>
          {config.headerText && <div className="whitespace-pre-wrap mb-3 opacity-80">{config.headerText}</div>}

          <div className="text-gray-600 space-y-0.5 text-[0.9em]">
            {config.showAddress && <div>{config.address}</div>}
            {config.showPhone && <div>Tel: {config.phone}</div>}
            {config.showEmail && <div>{config.email}</div>}
            {config.showWebsite && <div>{config.website}</div>}
            {config.showTaxNumber && <div>Tax ID: {config.taxNumber}</div>}
          </div>
        </div>

        {/* --- ENTERPRISE METADATA --- */}
        <div className="mb-4 space-y-1 text-[0.95em]">
          <div className="flex justify-between">
            <span className="text-gray-500">Order #</span>
            <span className="font-bold">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span>{getFormattedDate(order.createdAt)}</span>
          </div>

          {config.showCustomerName && order.customerName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Customer</span>
              <span className="font-medium truncate max-w-[150px] text-right">{order.customerName}</span>
            </div>
          )}
          {config.showOrderType && order.orderType && (
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="uppercase font-medium">{order.orderType}</span>
            </div>
          )}
          {config.showCashier && order.cashierName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Server</span>
              <span>{order.cashierName}</span>
            </div>
          )}
          {config.showPaymentMethod && order.paymentMethod && (
            <div className="flex justify-between">
              <span className="text-gray-500">Payment</span>
              <span>{order.paymentMethod}</span>
            </div>
          )}
        </div>

        {/* --- ITEMS --- */}
        <div className="border-t-2 border-dashed border-gray-300 pt-3 mb-4 flex-1">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="pb-2 font-bold w-[45%]">Item</th>
                <th className="pb-2 font-bold text-center w-[15%]">Qty</th>
                <th className="pb-2 font-bold text-right w-[40%]">Total</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {order.items.map((item, index) => {
                const itemTotal = (item.selectedUnit?.price || 0) * item.quantity;
                return (
                  <tr key={index} className="align-top border-b border-gray-50 last:border-0">
                    <td className="py-2 pr-1">
                      <div className="font-semibold">{item.productName}</div>
                      <div className="text-[0.85em] text-gray-500">{item.variantName}</div>
                      {config.showItemSku && item.sku && (
                        <div className="text-[0.75em] text-gray-400 font-mono mt-0.5">SKU: {item.sku}</div>
                      )}
                      {config.showItemNotes && item.note && (
                        <div className="text-[0.8em] italic text-gray-500 mt-0.5">Note: {item.note}</div>
                      )}
                    </td>
                    <td className="py-2 text-center font-medium">{item.quantity}</td>
                    <td className="py-2 text-right font-medium">{itemTotal.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* --- TOTALS --- */}
        <div className="border-t-2 border-dashed border-gray-300 pt-3 space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>
              {activeSettings.currency} {order.subTotal.toLocaleString()}
            </span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Discount</span>
              <span>
                -{activeSettings.currency} {order.discount.toLocaleString()}
              </span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>Tax ({activeSettings.taxRate}%)</span>
            <span>
              {activeSettings.currency} {order.taxes.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t-2 border-gray-800 pt-3 mt-2">
            <span>TOTAL</span>
            <span>
              {activeSettings.currency} {order.total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* --- FOOTER --- */}
        <div className={cn('border-t-2 border-dashed border-gray-300 mt-4 pt-4 space-y-4', alignClass)}>
          {/* Main Footer Message */}
          {config.footerText && <div className="whitespace-pre-wrap font-medium">{config.footerText}</div>}

          {/* Return Policy (Enterprise) */}
          {config.showReturnPolicy && config.returnPolicyText && (
            <div className="text-[0.9em] text-gray-500 p-2 border rounded border-gray-100 bg-gray-50/50">
              <span className="font-bold block text-xs mb-1 uppercase">Return Policy</span>
              {config.returnPolicyText}
            </div>
          )}

          {/* Barcode */}
          {config.showBarcode && (
            <div className={cn('flex flex-col', alignClass === 'text-center' ? 'items-center' : 'items-start')}>
              <svg viewBox="0 0 100 30" className="w-48 h-12 mb-1 opacity-80">
                <g fill="#000">
                  {[...Array(40)].map((_, i) => (
                    <rect key={i} x={i * 2.5} y="0" width={Math.random() > 0.5 ? 1.5 : 0.8} height="30" />
                  ))}
                </g>
              </svg>
              <div className="text-[10px] tracking-widest font-mono">{order.orderNumber}</div>
            </div>
          )}

          {/* QR Code & Socials */}
          <div
            className={cn('flex items-end gap-4', alignClass === 'text-center' ? 'justify-center' : 'justify-start')}
          >
            {config.showQrCode && (
              <div className="flex flex-col items-center">
                <canvas ref={qrCodeRef} className="border border-gray-100" />
                <span className="text-[9px] mt-1 text-gray-400 font-medium uppercase">
                  {config.qrCodeTarget === 'review-link' ? 'Scan to Review' : 'Scan for Receipt'}
                </span>
              </div>
            )}
          </div>

          {/* Social Media */}
          {config.showSocialMedia && config.socialMediaHandle && (
            <div className="font-bold text-sm">Follow us: {config.socialMediaHandle}</div>
          )}

          <div className="text-[9px] text-gray-400 uppercase tracking-wider text-center pt-2">
            Powered by Dealio ERP
          </div>
        </div>
      </div>
    </div>
  );
}
