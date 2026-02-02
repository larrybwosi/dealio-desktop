import { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  CreditCard,
  Smartphone,
  DollarSign,
  Check,
  ReceiptText, // Added
  // UserPlus, Phone, QrCode, Copy, // Removed
  Loader2,
  Crown,
  Star,
  Zap,
  Gift,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner'; // Added toast
import { useFormattedCurrency } from '@/lib/utils';
import { getCurrentPhoneConfig } from '@/lib/phone.config';
import { CartItem, Customer, Order, OrderType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { usePosStore } from '@/store/store';
import { PaymentMethod, PaymentStatus, useProcessSale } from '@/hooks/sales';
import { useAuthStore } from '@/store/pos-auth-store';
import { MpesaFlowType, ProcessSaleInput, ProcessSaleInputSchema } from '@/lib/validation/transactions';
import { cn } from '@/lib/utils';
import { emit } from '@tauri-apps/api/event';
import { useAblyStore } from '@/store/ablyStore';
import { useCashDrawer } from '@/hooks/use-cash-drawer';
import { useGiftCard } from '@/hooks/use-gift-card';

// --- COMPONENT ---

// Memoized customer badge component
const CustomerBadge = memo(({ customer }: { customer: Customer | null }) => {
  if (!customer) return null;
  const tierLevel = customer.loyaltyPoints || 0;

  if (tierLevel >= 1000) {
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
    const businessNumber = paybillNumber || tillNumber;
    const type = paybillNumber ? 'Paybill' : 'Till';

    if (!businessNumber) return `ERROR*NO_MPESA_ID*0*0*0`;

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

interface AddedPayment {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string; // e.g. M-Pesa Code, Card Last 4
  meta?: any; // Full object for backend
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
  const [selectedTab, setSelectedTab] = useState<string>('CASH');
  
  // Payment Breakdown State
  const [currentPayments, setCurrentPayments] = useState<AddedPayment[]>([]);
  
  // Inputs for adding a new payment
  const [amountInput, setAmountInput] = useState<string>('');
  const [notes, setNotes] = useState('');
  
  const [editableDiscount, setEditableDiscount] = useState<number>(discount);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  
  // Gift Card State
  const [giftCardCode, setGiftCardCode] = useState('');
  const { validateGiftCard, isLoading: isValidatingGC } = useGiftCard();

  // M-Pesa State
  const [mpesaMode, setMpesaMode] = useState<'STK' | 'PAYBILL' | 'BUY_GOODS' | 'QR'>('STK'); 
  const [mpesaPhone, setMpesaPhone] = useState(customer?.phone || '');
  const [mpesaWaiting, setMpesaWaiting] = useState(false);
  const [mpesaStatus, setMpesaStatus] = useState<'IDLE' | 'WAITING' | 'SUCCESS' | 'FAILED'>('IDLE');
  const [detectedPayment, setDetectedPayment] = useState<any>(null);
  
  const { mutateAsync: createSale, isPending: isProcessing } = useProcessSale();
  const { openPhysicalDrawer } = useCashDrawer();
  const settings = usePosStore((state) => state.settings);
  const autoPrintConfig = settings.autoPrintConfig;
  const locationId = useAuthStore(state => state.currentLocation?.id);
  const taxRate = settings?.taxRate;

  const organizationName = settings?.businessName || 'My Business';
  const paybillNumber = settings?.paybillNumber || '';
  const tillNumber = settings?.tillNumber || '';

  const formatCurrency = useFormattedCurrency();
  const PHONE_CONFIG = getCurrentPhoneConfig();

  // IDs
  const orderId = useMemo(() => uuidv4(), [isOpen]);
  const saleNumber = useMemo(
    () => `SALE-${Date.now().toString().slice(-6)}`,
    [isOpen]
  );
  
  const cleanAccountRef = useMemo(
      () => Date.now().toString().slice(-6),
      [isOpen]
  );

  const paybillAccountNo = useMemo(() => {
    return cleanAccountRef;
  }, [cleanAccountRef]);
  
  const fullSaleNumber = saleNumber;

  useEffect(() => {
    setEditableDiscount(discount);
  }, [discount]);

  // --- Calculations ---

  const { totalPayable, priceBeforeTax, calculatedTax } = useMemo(() => {
    const total = Math.max(0, subtotal - editableDiscount);
    const rate = Number(taxRate) || 0;
    const taxableAmount = total / (1 + rate);
    const taxAmount = total - taxableAmount;
    return { totalPayable: total, priceBeforeTax: taxableAmount, calculatedTax: taxAmount };
  }, [subtotal, editableDiscount, taxRate]);

  const totalPaid = useMemo(() => {
    return currentPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [currentPayments]);

  const remainingBalance = useMemo(() => {
    return Math.max(0, totalPayable - totalPaid);
  }, [totalPayable, totalPaid]);

  const changeDue = useMemo(() => {
    return Math.max(0, totalPaid - totalPayable);
  }, [totalPayable, totalPaid]);

  // Set default amount input to remaining balance when tab changes or remaining updates
  useEffect(() => {
    if (remainingBalance > 0 && selectedTab !== 'GIFT_CARD') {
        setAmountInput(remainingBalance.toFixed(2));
    } else if (remainingBalance === 0) {
        setAmountInput('');
    }
  }, [remainingBalance, selectedTab, isOpen]);

  // Reset state on open
  useEffect(() => {
      if (isOpen) {
          setCurrentPayments([]);
          setMpesaStatus('IDLE');
          setDetectedPayment(null);
          setGiftCardCode('');
          setValidationErrors([]);
          setNotes('');
      }
  }, [isOpen]);

  const mpesaQrData = useMemo(() => {
      const ref = paybillAccountNo;
      return generateMpesaQrCodeData(organizationName, paybillNumber, tillNumber, ref, remainingBalance);
  }, [mpesaMode, organizationName, paybillNumber, tillNumber, paybillAccountNo, remainingBalance]);


  // --- LISTENERS ---
  
  // Effect to communicate M-Pesa details to Customer Display
  useEffect(() => {
    if (isOpen && selectedTab === 'MOBILE_PAYMENT' && (mpesaMode === 'QR' || mpesaMode === 'PAYBILL')) {
      emit('payment-update', {
        type: 'MPESA_QR',
        amount: remainingBalance,
        qrData: mpesaQrData,
        paybill: paybillNumber,
        tillNo: tillNumber,
        accountRef: paybillAccountNo,
        mode: mpesaMode,
      });
    } else if (isOpen && selectedTab === 'MOBILE_PAYMENT' && mpesaMode === 'STK') {
         emit('payment-update', {
            type: 'MPESA_STK',
            amount: remainingBalance,
            phoneNumber: mpesaPhone
         });
    } else if (isOpen) {
        // Generic Update
       emit('payment-update', {
          type: 'GENERIC_TOTAL',
          amount: remainingBalance,
          totalPaid: totalPaid,
          change: changeDue
       });
    }
  }, [isOpen, selectedTab, mpesaMode, mpesaQrData, remainingBalance, paybillNumber, tillNumber, paybillAccountNo, totalPaid, changeDue, mpesaPhone]);

  const paymentChannel = useAblyStore((state) => state.paymentChannel);
  const ably = useAblyStore((state) => state.client);
  
  useEffect(() => {
      if (!isOpen || selectedTab !== 'MOBILE_PAYMENT' || !ably || !paymentChannel) return;
      
      const channel = ably.channels.get(paymentChannel);

      const handleUnclaimed = (message: any) => {
          const data = message.data;
          if ((mpesaMode === 'PAYBILL' || mpesaMode === 'QR') && data.accountRef) {
            if (data.accountRef.toUpperCase() === paybillAccountNo.toUpperCase()) {
                handlePaymentMatch(data);
            }
          }
          if (mpesaMode === 'BUY_GOODS') {
              if (Math.abs(Number(data.amount) - remainingBalance) < 1.0) {
                  handlePaymentMatch(data);
              }
          }
      };

      const handleUpdate = (msg: any) => {
          const txData = msg.data;
          if (txData.transactionId === fullSaleNumber || txData.data?.accountRef === paybillAccountNo) {
             const isSuccess = txData.status === 'COMPLETED' || txData.status === 'SUCCESS';
             if (isSuccess) {
                 handlePaymentMatch(txData.data || txData);
             } else if (txData.status === 'FAILED' || txData.status === 'CANCELLED') {
                 setMpesaStatus('FAILED');
                 setMpesaWaiting(false);
                 setValidationErrors(['Payment Failed or Cancelled. Please retry.']);
             }
          }
      };

      channel.subscribe('payment-unclaimed', handleUnclaimed);
      channel.subscribe('payment-update', handleUpdate);

      return () => {
          channel.unsubscribe();
      };
  }, [isOpen, selectedTab, mpesaMode, ably, paymentChannel, fullSaleNumber, paybillAccountNo, remainingBalance]);

  // --- HANDLERS ---

  const handlePaymentMatch = (data: any) => {
      setDetectedPayment(data);
      setMpesaStatus('SUCCESS');
      setMpesaWaiting(false);
      
      // Auto-add M-Pesa Payment
      setTimeout(() => {
          addPayment({
              method: PaymentMethod.MPESA,
              amount: data.amount,
              reference: data.receipt,
              meta: {
                  mpesaType: mpesaMode === 'STK' ? MpesaFlowType.STK_PUSH : MpesaFlowType.PAYBILL_MANUAL,
                  mpesaPhoneNumber: data.phone || mpesaPhone,
                  ...data
              }
          });
          // Reset for next potential payment if still split
          setDetectedPayment(null);
          setMpesaStatus('IDLE');
      }, 1500);
  };

  const addPayment = (payment: Omit<AddedPayment, 'id'>) => {
      const newPayment = { ...payment, id: uuidv4() };
      setCurrentPayments(prev => [...prev, newPayment]);
      setAmountInput(''); // Reset input
  };

  const removePayment = (id: string) => {
      setCurrentPayments(prev => prev.filter(p => p.id !== id));
  };

  const handleAddCash = () => {
      const amount = parseFloat(amountInput);
      if (!amount || amount <= 0) return;
      addPayment({
          method: PaymentMethod.CASH,
          amount: amount
      });
  };

  const handleAddCard = () => {
      const amount = parseFloat(amountInput);
      if (!amount || amount <= 0) return;
      addPayment({
          method: PaymentMethod.CREDIT,
          amount: amount,
          reference: 'Terminal'
      })
  };

  const handleGiftCardScan = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!giftCardCode) return;
      
      const card = await validateGiftCard(giftCardCode);
      if (card) {
          const amountToDeduct = Math.min(card.balance, remainingBalance);
          addPayment({
              method: PaymentMethod.GIFT_CARD,
              amount: amountToDeduct,
              reference: card.code,
              meta: {
                  giftCardId: card.code, // In real app, use ID
                  balanceBefore: card.balance,
                  balanceAfter: card.balance - amountToDeduct
              }
          });
          setGiftCardCode('');
          toast.success(`Redeemed ${formatCurrency(amountToDeduct)} from Gift Card`);
      }
  };

  const handleMpesaStkTrigger = async () => {
      const amount = parseFloat(amountInput);
      if (!amount || amount <= 0) return;

      // Prepare payload specifically for STK trigger (creates pending sale in rust)
      const payload: ProcessSaleInput = {
        cartItems: [], // Not needed for trigger usually, but validation might require. Can pass current cart.
        ...getCommonPayloadFields(),
        // Override for STK Trigger
        paymentMethod: PaymentMethod.MPESA,
        paymentStatus: PaymentStatus.PENDING,
        amountReceived: amount,
        change: 0,
        mpesaType: MpesaFlowType.STK_PUSH,
        mpesaPhoneNumber: normalizePhoneNumber(mpesaPhone, PHONE_CONFIG),
      };

      try {
          // Send STK Request
          await createSale(payload);
          setMpesaStatus('WAITING');
          setMpesaWaiting(true);
      } catch (e) {
          console.error(e);
          setValidationErrors(['Failed to trigger STK Push']);
      }
  };


  const getCommonPayloadFields = (): any => ({
      cartItems: cartItems.map((item) => ({
        productId: item.productId || '',
        productName: item.productName || 'Unknown Product',
        variantId: item.variantId || '',
        variantName: item.variantName || '',
        quantity: item.quantity,
        sellingUnitId: item.selectedUnit?.unitId || '',
        sellingUnitName: item.selectedUnit?.unitName || '',
        unitPrice: item.price,
      })),
      locationId: locationId,
      saleNumber: fullSaleNumber,
      accountRef: paybillAccountNo,
      isWholesale: false,
      customerId: (customer?.id && customer.id !== 'temp-id') ? customer.id : null,
      enableStockTracking: true,
      notes: notes,
      discountAmount: editableDiscount,
  });

  const handleCompleteSale = async () => {
      // Determine primary method or split
      let primaryMethod = PaymentMethod.SPLIT;
      if (currentPayments.length === 1) {
          primaryMethod = currentPayments[0].method;
      } else if (currentPayments.length === 0 && totalPayable === 0) {
          primaryMethod = PaymentMethod.CASH; // Free order
      }

      const payload: any = {
          ...getCommonPayloadFields(),
          paymentMethod: primaryMethod,
          paymentStatus: PaymentStatus.COMPLETED,
          amountReceived: totalPaid,
          change: changeDue,
          payments: currentPayments.map(p => ({
              method: p.method,
              amount: p.amount,
              reference: p.reference,
              meta: p.meta
          }))
      };

      // Validation
      const result = ProcessSaleInputSchema.safeParse(payload);
      if (!result.success) {
          setValidationErrors(result.error.errors.map((e) => e.message));
          return;
      }

      try {
          const queuedSale: any = await createSale(result.data);
          
          const completedOrder: Order = {
            id: queuedSale?.id || orderId,
            orderNumber: queuedSale?.orderNumber || `ORD-${Date.now().toString().slice(-6)}`,
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
            status: 'completed',
            paymentMethod: primaryMethod,
            saleNumber: fullSaleNumber,
            amountPaid: totalPaid,
            change: changeDue,
        };

        if (currentPayments.some(p => p.method === PaymentMethod.CASH) && autoPrintConfig.openCashDrawer) {
            openPhysicalDrawer();
        }

        emit('payment-update', { type: 'CLEAR_COMPLETED' }); 
        onPaymentComplete(completedOrder);
        onClose();

      } catch (e) {
          console.error("Completion Error", e);
          setValidationErrors(['Error completing sale. Data may be invalid.']);
      }
  };

//   const handleCopy = async (text: string) => {
//     await writeText(text);
//     if ((await isPermissionGranted()) || (await requestPermission()) === 'granted') {
//       sendNotification({ title: 'Copied!', body: `${text} copied to clipboard.` });
//     }
//   };

  // --- SUB-COMPONENTS ---
  const MpesaStkStatus = ({ status, phone }: { status: 'IDLE' | 'WAITING' | 'SUCCESS' | 'FAILED', phone: string }) => {
    switch (status) {
        case 'WAITING':
            return (
                <div className="flex items-center gap-3 text-sm text-amber-600 bg-amber-50 p-3 rounded-md dark:bg-amber-950 dark:text-amber-400 animate-pulse">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Waiting for PIN on {phone}...
                </div>
            );
        case 'SUCCESS':
            return (
                <div className="flex items-center gap-3 text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 animate-in fade-in">
                    <Check className="h-5 w-5" />
                    <p className="font-bold">STK Payment Confirmed!</p>
                </div>
            );
        case 'FAILED':
            return (
                <div className="flex items-center gap-3 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800 animate-in fade-in">
                    <AlertCircle className="h-5 w-5" />
                    <p className="font-bold">STK Payment Failed or Cancelled.</p>
                </div>
            );
        case 'IDLE':
        default:
            return <p className="text-xs text-muted-foreground">Prompts client to enter PIN automatically.</p>;
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open && (isProcessing || mpesaWaiting)) return; // Prevent closing while processing
        onClose();
    }}>
      <AnimatePresence>
        {isOpen && (
          <DialogContent
            className="sm:max-w-[1000px] max-h-[95vh] overflow-y-auto"
          >
             {/* OVERLAY FOR STK WAITING (Blocking) */}
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
                            <p className="text-xs text-muted-foreground mt-2">Waiting for confirmation...</p>
                        </div>
                        <Button variant="outline" onClick={() => setMpesaWaiting(false)}>Cancel Waiting</Button>
                    </motion.div>
                </div>
             )}

            <DialogHeader className="p-6 pb-2 border-b">
                <DialogTitle className="flex items-center justify-between">
                   <div className="flex items-center gap-2">
                        <span>Checkout</span>
                        {customer && <CustomerBadge customer={customer} />}
                   </div>
                   <div className="text-2xl font-bold text-primary">
                       {formatCurrency(totalPayable)}
                   </div>
                </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-12 h-[600px]">
                {/* LEFT: PAYMENT SELECTOR (7 Cols) */}
                <div className="col-span-7 border-r p-6 flex flex-col gap-6 overflow-y-auto">
                    
                    {/* Discount Control */}
                    <div className="flex justify-between items-center bg-muted/30 p-3 rounded-lg border">
                        <span className="text-sm font-medium">Discount</span>
                        <div className="flex items-center gap-2">
                            <span className="text-red-500 font-bold">-</span>
                            <Input 
                                type="number" 
                                className="h-8 w-24 text-right bg-background" 
                                value={editableDiscount}
                                onChange={(e) => setEditableDiscount(Math.min(parseFloat(e.target.value) || 0, subtotal))}
                            />
                        </div>
                    </div>

                    <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full flex-1 flex flex-col">
                        <TabsList className="grid w-full grid-cols-4 mb-4">
                            <TabsTrigger value="CASH"><DollarSign className="w-4 h-4 mr-2"/>Cash</TabsTrigger>
                            <TabsTrigger value="MOBILE_PAYMENT"><Smartphone className="w-4 h-4 mr-2"/>M-Pesa</TabsTrigger>
                            <TabsTrigger value="CREDIT_CARD"><CreditCard className="w-4 h-4 mr-2"/>Card</TabsTrigger>
                            <TabsTrigger value="GIFT_CARD"><Gift className="w-4 h-4 mr-2"/>Gift</TabsTrigger>
                        </TabsList>

                        {/* CASH TAB */}
                        <TabsContent value="CASH" className="space-y-4 flex-1">
                            <div className="space-y-4 bg-muted/10 p-4 rounded-lg border">
                                <Label>Amount Tendered</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        value={amountInput} 
                                        onChange={(e) => setAmountInput(e.target.value)}
                                        className="text-lg font-bold"
                                        placeholder={remainingBalance.toFixed(2)}
                                        autoFocus
                                    />
                                    <Button size="lg" onClick={handleAddCash} disabled={!amountInput || parseFloat(amountInput) <= 0}>
                                        <Plus className="w-4 h-4 mr-2" /> Add Cash
                                    </Button>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {[100, 200, 500, 1000].map(val => (
                                        <Button key={val} variant="outline" size="sm" onClick={() => setAmountInput(val.toString())}>
                                            {val}
                                        </Button>
                                    ))}
                                    <Button variant="outline" size="sm" onClick={() => setAmountInput(remainingBalance.toFixed(2))}>Full</Button>
                                </div>
                            </div>
                        </TabsContent>

                        {/* M-PESA TAB */}
                        <TabsContent value="MOBILE_PAYMENT" className="space-y-4 flex-1">
                            {/* Mode Selector */}
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
                                              "flex-1 text-xs font-medium py-1.5 rounded-md transition-all",
                                              mpesaMode === mode ? "bg-background shadow-sm text-primary dark:bg-zinc-800" : "text-muted-foreground hover:text-primary"
                                          )}
                                      >
                                          {mode.replace('_', ' ')}
                                      </button>
                                 ))}
                           </div>

                             {/* AMOUNT INPUT for Manual/STK */}
                            <div className="space-y-2">
                                <Label>Payment Amount</Label>
                                <Input 
                                    value={amountInput} 
                                    onChange={(e) => setAmountInput(e.target.value)}
                                    placeholder={remainingBalance.toFixed(2)}
                                />
                            </div>

                           {mpesaMode === 'STK' && (
                               <div className="space-y-4">
                                   <div>
                                       <Label>Phone Number</Label>
                                       <Input value={mpesaPhone} onChange={(e) => setMpesaPhone(e.target.value)} placeholder="0712345678" />
                                   </div>
                                   <Button className="w-full" onClick={handleMpesaStkTrigger} disabled={mpesaStatus === 'WAITING'}>
                                       {mpesaStatus === 'WAITING' ? <Loader2 className="animate-spin w-4 h-4 mr-2"/> : <Smartphone className="w-4 h-4 mr-2"/>}
                                       Send STK Push
                                   </Button>
                                   <MpesaStkStatus status={mpesaStatus} phone={mpesaPhone} />
                               </div>
                           )}

                           {(mpesaMode === 'QR' || mpesaMode === 'PAYBILL') && (
                               <div className="flex flex-col items-center p-4 bg-muted/20 rounded border">
                                    {mpesaMode === 'QR' && (
                                        <div className="bg-white p-2 rounded mb-4">
                                            <QRCodeSVG value={mpesaQrData} size={120} />
                                        </div>
                                    )}
                                    <div className="text-center space-y-1">
                                        <p className="text-xs uppercase text-muted-foreground">Paybill</p>
                                        <p className="font-mono font-bold text-lg">{paybillNumber}</p>
                                        <p className="text-xs uppercase text-muted-foreground mt-2">Account</p>
                                        <p className="font-mono font-bold text-lg text-primary">{paybillAccountNo}</p>
                                    </div>
                                    {!detectedPayment && <p className="text-xs text-muted-foreground animate-pulse mt-4">Waiting for payment...</p>}
                               </div>
                           )}
                        </TabsContent>

                        {/* CARD TAB */}
                        <TabsContent value="CREDIT_CARD" className="space-y-4 flex-1">
                            <div className="space-y-4 bg-muted/10 p-4 rounded-lg border">
                                <Label>Swipe Amount</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        value={amountInput} 
                                        onChange={(e) => setAmountInput(e.target.value)}
                                        className="text-lg font-bold"
                                        placeholder={remainingBalance.toFixed(2)}
                                    />
                                    <Button size="lg" onClick={handleAddCard} disabled={!amountInput}>
                                        <Plus className="w-4 h-4 mr-2" /> Add Card
                                    </Button>
                                </div>
                                <Alert>
                                    <CreditCard className="h-4 w-4"/>
                                    <AlertDescription>Process on external terminal. Record here.</AlertDescription>
                                </Alert>
                            </div>
                        </TabsContent>

                        {/* GIFT CARD TAB */}
                        <TabsContent value="GIFT_CARD" className="space-y-4 flex-1">
                             <div className="space-y-4 bg-muted/10 p-4 rounded-lg border">
                                <form onSubmit={handleGiftCardScan} className="space-y-4">
                                    <Label>Scan Gift Card</Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            value={giftCardCode}
                                            onChange={(e) => setGiftCardCode(e.target.value)}
                                            placeholder="Scan barcode or type code..."
                                            autoFocus
                                            className="font-mono uppercase"
                                        />
                                        <Button type="submit" disabled={!giftCardCode || isValidatingGC}>
                                            {isValidatingGC ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Redeem'}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">System will automatically deduct available balance.</p>
                                </form>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* RIGHT: SUMMARY (5 Cols) */}
                <div className="col-span-5 flex flex-col bg-muted/5 p-6 h-full">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <ReceiptText className="w-4 h-4" /> Payment Summary
                    </h3>

                    {/* Payment List */}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {currentPayments.length === 0 ? (
                            <div className="text-center text-muted-foreground py-10 border-2 border-dashed rounded-lg">
                                No payments added yet
                            </div>
                        ) : (
                            currentPayments.map((p) => (
                                <div key={p.id} className="flex justify-between items-center p-3 bg-background border rounded-lg shadow-sm animate-in fade-in slide-in-from-right-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            {p.method === PaymentMethod.CASH && <DollarSign className="w-4 h-4" />}
                                            {p.method === PaymentMethod.MPESA && <Smartphone className="w-4 h-4" />}
                                            {p.method === PaymentMethod.CREDIT && <CreditCard className="w-4 h-4" />}
                                            {p.method === PaymentMethod.GIFT_CARD && <Gift className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{p.method.replace('_', ' ')}</p>
                                            {p.reference && <p className="text-xs text-muted-foreground">{p.reference}</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold">{formatCurrency(p.amount)}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-100" onClick={() => removePayment(p.id)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Totals Footer */}
                    <div className="mt-6 space-y-3 pt-6 border-t">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Due</span>
                            <span className="font-bold">{formatCurrency(totalPayable)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Total Paid</span>
                            <span className="font-bold text-green-600">{formatCurrency(totalPaid)}</span>
                        </div>
                        {changeDue > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Change Due</span>
                                <span className="font-bold text-red-500">{formatCurrency(changeDue)}</span>
                            </div>
                        )}
                         {remainingBalance > 0 && (
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Remaining</span>
                                <span className="font-bold text-primary text-lg">{formatCurrency(remainingBalance)}</span>
                            </div>
                        )}
                        
                        {/* Added Notes Input */}
                         <div className="pt-2">
                             <Input 
                                placeholder="Sale Notes..." 
                                value={notes} 
                                onChange={(e) => setNotes(e.target.value)} 
                                className="h-8 text-sm"
                             />
                         </div>

                        <div className="pt-2" />
                        
                        {validationErrors.length > 0 && (
                            <Alert variant="destructive" className="py-2">
                                <AlertDescription>{validationErrors[0]}</AlertDescription>
                            </Alert>
                        )}

                        <Button 
                            size="lg" 
                            className="w-full text-lg h-12" 
                            disabled={remainingBalance > 0.01} // Float tolerance
                            onClick={handleCompleteSale}
                        >
                            {changeDue > 0 ? `Complete (Change: ${formatCurrency(changeDue)})` : 'Complete Sale'}
                        </Button>
                    </div>
                </div>
            </div>
            
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  );
};

export default PaymentModal;