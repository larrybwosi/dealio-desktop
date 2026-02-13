"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import {
  Package,
  Trash2,
  Send,
  Building2,
  Loader2,
  X,
  Search,
  PackageSearch,
  ArrowRightLeft,
  Store,
  Layers
} from "lucide-react"
import { useAuthStore } from "@/store/pos-auth-store"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

// --- Custom Hooks ---
import { usePosLocations } from "@/hooks/locations"
import { FileReceiveDialog } from "@/components/file-receive"
import { PosProduct, usePosProducts } from "@/hooks/products"

// --- Interfaces ---

interface ProductVariant {
  variantId: string;
  variantName: string;
  sku: string;
  barcode?: string;
  stock: number;
  price?: number;
}

interface TransferItem {
  id: string
  variantId: string
  productId: string
  productName: string
  variantName?: string | null
  sku: string
  currentStock: number
  quantity: number
  unit: string
  isDefaultVariant: boolean
}

// --- Helper Functions ---

const isDefaultVariant = (variantName?: string | null): boolean => {
  return !variantName || variantName === 'Default' || variantName === 'default';
}

const getProductDisplayName = (productName: string, variantName?: string | null): string => {
  if (variantName && !isDefaultVariant(variantName)) {
    return `${productName} - ${variantName}`;
  }
  return productName;
}

export default function StockTransferCreate() {
  const { currentLocation } = useAuthStore();
  const { locations, isLoading: isLoadingLocations } = usePosLocations();

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [showResults, setShowResults] = useState(false);
  const { products: searchResults, isLoading: isLoadingProducts } = usePosProducts({
    search: searchTerm,
    category: "all",
    enabled: searchTerm.length >= 2 
  });

  // Form State
  const [toBranch, setToBranch] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [items, setItems] = useState<TransferItem[]>([])
  const [attachedFiles, setAttachedFiles] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const availableDestinations = locations.filter(
    loc => loc.id !== currentLocation?.id
  );

  // --- Logic to normalize variants from a product ---
  const getProductVariants = (product: PosProduct): ProductVariant[] => {
    // Handle potential snake_case if backend isn't strictly typed
    const rawVariants = product.variants || (product as any).variants || [];
    
    // Map existing variants
    let variants: ProductVariant[] = rawVariants.map((v: any) => ({
      variantId: v.variantId || v.variant_id,
      variantName: v.variantName || v.variant_name || 'Default',
      barcode: v.barcode,
      sku: v.sku || '',
      stock: typeof v.stock === 'number' ? v.stock : 0,
      price: v.price
    }));

    // If no variants found, treat product as single variant
    if (variants.length === 0) {
      variants.push({
        variantId: product.variantId || `${product.productId}-default`,
        variantName: product.variantName || 'Default',
        sku: product.sku || '',
        stock: product.stock ?? 0,
        barcode: product.barcode,
        price: (product as any).price
      });
    }

    return variants;
  };

  const addItem = (product: PosProduct, specificVariantId?: string) => {
    const allVariants = getProductVariants(product);
    
    // Handle Product Name Safely (fallback for snake_case or missing)
    const safeProductName = product.productName || (product as any).product_name || "Unknown Product";

    // Find selected variant
    let selectedVariant: ProductVariant | null = null;
    if (specificVariantId) {
      selectedVariant = allVariants.find(v => v.variantId === specificVariantId) || null;
    } else {
      selectedVariant = allVariants.find(v => isDefaultVariant(v.variantName)) || allVariants[0];
    }

    if (!selectedVariant) {
      toast.error("Could not determine product variant details");
      return;
    }

    const finalVariantId = selectedVariant.variantId;

    // Check duplicates
    if (items.some(item => item.variantId === finalVariantId)) {
      const displayName = getProductDisplayName(safeProductName, selectedVariant.variantName);
      toast.info(`${displayName} is already in the list`);
      return;
    }

    // Determine unit
    const baseUnit = product.sellableUnits?.find(u => u.isBaseUnit) || product.sellableUnits?.[0];
    const unitName = baseUnit ? baseUnit.unitName : 'unit';

    const newItem: TransferItem = {
      id: Math.random().toString(36).substring(2, 9),
      variantId: finalVariantId,
      productId: product.productId,
      productName: safeProductName, // Use safe name
      variantName: selectedVariant.variantName,
      sku: selectedVariant.sku || selectedVariant.variantName || '',
      currentStock: selectedVariant.stock,
      quantity: 1,
      unit: unitName,
      isDefaultVariant: isDefaultVariant(selectedVariant.variantName)
    };
    
    setItems([...items, newItem]);
    setSearchTerm("");
    setShowResults(false);
    
    toast.success("Item added to transfer");
  };

  const updateQuantity = (id: string, quantity: number) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, quantity: Math.max(0, quantity) } : item
    ));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  // --- File Handling ---
  const handleFileReceived = (filePath: string) => {
    if (!attachedFiles.includes(filePath)) {
      setAttachedFiles(prev => [...prev, filePath]);
      toast.success("File attached successfully");
    }
  };

  const removeFile = (pathToRemove: string) => {
    setAttachedFiles(prev => prev.filter(p => p !== pathToRemove));
  };

  // --- Submission ---
  const handleSubmit = async () => {
    if (!toBranch || items.length === 0) return;

    try {
      setIsSubmitting(true);

      const payload = {
        toLocationId: toBranch,
        items: items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity
        })),
        notes: notes || undefined,
        documents: attachedFiles.length > 0 ? attachedFiles : undefined
      };

      await invoke('submit_stock_transfer', { payload });

      toast.success("Stock transfer created successfully");
      
      // Reset
      setItems([]);
      setNotes("");
      setToBranch("");
      setAttachedFiles([]);
      setSearchTerm("");
      setShowResults(false);

    } catch (error: any) {
      console.error("Failed to create transfer:", error);
      toast.error("Failed to create transfer request", {
        description: error.message || "Unknown error occurred"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTotalItems = () => items.reduce((sum, item) => sum + item.quantity, 0);
  const selectedToBranch = locations.find(b => b.id === toBranch);
  const isFormReady = toBranch && items.length > 0 && !isSubmitting;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Create Stock Transfer</h1>
            <Badge variant="secondary" className="text-xs">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">Transfer inventory between your business locations</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1.5">
            <Store className="h-3.5 w-3.5 mr-1.5" />
            {currentLocation?.name || 'Current Location'}
          </Badge>
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          <Badge variant="outline" className="px-3 py-1.5">
            {selectedToBranch?.name || 'Destination'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Main Form Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Destination Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5" /> 
                Destination Location
              </CardTitle>
              <CardDescription>Select the branch receiving the stock</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="to-branch">To Branch *</Label>
                <Select value={toBranch} onValueChange={setToBranch} disabled={isSubmitting}>
                  <SelectTrigger id="to-branch" className="w-full">
                    <SelectValue placeholder={isLoadingLocations ? "Loading..." : "Choose destination"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDestinations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                          <span>{loc.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Item Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5" /> 
                Transfer Items
              </CardTitle>
              <CardDescription>Search and add products</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Search Bar */}
              <div className="space-y-2 relative">
                <Label htmlFor="product-search">Find Products</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="product-search"
                    type="search"
                    placeholder="Search name, SKU, or barcode..."
                    className="pl-9 pr-10"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowResults(true);
                    }}
                    onFocus={() => setShowResults(true)}
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => { setSearchTerm(""); setShowResults(false); }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {showResults && searchTerm.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 z-50 border rounded-lg shadow-xl mt-1 bg-popover overflow-hidden">
                    {isLoadingProducts ? (
                      <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">No products found</div>
                    ) : (
                      <ScrollArea className="max-h-[400px]">
                        <div className="divide-y">
                          {searchResults.map((product) => {
                            const variants = getProductVariants(product);
                            const availableVariants = variants.filter(v => v.stock > 0);
                            const safeProductName = product.productName || (product as any).product_name || "Unknown Product";

                            // Case 1: Out of Stock (Render Parent with Key)
                            if (availableVariants.length === 0) {
                              return (
                                <div key={product.productId} className="p-3 opacity-60">
                                  <div className="flex justify-between items-center">
                                    <span className="font-medium text-sm">{safeProductName}</span>
                                    <span className="text-xs text-destructive font-medium">Out of Stock</span>
                                  </div>
                                </div>
                              );
                            }

                            // Case 2: Multi-Variant (Render Parent with Key)
                            if (availableVariants.length > 1) {
                              return (
                                <div key={product.productId} className="divide-y">
                                  <div className="p-2 bg-muted/30 flex items-center gap-2">
                                    <Layers className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs font-semibold">{safeProductName}</span>
                                  </div>
                                  {availableVariants.map((variant) => (
                                    <div 
                                      key={variant.variantId}
                                      className="flex justify-between items-center p-3 pl-6 hover:bg-accent cursor-pointer"
                                      onClick={() => addItem(product, variant.variantId)}
                                    >
                                      <div>
                                        <p className="text-sm font-medium">{variant.variantName}</p>
                                        <p className="text-xs text-muted-foreground">Stock: {variant.stock}</p>
                                      </div>
                                      <Button size="sm" variant="secondary" className="h-7 text-xs">Add</Button>
                                    </div>
                                  ))}
                                </div>
                              );
                            }

                            // Case 3: Single Variant (Render Parent with Key = ProductID)
                            // We use product.productId here to avoid collisions if variantId is generic like 'default'
                            const variant = availableVariants[0];
                            const displayName = getProductDisplayName(safeProductName, variant.variantName);
                            
                            return (
                              <div 
                                key={product.productId} 
                                className="flex justify-between items-center p-3 hover:bg-accent cursor-pointer"
                                onClick={() => addItem(product, variant.variantId)}
                              >
                                <div>
                                  <p className="text-sm font-medium">{displayName}</p>
                                  <div className="flex gap-2 text-xs text-muted-foreground">
                                    <span>Stock: {variant.stock}</span>
                                    {variant.sku && <span>SKU: {variant.sku}</span>}
                                  </div>
                                </div>
                                <Button size="sm" variant="default" className="h-8">Add</Button>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Selected Items List */}
              <div className="space-y-4">
                 {items.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed rounded-lg bg-muted/10">
                      <PackageSearch className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">Search products above to build your transfer list</p>
                    </div>
                 ) : (
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.id} className="flex flex-col sm:flex-row items-center justify-between p-3 border rounded-lg bg-card gap-3">
                            <div className="flex-1 text-left w-full">
                              <div className="font-medium text-sm">{getProductDisplayName(item.productName, item.variantName)}</div>
                              <div className="text-xs text-muted-foreground">
                                Available: {item.currentStock} | SKU: {item.sku}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center border rounded-md h-8">
                                <Button 
                                  variant="ghost" size="icon" className="h-8 w-8 rounded-none"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                >-</Button>
                                <div className="w-12 text-center text-sm">{item.quantity}</div>
                                <Button 
                                  variant="ghost" size="icon" className="h-8 w-8 rounded-none"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                  disabled={item.quantity >= item.currentStock}
                                >+</Button>
                              </div>
                              <Button 
                                variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={() => removeItem(item.id)}
                              ><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                 )}
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Sidebar Summary */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Transfer Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold">{getTotalItems()}</div>
                <div className="text-xs text-muted-foreground">Total Units</div>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  placeholder="Optional notes..." 
                  value={notes} 
                  onChange={e => setNotes(e.target.value)}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Attachments ({attachedFiles.length})</Label>
                {attachedFiles.map(file => (
                   <div key={file} className="flex justify-between items-center text-xs bg-muted p-2 rounded">
                      <span className="truncate max-w-[150px]">{file.split(/[\\/]/).pop()}</span>
                      <X className="h-3 w-3 cursor-pointer" onClick={() => removeFile(file)} />
                   </div>
                ))}
                <FileReceiveDialog onFileReceived={handleFileReceived} />
              </div>

              <Button 
                className="w-full" 
                size="lg" 
                onClick={handleSubmit} 
                disabled={!isFormReady}
              >
                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Confirm Transfer
              </Button>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}