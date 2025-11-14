"use client"

import { usePosStore, type Order } from "@/store/store"
import { format } from "date-fns"
import { useEffect, useRef } from "react"
import QRCode from "qrcode"

interface ReceiptPreviewProps {
  order: Order
  className?: string
}

export function ReceiptPreview({ order, className = "" }: ReceiptPreviewProps) {
  const settings = usePosStore((state) => state.settings)
  const receiptConfig = settings.receiptConfig
  const qrCodeRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (receiptConfig?.showQrCode && qrCodeRef.current) {
      const qrData = JSON.stringify({
        orderNumber: order.orderNumber,
        total: order.total,
        date: format(new Date(order.createdAt), "yyyy-MM-dd HH:mm"),
      })

      QRCode.toCanvas(qrCodeRef.current, qrData, {
        width: 96,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      }).catch((err) => console.error("QR Code generation error:", err))
    }
  }, [receiptConfig?.showQrCode, order.orderNumber, order.total, order.createdAt])

  if (!receiptConfig) return <div className="p-4 text-center">Loading receipt configuration...</div>

  const fontSize = {
    small: "text-xs",
    medium: "text-sm",
    large: "text-base",
  }[receiptConfig.fontSize]

  const paperWidth = receiptConfig.paperSize === "80mm" ? "300px" : "220px"

  return (
    <div
      className={`font-mono ${fontSize} text-black bg-white ${className}`}
      style={{ width: paperWidth, margin: "0 auto" }}
    >
      {/* Header */}
      <div className="text-center border-b-2 border-dashed border-gray-400 pb-3 mb-3">
        {receiptConfig.showLogo && receiptConfig.logoUrl && (
          <div className="mb-2">
            <img src={receiptConfig.logoUrl || "/placeholder.svg"} alt="Logo" className="mx-auto h-16 object-contain" />
          </div>
        )}
        <div className="font-bold text-lg">{settings.businessName}</div>
        {receiptConfig.headerText && <div className="mt-1">{receiptConfig.headerText}</div>}
        {receiptConfig.showAddress && <div className="text-xs mt-1">{receiptConfig.address}</div>}
        {receiptConfig.showPhone && <div className="text-xs">Tel: {receiptConfig.phone}</div>}
        {receiptConfig.showEmail && <div className="text-xs">{receiptConfig.email}</div>}
        {receiptConfig.showWebsite && <div className="text-xs">{receiptConfig.website}</div>}
        {receiptConfig.showTaxNumber && <div className="text-xs mt-1">Tax ID: {receiptConfig.taxNumber}</div>}
      </div>

      {/* Order Info */}
      <div className="space-y-1 mb-3">
        <div className="flex justify-between">
          <span>Order No:</span>
          <span className="font-bold">{order.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{format(new Date(order.createdAt), "dd/MM/yyyy HH:mm")}</span>
        </div>
        {order.customerName && (
          <div className="flex justify-between">
            <span>Customer:</span>
            <span>{order.customerName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Type:</span>
          <span className="uppercase">{order.orderType}</span>
        </div>
        {order.paymentMethod !== "pending" && (
          <div className="flex justify-between">
            <span>Payment:</span>
            <span className="uppercase">{order.paymentMethod}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="border-t-2 border-dashed border-gray-400 pt-2 mb-3">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left pb-1">Item</th>
              <th className="text-center pb-1">Qty</th>
              <th className="text-right pb-1">Price</th>
              <th className="text-right pb-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, index) => {
              const itemTotal = (item.selectedUnit?.price || 0) * item.quantity
              return (
                <tr key={index} className="border-b border-gray-200">
                  <td className="py-1">
                    <div>{item.productName}</div>
                    <div className="text-xs text-gray-600">
                      {item.variantName} - {item.selectedUnit?.unitName}
                    </div>
                  </td>
                  <td className="text-center">{item.quantity}</td>
                  <td className="text-right">
                    {settings.currency} {(item.selectedUnit?.price || 0).toLocaleString()}
                  </td>
                  <td className="text-right">
                    {settings.currency} {itemTotal.toLocaleString()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="border-t-2 border-dashed border-gray-400 pt-2 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>
            {settings.currency} {order.subTotal.toLocaleString()}
          </span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>
              -{settings.currency} {order.discount.toLocaleString()}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Tax ({settings.taxRate}%):</span>
          <span>
            {settings.currency} {order.taxes.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between font-bold text-lg border-t-2 border-gray-400 pt-2 mt-2">
          <span>TOTAL:</span>
          <span>
            {settings.currency} {order.total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center border-t-2 border-dashed border-gray-400 mt-3 pt-3">
        {receiptConfig.footerText && <div className="mb-2">{receiptConfig.footerText}</div>}

        {receiptConfig.showBarcode && (
          <div className="my-2">
            <svg viewBox="0 0 200 50" className="w-full h-12">
              {[...Array(20)].map((_, i) => (
                <rect key={i} x={i * 10} y="0" width={i % 2 === 0 ? "4" : "6"} height="40" fill="black" />
              ))}
            </svg>
            <div className="text-xs mt-1">{order.orderNumber}</div>
          </div>
        )}

        {receiptConfig.showQrCode && (
          <div className="my-2 flex justify-center">
            <canvas ref={qrCodeRef} className="border-2 border-black p-1" />
          </div>
        )}

        <div className="text-xs mt-2">Powered by Enterprise POS System</div>
      </div>
    </div>
  )
}
