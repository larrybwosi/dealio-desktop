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
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// --- Types ---
interface Unit {
  unitId: string;
  unitName: string;
  price: string | number;
  wholesalePrice?: string | number;
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
}

// --- Helper ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const ProductCard = memo(({ product, onAddToCart, pricingMode }: ProductProps) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants[0]?.variantId
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [qty, setQty] = useState<number>(0);
  const [imgError, setImgError] = useState(false);

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
    if (pricingMode === 'wholesale') {
      const wp = Number(currentUnit.wholesalePrice);
      return wp > 0 ? wp : Number(currentUnit.price);
    }
    return Number(currentUnit.price);
  }, [currentUnit, pricingMode]);

  // --- MODIFIED LOGIC START ---
  const handleAdd = () => {
    if (!currentVariant || !currentUnit) return;
    
    // If user hasn't selected a number (qty is 0), default to 1
    const quantityToAdd = qty > 0 ? qty : 1;

    // specific check to ensure we don't add 1 if stock is actually 0
    if (quantityToAdd > stock) return; 

    onAddToCart({
      product: { ...product, imageUrls: [product.imageUrl] },
      variant: currentVariant,
      unit: { ...currentUnit, price },
      quantity: quantityToAdd,
    });
    setQty(0); // Reset after adding
  };
  // --- MODIFIED LOGIC END ---

  const handleQtyChange = (val: number) => {
    if (val < 0) return;
    if (val > stock) return; 
    setQty(val);
  };

  return (
    <Card className={cn(
        "group relative flex flex-col h-full overflow-hidden border-border transition-all duration-300",
        "hover:shadow-md hover:border-primary/40 bg-card"
    )}>
      
      {/* --- Image Section --- */}
      <div className="relative aspect-[4/3] w-full bg-muted/20 overflow-hidden border-b border-border/50">
        {!imgError && product.imageUrl ? (
          <img
            src={product.imageUrl}
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
            <ImageOff className="w-10 h-10 mb-2" />
            <span className="text-xs font-medium">No Image</span>
          </div>
        )}
        
        {/* Status Badges Overlay */}
        <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10">
          {isOutOfStock && (
            <Badge variant="destructive" className="shadow-sm font-semibold uppercase text-[10px] tracking-wider">
              Sold Out
            </Badge>
          )}
          {isLowStock && !isOutOfStock && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 shadow-sm text-[10px] font-medium">
              Only {stock} left
            </Badge>
          )}
          {pricingMode === 'wholesale' && (
            <Badge className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm w-fit text-[10px] gap-1">
              <Tag className="w-3 h-3" /> Wholesale
            </Badge>
          )}
        </div>
      </div>

      {/* --- Content Section --- */}
      {/* MODIFIED: Changed space-y-3 to space-y-2 to reduce distance between Name and Separator */}
      <div className="flex flex-col flex-1 p-3 space-y-2">
        
        {/* Title & Category */}
        <div className="space-y-1">
            <div className="flex justify-between items-start gap-2">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-sm">
                    {product.category}
                </span>
                {/* SKU for quick reference */}
                <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 opacity-70">
                   <Package className="w-3 h-3" /> {currentVariant?.sku}
                </span>
            </div>
            <h3 className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.5rem] group-hover:text-primary transition-colors">
                {product.name}
            </h3>
        </div>

        <Separator className="bg-border/50" />

        {/* Dynamic Controls (Variants/Units) and Price in one row */}
        <div className="space-y-2">
            {/* If we have multiple variants OR multiple units, we show selectors */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                {/* Variant and Unit Selectors */}
                <div className="grid grid-cols-2 gap-2 flex-1">
                    {product.variants.length > 1 ? (
                         <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
                            <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/60">
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
                    ) : <div />} {/* Spacer if no variant selector */}

                    {currentVariant?.sellableUnits?.length > 1 ? (
                        <Select value={selectedUnitId} onValueChange={setSelectedUnitId} disabled={isOutOfStock}>
                            <SelectTrigger className="h-7 text-xs bg-muted/20 border-border/60">
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
                    ) : <div />} {/* Spacer if no unit selector */}
                </div>

                {/* Price Display - Moved here to be in the same row */}
                <div className="flex flex-col items-end min-w-[100px]">
                    <span className="text-[10px] text-muted-foreground font-medium text-right">
                        Price
                    </span>
                    <span className={cn("text-xl font-bold tracking-tight", pricingMode === 'wholesale' ? "text-blue-600" : "text-foreground")}>
                        {formatCurrency(price)}
                    </span>
                    <span className="text-[9px] text-muted-foreground text-right">
                        per {currentUnit?.unitName}
                    </span>
                </div>
            </div>
        </div>

        {/* Footer: Actions Only */}
        <div className="mt-auto pt-1">
            {/* Action Bar */}
            <div className="flex items-center gap-2 h-9">
                {/* Quantity Segmented Control */}
                <div className={cn(
                    "flex items-center h-full rounded-md border bg-background shadow-sm",
                    isOutOfStock ? "opacity-50 pointer-events-none" : "hover:border-primary/50"
                )}>
                    <button
                        className="h-full px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-l-md transition-colors disabled:opacity-50"
                        disabled={qty <= 0}
                        onClick={() => handleQtyChange(qty - 1)}
                    >
                        <Minus className="w-3.5 h-3.5" />
                    </button>
                    
                    <div className="h-4 w-px bg-border/50" />
                    
                    <Input
                        type="number"
                        className="h-full w-10 border-0 p-0 text-center text-sm focus-visible:ring-0 shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none"
                        value={qty > 0 ? qty : ''}
                        placeholder="0"
                        onChange={(e) => handleQtyChange(parseInt(e.target.value) || 0)}
                    />
                    
                    <div className="h-4 w-px bg-border/50" />

                    <button
                        className="h-full px-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-r-md transition-colors disabled:opacity-50"
                        disabled={qty >= stock}
                        onClick={() => handleQtyChange(qty + 1)}
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                </div>

                {/* Add Button */}
                <Button
                    className={cn(
                        "flex-1 h-full shadow-sm text-xs font-semibold uppercase tracking-wide", 
                        qty > 0 ? "animate-in zoom-in-95 duration-200" : ""
                    )}
                    /* MODIFIED: Removed 'qty <= 0' check so it's only disabled if out of stock */
                    disabled={isOutOfStock}
                    onClick={handleAdd}
                    variant={qty > 0 ? "default" : "secondary"}
                >
                    <ShoppingCart className="w-3.5 h-3.5 mr-2" />
                    {/* Optional: You could change text to "Add 1" if qty is 0, but "Add" works fine */}
                    Add
                </Button>
            </div>
        </div>
      </div>
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';