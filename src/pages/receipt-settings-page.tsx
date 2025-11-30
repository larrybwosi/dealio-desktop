'use client';

import { useState, useEffect } from 'react';
import { usePosStore, type ReceiptConfig } from '@/store/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReceiptPreview } from '@/components/receipt-preview';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ReceiptPdfDocument } from '@/components/receipt-pdf';
import {
  Download,
  Printer,
  RotateCcw,
  Layout,
  FileText,
  QrCode,
  ZoomIn,
  ZoomOut,
  Palette,
  Store
} from 'lucide-react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';

// --- Types & Presets ---
const PRESETS = {
  standard: { template: 'standard', fontFamily: 'monospace', textAlignment: 'center', fontSize: 'medium' },
  minimal: { template: 'minimal', fontFamily: 'sans', textAlignment: 'left', fontSize: 'small', showBorder: false },
  modern: { template: 'modern', fontFamily: 'sans', textAlignment: 'center', fontSize: 'medium', showBorder: false },
};

export function ReceiptSettingsPage() {
  const settings = usePosStore(state => state.settings);
  const receiptConfig = usePosStore(state => state.settings.receiptConfig);
  const updateReceiptConfig = usePosStore(state => state.updateReceiptConfig);
  const orders = usePosStore(state => state.orders);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [previewScale, setPreviewScale] = useState([90]);
  const [previewBg, setPreviewBg] = useState<'light' | 'dark'>('dark');

  // Default Fallback
  const defaultConfig: ReceiptConfig = {
    showLogo: true,
    logoUrl: '',
    logoWidth: 50,
    logoPosition: 'center',
    headerText: 'Thank you for your business!',
    footerText: 'Please retain this receipt for your records.',
    showAddress: true,
    address: '123 Main St, City, Country',
    showPhone: true,
    phone: '(555) 123-4567',
    showEmail: false,
    email: '',
    showTaxNumber: true,
    taxNumber: 'TAX-123456',
    showWebsite: true,
    website: 'www.example.com',
    showSocialMedia: false,
    socialMediaHandle: '',
    showReturnPolicy: false,
    returnPolicyText: 'Returns within 30 days.',
    paperSize: '80mm',
    fontFamily: 'monospace',
    fontSize: 'medium',
    textAlignment: 'center',
    marginHorizontal: 0,
    dateFormat: 'yyyy-MM-dd HH:mm',
    showCashier: true,
    showCustomerName: true,
    showOrderType: true,
    showPaymentMethod: true,
    showItemSku: false,
    showItemNotes: true,
    showBarcode: false,
    showQrCode: true,
    qrCodeTarget: 'order-link',
    template: 'standard',
    showBorder: false,
    borderColor: '#000000',
  };

  const [config, setConfig] = useState<ReceiptConfig>({ ...defaultConfig, ...receiptConfig });

  useEffect(() => {
    if (receiptConfig) setConfig(prev => ({ ...prev, ...receiptConfig }));
  }, [receiptConfig]);

  const updateConfig = (key: keyof ReceiptConfig, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    updateReceiptConfig(newConfig);
  };

  const applyPreset = (presetName: keyof typeof PRESETS) => {
    const preset = PRESETS[presetName];
    const newConfig = { ...config, ...preset };
    // @ts-ignore
    setConfig(newConfig);
    // @ts-ignore
    updateReceiptConfig(newConfig);
  };

  // Mock Data for Preview
  const sampleOrder = orders[0] || {
    id: 'sample',
    orderNumber: 'ORD-001',
    customerName: 'Guest Customer',
    items: [
      { productName: 'Espresso', variantName: 'Double', quantity: 1, selectedUnit: { price: 3.5 } },
      { productName: 'Croissant', quantity: 2, selectedUnit: { price: 4.0 } },
    ],
    subTotal: 11.5,
    discount: 0,
    taxes: 1.15,
    total: 12.65,
    createdAt: new Date(),
    paymentMethod: 'Credit Card',
    cashierName: 'John Doe',
  };

  // Generate QR for PDF download link
  useEffect(() => {
    if (config.showQrCode) {
      QRCode.toDataURL('https://example.com', { width: 100, margin: 1 }).then(setQrCodeDataUrl);
    }
  }, [config.showQrCode]);

  return (
    <div className="flex h-full w-full bg-background overflow-hidden">
      {/* --- Left Panel: Settings --- */}
      <div className="w-full lg:w-[450px] xl:w-[500px] flex flex-col border-r bg-card h-full">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-background z-10">
          <div>
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" /> Receipt Studio
            </h2>
            <p className="text-xs text-muted-foreground">Customize your thermal output</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setConfig(defaultConfig)} title="Reset">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable Settings */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <Tabs defaultValue="appearance" className="w-full">
            <div className="sticky top-0 z-10 bg-card border-b px-4 pt-2">
              <TabsList className="w-full grid grid-cols-4 mb-2">
                <TabsTrigger value="appearance">Style</TabsTrigger>
                <TabsTrigger value="info">Info</TabsTrigger>
                <TabsTrigger value="items">Items</TabsTrigger>
                <TabsTrigger value="extra">Extra</TabsTrigger>
              </TabsList>
            </div>

            <div className="p-4 space-y-6">
              {/* --- APPEARANCE --- */}
              <TabsContent value="appearance" className="space-y-6 mt-0">
                {/* Presets */}
                <div className="grid grid-cols-3 gap-2">
                   {Object.keys(PRESETS).map((p) => (
                     <Button 
                       key={p} 
                       variant="outline" 
                       size="sm" 
                       onClick={() => applyPreset(p as any)}
                       className={cn("capitalize text-xs", config.template === p && "border-primary bg-primary/5 ring-1 ring-primary")}
                     >
                       {p}
                     </Button>
                   ))}
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Layout className="w-4 h-4" /> Layout & Typography
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Font Family</Label>
                        <Select value={config.fontFamily} onValueChange={v => updateConfig('fontFamily', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monospace">Monospace (Code)</SelectItem>
                            <SelectItem value="sans">Sans Serif (Clean)</SelectItem>
                            <SelectItem value="serif">Serif (Classic)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Font Size</Label>
                        <Select value={config.fontSize} onValueChange={v => updateConfig('fontSize', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Small (Eco)</SelectItem>
                            <SelectItem value="medium">Medium (Standard)</SelectItem>
                            <SelectItem value="large">Large (Accessible)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                         <Label className="text-xs">Alignment</Label>
                         <div className="flex rounded-md border p-1 bg-muted/20">
                           <Button 
                             variant={config.textAlignment === 'left' ? 'secondary' : 'ghost'} 
                             size="sm" className="h-6 flex-1 text-xs"
                             onClick={() => updateConfig('textAlignment', 'left')}>Left</Button>
                           <Button 
                             variant={config.textAlignment === 'center' ? 'secondary' : 'ghost'} 
                             size="sm" className="h-6 flex-1 text-xs"
                             onClick={() => updateConfig('textAlignment', 'center')}>Center</Button>
                         </div>
                      </div>
                       <div className="space-y-2">
                        <Label className="text-xs">Paper Width</Label>
                        <Select value={config.paperSize} onValueChange={v => updateConfig('paperSize', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="80mm">80mm (Standard)</SelectItem>
                            <SelectItem value="58mm">58mm (Narrow)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                     <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Palette className="w-4 h-4" /> Branding
                      </CardTitle>
                      <Switch checked={config.showLogo} onCheckedChange={c => updateConfig('showLogo', c)} />
                     </div>
                  </CardHeader>
                  {config.showLogo && (
                    <CardContent className="grid gap-4 animate-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Logo URL</Label>
                        <Input 
                           value={config.logoUrl} 
                           onChange={e => updateConfig('logoUrl', e.target.value)} 
                           className="h-8 text-xs font-mono"
                           placeholder="https://..."
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                           <Label className="text-xs">Logo Size ({config.logoWidth}%)</Label>
                        </div>
                        <Slider 
                           value={[config.logoWidth]} 
                           min={20} max={100} step={5}
                           onValueChange={v => updateConfig('logoWidth', v[0])} 
                        />
                      </div>
                    </CardContent>
                  )}
                </Card>
              </TabsContent>

              {/* --- INFO --- */}
              <TabsContent value="info" className="space-y-6 mt-0">
                 <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Store className="w-4 h-4" /> Business Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { key: 'showAddress', label: 'Show Address' },
                      { key: 'showPhone', label: 'Show Phone' },
                      { key: 'showEmail', label: 'Show Email' },
                      { key: 'showWebsite', label: 'Show Website' },
                      { key: 'showTaxNumber', label: 'Show Tax ID' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between">
                        <Label className="text-xs font-normal text-muted-foreground">{item.label}</Label>
                        <Switch 
                          checked={(config as any)[item.key]} 
                          onCheckedChange={c => updateConfig(item.key as any, c)} 
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="space-y-2">
                   <Label className="text-xs font-medium">Header Message</Label>
                   <Textarea 
                      value={config.headerText} 
                      onChange={e => updateConfig('headerText', e.target.value)}
                      className="text-xs resize-none" rows={3}
                   />
                </div>
                 <div className="space-y-2">
                   <Label className="text-xs font-medium">Footer Message</Label>
                   <Textarea 
                      value={config.footerText} 
                      onChange={e => updateConfig('footerText', e.target.value)}
                      className="text-xs resize-none" rows={3}
                   />
                </div>
              </TabsContent>

              {/* --- ITEMS & METADATA --- */}
              <TabsContent value="items" className="space-y-6 mt-0">
                 <Card>
                   <CardHeader className="pb-3">
                     <CardTitle className="text-sm font-medium flex items-center gap-2">
                       <FileText className="w-4 h-4" /> Transaction Data
                     </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-3">
                     {[
                       { key: 'showCustomerName', label: 'Customer Name' },
                       { key: 'showCashier', label: 'Cashier / Server Name' },
                       { key: 'showOrderType', label: 'Order Type (Dine-in/To-Go)' },
                       { key: 'showPaymentMethod', label: 'Payment Method' },
                       { key: 'showItemSku', label: 'Product SKU' },
                       { key: 'showItemNotes', label: 'Item Notes / Modifiers' },
                     ].map((item) => (
                       <div key={item.key} className="flex items-center justify-between">
                         <Label className="text-xs font-normal text-muted-foreground">{item.label}</Label>
                         <Switch 
                           checked={(config as any)[item.key]} 
                           onCheckedChange={c => updateConfig(item.key as any, c)} 
                         />
                       </div>
                     ))}
                   </CardContent>
                 </Card>
              </TabsContent>

              {/* --- EXTRA --- */}
              <TabsContent value="extra" className="space-y-6 mt-0">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <QrCode className="w-4 h-4" /> QR Code
                      </CardTitle>
                      <Switch checked={config.showQrCode} onCheckedChange={c => updateConfig('showQrCode', c)} />
                    </div>
                  </CardHeader>
                  {config.showQrCode && (
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                         <Label className="text-xs">Link Destination</Label>
                         <Select value={config.qrCodeTarget} onValueChange={v => updateConfig('qrCodeTarget', v)}>
                           <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                           <SelectContent>
                             <SelectItem value="order-link">Order Tracking</SelectItem>
                             <SelectItem value="website">Website URL</SelectItem>
                             <SelectItem value="review-link">Review Page</SelectItem>
                           </SelectContent>
                         </Select>
                      </div>
                      {config.qrCodeTarget !== 'order-link' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Custom URL</Label>
                          <Input 
                            value={config.qrCodeCustomUrl} 
                            onChange={e => updateConfig('qrCodeCustomUrl', e.target.value)}
                            placeholder="https://..." 
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Social Media</CardTitle>
                      <Switch checked={config.showSocialMedia} onCheckedChange={c => updateConfig('showSocialMedia', c)} />
                    </div>
                  </CardHeader>
                  {config.showSocialMedia && (
                     <CardContent>
                       <Input 
                         value={config.socialMediaHandle} 
                         onChange={e => updateConfig('socialMediaHandle', e.target.value)}
                         placeholder="@yourhandle"
                         className="h-8 text-xs"
                       />
                     </CardContent>
                  )}
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* --- Right Panel: Interactive Preview --- */}
      <div className={cn(
        "flex-1 relative flex flex-col transition-colors duration-300",
        previewBg === 'dark' ? "bg-neutral-900" : "bg-neutral-100"
      )}>
        {/* Floating Toolbar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-background/90 backdrop-blur border shadow-lg rounded-full p-1.5 px-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-6 h-6 rounded-full"
            onClick={() => setPreviewScale(p => [Math.max(50, p[0] - 10)])}
          >
            <ZoomOut className="w-3 h-3" />
          </Button>
          <span className="text-[10px] font-mono w-8 text-center">{previewScale}%</span>
          <Button 
            variant="ghost" 
            size="icon" 
            className="w-6 h-6 rounded-full"
            onClick={() => setPreviewScale(p => [Math.min(150, p[0] + 10)])}
          >
            <ZoomIn className="w-3 h-3" />
          </Button>
          <div className="w-px h-3 bg-border mx-1" />
          <Button 
             variant="ghost" 
             size="icon" 
             className={cn("w-6 h-6 rounded-full", previewBg === 'dark' && "bg-neutral-200 text-black hover:bg-white")}
             onClick={() => setPreviewBg(previewBg === 'dark' ? 'light' : 'dark')}
          >
            {previewBg === 'dark' ? <Layout className="w-3 h-3" /> : <Layout className="w-3 h-3" />}
          </Button>
        </div>

        {/* Action Button */}
        <div className="absolute top-4 right-4 z-20">
             <PDFDownloadLink
                document={
                  <ReceiptPdfDocument
                    order={sampleOrder}
                    settings={{ ...settings, receiptConfig: config }}
                    qrCodeUrl={qrCodeDataUrl}
                  />
                }
                fileName={`receipt-template.pdf`}
              >
                {({ loading }) => (
                  <Button size="sm" disabled={loading} className="shadow-lg">
                    {loading ? 'Processing...' : <><Download className="w-4 h-4 mr-2" /> Download Test PDF</>}
                  </Button>
                )}
              </PDFDownloadLink>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto flex items-start justify-center p-10 pt-20">
          <div 
            className="transition-all duration-200 ease-out origin-top shadow-2xl"
            style={{
               transform: `scale(${previewScale[0] / 100})`,
               width: config.paperSize === '80mm' ? '370px' : '280px',
               marginBottom: '100px'
            }}
          >
            <ReceiptPreview order={sampleOrder} settings={{ ...settings, receiptConfig: config }} />
          </div>
        </div>
      </div>
    </div>
  );
}