"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePosStore } from "@/store/store"
import { CheckCircle2, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"
import { ReceiptDialog } from "./receipt-dialog"

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderDetails: {
    customerName: string
    items: any[]
    subTotal: number
    discount: number
    taxes: number
    total: number
  }
  orderId?: string
}

const paymentMethods = [
  { id: "cash", label: "Cash", icon: "💵" },
  { id: "card", label: "Debit/Credit Card", icon: "💳" },
  { id: "ewallet", label: "E-Wallet", icon: "📱" },
  { id: "bank", label: "Bank Transfer", icon: "🏦" },
]

export function PaymentDialog({ open, onOpenChange, orderDetails, orderId }: PaymentDialogProps) {
  const [selectedMethod, setSelectedMethod] = useState("cash")
  const [amountReceived, setAmountReceived] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  const [showReceiptDialog, setShowReceiptDialog] = useState(false)

  const [discountAmount, setDiscountAmount] = useState(orderDetails.discount.toString())
  const [isEditingDiscount, setIsEditingDiscount] = useState(false)

  const completeOrder = usePosStore((state) => state.completeOrder)
  const updateOrderStatus = usePosStore((state) => state.updateOrderStatus)
  const updateProductStock = usePosStore((state) => state.updateProductStock)
  const products = usePosStore((state) => state.products)
  const currentOrder = usePosStore((state) => state.currentOrder)
  const customers = usePosStore((state) => state.customers)

  const selectedCustomer = customers.find((c) => c.id === currentOrder.customerId)
  const isB2BCustomer = selectedCustomer?.customerType === "b2b"

  const handleConfirmPayment = () => {
    const finalDiscount = Number.parseFloat(discountAmount) || 0

    orderDetails.items.forEach((item) => {
      const product = products.find((p) => p.productId === item.productId)
      if (product) {
        const baseConversion = item.selectedUnit?.conversion || 1
        const quantityToDeduct = item.quantity * baseConversion
        const newStock = Math.max(0, product.stock - quantityToDeduct)
        updateProductStock(item.productId, newStock)
      }
    })

    if (orderId) {
      updateOrderStatus(orderId, "completed")
    } else {
      completeOrder(selectedMethod, finalDiscount)
    }

    setShowSuccess(true)

    setTimeout(() => {
      setShowSuccess(false)
      onOpenChange(false)
      setAmountReceived("")
      setDiscountAmount("0")
      setSelectedMethod("cash")
      setShowReceiptDialog(true)
    }, 2000)
  }

  const finalDiscount = Number.parseFloat(discountAmount) || 0
  const finalTotal = orderDetails.total - finalDiscount

  const change = amountReceived ? Math.max(0, Number.parseFloat(amountReceived) - finalTotal) : 0

  if (showSuccess) {
    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="sm:max-w-md">
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="w-20 h-20 text-green-500 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
              <p className="text-muted-foreground text-center">Order has been placed successfully</p>
            </div>
          </DialogContent>
        </Dialog>
        <ReceiptDialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}  completedOrder={()=>{}} onClose={()=>setShowReceiptDialog(false)}/>
      </>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment Confirmation</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <h3 className="font-medium mb-3">Select Payment Method</h3>
            <div className="grid grid-cols-2 gap-3">
              {paymentMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedMethod(method.id)}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border-2 transition-colors",
                    selectedMethod === method.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <span className="text-2xl">{method.icon}</span>
                  <span className="text-sm font-medium">{method.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 p-4 rounded-lg bg-muted">
            <div className="flex justify-between text-sm">
              <span>Customer:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">{orderDetails.customerName}</span>
                {isB2BCustomer && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">B2B</span>}
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span>Items:</span>
              <span className="font-medium">{orderDetails.items.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Sub Total (excl. tax):</span>
              <span>KSH. {orderDetails.subTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Tax (included in prices):</span>
              <span>KSH. {orderDetails.taxes.toLocaleString()}</span>
            </div>

            <div className="flex justify-between text-sm items-center">
              <span>Discount:</span>
              <div className="flex items-center gap-2">
                {isEditingDiscount ? (
                  <Input
                    type="number"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    onBlur={() => setIsEditingDiscount(false)}
                    className="h-7 w-32 text-right"
                    autoFocus
                  />
                ) : (
                  <>
                    <span className="text-green-600">-KSH. {finalDiscount.toLocaleString()}</span>
                    <button
                      onClick={() => setIsEditingDiscount(true)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-3 border-t border-border">
              <span className="font-semibold">Total:</span>
              <span className="text-lg font-bold">KSH. {finalTotal.toLocaleString()}</span>
            </div>

            {isB2BCustomer && selectedCustomer?.creditLimit && (
              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                Available Credit: KSH.{" "}
                {(selectedCustomer.creditLimit - (selectedCustomer.totalPurchases || 0)).toLocaleString()}
              </div>
            )}
          </div>

          {selectedMethod === "cash" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="amount-received" className="text-sm font-medium mb-2 block">
                  Amount Received
                </Label>
                <Input
                  id="amount-received"
                  type="number"
                  placeholder="Enter amount"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                />
              </div>

              {amountReceived && (
                <div className="flex justify-between p-3 rounded-lg bg-primary/10">
                  <span className="font-medium">Change:</span>
                  <span className="font-bold text-primary">KSH. {change.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 bg-transparent" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleConfirmPayment}
              disabled={
                selectedMethod === "cash" && (!amountReceived || Number.parseFloat(amountReceived) < finalTotal)
              }
            >
              Confirm Payment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
