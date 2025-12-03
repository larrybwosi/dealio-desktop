'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { usePosStore } from '@/store/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Trash2, 
  Edit2, 
  Minus, 
  Plus, 
  PanelRightClose, 
  PanelRightOpen, 
  ShoppingCart, 
} from 'lucide-react';
import PaymentModal from '@/components/pos/payment-dialog';
import { CustomerSelector } from '@/components/customer-selector';
import { AgeVerificationDialog } from '@/components/age-verification-dialog';
import type { Order, CartItem, Customer, OrderType } from '@/types';
import { ReceiptDialog } from '@/components/receipt-dialog';
import { cn } from '@/lib/utils';

export function Cart() {
  // --- Layout & Resize States ---
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [width, setWidth] = useState(384);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // --- UI States ---
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [ageVerificationOpen, setAgeVerificationOpen] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<any>(null);

  // --- Edit Item States ---
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [editNotes, setEditNotes] = useState('');

  // --- Store Hooks ---
  const currentOrder = usePosStore(state => state.currentOrder);
  const taxRate = usePosStore(state => state.settings.taxRate) || 0;
  const getBusinessConfig = usePosStore(state => state.getBusinessConfig);
  const tables = usePosStore(state => state.tables);
  const setOrderType = usePosStore(state => state.setOrderType);
  const setTableNumber = usePosStore(state => state.setTableNumber);
  const setInstructions = usePosStore(state => state.setInstructions);
  const removeItemFromOrder = usePosStore(state => state.removeItemFromOrder);
  const updateItemInOrder = usePosStore(state => state.updateItemInOrder);
  const resetOrder = usePosStore(state => state.resetOrder);
  const saveUnpaidOrder = usePosStore(state => state.saveUnpaidOrder);
  const allowSaveUnpaidOrders = usePosStore(state => state.settings.allowSaveUnpaidOrders);

  // --- Config ---
  const businessConfig = getBusinessConfig();
  const availableOrderTypes = businessConfig.orderTypes;
  const showTableField = businessConfig.features.tableManagement;
  const requiresAgeVerification = businessConfig.features.ageVerification;
  const availableTables = tables.filter(t => t.status === 'available');

  // --- Resizing Logic ---
  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (mouseMoveEvent: MouseEvent) => {
      if (isResizing) {
        // Calculate new width: Window Width - Mouse X Position
        // We subtract because the sidebar is on the right
        const newWidth = document.body.clientWidth - mouseMoveEvent.clientX;
        
        // Limits: Min 300px, Max 800px
        if (newWidth > 300 && newWidth < 800) {
            setWidth(newWidth);
        }
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
        window.addEventListener("mousemove", resize);
        window.addEventListener("mouseup", stopResizing);
    }
    return () => {
        window.removeEventListener("mousemove", resize);
        window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // --- Calculations ---
  const { subTotal, taxAmount, total } = useMemo(() => {
    const totalWithTax = currentOrder.items.reduce((sum, item) => {
      const price = item.selectedUnit?.price || 0;
      return sum + price * item.quantity;
    }, 0);

    const extractedTax = totalWithTax - totalWithTax / (1 + taxRate / 100);
    const subTotalBeforeTax = totalWithTax - extractedTax;

    return {
      subTotal: subTotalBeforeTax,
      taxAmount: extractedTax,
      total: totalWithTax,
    };
  }, [currentOrder.items, taxRate]);

  // --- Mappers ---
  const mappedCartItems: CartItem[] = useMemo(() => {
    return currentOrder.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.selectedUnit?.price || 0,
      imageUrl: item.imageUrl,
      variant: item.variantName,
      variantId: item.variantId || undefined,
      unitId: item.selectedUnit?.unitId,
      unitName: item.selectedUnit?.unitName,
      selectedUnit: item.selectedUnit,
      notes: item.notes 
    }));
  }, [currentOrder.items]);

  const activeCustomer: Customer | null = useMemo(() => {
    if (!currentOrder.customerId && !currentOrder.customerName) return null;
    return {
      id: currentOrder.customerId || 'guest',
      name: currentOrder.customerName || 'Guest',
      phone: (currentOrder as any).customerPhone,
      loyaltyPoints: (currentOrder as any).loyaltyPoints || 0,
    };
  }, [currentOrder]);

  // --- Handlers ---
  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setEditQuantity(item.quantity);
    setEditNotes(item.notes || '');
    setIsEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    updateItemInOrder({
        ...editingItem,
        quantity: editQuantity,
        notes: editNotes
    });
    setIsEditDialogOpen(false);
    setEditingItem(null);
  };

  const handleConfirmPayment = () => {
    if (requiresAgeVerification && !ageVerified) {
      setAgeVerificationOpen(true);
    } else {
      setPaymentDialogOpen(true);
    }
  };

  const handleAgeVerified = () => {
    setAgeVerified(true);
    setPaymentDialogOpen(true);
  };

  const handleSaveUnpaidOrder = () => {
    if (currentOrder.items.length === 0) return;
    saveUnpaidOrder(0);
  };

  const handlePaymentComplete = useCallback(
    (completedOrder: Order) => {
      setLastCompletedOrder(completedOrder);
      setPaymentDialogOpen(false);
      setReceiptDialogOpen(true);
      setAgeVerified(false);
      resetOrder();
    },
    [resetOrder]
  );

  const handleCloseReceipt = () => {
    setReceiptDialogOpen(false);
    setLastCompletedOrder(null);
  };

  const getNormalizedOrderType = (type: string): OrderType => {
    const map: Record<string, OrderType> = {
      takeaway: 'Takeaway',
      delivery: 'Delivery',
      'dine-in': 'Dine in',
      pickup: 'Pickup',
      online: 'Online',
    };
    return map[type] || 'Dine in';
  };

  return (
    <>
      <div 
        ref={sidebarRef}
        className="relative flex h-screen bg-card shadow-xl z-20 border-l border-border"
        style={{ 
            // Apply width dynamically. If collapsed, width is 0.
            width: isCollapsed ? 0 : width,
            // If dragging, we remove transition to make resizing instant/smooth. 
            // If simply toggling collapse, we keep transition for effect.
            transition: isResizing ? 'none' : 'width 300ms ease-in-out' 
        }}
      >
        
        {/* --- 1. Expand Button (Visible ONLY when collapsed) --- */}
        <Button
            variant="secondary"
            size="icon"
            onClick={() => setIsCollapsed(false)}
            className={cn(
                "absolute top-4 -left-12 h-10 w-10 rounded-r-none rounded-l-md border border-r-0 border-border shadow-md z-50 bg-card hover:bg-muted transition-opacity duration-300",
                isCollapsed ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}
            title="Open Cart"
        >
            <PanelRightOpen className="h-4 w-4" />
            
            {/* Badge for item count when collapsed */}
            {currentOrder.items.length > 0 && (
                <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-in zoom-in">
                    {currentOrder.items.length}
                </span>
            )}
        </Button>

        {/* --- 2. Resize Handle (Visible ONLY when expanded) --- */}
        <div 
            className={cn(
                "absolute top-0 bottom-0 -left-1 w-2 cursor-col-resize hover:bg-primary/50 transition-colors z-50 flex items-center justify-center group",
                isCollapsed ? "hidden" : "block"
            )}
            onMouseDown={startResizing}
        >
            {/* Visual indicator for the handle */}
            <div className="h-8 w-1 rounded-full bg-border group-hover:bg-primary transition-colors" />
        </div>


        {/* --- 3. Inner Content Wrapper --- */}
        <div className={cn(
            "flex flex-col h-full w-full overflow-hidden",
            // Fade out content when collapsing so it doesn't look squashed
            isCollapsed ? "opacity-0 invisible" : "opacity-100 visible transition-opacity duration-300 delay-100"
        )}>
          
          {/* --- Header Section --- */}
          <div className="p-4 md:p-6 border-b border-border shrink-0 flex items-start justify-between">
            <div className="flex-1">
                <h2 className="text-lg md:text-xl font-semibold">Order Details</h2>
                <p className="text-xs text-muted-foreground mt-1">
                    #{'New Order'}
                </p>
            </div>
            
            {/* Collapse Button (Inside Component) */}
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setIsCollapsed(true)}
                title="Collapse Cart"
            >
                <PanelRightClose className="h-5 w-5" />
            </Button>
          </div>

          <div className="px-4 md:px-6 py-2 border-b border-border bg-muted/10 space-y-3">
             {/* Customer & Type Inputs - Compacted for resizable view */}
              <div className="flex gap-2">
                 <div className="flex-1 min-w-[120px]">
                    <CustomerSelector />
                 </div>
                 <div className="w-[110px]">
                    <Select value={currentOrder.orderType} onValueChange={(value: any) => setOrderType(value)}>
                        <SelectTrigger className="h-10 text-xs">
                        <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        {availableOrderTypes.map(t => (
                            <SelectItem key={t} value={t}>{getNormalizedOrderType(t)}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                 </div>
              </div>

              {showTableField && (
                 <div className="flex gap-2">
                     <Select value={currentOrder.tableNumber || 'No Table'} onValueChange={setTableNumber}>
                        <SelectTrigger className="h-9 text-xs flex-1">
                             <SelectValue placeholder="Select Table" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="No Table">No Table</SelectItem>
                            {availableTables.map(table => (
                            <SelectItem key={table.id} value={table.number}>
                                Table {table.number} ({table.capacity})
                            </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 </div>
              )}
              
              <Textarea
                  placeholder="Order instructions..."
                  value={currentOrder.instructions || ''}
                  onChange={e => setInstructions(e.target.value)}
                  rows={1}
                  className="resize-none text-xs min-h-[36px] bg-background"
                />
          </div>

          {/* --- Cart Items List --- */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-muted/10">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Items ({currentOrder.items.length})</h3>
              <button 
                onClick={resetOrder} 
                className="text-xs text-destructive hover:text-destructive/80 font-medium transition-colors"
              >
                Clear All
              </button>
            </div>

            <div className="space-y-2.5">
              {currentOrder.items.map((item, index) => {
                const unitId = item.selectedUnit?.unitId || 'default';
                const unitName = item.selectedUnit?.unitName || 'Unit';
                const price = item.selectedUnit?.price || 0;

                return (
                  <Card key={`${item.productId}-${unitId}-${index}`} className="p-2.5 bg-card hover:bg-accent/5 transition-colors border-border/60 group relative">
                    <div className="flex gap-3">
                      {/* Item Image */}
                      <div className="relative w-14 h-14 rounded-md overflow-hidden bg-muted shrink-0 border border-border/50">
                        <img
                          src={item.imageUrl || '/placeholder.svg?height=64&width=64'}
                          alt={item.productName}
                          className="object-cover w-full h-full"
                        />
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-medium text-sm truncate pr-1 text-foreground w-full max-w-[150px]" title={item.productName}>
                              {item.productName}
                            </h4>
                            <div className="text-xs text-muted-foreground flex gap-1">
                              <span className="truncate max-w-[80px]">{item.variantName}</span>
                              <span>• {unitName}</span>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex gap-1 shrink-0">
                            <button 
                              onClick={() => handleOpenEdit(item)}
                              className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removeItemFromOrder(item.productId, unitId)}
                              className="p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-end justify-between mt-2">
                          {/* Notes Indicator */}
                          <div className="text-xs text-muted-foreground italic truncate max-w-[100px]">
                              {item.notes && `"${item.notes}"`}
                          </div>

                          {/* Price Calculation */}
                          <div className="text-right flex items-center gap-2">
                              <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">x{item.quantity}</span>
                              <span className="font-semibold text-sm">
                                  {price.toLocaleString()}
                              </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}

              {currentOrder.items.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3 opacity-60">
                  <div className="p-4 bg-muted rounded-full">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium">Cart is empty</span>
                </div>
              )}
            </div>
          </div>

          {/* --- Footer --- */}
          <div className="p-4 md:p-6 border-t border-border bg-card shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
            <div className="space-y-1.5 mb-4 text-sm">
              <div className="flex justify-between text-muted-foreground text-xs md:text-sm">
                <span>Subtotal</span>
                <span>{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs md:text-sm">
                <span>Tax ({taxRate}%)</span>
                <span>{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              <div className="my-2 h-px bg-border w-full" />
              
              <div className="flex justify-between items-center">
                <span className="font-semibold text-base md:text-lg">Total</span>
                <span className="text-lg md:text-xl font-bold text-primary">
                  KSH. {total.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="grid gap-2">
              <Button
                className="w-full font-semibold shadow-sm"
                size="lg"
                onClick={handleConfirmPayment}
                disabled={currentOrder.items.length === 0}
              >
                Checkout (KSH. {total.toLocaleString()})
              </Button>

              {allowSaveUnpaidOrders && (
                <Button
                  variant="outline"
                  className="w-full text-xs md:text-sm h-9 border-dashed"
                  onClick={handleSaveUnpaidOrder}
                  disabled={currentOrder.items.length === 0}
                >
                  Save as Unpaid
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- Dialogs (Unchanged) --- */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Item</DialogTitle>
            <DialogDescription>
               Make changes to {editingItem?.productName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
             <div className="flex items-center justify-between">
                <Label htmlFor="quantity" className="text-right">
                  Quantity
                </Label>
                <div className="flex items-center gap-3">
                    <Button 
                        variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => setEditQuantity(prev => Math.max(1, prev - 1))}
                    >
                        <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                        id="quantity"
                        type="number"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                        className="w-16 text-center h-8"
                    />
                    <Button 
                        variant="outline" size="icon" className="h-8 w-8"
                        onClick={() => setEditQuantity(prev => prev + 1)}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
             </div>
             <div className="grid gap-2">
                <Label htmlFor="notes">Item Notes</Label>
                <Textarea
                    id="notes"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g., No Sugar, Extra Spicy..."
                    className="resize-none"
                    rows={3}
                />
             </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AgeVerificationDialog
        open={ageVerificationOpen}
        onOpenChange={setAgeVerificationOpen}
        onVerified={handleAgeVerified}
      />

      <PaymentModal
        isOpen={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        cartItems={mappedCartItems}
        subtotal={total}
        discount={0}
        customer={activeCustomer}
        orderType={getNormalizedOrderType(currentOrder.orderType)}
        tableNumber={currentOrder.tableNumber}
        onOpenCustomer={() => console.log('Open Customer Selector')}
        onPaymentComplete={handlePaymentComplete}
      />
      
      <ReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        completedOrder={lastCompletedOrder}
        onClose={handleCloseReceipt}
      />
    </>
  );
}