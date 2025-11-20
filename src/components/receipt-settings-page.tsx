'use client';

import { useState, useEffect } from 'react';
import { usePosStore } from '@/store/store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ReceiptPreview } from './receipt-preview';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { ReceiptPdfDocument } from './receipt-pdf';
import { Download, Printer, RotateCcw } from 'lucide-react';
import QRCode from 'qrcode';
import { format } from 'date-fns';

export function ReceiptSettingsPage() {
  const settings = usePosStore(state => state.settings);
  const receiptConfig = usePosStore(state => state.settings.receiptConfig);
  const updateReceiptConfig = usePosStore(state => state.updateReceiptConfig);
  const orders = usePosStore(state => state.orders);

  // State for QR generation for PDF
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');

  const [config, setConfig] = useState(
    receiptConfig || {
      showLogo: true,
      logoUrl: '',
      headerText: 'Thank you for your purchase!',
      footerText: 'Please come again',
      showAddress: true,
      address: '123 Main Street, City, Country',
      showPhone: true,
      phone: '+1 234 567 8900',
      showEmail: true,
      email: 'contact@business.com',
      showTaxNumber: true,
      taxNumber: 'TAX-123456789',
      showWebsite: true,
      website: 'www.business.com',
      paperSize: '80mm' as const,
      fontSize: 'medium' as const,
      showBarcode: true,
      showQrCode: false,
    }
  );

  // Sync local state with store
  useEffect(() => {
    if (receiptConfig) setConfig(receiptConfig);
  }, [receiptConfig]);

  // Sample Order Logic
  const sampleOrder = orders[0] || {
    id: 'sample',
    orderNumber: '#123456',
    customerName: 'Sample Customer',
    orderType: 'takeaway' as const,
    status: 'completed' as const,
    items: [
      {
        productId: '1',
        productName: 'Double Cheeseburger',
        variantName: 'Regular',
        selectedUnit: { unitId: '1', unitName: 'Piece', price: 1500, conversion: 1, isBaseUnit: true },
        quantity: 2,
        imageUrl: null,
      },
      {
        productId: '2',
        productName: 'Coke Zero',
        variantName: '330ml',
        selectedUnit: { unitId: '2', unitName: 'Can', price: 350, conversion: 1, isBaseUnit: true },
        quantity: 1,
        imageUrl: null,
      },
    ],
    createdAt: new Date(),
    subTotal: 3350,
    discount: 0,
    taxes: 335,
    total: 3685,
    paymentMethod: 'card',
  };

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    updateReceiptConfig(newConfig);
  };

  // Generate QR Code for the PDF renderer (since PDF renderer can't use <canvas>)
  useEffect(() => {
    if (config.showQrCode) {
      const qrData = JSON.stringify({
        orderNumber: sampleOrder.orderNumber,
        total: sampleOrder.total,
        date: format(new Date(sampleOrder.createdAt), 'yyyy-MM-dd HH:mm'),
      });
      QRCode.toDataURL(qrData, { width: 100, margin: 1, color: { dark: '#000', light: '#FFF' } })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error(err));
    } else {
      setQrCodeDataUrl('');
    }
  }, [config.showQrCode, sampleOrder]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50/50">
      {/* Page Header */}
      <div className="px-8 py-6 bg-white border-b flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Receipt Customization</h1>
          <p className="text-muted-foreground text-sm">Design your physical receipts and test print layouts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setConfig(receiptConfig)}>
            <RotateCcw className="w-4 h-4 mr-2" /> Reset
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-0">
          {/* LEFT: Settings Panel (Scrollable) */}
          <div className="lg:col-span-7 h-full overflow-y-auto p-6 lg:border-r bg-white">
            <Tabs defaultValue="general" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="general">General Info</TabsTrigger>
                <TabsTrigger value="business">Business Details</TabsTrigger>
                <TabsTrigger value="style">Style & Format</TabsTrigger>
              </TabsList>

              {/* --- TAB: GENERAL INFO --- */}
              <TabsContent value="general" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Header & Footer</CardTitle>
                    <CardDescription>Messages displayed at the top and bottom.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="headerText">Header Message</Label>
                      <Textarea
                        id="headerText"
                        value={config.headerText || ''}
                        onChange={e => updateConfig('headerText', e.target.value)}
                        placeholder="e.g. Thank you for dining with us!"
                        rows={2}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="footerText">Footer Message</Label>
                      <Textarea
                        id="footerText"
                        value={config.footerText || ''}
                        onChange={e => updateConfig('footerText', e.target.value)}
                        placeholder="e.g. Returns accepted within 7 days."
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Branding</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label className="text-base">Show Logo</Label>
                        <p className="text-xs text-muted-foreground">Display your business logo</p>
                      </div>
                      <Switch checked={config.showLogo} onCheckedChange={c => updateConfig('showLogo', c)} />
                    </div>
                    {config.showLogo && (
                      <div className="grid gap-2 animate-in fade-in slide-in-from-top-2">
                        <Label htmlFor="logoUrl">Logo URL</Label>
                        <Input
                          id="logoUrl"
                          value={config.logoUrl || ''}
                          onChange={e => updateConfig('logoUrl', e.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* --- TAB: BUSINESS DETAILS --- */}
              <TabsContent value="business" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Contact Information</CardTitle>
                    <CardDescription>Select what contact details appear on the receipt.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    {/* Address */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Show Address</Label>
                        <Switch checked={config.showAddress} onCheckedChange={c => updateConfig('showAddress', c)} />
                      </div>
                      {config.showAddress && (
                        <Input value={config.address} onChange={e => updateConfig('address', e.target.value)} />
                      )}
                    </div>
                    <Separator />
                    {/* Phone */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Show Phone</Label>
                        <Switch checked={config.showPhone} onCheckedChange={c => updateConfig('showPhone', c)} />
                      </div>
                      {config.showPhone && (
                        <Input value={config.phone} onChange={e => updateConfig('phone', e.target.value)} />
                      )}
                    </div>
                    <Separator />
                    {/* Email */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Show Email</Label>
                        <Switch checked={config.showEmail} onCheckedChange={c => updateConfig('showEmail', c)} />
                      </div>
                      {config.showEmail && (
                        <Input value={config.email} onChange={e => updateConfig('email', e.target.value)} />
                      )}
                    </div>
                    <Separator />
                    {/* Website */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Show Website</Label>
                        <Switch checked={config.showWebsite} onCheckedChange={c => updateConfig('showWebsite', c)} />
                      </div>
                      {config.showWebsite && (
                        <Input value={config.website} onChange={e => updateConfig('website', e.target.value)} />
                      )}
                    </div>
                    <Separator />
                    {/* Tax */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Show Tax ID</Label>
                        <Switch
                          checked={config.showTaxNumber}
                          onCheckedChange={c => updateConfig('showTaxNumber', c)}
                        />
                      </div>
                      {config.showTaxNumber && (
                        <Input value={config.taxNumber} onChange={e => updateConfig('taxNumber', e.target.value)} />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* --- TAB: STYLE --- */}
              <TabsContent value="style" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Paper & Typography</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Paper Size</Label>
                        <Select value={config.paperSize} onValueChange={v => updateConfig('paperSize', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="80mm">80mm (Standard Thermal)</SelectItem>
                            <SelectItem value="58mm">58mm (Compact)</SelectItem>
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
                            <SelectItem value="small">Compact</SelectItem>
                            <SelectItem value="medium">Standard</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Codes & Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label className="text-base">Show Barcode</Label>
                        <p className="text-xs text-muted-foreground">Order number barcode</p>
                      </div>
                      <Switch checked={config.showBarcode} onCheckedChange={c => updateConfig('showBarcode', c)} />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <Label className="text-base">Show QR Code</Label>
                        <p className="text-xs text-muted-foreground">Scannable order details</p>
                      </div>
                      <Switch checked={config.showQrCode} onCheckedChange={c => updateConfig('showQrCode', c)} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* RIGHT: Live Preview Panel (Sticky) */}
          <div className="lg:col-span-5 bg-gray-100/50 h-full border-l relative flex flex-col">
            <div className="p-4 border-b bg-white flex items-center justify-between shadow-sm z-10">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">Live Preview</span>
              </div>

              {/* PDF Download Button */}
              <PDFDownloadLink
                document={
                  <ReceiptPdfDocument
                    order={{ ...sampleOrder, createdAt: new Date() }}
                    settings={{ ...settings, receiptConfig: config }}
                    qrCodeUrl={qrCodeDataUrl}
                  />
                }
                fileName={`receipt-${sampleOrder.orderNumber}.pdf`}
              >
                {({ blob, url, loading, error }) => (
                  <Button size="sm" disabled={loading} className="gap-2">
                    {loading ? (
                      'Generating...'
                    ) : (
                      <>
                        <Download className="w-4 h-4" /> Download PDF
                      </>
                    )}
                  </Button>
                )}
              </PDFDownloadLink>
            </div>

            <div className="flex-1 overflow-y-auto p-8 flex justify-center">
              {/* We keep the HTML Preview for the UI because rendering the PDF Viewer 
                  in real-time while typing is slow and flickers. 
                  The user edits via HTML preview, then downloads the PDF.
              */}
              <div className="shadow-2xl origin-top scale-100 transition-all duration-200">
                <ReceiptPreview
                  order={{ ...sampleOrder, createdAt: new Date() }}
                  className="min-h-[400px]" // Ensure it has some height
                />
              </div>
            </div>

            <div className="p-2 text-center text-xs text-muted-foreground bg-gray-100 border-t">
              Previewing on {config.paperSize} paper
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
