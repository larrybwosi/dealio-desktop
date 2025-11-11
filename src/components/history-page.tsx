"use client"

import { useState, useMemo } from "react"
import { usePosStore } from "@/lib/store"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Download, Eye, Printer } from "lucide-react"
import { cn } from "@/lib/utils"

export function HistoryPage() {
  const orders = usePosStore((state) => state.orders)
  const settings = usePosStore((state) => state.settings)
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")

  const filteredOrders = useMemo(() => {
    const now = new Date()
    let startDate: Date | null = null

    switch (dateFilter) {
      case "today":
        startDate = new Date()
        startDate.setHours(0, 0, 0, 0)
        break
      case "week":
        startDate = new Date()
        startDate.setDate(now.getDate() - 7)
        break
      case "month":
        startDate = new Date()
        startDate.setMonth(now.getMonth() - 1)
        break
      case "all":
      default:
        startDate = null
        break
    }

    return orders.filter((order) => {
      const matchesSearch =
        order.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = statusFilter === "all" || order.status === statusFilter
      const matchesDate = !startDate || new Date(order.createdAt) >= startDate

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [orders, searchQuery, statusFilter, dateFilter])

  const selectedOrderData = selectedOrder ? orders.find((o) => o.id === selectedOrder) : null

  const totalSales = filteredOrders.filter((o) => o.status === "completed").reduce((sum, order) => sum + order.total, 0)
  const completedOrders = filteredOrders.filter((o) => o.status === "completed").length
  const avgOrderValue = completedOrders > 0 ? totalSales / completedOrders : 0
  const totalOrders = filteredOrders.length

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Sales History</h1>
            <p className="text-muted-foreground mt-1">View and manage all your completed transactions</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Orders</div>
              <div className="text-2xl font-bold mt-1">{totalOrders}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Completed</div>
              <div className="text-2xl font-bold mt-1 text-emerald-600">{completedOrders}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Sales</div>
              <div className="text-2xl font-bold mt-1">
                {settings.currency} {totalSales.toLocaleString()}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Avg. Order Value</div>
              <div className="text-2xl font-bold mt-1">
                {settings.currency} {totalOrders > 0 ? Math.round(avgOrderValue).toLocaleString() : 0}
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by customer or order number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="waiting">Waiting</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="canceled">Canceled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by date" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" className="gap-2 bg-transparent">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </div>
          </Card>

          {/* Orders List */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-sm text-muted-foreground">
                    <th className="text-left p-4 font-medium">Order #</th>
                    <th className="text-left p-4 font-medium">Customer</th>
                    <th className="text-left p-4 font-medium">Type</th>
                    <th className="text-left p-4 font-medium">Date & Time</th>
                    <th className="text-left p-4 font-medium">Items</th>
                    <th className="text-left p-4 font-medium">Total</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr
                      key={order.id}
                      className={cn(
                        "border-b border-border hover:bg-muted/50 transition-colors cursor-pointer",
                        selectedOrder === order.id && "bg-muted",
                      )}
                      onClick={() => setSelectedOrder(order.id)}
                    >
                      <td className="p-4">
                        <span className="font-medium">{order.orderNumber}</span>
                      </td>
                      <td className="p-4">
                        <span>{order.customerName}</span>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary" className={getOrderTypeColor(order.orderType)}>
                          {order.orderType}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}{" "}
                        {new Date(order.createdAt).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-4 text-sm">{order.items.length} items</td>
                      <td className="p-4">
                        <span className="font-semibold">
                          {settings.currency} {order.total.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary" className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Printer className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredOrders.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No orders found matching your criteria</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Order Details Sidebar */}
      {selectedOrderData && (
        <div className="w-96 border-l border-border bg-card overflow-y-auto">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Order Details</h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedOrder(null)}>
                ✕
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Order Number</div>
                <div className="font-semibold text-lg">{selectedOrderData.orderNumber}</div>
              </div>

              <div className="flex gap-2">
                <Badge variant="secondary" className={getStatusColor(selectedOrderData.status)}>
                  {selectedOrderData.status}
                </Badge>
                <Badge variant="secondary" className={getOrderTypeColor(selectedOrderData.orderType)}>
                  {selectedOrderData.orderType}
                </Badge>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Customer Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{selectedOrderData.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{new Date(selectedOrderData.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">{new Date(selectedOrderData.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Order Items</h3>
              <div className="space-y-3">
                {selectedOrderData.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-muted-foreground text-xs">
                        {item.variantName} • {item.selectedUnit?.unitName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">
                        {settings.currency} {((item.selectedUnit?.price || 0) * item.quantity).toLocaleString()}
                      </div>
                      <div className="text-muted-foreground text-xs">x{item.quantity}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>
                  {settings.currency} {selectedOrderData.subTotal.toLocaleString()}
                </span>
              </div>
              {selectedOrderData.discount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-emerald-600">
                    -{settings.currency} {selectedOrderData.discount.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({settings.taxRate}%)</span>
                <span>
                  {settings.currency} {selectedOrderData.taxes.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-lg">
                  {settings.currency} {selectedOrderData.total.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2 bg-transparent">
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button variant="outline" className="flex-1 gap-2 bg-transparent">
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "waiting":
      return "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
    case "ready":
      return "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
    case "completed":
      return "bg-blue-500/10 text-blue-700 hover:bg-blue-500/20"
    case "canceled":
      return "bg-red-500/10 text-red-700 hover:bg-red-500/20"
    default:
      return "bg-gray-500/10 text-gray-700 hover:bg-gray-500/20"
  }
}

const getOrderTypeColor = (type: string) => {
  switch (type) {
    case "takeaway":
      return "bg-orange-500/10 text-orange-700"
    case "delivery":
      return "bg-green-500/10 text-green-700"
    case "dine-in":
      return "bg-purple-500/10 text-purple-700"
    case "pickup":
      return "bg-cyan-500/10 text-cyan-700"
    case "online":
      return "bg-pink-500/10 text-pink-700"
    default:
      return "bg-gray-500/10 text-gray-700"
  }
}
