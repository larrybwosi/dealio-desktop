'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePosStore } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Scan, 
  Store, 
  Truck,
  RefreshCw,
  X,
  PackageOpen,
  CheckCircle2,
  WifiOff,
  Wifi,
  MonitorCheck
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

// --- TAURI IMPORTS ---
import { invoke } from '@tauri-apps/api/core';
// Removed emitTo - now handled in Cart.tsx

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
    isScanning, 
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
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  // Handle barcode scans
  useEffect(() => {
    if (!lastScanned || lastScanned === lastProcessedBarcode.current) {
      return;
    }

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

    addItemToOrder(
      storeProduct,
      { ...defaultUnit, },
      1,
      { isWholesale: pricingMode === 'wholesale' }
    );

    toast.success('Added to Cart', {
      description: `${product.productName} (${variant.variantName || 'Default'})`,
      duration: 2000,
      icon: <CheckCircle2 className="w-5 h-5" />,
    });
  }, [lastScanned, products, addItemToOrder, pricingMode]);

  useEffect(() => {
    if (scannerError) {
      toast.error('Scanner Error', {
        description: scannerError,
        duration: 2000,
      });
    }
  }, [scannerError]);

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
                      {products.length} items • {pricingMode} mode
                      {isSyncing && <span className="ml-2 italic text-primary">(Syncing...)</span>}
                  </p>
              </div>
              
              {isScanning && (
                <div className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  isConnected 
                    ? "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20" 
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                )}>
                  {isConnected ? (
                    <>
                      <Wifi className="w-3.5 h-3.5" />
                      <span>Scanner Ready</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5" />
                      <span>Scanner Connecting...</span>
                    </>
                  )}
                </div>
              )}
           </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
             
             {/* Table Selector (Restaurant Mode) */}
             {businessConfig.features.tableManagement && (
                <Button 
                   variant={currentOrder.tableNumber ? "default" : "outline"}
                   className={cn("gap-2", currentOrder.tableNumber && "bg-indigo-600 hover:bg-indigo-700 text-white")}
                   onClick={() => setShowTableSelector(true)}
                >
                    <div className="flex flex-col items-start leading-none gap-0.5">
                       <span className="text-[10px] uppercase opacity-80 font-semibold">Table</span>
                       <span className="text-sm font-bold">{currentOrder.tableNumber || "None"}</span>
                    </div>
                </Button>
             )}

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
                className={cn("shrink-0", isSyncing && "opacity-70")}
                disabled={isSyncing}
                title="Sync Products"
            >
                <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            </Button>
            
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => invoke('open_customer_screen')}
                title="Relaunch Customer Display"
                className="shrink-0"
            >
                <MonitorCheck className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Second Bar: Search & Categories */}
        <div className="flex flex-col lg:flex-row gap-4 pb-4">
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
                </div>
                <Button variant="secondary" onClick={() => setShowBarcodeScanner(true)} className="gap-2 shrink-0">
                    <Scan className="w-4 h-4" /> 
                    <span className="hidden sm:inline">Scanner</span>
                </Button>
            </div>

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
                        {knownCategories.size === 0 && !isSyncing && (
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
        {isSyncing && products.length === 0 ? (
           <ProductGridSkeleton />
        ) : (
          <div className="pb-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-4">
              {products.map((product) => (
                <ProductCard 
                  key={product.productId} 
                  product={product as any} 
                  onAddToCart={handleAddToCartWrapper}
                  pricingMode={pricingMode}
                />
              ))}
            </div>
            
            {!isSyncing && products.length === 0 && (
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