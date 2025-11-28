'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { usePosStore } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Scan, Store, Truck, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarcodeScannerDialog } from './barcode-scanner-dialog';
import { usePosProducts } from '@/hooks/products';
import { Skeleton } from './ui/skeleton';
import { ProductCard } from '@/components/pos/product-card';
import { useInView } from 'react-intersection-observer';
import { useDebounce } from 'use-debounce';

export function ProductList() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [inputValue, setInputValue] = useState('');
  
  // 1. Debounce Search
  const [debouncedSearch] = useDebounce(inputValue, 500);
  
  const [pricingMode, setPricingMode] = useState<'retail' | 'wholesale'>('retail');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 2. Fetching Logic
  const { 
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    isLoading, 
    isError, 
    refetch 
  } = usePosProducts({
    search: debouncedSearch,
    category: activeCategory
  });

  // 3. Store Actions
  const addItemToOrder = usePosStore(state => state.addItemToOrder);

  // 4. Infinite Scroll Observer
  const { ref, inView } = useInView();
  
  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // 5. Global Keyboard Shortcuts (FIXED)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is already typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      if (e.key === 'Escape') {
        setInputValue('');
        searchInputRef.current?.blur();
      } else if (e.key.length === 1) {
        // --- FIX STARTS HERE ---
        e.preventDefault(); // Prevent native browser insertion to stop double characters
        searchInputRef.current?.focus();
        setInputValue(prev => prev + e.key);
        // --- FIX ENDS HERE ---
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // 6. Flatten Pages
  const allProducts = useMemo(() => {
    return data?.pages.flatMap(page => page.products) || [];
  }, [data]);

  const handleAddToCartWrapper = useCallback((item: any) => {
    addItemToOrder(
        item.product, 
        { ...item.unit, originalRetailPrice: item.unit.price }, 
        item.quantity, 
        { isWholesale: pricingMode === 'wholesale' }
    );
  }, [addItemToOrder, pricingMode]);

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <AlertCircle className="w-10 h-10 text-destructive" />
        <h3 className="font-semibold">Failed to load products</h3>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Retry
        </Button>
      </div>
    );
  }

  return (
    // FIX: Added overflow-hidden here so the outer window doesn't scroll, only the grid inside
    <div className="p-6 h-full flex flex-col overflow-hidden">
      
      {/* --- Controls Section --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4 shrink-0">
        <h2 className="text-xl font-semibold">Menu List</h2>
        
        <div className="flex items-center gap-3 flex-wrap">
           {/* Mode Switcher */}
          <div className="bg-muted p-1 rounded-lg flex items-center border border-border">
            <button
              onClick={() => setPricingMode('retail')}
              className={cn('flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all', pricingMode === 'retail' ? 'bg-background shadow-sm' : 'text-muted-foreground')}
            >
              <Store className="w-4 h-4" /> Retail
            </button>
            <button
              onClick={() => setPricingMode('wholesale')}
              className={cn('flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all', pricingMode === 'wholesale' ? 'bg-background shadow-sm' : 'text-muted-foreground')}
            >
              <Truck className="w-4 h-4" /> Wholesale
            </button>
          </div>

          <div className="h-8 w-px bg-border hidden md:block" />

          {/* Scanner & Search */}
          <Button variant="outline" size="sm" onClick={() => setShowBarcodeScanner(true)} className="gap-2">
            <Scan className="w-4 h-4" /> Scan
          </Button>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search item, SKU, barcode..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="pl-10"
            />
            {isFetchingNextPage || (isLoading && inputValue) ? (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </div>
      </div>

      {/* --- Categories --- */}
      {/* FIX: Added [&::-webkit-scrollbar]:hidden to hide the scrollbar UI but keep functionality */}
      <div className="flex items-center gap-2 mb-4 border-b border-border overflow-x-auto shrink-0 pb-1 [&::-webkit-scrollbar]:hidden">
        {['all', 'Beverages', 'Bakery', 'Produce', 'Snacks'].map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={cn(
              'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px whitespace-nowrap',
              activeCategory === category ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {category}
          </button>
        ))}
      </div>

      {/* --- Product Grid --- */}
      {/* This area will handle the vertical scroll exclusively */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-2"> 
        {isLoading && !data ? (
           <ProductGridSkeleton />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 pb-20">
            {allProducts.map((product) => (
              <ProductCard 
                key={product.productId} 
                product={product} 
                onAddToCart={handleAddToCartWrapper}
                pricingMode={pricingMode}
              />
            ))}
            
            {/* Infinite Scroll Trigger */}
            {hasNextPage && (
              <div ref={ref} className="col-span-full flex justify-center py-8">
                 <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            
            {!hasNextPage && allProducts.length > 0 && (
                <div className="col-span-full text-center text-muted-foreground py-8 text-sm">
                    No more products to load
                </div>
            )}
            
            {!isLoading && allProducts.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Search className="w-12 h-12 mb-2 opacity-20" />
                    <p>No products found matching "{inputValue}"</p>
                </div>
            )}
          </div>
        )}
      </div>

      <BarcodeScannerDialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner} />
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}