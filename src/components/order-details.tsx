"use client"

import { useState, useMemo } from "react"
import { usePosStore } from "@/lib/store"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2, Edit2 } from "lucide-react"
import { PaymentDialog } from "./payment-dialog"
import { CustomerSelector } from "./customer-selector"
import { AgeVerificationDialog } from "./age-verification-dialog"

export function OrderDetails() {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [ageVerificationOpen, setAgeVerificationOpen] = useState(false)
  const [ageVerified, setAgeVerified] = useState(false)

  const currentOrder = usePosStore((state) => state.currentOrder)
  const taxRate = usePosStore((state) => state.settings.taxRate)
  const getBusinessConfig = usePosStore((state) => state.getBusinessConfig)
  const tables = usePosStore((state) => state.tables)
  const setCustomerName = usePosStore((state) => state.setCustomerName)
  const setOrderType = usePosStore((state) => state.setOrderType)
  const setTableNumber = usePosStore((state) => state.setTableNumber)
  const setInstructions = usePosStore((state) => state.setInstructions)
  const removeItemFromOrder = usePosStore((state) => state.removeItemFromOrder)
  const resetOrder = usePosStore((state) => state.resetOrder)
  const saveUnpaidOrder = usePosStore((state) => state.saveUnpaidOrder)
  const allowSaveUnpaidOrders = usePosStore((state) => state.settings.allowSaveUnpaidOrders)

  const businessConfig = getBusinessConfig()
  const availableOrderTypes = businessConfig.orderTypes
  const showTableField = businessConfig.features.tableManagement
  const requiresAgeVerification = businessConfig.features.ageVerification

  const availableTables = tables.filter((t) => t.status === "available")

  const { subTotal, taxAmount, total } = useMemo(() => {
    const totalWithTax = currentOrder.items.reduce((sum, item) => {
      const price = item.selectedUnit?.price || 0
      return sum + price * item.quantity
    }, 0)

    // Extract tax from the total (prices are tax-inclusive)
    const extractedTax = (totalWithTax * taxRate) / (100 + taxRate)
    const subTotalBeforeTax = totalWithTax - extractedTax

    return {
      subTotal: subTotalBeforeTax,
      taxAmount: extractedTax,
      total: totalWithTax,
    }
  }, [currentOrder.items, taxRate])

  const handleConfirmPayment = () => {
    if (requiresAgeVerification && !ageVerified) {
      setAgeVerificationOpen(true)
    } else {
      setPaymentDialogOpen(true)
    }
  }

  const handleAgeVerified = () => {
    setAgeVerified(true)
    setPaymentDialogOpen(true)
  }

  const handleSaveUnpaidOrder = () => {
    if (currentOrder.items.length === 0) return
    saveUnpaidOrder(0)
  }

  return (
    <>
      <div className="w-96 border-l border-border bg-card h-screen flex flex-col overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold mb-4">Order Details</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                Customer Information <span className="text-muted-foreground text-xs">(Optional)</span>
              </label>
              <CustomerSelector />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Order Type</label>
              <Select value={currentOrder.orderType} onValueChange={(value: any) => setOrderType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableOrderTypes.includes("takeaway") && <SelectItem value="takeaway">Take Away</SelectItem>}
                  {availableOrderTypes.includes("delivery") && <SelectItem value="delivery">Delivery</SelectItem>}
                  {availableOrderTypes.includes("dine-in") && <SelectItem value="dine-in">Dine In</SelectItem>}
                  {availableOrderTypes.includes("pickup") && <SelectItem value="pickup">Pickup</SelectItem>}
                  {availableOrderTypes.includes("online") && <SelectItem value="online">Online</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {showTableField && (
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Table <span className="text-xs">(Optional)</span>
                </label>
                <Select value={currentOrder.tableNumber || "No Table"} onValueChange={setTableNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No Table">No Table</SelectItem>
                    {availableTables.map((table) => (
                      <SelectItem key={table.id} value={table.number}>
                        Table {table.number} ({table.capacity} seats) - {table.section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Special Instructions <span className="text-xs">(Optional)</span>
              </label>
              <Textarea
                placeholder="Add any special instructions for the kitchen or delivery..."
                value={currentOrder.instructions || ""}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Order Items</h3>
            <button onClick={resetOrder} className="text-sm text-destructive hover:underline">
              Reset Order
            </button>
          </div>

          <div className="space-y-3">
            {currentOrder.items.map((item, index) => {
              const unitId = item.selectedUnit?.unitId || "default"
              const unitName = item.selectedUnit?.unitName || "Unit"
              const price = item.selectedUnit?.price || 0

              return (
                <Card key={`${item.productId}-${unitId}-${index}`} className="p-3">
                  <div className="flex gap-3">
                    <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={item.imageUrl || "/placeholder.svg?height=64&width=64"}
                        alt={item.productName}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-medium text-sm">{item.productName}</h4>
                        <div className="flex gap-1">
                          <button className="text-muted-foreground hover:text-foreground">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeItemFromOrder(item.productId, unitId)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>Variant : {item.variantName}</div>
                        <div>Unit : {unitName}</div>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <span className="font-semibold text-sm">Rp. {price.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground">x{item.quantity}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}

            {currentOrder.items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">No items added yet</div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-border space-y-4">
          <div className="pt-3 border-t border-border">
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold">Rp. {total.toLocaleString()}</span>
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                size="lg"
                onClick={handleConfirmPayment}
                disabled={currentOrder.items.length === 0}
              >
                Confirm Payment
              </Button>

              {allowSaveUnpaidOrders && (
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  size="lg"
                  onClick={handleSaveUnpaidOrder}
                  disabled={currentOrder.items.length === 0}
                >
                  Save to Order List (Unpaid)
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AgeVerificationDialog
        open={ageVerificationOpen}
        onOpenChange={setAgeVerificationOpen}
        onVerified={handleAgeVerified}
      />

      <PaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        orderDetails={{
          customerName: currentOrder.customerName || "Walk-in Customer",
          items: currentOrder.items,
          subTotal: subTotal,
          discount: 0,
          taxes: taxAmount,
          total,
        }}
      />
    </>
  )
}
