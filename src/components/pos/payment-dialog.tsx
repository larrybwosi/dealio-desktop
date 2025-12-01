import { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  CreditCard,
  Smartphone,
  DollarSign,
  Check,
  ReceiptText,
  UserPlus,
  Phone,
  AlertCircle,
  QrCode,
  Copy,
  ExternalLink,
  Crown,
  Star,
  Zap,
  Info,
  Loader2,
} from 'lucide-react';
import { useFormattedCurrency } from '@/lib/utils';
import { getCurrentPhoneConfig } from '@/lib/phone.config';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { CartItem, Customer, Order, OrderType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { API_ENDPOINT } from '@/lib/axios';
import { usePosStore } from '@/store/store';
import { PaymentMethod, PaymentStatus, ProcessSaleInput, ProcessSaleInputSchema, useProcessSale } from '@/hooks/sales';
import { ably } from '@/lib/ably';

// --- COMPONENT ---

// Memoized customer badge component
const CustomerBadge = memo(({ customer }: { customer: Customer | null }) => {
  if (!customer) return null;
  const tierLevel = customer.loyaltyPoints || 0;

  if (tierLevel >= 1000) {
    return (
      <Badge variant="secondary" className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900">
        <Crown className="w-3 h-3 mr-1" /> VIP
      </Badge>
    );
  }
  if (tierLevel >= 500) {
    return (
      <Badge variant="secondary" className="bg-gradient-to-r from-purple-400 to-purple-600 text-purple-900">
        <Star className="w-3 h-3 mr-1" /> Gold
      </Badge>
    );
  }
  if (tierLevel >= 100) {
    return (
      <Badge variant="secondary" className="bg-gradient-to-r from-blue-400 to-blue-600 text-blue-900">
        <Zap className="w-3 h-3 mr-1" /> Silver
      </Badge>
    );
  }
  return <Badge variant="outline">Regular</Badge>;
});
CustomerBadge.displayName = 'CustomerBadge';

// Helper for UI payment method mapping to Prisma Enum
const mapUiMethodToPrisma = (method: string): PaymentMethod => {
  switch (method) {
    case 'MOBILE_PAYMENT':
      return PaymentMethod.MPESA;
    case 'CREDIT_CARD':
      return PaymentMethod.CREDIT;
    case 'CASH':
    default:
      return PaymentMethod.CASH;
  }
};

const normalizePhoneNumber = (phone: string, config: { countryCode: string }): string => {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith(config.countryCode)) return cleaned;
  if (cleaned.startsWith('254')) return `+${cleaned}`;
  if (cleaned.startsWith('07') || cleaned.startsWith('01')) return `${config.countryCode}${cleaned.substring(1)}`;
  if (cleaned.startsWith('7') || cleaned.startsWith('1')) return `${config.countryCode}${cleaned}`;
  return cleaned;
};

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  subtotal: number;
  discount: number;
  customer: Customer | null;
  orderType: OrderType;
  tableNumber?: string;
  onOpenCustomer: () => void;
  onPaymentComplete: (order: Order) => void;
}

const PaymentModal = ({
  isOpen,
  onClose,
  cartItems,
  subtotal,
  discount,
  customer,
  orderType,
  tableNumber,
  onOpenCustomer,
  onPaymentComplete,
}: PaymentModalProps) => {
  // UI State
  const [selectedTab, setSelectedTab] = useState<string>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [editableDiscount, setEditableDiscount] = useState<number>(discount);
  
  // Mobile Payment State
  const [mpesaPhone, setMpesaPhone] = useState(customer?.phone || '');
  const [mpesaWaiting, setMpesaWaiting] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState<'IDLE' | 'WAITING' | 'SUCCESS' | 'FAILED'>('IDLE');
  
  // Validation Error State
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Hooks / Store
  const { mutateAsync: createSale, isPending: isProcessing } = useProcessSale();
  const settings = usePosStore((state) => state.settings);
  const taxRate = settings?.taxRate;

  const formatCurrency = useFormattedCurrency();
  const PHONE_CONFIG = getCurrentPhoneConfig();

  // IDs
  const orderId = useMemo(() => uuidv4(), [isOpen]);
  const saleNumber = useMemo(
    () => `SALE-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    [isOpen]
  );

  useEffect(() => {
    setEditableDiscount(discount);
  }, [discount]);

  // Calculations
  const { totalPayable, priceBeforeTax, calculatedTax } = useMemo(() => {
    const total = Math.max(0, subtotal - editableDiscount);
    const rate = Number(taxRate) || 0;
    const taxableAmount = total / (1 + rate);
    const taxAmount = total - taxableAmount;
    return { totalPayable: total, priceBeforeTax: taxableAmount, calculatedTax: taxAmount };
  }, [subtotal, editableDiscount, taxRate]);

  const change = useMemo(() => {
    const received = parseFloat(cashReceived) || 0;
    return received > totalPayable ? received - totalPayable : 0;
  }, [cashReceived, totalPayable]);

  const paymentUrl = useMemo(
    () => `${API_ENDPOINT}/payment/${orderId}?amount=${totalPayable}&customer=${customer?.id || 'guest'}`,
    [orderId, totalPayable, customer]
  );

  // Initialize cash received
  useEffect(() => {
    if (selectedTab === 'CASH') {
      setCashReceived(totalPayable.toFixed(2));
    }
  }, [totalPayable, selectedTab]);

  const handleCopyPaymentUrl = async () => {
    await writeText(paymentUrl);
    if ((await isPermissionGranted()) || (await requestPermission()) === 'granted') {
      sendNotification({ title: 'Copied!', body: 'Payment link copied to clipboard.' });
    }
  };

  // --- CORE PAYMENT LOGIC ---

  const preparePayload = (status: PaymentStatus): ProcessSaleInput | null => {
    const prismaMethod = mapUiMethodToPrisma(selectedTab);

    // Basic payload structure
    const payload: any = {
      cartItems: cartItems.map((item) => ({
        productId: item.productId || '',
        variantId: item.variantId || '',
        quantity: item.quantity,
        sellingUnitId: item.selectedUnit?.unitId || '',
      })),
      locationId: 'LOC-DEFAULT', // Replace with actual location ID from store
      saleNumber: saleNumber,
      isWholesale: false,
      customerId: customer?.id || null,
      paymentMethod: prismaMethod,
      paymentStatus: status,
      enableStockTracking: true, // Or based on settings
      notes: notes,
      discountAmount: editableDiscount,
      // Add tax IDs if available in settings
    };

    // Add method specific fields
    if (prismaMethod === PaymentMethod.MPESA) {
      payload.mpesaPhoneNumber = normalizePhoneNumber(mpesaPhone, PHONE_CONFIG);
      payload.amountReceived = totalPayable;
      payload.change = 0;
    } else if (prismaMethod === PaymentMethod.CASH) {
      payload.amountReceived = parseFloat(cashReceived) || 0;
      payload.change = change;
      // payload.cashDrawerId = '...'; // If relevant
    } else {
      // Card / Other
      payload.amountReceived = totalPayable;
      payload.change = 0;
    }

    // Validate using Zod
    const result = ProcessSaleInputSchema.safeParse(payload);

    if (!result.success) {
      const errors = result.error.errors.map((e) => e.message);
      setValidationErrors(errors);
      return null;
    }

    setValidationErrors([]);
    return result.data;
  };

  const handlePaymentSubmission = async (status: PaymentStatus = PaymentStatus.COMPLETED) => {
    const payload = preparePayload(status);
    if (!payload) return;

    try {
      setMpesaStatus('IDLE');
      
      // Submit to backend
      // Note: We cast response to any here because standard useMutation types might not capture the custom meta fields
      // returned by the specific 202 response unless typed explicitly in the hook.
      const response: any = await createSale(payload);

      // --- M-PESA LOGIC START ---
      if (payload.paymentMethod === 'MPESA' && response?.status === 202 && response?.meta?.ablyChannel) {
        
        setMpesaWaiting(true);
        setMpesaStatus('WAITING');

        // Subscribe to Ably
        const channel = ably?.channels.get(response.meta.ablyChannel);

        channel?.subscribe('payment-update', (msg) => {
          if (msg.data.transactionId === response.id) {
            if (msg.data.status === 'COMPLETED') {
              setMpesaStatus('SUCCESS');
              setMpesaWaiting(false);
              
              // Finalize UI
              setTimeout(() => {
                completeOrderFlow(payload, response);
                channel?.unsubscribe();
              }, 1500);
            } else {
              setMpesaStatus('FAILED');
              setMpesaWaiting(false);
              setValidationErrors(['Payment failed or was cancelled. Please try again.']);
              channel?.unsubscribe();
            }
          }
        });

      } 
      // --- M-PESA LOGIC END ---
      
      else {
        // Standard Success (Cash, Card, or direct confirmation)
        completeOrderFlow(payload, response);
      }

    } catch (error) {
      console.error('Payment Error:', error);
      // Determine if it's a validation error from server or network error
      setValidationErrors(['Failed to process sale. Please check connection and try again.']);
    }
  };

  const completeOrderFlow = (payload: ProcessSaleInput, response: any) => {
    const completedOrder: Order = {
        id: response?.id || orderId,
        orderNumber: response?.orderNumber || `ORD-${Date.now()}`,
        items: cartItems,
        customer: customer,
        subtotal: priceBeforeTax,
        discount: editableDiscount,
        tax: calculatedTax,
        total: totalPayable,
        orderType: orderType,
        tableNumber: tableNumber,
        datetime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        notes: notes,
        status: payload.paymentStatus === 'COMPLETED' ? 'completed' : 'pending-payment',
        paymentMethod: selectedTab as any,
        saleNumber: saleNumber,
        amountPaid: payload.amountReceived || 0,
        change: payload.change || 0,
    }
    onPaymentComplete(completedOrder);
    onClose();
  };

  const handleSaveAsPending = () => {
      handlePaymentSubmission(PaymentStatus.PENDING);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <AnimatePresence>
        {isOpen && (
          <DialogContent
            className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => (isProcessing || mpesaWaiting) && e.preventDefault()}
          >
            {/* OVERLAY FOR M-PESA WAITING */}
            {mpesaWaiting && (
                <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center rounded-lg">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="space-y-6 max-w-md"
                    >
                        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center relative">
                             <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
                             <Smartphone className="w-8 h-8 text-green-700" />
                        </div>
                        
                        <div>
                            <h3 className="text-2xl font-bold mb-2">Check Customer Phone</h3>
                            <p className="text-muted-foreground">
                                An M-Pesa prompt has been sent to <strong>{mpesaPhone}</strong>.
                                Waiting for PIN entry...
                            </p>
                        </div>
                        
                        <div className="flex justify-center pt-4">
                             <Button variant="outline" onClick={() => setMpesaWaiting(false)}>Cancel Waiting</Button>
                        </div>
                    </motion.div>
                </div>
            )}

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <DialogHeader className="p-6 pb-4">
                <DialogTitle className="flex items-center gap-2">
                  Payment Details
                  {editableDiscount > 0 && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Discount Applied
                    </Badge>
                  )}
                  {orderType === 'Dine in' && <Badge variant="outline">Table {tableNumber}</Badge>}
                </DialogTitle>
              </DialogHeader>

              {/* Validation Errors Display */}
              {validationErrors.length > 0 && (
                <div className="px-6 pb-2">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Action Required</AlertTitle>
                        <AlertDescription>
                            <ul className="list-disc pl-4 space-y-1 mt-1">
                                {validationErrors.map((err, idx) => (
                                    <li key={idx} className="text-xs">{err}</li>
                                ))}
                            </ul>
                        </AlertDescription>
                    </Alert>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 pt-0">
                {/* Left Column - QR Code */}
                <div className="lg:col-span-1 flex flex-col items-center p-4 border rounded-lg bg-background">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-slate-600">
                    <QrCode className="w-4 h-4" /> Scan to Pay
                  </h3>
                  <motion.div whileHover={{ scale: 1.05 }} className="p-2 bg-white rounded-lg shadow-md">
                    <QRCodeSVG value={paymentUrl} size={160} />
                  </motion.div>
                  <div className="flex items-center gap-2 mt-4 w-full">
                    <Button variant="outline" size="sm" onClick={handleCopyPaymentUrl} className="flex-1">
                      <Copy className="w-3 h-3 mr-1.5" /> Copy Link
                    </Button>
                    <Button asChild variant="outline" size="icon" className="h-9 w-9">
                      <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1 justify-center">
                    <Badge variant="outline" className="text-xs">
                      {saleNumber}
                    </Badge>
                  </div>
                </div>

                {/* Right Column - Payment Details */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Customer Info */}
                  <div className="p-4 border rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium">Customer Information</h3>
                      <Button variant="outline" size="sm" onClick={onOpenCustomer}>
                        <UserPlus className="mr-1 h-3 w-3" />
                        {customer ? 'Change' : 'Select'} Customer
                      </Button>
                    </div>
                    {customer ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{customer.name}</p>
                          <CustomerBadge customer={customer} />
                        </div>
                        {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No customer selected</p>
                    )}
                  </div>

                  {/* Totals */}
                  <div className="p-4 border rounded-lg space-y-2 bg-muted/20">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <div className="flex items-center gap-2 w-32">
                         <span className="text-red-600">-</span>
                         <Input
                            type="number"
                            min="0"
                            max={subtotal}
                            value={editableDiscount}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (isNaN(val)) setEditableDiscount(0);
                                else setEditableDiscount(Math.min(val, subtotal));
                            }}
                            className="h-8 text-right text-red-600 bg-background"
                         />
                      </div>
                    </div>
                    <div className="flex justify-between font-bold text-xl pt-2 border-t">
                      <span>Total Payable</span>
                      <span>{formatCurrency(totalPayable)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 flex justify-between items-center">
                      <span>Tax included: {formatCurrency(calculatedTax)}</span>
                      <Info className="w-3 h-3" />
                    </div>
                  </div>

                  {/* Payment Tabs */}
                  <div className="space-y-3">
                    <Label>Payment Method</Label>
                    <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="MOBILE_PAYMENT">
                          <Smartphone className="mr-2 h-4 w-4" />
                          M-Pesa
                        </TabsTrigger>
                        <TabsTrigger value="CASH">
                          <DollarSign className="mr-2 h-4 w-4" />
                          Cash
                        </TabsTrigger>
                        <TabsTrigger value="CREDIT_CARD">
                          <CreditCard className="mr-2 h-4 w-4" />
                          Card
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="MOBILE_PAYMENT" className="pt-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="phone-number">M-Pesa Number</Label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                  id="phone-number"
                                  placeholder="e.g. 0712345678"
                                  value={mpesaPhone}
                                  onChange={(e) => {
                                      setMpesaPhone(e.target.value);
                                      setValidationErrors([]); // clear errors on edit
                                  }}
                                  className="pl-10"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Entering a number will trigger an STK Push upon clicking Complete Payment.
                              </p>
                            </div>
                            
                            {mpesaStatus === 'FAILED' && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                        Transaction failed. Please try again or use a different method.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                      </TabsContent>

                      <TabsContent value="CASH" className="pt-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label htmlFor="cash-received">Amount Received</Label>
                            <Input
                              id="cash-received"
                              value={cashReceived}
                              onChange={(e) => setCashReceived(e.target.value)}
                              type="number"
                              step="0.01"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Change Due</Label>
                            <div className={`px-3 py-2 border rounded-md font-medium h-10 flex items-center ${change < 0 ? 'text-red-500 bg-red-50 border-red-200' : 'bg-background'}`}>
                              {formatCurrency(change)}
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="CREDIT_CARD" className="pt-4">
                        <Alert>
                            <CreditCard className="h-4 w-4" />
                            <AlertDescription>
                              Charge <strong>{formatCurrency(totalPayable)}</strong> on the external terminal.
                            </AlertDescription>
                          </Alert>
                      </TabsContent>
                    </Tabs>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Order Notes</Label>
                    <Input
                      id="notes"
                      placeholder="Optional notes..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="p-6 pt-2 flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={onClose} className="w-full sm:w-auto" disabled={isProcessing}>
                  Cancel
                </Button>
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={handleSaveAsPending}
                  disabled={isProcessing}
                >
                  <ReceiptText className="mr-2 h-4 w-4" />
                  Save as Pending
                </Button>
                <Button
                  onClick={() => handlePaymentSubmission(PaymentStatus.COMPLETED)}
                  className="w-full sm:w-auto min-w-[140px]"
                  disabled={isProcessing || (selectedTab === 'CASH' && (parseFloat(cashReceived) || 0) < totalPayable)}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      {selectedTab === 'MOBILE_PAYMENT' ? 'Send Request & Pay' : 'Complete Payment'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  );
};

export default memo(PaymentModal);