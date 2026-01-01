'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePosStore } from '@/store/store';
import { usePosPricingSync, useBatchPricing } from '@/hooks/use-pricing-sync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Store, 
  Truck,
  RefreshCw,
  X,
  WifiOff,
  Wifi,
  MonitorCheck,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarcodeScannerDialog } from '../components/barcode-scanner-dialog';
import { usePosProducts } from '@/hooks/products';
import { Skeleton } from '../components/ui/skeleton';
import { ProductCard } from '@/components/pos/product-card';
import { useDebounce } from 'use-debounce';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import PendingOrdersList from '@/components/orders-list';
import { useScanner } from '@/hooks/use-scanner';
import { toast } from 'sonner';
import { TableSelectorDialog } from '@/components/pos/table-selector-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// --- TAURI IMPORTS ---
import { invoke } from '@tauri-apps/api/core';

export function POS() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [inputValue, setInputValue] = useState('');
  const [knownCategories, setKnownCategories] = useState<Set<string>>(new Set());
  
  // 1. Debounce Search
  const [debouncedSearch] = useDebounce(inputValue, 500);
  
  const [pricingMode, setPricingMode] = useState<'retail' | 'wholesale'>('retail');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showTableSelector, setShowTableSelector] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastProcessedBarcode = useRef<string | null>(null);

  // Initialize scanner hook
  const { 
    startScanner, 
    stopScanner, 
    isConnected, 
    lastScanned, 
    error: scannerError 
  } = useScanner();

  // 2. Fetching Logic
  const { 
    products, 
    isSyncing, 
    triggerSync,
  } = usePosProducts({
    search: debouncedSearch,
    category: activeCategory
  });

  // 3. Store Actions
  const { addItemToOrder, businessConfig, settings, currentOrder, setTableNumber } = usePosStore(state => ({
    addItemToOrder: state.addItemToOrder,
    businessConfig: state.getBusinessConfig(),
    settings: state.settings,
    currentOrder: state.currentOrder,
    setTableNumber: state.setTableNumber
  }));

  // --- PRICING SYNC & BATCH RESOLUTION ---
  // A. Trigger Sync in Background
  usePosPricingSync();

  // B. Prepare Items for Batch Pricing
  const pricingItems = useMemo(() => {
    const items: { variantId: string; unitId: string | null; isBaseUnit: boolean }[] = [];
    products.forEach((p: any) => {
        if (!p.variants) return;
        p.variants.forEach((v: any) => {
            if (!v.sellableUnits) return;
            v.sellableUnits.forEach((u: any) => {
                items.push({ 
                    variantId: v.variantId, 
                    unitId: u.unitId || null, 
                    isBaseUnit: !!u.isBaseUnit 
                });
            });
        });
    });
    return items;
  }, [products]);

  // C. Fetch Prices from Rust
  const { priceMap } = useBatchPricing(pricingItems, currentOrder.customerId);

  const handleGetPrice = useCallback((variantId: string, unitId: string | null, _isBaseUnit: boolean = false) => {
      // Create lookup key matching useBatchPricing logic
      const key = `${variantId}:${unitId ?? 'null'}`;
      const price = priceMap[key];
      return typeof price === 'number' ? price : null;
  }, [priceMap]);

  // --- SCREEN LAUNCH LOGIC ---
  useEffect(() => {
    const initCustomerScreen = async () => {
      // Only open if enabled in settings
      if (!settings.enableCustomerDisplay) return;

      try {
        await invoke('open_customer_screen');
        console.log("Customer screen signal sent");
      } catch (e) {
        console.error("Failed to open customer screen:", e);
      }
    };
    initCustomerScreen();
  }, [settings.enableCustomerDisplay]);

  // 4. Extract Categories
  useEffect(() => {
    if (activeCategory === 'all' && products.length > 0) {
      const categories = new Set(knownCategories);
      products.forEach((p: any) => {
        if (p.category) categories.add(p.category);
      });
      setKnownCategories(new Set(Array.from(categories).sort()));
    }
  }, [products, activeCategory]);

  // 5. Global Keyboard Shortcuts
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
    const storeProduct = {
      ...item.product,
      variantId: item.variant.variantId,
      variantName: item.variant.name,
      productName: item.product.productName,
      variants: item.product.variants?.map((v: any) => ({
        ...v,
        name: v.variantName || v.name || 'Default Variant'
      })) 
    };

    addItemToOrder(
        storeProduct, 
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
    await triggerSync();
  };

  useEffect(() => {
    if (settings.enableBarcodeScanner) {
      startScanner();
    }
    return () => {
      stopScanner();
    };
  }, [settings.enableBarcodeScanner]);

  // Handle barcode scans
  useEffect(() => {
    if (!lastScanned || lastScanned === lastProcessedBarcode.current) {
      return;
    }

    const processScan = async () => {
        lastProcessedBarcode.current = lastScanned;

        const product = products.find((p: any) => {
        if (p.barcode === lastScanned) return true;
        return p.variants?.some((v: any) => v.barcode === lastScanned);
        });

        if (!product) {
        toast.error('Product Not Found', {
            description: `No product found with barcode: ${lastScanned}. Try clearing filters if applied.`,
            duration: 3000,
        });
        return;
        }

        const variant = product.variants?.find((v: any) => v.barcode === lastScanned) || product.variants?.[0];
        
        if (!variant) {
        toast.error('Invalid Product', {
            description: `Product ${product.productName} has no valid variants`,
            duration: 3000,
        });
        return;
        }

        if (product.stock <= 0) {
        toast.warning('Out of Stock', {
            description: `${product.productName} is currently out of stock`,
            duration: 3000,
        });
        return;
        }

        const defaultUnit = product.sellableUnits?.find((u: any) => u.isBaseUnit) || product.sellableUnits?.[0];
        
        if (!defaultUnit) {
        toast.error('Invalid Product', {
            description: `Product ${product.productName} has no sellable units`,
            duration: 3000,
        });
        return;
        }

        const storeProduct = {
        ...product,
        variantId: variant.variantId,
        variantName: variant.variantName, 
        name: product.productName, 
        variants: product.variants?.map((v: any) => ({
            ...v,
            name: v.variantName || v.name || 'Default Variant'
        }))
        };

        // Calculate dynamic price for scanner adding
        // Note: We use the Rust Command directly here for instantaneous resolution
        let customPrice: number | null = null;
        try {
            const prices = await invoke<Array<number | null>>("resolve_price_batch_command", {
                customerId: currentOrder.customerId,
                requests: [{
                    variant_id: variant.variantId,
                    unit_id: defaultUnit.unitId || null,
                    is_base_unit: !!defaultUnit.isBaseUnit
                }]
            });
            if (prices && prices.length > 0) {
                customPrice = prices[0];
            }
        } catch (err) {
            console.error("Failed to resolve price for scanned item:", err);
        }

        // If custom price, update unit price logic or pass it.
        // Ideally, addItemToOrder should handle this, but currently it takes unit.price.
        // We override the price if customPrice found.
        const unitToAdd = {
            ...defaultUnit,
            price: customPrice !== null ? customPrice : defaultUnit.price,
            originalRetailPrice: defaultUnit.price 
        };

        addItemToOrder(
        storeProduct,
        unitToAdd,
        1,
        { isWholesale: pricingMode === 'wholesale' }
        );

        toast.success('Added to Cart', {
        description: `${product.productName} (${variant.variantName || 'Default'})`,
        duration: 2000,
        icon: <CheckCircle2 className="w-5 h-5" />,
        });
    };

    processScan();
  }, [lastScanned, products, addItemToOrder, pricingMode, currentOrder.customerId]);

  useEffect(() => {
    if (scannerError) {
      toast.error('Scanner Error', {
        description: scannerError,
        duration: 2000,
      });
    }
  }, [scannerError]);

  return (
    <div className="flex flex-col h-full bg-muted/5">
      {businessConfig.features.showOrdersList && <PendingOrdersList />}
      
      {/* --- Filter Bar (Header) --- */}
      <div className="flex flex-col gap-3 p-3 bg-background border-b z-10 shadow-sm shrink-0">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search */}
            <div className="relative w-full md:w-[320px] lg:w-[400px] group transition-all duration-300">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                ref={searchInputRef}
                placeholder="Search products..."
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                className="pl-9 h-9 bg-muted/40 focus:bg-background border-border/60 focus:ring-primary/20 transition-all rounded-full"
                />
                {inputValue && (
                    <button 
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>

            {/* Quick Actions (Mode & Sync) */}
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto no-scrollbar">
                
                {/* Table Selector */}
                {businessConfig.features.tableManagement && (
                    <Button 
                    variant={currentOrder.tableNumber ? "default" : "outline"}
                    size="sm"
                    className={cn("gap-2 h-9 rounded-full", currentOrder.tableNumber && "bg-indigo-600 hover:bg-indigo-700 text-white")}
                    onClick={() => setShowTableSelector(true)}
                    >
                        <span className="text-[10px] uppercase font-bold tracking-wider">Table</span>
                        <span className="font-bold">{currentOrder.tableNumber || "None"}</span>
                    </Button>
                )}

                {/* Pricing Toggle */}
               <div className="bg-muted/40 p-0.5 rounded-full flex items-center border border-border/60">
                    <button
                        onClick={() => setPricingMode('retail')}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200', 
                            pricingMode === 'retail' 
                                ? 'bg-background text-foreground shadow-sm ring-1 ring-border/20' 
                                : 'text-muted-foreground hover:bg-background/40 hover:text-foreground'
                        )}
                    >
                        <Store className="w-3.5 h-3.5" /> Retail
                    </button>
                    <button
                        onClick={() => setPricingMode('wholesale')}
                        className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200', 
                            pricingMode === 'wholesale' 
                                ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100 dark:bg-blue-900/40 dark:text-blue-200 dark:ring-blue-800' 
                                : 'text-muted-foreground hover:bg-background/40 hover:text-foreground'
                        )}
                    >
                        <Truck className="w-3.5 h-3.5" /> Wholesale
                    </button>
               </div>

                <div className="w-px h-6 bg-border/60 mx-1" />

                {/* Util Buttons */}
                <TooltipProvider>
                    <Tooltip delayDuration={300}>
                         <TooltipTrigger asChild>
                             <Button 
                                variant="outline" 
                                size="icon" 
                                className="h-9 w-9 rounded-full border-dashed"
                                onClick={handleRefresh}
                                disabled={isSyncing}
                            >
                                <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
                            </Button>
                         </TooltipTrigger>
                         <TooltipContent side="bottom" className="text-xs">Sync Products</TooltipContent>
                    </Tooltip>

                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => invoke('open_customer_screen')}
                                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                            >
                                <MonitorCheck className="w-4 h-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Customer Screen</TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                {settings.enableBarcodeScanner && (
                     <Button 
                        variant={isConnected ? "outline" : "ghost"} 
                        size="icon"
                        className={cn("h-9 w-9 rounded-full", isConnected ? "text-green-600 border-green-200 bg-green-50/50" : "text-amber-500")}
                        onClick={() => setShowBarcodeScanner(true)}
                        title={isConnected ? "Scanner Connected" : "Scanner Disconnected"}
                     >
                        {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                     </Button>
                )}
            </div>
        </div>

        {/* Categories Scroller */}
        <div className="w-full">
             <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex w-max space-x-2 p-1">
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
                </div>
                <ScrollBar orientation="horizontal" className="h-2" />
            </ScrollArea>
        </div>
      </div>

      {/* --- Product Grid Content --- */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-muted/10 scroll-smooth"> 
        {isSyncing && products.length === 0 ? (
           <ProductGridSkeleton />
        ) : (
          <div className="pb-20 max-w-[2400px] mx-auto">
            {/* Optimized Grid Layouts */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7 gap-3 sm:gap-4 md:gap-5 content-start">
              {products.map((product) => (
                <ProductCard 
                  key={product.productId} 
                  product={product as any} 
                  onAddToCart={handleAddToCartWrapper}
                  pricingMode={pricingMode}
                  customPriceCalculator={handleGetPrice}
                />
              ))}
            </div>
            
            {!isSyncing && products.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-in fade-in-50">
                    <div className="bg-muted/50 p-6 rounded-full mb-4">
                        <Search className="w-12 h-12 opacity-30" />
                    </div>
                    <h4 className="font-semibold text-lg text-foreground">No products found</h4>
                    <p className="max-w-xs text-center mt-1 text-sm">
                        No matches for "{inputValue}" in {activeCategory === 'all' ? 'any category' : activeCategory}.
                    </p>
                    <Button 
                        variant="link" 
                        onClick={() => {setInputValue(''); setActiveCategory('all');}}
                        className="mt-2 text-primary"
                    >
                        Clear filters
                    </Button>
                </div>
            )}
          </div>
        )}
      </div>
      
      <TableSelectorDialog 
         open={showTableSelector} 
         onOpenChange={setShowTableSelector}
         onSelectTable={(num) => setTableNumber(num)}
      />

      <BarcodeScannerDialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner} />
    </div>
  );
}

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