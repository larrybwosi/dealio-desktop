"use client"

import { useState, useEffect } from "react"
import { usePosStore } from "@/lib/store"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ReceiptPreview } from "./receipt-preview"

export function ReceiptSettingsPage() {
  const settings = usePosStore((state) => state.settings)
  const receiptConfig = usePosStore((state) => state.settings.receiptConfig)
  const updateReceiptConfig = usePosStore((state) => state.updateReceiptConfig)
  const orders = usePosStore((state) => state.orders)

  const [config, setConfig] = useState(
    receiptConfig || {
      showLogo: true,
      logoUrl: "",
      headerText: "Thank you for your purchase!",
      footerText: "Please come again",
      showAddress: true,
      address: "123 Main Street, City, Country",
      showPhone: true,
      phone: "+1 234 567 8900",
      showEmail: true,
      email: "contact@business.com",
      showTaxNumber: true,
      taxNumber: "TAX-123456789",
      showWebsite: true,
      website: "www.business.com",
      paperSize: "80mm" as const,
      fontSize: "medium" as const,
      showBarcode: true,
      showQrCode: false,
    },
  )

  useEffect(() => {
    if (receiptConfig) {
      setConfig(receiptConfig)
    }
  }, [receiptConfig])

  // Get a sample order for preview
  const sampleOrder = orders[0] || {
    id: "sample",
    orderNumber: "#123456",
    customerName: "Sample Customer",
    orderType: "takeaway" as const,
    status: "completed" as const,
    items: [
      {
        productId: "1",
        productName: "Sample Product",
        variantName: "Regular",
        selectedUnit: { unitId: "1", unitName: "Piece", price: 50000, conversion: 1, isBaseUnit: true },
        quantity: 2,
        imageUrl: null,
      },
    ],
    createdAt: new Date(),
    subTotal: 100000,
    discount: 10000,
    taxes: 1800,
    total: 91800,
    paymentMethod: "cash",
  }

  const updateConfig = (key: string, value: any) => {
    const newConfig = { ...config, [key]: value }
    setConfig(newConfig)
    updateReceiptConfig(newConfig)
  }

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Receipt Settings</h1>
          <p className="text-muted-foreground mt-1">Customize your receipt appearance and information</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Settings Panel */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Receipt Information</h2>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="headerText">Header Text</Label>
                  <Input
                    id="headerText"
                    value={config?.headerText || ""}
                    onChange={(e) => updateConfig("headerText", e.target.value)}
                    placeholder="Thank you for your purchase!"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="footerText">Footer Text</Label>
                  <Input
                    id="footerText"
                    value={config?.footerText || ""}
                    onChange={(e) => updateConfig("footerText", e.target.value)}
                    placeholder="Please come again"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="showLogo">Show Logo</Label>
                    <p className="text-xs text-muted-foreground">Display business logo on receipt</p>
                  </div>
                  <Switch
                    id="showLogo"
                    checked={config?.showLogo || false}
                    onCheckedChange={(checked) => updateConfig("showLogo", checked)}
                  />
                </div>

                {config?.showLogo && (
                  <div className="grid gap-2">
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input
                      id="logoUrl"
                      value={config?.logoUrl || ""}
                      onChange={(e) => updateConfig("logoUrl", e.target.value)}
                      placeholder="https://example.com/logo.png"
                    />
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Business Details</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="showAddress">Show Address</Label>
                  <Switch
                    id="showAddress"
                    checked={config?.showAddress || false}
                    onCheckedChange={(checked) => updateConfig("showAddress", checked)}
                  />
                </div>

                {config?.showAddress && (
                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={config?.address || ""}
                      onChange={(e) => updateConfig("address", e.target.value)}
                      placeholder="123 Main Street, City, Country"
                      rows={3}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="showPhone">Show Phone</Label>
                  <Switch
                    id="showPhone"
                    checked={config?.showPhone || false}
                    onCheckedChange={(checked) => updateConfig("showPhone", checked)}
                  />
                </div>

                {config?.showPhone && (
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={config?.phone || ""}
                      onChange={(e) => updateConfig("phone", e.target.value)}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="showEmail">Show Email</Label>
                  <Switch
                    id="showEmail"
                    checked={config?.showEmail || false}
                    onCheckedChange={(checked) => updateConfig("showEmail", checked)}
                  />
                </div>

                {config?.showEmail && (
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={config?.email || ""}
                      onChange={(e) => updateConfig("email", e.target.value)}
                      placeholder="contact@business.com"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="showWebsite">Show Website</Label>
                  <Switch
                    id="showWebsite"
                    checked={config?.showWebsite || false}
                    onCheckedChange={(checked) => updateConfig("showWebsite", checked)}
                  />
                </div>

                {config?.showWebsite && (
                  <div className="grid gap-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={config?.website || ""}
                      onChange={(e) => updateConfig("website", e.target.value)}
                      placeholder="www.business.com"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="showTaxNumber">Show Tax Number</Label>
                    <p className="text-xs text-muted-foreground">Display business tax number on receipt</p>
                  </div>
                  <Switch
                    id="showTaxNumber"
                    checked={config?.showTaxNumber || false}
                    onCheckedChange={(checked) => updateConfig("showTaxNumber", checked)}
                  />
                </div>

                {config?.showTaxNumber && (
                  <div className="grid gap-2">
                    <Label htmlFor="taxNumber">Tax Number</Label>
                    <Input
                      id="taxNumber"
                      value={config?.taxNumber || ""}
                      onChange={(e) => updateConfig("taxNumber", e.target.value)}
                      placeholder="TAX-123456789"
                    />
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Receipt Format</h2>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="paperSize">Paper Size</Label>
                  <Select
                    value={config?.paperSize || "80mm"}
                    onValueChange={(value: any) => updateConfig("paperSize", value)}
                  >
                    <SelectTrigger id="paperSize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="80mm">80mm (Standard)</SelectItem>
                      <SelectItem value="58mm">58mm (Compact)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="fontSize">Font Size</Label>
                  <Select
                    value={config?.fontSize || "medium"}
                    onValueChange={(value: any) => updateConfig("fontSize", value)}
                  >
                    <SelectTrigger id="fontSize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="showBarcode">Show Barcode</Label>
                    <p className="text-xs text-muted-foreground">Display order barcode</p>
                  </div>
                  <Switch
                    id="showBarcode"
                    checked={config?.showBarcode || false}
                    onCheckedChange={(checked) => updateConfig("showBarcode", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="showQrCode">Show QR Code</Label>
                    <p className="text-xs text-muted-foreground">Display order QR code</p>
                  </div>
                  <Switch
                    id="showQrCode"
                    checked={config?.showQrCode || false}
                    onCheckedChange={(checked) => updateConfig("showQrCode", checked)}
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Preview Panel - Real-time updates */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Receipt Preview</h2>
              <p className="text-sm text-muted-foreground mb-4">Changes update in real-time</p>
              <div className="bg-gray-100 p-6 rounded-lg overflow-auto max-h-[800px]">
                <ReceiptPreview order={{ ...sampleOrder, createdAt: new Date() }} />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
