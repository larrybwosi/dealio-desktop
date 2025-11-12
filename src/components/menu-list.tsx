"use client"

import { useState, useMemo } from "react"
import { usePosStore } from "@/lib/store"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Minus, Plus, Search, Scan } from "lucide-react"
import { cn } from "@/lib/utils"
import { BarcodeScannerDialog } from "./barcode-scanner-dialog"

export function MenuList() {
  const [activeCategory, setActiveCategory] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>({})
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false)

  const products = usePosStore((state) => state.products)
  const addItemToOrder = usePosStore((state) => state.addItemToOrder)

  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category))
    return ["all", ...Array.from(cats)]
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory = activeCategory === "all" || product.category === activeCategory
      const matchesSearch =
        product.productName.toLowerCase().includes(searchQuery.toLowerCase()) || product.barcode.includes(searchQuery)
      return matchesCategory && matchesSearch
    })
  }, [products, activeCategory, searchQuery])

  const handleQuantityChange = (productId: string, delta: number) => {
    setQuantities((prev) => ({
      ...prev,
      [productId]: Math.max(0, (prev[productId] || 0) + delta),
    }))
  }

  const handleAddToCart = (productId: string) => {
    const product = products.find((p) => p.productId === productId)
    if (!product) return

    const quantity = quantities[productId] || 1
    const selectedUnitId = selectedUnits[productId] || product.sellableUnits[0].unitId
    const selectedUnit = product.sellableUnits.find((u) => u.unitId === selectedUnitId)

    if (!selectedUnit) return

    if (quantity > 0) {
      addItemToOrder(product, selectedUnit, quantity)
      setQuantities((prev) => ({ ...prev, [productId]: 0 }))
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Menu List</h2>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowBarcodeScanner(true)} className="gap-2">
            <Scan className="w-4 h-4" />
            Scan Barcode
          </Button>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search menu or barcode"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-6 border-b border-border">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={cn(
              "px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              activeCategory === category
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {filteredProducts.map((product) => (
          <Card key={product.productId} className="overflow-hidden">
            <div className="relative h-40 bg-muted">
              <img
                src={product.imageUrl || "/placeholder.svg?height=200&width=300"}
                alt={product.productName}
                className="object-cover h-40 w-[400px]"
              />
            </div>

            <div className="p-4 space-y-3">
              <div>
                <h3 className="font-semibold">{product.productName}</h3>
                <p className="text-xs text-muted-foreground">{product.variantName}</p>
              </div>

              <Select
                value={selectedUnits[product.productId] || product.sellableUnits[0].unitId}
                onValueChange={(value) => setSelectedUnits((prev) => ({ ...prev, [product.productId]: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {product.sellableUnits.map((unit) => (
                    <SelectItem key={unit.unitId} value={unit.unitId}>
                      {unit.unitName} - KSH. {unit.price.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <div className="flex items-center border border-border rounded-md">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuantityChange(product.productId, -1)}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-8 text-center text-sm">{quantities[product.productId] || 0}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleQuantityChange(product.productId, 1)}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>

                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  onClick={() => handleAddToCart(product.productId)}
                >
                  + Add to cart
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">Stock: {product.stock}</div>
            </div>
          </Card>
        ))}
      </div>

      <BarcodeScannerDialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner} />
    </div>
  )
}
