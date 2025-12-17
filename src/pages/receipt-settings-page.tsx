'use client';

import { useState, useEffect } from 'react';
import { usePosStore, type ReceiptConfig, type KitchenTicketConfig, getDefaultKitchenTicketConfig, getDefaultReceiptConfig } from '@/store/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReceiptPreview } from '@/components/receipt-preview';
import { ReceiptPdfDocument } from '@/components/receipt-pdf';
import { PDFKitchenTicket } from '@/components/receipts/pdf-kitchen-ticket';
import { usePdfActions } from '@/hooks/use-pdf-actions';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Download, Printer, RotateCcw, Layout, FileText, QrCode, ZoomIn, ZoomOut,
  Palette, Store, ChefHat, ChevronDown, AlertTriangle, Clock, Users,
  Globe, CreditCard, Utensils, Bell, Tag, Building2, Scale
} from 'lucide-react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';

// Collapsible Section Component
function SettingsSection({ 
  title, icon: Icon, description, children, defaultOpen = true 
}: { 
  title: string; 
  icon: React.ElementType; 
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-border/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">{title}</CardTitle>
                  {description && <CardDescription className="text-xs">{description}</CardDescription>}
                </div>
              </div>
              <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 space-y-4">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Toggle Row Component
function ToggleRow({ label, description, checked, onChange }: { 
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void 
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <Label className="text-sm">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

// Kitchen Ticket Preview Component
function KitchenTicketPreview({ order, config }: { order: any; config: KitchenTicketConfig }) {
  const fontSize = config.fontSize === 'small' ? 'text-[10px]' : config.fontSize === 'large' ? 'text-lg' : 'text-sm';
  const width = config.paperSize === '58mm' ? 'max-w-[180px]' : config.paperSize === '80mm' ? 'max-w-[300px]' : 'max-w-full';

  return (
    <div className={cn("bg-white text-black p-4 font-mono shadow-lg mx-auto rounded", fontSize, width)} style={{ minHeight: 350 }}>
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
        {config.showServerName && order.cashierName && (
          <div className="flex justify-between"><span>Server:</span><span>{order.cashierName}</span></div>
        )}
        {config.showTime && (
          <div className="flex justify-between">
            <span>Time:</span>
            <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
        {config.showOrderAge && (
          <div className="flex justify-between text-orange-600 font-medium">
            <span>Age:</span><span>2 min</span>
          </div>
        )}
      </div>

      <div className="space-y-3 border-t border-black pt-2">
        {order.items.map((item: any, i: number) => (
          <div key={i} className={cn("pb-2", config.showItemSeparators && "border-b border-dashed border-gray-300")}>
            <div className="flex gap-2">
              <div className={cn(
                "font-bold bg-black text-white flex items-center justify-center rounded-sm shrink-0",
                config.largeQuantityDisplay ? "w-10 h-10 text-xl" : "w-6 h-6 text-sm"
              )}>
                {item.quantity}
              </div>
              <div className="font-bold leading-tight text-base">{item.productName}</div>
            </div>
            {config.showModifiersSeparately && item.variantName !== 'Default Variant' && (
              <div className="pl-12 text-gray-600 text-[0.85em] mt-0.5">→ {item.variantName}</div>
            )}
            {config.showPrices && (
              <div className="pl-12 text-gray-500 text-[0.8em]">
                @ {(item.selectedUnit?.price || 0).toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>

      {config.showNotes && order.instructions && (
        <div className="mt-4 bg-yellow-100 border-l-4 border-yellow-500 p-2">
          <div className="font-bold text-xs mb-1">⚠️ NOTES:</div>
          <div className="text-xs">{order.instructions}</div>
        </div>
      )}

      {config.showAllergens && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded p-2">
          <div className="flex items-center gap-1 text-red-600 font-bold text-xs">
            <AlertTriangle className="w-3 h-3" /> ALLERGEN ALERT
          </div>
          <div className="text-xs text-red-700 mt-1">Contains: Nuts, Dairy</div>
        </div>
      )}

      <div className="mt-4 pt-2 border-t border-black text-center text-[10px] text-gray-500">
        Printed: {new Date().toLocaleString()}
        {config.footerText && <div className="mt-1">{config.footerText}</div>}
      </div>
    </div>
  );
}

export default function ReceiptSettingsPage() {
  const settings = usePosStore(state => state.settings);
  const receiptConfig = usePosStore(state => state.settings.receiptConfig);
  const kitchenTicketConfig = usePosStore(state => state.settings.kitchenTicketConfig);
  const updateReceiptConfig = usePosStore(state => state.updateReceiptConfig);
  const updateKitchenTicketConfig = usePosStore(state => state.updateKitchenTicketConfig);
  const orders = usePosStore(state => state.orders);

  const [mode, setMode] = useState<'receipt' | 'kitchen'>('receipt');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [previewScale, setPreviewScale] = useState([90]);
  const [previewBg, setPreviewBg] = useState<'light' | 'dark'>('dark');

  const { handlePrint, handleDownload, isPrinting, isDownloading } = usePdfActions();

  const [config, setConfig] = useState<ReceiptConfig>({ ...getDefaultReceiptConfig(), ...receiptConfig });
  const [kConfig, setKConfig] = useState<KitchenTicketConfig>({ ...getDefaultKitchenTicketConfig(), ...kitchenTicketConfig });

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

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* Left Panel: Settings */}
      <div className="w-full lg:w-[480px] xl:w-[520px] flex flex-col border-r bg-card h-full">
        {/* Header */}
        <div className="p-4 border-b bg-background/95 backdrop-blur sticky top-0 z-20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5">
                <Printer className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">Print Settings</h2>
                <p className="text-xs text-muted-foreground">Configure receipts & kitchen tickets</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => mode === 'receipt' ? setConfig(getDefaultReceiptConfig()) : setKConfig(getDefaultKitchenTicketConfig())}
              className="text-xs"
            >
              <RotateCcw className="w-3 h-3 mr-1" /> Reset
            </Button>
          </div>

          {/* Mode Tabs */}
          <div className="flex gap-2">
            <Button 
              variant={mode === 'receipt' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setMode('receipt')}
              className="flex-1 h-9"
            >
              <FileText className="w-4 h-4 mr-2" /> Customer Receipt
            </Button>
            <Button 
              variant={mode === 'kitchen' ? 'default' : 'outline'} 
              size="sm" 
              onClick={() => setMode('kitchen')}
              className="flex-1 h-9"
            >
              <ChefHat className="w-4 h-4 mr-2" /> Kitchen Ticket
            </Button>
          </div>
        </div>

        {/* Scrollable Settings */}
        <div className="flex-1 overflow-y-auto">
          {mode === 'receipt' ? (
            <ReceiptSettings config={config} updateConfig={updateConfig} />
          ) : (
            <KitchenSettings config={kConfig} updateConfig={updateKConfig} />
          )}
        </div>
      </div>

      {/* Right Panel: Preview */}
      <div className={cn(
        "flex-1 relative flex flex-col transition-colors duration-300",
        previewBg === 'dark' ? "bg-neutral-900" : "bg-neutral-100"
      )}>
        {/* Preview Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-background/95 backdrop-blur border shadow-lg rounded-full p-1.5 px-4">
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setPreviewScale(p => [Math.max(50, p[0] - 10)])}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <span className="text-xs font-mono w-10 text-center">{previewScale}%</span>
          <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setPreviewScale(p => [Math.min(150, p[0] + 10)])}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Separator orientation="vertical" className="h-4" />
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-7 h-7"
            onClick={() => setPreviewBg(previewBg === 'dark' ? 'light' : 'dark')}
          >
            <Layout className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="absolute top-4 right-4 z-20 flex gap-2">
          <Button 
            size="sm" 
            disabled={isPrinting || isDownloading} 
            onClick={() => mode === 'receipt' 
              ? handlePrint(<ReceiptPdfDocument order={sampleOrder} settings={{ ...settings, receiptConfig: config }} qrCodeUrl={qrCodeDataUrl} />, 'receipt-test')
              : handlePrint(<PDFKitchenTicket order={{...sampleOrder}} kitchenTicketConfig={kConfig} />, 'kitchen-ticket-test')
            }
            className="shadow-lg"
          >
            <Printer className="w-4 h-4 mr-2" /> {isPrinting ? 'Printing...' : 'Print Test'}
          </Button>
          <Button 
            size="sm" 
            variant="secondary"
            disabled={isPrinting || isDownloading} 
            onClick={() => mode === 'receipt' 
              ? handleDownload(<ReceiptPdfDocument order={sampleOrder} settings={{ ...settings, receiptConfig: config }} qrCodeUrl={qrCodeDataUrl} />, 'receipt-test')
              : handleDownload(<PDFKitchenTicket order={{...sampleOrder}} kitchenTicketConfig={kConfig} />, 'kitchen-ticket-test')
            }
            className="shadow-lg"
          >
            <Download className="w-4 h-4 mr-2" /> {isDownloading ? 'Saving...' : 'Download'}
          </Button>
        </div>

        {/* Preview Canvas */}
        <div className="flex-1 overflow-auto flex items-start justify-center p-10 pt-20">
          <div 
            className="transition-all duration-200 shadow-2xl"
            style={{
              transform: `scale(${previewScale[0] / 100})`,
              transformOrigin: 'top center',
              width: mode === 'receipt' 
                ? (config.paperSize === '80mm' ? '370px' : '280px') 
                : (kConfig.paperSize === '80mm' ? '300px' : kConfig.paperSize === '58mm' ? '200px' : '350px'),
              marginBottom: '100px'
            }}
          >
            {mode === 'receipt' ? (
              <ReceiptPreview order={sampleOrder} settings={{ ...settings, receiptConfig: config }} />
            ) : (
              <KitchenTicketPreview order={sampleOrder} config={kConfig} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Receipt Settings Component
function ReceiptSettings({ config, updateConfig }: { config: ReceiptConfig; updateConfig: (key: keyof ReceiptConfig, value: any) => void }) {
  return (
    <Tabs defaultValue="branding" className="w-full">
      <div className="sticky top-0 z-10 bg-card border-b px-4 pt-3">
        <TabsList className="w-full grid grid-cols-5 mb-3 h-9">
          <TabsTrigger value="branding" className="text-xs">Branding</TabsTrigger>
          <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs">Legal</TabsTrigger>
          <TabsTrigger value="print" className="text-xs">Print</TabsTrigger>
          <TabsTrigger value="extras" className="text-xs">Extras</TabsTrigger>
        </TabsList>
      </div>

      <div className="p-4 space-y-4">
        <TabsContent value="branding" className="mt-0 space-y-4">
          <SettingsSection title="Logo & Identity" icon={Palette} description="Brand visuals">
            <ToggleRow label="Show Logo" checked={config.showLogo} onChange={v => updateConfig('showLogo', v)} />
            {config.showLogo && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Logo URL</Label>
                  <Input value={config.logoUrl} onChange={e => updateConfig('logoUrl', e.target.value)} placeholder="https://..." className="h-8 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Position</Label>
                    <Select value={config.logoPosition} onValueChange={v => updateConfig('logoPosition', v)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="left">Left</SelectItem>
                        <SelectItem value="center">Center</SelectItem>
                        <SelectItem value="right">Right</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Size ({config.logoWidth}%)</Label>
                    <Slider value={[config.logoWidth]} min={20} max={100} step={5} onValueChange={v => updateConfig('logoWidth', v[0])} />
                  </div>
                </div>
              </>
            )}
            <ToggleRow label="Show Tagline" checked={config.showTagline} onChange={v => updateConfig('showTagline', v)} />
            {config.showTagline && (
              <Input value={config.tagline} onChange={e => updateConfig('tagline', e.target.value)} placeholder="Your tagline..." className="h-8 text-xs" />
            )}
          </SettingsSection>

          <SettingsSection title="Layout & Typography" icon={Layout} description="Style settings">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Paper Size</Label>
                <Select value={config.paperSize} onValueChange={v => updateConfig('paperSize', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80mm">80mm (Standard)</SelectItem>
                    <SelectItem value="58mm">58mm (Compact)</SelectItem>
                    <SelectItem value="Letter">Letter (A4)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Font Style</Label>
                <Select value={config.fontFamily} onValueChange={v => updateConfig('fontFamily', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monospace">Monospace</SelectItem>
                    <SelectItem value="sans">Sans Serif</SelectItem>
                    <SelectItem value="serif">Serif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Font Size</Label>
                <Select value={config.fontSize} onValueChange={v => updateConfig('fontSize', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Alignment</Label>
                <Select value={config.textAlignment} onValueChange={v => updateConfig('textAlignment', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Business Contact" icon={Store} description="Contact details">
            <ToggleRow label="Address" checked={config.showAddress} onChange={v => updateConfig('showAddress', v)} />
            {config.showAddress && <Input value={config.address} onChange={e => updateConfig('address', e.target.value)} className="h-8 text-xs" />}
            <ToggleRow label="Phone" checked={config.showPhone} onChange={v => updateConfig('showPhone', v)} />
            {config.showPhone && <Input value={config.phone} onChange={e => updateConfig('phone', e.target.value)} className="h-8 text-xs" />}
            <ToggleRow label="Email" checked={config.showEmail} onChange={v => updateConfig('showEmail', v)} />
            {config.showEmail && <Input value={config.email} onChange={e => updateConfig('email', e.target.value)} className="h-8 text-xs" />}
            <ToggleRow label="Website" checked={config.showWebsite} onChange={v => updateConfig('showWebsite', v)} />
            {config.showWebsite && <Input value={config.website} onChange={e => updateConfig('website', e.target.value)} className="h-8 text-xs" />}
          </SettingsSection>
        </TabsContent>

        <TabsContent value="content" className="mt-0 space-y-4">
          <SettingsSection title="Order Information" icon={FileText} description="Transaction details">
            <ToggleRow label="Order Number" checked={config.showOrderNumber} onChange={v => updateConfig('showOrderNumber', v)} />
            <ToggleRow label="Customer Name" checked={config.showCustomerName} onChange={v => updateConfig('showCustomerName', v)} />
            <ToggleRow label="Cashier/Server" checked={config.showCashier} onChange={v => updateConfig('showCashier', v)} />
            <ToggleRow label="Order Type" description="Dine-in, Takeaway, etc." checked={config.showOrderType} onChange={v => updateConfig('showOrderType', v)} />
            <ToggleRow label="Payment Method" checked={config.showPaymentMethod} onChange={v => updateConfig('showPaymentMethod', v)} />
          </SettingsSection>

          <SettingsSection title="Items Display" icon={Tag} description="Product line items">
            <ToggleRow label="Item SKU" checked={config.showItemSku} onChange={v => updateConfig('showItemSku', v)} />
            <ToggleRow label="Item Notes" checked={config.showItemNotes} onChange={v => updateConfig('showItemNotes', v)} />
          </SettingsSection>

          <SettingsSection title="Totals & Breakdown" icon={CreditCard} description="Financial summary">
            <ToggleRow label="Subtotal" checked={config.showSubtotal} onChange={v => updateConfig('showSubtotal', v)} />
            <ToggleRow label="Tax Breakdown" checked={config.showTaxBreakdown} onChange={v => updateConfig('showTaxBreakdown', v)} />
            <ToggleRow label="Discount Breakdown" checked={config.showDiscountBreakdown} onChange={v => updateConfig('showDiscountBreakdown', v)} />
            <ToggleRow label="Total Savings" checked={config.showSavingsTotal} onChange={v => updateConfig('showSavingsTotal', v)} />
          </SettingsSection>

          <SettingsSection title="Messages" icon={FileText} description="Header & footer text" defaultOpen={false}>
            <div className="space-y-2">
              <Label className="text-xs">Header Text</Label>
              <Textarea value={config.headerText} onChange={e => updateConfig('headerText', e.target.value)} className="text-xs resize-none" rows={2} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Footer Text</Label>
              <Textarea value={config.footerText} onChange={e => updateConfig('footerText', e.target.value)} className="text-xs resize-none" rows={2} />
            </div>
            <ToggleRow label="Thank You Message" checked={config.showThankYouMessage} onChange={v => updateConfig('showThankYouMessage', v)} />
            {config.showThankYouMessage && (
              <Input value={config.thankYouMessage} onChange={e => updateConfig('thankYouMessage', e.target.value)} className="h-8 text-xs" />
            )}
          </SettingsSection>
        </TabsContent>

        <TabsContent value="compliance" className="mt-0 space-y-4">
          <SettingsSection title="Tax Registration" icon={Building2} description="Tax & VAT details">
            <ToggleRow label="Tax Number" checked={config.showTaxNumber} onChange={v => updateConfig('showTaxNumber', v)} />
            {config.showTaxNumber && <Input value={config.taxNumber} onChange={e => updateConfig('taxNumber', e.target.value)} placeholder="TAX-XXXXX" className="h-8 text-xs" />}
            <ToggleRow label="VAT Number" checked={config.showVatNumber} onChange={v => updateConfig('showVatNumber', v)} />
            {config.showVatNumber && <Input value={config.vatNumber} onChange={e => updateConfig('vatNumber', e.target.value)} placeholder="VAT-XXXXX" className="h-8 text-xs" />}
            <ToggleRow label="Company Reg. Number" checked={config.showCompanyRegNumber} onChange={v => updateConfig('showCompanyRegNumber', v)} />
            {config.showCompanyRegNumber && <Input value={config.companyRegNumber} onChange={e => updateConfig('companyRegNumber', e.target.value)} className="h-8 text-xs" />}
          </SettingsSection>

          <SettingsSection title="Legal Notices" icon={Scale} description="Policies & disclaimers">
            <ToggleRow label="Return Policy" checked={config.showReturnPolicy} onChange={v => updateConfig('showReturnPolicy', v)} />
            {config.showReturnPolicy && (
              <Textarea value={config.returnPolicyText} onChange={e => updateConfig('returnPolicyText', e.target.value)} className="text-xs resize-none" rows={2} />
            )}
            <ToggleRow label="Legal Disclaimer" checked={config.showLegalDisclaimer} onChange={v => updateConfig('showLegalDisclaimer', v)} />
            {config.showLegalDisclaimer && (
              <Textarea value={config.legalDisclaimerText} onChange={e => updateConfig('legalDisclaimerText', e.target.value)} className="text-xs resize-none" rows={2} />
            )}
          </SettingsSection>

          <SettingsSection title="Localization" icon={Globe} description="Currency & formatting">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Currency</Label>
                <Input value={config.currency} onChange={e => updateConfig('currency', e.target.value)} placeholder="USD" className="h-8 text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Locale</Label>
                <Input value={config.locale} onChange={e => updateConfig('locale', e.target.value)} placeholder="en-US" className="h-8 text-xs" />
              </div>
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="print" className="mt-0 space-y-4">
          <SettingsSection title="Print Automation" icon={Printer} description="Auto-print settings">
            <ToggleRow label="Auto-print on Complete" description="Print when order is paid" checked={config.autoPrintOnComplete} onChange={v => updateConfig('autoPrintOnComplete', v)} />
            <ToggleRow label="Customer Copy" checked={config.printCustomerCopy} onChange={v => updateConfig('printCustomerCopy', v)} />
            <ToggleRow label="Merchant Copy" checked={config.printMerchantCopy} onChange={v => updateConfig('printMerchantCopy', v)} />
            <div className="space-y-2">
              <Label className="text-xs">Number of Copies</Label>
              <Select value={config.printCopies.toString()} onValueChange={v => updateConfig('printCopies', parseInt(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="extras" className="mt-0 space-y-4">
          <SettingsSection title="QR Code" icon={QrCode} description="Digital links">
            <ToggleRow label="Show QR Code" checked={config.showQrCode} onChange={v => updateConfig('showQrCode', v)} />
            {config.showQrCode && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">QR Destination</Label>
                  <Select value={config.qrCodeTarget} onValueChange={v => updateConfig('qrCodeTarget', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order-link">Order Tracking</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="review-link">Review Page</SelectItem>
                      <SelectItem value="survey">Survey</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {config.qrCodeTarget !== 'order-link' && (
                  <Input value={config.qrCodeCustomUrl || ''} onChange={e => updateConfig('qrCodeCustomUrl', e.target.value)} placeholder="https://..." className="h-8 text-xs" />
                )}
              </>
            )}
            <ToggleRow label="Show Barcode" checked={config.showBarcode} onChange={v => updateConfig('showBarcode', v)} />
          </SettingsSection>

          <SettingsSection title="Customer Engagement" icon={Users} description="Loyalty & feedback">
            <ToggleRow label="Loyalty Points" checked={config.showLoyaltyPoints} onChange={v => updateConfig('showLoyaltyPoints', v)} />
            <ToggleRow label="Loyalty Balance" checked={config.showLoyaltyBalance} onChange={v => updateConfig('showLoyaltyBalance', v)} />
            <ToggleRow label="Next Visit Promo" checked={config.showNextVisitPromo} onChange={v => updateConfig('showNextVisitPromo', v)} />
            {config.showNextVisitPromo && (
              <Input value={config.nextVisitPromoText} onChange={e => updateConfig('nextVisitPromoText', e.target.value)} className="h-8 text-xs" />
            )}
            <ToggleRow label="Survey QR" checked={config.showSurveyQr} onChange={v => updateConfig('showSurveyQr', v)} />
            {config.showSurveyQr && (
              <Input value={config.surveyUrl} onChange={e => updateConfig('surveyUrl', e.target.value)} placeholder="https://survey..." className="h-8 text-xs" />
            )}
          </SettingsSection>

          <SettingsSection title="Social Media" icon={Globe} description="Social handles" defaultOpen={false}>
            <ToggleRow label="Show Social Media" checked={config.showSocialMedia} onChange={v => updateConfig('showSocialMedia', v)} />
            {config.showSocialMedia && (
              <Input value={config.socialMediaHandle} onChange={e => updateConfig('socialMediaHandle', e.target.value)} placeholder="@yourhandle" className="h-8 text-xs" />
            )}
          </SettingsSection>
        </TabsContent>
      </div>
    </Tabs>
  );
}

// Kitchen Settings Component
function KitchenSettings({ config, updateConfig }: { config: KitchenTicketConfig; updateConfig: (key: keyof KitchenTicketConfig, value: any) => void }) {
  return (
    <Tabs defaultValue="layout" className="w-full">
      <div className="sticky top-0 z-10 bg-card border-b px-4 pt-3">
        <TabsList className="w-full grid grid-cols-5 mb-3 h-9">
          <TabsTrigger value="layout" className="text-xs">Layout</TabsTrigger>
          <TabsTrigger value="content" className="text-xs">Content</TabsTrigger>
          <TabsTrigger value="stations" className="text-xs">Stations</TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs">Alerts</TabsTrigger>
          <TabsTrigger value="print" className="text-xs">Print</TabsTrigger>
        </TabsList>
      </div>

      <div className="p-4 space-y-4">
        <TabsContent value="layout" className="mt-0 space-y-4">
          <SettingsSection title="Paper & Typography" icon={Layout} description="Size and fonts">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Paper Size</Label>
                <Select value={config.paperSize} onValueChange={v => updateConfig('paperSize', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80mm">80mm (Standard)</SelectItem>
                    <SelectItem value="58mm">58mm (Compact)</SelectItem>
                    <SelectItem value="A5">A5 (Large)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Font Size</Label>
                <Select value={config.fontSize} onValueChange={v => updateConfig('fontSize', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large (Visible)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Visual Options" icon={Palette} description="Display style">
            <ToggleRow label="Compact Mode" description="Reduce spacing" checked={config.compactMode} onChange={v => updateConfig('compactMode', v)} />
            <ToggleRow label="Large Quantity Display" description="Big numbers for qty" checked={config.largeQuantityDisplay} onChange={v => updateConfig('largeQuantityDisplay', v)} />
            <ToggleRow label="Item Separators" checked={config.showItemSeparators} onChange={v => updateConfig('showItemSeparators', v)} />
            <ToggleRow label="Category Headers" checked={config.showCategoryHeaders} onChange={v => updateConfig('showCategoryHeaders', v)} />
          </SettingsSection>

          <SettingsSection title="Header & Footer" icon={FileText} description="Ticket text" defaultOpen={false}>
            <div className="space-y-2">
              <Label className="text-xs">Header Text</Label>
              <Input value={config.headerText} onChange={e => updateConfig('headerText', e.target.value)} placeholder="KITCHEN ORDER" className="h-8 text-xs" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Footer Text</Label>
              <Input value={config.footerText} onChange={e => updateConfig('footerText', e.target.value)} placeholder="Optional footer..." className="h-8 text-xs" />
            </div>
          </SettingsSection>
        </TabsContent>

        <TabsContent value="content" className="mt-0 space-y-4">
          <SettingsSection title="Order Information" icon={FileText} description="What to display">
            <ToggleRow label="Timestamp" checked={config.showTime} onChange={v => updateConfig('showTime', v)} />
            <ToggleRow label="Order Type" checked={config.showOrderType} onChange={v => updateConfig('showOrderType', v)} />
            <ToggleRow label="Table Number" checked={config.showTable} onChange={v => updateConfig('showTable', v)} />
            <ToggleRow label="Customer Name" checked={config.showCustomerName} onChange={v => updateConfig('showCustomerName', v)} />
            <ToggleRow label="Server Name" checked={config.showServerName} onChange={v => updateConfig('showServerName', v)} />
            <ToggleRow label="Sequence Number" description="Order # in queue" checked={config.showSequenceNumber} onChange={v => updateConfig('showSequenceNumber', v)} />
          </SettingsSection>

          <SettingsSection title="Items Display" icon={Utensils} description="Product details">
            <ToggleRow label="Show Prices" checked={config.showPrices} onChange={v => updateConfig('showPrices', v)} />
            <ToggleRow label="Show Notes" checked={config.showNotes} onChange={v => updateConfig('showNotes', v)} />
            <ToggleRow label="Modifiers Separately" description="Show variants on new line" checked={config.showModifiersSeparately} onChange={v => updateConfig('showModifiersSeparately', v)} />
          </SettingsSection>

          <SettingsSection title="Time Management" icon={Clock} description="Order timing">
            <ToggleRow label="Order Age" description="Time since order" checked={config.showOrderAge} onChange={v => updateConfig('showOrderAge', v)} />
            <ToggleRow label="Estimated Prep Time" checked={config.showEstimatedPrepTime} onChange={v => updateConfig('showEstimatedPrepTime', v)} />
          </SettingsSection>
        </TabsContent>

        <TabsContent value="stations" className="mt-0 space-y-4">
          <SettingsSection title="Station Routing" icon={ChefHat} description="Kitchen stations">
            <ToggleRow label="Enable Station Routing" description="Route to specific stations" checked={config.enableStationRouting} onChange={v => updateConfig('enableStationRouting', v)} />
            {config.enableStationRouting && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Available Stations</Label>
                  <div className="flex flex-wrap gap-2">
                    {config.stations.map((station, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{station}</Badge>
                    ))}
                  </div>
                  <Input 
                    placeholder="Add station (press Enter)" 
                    className="h-8 text-xs mt-2"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value) {
                        updateConfig('stations', [...config.stations, e.currentTarget.value]);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Default Station</Label>
                  <Select value={config.defaultStation} onValueChange={v => updateConfig('defaultStation', v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {config.stations.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <ToggleRow label="Print to All Stations" description="Send copies everywhere" checked={config.printToAllStations} onChange={v => updateConfig('printToAllStations', v)} />
              </>
            )}
          </SettingsSection>
        </TabsContent>

        <TabsContent value="alerts" className="mt-0 space-y-4">
          <SettingsSection title="Priority & Rush Orders" icon={AlertTriangle} description="Urgent order handling">
            <ToggleRow label="Show Priority" checked={config.showPriority} onChange={v => updateConfig('showPriority', v)} />
            <ToggleRow label="Highlight Rush Orders" description="Visual highlight for delayed orders" checked={config.highlightRushOrders} onChange={v => updateConfig('highlightRushOrders', v)} />
            {config.highlightRushOrders && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Rush Threshold (minutes)</Label>
                  <Select value={config.rushOrderThresholdMinutes.toString()} onValueChange={v => updateConfig('rushOrderThresholdMinutes', parseInt(v))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 10, 15, 20, 30].map(n => <SelectItem key={n} value={n.toString()}>{n} min</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Rush Color</Label>
                  <div className="flex gap-2">
                    <input type="color" value={config.rushOrderColor} onChange={e => updateConfig('rushOrderColor', e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
                    <Input value={config.rushOrderColor} onChange={e => updateConfig('rushOrderColor', e.target.value)} className="h-8 text-xs flex-1" />
                  </div>
                </div>
              </>
            )}
          </SettingsSection>

          <SettingsSection title="Allergen & Dietary" icon={AlertTriangle} description="Food safety alerts">
            <ToggleRow label="Show Allergens" description="Highlight allergen warnings" checked={config.showAllergens} onChange={v => updateConfig('showAllergens', v)} />
            <ToggleRow label="Dietary Icons" description="V, VG, GF labels" checked={config.showDietaryIcons} onChange={v => updateConfig('showDietaryIcons', v)} />
            {config.showAllergens && (
              <div className="space-y-2">
                <Label className="text-xs">Allergen Highlight Color</Label>
                <div className="flex gap-2">
                  <input type="color" value={config.allergenHighlightColor} onChange={e => updateConfig('allergenHighlightColor', e.target.value)} className="w-10 h-8 rounded cursor-pointer" />
                  <Input value={config.allergenHighlightColor} onChange={e => updateConfig('allergenHighlightColor', e.target.value)} className="h-8 text-xs flex-1" />
                </div>
              </div>
            )}
          </SettingsSection>
        </TabsContent>

        <TabsContent value="print" className="mt-0 space-y-4">
          <SettingsSection title="Print Automation" icon={Printer} description="Auto-print settings">
            <ToggleRow label="Auto-print New Orders" description="Print immediately when order created" checked={config.autoPrintNewOrders} onChange={v => updateConfig('autoPrintNewOrders', v)} />
            <ToggleRow label="Auto-print Completed" description="Print when order completed" checked={config.autoPrintCompleted} onChange={v => updateConfig('autoPrintCompleted', v)} />
            <div className="space-y-2">
              <Label className="text-xs">Print Delay (seconds)</Label>
              <Select value={config.printDelaySeconds.toString()} onValueChange={v => updateConfig('printDelaySeconds', parseInt(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 3, 5, 10].map(n => <SelectItem key={n} value={n.toString()}>{n === 0 ? 'Immediate' : `${n}s`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Number of Copies</Label>
              <Select value={config.printCopies.toString()} onValueChange={v => updateConfig('printCopies', parseInt(v))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </SettingsSection>

          <SettingsSection title="Audio Alerts" icon={Bell} description="Sound notifications">
            <ToggleRow label="Sound on New Order" description="Audio alert when ticket prints" checked={config.soundAlertOnNewOrder} onChange={v => updateConfig('soundAlertOnNewOrder', v)} />
          </SettingsSection>
        </TabsContent>
      </div>
    </Tabs>
  );
}