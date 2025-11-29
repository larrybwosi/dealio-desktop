import { usePosStore, type Order, type ReceiptConfig } from '@/store/store';
import { format } from 'date-fns';
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

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

  useEffect(() => {
    if (config?.showQrCode && qrCodeRef.current) {
      const qrPayload =
        config.qrCodeTarget === 'website' && config.qrCodeCustomUrl
          ? config.qrCodeCustomUrl
          : JSON.stringify({ id: order.orderNumber, t: order.total });

      QRCode.toCanvas(qrCodeRef.current, qrPayload, {
        width: 100,
        margin: 0,
        color: { dark: '#000000', light: '#FFFFFF' },
      }).catch(err => console.error('QR error:', err));
    }
  }, [config, order]);

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

  const alignClass = config.textAlignment === 'center' ? 'text-center' : 'text-left';
  const logoJustify =
    config.logoPosition === 'center'
      ? 'justify-center'
      : config.logoPosition === 'right'
      ? 'justify-end'
      : 'justify-start';

  const isModern = config.template === 'modern';
  const isMinimal = config.template === 'minimal';

  return (
    <div className={cn('relative group', className)}>
      {/* Thermal Paper Container */}
      <div
        className={cn(
          'bg-white text-black select-none overflow-hidden relative shadow-sm transition-all duration-300',
          fontFamilyClass,
          fontSizeClass,
          config.showBorder && 'border border-gray-800'
        )}
        style={{
          minHeight: '400px',
          // Add a subtle paper texture feel
          backgroundColor: '#fffdfa',
        }}
      >
        <div className={cn('p-5 pb-8 flex flex-col h-full', isModern && 'bg-slate-50/50')}>
          {/* --- HEADER --- */}
          <div className={cn('mb-4 space-y-2', alignClass)}>
            {config.showLogo && config.logoUrl && (
              <div className={cn('mb-3 flex', logoJustify)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.logoUrl}
                  alt="Logo"
                  style={{ width: `${config.logoWidth}%` }}
                  className="object-contain mix-blend-multiply"
                />
              </div>
            )}

            <div className={cn('font-bold uppercase tracking-wider', isModern ? 'text-lg' : 'text-base')}>
              {activeSettings.businessName}
            </div>

            {config.headerText && (
              <div className="whitespace-pre-wrap text-gray-600 font-medium opacity-90">{config.headerText}</div>
            )}

            <div className="text-gray-500 text-[0.9em] space-y-0.5 mt-2">
              {config.showAddress && <div>{config.address}</div>}
              {config.showPhone && <div>{config.phone}</div>}
              {config.showEmail && <div>{config.email}</div>}
              {config.showWebsite && <div>{config.website}</div>}
              {config.showTaxNumber && <div>Tax ID: {config.taxNumber}</div>}
            </div>
          </div>

          {!isMinimal && <Separator className="my-2 bg-black/10 dashed" />}

          {/* --- METADATA --- */}
          <div className="mb-4 space-y-1 text-[0.9em]">
            <div className="flex justify-between">
              <span className="text-gray-500">Order</span>
              <span className="font-bold">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span>{getFormattedDate(order.createdAt)}</span>
            </div>
            {config.showCustomerName && order.customerName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Client</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
            )}
            {config.showCashier && order.cashierName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Served by</span>
                <span>{order.cashierName}</span>
              </div>
            )}
          </div>

          {/* --- ITEMS --- */}
          <div className="flex-1 mb-4">
            <table className="w-full">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="pb-1 font-bold w-[50%]">Item</th>
                  <th className="pb-1 font-bold text-center w-[15%]">Qty</th>
                  <th className="pb-1 font-bold text-right w-[35%]">Amt</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {order.items.map((item, index) => (
                  <tr key={index} className="align-top">
                    <td className="py-1 pr-1">
                      <div className="font-medium">{item.productName}</div>
                      {item.variantName && <div className="text-[0.85em] text-gray-500">{item.variantName}</div>}
                      {config.showItemSku && item.sku && (
                        <div className="text-[0.7em] text-gray-400 font-mono">{item.sku}</div>
                      )}
                    </td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">{(item.selectedUnit?.price || 0 * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* --- TOTALS --- */}
          <div className={cn('space-y-1 pt-2', !isModern && 'border-t border-dashed border-gray-400')}>
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
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
              <span>Tax</span>
              <span>
                {activeSettings.currency} {order.taxes.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between font-bold text-lg pt-2 mt-1 border-t border-black">
              <span>TOTAL</span>
              <span>
                {activeSettings.currency} {order.total.toLocaleString()}
              </span>
            </div>
            {config.showPaymentMethod && (
               <div className="flex justify-between text-[0.85em] text-gray-500 mt-1 uppercase">
                 <span>{order.paymentMethod}</span>
                 <span>PAID</span>
               </div>
            )}
          </div>

          {/* --- FOOTER --- */}
          <div className={cn('mt-6 space-y-4', alignClass)}>
            {config.footerText && <div className="font-medium opacity-80">{config.footerText}</div>}

            {config.showReturnPolicy && config.returnPolicyText && (
              <div className="text-[0.85em] text-gray-500 border p-2 rounded bg-gray-50">
                <span className="font-bold block text-[0.8em] uppercase mb-0.5">Policy</span>
                {config.returnPolicyText}
              </div>
            )}

            {config.showQrCode && (
              <div className={cn('flex flex-col', alignClass === 'center' ? 'items-center' : 'items-start')}>
                <canvas ref={qrCodeRef} />
                <span className="text-[9px] mt-1 text-gray-400 uppercase tracking-widest">Scan Me</span>
              </div>
            )}

             {config.showSocialMedia && config.socialMediaHandle && (
              <div className="flex items-center gap-1 justify-center text-sm font-bold">
                 <span>Connect:</span>
                 <span>{config.socialMediaHandle}</span>
              </div>
            )}
            
            <div className="text-[9px] text-gray-300 text-center pt-2">Powered by Dealio</div>
          </div>
        </div>

        {/* --- THERMAL PAPER JAGGED EDGE EFFECT (CSS) --- */}
        <div
          className="absolute bottom-0 left-0 w-full h-2"
          style={{
            background: 'linear-gradient(-45deg, transparent 8px, transparent 0), linear-gradient(45deg, transparent 8px, transparent 0)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 100%',
            backgroundRepeat: 'repeat-x',
            filter: 'drop-shadow(0px 2px 0px rgba(0,0,0,0.1))',
            // This SVG data URI creates a cleaner saw-tooth pattern than pure gradients
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10' width='12' height='10'%3E%3Cpath d='M0,0 L6,8 L12,0' fill='%23fff' stroke='none' /%3E%3C/svg%3E")`,
            height: '10px',
            bottom: '-9px',
            zIndex: 10
          }}
        />
      </div>
    </div>
  );
}