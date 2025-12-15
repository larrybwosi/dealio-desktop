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
  Loader2,
  Crown,
  Star,
  Zap,
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
import { PaymentMethod, PaymentStatus, useProcessSale, processSaleApi } from '@/hooks/sales';
import { useAuthStore } from '@/store/pos-auth-store';
import { ably } from '@/lib/ably';
import { ProcessSaleInput, ProcessSaleInputSchema } from '@/lib/validation/transactions';
import { cn } from '@/lib/utils';
import { emit } from '@tauri-apps/api/event';

// --- COMPONENT ---

// Memoized customer badge component
const CustomerBadge = memo(({ customer }: { customer: Customer | null }) => {
  if (!customer) return null;
  const tierLevel = customer.loyaltyPoints || 0;

  if (tierLevel >= 1000) {
    // Dark mode compatible gold/yellow badge
    return (
      <Badge 
        variant="secondary" 
        className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-900 dark:from-yellow-500 dark:to-yellow-700 dark:text-yellow-950"
      >
        <Crown className="w-3 h-3 mr-1" /> VIP
      </Badge>
    );
  }
  if (tierLevel >= 500) {
    // Dark mode compatible purple badge
    return (
      <Badge 
        variant="secondary" 
        className="bg-gradient-to-r from-purple-400 to-purple-600 text-purple-900 dark:from-purple-500 dark:to-purple-700 dark:text-purple-950"
      >
        <Star className="w-3 h-3 mr-1" /> Gold
      </Badge>
    );
  }
  if (tierLevel >= 100) {
    // Dark mode compatible blue badge
    return (
      <Badge 
        variant="secondary" 
        className="bg-gradient-to-r from-blue-400 to-blue-600 text-blue-900 dark:from-blue-500 dark:to-blue-700 dark:text-blue-950"
      >
        <Zap className="w-3 h-3 mr-1" /> Silver
      </Badge>
    );
  }
  return <Badge variant="outline">Regular</Badge>;
});
CustomerBadge.displayName = 'CustomerBadge';

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

// --- NEW HELPER FUNCTION FOR MPESA QR DATA (M-Pesa Express Format) ---
const generateMpesaQrCodeData = (
    organizationName: string, 
    paybillNumber: string, 
    tillNumber: string, 
    accountRef: string, 
    amount: number
): string => {
    // Safaricom standard for Transacting QR (Lipa na M-Pesa QR)
    // Structure: MerchantName*Paybill/Till*AccountRef*Amount
    
    const businessNumber = paybillNumber || tillNumber; // Choose one for the business identifier
    const type = paybillNumber ? 'Paybill' : 'Till';

    if (!businessNumber) return `ERROR*NO_MPESA_ID*0*0*0`; // Fallback for missing settings

    // Using a more standard (non-TLV) format for simplicity and readability in this example:
    return `M-PESA-PAYMENT|${type.toUpperCase()}|${businessNumber}|${accountRef}|${amount.toFixed(2)}|${organizationName}`;
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
  onPaymentComplete,
}: PaymentModalProps) => {
  // UI State
  const [selectedTab, setSelectedTab] = useState<string>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [editableDiscount, setEditableDiscount] = useState<number>(discount);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const organizationId = 'org_1';
  
  // Mobile Payment State
  // ADDED 'QR' to the possible M-Pesa Modes
  const [mpesaMode, setMpesaMode] = useState<'STK' | 'PAYBILL' | 'BUY_GOODS' | 'QR'>('STK'); 
  const [mpesaPhone, setMpesaPhone] = useState(customer?.phone || '');
  const [mpesaWaiting, setMpesaWaiting] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState<'IDLE' | 'WAITING' | 'SUCCESS' | 'FAILED'>('IDLE');
  
  // Realtime C2B Matches
  const [detectedPayment, setDetectedPayment] = useState<any>(null);
  
  const { mutateAsync: createSale, isPending: isProcessing } = useProcessSale();
  const settings = usePosStore((state) => state.settings);
  const locationId = useAuthStore(state => state.currentLocation?.id);
  const taxRate = settings?.taxRate;

  // Organization Payment Settings (Fallback to placeholders if not in settings)
  const organizationName = settings?.businessName || 'My Business';
  const paybillNumber = settings?.paybillNumber || '';
  const tillNumber = settings?.tillNumber || '';

  const formatCurrency = useFormattedCurrency();
  const PHONE_CONFIG = getCurrentPhoneConfig();

  // IDs
  const orderId = useMemo(() => uuidv4(), [isOpen]);
  // Generate a shorter, cleaner reference for Paybill Account No
  const saleNumber = useMemo(
    () => `SALE-${Date.now().toString().slice(-6)}`,
    [isOpen]
  );
  
  // Account number without prefix for customer display
  const cleanAccountRef = useMemo(
      () => Date.now().toString().slice(-6),
      [isOpen]
  );

  const paybillAccountNo = useMemo(() => {
    return cleanAccountRef;
  }, [cleanAccountRef]);
  
  // Full reference (used for backend tracking/matching)
  const fullSaleNumber = saleNumber;

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

  // General QR Code Link (used for other payments/web links, kept for backwards compatibility)
  const paymentUrl = useMemo(
    () => `${API_ENDPOINT}/payment/${orderId}?amount=${totalPayable}&customer=${customer?.id || 'guest'}`,
    [orderId, totalPayable, customer]
  );

  // M-PESA Transacting QR Code Data (New Feature)
  const mpesaQrData = useMemo(() => {
      // Use paybill ref for paybill, or sale number for general till payment tracking
      // The `paybillAccountNo` (which is the clean reference) is passed here
      const ref = mpesaMode === 'PAYBILL' ? paybillAccountNo : paybillAccountNo;
      return generateMpesaQrCodeData(organizationName, paybillNumber, tillNumber, ref, totalPayable);
  }, [mpesaMode, organizationName, paybillNumber, tillNumber, paybillAccountNo, totalPayable]);


  // Initialize cash received
  useEffect(() => {
    if (selectedTab === 'CASH') {
      setCashReceived(totalPayable.toFixed(2));
    }
  }, [totalPayable, selectedTab]);

  // Effect to communicate M-Pesa details to Customer Display
  useEffect(() => {
    if (isOpen && selectedTab === 'MOBILE_PAYMENT' && (mpesaMode === 'QR' || mpesaMode === 'PAYBILL')) {
      // Emit the QR code data for the customer display
      emit('payment-update', {
        type: 'MPESA_QR',
        amount: totalPayable,
        qrData: mpesaQrData,
        paybill: paybillNumber,
        tillNo: tillNumber,
        accountRef: paybillAccountNo,
        mode: mpesaMode,
      });
    } else if (isOpen && selectedTab === 'CREDIT_CARD') {
         emit('payment-update', {
             type: 'CARD_PAYMENT',
             amount: totalPayable,
         });
    } else {
        // Clear payment details when tab changes or modal closes
        emit('payment-update', { type: 'CLEAR' });
    }
  }, [isOpen, selectedTab, mpesaMode, mpesaQrData, totalPayable, paybillNumber, tillNumber, paybillAccountNo]);


  // --- ABLY LISTENER FOR C2B (PAYBILL/BUY GOODS/QR) ---
  useEffect(() => {
    if (!isOpen || selectedTab !== 'MOBILE_PAYMENT' || !ably) return;
    
    // Channel: organization:{orgId}:payments
    const channelName = `organization:${organizationId}:payments`;
    const channel = ably.channels.get(channelName);

    const handleUnclaimed = (message: any) => {
        const data = message.data;
        
        // 1. Paybill / QR Match: Check BillRefNumber 
        if ((mpesaMode === 'PAYBILL' || mpesaMode === 'QR') && data.accountRef) {
          // Check if the received payment matches the current sale's account reference
          if (data.accountRef.toUpperCase() === paybillAccountNo.toUpperCase()) {
              setDetectedPayment(data);
              setMpesaStatus('SUCCESS');
              // Auto-trigger completion logic if exact match
              if (Number(data.amount) >= totalPayable) {
                  setTimeout(() => handleManualMatchCompletion(data), 1000);
              }
          }
        }

        // 2. Buy Goods Match: Check Amount (since Buy Goods often has no unique ref)
        if (mpesaMode === 'BUY_GOODS') {
              // Allow a small margin of error or exact match
              if (Math.abs(Number(data.amount) - totalPayable) < 1.0) {
                  setDetectedPayment(data);
                  // Auto-complete if amount is exact
                  if (Number(data.amount) === totalPayable) {
                     setTimeout(() => handleManualMatchCompletion(data), 1000);
                  }
              }
        }
    };

    channel.subscribe('payment-unclaimed', handleUnclaimed);
    
    // Also listen for 'payment-update' if the webhook managed to match it automatically (e.g., STK push success)
    channel.subscribe('payment-update', (msg) => {
        // Note: The STK push 'transactionId' is the fullSaleNumber ('SALE-XXXXXX')
        if(msg.data.transactionId === fullSaleNumber || msg.data.data?.accountRef === paybillAccountNo) {
            setMpesaStatus('SUCCESS');
            setDetectedPayment(msg.data.data);
            setTimeout(() => handleManualMatchCompletion(msg.data.data), 1000);
        }
    });

    return () => {
        channel.unsubscribe();
    };
  }, [isOpen, selectedTab, mpesaMode, organizationId, totalPayable, paybillAccountNo, fullSaleNumber]); // Added fullSaleNumber to deps


  const handleCopy = async (text: string) => {
    await writeText(text);
    if ((await isPermissionGranted()) || (await requestPermission()) === 'granted') {
      sendNotification({ title: 'Copied!', body: `${text} copied to clipboard.` });
    }
  };

  // --- PAYMENT COMPLETION LOGIC ---

  const preparePayload = (status: PaymentStatus): ProcessSaleInput | null => {
    const paymentMethod = mapUiMethodToPrisma(selectedTab);
    const payload: any = {
      cartItems: cartItems.map((item) => ({
        productId: item.productId || '',
        variantId: item.variantId || '',
        quantity: item.quantity,
        sellingUnitId: item.selectedUnit?.unitId || '',
      })),
      locationId: locationId,
      saleNumber: fullSaleNumber, // **ALWAYS use the full sale number for the backend record**
      accountRef: paybillAccountNo, // **Send the clean account ref for C2B matching**
      isWholesale: false,
      customerId: customer?.id || null,
      paymentMethod: paymentMethod,
      paymentStatus: status,
      enableStockTracking: true,
      notes: notes,
      discountAmount: editableDiscount,
    };

    if (paymentMethod === PaymentMethod.MPESA) {
      payload.mpesaPhoneNumber = mpesaMode === 'STK' ? normalizePhoneNumber(mpesaPhone, PHONE_CONFIG) : undefined;
      payload.mpesaPaymentMode = mpesaMode; // Track which mode was used
      payload.amountReceived = totalPayable;
      payload.change = 0;
      // If we have a detected payment receipt (C2B), attach it
      if (detectedPayment?.receipt) {
          payload.notes = `${notes} [M-Pesa Receipt: ${detectedPayment.receipt}]`;
      }
    } else if (paymentMethod === PaymentMethod.CASH) {
      payload.amountReceived = parseFloat(cashReceived) || 0;
      payload.change = change;
    } else {
      payload.amountReceived = totalPayable;
      payload.change = 0;
    }

    const result = ProcessSaleInputSchema.safeParse(payload);
    if (!result.success) {
      setValidationErrors(result.error.errors.map((e) => e.message));
      return null;
    }
    setValidationErrors([]);
    return result.data;
  };

  // Used when we receive a C2B event and just want to finalize the sale locally
  const handleManualMatchCompletion = async (c2bData: any) => {
      // If the webhook already created the sale in the DB, we might just need to fetch/link it.
      // However, assuming the standard flow where this UI creates the "Sale" record:
      const payload = preparePayload(PaymentStatus.COMPLETED);
      if (!payload) return;
      
      try {
          // Inject the receipt number
          const finalPayload = { 
              ...payload, 
              amountReceived: c2bData.amount,
              notes: `M-Pesa C2B: ${c2bData.receipt}. ${payload.notes}` 
          };
          
          const queuedSale: any = await createSale(finalPayload);
          completeOrderFlow(finalPayload, queuedSale);
      } catch (e) {
          console.error("Error finalizing C2B sale", e);
      }
  };

  const handlePaymentSubmission = async (status: PaymentStatus = PaymentStatus.COMPLETED) => {
    const payload = preparePayload(status);
    if (!payload) return;

    try {
      setMpesaStatus('IDLE');
      
      // 1. STK PUSH FLOW
      if (payload.paymentMethod === 'MPESA' && mpesaMode === 'STK') {
        const response: any = await processSaleApi(payload, locationId);
        if (response?.status === 202 && response?.meta?.ablyChannel) {
          setMpesaWaiting(true);
          setMpesaStatus('WAITING');
          const channel = ably?.channels.get(response.meta.ablyChannel);
          channel?.subscribe('payment-update', (msg) => {
            if (msg.data.transactionId === response.id) {
               const newStatus = msg.data.status === 'COMPLETED' ? 'SUCCESS' : 'FAILED';
               setMpesaStatus(newStatus);
               setMpesaWaiting(false);
               if (newStatus === 'SUCCESS') {
                 setTimeout(() => {
                   completeOrderFlow(payload, response);
                   channel?.unsubscribe();
                 }, 1500);
               } else {
                   setValidationErrors(['User cancelled or timed out or payment failed.']);
               }
            }
          });
        } else {
            completeOrderFlow(payload, response);
        }
      } 
      // 2. MANUAL C2B (PAYBILL, BUY GOODS, QR) FLOW - User initiates and we wait/confirm
      else if (payload.paymentMethod === 'MPESA' && (mpesaMode === 'PAYBILL' || mpesaMode === 'BUY_GOODS' || mpesaMode === 'QR')) {
            // If payment was detected by listener, it already auto-completed via handleManualMatchCompletion
            // If no payment detected, cashier is forcing completion.
            if (detectedPayment) {
                 // Already handled by listener and handleManualMatchCompletion
                 return;
            }

            // Fallback: Force complete the sale if the cashier confirms it's paid (e.g., they saw an SMS/screen)
            const queuedSale: any = await createSale(payload);
            completeOrderFlow(payload, queuedSale);
      }
      // 3. OTHER METHODS (CASH, CARD, PENDING)
      else {
        const queuedSale: any = await createSale(payload);
        completeOrderFlow(payload, queuedSale);
      }

    } catch (error) {
      console.error('Payment Error:', error);
      setValidationErrors(['Failed to process sale. Please check connection.']);
    }
  };

  const completeOrderFlow = (payload: ProcessSaleInput, response: any) => {
    const completedOrder: Order = {
        id: response?.id || orderId,
        orderNumber: response?.orderNumber || `ORD-${Date.now().toString().slice(-6)}`,
        items: cartItems,
        customer: customer,
        subtotal: priceBeforeTax,
        discount: editableDiscount,
        tax: calculatedTax,
        total: totalPayable,
        orderType: orderType,
        tableNumber: tableNumber,
        datetime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        notes: payload.notes || notes,
        status: payload.paymentStatus === 'COMPLETED' ? 'completed' : 'pending-payment',
        paymentMethod: selectedTab as any,
        saleNumber: fullSaleNumber, // Use full sale number here
        amountPaid: payload.amountReceived || 0,
        change: payload.change || 0,
    }
    // Clear the payment display on completion
    emit('payment-update', { type: 'CLEAR_COMPLETED' }); 
    onPaymentComplete(completedOrder);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <AnimatePresence>
        {isOpen && (
          <DialogContent
            className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto"
            onInteractOutside={(e) => (isProcessing || mpesaWaiting) && e.preventDefault()}
          >
            {/* OVERLAY FOR STK WAITING */}
            {mpesaWaiting && mpesaMode === 'STK' && (
                <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center rounded-lg">
                    <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="space-y-6 max-w-md">
                        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center relative dark:bg-green-900/50">
                             <div className="absolute inset-0 rounded-full border-4 border-green-500 border-t-transparent animate-spin"></div>
                             <Smartphone className="w-8 h-8 text-green-700 dark:text-green-300" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold mb-2">Check Customer Phone</h3>
                            <p className="text-muted-foreground">Prompt sent to <strong>{mpesaPhone}</strong>.</p>
                        </div>
                        <Button variant="outline" onClick={() => setMpesaWaiting(false)}>Cancel</Button>
                    </motion.div>
                </div>
            )}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <DialogHeader className="p-6 pb-4">
                <DialogTitle className="flex items-center gap-2">
                  Payment Details
                  {customer && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <UserPlus className="h-3 w-3" />
                      <span>{customer.name}</span>
                      <CustomerBadge customer={customer} />
                    </div>
                  )}
                  {editableDiscount > 0 && <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">Discount Applied</Badge>}
                </DialogTitle>
              </DialogHeader>

              {validationErrors.length > 0 && (
                <div className="px-6 pb-2">
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{validationErrors[0]}</AlertDescription>
                    </Alert>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 pt-0">
                {/* QR Code / Instructions Side (General QR Link) */}
                <div className="lg:col-span-1 flex flex-col items-center p-4 border rounded-lg bg-background/50 dark:bg-card">
                  <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <QrCode className="w-4 h-4" /> Web Payment Link
                  </h3>
                  <motion.div whileHover={{ scale: 1.05 }} className="p-2 bg-white rounded-lg shadow-md dark:bg-zinc-800">
                    <QRCodeSVG 
                      value={paymentUrl} 
                      size={160} 
                      level="H"
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </motion.div>
                  <Button variant="outline" size="sm" onClick={() => handleCopy(paymentUrl)} className="mt-4 w-full">
                      <Copy className="w-3 h-3 mr-1.5" /> Copy Link
                  </Button>
                </div>

                {/* Main Payment Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Totals Section */}
                  <div className="p-4 border rounded-lg bg-muted/20 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Discount</span>
                      <div className="flex items-center gap-2 w-32">
                          <span className="text-red-600 dark:text-red-400">-</span>
                          <Input
                              type="number"
                              min="0"
                              max={subtotal}
                              value={editableDiscount}
                              onChange={(e) => setEditableDiscount(Math.min(parseFloat(e.target.value) || 0, subtotal))}
                              className="h-8 text-right text-red-600 dark:text-red-400 bg-background"
                          />
                      </div>
                    </div>
                    <div className="flex justify-between font-bold text-xl pt-2 border-t">
                      <span>Total Payable</span>
                      <span>{formatCurrency(totalPayable)}</span>
                    </div>
                  </div>

                  {/* Payment Tabs */}
                  <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="MOBILE_PAYMENT"><Smartphone className="mr-2 h-4 w-4" /> M-Pesa</TabsTrigger>
                        <TabsTrigger value="CASH"><DollarSign className="mr-2 h-4 w-4" /> Cash</TabsTrigger>
                        <TabsTrigger value="CREDIT_CARD"><CreditCard className="mr-2 h-4 w-4" /> Card</TabsTrigger>
                      </TabsList>

                      <TabsContent value="MOBILE_PAYMENT" className="space-y-4">
                        {/* M-Pesa Mode Selector (Updated with 'QR') */}
                        <div className="flex p-1 bg-muted rounded-lg">
                              {['STK', 'QR', 'PAYBILL', 'BUY_GOODS'].map((mode) => (
                                   <button
                                       key={mode}
                                       onClick={() => {
                                           setMpesaMode(mode as any);
                                           setDetectedPayment(null);
                                           setMpesaStatus('IDLE');
                                       }}
                                       className={cn(
                                           "flex-1 text-sm font-medium py-1.5 rounded-md transition-all",
                                           mpesaMode === mode ? "bg-background shadow-sm text-primary dark:bg-zinc-800" : "text-muted-foreground hover:text-primary"
                                       )}
                                   >
                                       {mode === 'STK' ? 'STK Push' : mode === 'QR' ? 'QR Code' : mode === 'PAYBILL' ? 'Paybill' : 'Till No'}
                                   </button>
                              ))}
                        </div>

                        {/* MODE: STK PUSH */}
                        {mpesaMode === 'STK' && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                <Label>M-Pesa Number</Label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        value={mpesaPhone} 
                                        onChange={(e) => setMpesaPhone(e.target.value)} 
                                        className="pl-9" 
                                        placeholder="07..." 
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">Prompts client to enter PIN automatically.</p>
                            </div>
                        )}

                        {/* MODE: QR CODE (New Updated Logic) */}
                        {mpesaMode === 'QR' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 flex flex-col items-center">
                                <div className="p-4 border rounded-lg bg-card shadow-lg dark:bg-zinc-800 flex flex-col items-center space-y-3">
                                  <div className="text-xs text-muted-foreground uppercase tracking-wider">
                                      SCAN TO PAY {formatCurrency(totalPayable)}
                                  </div>
                                  <motion.div whileHover={{ scale: 1.05 }} className="p-2 bg-white rounded-lg shadow-md dark:bg-black">
                                      <QRCodeSVG 
                                          value={mpesaQrData} 
                                          size={180} 
                                          level="H"
                                          bgColor="#ffffff"
                                          fgColor="#000000" // QR codes must be black on white for scanning reliability
                                      />
                                  </motion.div>
                                  <div className="text-sm font-mono text-center break-all text-muted-foreground pt-1">
                                    Account Ref: <strong className="text-primary">{paybillAccountNo}</strong>
                                    <Copy onClick={() => handleCopy(paybillAccountNo)} className="h-3 w-3 ml-2 inline cursor-pointer hover:text-primary/80" />
                                  </div>
                                </div>

                                {/* Status Indicator */}
                                {!detectedPayment ? (
                                    <div className="flex items-center gap-3 text-sm text-amber-600 bg-amber-50 p-3 rounded-md dark:bg-amber-950 dark:text-amber-400">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Waiting for customer scan and payment...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                        <Check className="h-5 w-5" />
                                        <div className='text-left'>
                                            <p className="font-bold">Payment Received via QR!</p>
                                            <p className="text-xs">Receipt: {detectedPayment.receipt} • {detectedPayment.payer}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* MODE: PAYBILL */}
                        {mpesaMode === 'PAYBILL' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3 bg-muted/50 border rounded-md">
                                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Business No</div>
                                        <div className="text-lg font-mono font-bold flex items-center gap-2">
                                            {paybillNumber}
                                            <Copy onClick={() => handleCopy(paybillNumber)} className="h-3 w-3 cursor-pointer text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300" />
                                        </div>
                                    </div>
                                    <div className="p-3 bg-green-50/50 border border-green-100 rounded-md dark:bg-green-900/50 dark:border-green-800">
                                        <div className="text-xs text-green-700 uppercase tracking-wider mb-1 dark:text-green-300">Account No</div>
                                        <div className="text-lg font-mono font-bold text-green-700 flex items-center gap-2 dark:text-green-300">
                                            {paybillAccountNo}
                                            <Copy onClick={() => handleCopy(paybillAccountNo)} className="h-3 w-3 cursor-pointer text-green-500 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200" />
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Status Indicator */}
                                {!detectedPayment ? (
                                    <div className="flex items-center gap-3 text-sm text-amber-600 bg-amber-50 p-3 rounded-md dark:bg-amber-950 dark:text-amber-400">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Waiting for payment with Account No: <strong>{paybillAccountNo}</strong>...
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                                        <Check className="h-5 w-5" />
                                        <div className='text-left'>
                                            <p className="font-bold">Payment Received!</p>
                                            <p className="text-xs">Receipt: {detectedPayment.receipt} • {detectedPayment.payer}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* MODE: BUY GOODS */}
                        {mpesaMode === 'BUY_GOODS' && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                                <div className="p-4 bg-muted/50 border rounded-md flex flex-col items-center">
                                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Buy Goods Till Number</div>
                                    <div className="text-3xl font-mono font-bold flex items-center gap-3">
                                        {tillNumber}
                                        <Copy onClick={() => handleCopy(tillNumber)} className="h-5 w-5 cursor-pointer text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300" />
                                    </div>
                                </div>

                                {/* Incoming Payments List (Mock "Listener") */}
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground">Incoming Payments Stream</Label>
                                    {!detectedPayment ? (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground italic border border-dashed p-3 rounded-md justify-center">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Listening for {formatCurrency(totalPayable)}...
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between bg-green-50/50 border border-green-200 p-3 rounded-md animate-in slide-in-from-right-2 dark:bg-green-900/50 dark:border-green-800">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-green-200/50 p-2 rounded-full dark:bg-green-800"><Check className="h-4 w-4 text-green-700 dark:text-green-300" /></div>
                                                <div className='text-left'>
                                                    <p className="text-sm font-bold text-green-800 dark:text-green-300">{formatCurrency(detectedPayment.amount)}</p>
                                                    <p className="text-xs text-green-700 dark:text-green-400">{detectedPayment.phone} • {detectedPayment.receipt}</p>
                                                </div>
                                            </div>
                                            <Button size="sm" onClick={() => handleManualMatchCompletion(detectedPayment)} className="bg-green-600 hover:bg-green-700">
                                                Confirm
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                      </TabsContent>

                      <TabsContent value="CASH" className="pt-2">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label>Amount Received</Label>
                            <Input value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} type="number" />
                          </div>
                          <div className="space-y-1">
                            <Label>Change Due</Label>
                            <div className={`px-3 py-2 border rounded-md font-medium h-10 flex items-center ${change < 0 ? 'text-red-500 bg-red-50 dark:bg-red-950 dark:border-red-800' : 'bg-background'}`}>
                              {formatCurrency(change)}
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="CREDIT_CARD" className="pt-2">
                        <Alert>
                            <CreditCard className="h-4 w-4" />
                            <AlertDescription>Charge <strong>{formatCurrency(totalPayable)}</strong> on terminal.</AlertDescription>
                          </Alert>
                      </TabsContent>
                  </Tabs>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input placeholder="Optional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                </div>
              </div>

              <DialogFooter className="p-6 pt-2 flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={onClose} disabled={isProcessing || mpesaWaiting}>Cancel</Button>
                <Button variant="secondary" onClick={() => handlePaymentSubmission(PaymentStatus.PENDING)} disabled={isProcessing || mpesaWaiting}>
                  <ReceiptText className="mr-2 h-4 w-4" /> Save Pending
                </Button>
                
                {/* DYNAMIC ACTION BUTTON */}
                <Button
                  onClick={() => handlePaymentSubmission(PaymentStatus.COMPLETED)}
                  className="w-full sm:w-auto min-w-[140px]"
                  disabled={
                      isProcessing || 
                      mpesaWaiting ||
                      (selectedTab === 'CASH' && (parseFloat(cashReceived) || 0) < totalPayable) ||
                      (selectedTab === 'MOBILE_PAYMENT' && mpesaMode === 'STK' && !mpesaPhone)
                  }
                >
                  {isProcessing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
                  ) : (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      {selectedTab === 'MOBILE_PAYMENT' && mpesaMode === 'STK' ? 'Send STK & Pay' : 'Complete Payment'}
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