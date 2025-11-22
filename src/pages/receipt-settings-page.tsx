'use client';

import { useState, useEffect } from 'react';
import { usePosStore, type ReceiptConfig } from '@/store/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ReceiptPreview } from '@/components/receipt-preview';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ReceiptPdfDocument } from '@/components/receipt-pdf';
import {
  Download,
  Printer,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  Type,
  ImageIcon,
  LayoutTemplate,
  ZoomIn,
  ZoomOut,
  Building2,
  QrCode,
} from 'lucide-react';
import QRCode from 'qrcode';
import { format } from 'date-fns';

export function ReceiptSettingsPage() {
  const settings = usePosStore(state => state.settings);
  const receiptConfig = usePosStore(state => state.settings.receiptConfig);
  const updateReceiptConfig = usePosStore(state => state.updateReceiptConfig);
  const orders = usePosStore(state => state.orders);

  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [previewScale, setPreviewScale] = useState([100]);

  // Default Fallback Config
  const defaultConfig: ReceiptConfig = {
    showLogo: true,
    logoUrl: '',
    logoWidth: 50,
    logoPosition: 'center',
    headerText: 'Thank you for your purchase!',
    footerText: 'Please come again',
    showAddress: true,
    address: '123 Enterprise Blvd, Tech City',
    showPhone: true,
    phone: '+1 234 567 8900',
    showEmail: true,
    email: 'support@enterprise.com',
    showTaxNumber: true,
    taxNumber: 'VAT-999888777',
    showWebsite: true,
    website: 'www.enterprise.com',
    showSocialMedia: false,
    socialMediaHandle: '@dealio_erp',
    showReturnPolicy: false,
    returnPolicyText: 'Returns accepted within 7 days with original receipt.',
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
    showBarcode: true,
    showQrCode: true,
    qrCodeTarget: 'order-link',
  };

  const [config, setConfig] = useState<ReceiptConfig>({ ...defaultConfig, ...receiptConfig });

  // Sync with store
  useEffect(() => {
    if (receiptConfig) setConfig(prev => ({ ...prev, ...receiptConfig }));
  }, [receiptConfig]);

  const updateConfig = (key: keyof ReceiptConfig, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    updateReceiptConfig(newConfig);
  };

  // Mock Order
  const sampleOrder = orders[0] || {
    id: 'sample',
    orderNumber: '#ORD-99281',
    customerName: 'Acme Corp Ltd.',
    orderType: 'Delivery',
    status: 'completed',
    items: [
      {
        productId: '1',
        productName: 'Enterprise Server Rack',
        variantName: '42U Standard',
        sku: 'SRK-42U',
        selectedUnit: { unitName: 'Unit', price: 1200 },
        quantity: 1,
        note: 'Handle with care',
      },
      {
        productId: '2',
        productName: 'Cooling Unit',
        variantName: 'Liquid Cooled',
        sku: 'CL-001',
        selectedUnit: { unitName: 'Pc', price: 450 },
        quantity: 2,
      },
    ],
    createdAt: new Date(),
    subTotal: 2100,
    discount: 100,
    taxes: 210,
    total: 2210,
    paymentMethod: 'Credit Card (**** 4242)',
    cashierName: 'Sarah J.',
  };

  // Generate PDF QR
  useEffect(() => {
    if (config.showQrCode) {
      const qrData =
        config.qrCodeTarget === 'website' && config.qrCodeCustomUrl
          ? config.qrCodeCustomUrl
          : JSON.stringify({ id: sampleOrder.orderNumber, tot: sampleOrder.total });

      QRCode.toDataURL(qrData, { width: 100, margin: 1 }).then(url => setQrCodeDataUrl(url));
    } else {
      setQrCodeDataUrl('');
    }
  }, [config.showQrCode, config.qrCodeTarget, config.qrCodeCustomUrl, sampleOrder]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background/50">
      <div className="px-6 py-4 bg-background border-b flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Printer className="w-5 h-5" /> Receipt Designer
          </h1>
          <p className="text-muted-foreground text-xs">Configure template for thermal & PDF output</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setConfig(defaultConfig)}>
          <RotateCcw className="w-3.5 h-3.5 mr-2" /> Reset
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* Settings Sidebar */}
          <div className="lg:col-span-7 h-full overflow-y-auto p-6 lg:border-r bg-background scrollbar-thin">
            <Tabs defaultValue="branding" className="w-full space-y-6">
              <TabsList className="grid w-full grid-cols-4 p-1 bg-muted/50">
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="layout">Layout</TabsTrigger>
                <TabsTrigger value="content">Content</TabsTrigger>
                <TabsTrigger value="enterprise">Enterprise</TabsTrigger>
              </TabsList>

              {/* Branding */}
              <TabsContent value="branding" className="space-y-5">
                <Card className="border-none shadow-none p-0">
                  <CardContent className="px-0 space-y-6">
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
                      <div>
                        <Label>Show Logo</Label>
                      </div>
                      <Switch checked={config.showLogo} onCheckedChange={c => updateConfig('showLogo', c)} />
                    </div>
                    {config.showLogo && (
                      <div className="grid gap-4 p-4 border rounded-lg">
                        <div className="grid gap-2">
                          <Label>Logo URL</Label>
                          <Input
                            value={config.logoUrl}
                            onChange={e => updateConfig('logoUrl', e.target.value)}
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Size & Position</Label>
                          <Slider
                            value={[config.logoWidth]}
                            max={100}
                            min={20}
                            step={5}
                            onValueChange={v => updateConfig('logoWidth', v[0])}
                          />
                          <div className="flex gap-2 mt-2">
                            {['left', 'center', 'right'].map(pos => (
                              <Button
                                key={pos}
                                size="sm"
                                variant={config.logoPosition === pos ? 'default' : 'outline'}
                                onClick={() => updateConfig('logoPosition', pos)}
                                className="capitalize flex-1"
                              >
                                {pos}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label>Header Message</Label>
                        <Textarea
                          value={config.headerText}
                          onChange={e => updateConfig('headerText', e.target.value)}
                          rows={2}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Footer Message</Label>
                        <Textarea
                          value={config.footerText}
                          onChange={e => updateConfig('footerText', e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Layout */}
              <TabsContent value="layout" className="space-y-6">
                <Card className="border-none shadow-none p-0">
                  <CardContent className="px-0 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Font Family</Label>
                        <Select value={config.fontFamily} onValueChange={v => updateConfig('fontFamily', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="monospace">Monospace</SelectItem>
                            <SelectItem value="sans">Sans Serif</SelectItem>
                            <SelectItem value="serif">Serif</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label>Font Size</Label>
                        <Select value={config.fontSize} onValueChange={v => updateConfig('fontSize', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Text Alignment</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={config.textAlignment === 'left' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => updateConfig('textAlignment', 'left')}
                        >
                          <AlignLeft className="w-4 h-4 mr-2" /> Left
                        </Button>
                        <Button
                          variant={config.textAlignment === 'center' ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => updateConfig('textAlignment', 'center')}
                        >
                          <AlignCenter className="w-4 h-4 mr-2" /> Center
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Paper Size</Label>
                      <Select value={config.paperSize} onValueChange={v => updateConfig('paperSize', v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="80mm">80mm (Standard)</SelectItem>
                          <SelectItem value="58mm">58mm (Mobile)</SelectItem>
                          <SelectItem value="Letter">A4 / Letter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Content */}
              <TabsContent value="content" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <LayoutTemplate className="w-4 h-4" /> Item Details
                    </h3>
                    <div className="flex justify-between items-center">
                      <Label className="font-normal">Show SKU</Label>
                      <Switch checked={config.showItemSku} onCheckedChange={c => updateConfig('showItemSku', c)} />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label className="font-normal">Show Notes</Label>
                      <Switch checked={config.showItemNotes} onCheckedChange={c => updateConfig('showItemNotes', c)} />
                    </div>
                  </div>
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <Building2 className="w-4 h-4" /> Contact Info
                    </h3>
                    <div className="flex justify-between items-center">
                      <Label className="font-normal">Show Address</Label>
                      <Switch checked={config.showAddress} onCheckedChange={c => updateConfig('showAddress', c)} />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label className="font-normal">Show Phone</Label>
                      <Switch checked={config.showPhone} onCheckedChange={c => updateConfig('showPhone', c)} />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label className="font-normal">Show Tax ID</Label>
                      <Switch checked={config.showTaxNumber} onCheckedChange={c => updateConfig('showTaxNumber', c)} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Enterprise */}
              <TabsContent value="enterprise" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Metadata */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-medium text-sm">Transaction Metadata</h3>
                    <div className="flex justify-between items-center">
                      <Label className="font-normal">Show Cashier</Label>
                      <Switch checked={config.showCashier} onCheckedChange={c => updateConfig('showCashier', c)} />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label className="font-normal">Show Customer</Label>
                      <Switch
                        checked={config.showCustomerName}
                        onCheckedChange={c => updateConfig('showCustomerName', c)}
                      />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label className="font-normal">Show Order Type</Label>
                      <Switch checked={config.showOrderType} onCheckedChange={c => updateConfig('showOrderType', c)} />
                    </div>
                    <div className="flex justify-between items-center">
                      <Label className="font-normal">Show Payment Method</Label>
                      <Switch
                        checked={config.showPaymentMethod}
                        onCheckedChange={c => updateConfig('showPaymentMethod', c)}
                      />
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="border rounded-lg p-4 space-y-4">
                    <h3 className="font-medium text-sm flex gap-2 items-center">
                      <QrCode className="w-4 h-4" /> QR Functionality
                    </h3>
                    <div className="flex justify-between items-center">
                      <Label className="font-normal">Enable QR</Label>
                      <Switch checked={config.showQrCode} onCheckedChange={c => updateConfig('showQrCode', c)} />
                    </div>
                    {config.showQrCode && (
                      <div className="space-y-2">
                        <Label className="text-xs">QR Target</Label>
                        <Select value={config.qrCodeTarget} onValueChange={v => updateConfig('qrCodeTarget', v)}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="order-link">Track Order Status</SelectItem>
                            <SelectItem value="review-link">Leave a Review</SelectItem>
                            <SelectItem value="website">Custom Website</SelectItem>
                          </SelectContent>
                        </Select>
                        {(config.qrCodeTarget === 'website' || config.qrCodeTarget === 'review-link') && (
                          <Input
                            placeholder="https://..."
                            value={config.qrCodeCustomUrl}
                            onChange={e => updateConfig('qrCodeCustomUrl', e.target.value)}
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Policies & Socials */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between border-b pb-4">
                    <div className="space-y-0.5">
                      <Label>Return Policy</Label>
                      <p className="text-xs text-muted-foreground">Print specific return instructions</p>
                    </div>
                    <Switch
                      checked={config.showReturnPolicy}
                      onCheckedChange={c => updateConfig('showReturnPolicy', c)}
                    />
                  </div>
                  {config.showReturnPolicy && (
                    <Textarea
                      value={config.returnPolicyText}
                      onChange={e => updateConfig('returnPolicyText', e.target.value)}
                    />
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="space-y-0.5">
                      <Label>Social Media</Label>
                      <p className="text-xs text-muted-foreground">Show handle at bottom</p>
                    </div>
                    <Switch
                      checked={config.showSocialMedia}
                      onCheckedChange={c => updateConfig('showSocialMedia', c)}
                    />
                  </div>
                  {config.showSocialMedia && (
                    <Input
                      value={config.socialMediaHandle}
                      onChange={e => updateConfig('socialMediaHandle', e.target.value)}
                      placeholder="@your_handle"
                    />
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Live Preview Panel */}
          <div className="lg:col-span-5 bg-neutral-100 h-full border-l relative flex flex-col overflow-hidden">
            <div className="p-3 border-b bg-white flex items-center justify-between z-10 shadow-sm">
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-muted-foreground">PREVIEW</span>
                <div className="flex items-center gap-2 w-32">
                  <ZoomOut className="w-3 h-3 text-muted-foreground" />
                  <Slider
                    value={previewScale}
                    min={50}
                    max={150}
                    step={10}
                    onValueChange={setPreviewScale}
                    className="w-full"
                  />
                  <ZoomIn className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
              <PDFDownloadLink
                document={
                  <ReceiptPdfDocument
                    order={sampleOrder}
                    settings={{ ...settings, receiptConfig: config }}
                    qrCodeUrl={qrCodeDataUrl}
                  />
                }
                fileName={`receipt-${sampleOrder.orderNumber}.pdf`}
              >
                {({ loading }) => (
                  <Button size="sm" disabled={loading} className="h-8 text-xs">
                    {loading ? (
                      'Generating...'
                    ) : (
                      <>
                        <Download className="w-3 h-3 mr-2" /> PDF
                      </>
                    )}
                  </Button>
                )}
              </PDFDownloadLink>
            </div>

            <div className="flex-1 overflow-auto p-8 flex items-start justify-center">
              <div
                className="origin-top shadow-2xl transition-all duration-300 ease-out bg-white"
                style={{
                  transform: `scale(${previewScale[0] / 100})`,
                  width: config.paperSize === '80mm' ? '370px' : config.paperSize === '58mm' ? '280px' : '500px',
                }}
              >
                <ReceiptPreview order={sampleOrder} settings={{ ...settings, receiptConfig: config }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
