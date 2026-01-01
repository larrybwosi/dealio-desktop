import { memo, useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
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

export const ProductCard = memo(({ product, onAddToCart, pricingMode, customPriceCalculator }: ProductProps) => {
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

  const hasMultipleVariants = product.variants.length > 1;
  const hasMultipleUnits = currentVariant?.sellableUnits?.length > 1;

  return (
    <Card className={cn(
        "group flex flex-col h-full overflow-hidden border-border/60 shadow-sm transition-all duration-300",
        "hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5 bg-card/50 backdrop-blur-sm"
    )}>
      
      {/* --- Image Section --- */}
      <div className="relative aspect-[4/3] w-full bg-muted/10 overflow-hidden border-b border-border/30">
        {!imgError && product.imageUrl ? (
          <img
            src={convertFileSrc(product.imageUrl)}
            alt={product.name}
            onError={() => setImgError(true)}
            className={cn(
              'object-cover w-full h-full transition-transform duration-700 ease-out group-hover:scale-105',
              isOutOfStock && 'grayscale opacity-60'
            )}
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground/20 bg-muted/5">
            <ImageOff className="w-12 h-12 mb-2" />
            <span className="text-[10px] uppercase font-semibold tracking-wider">No Image</span>
          </div>
        )}
        
        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-10 items-start">
          {isOutOfStock && (
            <Badge variant="destructive" className="shadow-sm font-bold uppercase text-[10px] tracking-wider px-2 py-0.5">
              Sold Out
            </Badge>
          )}
          {isLowStock && !isOutOfStock && (
            <Badge variant="secondary" className="bg-amber-100/90 text-amber-700 border-amber-200/50 backdrop-blur-md shadow-sm text-[10px] font-medium px-2 py-0.5">
              Only {stock} left
            </Badge>
          )}
          {pricingMode === 'wholesale' && (
            <Badge className="bg-blue-600/90 hover:bg-blue-700 text-white backdrop-blur-md shadow-sm text-[10px] gap-1 px-2 py-0.5">
              <Tag className="w-3 h-3" /> Wholesale
            </Badge>
          )}
        </div>

        {/* Category Overlay (Bottom Left) */}
        {!isOutOfStock && (
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                <span className="text-[10px] font-medium text-white/90 uppercase tracking-wider px-1">
                    {product.category}
                </span>
            </div>
        )}
      </div>

      {/* --- Content Section --- */}
      <div className="flex flex-col flex-1 p-2 ">
        
        {/* Title & SKU */}
        <div>
            <h3 className="font-semibold text-sm leading-snug line-clamp-2 min-h-[2.5rem] text-foreground/90 group-hover:text-primary transition-colors">
                {product.name}
            </h3>
            <div className="flex items-center justify-between">
                 <span className="text-[10px] font-mono text-muted-foreground/70 flex items-center gap-1">
                   <Package className="w-3 h-3" /> {currentVariant?.sku}
                </span>
            </div>
        </div>

        {/* Selectors Area */}
        <div className="space-y-2 pt-1 border-t border-dashed border-border/50 mt-1">
             {/* Dynamic Selectors Row */}
             {(hasMultipleVariants || hasMultipleUnits) && (
                <div className="grid grid-cols-2 gap-2">
                    {hasMultipleVariants && (
                         <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                            <SelectTrigger className="h-7 text-[11px] bg-background/50 border-input/60 focus:ring-1 focus:ring-primary/20">
                                <span className="truncate">{currentVariant.name}</span>
                            </SelectTrigger>
                            <SelectContent>
                                {product.variants.map((v) => (
                                    <SelectItem key={v.variantId} value={v.variantId} className="text-xs">
                                        {v.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                         </Select>
                    )}
                    
                    {hasMultipleUnits && (
                        <Select value={selectedUnitId} onValueChange={setSelectedUnitId} disabled={isOutOfStock}>
                            <SelectTrigger className={cn("h-7 text-[11px] bg-background/50 border-input/60 focus:ring-1 focus:ring-primary/20", !hasMultipleVariants && "col-span-2")}>
                                 <span className="truncate">{currentUnit?.unitName}</span>
                            </SelectTrigger>
                            <SelectContent>
                                {currentVariant.sellableUnits.map((u) => (
                                    <SelectItem key={u.unitId} value={u.unitId} className="text-xs">
                                        {u.unitName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
             )}

            {/* Price & Unit (If simplified view or single unit) */}
            <div className="flex items-end justify-between bg-muted/30 p-2 rounded-md">
                <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                        {currentUnit?.unitName || 'Price'}
                    </span>
                    <span className={cn("font-bold text-lg leading-none tracking-tight", pricingMode === 'wholesale' ? "text-blue-600" : "text-primary")}>
                         {formatCurrency(price)}
                    </span>
                </div>
                
                {/* Quantity input mini */}
                {!isOutOfStock && (
                <div className="flex items-center h-7 bg-background shadow-sm rounded-md border border-input/40">
                    <button 
                        onClick={() => handleQtyChange(qty - 1)}
                        disabled={qty <= 0}
                        className="h-full px-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-l-md disabled:opacity-30 transition-colors"
                    >
                        <Minus className="w-3 h-3" />
                    </button>
                    <div className="w-px h-3 bg-border" />
                    <Input 
                         type="number"
                         value={qty > 0 ? qty : ''} 
                         onChange={(e) => handleQtyChange(parseInt(e.target.value) || 0)}
                         placeholder="0"
                         className="w-10 h-full border-0 p-0 text-center text-xs focus-visible:ring-0 shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none bg-transparent"
                    />
                     <div className="w-px h-3 bg-border" />
                    <button 
                        onClick={() => handleQtyChange(qty + 1)}
                        disabled={qty >= stock}
                        className="h-full px-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-r-md disabled:opacity-30 transition-colors"
                    >
                        <Plus className="w-3 h-3" />
                    </button>
                </div>
                )}
            </div>
        </div>

        {/* Action Button */}
        <div className="mt-auto pt-2">
            <Button
                className={cn(
                    "w-full h-9 shadow-sm font-medium tracking-wide text-xs transition-all active:scale-[0.98]", 
                    qty > 0 ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-primary/90 hover:bg-primary"
                )}
                disabled={isOutOfStock}
                onClick={handleAdd}
                variant={qty > 0 ? "default" : "secondary"}
                size="sm"
            >
                {qty > 0 ? (
                    <>Add {qty} to Order</>
                ) : (
                    <>
                     <ShoppingCart className="w-3.5 h-3.5 mr-2 opacity-70" />
                     Add to Cart
                    </>
                )}
            </Button>
        </div>
      </div>
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';