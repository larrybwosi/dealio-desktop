"use client"

import type React from "react"

import { useState } from "react"
import { usePosStore } from "@/lib/store"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShoppingBag, Truck, UtensilsCrossed, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { OrderDetailsDialog } from "./order-details-dialog"
import { PaymentDialog } from "./payment-dialog" // Import PaymentDialog component
import type { Order } from "@/lib/store"

export function OrdersList() {
  const [isExpanded, setIsExpanded] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false) // Added payment dialog state for unpaid orders
  const [orderToPay, setOrderToPay] = useState<Order | null>(null)

  const orders = usePosStore((state) => state.orders.slice(0, 3))

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
        return "bg-status-waiting text-status-waiting"
      case "ready":
        return "bg-status-ready text-status-ready"
      case "canceled":
        return "bg-status-canceled text-status-canceled"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getOrderIcon = (type: string) => {
    switch (type) {
      case "takeaway":
        return <ShoppingBag className="w-4 h-4" />
      case "delivery":
        return <Truck className="w-4 h-4" />
      case "dine-in":
        return <UtensilsCrossed className="w-4 h-4" />
    }
  }

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order)
    setDialogOpen(true)
  }

  const handlePayOrder = (order: Order, e: React.MouseEvent) => {
    // Added function to handle payment for unpaid orders
    e.stopPropagation() // Prevent opening the details dialog
    setOrderToPay(order)
    setPaymentDialogOpen(true)
  }

  return (
    <>
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Orders List</h2>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} className="h-8 w-8 p-0">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
          <button className="text-sm text-primary hover:underline">View all orders</button>
        </div>

        {isExpanded && (
          <div className="grid grid-cols-3 gap-4">
            {orders.map((order) => (
              <Card
                key={order.id}
                className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => handleOrderClick(order)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getOrderIcon(order.orderType)}
                    <span className="font-medium capitalize">
                      {order.orderType === "dine-in" ? "Dine in" : order.orderType}
                    </span>
                  </div>
                  <Badge className={cn("capitalize", getStatusColor(order.status))}>{order.status}</Badge>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{order.customerName}</span>
                    <span className="text-sm text-muted-foreground">{order.orderNumber}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      month: "2-digit",
                      day: "2-digit",
                      year: "numeric",
                    })}
                    ,{" "}
                    {new Date(order.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-muted-foreground">{order.items.length || 4} Items</span>
                    {order.tableNumber && <span className="text-sm">Table {order.tableNumber}</span>}
                  </div>

                  {order.paymentMethod === "pending" && ( // Added Pay Now button for unpaid orders
                    <Button size="sm" className="w-full mt-2" onClick={(e) => handlePayOrder(order, e)}>
                      Pay Now - KSH. {order.total.toLocaleString()}
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <OrderDetailsDialog order={selectedOrder} open={dialogOpen} onOpenChange={setDialogOpen} />

      {orderToPay && ( // Added payment dialog for unpaid orders
        <PaymentDialog
          open={paymentDialogOpen}
          onOpenChange={setPaymentDialogOpen}
          orderId={orderToPay.id}
          orderDetails={{
            customerName: orderToPay.customerName,
            items: orderToPay.items,
            subTotal: orderToPay.subTotal,
            discount: orderToPay.discount,
            taxes: orderToPay.taxes,
            total: orderToPay.total,
          }}
        />
      )}
    </>
  )
}
