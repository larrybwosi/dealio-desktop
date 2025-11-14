"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { usePosStore } from "@/store/store"
import { Download, Printer, X, ChefHat } from "lucide-react"
import { ReceiptPreview } from "./receipt-preview"
import { useRef, useState, useEffect } from "react"
import { pdf } from "@react-pdf/renderer"
import { PDFReceipt } from "./pdf-receipt"
import { PDFKitchenTicket } from "./pdf-kitchen-ticket"
import QRCode from "qrcode"
import { format } from "date-fns"

interface ReceiptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReceiptDialog({ open, onOpenChange }: ReceiptDialogProps) {
  const lastCompletedOrder = usePosStore((state) => state.lastCompletedOrder)
  const settings = usePosStore((state) => state.settings)
  const receiptRef = useRef<HTMLDivElement>(null)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("")
  const [isGenerating, setIsGenerating] = useState(false)

  const businessConfig = usePosStore((state) => state.getBusinessConfig())
  const showKitchenTicket = businessConfig.features.kitchenDisplay

  useEffect(() => {
    if (lastCompletedOrder && settings.receiptConfig?.showQrCode) {
      const qrData = JSON.stringify({
        orderNumber: lastCompletedOrder.orderNumber,
        total: lastCompletedOrder.total,
        date: format(new Date(lastCompletedOrder.createdAt), "yyyy-MM-dd HH:mm"),
      })

      QRCode.toDataURL(qrData, { width: 200, margin: 1 })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => console.error("QR Code generation error:", err))
    }
  }, [lastCompletedOrder, settings.receiptConfig?.showQrCode])

  if (!lastCompletedOrder) return null

  const handlePrintReceipt = async () => {
    setIsGenerating(true)
    try {
      const blob = await pdf(
        <PDFReceipt
          order={lastCompletedOrder}
          businessName={settings.businessName}
          currency={settings.currency}
          taxRate={settings.taxRate}
          receiptConfig={settings.receiptConfig}
          qrCodeDataUrl={qrCodeDataUrl}
        />,
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const printWindow = window.open(url, "_blank")
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print()
        }
      }
    } catch (error) {
      console.error("Error generating PDF:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadReceipt = async () => {
    setIsGenerating(true)
    try {
      const blob = await pdf(
        <PDFReceipt
          order={lastCompletedOrder}
          businessName={settings.businessName}
          currency={settings.currency}
          taxRate={settings.taxRate}
          receiptConfig={settings.receiptConfig}
          qrCodeDataUrl={qrCodeDataUrl}
        />,
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `receipt-${lastCompletedOrder.orderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error generating PDF:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadKitchenTicket = async () => {
    setIsGenerating(true)
    try {
      const blob = await pdf(
        <PDFKitchenTicket order={lastCompletedOrder} businessName={settings.businessName} />,
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ticket-${lastCompletedOrder.orderNumber}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error generating kitchen ticket:", error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Order Receipt - {lastCompletedOrder.orderNumber}</span>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="border rounded-lg p-6 bg-white" ref={receiptRef}>
            <ReceiptPreview order={lastCompletedOrder} />
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-4 border-t">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={handlePrintReceipt}
              disabled={isGenerating}
            >
              <Printer className="w-4 h-4 mr-2" />
              {isGenerating ? "Generating..." : "Print Receipt"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={handleDownloadReceipt}
              disabled={isGenerating}
            >
              <Download className="w-4 h-4 mr-2" />
              {isGenerating ? "Generating..." : "Download Receipt"}
            </Button>
          </div>

          {showKitchenTicket && (
            <Button
              variant="outline"
              className="w-full bg-transparent"
              onClick={handleDownloadKitchenTicket}
              disabled={isGenerating}
            >
              <ChefHat className="w-4 h-4 mr-2" />
              {isGenerating ? "Generating..." : "Download Kitchen Ticket"}
            </Button>
          )}

          <Button className="w-full" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
