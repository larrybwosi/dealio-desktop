'use client';

import { memo, useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

// Types based on your API response
interface ProductProps {
  product: any; // Type this strictly based on your API return
  onAddToCart: (item: any) => void;
  pricingMode: 'retail' | 'wholesale';
}

export const ProductCard = memo(({ product, onAddToCart, pricingMode }: ProductProps) => {
  // 1. Local State: Select the first variant by default
  const [selectedVariantId, setSelectedVariantId] = useState<string>(product.variants[0]?.variantId);
  const [qty, setQty] = useState<number>(0);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  // 2. Derived State: Get the actual variant object
  const currentVariant = useMemo(
    () => product.variants.find((v: any) => v.variantId === selectedVariantId) || product.variants[0],
    [product.variants, selectedVariantId]
  );

  // 3. Effect: When variant changes, reset unit to the default (first one)
  useEffect(() => {
    if (currentVariant?.sellableUnits?.length > 0) {
      setSelectedUnitId(currentVariant.sellableUnits[0].unitId);
    }
    setQty(0); // Reset quantity on variant switch
  }, [currentVariant]);

  // 4. Derived State: Get the actual unit object
  const currentUnit = useMemo(
    () => currentVariant?.sellableUnits.find((u: any) => u.unitId === selectedUnitId),
    [currentVariant, selectedUnitId]
  );

  const stock = currentVariant?.stock || 0;
  const isOutOfStock = stock <= 0;

  // 5. Price Calculation Logic
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
      product: { ...product, imageUrls: [product.imageUrl] }, // Normalize to store expectation
      variant: currentVariant,
      unit: { ...currentUnit, price }, // Pass resolved price
      quantity: qty,
    });
    setQty(0); // Reset after adding
  };

  return (
    <Card className={cn('overflow-hidden flex flex-col h-full', isOutOfStock && 'opacity-75')}>
      {/* Image Section */}
      <div className="relative h-40 bg-muted group">
        <img
          src={product.imageUrl || '/placeholder.svg?height=200&width=300'}
          alt={product.name}
          className={cn('object-cover h-40 w-full transition-transform duration-500 group-hover:scale-105', isOutOfStock && 'grayscale')}
          loading="lazy"
        />
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Badge variant="destructive" className="font-bold">OUT OF STOCK</Badge>
          </div>
        )}
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          Total Stock: {product.totalStock}
        </div>
      </div>

      <div className="p-4 space-y-3 flex-1 flex flex-col">
        {/* Header */}
        <div>
          <h3 className="font-semibold leading-tight line-clamp-1" title={product.name}>
            {product.name}
          </h3>
          <p className="text-xs text-muted-foreground">{product.category}</p>
        </div>

        {/* Variant Selector (Only show if > 1 variant) */}
        {product.variants.length > 1 ? (
          <Select value={selectedVariantId} onValueChange={setSelectedVariantId}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Select Variant" />
            </SelectTrigger>
            <SelectContent>
              {product.variants.map((v: any) => (
                <SelectItem key={v.variantId} value={v.variantId} className="text-xs">
                  {v.name} (Qty: {v.stock})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="text-xs font-medium text-muted-foreground h-8 flex items-center">
             {currentVariant?.name}
          </div>
        )}

        {/* Unit Selector */}
        <Select value={selectedUnitId} onValueChange={setSelectedUnitId} disabled={isOutOfStock}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currentVariant?.sellableUnits.map((unit: any) => {
              // Calculate price for display in dropdown
              const displayPrice = pricingMode === 'wholesale' && Number(unit.wholesalePrice) > 0 
                ? Number(unit.wholesalePrice) 
                : Number(unit.price);
                
              return (
                <SelectItem key={unit.unitId} value={unit.unitId}>
                  <div className="flex items-center justify-between w-full gap-4 text-xs">
                    <span>{unit.unitName}</span>
                    <span className="font-mono font-medium">
                      {displayPrice.toLocaleString()}
                    </span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Quantity & Add Button */}
        <div className="flex items-center gap-2 mt-auto">
          <div className="flex items-center border border-input rounded-md h-9">
            <Button
              variant="ghost"
              size="icon"
              className="h-full w-8 rounded-none rounded-l-md"
              disabled={isOutOfStock || qty <= 0}
              onClick={() => setQty((p) => Math.max(0, p - 1))}
            >
              <Minus className="w-3 h-3" />
            </Button>
            <Input
              type="number"
              className="h-full w-12 border-0 p-0 text-center focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none"
              value={qty > 0 ? qty : ''}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val)) setQty(Math.min(val, stock));
                else setQty(0);
              }}
              placeholder="0"
              disabled={isOutOfStock}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-full w-8 rounded-none rounded-r-md"
              disabled={isOutOfStock || qty >= stock}
              onClick={() => setQty((p) => Math.min(stock, p + 1))}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>

          <Button
            className="flex-1 h-9"
            disabled={isOutOfStock || qty <= 0}
            onClick={handleAdd}
          >
            {isOutOfStock ? 'Empty' : `Add ${qty > 0 ? `(${qty})` : ''}`}
          </Button>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider">
          <span>{currentVariant?.sku}</span>
          <span className={cn(stock < 10 && stock > 0 ? "text-orange-500 font-bold" : "")}>
            Stock: {stock}
          </span>
        </div>
      </div>
    </Card>
  );
});

ProductCard.displayName = 'ProductCard';