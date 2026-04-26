'use client';

import { useState, useEffect, useRef } from 'react';
import { usePosStore } from '@/store/store';
import { usePosPricingSync } from '@/hooks/use-pricing-sync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Search,
  X,
  WifiOff,
  Wifi,
  CheckCircle2,
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  Settings as SettingsIcon,
  LogOut,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePosProducts } from '@/hooks/products';
import { useScanner } from '@/hooks/use-scanner';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import PaymentModal from '@/components/pos/payment-dialog';
import { ReceiptDialog } from '@/components/receipt-dialog';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SettingsDialog } from '@/components/settings-dialog';

export function SupermarketPOS() {
  const [inputValue, setInputValue] = useState('');
  const [showCheckoutDialog, setShowCheckoutDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<any>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const { checkOut } = useAuth();
  const {
    startScanner,
    stopScanner,
    isConnected,
    lastScanned,
    clearLastScanned,
  } = useScanner();

  // Trigger pricing sync
  usePosPricingSync();

  const { products } = usePosProducts({
    search: inputValue,
    category: 'all',
    page: 1,
    pageSize: 10,
  });

  const {
    currentOrder,
    addItemToOrder,
    removeItemFromOrder,
    updateItemInOrder,
    resetOrder,
    settings,
    taxRate,
  } = usePosStore(state => ({
    currentOrder: state.currentOrder,
    addItemToOrder: state.addItemToOrder,
    removeItemFromOrder: state.removeItemFromOrder,
    updateItemInOrder: state.updateItemInOrder,
    resetOrder: state.resetOrder,
    settings: state.settings,
    taxRate: state.settings.taxRate || 0,
  }));

  // Auto-focus search input on mount and after actions
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Handle barcode scans
  useEffect(() => {
    if (!lastScanned) {
      return;
    }

    const processScan = async () => {
      const barcode = lastScanned;
      clearLastScanned(); // Clear immediately so the same barcode can be scanned again

      const product = await invoke<any>('get_product_by_barcode_command', {
        barcode,
      });

      if (!product) {
        toast.error('Product Not Found', {
          description: `No product found with barcode: ${barcode}.`,
          duration: 2000,
        });
        return;
      }

      const variant = product.variants?.find((v: any) => v.barcode === barcode) || product.variants?.[0];
      const defaultUnit = product.sellableUnits?.find((u: any) => u.isBaseUnit) || product.sellableUnits?.[0];

      if (!variant || !defaultUnit) return;

      // Instant price resolution
      let customPrice: number | null = null;
      try {
        const prices = await invoke<Array<number | null>>('resolve_price_batch_command', {
          customerId: currentOrder.customerId,
          requests: [
            {
              variant_id: variant.variantId,
              unit_id: defaultUnit.unitId || null,
              is_base_unit: !!defaultUnit.isBaseUnit,
            },
          ],
        });
        if (prices && prices.length > 0) {
          customPrice = prices[0];
        }
      } catch (err) {
        console.error('Price resolution failed:', err);
      }

      const unitToAdd = {
        ...defaultUnit,
        price: customPrice !== null ? customPrice : defaultUnit.price,
        originalRetailPrice: defaultUnit.price,
      };

      addItemToOrder(
        {
          ...product,
          variantId: variant.variantId,
          variantName: variant.variantName,
          name: product.productName,
          variants: product.variants?.map((v: any) => ({
            ...v,
            name: v.variantName || v.name || 'Default Variant',
          })),
        },
        variant.variantId,
        unitToAdd,
        1
      );

      toast.success('Added to Cart', {
        description: `${product.productName}`,
        duration: 1000,
        icon: <CheckCircle2 className="w-5 h-5" />,
      });
    };

    processScan();
  }, [lastScanned, products, addItemToOrder, currentOrder.customerId, clearLastScanned]);

  useEffect(() => {
    if (settings.enableBarcodeScanner) {
      startScanner();
    }
    return () => stopScanner();
  }, [settings.enableBarcodeScanner, startScanner, stopScanner]);

  const subTotal = currentOrder.items.reduce((sum, item) => sum + (item.selectedUnit?.price || 0) * item.quantity, 0);
  const taxAmount = subTotal * (taxRate / 100);
  const total = subTotal + taxAmount;

  const handleCheckout = () => {
    checkOut();
    setShowCheckoutDialog(false);
  };

  const handlePaymentComplete = (completedOrder: any) => {
    setLastCompletedOrder(completedOrder);
    setPaymentDialogOpen(false);
    setReceiptDialogOpen(true);
    resetOrder();
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
      {/* Header / Utility Bar */}
      <header className="h-16 border-b bg-white dark:bg-zinc-900 px-6 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2 rounded-lg">
            <ShoppingCart className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Supermarket POS</h1>
        </div>

        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
            isConnected ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200"
          )}>
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isConnected ? "Scanner Active" : "Scanner Offline"}
          </div>

          <Button variant="ghost" size="icon" onClick={() => setShowSettingsDialog(true)}>
            <SettingsIcon className="w-5 h-5" />
          </Button>

          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setShowCheckoutDialog(true)}>
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Side: Cart & Checkout (Prominent) */}
        <div className="flex-[3] flex flex-col border-r bg-white dark:bg-zinc-900 shadow-xl z-10">
          <div className="p-4 border-b bg-zinc-50/50 dark:bg-zinc-800/50 flex justify-between items-center">
            <h2 className="font-bold text-lg">Transaction</h2>
            <span className="text-sm font-medium text-muted-foreground bg-white dark:bg-zinc-800 px-2 py-1 rounded border">
              {currentOrder.items.reduce((acc, i) => acc + i.quantity, 0)} Items
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
            {currentOrder.items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-40">
                <div className="p-8 border-2 border-dashed rounded-full mb-4">
                  <ShoppingCart className="w-16 h-16" />
                </div>
                <p className="text-lg font-medium text-center">Ready to scan products...</p>
              </div>
            ) : (
              currentOrder.items.map((item, idx) => (
                <div key={idx} className="flex gap-4 p-4 rounded-xl border bg-white dark:bg-zinc-800 shadow-sm animate-in fade-in slide-in-from-left-2">
                  <div className="w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-700 overflow-hidden border shrink-0">
                    {item.imageUrl ? (
                      <img src={convertFileSrc(item.imageUrl)} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300">
                        <Package className="w-8 h-8" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="font-bold text-base truncate">{item.productName}</h4>
                        <p className="text-xs text-muted-foreground">{item.variantName}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{(item.selectedUnit?.price || 0).toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Per Unit</p>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-700 p-1 rounded-lg">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-md"
                          onClick={() => updateItemInOrder({ ...item, quantity: Math.max(1, item.quantity - 1) })}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                        <span className="w-10 text-center font-bold">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-md"
                          onClick={() => updateItemInOrder({ ...item, quantity: item.quantity + 1 })}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive h-8 w-8"
                        onClick={() => removeItemFromOrder(item.productId, item.variantId, item.selectedUnit?.unitId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 border-t bg-zinc-50 dark:bg-zinc-800/80 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-medium text-foreground">{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax ({taxRate}%)</span>
                <span className="font-medium text-foreground">{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-2 border-t flex justify-between items-end">
                <span className="font-bold text-xl">Total Amount</span>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground mr-1">KSH</span>
                  <span className="text-4xl font-black text-primary tracking-tighter">{total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                size="lg"
                className="h-16 text-lg font-bold border-2"
                onClick={resetOrder}
                disabled={currentOrder.items.length === 0}
              >
                Clear Sale
              </Button>
              <Button
                size="lg"
                className="h-16 text-xl font-black uppercase tracking-wider shadow-lg shadow-primary/20"
                disabled={currentOrder.items.length === 0}
                onClick={() => setPaymentDialogOpen(true)}
              >
                Pay Now
              </Button>
            </div>
          </div>
        </div>

        {/* Right Side: Quick Product Search / Info */}
        <div className="flex-[2] flex flex-col bg-zinc-50 dark:bg-zinc-950 p-6 space-y-6">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              ref={searchInputRef}
              placeholder="Search products manually or scan barcode..."
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="pl-12 h-14 text-lg rounded-2xl bg-white dark:bg-zinc-800 border-2 border-transparent focus:border-primary shadow-sm transition-all"
            />
            {inputValue && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setInputValue('')}
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col">
            <h3 className="font-bold mb-4 flex items-center gap-2">
               <Package className="w-4 h-4 text-primary" />
               Manual Lookup
            </h3>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
              {products.length > 0 ? (
                products.map((p: any) => (
                  <button
                    key={p.productId}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border bg-white dark:bg-zinc-900 hover:border-primary hover:ring-1 hover:ring-primary transition-all text-left"
                    onClick={() => {
                      const variant = p.variants?.[0];
                      const unit = p.sellableUnits?.find((u: any) => u.isBaseUnit) || p.sellableUnits?.[0];
                      if (variant && unit) {
                        addItemToOrder({
                          ...p,
                          variantId: variant.variantId,
                          variantName: variant.variantName,
                          name: p.productName,
                          variants: p.variants?.map((v: any) => ({ ...v, name: v.variantName || v.name })),
                        }, variant.variantId, { ...unit, originalRetailPrice: unit.price }, 1);
                        setInputValue('');
                        searchInputRef.current?.focus();
                      }
                    }}
                  >
                    <div className="w-10 h-10 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{p.productName}</p>
                      <p className="text-[10px] text-muted-foreground uppercase">{p.category || 'No Category'}</p>
                    </div>
                    <p className="font-black text-primary">{(p.sellableUnits?.[0]?.price || 0).toLocaleString()}</p>
                  </button>
                ))
              ) : (
                 <div className="h-full flex flex-col items-center justify-center opacity-30 italic text-sm">
                   {inputValue ? "No products found matching your search" : "Start typing to search products"}
                 </div>
              )}
            </div>
          </div>

          {/* Quick Help / Info */}
          <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10">
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary mb-2">POS Status</h4>
            <div className="space-y-1.5">
               <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Location:</span>
                  <span className="font-semibold">Main Branch</span>
               </div>
               <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Session Started:</span>
                  <span className="font-semibold">{new Date().toLocaleTimeString()}</span>
               </div>
               <div className="flex justify-between text-[11px]">
                  <span className="text-muted-foreground">Printer:</span>
                  <span className="font-semibold text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Ready
                  </span>
               </div>
            </div>
          </div>
        </div>
      </main>

      {/* Dialogs */}
      <PaymentModal
        isOpen={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        cartItems={currentOrder.items.map(i => ({ ...i, price: i.selectedUnit?.price || 0 })) as any}
        subtotal={total}
        discount={0}
        customer={null}
        orderType="Takeaway"
        tableNumber=""
        onPaymentComplete={handlePaymentComplete}
      />

      <ReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        completedOrder={lastCompletedOrder}
        onClose={() => setReceiptDialogOpen(false)}
      />

      <AlertDialog open={showCheckoutDialog} onOpenChange={setShowCheckoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Check Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to check out? This will end your current session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCheckout} className="bg-destructive hover:bg-destructive/90">
              Check Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SettingsDialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog} />
    </div>
  );
}
