'use client';

import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { QRCodeCanvas } from 'qrcode.react';
import {
  ShoppingBag,
  Store,
  Receipt,
  Percent,
  ShieldCheck,
  MonitorSmartphone,
  QrCode,
  CreditCard,
  CheckCircle,
  Clock,
  Wifi
} from 'lucide-react';
import { useFormattedCurrency } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

// --- Types ---
interface CartItem {
  id?: string;
  name: string;
  variant?: string;
  qty: number;
  price: number;
}

interface CartPayload {
  items: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  finalTotal: number;
}

interface PaymentPayload {
  type: 'MPESA_QR' | 'CARD_PAYMENT' | 'CLEAR' | 'CLEAR_COMPLETED';
  amount?: number;
  qrData?: string;
  paybill?: string;
  tillNo?: string;
  accountRef?: string;
  mode?: 'QR' | 'PAYBILL';
}

// --- Configuration ---
const PROMO_SLIDES = [
  {
    type: 'qr',
    title: "Join & Save 5%",
    desc: "Scan to register instantly",
    payload: "https://example.com/register",
    bg: "bg-gradient-to-br from-indigo-600 to-blue-700"
  },
  {
    type: 'icon',
    title: "New Arrivals",
    desc: "Ask about our seasonal catalog",
    icon: <Store className="h-16 w-16 text-white/90" />,
    bg: "bg-gradient-to-br from-emerald-600 to-teal-700"
  },
  {
    type: 'icon',
    title: "Secure Payments",
    desc: "We accept all major cards",
    icon: <ShieldCheck className="h-16 w-16 text-white/90" />,
    bg: "bg-gradient-to-br from-slate-700 to-gray-800"
  }
];

export default function CustomerDisplay() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [totals, setTotals] = useState({
    subtotal: 0.00,
    tax: 0.00,
    discount: 0.00,
    finalTotal: 0.00
  });

  const [currentTime, setCurrentTime] = useState(new Date());
  const [promoIndex, setPromoIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentPayload>({ type: 'CLEAR' });
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);

  // Fallback formatter if hook is unavailable
  const formatCurrency = useFormattedCurrency ? useFormattedCurrency() : (val: number) => `KSH ${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    const promoTimer = setInterval(() => {
      setPromoIndex((prev) => (prev + 1) % PROMO_SLIDES.length);
    }, 8000);

    const unlistenCart = listen<CartPayload>('cart-update', (event) => {
      const { items, subtotal, tax, discount, finalTotal } = event.payload;
      setCart(items);
      setTotals({ subtotal, tax, discount, finalTotal });
    });

    const unlistenPayment = listen<PaymentPayload>('payment-update', (event) => {
      const payload = event.payload;
      if (payload.type === 'CLEAR_COMPLETED') {
        setPaymentDetails({ type: 'CLEAR' });
        setShowCompletionMessage(true);
        setTimeout(() => setShowCompletionMessage(false), 4000);
      } else {
        setPaymentDetails(payload);
      }
    });

    return () => {
      clearInterval(timer);
      clearInterval(promoTimer);
      unlistenCart.then(f => f());
      unlistenPayment.then(f => f());
    };
  }, []);

  // Auto-scroll to bottom when cart changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [cart]);

  const currentSlide = PROMO_SLIDES[promoIndex];
  const isPaymentActive = paymentDetails.type !== 'CLEAR' && paymentDetails.type !== 'CLEAR_COMPLETED';

  return (
    <div className="flex h-[100dvh] w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden select-none lg:grid lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_500px]">
      
      {/* ================= PAYMENT OVERLAY (Global Modal) ================= */}
      <AnimatePresence>
        {(isPaymentActive || showCompletionMessage) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6"
          >
            {showCompletionMessage ? (
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-2xl p-12 text-center max-w-sm w-full"
              >
                <div className="mx-auto h-24 w-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle className="h-12 w-12 text-emerald-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Payment Approved</h2>
                <p className="text-slate-500 mt-2">Thank you for your business.</p>
              </motion.div>
            ) : paymentDetails.type === 'MPESA_QR' && paymentDetails.qrData ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full"
              >
                <div className="bg-emerald-600 p-6 text-white text-center">
                  <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                    <QrCode className="h-6 w-6" /> Scan to Pay
                  </h2>
                </div>
                <div className="p-8 space-y-6">
                  <div className="flex justify-center">
                    <div className="p-4 border-2 border-slate-100 rounded-xl shadow-sm">
                      <QRCodeCanvas
                        value={paymentDetails.qrData}
                        size={220}
                        level="H"
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                    <div className="flex justify-between items-baseline border-b border-slate-200 pb-2">
                       <span className="text-xs uppercase font-semibold text-slate-500">Method</span>
                       <span className="font-bold text-slate-800">{paymentDetails.mode === 'PAYBILL' ? 'Paybill' : 'Buy Goods'}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-b border-slate-200 pb-2">
                       <span className="text-xs uppercase font-semibold text-slate-500">Business No.</span>
                       <span className="font-mono text-lg font-bold text-slate-900">{paymentDetails.mode === 'PAYBILL' ? paymentDetails.paybill : paymentDetails.tillNo}</span>
                    </div>
                    {paymentDetails.accountRef && (
                       <div className="flex justify-between items-baseline">
                         <span className="text-xs uppercase font-semibold text-slate-500">Account</span>
                         <span className="font-mono text-lg font-bold text-slate-900">{paymentDetails.accountRef}</span>
                       </div>
                    )}
                  </div>

                  <div className="text-center pt-2">
                    <p className="text-sm text-slate-500 mb-1">Total Amount</p>
                    <p className="text-4xl font-extrabold text-emerald-600 tabular-nums">
                      {formatCurrency(paymentDetails.amount || 0)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : paymentDetails.type === 'CARD_PAYMENT' ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full"
              >
                <div className="bg-blue-600 p-6 text-white text-center">
                  <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                    <CreditCard className="h-6 w-6" /> Card Payment
                  </h2>
                </div>
                <div className="p-10 text-center space-y-8">
                  <div className="relative h-32 w-full flex items-center justify-center">
                     <div className="absolute inset-0 animate-ping rounded-full bg-blue-100 opacity-75 mx-auto w-32 h-32"></div>
                     <CreditCard className="relative z-10 h-20 w-20 text-blue-600" />
                  </div>
                  <p className="text-xl font-medium text-slate-700">Please tap, insert, or swipe your card on the terminal.</p>
                  <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <span className="text-4xl font-black text-slate-900 tabular-nums">
                      {formatCurrency(paymentDetails.amount || 0)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= LEFT COLUMN: CART LIST ================= */}
      <div className="flex flex-col h-full bg-white relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        
        {/* Header */}
        <header className="h-16 md:h-20 px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-slate-900 rounded-lg flex items-center justify-center shadow-lg shadow-slate-900/20">
              <Store className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base md:text-lg font-bold uppercase tracking-widest text-slate-900">Dealio Enterprise</h1>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <span className="flex items-center gap-1"><Wifi size={10}/> Online</span>
                <span>•</span>
                <span>POS #042</span>
              </div>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <div className="flex items-center justify-end gap-2 text-slate-500">
               <Clock size={14} />
               <span className="font-mono text-sm md:text-base">{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-xs text-slate-400">{currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </div>
        </header>

        {/* Scrollable Cart */}
        <main ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth p-0 md:p-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-6 animate-in fade-in duration-700">
              <div className="relative">
                <div className="absolute inset-0 bg-slate-100 rounded-full scale-150 blur-xl opacity-50"></div>
                <ShoppingBag className="relative h-20 w-20 text-slate-300" strokeWidth={1} />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-xl font-semibold text-slate-700">Welcome</h2>
                <p className="text-slate-400">Ready for next customer</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              <AnimatePresence initial={false}>
                {cart.map((item, index) => (
                  <motion.div
                    key={item.id || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-4 p-4 md:p-6 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="shrink-0 w-12 h-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                      <span className="font-mono font-bold text-lg text-slate-600">{item.qty}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 text-lg truncate">{item.name}</h3>
                      <p className="text-sm text-slate-500 font-medium">
                        {item.variant ? <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs mr-2 text-slate-600">{item.variant}</span> : null}
                        @{formatCurrency(item.price)}/ea
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="block text-xl font-bold text-slate-900 tabular-nums tracking-tight">
                        {formatCurrency(item.price * item.qty)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>

      {/* ================= RIGHT COLUMN: SIDEBAR & TOTALS ================= */}
      <aside className="flex flex-col bg-slate-900 text-white shrink-0 shadow-2xl z-20 overflow-hidden">
        
        {/* Promo Carousel (Hidden on very small mobile, visible on tablet/desktop) */}
        <div className="hidden md:flex flex-1 relative overflow-hidden bg-slate-800 items-center justify-center">
           <AnimatePresence mode="wait">
              <motion.div 
                key={promoIndex}
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-8"
              >
                 <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]"></div>
                 
                 <div className={`relative z-10 p-6 rounded-2xl shadow-2xl mb-6 ${currentSlide.bg}`}>
                    {currentSlide.type === 'qr' ? (
                       <div className="bg-white p-2 rounded-lg">
                          <QRCodeCanvas value={currentSlide.payload || ""} size={140} />
                       </div>
                    ) : (
                       currentSlide.icon
                    )}
                 </div>
                 
                 <h2 className="relative z-10 text-2xl lg:text-3xl font-bold tracking-tight mb-2">{currentSlide.title}</h2>
                 <p className="relative z-10 text-slate-400 max-w-xs text-lg">{currentSlide.desc}</p>
              </motion.div>
           </AnimatePresence>
           
           {/* Carousel Indicators */}
           <div className="absolute bottom-6 flex gap-2 z-20">
             {PROMO_SLIDES.map((_, idx) => (
               <div 
                  key={idx} 
                  className={`h-1.5 rounded-full transition-all duration-300 ${idx === promoIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`} 
               />
             ))}
           </div>
        </div>

        {/* Financial Footer (Always Visible) */}
        <div className="bg-slate-950 p-6 lg:p-10 border-t border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
          <div className="space-y-3 mb-6 text-sm lg:text-base font-medium">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal</span>
              <span className="font-mono text-slate-200 tabular-nums">{formatCurrency(totals.subtotal)}</span>
            </div>
            
            <AnimatePresence>
              {totals.discount > 0 && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="flex justify-between text-emerald-400 overflow-hidden"
                >
                  <span className="flex items-center gap-1"><Percent size={14}/> Savings</span>
                  <span className="font-mono tabular-nums">- {formatCurrency(totals.discount)}</span>
                </motion.div>
              )}
            </AnimatePresence>
            
            <div className="flex justify-between text-slate-400">
              <span>Tax (16%)</span>
              <span className="font-mono text-slate-200 tabular-nums">{formatCurrency(totals.tax)}</span>
            </div>
          </div>

          <div className="pt-6 border-t border-dashed border-slate-800">
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs lg:text-sm font-semibold text-slate-500 uppercase tracking-widest">Total Due</span>
              <motion.span 
                key={totals.finalTotal}
                initial={{ scale: 0.95, color: '#94a3b8' }}
                animate={{ scale: 1, color: '#ffffff' }}
                className="text-5xl lg:text-7xl font-black tracking-tighter tabular-nums font-mono leading-none"
              >
                {formatCurrency(totals.finalTotal)}
              </motion.span>
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between text-slate-600 text-xs font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-2"><Receipt size={16}/> Receipt Ready</span>
            <span className="flex items-center gap-2"><MonitorSmartphone size={16}/> Terminal Active</span>
          </div>
        </div>
      </aside>
    </div>
  );
}