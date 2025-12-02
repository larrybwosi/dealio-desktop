'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { usePosStore } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Scan, 
  Store, 
  Truck, 
  AlertCircle, 
  RefreshCw, 
  Loader2, 
  X,
  PackageOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarcodeScannerDialog } from '../components/barcode-scanner-dialog';
import { usePosProducts } from '@/hooks/products';
import { Skeleton } from '../components/ui/skeleton';
import { ProductCard } from '@/components/pos/product-card';
import { useInView } from 'react-intersection-observer';
import { useDebounce } from 'use-debounce';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import PendingOrdersList from '@/components/orders-list';

export function POS() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [inputValue, setInputValue] = useState('');
  const [knownCategories, setKnownCategories] = useState<Set<string>>(new Set());
  
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
    refetch,
    isRefetching
  } = usePosProducts({
    search: debouncedSearch,
    category: activeCategory
  });

  // 3. Store Actions
  const addItemToOrder = usePosStore(state => state.addItemToOrder);
  const businessConfig = usePosStore(state => state.getBusinessConfig());

  // 4. Infinite Scroll Observer
  const { ref, inView } = useInView();
  
  useEffect(() => {
    if (inView && hasNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // 5. Flatten Pages & Extract Categories
  const allProducts = useMemo(() => {
    return data?.pages.flatMap(page => page.products) || [];
  }, [data]);

  useEffect(() => {
    if (activeCategory === 'all' && allProducts.length > 0) {
      const categories = new Set(knownCategories);
      allProducts.forEach((p: any) => {
        if (p.category) categories.add(p.category);
      });
      setKnownCategories(new Set(Array.from(categories).sort()));
    }
  }, [allProducts, activeCategory]);

  // 6. Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      if (e.key === 'Escape') {
        setInputValue('');
        searchInputRef.current?.blur();
      } else if (e.key.length === 1) {
        if (/[a-zA-Z0-9]/.test(e.key)) {
            searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleAddToCartWrapper = useCallback((item: any) => {
    addItemToOrder(
        {...item.product, variantId: item.variant.variantId}, 
        { ...item.unit, originalRetailPrice: item.unit.price }, 
        item.quantity, 
        { isWholesale: pricingMode === 'wholesale' }
    );
  }, [addItemToOrder, pricingMode]);

  const clearSearch = () => {
    setInputValue('');
    searchInputRef.current?.focus();
  };

  const handleRefresh = async () => {
    await refetch();
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 bg-muted/10 rounded-lg border border-dashed p-10">
        <div className="bg-destructive/10 p-4 rounded-full">
            <AlertCircle className="w-10 h-10 text-destructive" />
        </div>
        <h3 className="font-semibold text-lg">Unable to load menu</h3>
        <p className="text-muted-foreground text-sm max-w-xs text-center">
            We encountered an error fetching the product list. Please check your connection.
        </p>
        <Button onClick={() => refetch()} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Retry Connection
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background/50">
      {businessConfig.features.showOrdersList && <PendingOrdersList />}
      
      {/* --- Header Section (Sticky) --- */}
      <div className="flex flex-col gap-4 p-4 pb-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 sticky top-0 border-b">
        
        {/* Top Bar: Title & Primary Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-primary/10 rounded-lg">
                <PackageOpen className="w-5 h-5 text-primary" />
             </div>
             <div>
                 <h2 className="text-xl font-bold tracking-tight">Product List</h2>
                 <p className="text-xs text-muted-foreground hidden sm:block">
                     {allProducts.length} items loaded • {pricingMode} mode
                 </p>
             </div>
          </div>
          
          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Mode Switcher - Segmented Control Style */}
            <div className="bg-muted/50 p-1 rounded-lg flex items-center border border-border flex-1 md:flex-none">
              <button
                onClick={() => setPricingMode('retail')}
                className={cn(
                    'flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200', 
                    pricingMode === 'retail' 
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-border' 
                        : 'text-muted-foreground hover:bg-background/50'
                )}
              >
                <Store className="w-4 h-4" /> Retail
              </button>
              <button
                onClick={() => setPricingMode('wholesale')}
                className={cn(
                    'flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200', 
                    pricingMode === 'wholesale' 
                        ? 'bg-background text-foreground shadow-sm ring-1 ring-border' 
                        : 'text-muted-foreground hover:bg-background/50'
                )}
              >
                <Truck className="w-4 h-4" /> Wholesale
              </button>
            </div>

            <Button 
                variant="outline" 
                size="icon" 
                onClick={handleRefresh}
                className={cn("shrink-0", isRefetching && "opacity-70")}
                disabled={isRefetching}
                title="Refresh Products"
            >
                <RefreshCw className={cn("w-4 h-4", isRefetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Second Bar: Search & Categories */}
        <div className="flex flex-col lg:flex-row gap-4 pb-4">
            {/* Search Input Group */}
            <div className="flex gap-2 w-full lg:w-1/3 shrink-0">
                <div className="relative w-full group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input
                    ref={searchInputRef}
                    placeholder="Search by name, SKU, or barcode..."
                    value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    className="pl-10 pr-8 h-10 bg-muted/30 focus:bg-background transition-all"
                    />
                    {inputValue && (
                        <button 
                            onClick={clearSearch}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                    {isFetchingNextPage || (isLoading && inputValue) ? (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                    ) : null}
                </div>
                <Button variant="secondary" onClick={() => setShowBarcodeScanner(true)} className="gap-2 shrink-0">
                    <Scan className="w-4 h-4" /> 
                    <span className="hidden sm:inline">Scanner</span>
                </Button>
            </div>

            {/* Dynamic Categories - Horizontal Scroll */}
            <div className="flex-1 min-w-0 border-l border-border pl-0 lg:pl-4">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex w-max space-x-2 pb-2">
                        <CategoryBadge 
                            label="All Items" 
                            isActive={activeCategory === 'all'} 
                            onClick={() => setActiveCategory('all')} 
                        />
                        {Array.from(knownCategories).map(cat => (
                            <CategoryBadge 
                                key={cat} 
                                label={cat} 
                                isActive={activeCategory === cat} 
                                onClick={() => setActiveCategory(cat)} 
                            />
                        ))}
                        {/* Fallback if no categories found yet */}
                        {knownCategories.size === 0 && !isLoading && (
                            <span className="text-xs text-muted-foreground py-2 italic px-2">
                                Categories will appear as items load...
                            </span>
                        )}
                    </div>
                    <ScrollBar orientation="horizontal" className="h-2" />
                </ScrollArea>
            </div>
        </div>
      </div>

      {/* --- Product Grid Content --- */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 bg-muted/10"> 
        {isLoading && !data ? (
           <ProductGridSkeleton />
        ) : (
          <div className="pb-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">
              {allProducts.map((product) => (
                <ProductCard 
                  key={product.productId} 
                  product={product as any} 
                  onAddToCart={handleAddToCartWrapper}
                  pricingMode={pricingMode}
                />
              ))}
            </div>
            
            {/* Infinite Scroll Trigger */}
            <div className="py-8 w-full">
                {hasNextPage ? (
                    <div ref={ref} className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <p className="text-xs text-muted-foreground">Loading more items...</p>
                    </div>
                ) : allProducts.length > 0 ? (
                    <div className="text-center">
                        <p className="text-xs font-medium text-muted-foreground bg-muted/50 inline-block px-4 py-1 rounded-full">
                            You've reached the end of the list
                        </p>
                    </div>
                ) : null}

                {!isLoading && allProducts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <div className="bg-muted p-6 rounded-full mb-4">
                            <Search className="w-10 h-10 opacity-40" />
                        </div>
                        <h4 className="font-semibold text-lg text-foreground">No products found</h4>
                        <p className="max-w-xs text-center mt-1">
                            We couldn't find anything matching "{inputValue}" in {activeCategory === 'all' ? 'any category' : activeCategory}.
                        </p>
                        <Button 
                            variant="link" 
                            onClick={() => {setInputValue(''); setActiveCategory('all');}}
                            className="mt-2"
                        >
                            Clear filters
                        </Button>
                    </div>
                )}
            </div>
          </div>
        )}
      </div>

      <BarcodeScannerDialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner} />
    </div>
  );
}

// Sub-component for Cleaner Category Tabs
function CategoryBadge({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'px-4 py-2 text-sm font-medium rounded-full transition-all border',
                isActive 
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm' 
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50 hover:bg-muted/50'
            )}
        >
            {label}
        </button>
    )
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="flex flex-col space-y-3 p-3 border rounded-xl bg-background shadow-sm">
          <Skeleton className="h-40 w-full rounded-lg bg-muted/60" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex gap-2 pt-2 mt-auto">
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-12 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}