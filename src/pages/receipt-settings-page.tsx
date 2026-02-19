'use client';

import { useState, useEffect } from 'react';
import {
  usePosStore,
  type ReceiptConfig,
  type KitchenTicketConfig,
  getDefaultKitchenTicketConfig,
  getDefaultReceiptConfig,
} from '@/store/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ReceiptPdfDocument } from '@/components/receipt-pdf';
import { PDFKitchenTicket } from '@/components/receipts/pdf-kitchen-ticket';
import { usePdfActions } from '@/hooks/use-pdf-actions';
import { ReceiptPreviewWrapper } from '@/components/pos/receipt-preview-wrapper';
import { getBusinessConfig } from '@/lib/business-configs';
import {
  Download, Printer, RotateCcw, Layout, FileText, QrCode,
  ZoomIn, ZoomOut, Palette, Store, ChefHat, AlertTriangle,
  Clock, Users, Globe, CreditCard, Tag, Building2, Scale,
  Bell, Utensils, Check, Settings2, BadgeCheck, Layers,
} from 'lucide-react';
import QRCode from 'qrcode';
import bwipjs from '@bwip-js/browser';
import { cn } from '@/lib/utils';

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-none">{title}</p>
        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

function FieldRow({
  label, description, children,
}: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 border-b border-border/40 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium leading-none">{label}</p>
        {description && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <FieldRow label={label} description={description}>
      <Switch checked={checked} onCheckedChange={onChange} />
    </FieldRow>
  );
}

function Section({ title, icon, description, children }: {
  title: string; icon: React.ElementType; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-0">
      <SectionHeader icon={icon} title={title} description={description} />
      {children}
    </div>
  );
}

// ─── Nav Pill ───────────────────────────────────────────────────────────────────

function NavPill({ tabs, active, onChange }: {
  tabs: { value: string; label: string; icon: React.ElementType }[];
  active: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border border-border/40">
      {tabs.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
            active === value
              ? 'bg-background text-foreground shadow-sm border border-border/50'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Kitchen Ticket Inline Preview ─────────────────────────────────────────────

function KitchenTicketPreview({ order, config }: { order: any; config: KitchenTicketConfig }) {
  const fontSize = config.fontSize === 'small' ? 'text-[10px]' : config.fontSize === 'large' ? 'text-lg' : 'text-sm';
  const width = config.paperSize === '58mm' ? 'max-w-[180px]' : config.paperSize === '80mm' ? 'max-w-[300px]' : 'max-w-full';

  return (
    <div className={cn('bg-white text-black p-4 font-mono shadow-lg mx-auto rounded', fontSize, width)} style={{ minHeight: 350 }}>
      <div className="text-center border-b-2 border-black pb-2 mb-3">
        <div className="font-bold text-sm uppercase">{config.headerText || 'KITCHEN ORDER'}</div>
        {config.showSequenceNumber && <div className="text-xl font-bold my-1">{order.orderNumber || 'ORD-001'}</div>}
      </div>
      <div className="space-y-1 mb-3 text-xs">
        {config.showOrderType && (
          <div className="flex justify-between font-bold border-b border-dashed pb-1">
            <span>TYPE:</span>
            <Badge variant={order.orderType === 'dine-in' ? 'default' : 'secondary'} className="uppercase text-[10px]">
              {order.orderType}
            </Badge>
          </div>
        )}
        {config.showTable && order.tableNumber && (
          <div className="flex justify-between font-bold text-base bg-black text-white px-2 py-1 -mx-2">
            <span>TABLE:</span><span>{order.tableNumber}</span>
          </div>
        )}
        {config.showCustomerName && order.customerName && (
          <div className="flex justify-between"><span>Guest:</span><span>{order.customerName}</span></div>
        )}
        {config.showTime && (
          <div className="flex justify-between">
            <span>Time:</span>
            <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>
      <div className="space-y-3 border-t border-black pt-2">
        {order.items.map((item: any, i: number) => (
          <div key={i} className={cn('pb-2', config.showItemSeparators && 'border-b border-dashed border-gray-300')}>
            <div className="flex gap-2">
              <div className={cn('font-bold bg-black text-white flex items-center justify-center rounded-sm shrink-0', config.largeQuantityDisplay ? 'w-10 h-10 text-xl' : 'w-6 h-6 text-sm')}>
                {item.quantity}
              </div>
              <div className="font-bold leading-tight text-base">{item.productName}</div>
            </div>
          </div>
        ))}
      </div>
      {config.showNotes && order.instructions && (
        <div className="mt-4 bg-yellow-100 border-l-4 border-yellow-500 p-2">
          <div className="font-bold text-xs mb-1">⚠️ NOTES:</div>
          <div className="text-xs">{order.instructions}</div>
        </div>
      )}
      <div className="mt-4 pt-2 border-t border-black text-center text-[10px] text-gray-500">
        Printed: {new Date().toLocaleString()}
        {config.footerText && <div className="mt-1">{config.footerText}</div>}
      </div>
    </div>
  );
}

// ─── Receipt Settings Panels ────────────────────────────────────────────────────

const RECEIPT_TABS = [
  { value: 'branding', label: 'Branding', icon: Palette },
  { value: 'content', label: 'Content', icon: FileText },
  { value: 'compliance', label: 'Legal', icon: BadgeCheck },
  { value: 'print', label: 'Print', icon: Printer },
  { value: 'extras', label: 'Extras', icon: Layers },
];

function ReceiptSettings({ config, updateConfig }: { config: ReceiptConfig; updateConfig: (key: keyof ReceiptConfig, value: any) => void }) {
  const [tab, setTab] = useState('branding');

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/40 px-5 py-3">
        <NavPill tabs={RECEIPT_TABS} active={tab} onChange={setTab} />
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {tab === 'branding' && (
          <>
            <Section title="Logo & Brand Identity" icon={Palette} description="Visual branding on printed receipts">
              <ToggleRow label="Show Logo" checked={config.showLogo} onChange={v => updateConfig('showLogo', v)} />
              {config.showLogo && (
                <div className="mt-3 space-y-3 pl-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Logo URL</Label>
                    <Input value={config.logoUrl} onChange={e => updateConfig('logoUrl', e.target.value)} placeholder="https://..." className="h-9 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Position</Label>
                      <Select value={config.logoPosition} onValueChange={v => updateConfig('logoPosition', v)}>
                        <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Size — {config.logoWidth}%</Label>
                      <Slider value={[config.logoWidth]} min={20} max={100} step={5} onValueChange={v => updateConfig('logoWidth', v[0])} className="mt-3" />
                    </div>
                  </div>
                </div>
              )}
              <ToggleRow label="Show Tagline" checked={config.showTagline} onChange={v => updateConfig('showTagline', v)} />
              {config.showTagline && (
                <Input value={config.tagline} onChange={e => updateConfig('tagline', e.target.value)} placeholder="Your tagline..." className="h-9 text-sm mt-2 ml-1" />
              )}
            </Section>

            <Section title="Layout & Typography" icon={Layout} description="Paper size and font preferences">
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Paper Size</Label>
                  <Select value={config.paperSize} onValueChange={v => updateConfig('paperSize', v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="80mm">80mm (Standard)</SelectItem>
                      <SelectItem value="58mm">58mm (Compact)</SelectItem>
                      <SelectItem value="Letter">Letter / A4</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Font Style</Label>
                  <Select value={config.fontFamily} onValueChange={v => updateConfig('fontFamily', v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monospace">Monospace</SelectItem>
                      <SelectItem value="sans">Sans Serif</SelectItem>
                      <SelectItem value="serif">Serif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Font Size</Label>
                  <Select value={config.fontSize} onValueChange={v => updateConfig('fontSize', v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Alignment</Label>
                  <Select value={config.textAlignment} onValueChange={v => updateConfig('textAlignment', v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Item Spacing — {config.itemSpacing || 0}px</Label>
                <Slider value={[config.itemSpacing || 0]} min={0} max={20} step={1} onValueChange={v => updateConfig('itemSpacing', v[0])} />
              </div>
            </Section>

            <Section title="Business Contact" icon={Store} description="Contact information printed on receipt">
              <ToggleRow label="Address" checked={config.showAddress} onChange={v => updateConfig('showAddress', v)} />
              {config.showAddress && <Input value={config.address} onChange={e => updateConfig('address', e.target.value)} className="h-9 text-sm mt-2 ml-1" />}
              <ToggleRow label="Phone" checked={config.showPhone} onChange={v => updateConfig('showPhone', v)} />
              {config.showPhone && <Input value={config.phone} onChange={e => updateConfig('phone', e.target.value)} className="h-9 text-sm mt-2 ml-1" />}
              <ToggleRow label="Email" checked={config.showEmail} onChange={v => updateConfig('showEmail', v)} />
              {config.showEmail && <Input value={config.email} onChange={e => updateConfig('email', e.target.value)} className="h-9 text-sm mt-2 ml-1" />}
              <ToggleRow label="Website" checked={config.showWebsite} onChange={v => updateConfig('showWebsite', v)} />
              {config.showWebsite && <Input value={config.website} onChange={e => updateConfig('website', e.target.value)} className="h-9 text-sm mt-2 ml-1" />}
            </Section>
          </>
        )}

        {tab === 'content' && (
          <>
            <Section title="Order Information" icon={FileText} description="Transaction details visible on receipt">
              <ToggleRow label="Order Number" checked={config.showOrderNumber} onChange={v => updateConfig('showOrderNumber', v)} />
              <ToggleRow label="Customer Name" checked={config.showCustomerName} onChange={v => updateConfig('showCustomerName', v)} />
              <ToggleRow label="Cashier / Server" checked={config.showCashier} onChange={v => updateConfig('showCashier', v)} />
              <ToggleRow label="Order Type" description="Dine-in, Takeaway, Delivery, etc." checked={config.showOrderType} onChange={v => updateConfig('showOrderType', v)} />
              <ToggleRow label="Payment Method" checked={config.showPaymentMethod} onChange={v => updateConfig('showPaymentMethod', v)} />
            </Section>

            <Section title="Line Items" icon={Tag} description="Product display options">
              <ToggleRow label="Item SKU" checked={config.showItemSku} onChange={v => updateConfig('showItemSku', v)} />
              <ToggleRow label="Item Notes" checked={config.showItemNotes} onChange={v => updateConfig('showItemNotes', v)} />
            </Section>

            <Section title="Totals & Breakdown" icon={CreditCard} description="Financial summary section">
              <ToggleRow label="Subtotal" checked={config.showSubtotal} onChange={v => updateConfig('showSubtotal', v)} />
              <ToggleRow label="Tax Breakdown" checked={config.showTaxBreakdown} onChange={v => updateConfig('showTaxBreakdown', v)} />
              <ToggleRow label="Discount Breakdown" checked={config.showDiscountBreakdown} onChange={v => updateConfig('showDiscountBreakdown', v)} />
              <ToggleRow label="Total Savings" checked={config.showSavingsTotal} onChange={v => updateConfig('showSavingsTotal', v)} />
            </Section>

            <Section title="Header & Footer Messages" icon={FileText} description="Custom printed messages">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Header Text</Label>
                  <Textarea value={config.headerText} onChange={e => updateConfig('headerText', e.target.value)} className="text-sm resize-none" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Footer Text</Label>
                  <Textarea value={config.footerText} onChange={e => updateConfig('footerText', e.target.value)} className="text-sm resize-none" rows={2} />
                </div>
                <ToggleRow label="Thank You Message" checked={config.showThankYouMessage} onChange={v => updateConfig('showThankYouMessage', v)} />
                {config.showThankYouMessage && (
                  <Input value={config.thankYouMessage} onChange={e => updateConfig('thankYouMessage', e.target.value)} className="h-9 text-sm" />
                )}
              </div>
            </Section>
          </>
        )}

        {tab === 'compliance' && (
          <>
            <Section title="Tax Registration" icon={Building2} description="Tax & VAT identification numbers">
              <ToggleRow label="Tax Number" checked={config.showTaxNumber} onChange={v => updateConfig('showTaxNumber', v)} />
              {config.showTaxNumber && <Input value={config.taxNumber} onChange={e => updateConfig('taxNumber', e.target.value)} placeholder="TAX-XXXXX" className="h-9 text-sm mt-2 ml-1" />}
              <ToggleRow label="VAT Number" checked={config.showVatNumber} onChange={v => updateConfig('showVatNumber', v)} />
              {config.showVatNumber && <Input value={config.vatNumber} onChange={e => updateConfig('vatNumber', e.target.value)} placeholder="VAT-XXXXX" className="h-9 text-sm mt-2 ml-1" />}
              <ToggleRow label="Company Reg. Number" checked={config.showCompanyRegNumber} onChange={v => updateConfig('showCompanyRegNumber', v)} />
              {config.showCompanyRegNumber && <Input value={config.companyRegNumber} onChange={e => updateConfig('companyRegNumber', e.target.value)} className="h-9 text-sm mt-2 ml-1" />}
            </Section>

            <Section title="Legal Notices" icon={Scale} description="Return policies & disclaimers">
              <ToggleRow label="Return Policy" checked={config.showReturnPolicy} onChange={v => updateConfig('showReturnPolicy', v)} />
              {config.showReturnPolicy && <Textarea value={config.returnPolicyText} onChange={e => updateConfig('returnPolicyText', e.target.value)} className="text-sm resize-none mt-2 ml-1" rows={2} />}
              <ToggleRow label="Legal Disclaimer" checked={config.showLegalDisclaimer} onChange={v => updateConfig('showLegalDisclaimer', v)} />
              {config.showLegalDisclaimer && <Textarea value={config.legalDisclaimerText} onChange={e => updateConfig('legalDisclaimerText', e.target.value)} className="text-sm resize-none mt-2 ml-1" rows={2} />}
            </Section>

            <Section title="Localization" icon={Globe} description="Currency and number formatting">
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Currency</Label>
                  <Input value={config.currency} onChange={e => updateConfig('currency', e.target.value)} placeholder="USD" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Locale</Label>
                  <Input value={config.locale} onChange={e => updateConfig('locale', e.target.value)} placeholder="en-US" className="h-9 text-sm" />
                </div>
              </div>
            </Section>
          </>
        )}

        {tab === 'print' && (
          <Section title="Print Automation" icon={Printer} description="Automated printing triggers and copies">
            <ToggleRow label="Auto-print on Complete" description="Print when order is marked paid" checked={config.autoPrintOnComplete} onChange={v => updateConfig('autoPrintOnComplete', v)} />
            <ToggleRow label="Customer Copy" checked={config.printCustomerCopy} onChange={v => updateConfig('printCustomerCopy', v)} />
            <ToggleRow label="Merchant Copy" checked={config.printMerchantCopy} onChange={v => updateConfig('printMerchantCopy', v)} />
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Number of Copies</Label>
              <Select value={config.printCopies.toString()} onValueChange={v => updateConfig('printCopies', parseInt(v))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Section>
        )}

        {tab === 'extras' && (
          <>
            <Section title="QR Code & Barcode" icon={QrCode} description="Digital links and scanning">
              <ToggleRow label="Show QR Code" checked={config.showQrCode} onChange={v => updateConfig('showQrCode', v)} />
              {config.showQrCode && (
                <div className="mt-3 space-y-3 ml-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">QR Destination</Label>
                    <Select value={config.qrCodeTarget} onValueChange={v => updateConfig('qrCodeTarget', v)}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="order-link">Order Tracking</SelectItem>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="review-link">Review Page</SelectItem>
                        <SelectItem value="survey">Survey</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {config.qrCodeTarget !== 'order-link' && (
                    <Input value={config.qrCodeCustomUrl || ''} onChange={e => updateConfig('qrCodeCustomUrl', e.target.value)} placeholder="https://..." className="h-9 text-sm" />
                  )}
                </div>
              )}
              <ToggleRow label="Show Barcode" checked={config.showBarcode} onChange={v => updateConfig('showBarcode', v)} />
            </Section>

            <Section title="Customer Engagement" icon={Users} description="Loyalty and feedback programs">
              <ToggleRow label="Loyalty Points" checked={config.showLoyaltyPoints} onChange={v => updateConfig('showLoyaltyPoints', v)} />
              <ToggleRow label="Loyalty Balance" checked={config.showLoyaltyBalance} onChange={v => updateConfig('showLoyaltyBalance', v)} />
              <ToggleRow label="Next Visit Promo" checked={config.showNextVisitPromo} onChange={v => updateConfig('showNextVisitPromo', v)} />
              {config.showNextVisitPromo && <Input value={config.nextVisitPromoText} onChange={e => updateConfig('nextVisitPromoText', e.target.value)} className="h-9 text-sm mt-2 ml-1" />}
              <ToggleRow label="Survey QR" checked={config.showSurveyQr} onChange={v => updateConfig('showSurveyQr', v)} />
              {config.showSurveyQr && <Input value={config.surveyUrl} onChange={e => updateConfig('surveyUrl', e.target.value)} placeholder="https://survey..." className="h-9 text-sm mt-2 ml-1" />}
            </Section>

            <Section title="Social Media" icon={Globe} description="Social handles on receipt">
              <ToggleRow label="Show Social Media" checked={config.showSocialMedia} onChange={v => updateConfig('showSocialMedia', v)} />
              {config.showSocialMedia && <Input value={config.socialMediaHandle} onChange={e => updateConfig('socialMediaHandle', e.target.value)} placeholder="@yourhandle" className="h-9 text-sm mt-2 ml-1" />}
            </Section>
          </>
        )}

      </div>
    </div>
  );
}

// ─── Kitchen Settings Panels ────────────────────────────────────────────────────

const KITCHEN_TABS = [
  { value: 'layout', label: 'Layout', icon: Layout },
  { value: 'content', label: 'Content', icon: FileText },
  { value: 'stations', label: 'Stations', icon: ChefHat },
  { value: 'alerts', label: 'Alerts', icon: AlertTriangle },
  { value: 'print', label: 'Print', icon: Printer },
];

function KitchenSettings({ config, updateConfig }: { config: KitchenTicketConfig; updateConfig: (key: keyof KitchenTicketConfig, value: any) => void }) {
  const [tab, setTab] = useState('layout');

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/40 px-5 py-3">
        <NavPill tabs={KITCHEN_TABS} active={tab} onChange={setTab} />
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {tab === 'layout' && (
          <>
            <Section title="Paper & Typography" icon={Layout} description="Size, font, and spacing">
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Paper Size</Label>
                  <Select value={config.paperSize} onValueChange={v => updateConfig('paperSize', v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="80mm">80mm (Standard)</SelectItem>
                      <SelectItem value="58mm">58mm (Compact)</SelectItem>
                      <SelectItem value="A5">A5 (Large)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Font Size</Label>
                  <Select value={config.fontSize} onValueChange={v => updateConfig('fontSize', v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large (High Visibility)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Section>
            <Section title="Visual Options" icon={Palette} description="Display style and density">
              <ToggleRow label="Compact Mode" description="Reduce padding for higher density" checked={config.compactMode} onChange={v => updateConfig('compactMode', v)} />
              <ToggleRow label="Large Quantity Display" description="Big bold numbers for quick reads" checked={config.largeQuantityDisplay} onChange={v => updateConfig('largeQuantityDisplay', v)} />
              <ToggleRow label="Item Separators" checked={config.showItemSeparators} onChange={v => updateConfig('showItemSeparators', v)} />
              <ToggleRow label="Category Headers" checked={config.showCategoryHeaders} onChange={v => updateConfig('showCategoryHeaders', v)} />
            </Section>
            <Section title="Header & Footer" icon={FileText} description="Ticket header and footer text">
              <div className="space-y-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Header Text</Label>
                  <Input value={config.headerText} onChange={e => updateConfig('headerText', e.target.value)} placeholder="KITCHEN ORDER" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Footer Text</Label>
                  <Input value={config.footerText} onChange={e => updateConfig('footerText', e.target.value)} placeholder="Optional footer..." className="h-9 text-sm" />
                </div>
              </div>
            </Section>
          </>
        )}

        {tab === 'content' && (
          <>
            <Section title="Order Information" icon={FileText} description="What details appear on ticket">
              <ToggleRow label="Timestamp" checked={config.showTime} onChange={v => updateConfig('showTime', v)} />
              <ToggleRow label="Order Type" checked={config.showOrderType} onChange={v => updateConfig('showOrderType', v)} />
              <ToggleRow label="Table Number" checked={config.showTable} onChange={v => updateConfig('showTable', v)} />
              <ToggleRow label="Customer Name" checked={config.showCustomerName} onChange={v => updateConfig('showCustomerName', v)} />
              <ToggleRow label="Server Name" checked={config.showServerName} onChange={v => updateConfig('showServerName', v)} />
              <ToggleRow label="Sequence Number" description="Order position in queue" checked={config.showSequenceNumber} onChange={v => updateConfig('showSequenceNumber', v)} />
            </Section>
            <Section title="Item Details" icon={Utensils} description="Product lines on the ticket">
              <ToggleRow label="Show Prices" checked={config.showPrices} onChange={v => updateConfig('showPrices', v)} />
              <ToggleRow label="Show Notes" checked={config.showNotes} onChange={v => updateConfig('showNotes', v)} />
              <ToggleRow label="Modifiers on Separate Line" description="Show variants below item name" checked={config.showModifiersSeparately} onChange={v => updateConfig('showModifiersSeparately', v)} />
            </Section>
            <Section title="Time Management" icon={Clock} description="Order timing and prep estimates">
              <ToggleRow label="Order Age" description="Elapsed time since order" checked={config.showOrderAge} onChange={v => updateConfig('showOrderAge', v)} />
              <ToggleRow label="Estimated Prep Time" checked={config.showEstimatedPrepTime} onChange={v => updateConfig('showEstimatedPrepTime', v)} />
            </Section>
          </>
        )}

        {tab === 'stations' && (
          <Section title="Station Routing" icon={ChefHat} description="Route tickets to specific kitchen stations">
            <ToggleRow label="Enable Station Routing" description="Direct orders to the right section" checked={config.enableStationRouting} onChange={v => updateConfig('enableStationRouting', v)} />
            {config.enableStationRouting && (
              <div className="mt-4 space-y-3 ml-1">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Stations</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {config.stations.map((station, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{station}</Badge>
                    ))}
                  </div>
                  <Input
                    placeholder="Add station name, press Enter"
                    className="h-9 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        updateConfig('stations', [...config.stations, e.currentTarget.value]);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Default Station</Label>
                  <Select value={config.defaultStation} onValueChange={v => updateConfig('defaultStation', v)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {config.stations.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <ToggleRow label="Print to All Stations" description="Send a copy to every configured station" checked={config.printToAllStations} onChange={v => updateConfig('printToAllStations', v)} />
              </div>
            )}
          </Section>
        )}

        {tab === 'alerts' && (
          <>
            <Section title="Priority & Rush Orders" icon={AlertTriangle} description="Visual urgency and rush handling">
              <ToggleRow label="Show Priority Flag" checked={config.showPriority} onChange={v => updateConfig('showPriority', v)} />
              <ToggleRow label="Highlight Rush Orders" description="Visual callout for delayed orders" checked={config.highlightRushOrders} onChange={v => updateConfig('highlightRushOrders', v)} />
              {config.highlightRushOrders && (
                <div className="mt-3 space-y-3 ml-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Rush Threshold (minutes)</Label>
                    <Select value={config.rushOrderThresholdMinutes.toString()} onValueChange={v => updateConfig('rushOrderThresholdMinutes', parseInt(v))}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[5, 10, 15, 20, 30].map(n => <SelectItem key={n} value={n.toString()}>{n} min</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide">Rush Highlight Color</Label>
                    <div className="flex gap-2">
                      <input type="color" value={config.rushOrderColor} onChange={e => updateConfig('rushOrderColor', e.target.value)} className="w-10 h-9 rounded-lg cursor-pointer border border-border" />
                      <Input value={config.rushOrderColor} onChange={e => updateConfig('rushOrderColor', e.target.value)} className="h-9 text-sm flex-1" />
                    </div>
                  </div>
                </div>
              )}
            </Section>
            <Section title="Allergen & Dietary" icon={AlertTriangle} description="Food safety callouts">
              <ToggleRow label="Show Allergen Warnings" description="Bold callout for allergen items" checked={config.showAllergens} onChange={v => updateConfig('showAllergens', v)} />
              <ToggleRow label="Dietary Icons" description="V, VG, GF indicator badges" checked={config.showDietaryIcons} onChange={v => updateConfig('showDietaryIcons', v)} />
              {config.showAllergens && (
                <div className="mt-3 space-y-1.5 ml-1">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Allergen Highlight Color</Label>
                  <div className="flex gap-2">
                    <input type="color" value={config.allergenHighlightColor} onChange={e => updateConfig('allergenHighlightColor', e.target.value)} className="w-10 h-9 rounded-lg cursor-pointer border border-border" />
                    <Input value={config.allergenHighlightColor} onChange={e => updateConfig('allergenHighlightColor', e.target.value)} className="h-9 text-sm flex-1" />
                  </div>
                </div>
              )}
            </Section>
          </>
        )}

        {tab === 'print' && (
          <>
            <Section title="Print Automation" icon={Printer} description="Trigger and delay settings">
              <ToggleRow label="Auto-print New Orders" description="Print immediately when order is created" checked={config.autoPrintNewOrders} onChange={v => updateConfig('autoPrintNewOrders', v)} />
              <ToggleRow label="Auto-print on Complete" description="Print when order is completed" checked={config.autoPrintCompleted} onChange={v => updateConfig('autoPrintCompleted', v)} />
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Print Delay</Label>
                <Select value={config.printDelaySeconds.toString()} onValueChange={v => updateConfig('printDelaySeconds', parseInt(v))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 5, 10].map(n => <SelectItem key={n} value={n.toString()}>{n === 0 ? 'Immediate' : `${n}s delay`}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Number of Copies</Label>
                <Select value={config.printCopies.toString()} onValueChange={v => updateConfig('printCopies', parseInt(v))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </Section>
            <Section title="Audio Alerts" icon={Bell} description="Sound notifications">
              <ToggleRow label="Sound on New Ticket" description="Audio alert when a ticket is printed" checked={config.soundAlertOnNewOrder} onChange={v => updateConfig('soundAlertOnNewOrder', v)} />
            </Section>
          </>
        )}

      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function ReceiptSettingsPage() {
  const settings = usePosStore(state => state.settings);
  const receiptConfig = usePosStore(state => state.settings.receiptConfig);
  const kitchenTicketConfig = usePosStore(state => state.settings.kitchenTicketConfig);
  const updateReceiptConfig = usePosStore(state => state.updateReceiptConfig);
  const updateKitchenTicketConfig = usePosStore(state => state.updateKitchenTicketConfig);
  const orders = usePosStore(state => state.orders);

  // Determine if kitchen ticket is applicable for this business type
  const businessConfig = getBusinessConfig(settings.businessType);
  const hasKitchenDisplay = businessConfig.features.kitchenDisplay;

  const [mode, setMode] = useState<'receipt' | 'kitchen'>('receipt');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [barcodeUrl, setBarcodeUrl] = useState<string>('');
  const [previewScale, setPreviewScale] = useState([90]);
  const [previewBg, setPreviewBg] = useState<'light' | 'dark'>('dark');

  const { handlePrint, handleDownload, isPrinting, isDownloading } = usePdfActions();

  const [config, setConfig] = useState<ReceiptConfig>({ ...getDefaultReceiptConfig(), ...receiptConfig });
  const [kConfig, setKConfig] = useState<KitchenTicketConfig>({ ...getDefaultKitchenTicketConfig(), ...kitchenTicketConfig });

  // If business no longer supports kitchen, force receipt mode
  useEffect(() => {
    if (!hasKitchenDisplay && mode === 'kitchen') setMode('receipt');
  }, [hasKitchenDisplay, mode]);

  useEffect(() => {
    if (receiptConfig) setConfig(prev => ({ ...prev, ...receiptConfig }));
    if (kitchenTicketConfig) setKConfig(prev => ({ ...prev, ...kitchenTicketConfig }));
  }, [receiptConfig, kitchenTicketConfig]);

  const updateConfig = (key: keyof ReceiptConfig, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    updateReceiptConfig(newConfig);
  };

  const updateKConfig = (key: keyof KitchenTicketConfig, value: any) => {
    const newConfig = { ...kConfig, [key]: value };
    setKConfig(newConfig);
    updateKitchenTicketConfig(newConfig);
  };

  const sampleOrder = orders[0] || {
    id: 'sample', orderNumber: 'ORD-847',
    customerName: 'Table 12 Guest', cashierName: 'Sarah M.',
    items: [
      { productName: 'Grilled Salmon', variantName: 'Large', quantity: 2, selectedUnit: { price: 24.99 } },
      { productName: 'Caesar Salad', variantName: 'Default Variant', quantity: 1, selectedUnit: { price: 12.50 } },
      { productName: 'Sparkling Water', variantName: 'Default Variant', quantity: 3, selectedUnit: { price: 4.00 } },
    ],
    subTotal: 74.48, discount: 5.00, taxes: 6.95, total: 76.43,
    createdAt: new Date(), paymentMethod: 'Credit Card',
    orderType: 'dine-in', tableNumber: 'T-12',
    instructions: 'No nuts - severe allergy. Extra lemon on side.',
  };

  useEffect(() => {
    if (config.showQrCode) {
      QRCode.toDataURL('https://example.com/order/847', { width: 100, margin: 1 }).then(setQrCodeDataUrl);
    }
  }, [config.showQrCode]);

  useEffect(() => {
    if (config.showBarcode) {
      try {
        const canvas = document.createElement('canvas');
        bwipjs.toCanvas(canvas, { bcid: 'code128', text: sampleOrder.orderNumber, scale: 3, height: 10, includetext: false });
        setBarcodeUrl(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('Barcode generation failed', e);
      }
    } else {
      setBarcodeUrl('');
    }
  }, [config.showBarcode, sampleOrder.orderNumber]);

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">

      {/* ── Left Panel: Controls ─────────────────────────────────────────── */}
      <div className="w-full lg:w-[460px] xl:w-[520px] flex flex-col border-r border-border/60 h-full bg-background">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 bg-background shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Settings2 className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-[15px] leading-none">Print Configuration</h2>
              <p className="text-[11px] text-muted-foreground mt-1">
                {hasKitchenDisplay ? 'Customer receipt & kitchen ticket' : 'Customer receipt settings'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => mode === 'receipt' ? (setConfig(getDefaultReceiptConfig()), updateReceiptConfig(getDefaultReceiptConfig())) : (setKConfig(getDefaultKitchenTicketConfig()), updateKitchenTicketConfig(getDefaultKitchenTicketConfig()))}
            className="h-8 text-xs text-muted-foreground hover:text-destructive gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        </div>

        {/* Mode Switcher */}
        <div className="px-5 py-3 border-b border-border/40 shrink-0">
          <div className="flex gap-1 p-1 bg-muted/40 rounded-xl">
            <button
              onClick={() => setMode('receipt')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium transition-all duration-200',
                mode === 'receipt'
                  ? 'bg-background text-foreground shadow-sm border border-border/50'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <FileText className="w-4 h-4" />
              Customer Receipt
              {mode === 'receipt' && <Check className="w-3.5 h-3.5 text-primary ml-auto mr-1" />}
            </button>
            {hasKitchenDisplay && (
              <button
                onClick={() => setMode('kitchen')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 h-9 rounded-lg text-sm font-medium transition-all duration-200',
                  mode === 'kitchen'
                    ? 'bg-background text-foreground shadow-sm border border-border/50'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ChefHat className="w-4 h-4" />
                Kitchen Ticket
                {mode === 'kitchen' && <Check className="w-3.5 h-3.5 text-primary ml-auto mr-1" />}
              </button>
            )}
          </div>
        </div>

        {/* Scrollable settings panel */}
        <div className="flex-1 overflow-hidden">
          {mode === 'receipt' ? (
            <ReceiptSettings config={config} updateConfig={updateConfig} />
          ) : (
            <KitchenSettings config={kConfig} updateConfig={updateKConfig} />
          )}
        </div>
      </div>

      {/* ── Right Panel: Preview ─────────────────────────────────────────── */}
      <div className={cn(
        'flex-1 relative flex flex-col transition-colors duration-500',
        previewBg === 'dark'
          ? 'bg-[#111]'
          : 'bg-neutral-100',
      )}>

        {/* Floating toolbar */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl rounded-full px-3 py-1.5">
          {mode === 'kitchen' && (
            <>
              <button
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => setPreviewScale(p => [Math.max(50, p[0] - 10)])}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-semibold tabular-nums w-12 text-center text-muted-foreground">{previewScale[0]}%</span>
              <button
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                onClick={() => setPreviewScale(p => [Math.min(150, p[0] + 10)])}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-4 bg-border mx-1" />
            </>
          )}
          <button
            onClick={() => setPreviewBg(previewBg === 'dark' ? 'light' : 'dark')}
            className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center transition-colors',
              previewBg === 'dark' ? 'bg-primary/15 text-primary' : 'hover:bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <Layout className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="absolute top-5 right-5 z-20 flex gap-2">
          <Button
            size="sm"
            disabled={isPrinting || isDownloading}
            onClick={() => mode === 'receipt'
              ? handlePrint(<ReceiptPdfDocument order={sampleOrder} settings={{ ...settings, receiptConfig: config }} qrCodeUrl={qrCodeDataUrl} barcodeUrl={barcodeUrl} branchName="Main Branch" />, 'receipt-test')
              : handlePrint(<PDFKitchenTicket order={{ ...sampleOrder }} kitchenTicketConfig={kConfig} />, 'kitchen-ticket-test')
            }
            className="h-8 text-xs font-medium gap-1.5 shadow-lg"
          >
            <Printer className="w-3.5 h-3.5" />
            {isPrinting ? 'Printing…' : 'Print Test'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={isPrinting || isDownloading}
            onClick={() => mode === 'receipt'
              ? handleDownload(<ReceiptPdfDocument order={sampleOrder} settings={{ ...settings, receiptConfig: config }} qrCodeUrl={qrCodeDataUrl} barcodeUrl={barcodeUrl} branchName="Main Branch" />, 'receipt-test')
              : handleDownload(<PDFKitchenTicket order={{ ...sampleOrder }} kitchenTicketConfig={kConfig} />, 'kitchen-ticket-test')
            }
            className="h-8 text-xs font-medium gap-1.5 shadow-lg"
          >
            <Download className="w-3.5 h-3.5" />
            {isDownloading ? 'Saving…' : 'Download'}
          </Button>
        </div>

        {/* Preview canvas */}
        <div className={cn('flex-1 overflow-hidden flex flex-col items-center justify-center pt-20 pb-8 px-8', mode === 'receipt' ? 'h-full' : '')}>
          {mode === 'receipt' ? (
            <div className="w-full h-full max-w-[500px] shadow-2xl rounded-xl overflow-hidden border border-white/10 relative">
              <ReceiptPreviewWrapper
                document={<ReceiptPdfDocument order={sampleOrder} settings={{ ...settings, receiptConfig: config }} qrCodeUrl={qrCodeDataUrl} barcodeUrl={barcodeUrl} branchName="Main Branch" />}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-auto w-full flex justify-center">
              <div
                className="transition-all duration-300 ease-out"
                style={{
                  transform: `scale(${previewScale[0] / 100})`,
                  transformOrigin: 'top center',
                  width: kConfig.paperSize === '80mm' ? '300px' : kConfig.paperSize === '58mm' ? '200px' : '350px',
                  marginBottom: '100px',
                }}
              >
                <KitchenTicketPreview order={sampleOrder} config={kConfig} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}