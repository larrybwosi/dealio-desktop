import { memo, useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Minus, Plus, ShoppingCart, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
    currency: 'USD', // Change to your local currency
  }).format(amount);
};

export const ProductCard = memo(({ product, onAddToCart, pricingMode }: ProductProps) => {
  const [selectedVariantId, setSelectedVariantId] = useState<string>(
    product.variants[0]?.variantId
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [qty, setQty] = useState<number>(0);

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

  // Calculate Price
  const price = useMemo(() => {
    if (!currentUnit) return 0;
    if (pricingMode === 'wholesale') {
      const wp = Number(currentUnit.wholesalePrice);
      return wp > 0 ? wp : Number(currentUnit.price);
    }
    return Number(currentUnit.price);
  }, [currentUnit, pricingMode]);

  const handleAdd = () => {
    if (qty <= 0 || !currentVariant || !currentUnit) return;

    onAddToCart({
      product: { ...product, imageUrls: [product.imageUrl] },
      variant: currentVariant,
      unit: { ...currentUnit, price },
      quantity: qty,
    });
    setQty(0);
  };

  const handleQtyChange = (val: number) => {
    if (val < 0) return;
    if (val > stock) return;
    setQty(val);
  };

  return (
    <Card className="group relative flex flex-col h-full overflow-hidden border-border/50 transition-all duration-300 hover:shadow-lg hover:border-primary/50">
      
      {/* --- Image Area --- */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        <img
          src={product.imageUrl || '/placeholder.svg?height=300&width=400'}
          alt={product.name}
          className={cn(
            'object-cover w-full h-full transition-transform duration-700 group-hover:scale-110',
            isOutOfStock && 'grayscale opacity-60'
          )}
          loading="lazy"
        />
        
        {/* Floating Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isOutOfStock ? (
            <Badge variant="destructive" className="font-bold shadow-sm">
              SOLD OUT
            </Badge>
          ) : stock < 10 ? (
            <Badge variant="secondary" className="text-orange-600 bg-orange-100 font-semibold shadow-sm">
              Low Stock
            </Badge>
          ) : null}
          {pricingMode === 'wholesale' && (
            <Badge className="bg-blue-600 text-white shadow-sm w-fit">Wholesale</Badge>
          )}
        </div>
      </div>

      {/* --- Content Area --- */}
      <div className="flex flex-col flex-1 p-4 space-y-4">
        
        {/* Header & Price */}
        <div className="space-y-1">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-semibold text-base leading-tight line-clamp-2" title={product.name}>
              {product.name}
            </h3>
            <div className="text-lg font-bold text-primary shrink-0">
              {formatCurrency(price)}
            </div>
          </div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {product.category}
          </p>
        </div>

        {/* Controls Section */}
        <div className="space-y-3 mt-auto pt-2">
          
          {/* Variant Selector (Hide if single variant) */}
          {product.variants.length > 1 && (
            <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
              <SelectTrigger className="h-8 text-xs w-full bg-muted/30">
                <span className="text-muted-foreground mr-2">Variant:</span>
                <SelectValue />
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

          {/* Unit Selector (Hide if single unit) */}
          {currentVariant && currentVariant.sellableUnits.length > 1 && (
            <Select value={selectedUnitId} onValueChange={setSelectedUnitId} disabled={isOutOfStock}>
              <SelectTrigger className="h-8 text-xs w-full bg-muted/30">
                 <span className="text-muted-foreground mr-2">Unit:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentVariant.sellableUnits.map((unit) => (
                  <SelectItem key={unit.unitId} value={unit.unitId} className="text-xs">
                    {unit.unitName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Action Row: Quantity + Add Button */}
          <div className="flex items-center gap-2">
            {/* Quantity Control */}
            <div className={cn(
                "flex items-center rounded-md border bg-background transition-colors focus-within:ring-1 focus-within:ring-ring",
                isOutOfStock ? "opacity-50 pointer-events-none" : ""
              )}>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-8 rounded-l-md hover:bg-transparent text-muted-foreground hover:text-foreground"
                disabled={qty <= 0}
                onClick={() => handleQtyChange(qty - 1)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Input
                type="number"
                className="h-9 w-10 border-0 p-0 text-center text-sm shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none"
                value={qty > 0 ? qty : ''}
                placeholder="0"
                onChange={(e) => handleQtyChange(parseInt(e.target.value) || 0)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-8 rounded-r-md hover:bg-transparent text-muted-foreground hover:text-foreground"
                disabled={qty >= stock}
                onClick={() => handleQtyChange(qty + 1)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>

            {/* Add to Cart Button */}
            <Button
              className="flex-1 h-9 shadow-sm"
              disabled={isOutOfStock || qty <= 0}
              onClick={handleAdd}
            >
              <ShoppingCart className="w-4 h-4 mr-2" />
              {isOutOfStock ? 'No Stock' : 'Add'}
            </Button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between pt-2 border-t border-dashed text-[10px] text-muted-foreground">
           <div className="flex items-center gap-1">
             <Package className="w-3 h-3" />
             <span className="font-mono">{currentVariant?.sku}</span>
           </div>
           <span>{stock} available</span>
        </div>
      </div>
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';