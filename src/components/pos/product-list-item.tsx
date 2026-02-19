import { memo, useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Minus, Plus, ShoppingCart, Package, ImageOff, Tag } from 'lucide-react';
import { cn, useFormattedCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { convertFileSrc } from '@tauri-apps/api/core';

// --- Types ---
// Reusing types from ProductCard for consistency
interface Unit {
  unitId: string;
  unitName: string;
  price: string | number;
  wholesalePrice?: string | number;
  isBaseUnit?: boolean;
}

interface Variant {
  variantId: string;
  name: string;
  sku: string;
  stock: number;
  sellableUnits: Unit[];
}

interface Product {
  productId?: string;
  name: string;
  category: string;
  imageUrl?: string;
  totalStock: number;
  variants: Variant[];
}

interface ProductProps {
  product: Product;
  onAddToCart: (item: any) => void;
  pricingMode: 'retail' | 'wholesale';
  customPriceCalculator?: (variantId: string, unitId: string, isBaseUnit?: boolean) => number | null;
}

export const ProductListItem = memo(({ product, onAddToCart, pricingMode, customPriceCalculator }: ProductProps) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants[0]?.variantId
  );

  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [qty, setQty] = useState<number>(0);
  const [imgError, setImgError] = useState(false);
  const formatCurrency = useFormattedCurrency();

  // Derive Current Variant
  const currentVariant = useMemo(
    () => product.variants.find((v) => v.variantId === selectedVariantId) || product.variants[0],
    [product.variants, selectedVariantId]
  );

  // Auto-select first unit when variant changes
  useEffect(() => {
    if (currentVariant?.sellableUnits?.length > 0) {
      setSelectedUnitId(currentVariant.sellableUnits[0].unitId);
    }
    setQty(0);
  }, [currentVariant]);

  // Derive Current Unit
  const currentUnit = useMemo(
    () => currentVariant?.sellableUnits.find((u) => u.unitId === selectedUnitId),
    [currentVariant, selectedUnitId]
  );

  const stock = currentVariant?.stock || 0;
  const isOutOfStock = stock <= 0;
  const isLowStock = stock > 0 && stock < 10;

  // Calculate Price
  const price = useMemo(() => {
    if (!currentUnit) return 0;

    // 1. Try Custom Pricing (Customer Specific)
    if (customPriceCalculator) {
        const customPrice = customPriceCalculator(currentVariant.variantId, currentUnit.unitId, currentUnit.isBaseUnit);
        if (customPrice !== null) return customPrice;
    }

    // 2. Default Logic
    if (pricingMode === 'wholesale') {
      const wp = Number(currentUnit.wholesalePrice);
      return wp > 0 ? wp : Number(currentUnit.price);
    }
    return Number(currentUnit.price);
  }, [currentUnit, pricingMode, customPriceCalculator, currentVariant.variantId]);

  const handleAdd = () => {
    if (!currentVariant || !currentUnit) return;
    
    const quantityToAdd = qty > 0 ? qty : 1;
    if (quantityToAdd > stock) return; 

    onAddToCart({
      product: { ...product, imageUrls: [product.imageUrl] },
      variant: currentVariant,
      unit: { ...currentUnit, price },
      quantity: quantityToAdd,
    });
    setQty(0);
  };

  const handleQtyChange = (val: number) => {
    if (val < 0) return;
    if (val > stock) return; 
    setQty(val);
  };

  return (
    <div className={cn(
        "group relative flex items-center w-full overflow-hidden border rounded-xs bg-card transition-all duration-200",
        "hover:shadow-sm hover:border-primary/40 p-1.5 gap-2.5"
    )}>
      
      {/* --- Image Section (Small Thumbnail) --- */}
      <div className="relative h-12 w-12 shrink-0 rounded-md bg-muted/20 overflow-hidden border border-border/50">
        {!imgError && product.imageUrl ? (
          <img
            src={convertFileSrc(product.imageUrl)}
            alt={product.name}
            onError={() => setImgError(true)}
            className={cn(
              'object-cover w-full h-full transition-transform duration-500 group-hover:scale-105',
              isOutOfStock && 'grayscale opacity-50'
            )}
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground/30">
            <ImageOff className="w-5 h-5 mb-0.5" />
          </div>
        )}
        
        {/* Status Badges Overlay (Simplified for List) */}
        {(isOutOfStock || isLowStock) && (
             <div className="absolute inset-x-0 bottom-0 bg-background/80 backdrop-blur-[1px] text-[9px] font-bold text-center py-0.5">
                {isOutOfStock ? (
                     <span className="text-destructive">SOLD OUT</span>
                ) : (
                    <span className="text-amber-600">{stock} LEFT</span>
                )}
             </div>
        )}
      </div>

      {/* --- Info Section --- */}
      <div className="flex flex-col flex-1 min-w-0 gap-1">
         <div className="flex items-start justify-between">
            <div className="flex flex-col">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-sm">
                        {product.category}
                    </span>
                    {pricingMode === 'wholesale' && (
                        <Badge className="h-4 px-1 bg-blue-600 text-white text-[9px] gap-0.5">
                            <Tag className="w-2.5 h-2.5" /> Wholesale
                        </Badge>
                    )}
                </div>
                <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors mt-0.5">
                    {product.name}
                </h3>
                 <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 opacity-70">
                   <Package className="w-3 h-3" /> {currentVariant?.sku}
                </span>
            </div>
            
             {/* Price Display */}
            <div className="flex flex-col items-end">
                <span className={cn("font-bold text-sm tracking-tight", pricingMode === 'wholesale' ? "text-blue-600" : "text-foreground")}>
                    {formatCurrency(price)}
                </span>
                <span className="text-[10px] text-muted-foreground text-right leading-tight">
                    per {currentUnit?.unitName}
                </span>
            </div>
         </div>

         {/* --- Controls Section --- */}
         <div className="flex items-center gap-2 mt-0.5">
             
            {/* Variant/Unit Selectors */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
                {product.variants.length > 1 && (
                        <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                        <SelectTrigger className="h-6 text-[10px] bg-muted/20 border-border/60 w-[110px]">
                            <span className="truncate">{currentVariant.name}</span>
                        </SelectTrigger>
                        <SelectContent>
                            {product.variants.map((v) => (
                                <SelectItem key={v.variantId} value={v.variantId} className="text-[10px]">
                                    {v.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                )}

                {currentVariant?.sellableUnits?.length > 1 && (
                    <Select value={selectedUnitId} onValueChange={setSelectedUnitId} disabled={isOutOfStock}>
                        <SelectTrigger className="h-6 text-[10px] bg-muted/20 border-border/60 w-[90px]">
                                <span className="truncate">{currentUnit?.unitName}</span>
                        </SelectTrigger>
                        <SelectContent>
                            {currentVariant.sellableUnits.map((u) => (
                                <SelectItem key={u.unitId} value={u.unitId} className="text-[10px]">
                                    {u.unitName}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {/* Quantity & Add */}
            <div className="flex items-center gap-1.5 h-7 shrink-0">
                 {/* Quantity Segmented Control */}
                <div className={cn(
                    "flex items-center h-full rounded-md border bg-background shadow-sm",
                    isOutOfStock ? "opacity-50 pointer-events-none" : "hover:border-primary/50"
                )}>
                    <button
                        className="h-full px-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-l-md transition-colors disabled:opacity-50"
                        disabled={qty <= 0}
                        onClick={() => handleQtyChange(qty - 1)}
                    >
                        <Minus className="w-3 h-3" />
                    </button>
                    
                    <div className="h-4 w-px bg-border/50" />
                    
                    <Input
                        type="number"
                        className="h-full w-9 border-0 p-0 text-center text-sm focus-visible:ring-0 shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={qty > 0 ? qty : ''}
                        placeholder="0"
                        onChange={(e) => handleQtyChange(parseInt(e.target.value) || 0)}
                    />
                    
                    <div className="h-4 w-px bg-border/50" />

                    <button
                        className="h-full px-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-r-md transition-colors disabled:opacity-50"
                        disabled={qty >= stock}
                        onClick={() => handleQtyChange(qty + 1)}
                    >
                        <Plus className="w-3 h-3" />
                    </button>
                </div>

                <Button
                    className={cn(
                        "h-full shadow-sm text-xs font-semibold uppercase tracking-wide", 
                        qty > 0 ? "animate-in zoom-in-95 duration-200" : ""
                    )}
                    disabled={isOutOfStock}
                    onClick={handleAdd}
                    variant={qty > 0 ? "default" : "secondary"}
                    size="sm"
                >
                    <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                    Add
                </Button>
            </div>
         </div>
      </div>
    </div>
  );
});

ProductListItem.displayName = 'ProductListItem';
