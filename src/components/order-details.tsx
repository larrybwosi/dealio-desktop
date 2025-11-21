'use client';

import { useState, useMemo, useCallback } from 'react';
import { usePosStore } from '@/store/store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Edit2 } from 'lucide-react';
import PaymentModal from './pos/payment-dialog';
import { CustomerSelector } from './customer-selector';
import { AgeVerificationDialog } from './age-verification-dialog';
import type { Order, CartItem, Customer, OrderType } from '@/types';
import { ReceiptDialog } from './receipt-dialog';

export function OrderDetails() {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [ageVerificationOpen, setAgeVerificationOpen] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [lastCompletedOrder, setLastCompletedOrder] = useState<any>(null);

  // Store Hooks
  const currentOrder = usePosStore(state => state.currentOrder);
  const taxRate = usePosStore(state => state.settings.taxRate) || 0;
  const getBusinessConfig = usePosStore(state => state.getBusinessConfig);
  const tables = usePosStore(state => state.tables);
  const setOrderType = usePosStore(state => state.setOrderType);
  const setTableNumber = usePosStore(state => state.setTableNumber);
  const setInstructions = usePosStore(state => state.setInstructions);
  const removeItemFromOrder = usePosStore(state => state.removeItemFromOrder);
  const resetOrder = usePosStore(state => state.resetOrder);
  const saveUnpaidOrder = usePosStore(state => state.saveUnpaidOrder);
  const allowSaveUnpaidOrders = usePosStore(state => state.settings.allowSaveUnpaidOrders);

  // Config
  const businessConfig = getBusinessConfig();
  const availableOrderTypes = businessConfig.orderTypes;
  const showTableField = businessConfig.features.tableManagement;
  const requiresAgeVerification = businessConfig.features.ageVerification;
  const availableTables = tables.filter(t => t.status === 'available');

  // Calculations: Break down Total into Subtotal and Tax
  const { subTotal, taxAmount, total } = useMemo(() => {
    const totalWithTax = currentOrder.items.reduce((sum, item) => {
      const price = item.selectedUnit?.price || 0;
      return sum + price * item.quantity;
    }, 0);

    // Extract tax from the total (Assuming prices are tax-inclusive)
    // Formula: Tax = Total - (Total / (1 + TaxRate/100))
    const extractedTax = totalWithTax - totalWithTax / (1 + taxRate / 100);
    const subTotalBeforeTax = totalWithTax - extractedTax;

    return {
      subTotal: subTotalBeforeTax,
      taxAmount: extractedTax,
      total: totalWithTax,
    };
  }, [currentOrder.items, taxRate]);

  // Data Mapping for Payment Modal
  const mappedCartItems: CartItem[] = useMemo(() => {
    return currentOrder.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.selectedUnit?.price || 0,
      imageUrl: item.imageUrl,
      variant: item.variantName,
      variantId: item.variantId || 'default',
      unitId: item.selectedUnit?.unitId,
      unitName: item.selectedUnit?.unitName,
      selectedUnit: item.selectedUnit,
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

  // Handlers
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
    console.log('Order Completed:', completedOrder);

    // 1. Set the completed order data
    setLastCompletedOrder(completedOrder);

    // 2. Close payment modal
    setPaymentDialogOpen(false);

    // 3. Open Receipt Dialog
    setReceiptDialogOpen(true);

    // 4. Reset local logic
    setAgeVerified(false);

    // Note: We do NOT call resetOrder() here immediately anymore.
    // We wait until the user closes the receipt dialog to clear the cart,
    // or we clear it now but keep the data in 'lastCompletedOrder' for the receipt.
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
      <div className="w-96 border-l border-border bg-card h-screen flex flex-col overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-semibold mb-4">Order Details</h2>

          <div className="space-y-4">
            {/* Customer Selector */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Customer Information <span className="text-muted-foreground text-xs">(Optional)</span>
              </label>
              <CustomerSelector />
            </div>

            {/* Order Type */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Order Type</label>
              <Select value={currentOrder.orderType} onValueChange={(value: any) => setOrderType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableOrderTypes.includes('takeaway') && <SelectItem value="takeaway">Take Away</SelectItem>}
                  {availableOrderTypes.includes('delivery') && <SelectItem value="delivery">Delivery</SelectItem>}
                  {availableOrderTypes.includes('dine-in') && <SelectItem value="dine-in">Dine In</SelectItem>}
                  {availableOrderTypes.includes('pickup') && <SelectItem value="pickup">Pickup</SelectItem>}
                  {availableOrderTypes.includes('online') && <SelectItem value="online">Online</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Table Selection */}
            {showTableField && (
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  Table <span className="text-xs">(Optional)</span>
                </label>
                <Select value={currentOrder.tableNumber || 'No Table'} onValueChange={setTableNumber}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a table" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="No Table">No Table</SelectItem>
                    {availableTables.map(table => (
                      <SelectItem key={table.id} value={table.number}>
                        Table {table.number} ({table.capacity} seats) - {table.section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Instructions */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Special Instructions <span className="text-xs">(Optional)</span>
              </label>
              <Textarea
                placeholder="Add any special instructions..."
                value={currentOrder.instructions || ''}
                onChange={e => setInstructions(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        </div>

        {/* Order Items List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Order Items</h3>
            <button onClick={resetOrder} className="text-sm text-destructive hover:underline">
              Reset Order
            </button>
          </div>

          <div className="space-y-3">
            {currentOrder.items.map((item, index) => {
              const unitId = item.selectedUnit?.unitId || 'default';
              const unitName = item.selectedUnit?.unitName || 'Unit';
              const price = item.selectedUnit?.price || 0;

              return (
                <Card key={`${item.productId}-${unitId}-${index}`} className="p-3">
                  <div className="flex gap-3">
                    <div className="relative w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                      <img
                        src={item.imageUrl || '/placeholder.svg?height=64&width=64'}
                        alt={item.productName}
                        className="object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-medium text-sm">{item.productName}</h4>
                        <div className="flex gap-1">
                          <button className="text-muted-foreground hover:text-foreground">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeItemFromOrder(item.productId, unitId)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>Variant : {item.variantName}</div>
                        <div>Unit : {unitName}</div>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <span className="font-semibold text-sm">KSH. {price.toLocaleString()}</span>
                        <span className="text-sm text-muted-foreground">x{item.quantity}</span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {currentOrder.items.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">No items added yet</div>
            )}
          </div>
        </div>

        {/* Footer with Totals and Actions */}
        <div className="p-6 border-t border-border space-y-4">
          <div className="pt-3 border-t border-border">
            {/* Display Subtotal and Tax */}
            <div className="space-y-1.5 mb-4 pb-4 border-b border-border text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal (excl. tax)</span>
                <span>
                  KSH. {subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({taxRate}%)</span>
                <span>
                  KSH. {taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center mb-4">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold">KSH. {total.toLocaleString()}</span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                className="w-full"
                size="lg"
                onClick={handleConfirmPayment}
                disabled={currentOrder.items.length === 0}
              >
                Confirm Payment
              </Button>

              {allowSaveUnpaidOrders && (
                <Button
                  variant="outline"
                  className="w-full bg-transparent"
                  size="lg"
                  onClick={handleSaveUnpaidOrder}
                  disabled={currentOrder.items.length === 0}
                >
                  Save to Order List (Unpaid)
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <AgeVerificationDialog
        open={ageVerificationOpen}
        onOpenChange={setAgeVerificationOpen}
        onVerified={handleAgeVerified}
      />

      <PaymentModal
        isOpen={paymentDialogOpen}
        onClose={() => setPaymentDialogOpen(false)}
        cartItems={mappedCartItems}
        subtotal={total} // We pass the Gross Total; the Modal extracts tax internally
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
