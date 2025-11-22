'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePosStore } from '@/store/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, Search, Scan, Store, Truck, AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarcodeScannerDialog } from './barcode-scanner-dialog';
import { usePosProducts } from '@/hooks/products';
import { Skeleton } from './ui/skeleton';

export function ProductList() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // State for Pricing Mode
  const [pricingMode, setPricingMode] = useState<'retail' | 'wholesale'>('retail');

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [selectedUnits, setSelectedUnits] = useState<Record<string, string>>({});

  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Store hook
  const addItemToOrder = usePosStore(state => state.addItemToOrder);
  const { data: products, isLoading, error, refetch, isRefetching } = usePosProducts({ enabled: true });

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        setSearchQuery('');
        searchInputRef.current?.blur();
        return;
      }
      if (e.key.length === 1) {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchQuery(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const categories = useMemo(() => {
    if (!products) return ['all'];
    const cats = new Set(products.map(p => p.category));
    return ['all', ...Array.from(cats)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(product => {
      const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
      const matchesSearch =
        product.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.variantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.barcode?.includes(searchQuery);
      return matchesCategory && matchesSearch;
    });
  }, [products, activeCategory, searchQuery]);

  /**
   * Helper to get current selected unit price based on mode.
   * Logic: If Wholesale Mode -> Try Wholesale Price -> If 0/Null, Fallback to Retail.
   */
  const getPrice = (unit: any) => {
    if (pricingMode === 'wholesale') {
      const wp = Number(unit.wholesalePrice);
      // If wholesale price exists and is greater than 0, use it. Otherwise fallback.
      if (wp && wp > 0) return wp;
    }
    return Number(unit.price);
  };

  const handleQuantityChange = (variantId: string, delta: number, maxStock: number) => {
    setQuantities(prev => {
      const current = prev[variantId] || 0;
      const next = Math.max(0, current + delta);
      if (next > maxStock) return prev;
      return { ...prev, [variantId]: next };
    });
  };

  const handleManualQuantityChange = (variantId: string, value: string, maxStock: number) => {
    if (value === '') {
      setQuantities(prev => ({ ...prev, [variantId]: 0 }));
      return;
    }
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) return;
    const finalValue = Math.min(Math.max(0, numValue), maxStock);
    setQuantities(prev => ({ ...prev, [variantId]: finalValue }));
  };

  const handleAddToCart = (variantId: string) => {
    const product = products?.find(p => p.variantId === variantId);
    if (!product) return;

    if (product.stock <= 0) return;

    const quantity = quantities[variantId] || 1;
    if (quantity > product.stock) return;

    const selectedUnitId = selectedUnits[variantId] || product.sellableUnits[0].unitId;
    const selectedUnit = product.sellableUnits.find(u => u.unitId === selectedUnitId);

    if (!selectedUnit) return;

    // Calculate the final price based on current mode
    const finalPrice = getPrice(selectedUnit);

    if (quantity > 0) {
      // Create a temporary unit object with the resolved price
      const unitWithCurrentPrice = {
        ...selectedUnit,
        price: finalPrice,
        // Persist the original retail price in case we switch modes in the cart later (optional)
        originalRetailPrice: selectedUnit.price,
      };

      // Pass isWholesale metadata to the store
      addItemToOrder(
        product,
        unitWithCurrentPrice,
        quantity,
        { isWholesale: pricingMode === 'wholesale' }
      );

      setQuantities(prev => ({ ...prev, [variantId]: 0 }));
    }
  };

  // 1. Loading Skeleton
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-64" />
          </div>
        </div>
        <div className="flex gap-3 overflow-hidden">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4 text-center p-6">
        <div className="bg-destructive/10 p-4 rounded-full">
          <AlertCircle className="w-10 h-10 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Unable to load menu</h3>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Top Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
        <h2 className="text-xl font-semibold">Menu List</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch()}
          disabled={isRefetching}
          title="Refresh Products"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={cn('w-4 h-4', isRefetching && 'animate-spin')} />
        </Button>
        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
          {/* Retail / Wholesale Switch */}
          <div className="bg-muted p-1 rounded-lg flex items-center border border-border">
            <button
              onClick={() => setPricingMode('retail')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                pricingMode === 'retail'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Store className="w-4 h-4" />
              Retail
            </button>
            <button
              onClick={() => setPricingMode('wholesale')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                pricingMode === 'wholesale'
                  ? 'bg-white shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Truck className="w-4 h-4" />
              Wholesale
            </button>
          </div>

          <div className="h-8 w-px bg-border hidden md:block" />

          <Button variant="outline" size="sm" onClick={() => setShowBarcodeScanner(true)} className="gap-2">
            <Scan className="w-4 h-4" />
            Scan
          </Button>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Type to search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="flex items-center gap-2 mb-6 border-b border-border overflow-x-auto overflow-hidden pb-2 md:pb-0">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={cn(
              'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeCategory === category
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => {
          const isOutOfStock = product.stock <= 0;
          const currentQty = quantities[product.variantId] || 0;

          return (
            <Card key={product.variantId} className={cn('overflow-hidden flex flex-col', isOutOfStock && 'opacity-75')}>
              <div className="relative h-40 bg-muted">
                <img
                  src={product.imageUrl || '/placeholder.svg?height=200&width=300'}
                  alt={product.productName}
                  className={cn('object-cover h-40 w-full', isOutOfStock && 'grayscale')}
                />
                {isOutOfStock && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded text-sm font-bold">
                      OUT OF STOCK
                    </span>
                  </div>
                )}
              </div>

              <div className="p-4 space-y-3 flex-1 flex flex-col">
                <div className="flex-1">
                  <h3 className="font-semibold">{product.productName}</h3>
                  <p className="text-xs text-muted-foreground">{product.variantName}</p>
                </div>

                <Select
                  value={selectedUnits[product.variantId] || product.sellableUnits[0].unitId}
                  onValueChange={value => setSelectedUnits(prev => ({ ...prev, [product.variantId]: value }))}
                  disabled={isOutOfStock}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {product.sellableUnits.map(unit => {
                      const price = getPrice(unit);
                      return (
                        <SelectItem key={unit.unitId} value={unit.unitId}>
                          <span className="flex items-center justify-between w-full gap-2">
                            <span>{unit.unitName}</span>
                            <span className="font-mono">KSH. {price.toLocaleString()}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-border rounded-md">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isOutOfStock || currentQty <= 0}
                      onClick={() => handleQuantityChange(product.variantId, -1, product.stock)}
                      className="h-8 w-8 p-0 rounded-r-none"
                    >
                      <Minus className="w-3 h-3" />
                    </Button>

                    <Input
                      type="number"
                      disabled={isOutOfStock}
                      value={currentQty === 0 && !quantities[product.variantId] ? '' : currentQty}
                      onChange={e => handleManualQuantityChange(product.variantId, e.target.value, product.stock)}
                      className="h-8 w-12 rounded-none border-0 p-0 text-center focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder="0"
                    />

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isOutOfStock || currentQty >= product.stock}
                      onClick={() => handleQuantityChange(product.variantId, 1, product.stock)}
                      className="h-8 w-8 p-0 rounded-l-none"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>

                  <Button
                    variant="outline"
                    disabled={isOutOfStock || currentQty <= 0}
                    className={cn(
                      'flex-1',
                      !isOutOfStock && currentQty > 0
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-transparent'
                    )}
                    onClick={() => handleAddToCart(product.variantId)}
                  >
                    {isOutOfStock ? 'No Stock' : 'Add'}
                  </Button>
                </div>

                <div
                  className={cn(
                    'text-xs flex justify-between',
                    isOutOfStock ? 'text-destructive' : 'text-muted-foreground'
                  )}
                >
                  <span>SKU: {product.sku}</span>
                  <span className="font-medium">Stock: {product.stock}</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <BarcodeScannerDialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner} />
    </div>
  );
}
