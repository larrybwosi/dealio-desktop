"use client"

import { useState, useMemo } from "react"
import { useOfflineSaleStore } from "@/store/offline-sale"
import { usePosStore } from "@/store/store"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Search, Download, Eye, Printer, AlertCircle, CheckCircle2, Cloud, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

export function HistoryPage() {
  const queue = useOfflineSaleStore((state) => state.queue)
  const settings = usePosStore((state) => state.settings)
  
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
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

    return queue.filter((item) => {
      // CHANGED: Access data via item.data
      const customerId = item.data.customerId || ""
      const saleNumber = item.data.saleNumber || ""
      
      const matchesSearch =
        customerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        saleNumber.toLowerCase().includes(searchQuery.toLowerCase())
      
      // CHANGED: Filter by Queue Status
      const matchesStatus = statusFilter === "all" || item.status === statusFilter
      
      // CHANGED: Use item.timestamp
      const matchesDate = !startDate || new Date(item.timestamp) >= startDate

      return matchesSearch && matchesStatus && matchesDate
    })
  }, [queue, searchQuery, statusFilter, dateFilter])

  const selectedOrderData = selectedOrderId ? queue.find((o) => o.id === selectedOrderId) : null

  // CHANGED: Calculate totals based on Payment Data (Amount Received - Change)
  const calculateTotal = (data: any) => {
    const received = data.amountReceived || 0
    const change = data.change || 0
    return Math.max(0, received - change)
  }

  const totalSales = filteredOrders
    .filter((o) => o.status === "SYNCED")
    .reduce((sum, order) => sum + calculateTotal(order.data), 0)
    
  const completedOrders = filteredOrders.filter((o) => o.status === "SYNCED").length
  const avgOrderValue = completedOrders > 0 ? totalSales / completedOrders : 0
  const totalOrders = filteredOrders.length

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">Transaction History</h1>
            <p className="text-muted-foreground mt-1">View offline queue and synced transactions</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Transactions</div>
              <div className="text-2xl font-bold mt-1">{totalOrders}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Synced Successfully</div>
              <div className="text-2xl font-bold mt-1 text-emerald-600">{completedOrders}</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Total Revenue (Synced)</div>
              <div className="text-2xl font-bold mt-1">
                {settings.currency} {totalSales.toLocaleString()}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Avg. Value</div>
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
                  placeholder="Search by ID or Sale #..."
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
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="SYNCING">Syncing</SelectItem>
                  <SelectItem value="SYNCED">Synced</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
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
                    <th className="text-left p-4 font-medium">Sale #</th>
                    <th className="text-left p-4 font-medium">Customer ID</th>
                    <th className="text-left p-4 font-medium">Payment</th>
                    <th className="text-left p-4 font-medium">Date & Time</th>
                    <th className="text-left p-4 font-medium">Items</th>
                    <th className="text-left p-4 font-medium">Total</th>
                    <th className="text-left p-4 font-medium">Sync Status</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((item) => (
                    <tr
                      key={item.id}
                      className={cn(
                        "border-b border-border hover:bg-muted/50 transition-colors cursor-pointer",
                        selectedOrderId === item.id && "bg-muted",
                      )}
                      onClick={() => setSelectedOrderId(item.id)}
                    >
                      <td className="p-4">
                        <span className="font-medium">
                            {item.data.saleNumber || <span className="text-muted-foreground text-xs italic">Pending Gen</span>}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm">
                            {item.data.customerId ? 
                                item.data.customerId.slice(0, 8) + '...' : 
                                <span className="text-muted-foreground">Guest</span>}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge variant="outline" className="text-xs">
                          {item.data.paymentMethod}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {new Date(item.timestamp).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        <span className="text-xs">
                            {new Date(item.timestamp).toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                            })}
                        </span>
                      </td>
                      <td className="p-4 text-sm">{item.data.cartItems.length} items</td>
                      <td className="p-4">
                        <span className="font-semibold">
                          {settings.currency} {calculateTotal(item.data).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary" className={getQueueStatusColor(item.status)}>
                          {getQueueStatusIcon(item.status)}
                          <span className="ml-1">{item.status}</span>
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredOrders.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <p>No transactions found matching your criteria</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Transaction Details Sidebar */}
      {selectedOrderData && (
        <div className="w-96 border-l border-border bg-card overflow-y-auto">
          <div className="p-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Transaction Details</h2>
              <Button variant="ghost" size="icon" onClick={() => setSelectedOrderId(null)}>
                ✕
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Transaction ID (UUID)</div>
                <div className="font-mono text-xs text-muted-foreground break-all">{selectedOrderData.id}</div>
              </div>

              <div className="flex gap-2 mt-2">
                 <Badge variant="secondary" className={getQueueStatusColor(selectedOrderData.status)}>
                    {selectedOrderData.status}
                </Badge>
                {selectedOrderData.data.isWholesale && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-700">Wholesale</Badge>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Customer & Payment</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer ID</span>
                  <span className="font-mono text-xs">{selectedOrderData.data.customerId || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium">{selectedOrderData.data.paymentMethod}</span>
                </div>
                {selectedOrderData.data.paymentMethod === 'MPESA' && (
                    <div className="flex justify-between">
                    <span className="text-muted-foreground">M-Pesa Phone</span>
                    <span className="font-medium">{selectedOrderData.data.mpesaPhoneNumber || "N/A"}</span>
                    </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Status</span>
                  <span className="font-medium">{selectedOrderData.data.paymentStatus}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Items (IDs)</h3>
              <div className="space-y-3 bg-muted/30 p-3 rounded-lg">
                {selectedOrderData.data.cartItems.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm border-b border-border/50 pb-2 last:border-0">
                    <div className="flex-1 pr-4">
                      {/* Note: We only have IDs in the offline store data, not names */}
                      <div className="font-mono text-xs text-muted-foreground truncate w-48">Prod: {item.productId}</div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate w-48">Var: {item.variantId}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">Qty: {item.quantity}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-border space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount Received</span>
                <span>
                  {settings.currency} {(selectedOrderData.data.amountReceived || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Change</span>
                <span>
                  {settings.currency} {(selectedOrderData.data.change || 0).toLocaleString()}
                </span>
              </div>
               <div className="flex justify-between">
                <span className="text-muted-foreground">Discount</span>
                <span className="text-emerald-600">
                  -{settings.currency} {(selectedOrderData.data.discountAmount || 0).toLocaleString()}
                </span>
              </div>
              
              <div className="flex justify-between pt-2 border-t border-border">
                <span className="font-semibold">Calculated Total</span>
                <span className="font-bold text-lg">
                  {settings.currency} {calculateTotal(selectedOrderData.data).toLocaleString()}
                </span>
              </div>
            </div>

            {selectedOrderData.data.notes && (
                <div className="bg-amber-50 p-3 rounded-md text-amber-900 text-sm">
                    <span className="font-semibold block mb-1">Notes:</span>
                    {selectedOrderData.data.notes}
                </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-2 bg-transparent">
                <Printer className="w-4 h-4" />
                Print
              </Button>
            </div>
            
            {/* Retry Button for Failed items */}
            {selectedOrderData.status === 'FAILED' && (
                 <Button className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white mt-2">
                 <RefreshCw className="w-4 h-4" />
                 Retry Sync
               </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const getQueueStatusColor = (status: string) => {
  switch (status) {
    case "PENDING":
      return "bg-amber-500/10 text-amber-700 border-amber-200"
    case "SYNCING":
      return "bg-blue-500/10 text-blue-700 border-blue-200 animate-pulse"
    case "SYNCED":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-200"
    case "FAILED":
      return "bg-red-500/10 text-red-700 border-red-200"
    default:
      return "bg-gray-500/10 text-gray-700"
  }
}

const getQueueStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING":
        return <Cloud className="w-3 h-3" />
      case "SYNCING":
        return <RefreshCw className="w-3 h-3 animate-spin" />
      case "SYNCED":
        return <CheckCircle2 className="w-3 h-3" />
      case "FAILED":
        return <AlertCircle className="w-3 h-3" />
      default:
        return null
    }
  }