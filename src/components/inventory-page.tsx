"use client"

import { useState } from "react"
import { usePosStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Search, Package, Edit, AlertCircle, TrendingDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function InventoryPage() {
  const products = usePosStore((state) => state.products)
  const updateProductStock = usePosStore((state) => state.updateProductStock)
  const getLowStockProducts = usePosStore((state) => state.getLowStockProducts)
  const settings = usePosStore((state) => state.settings)

  const [searchQuery, setSearchQuery] = useState("")
  const [editingProduct, setEditingProduct] = useState<string | null>(null)
  const [newStock, setNewStock] = useState("")

  const lowStockProducts = getLowStockProducts()

  const filteredProducts = products.filter(
    (product) =>
      product.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery),
  )

  const handleUpdateStock = () => {
    if (editingProduct && newStock) {
      const stockValue = Number.parseInt(newStock, 10)
      if (!isNaN(stockValue) && stockValue >= 0) {
        updateProductStock(editingProduct, stockValue)
        setEditingProduct(null)
        setNewStock("")
      }
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings.currency,
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const getTotalInventoryValue = () => {
    return products.reduce((sum, product) => {
      const basePrice = product.sellableUnits.find((u) => u.isBaseUnit)?.price || 0
      return sum + basePrice * product.stock
    }, 0)
  }

  const getTotalProducts = () => products.length

  const getTotalStock = () => products.reduce((sum, product) => sum + product.stock, 0)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Inventory Management</h1>
          <p className="text-muted-foreground mt-1">Track and manage your product stock levels</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalProducts()}</div>
            <p className="text-xs text-muted-foreground">Unique products</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stock</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getTotalStock()}</div>
            <p className="text-xs text-muted-foreground">Units in stock</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(getTotalInventoryValue())}</div>
            <p className="text-xs text-muted-foreground">Total value at cost</p>
          </CardContent>
        </Card>
      </div>

      {lowStockProducts.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Low Stock Alert</AlertTitle>
          <AlertDescription>
            {lowStockProducts.length} {lowStockProducts.length === 1 ? "product needs" : "products need"} restocking
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">All Products</TabsTrigger>
          <TabsTrigger value="low-stock">
            Low Stock
            {lowStockProducts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {lowStockProducts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, or barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-4">
            {filteredProducts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No products found</p>
                </CardContent>
              </Card>
            ) : (
              filteredProducts.map((product) => {
                const baseUnit = product.sellableUnits.find((u) => u.isBaseUnit)
                const isLowStock = product.stock <= settings.lowStockThreshold
                const isOutOfStock = product.stock === 0

                return (
                  <Card key={product.productId}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl || "/placeholder.svg"}
                              alt={product.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="w-8 h-8 text-muted-foreground" />
                          )}
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{product.productName}</h3>
                            {product.variantName !== "Regular" && (
                              <Badge variant="outline">{product.variantName}</Badge>
                            )}
                            {isOutOfStock && <Badge variant="destructive">Out of Stock</Badge>}
                            {!isOutOfStock && isLowStock && <Badge variant="secondary">Low Stock</Badge>}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            <span>SKU: {product.sku}</span>
                            <span>Barcode: {product.barcode}</span>
                            <span>Category: {product.category}</span>
                          </div>
                          {baseUnit && (
                            <div className="mt-1 text-sm">
                              <span className="font-medium">{formatCurrency(baseUnit.price)}</span>
                              <span className="text-muted-foreground"> / {baseUnit.unitName}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold">{product.stock}</div>
                            <div className="text-xs text-muted-foreground">Units</div>
                          </div>

                          <Dialog
                            open={editingProduct === product.productId}
                            onOpenChange={(open) => {
                              if (open) {
                                setEditingProduct(product.productId)
                                setNewStock(product.stock.toString())
                              } else {
                                setEditingProduct(null)
                                setNewStock("")
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Edit className="w-4 h-4 mr-2" />
                                Update Stock
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Update Stock - {product.productName}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="new-stock">Current Stock: {product.stock}</Label>
                                  <Input
                                    id="new-stock"
                                    type="number"
                                    min="0"
                                    value={newStock}
                                    onChange={(e) => setNewStock(e.target.value)}
                                    placeholder="Enter new stock quantity"
                                  />
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      setEditingProduct(null)
                                      setNewStock("")
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                  <Button onClick={handleUpdateStock}>Update</Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="low-stock" className="space-y-4">
          {lowStockProducts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">All products are well stocked</p>
              </CardContent>
            </Card>
          ) : (
            lowStockProducts.map((alert) => {
              const product = products.find((p) => p.productId === alert.productId)
              if (!product) return null

              const baseUnit = product.sellableUnits.find((u) => u.isBaseUnit)

              return (
                <Card key={product.productId} className="border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl || "/placeholder.svg"}
                            alt={product.productName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <TrendingDown className="w-8 h-8 text-orange-600" />
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{product.productName}</h3>
                          <Badge variant={alert.alertType === "out" ? "destructive" : "secondary"}>
                            {alert.alertType === "out" ? "Out of Stock" : "Low Stock"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>SKU: {product.sku}</span>
                          <span>Current: {alert.currentStock} units</span>
                          <span>Min: {alert.minimumStock} units</span>
                        </div>
                        {baseUnit && (
                          <div className="mt-1 text-sm">
                            <span className="font-medium">{formatCurrency(baseUnit.price)}</span>
                            <span className="text-muted-foreground"> / {baseUnit.unitName}</span>
                          </div>
                        )}
                      </div>

                      <Dialog
                        open={editingProduct === product.productId}
                        onOpenChange={(open) => {
                          if (open) {
                            setEditingProduct(product.productId)
                            setNewStock(product.stock.toString())
                          } else {
                            setEditingProduct(null)
                            setNewStock("")
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button>
                            <Package className="w-4 h-4 mr-2" />
                            Restock
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Restock - {product.productName}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="restock-amount">Current Stock: {product.stock}</Label>
                              <Input
                                id="restock-amount"
                                type="number"
                                min="0"
                                value={newStock}
                                onChange={(e) => setNewStock(e.target.value)}
                                placeholder="Enter new stock quantity"
                              />
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  setEditingProduct(null)
                                  setNewStock("")
                                }}
                              >
                                Cancel
                              </Button>
                              <Button onClick={handleUpdateStock}>Update Stock</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
