"use client"

import * as React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  ArrowRight, 
  Package, 
  Plus, 
  Trash2, 
  Send,
  Search,
  AlertCircle,
  Building2,
  Calendar
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface TransferItem {
  id: string
  productId: string
  productName: string
  sku: string
  currentStock: number
  quantity: number
  unit: string
}

interface Branch {
  id: string
  name: string
  code: string
  address: string
}

interface Product {
  id: string
  name: string
  sku: string
  stock: number
  unit: string
}

export function StockTransferCreate() {
  const [fromBranch, setFromBranch] = useState<string>("")
  const [toBranch, setToBranch] = useState<string>("")
  const [transferDate, setTransferDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [notes, setNotes] = useState<string>("")
  const [items, setItems] = useState<TransferItem[]>([])
  const [open, setOpen] = useState(false)

  // Mock data - replace with your actual data fetching
  const branches: Branch[] = [
    { id: "1", name: "Main Warehouse", code: "MWH", address: "123 Main St, City" },
    { id: "2", name: "Downtown Store", code: "DWN", address: "456 Downtown Ave" },
    { id: "3", name: "North Branch", code: "NTH", address: "789 North Rd" },
    { id: "4", name: "East Branch", code: "EST", address: "321 East Blvd" },
  ]

  const products: Product[] = [
    { id: "1", name: "Wireless Mouse", sku: "WM-001", stock: 150, unit: "pcs" },
    { id: "2", name: "USB Cable", sku: "UC-002", stock: 300, unit: "pcs" },
    { id: "3", name: "Keyboard", sku: "KB-003", stock: 85, unit: "pcs" },
    { id: "4", name: "Monitor 24\"", sku: "MN-004", stock: 45, unit: "pcs" },
    { id: "5", name: "Laptop Stand", sku: "LS-005", stock: 120, unit: "pcs" },
  ]

  const addItem = (product: Product) => {
    const existingItem = items.find(item => item.productId === product.id)
    if (existingItem) {
      return
    }

    const newItem: TransferItem = {
      id: Math.random().toString(36).substr(2, 9),
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentStock: product.stock,
      quantity: 1,
      unit: product.unit,
    }

    setItems([...items, newItem])
    setOpen(false)
  }

  const updateQuantity = (id: string, quantity: number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, quantity: Math.max(0, quantity) } : item
    ))
  }

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id))
  }

  const handleSubmit = () => {
    if (!fromBranch || !toBranch || items.length === 0) {
      return
    }

    const transfer = {
      fromBranch,
      toBranch,
      transferDate,
      notes,
      items,
      status: "pending",
      createdAt: new Date().toISOString(),
    }

    console.log("Creating transfer:", transfer)
    // Implement your API call here
  }

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }

  const hasStockIssues = () => {
    return items.some(item => item.quantity > item.currentStock)
  }

  const selectedFromBranch = branches.find(b => b.id === fromBranch)
  const selectedToBranch = branches.find(b => b.id === toBranch)

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Stock Transfer</h1>
          <p className="text-muted-foreground mt-1">
            Transfer inventory between branches
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-4 py-2">
          Draft
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Branch Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Transfer Route
              </CardTitle>
              <CardDescription>
                Select source and destination branches
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="from-branch">From Branch *</Label>
                  <Select value={fromBranch} onValueChange={setFromBranch}>
                    <SelectTrigger id="from-branch">
                      <SelectValue placeholder="Select source branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches
                        .filter(b => b.id !== toBranch)
                        .map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {branch.code}
                              </Badge>
                              {branch.name}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedFromBranch && (
                    <p className="text-xs text-muted-foreground">
                      {selectedFromBranch.address}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="to-branch">To Branch *</Label>
                  <Select value={toBranch} onValueChange={setToBranch}>
                    <SelectTrigger id="to-branch">
                      <SelectValue placeholder="Select destination branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches
                        .filter(b => b.id !== fromBranch)
                        .map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {branch.code}
                              </Badge>
                              {branch.name}
                            </div>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {selectedToBranch && (
                    <p className="text-xs text-muted-foreground">
                      {selectedToBranch.address}
                    </p>
                  )}
                </div>
              </div>

              {fromBranch && toBranch && (
                <div className="flex items-center justify-center py-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline">{selectedFromBranch?.code}</Badge>
                    <ArrowRight className="h-4 w-4" />
                    <Badge variant="outline">{selectedToBranch?.code}</Badge>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="transfer-date" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Transfer Date *
                </Label>
                <Input
                  id="transfer-date"
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Transfer Items
                  </CardTitle>
                  <CardDescription>
                    Add products to transfer
                  </CardDescription>
                </div>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search products..." />
                      <CommandEmpty>No products found.</CommandEmpty>
                      <CommandGroup>
                        <ScrollArea className="h-[300px]">
                          {products.map((product) => (
                            <CommandItem
                              key={product.id}
                              onSelect={() => addItem(product)}
                              disabled={items.some(item => item.productId === product.id)}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex flex-col">
                                  <span className="font-medium">{product.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    SKU: {product.sku}
                                  </span>
                                </div>
                                <Badge variant="secondary" className="text-xs">
                                  {product.stock} {product.unit}
                                </Badge>
                              </div>
                            </CommandItem>
                          ))}
                        </ScrollArea>
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No items added yet. Click "Add Item" to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {hasStockIssues() && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Some items exceed available stock. Please adjust quantities.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Available</TableHead>
                          <TableHead className="text-center">Quantity</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{item.productName}</span>
                                <span className="text-xs text-muted-foreground">
                                  SKU: {item.sku}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge 
                                variant={item.quantity > item.currentStock ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {item.currentStock} {item.unit}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                max={item.currentStock}
                                value={item.quantity}
                                onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                                className={`w-24 text-center ${
                                  item.quantity > item.currentStock ? 'border-destructive' : ''
                                }`}
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Notes</CardTitle>
              <CardDescription>
                Add any relevant information about this transfer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter notes or special instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Summary Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Transfer Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">From:</span>
                  <span className="font-medium">
                    {selectedFromBranch?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">To:</span>
                  <span className="font-medium">
                    {selectedToBranch?.name || "-"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date:</span>
                  <span className="font-medium">{transferDate}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Items:</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Quantity:</span>
                  <span className="font-medium">{getTotalItems()}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleSubmit}
                  disabled={!fromBranch || !toBranch || items.length === 0 || hasStockIssues()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Create Transfer
                </Button>
                <Button variant="outline" className="w-full">
                  Save as Draft
                </Button>
              </div>

              {(!fromBranch || !toBranch || items.length === 0) && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Please select branches and add items to continue.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}