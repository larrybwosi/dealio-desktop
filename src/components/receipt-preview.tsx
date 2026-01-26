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
      console.log('Date error', e instanceof Error ? e.message : 'Unknown error');
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

  if (!config) return <div className="p-4 text-center text-muted-foreground animate-pulse">Initializing Preview...</div>;

  // Visual Mappers
  const fontSizeClass =
    {
      small: 'text-[10px] leading-tight',
      medium: 'text-xs leading-normal',
      large: 'text-sm leading-relaxed',
    }[config.fontSize] || 'text-xs';

  const fontFamilyClass =
    {
      monospace: 'font-mono tracking-tight',
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
    <div className={cn('relative group perspective-1000', className)}>
      {/* Shadow Effect - separate for better layering */}
      <div 
        className="absolute inset-0 bg-black/20 blur-md transform translate-y-1 scale-[0.98] rounded-sm z-0" 
        aria-hidden="true" 
      />
      
      {/* Thermal Paper Container */}
      <div
        className={cn(
          'relative z-10 overflow-hidden transition-all duration-300 transform',
          'bg-white text-slate-800',
          fontFamilyClass,
          fontSizeClass,
          config.showBorder && 'border border-slate-200'
        )}
        style={{
          minHeight: '400px',
          // Realistic thermal paper color
          backgroundColor: '#fffdfa',
          // Subtle paper texture noise
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.03'/%3E%3C/svg%3E")`,
          boxShadow: '0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05)'
        }}
      >
        <div className={cn(
          'p-6 pb-12 flex flex-col h-full', 
          isModern ? 'bg-gradient-to-b from-slate-50/80 to-transparent' : ''
        )}>
          {/* --- HEADER --- */}
          <div className={cn('mb-6 space-y-3', alignClass)}>
            {config.showLogo && config.logoUrl && (
              <div className={cn('mb-4 flex', logoJustify)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={config.logoUrl}
                  alt="Logo"
                  style={{ width: `${config.logoWidth}%` }}
                  className="object-contain mix-blend-multiply grayscale contrast-125" 
                />
              </div>
            )}

            <div className={cn('font-bold uppercase tracking-wider text-black', isModern ? 'text-xl' : 'text-lg')}>
              {activeSettings.businessName}
            </div>

            {config.showTagline && config.tagline && (
              <div className="text-gray-500 text-[0.85em] italic">{config.tagline}</div>
            )}

            {config.headerText && (
              <div className="whitespace-pre-wrap text-gray-700 font-medium opacity-90 leading-snug">{config.headerText}</div>
            )}

            <div className="text-gray-600 text-[0.9em] space-y-0.5 mt-3 leading-snug">
              {config.showAddress && <div>{config.address}</div>}
              {config.showPhone && <div>{config.phone}</div>}
              {config.showEmail && <div>{config.email}</div>}
              {config.showWebsite && <div>{config.website}</div>}
              
              {(config.showTaxNumber || config.showVatNumber || config.showCompanyRegNumber) && (
                 <div className="pt-1 mt-1 border-t border-dashed border-gray-300 inline-block w-full">
                    {config.showTaxNumber && <div>Tax ID: {config.taxNumber}</div>}
                    {config.showVatNumber && config.vatNumber && <div>VAT: {config.vatNumber}</div>}
                    {config.showCompanyRegNumber && config.companyRegNumber && <div>Reg: {config.companyRegNumber}</div>}
                 </div>
              )}
            </div>
          </div>

          {!isMinimal && <div className="my-3 border-b-2 border-dashed border-gray-300/80 w-full" />}

          {/* --- METADATA --- */}
          <div className="mb-6 space-y-1.5 text-[0.92em]">
            {config.showOrderNumber !== false && (
              <div className="flex justify-between items-baseline">
                <span className="text-gray-500 font-medium">Order #</span>
                <span className="font-bold text-lg text-black">{order.orderNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-800">{getFormattedDate(order.createdAt)}</span>
            </div>
            {config.showOrderType && order.orderType && (
              <div className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-bold uppercase text-gray-800 bg-gray-100 px-1.5 rounded text-[0.85em]">{order.orderType}</span>
              </div>
            )}
            {config.showCustomerName && order.customerName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Guest</span>
                <span className="font-medium text-gray-800">{order.customerName}</span>
              </div>
            )}
            {config.showCashier && order.cashierName && (
              <div className="flex justify-between">
                <span className="text-gray-500">Server</span>
                <span className="text-gray-800">{order.cashierName}</span>
              </div>
            )}
          </div>

          {/* --- ITEMS --- */}
          <div className="flex-1 mb-6">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-800 text-left text-[0.9em]">
                  <th className="pb-2 font-bold w-[45%] uppercase tracking-tight">Item</th>
                  <th className="pb-2 font-bold text-center w-[20%] uppercase tracking-tight">Qty</th>
                  <th className="pb-2 font-bold text-right w-[35%] uppercase tracking-tight">Amount</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {order.items.map((item, index) => (
                  <tr key={index} className="align-top group/row">
                    <td className="py-2 pr-1 border-b border-dashed border-gray-200 group-last/row:border-0">
                      <div className="font-medium leading-tight">{item.productName}</div>
                      {item.variantName && item.variantName !== 'Default Variant' && (
                         <div className="text-[0.85em] text-gray-500 mt-0.5">↳ {item.variantName}</div>
                      )}
                      {config.showItemSku && item.sku && (
                        <div className="text-[0.7em] text-gray-400 font-mono mt-0.5">{item.sku}</div>
                      )}
                    </td>
                    <td className="py-2 text-center align-top border-b border-dashed border-gray-200 group-last/row:border-0 pt-2.5 font-medium text-gray-600">{item.quantity}</td>
                    <td className="py-2 text-right align-top border-b border-dashed border-gray-200 group-last/row:border-0 pt-2.5 font-medium">
                      {(item.selectedUnit?.price || 1 * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* --- TOTALS --- */}
          <div className={cn('space-y-1.5 pt-3', !isModern && 'border-t-2 border-black')}>
            {config.showSubtotal !== false && (
              <div className="flex justify-between text-[0.95em]">
                <span className="text-gray-600 font-medium">Subtotal</span>
                <span className="font-medium">
                  {activeSettings.currency} {order.subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {config.showDiscountBreakdown !== false && order.discount > 0 && (
              <div className="flex justify-between text-gray-600 text-[0.95em]">
                <span>Discount</span>
                <span>
                  -{activeSettings.currency} {order.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {config.showTaxBreakdown !== false && (
              <div className="flex justify-between text-gray-600 text-[0.95em]">
                <span>Tax</span>
                <span>
                  {activeSettings.currency} {order.taxes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            
             <div className="my-2 border-b border-gray-300/50" />

            <div className="flex justify-between font-bold text-xl items-end">
              <span className="uppercase tracking-tight text-gray-900">Total</span>
              <span>
                {activeSettings.currency} {order.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            
            {config.showSavingsTotal && order.discount > 0 && (
              <div className="flex justify-between text-black text-[0.9em] italic mt-1 font-medium bg-gray-100 p-1 rounded px-2">
                <span>Total Savings</span>
                <span>
                  {activeSettings.currency} {order.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {config.showPaymentMethod && (
               <div className="flex justify-between text-[0.9em] text-gray-500 mt-3 pt-2 border-t border-dashed border-gray-300 uppercase font-medium tracking-wide">
                 <span>{order.paymentMethod}</span>
                 <span className="text-black">Paid</span>
               </div>
            )}
          </div>

          {/* --- FOOTER --- */}
          <div className={cn('mt-8 space-y-5', alignClass)}>
            {config.showThankYouMessage && config.thankYouMessage && (
              <div className="font-bold text-center text-[1.1em] font-serif italic text-gray-800">{config.thankYouMessage}</div>
            )}

            {config.footerText && <div className="font-medium opacity-80 text-gray-600 leading-snug">{config.footerText}</div>}

            {config.showNextVisitPromo && config.nextVisitPromoText && (
              <div className="text-[0.9em] text-center bg-gray-50 border border-black/10 p-3 rounded-sm shadow-sm">
                <div className="font-bold text-lg mb-1">🎁</div>
                <div className="font-medium">{config.nextVisitPromoText}</div>
              </div>
            )}

            {(config.showLoyaltyPoints || config.showLoyaltyBalance) && (
              <div className="text-[0.85em] bg-slate-50 border border-slate-200 p-2 rounded flex flex-col gap-1 items-center justify-center">
                {config.showLoyaltyPoints && <div>Points Earned: <span className="font-bold">+{Math.floor(order.total / 10)}</span></div>}
                {config.showLoyaltyBalance && <div>Loyalty Balance: <span className="font-bold">150 pts</span></div>}
              </div>
            )}

            {config.showReturnPolicy && config.returnPolicyText && (
              <div className="text-[0.85em] text-gray-500 p-2 text-left">
                <span className="font-bold block text-[0.8em] uppercase mb-1 text-gray-700">Return Policy</span>
                {config.returnPolicyText}
              </div>
            )}

            {config.showLegalDisclaimer && config.legalDisclaimerText && (
              <div className="text-[0.75em] text-gray-400 border-t pt-2 mt-2 leading-tight">
                {config.legalDisclaimerText}
              </div>
            )}

            {config.showBarcode && (
              <div className={cn('flex flex-col pt-2', alignClass === 'text-center' ? 'items-center' : 'items-start')}>
                <div className="h-10 w-4/5 bg-gradient-to-r from-black via-white to-black bg-[length:4px_100%] bg-repeat opacity-90" />
                <span className="text-[9px] mt-1 text-gray-500 font-mono tracking-[0.2em]">{order.orderNumber}</span>
              </div>
            )}

            {config.showQrCode && (
              <div className={cn('flex flex-col pt-2', alignClass === 'text-center' ? 'items-center' : 'items-start')}>
                <div className="bg-white p-1 rounded-sm border border-gray-200 shadow-sm inline-block">
                    <canvas ref={qrCodeRef} className="mix-blend-multiply opacity-90" />
                </div>
                <span className="text-[9px] mt-1.5 text-gray-400 uppercase tracking-widest font-medium">Scan for details</span>
              </div>
            )}

            {config.showSurveyQr && config.surveyUrl && (
              <div className="text-[0.85em] text-center text-gray-600 bg-gray-50 p-2 rounded border border-dashed border-gray-300">
                <div className="font-medium">How did we do?</div>
                <div className="text-[0.9em] text-blue-600 underline mt-0.5 break-all">{config.surveyUrl}</div>
              </div>
            )}

            {config.showSocialMedia && config.socialMediaHandle && (
              <div className="flex items-center gap-2 justify-center text-sm font-medium text-gray-600">
                 {/* Simple Icon Placeholders using CSS/UNICODE for portability/visual style */}
                 <span className="text-lg">📱</span>
                 <span>{config.socialMediaHandle}</span>
              </div>
            )}
            
            <div className="text-[9px] text-gray-300 text-center pt-4 font-mono uppercase tracking-widest">
                Powered by Dealio
            </div>
          </div>
        </div>

        {/* --- THERMAL PAPER JAGGED EDGE EFFECT (CSS) --- */}
        <div
          className="absolute bottom-0 left-0 w-full h-3 z-20"
          style={{
             backgroundImage: `radial-gradient(circle, transparent 70%, #f1f5f9 70%), radial-gradient(circle, transparent 70%, #f1f5f9 70%)`,
             backgroundPosition: '0 0, 8px 0',
             backgroundSize: '16px 16px',
             backgroundRepeat: 'repeat-x',
             height: '8px',
             bottom: '-7px',
             opacity: 0.8
          }}
        />
        {/* Shadow for the jagged edge to give depth */}
        <div
            className="absolute bottom-0 left-0 w-full h-2 z-10 blur-[1px]"
            style={{
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.1), transparent)',
                bottom: '-2px'
            }}
        />
      </div>
    </div>
  );
}