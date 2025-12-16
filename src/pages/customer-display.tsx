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
  Wifi,
  DollarSign,
  Smartphone,
  Star,
  Gift,
  ArrowRight,
  Info,
  MapPin
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
  type: 'MPESA_QR' | 'CARD_PAYMENT' | 'CASH_PAYMENT' | 'MPESA_STK' | 'CLEAR' | 'CLEAR_COMPLETED';
  amount?: number;
  qrData?: string;
  paybill?: string;
  tillNo?: string;
  accountRef?: string;
  mode?: 'QR' | 'PAYBILL';
  cashReceived?: number;
  change?: number;
  phoneNumber?: string;
}

// --- Configuration & Content ---
const STORE_INFO = {
  name: "Dealio Enterprise",
  id: "POS-042",
  location: "Nairobi West Branch",
  status: "Open • Closes 9:00 PM"
};

const NEWS_TICKER = [
  "Welcome to Dealio. Join our loyalty program today!",
  "Buy 2 Get 1 Free on all fresh juices.",
  // "We now accept American Express.",
  "Holiday hours: 8 AM - 10 PM starting Dec 20th."
];

const PROMO_SLIDES = [
  {
    id: 'loyalty',
    template: 'stat-card',
    title: "Dealio Gold",
    subtitle: "Loyalty Program",
    desc: "Earn 2x points on every purchase today.",
    highlight: "5% Cash Back",
    icon: <Gift className="h-full w-full" />,
    color: "from-amber-400 to-orange-500",
    textColor: "text-amber-950"
  },
  {
    id: 'app-download',
    template: 'qr-split',
    title: "Skip the Line",
    subtitle: "Download our App",
    desc: "Order ahead and pick up in-store. Scan to install.",
    payload: "https://dealio.app/download",
    color: "from-blue-600 to-indigo-700",
    textColor: "text-white"
  },
  {
    id: 'feedback',
    template: 'hero',
    title: "We Value You",
    subtitle: "Customer Feedback",
    desc: "How was your experience? Rate us on Google Maps.",
    icon: <Star className="h-full w-full" />,
    color: "from-emerald-600 to-teal-700",
    textColor: "text-white"
  }
];

// --- Sub-Components ---

const Marquee = ({ items }: { items: string[] }) => (
  <div className="overflow-hidden whitespace-nowrap flex bg-slate-900/50 backdrop-blur-md border-t border-white/10 py-3">
    <motion.div 
      className="flex gap-12 text-slate-300 font-medium text-sm md:text-base uppercase tracking-wider"
      animate={{ x: ["0%", "-50%"] }}
      transition={{ repeat: Infinity, ease: "linear", duration: 20 }}
    >
      {[...items, ...items, ...items].map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          <Info size={14} className="text-emerald-400" /> {item}
        </span>
      ))}
    </motion.div>
  </div>
);

const PromoSlide = ({ slide, isFullScreen = false }: { slide: any, isFullScreen?: boolean }) => {
  // Enterprise "Card" look
  const containerClasses = isFullScreen 
    ? "h-full w-full flex flex-col justify-center items-center p-12 max-w-5xl mx-auto" 
    : `relative z-10 p-6 flex flex-col items-center text-center h-full justify-center`;

  // Render based on template type
  if (slide.template === 'qr-split') {
    return (
      <div className={`${containerClasses} ${isFullScreen ? 'flex-row gap-16 text-left' : ''}`}>
        <div className={`bg-white p-3 rounded-2xl shadow-xl ${isFullScreen ? 'scale-125' : 'mb-6'}`}>
          <QRCodeCanvas value={slide.payload || ""} size={isFullScreen ? 250 : 140} level="H" />
        </div>
        <div className={isFullScreen ? 'flex-1' : ''}>
           <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3 bg-white/20 backdrop-blur-sm border border-white/20 ${slide.textColor}`}>
             {slide.subtitle}
           </div>
           <h2 className={`${isFullScreen ? 'text-6xl mb-6' : 'text-3xl mb-2'} font-black tracking-tight ${slide.textColor}`}>
            {slide.title}
          </h2>
          <p className={`${isFullScreen ? 'text-2xl opacity-90' : 'text-sm opacity-80'} max-w-md mx-auto ${slide.textColor}`}>
            {slide.desc}
          </p>
        </div>
      </div>
    );
  }

  if (slide.template === 'stat-card') {
    return (
       <div className={containerClasses}>
         <div className={`relative ${isFullScreen ? 'mb-12' : 'mb-6'}`}>
            <div className={`absolute inset-0 bg-white/30 blur-3xl rounded-full ${isFullScreen ? 'scale-150' : 'scale-110'}`}></div>
            <div className={`${isFullScreen ? 'h-32 w-32' : 'h-16 w-16'} ${slide.textColor} relative z-10`}>
              {slide.icon}
            </div>
         </div>
         <h2 className={`${isFullScreen ? 'text-7xl' : 'text-3xl'} font-black mb-2 ${slide.textColor}`}>{slide.highlight}</h2>
         <p className={`${isFullScreen ? 'text-3xl' : 'text-lg'} font-medium opacity-90 mb-6 ${slide.textColor}`}>{slide.title}</p>
         <div className="h-1 w-24 bg-current opacity-20 rounded-full"></div>
         <p className="mt-6 text-sm opacity-70 uppercase tracking-widest font-semibold">{slide.desc}</p>
       </div>
    );
  }

  // Default / Hero
  return (
    <div className={containerClasses}>
      <div className={`mb-6 ${isFullScreen ? 'scale-125' : ''}`}>
        <div className={`inline-flex items-center justify-center rounded-full bg-white/10 backdrop-blur-md border border-white/20 ${isFullScreen ? 'p-8' : 'p-4'} text-white`}>
          {slide.icon || <Store className={isFullScreen ? 'h-24 w-24' : 'h-12 w-12'} />}
        </div>
      </div>
      <h2 className={`${isFullScreen ? 'text-6xl mb-4' : 'text-3xl mb-2'} font-bold tracking-tight ${slide.textColor}`}>
        {slide.title}
      </h2>
      <p className={`${isFullScreen ? 'text-2xl text-slate-100' : 'text-slate-200 text-lg'} max-w-lg mx-auto leading-relaxed`}>
        {slide.desc}
      </p>
      {isFullScreen && (
        <div className="mt-10 flex items-center gap-2 text-white/60 text-sm font-mono border border-white/20 px-4 py-2 rounded-lg bg-black/20">
          <Info size={16} /> Terms and conditions apply. See store for details.
        </div>
      )}
    </div>
  );
};

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

  const formatCurrency = useFormattedCurrency ? useFormattedCurrency() : (val: number) => `KSH ${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000); // 1s for accurate seconds
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [cart]);

  const currentSlide = PROMO_SLIDES[promoIndex];
  const isPaymentActive = paymentDetails.type !== 'CLEAR' && paymentDetails.type !== 'CLEAR_COMPLETED';
  const isIdle = cart.length === 0 && !isPaymentActive;

  return (
    <div className="h-[100dvh] w-screen bg-slate-50 text-slate-900 font-sans overflow-hidden select-none">
      
      {/* ================= PAYMENT OVERLAY ================= */}
      {/* (Kept identically functional, just slight style tweak for consistency) */}
      <AnimatePresence>
        {(isPaymentActive || showCompletionMessage) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-6"
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
            ) : paymentDetails.type === 'CASH_PAYMENT' ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full"
              >
                <div className="bg-emerald-600 p-6 text-white text-center">
                  <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                    <DollarSign className="h-6 w-6" /> Cash Payment
                  </h2>
                </div>
                <div className="p-8 space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-slate-500 mb-1">Total Amount</p>
                    <p className="text-5xl font-extrabold text-slate-900 tabular-nums">
                      {formatCurrency(paymentDetails.amount || 0)}
                    </p>
                  </div>

                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center text-lg">
                        <span className="text-slate-500 font-medium">Cash Given</span>
                        <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(paymentDetails.cashReceived || 0)}</span>
                      </div>
                      <div className="h-px bg-slate-200 my-2"></div>
                      <div className="flex justify-between items-center text-2xl">
                        <span className="text-emerald-600 font-bold">Change</span>
                        <span className="font-black text-emerald-600 tabular-nums">{formatCurrency(paymentDetails.change || 0)}</span>
                      </div>
                  </div>
                </div>
              </motion.div>
            ) : paymentDetails.type === 'MPESA_STK' ? (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full"
              >
                <div className="bg-green-600 p-6 text-white text-center">
                  <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
                    <Smartphone className="h-6 w-6" /> M-Pesa Request
                  </h2>
                </div>
                <div className="p-10 text-center space-y-6">
                  <div className="relative h-24 w-full flex items-center justify-center mb-4">
                      <div className="absolute inset-0 animate-ping rounded-full bg-green-100 opacity-75 mx-auto w-24 h-24"></div>
                      <Smartphone className="relative z-10 h-16 w-16 text-green-600" />
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Check your phone</h3>
                    <p className="text-slate-500 text-lg">
                      We've sent a payment request to:
                    </p>
                    <p className="text-2xl font-mono font-bold text-slate-800 mt-2 tracking-wider">
                      {paymentDetails.phoneNumber}
                    </p>
                  </div>

                  <div className="bg-green-50 text-green-800 p-4 rounded-xl text-sm font-medium">
                      Please enter your M-Pesa PIN to complete the payment of <strong>{formatCurrency(paymentDetails.amount || 0)}</strong>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= CONTENT SWITCHER ================= */}
      <AnimatePresence mode="wait">
        {isIdle ? (
          // --- IDLE / SCREENSAVER MODE ---
          <motion.div
            key="idle-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 flex flex-col bg-slate-900 text-white overflow-hidden"
          >
             {/* Dynamic Background */}
             <motion.div 
               key={`bg-${promoIndex}`}
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               transition={{ duration: 1 }}
               className={`absolute inset-0 bg-gradient-to-br ${currentSlide.color} opacity-20`}
             />
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/5 to-transparent opacity-50 blur-3xl"></div>
             
             {/* Enterprise Header */}
             <div className="relative z-20 flex justify-between items-start p-8 md:p-12">
                <div className="space-y-1">
                   <div className="flex items-center gap-3">
                      <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm border border-white/10">
                        <Store className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h1 className="font-bold text-2xl tracking-tight leading-none">{STORE_INFO.name}</h1>
                        <p className="text-white/60 text-sm font-medium flex items-center gap-2 mt-1">
                          <MapPin size={12}/> {STORE_INFO.location}
                        </p>
                      </div>
                   </div>
                </div>
                
                <div className="text-right space-y-1">
                   <div className="text-5xl font-mono font-light tracking-tighter">
                      {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </div>
                   <div className="text-white/60 font-medium text-sm bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 inline-block">
                      {STORE_INFO.status}
                   </div>
                </div>
             </div>

             {/* Main Stage */}
             <div className="flex-1 relative z-10 flex items-center justify-center">
               <AnimatePresence mode="wait">
                 <motion.div
                   key={`idle-slide-${promoIndex}`}
                   initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
                   animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                   exit={{ opacity: 0, y: -40, filter: "blur(10px)" }}
                   transition={{ duration: 0.6, ease: "circOut" }}
                   className="w-full h-full"
                 >
                   <PromoSlide slide={currentSlide} isFullScreen={true} />
                 </motion.div>
               </AnimatePresence>
             </div>

             {/* Footer & Ticker */}
             <div className="relative z-20 mt-auto">
                <div className="flex justify-center gap-3 mb-8">
                  {PROMO_SLIDES.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={`h-1.5 rounded-full transition-all duration-500 ${idx === promoIndex ? 'w-12 bg-white shadow-[0_0_10px_white]' : 'w-2 bg-white/20'}`} 
                    />
                  ))}
                </div>
                <Marquee items={NEWS_TICKER} />
             </div>
          </motion.div>
        ) : (
          // --- ACTIVE CART MODE ---
          <motion.div
            key="active-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full w-full lg:grid lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_500px]"
          >
            {/* LEFT COLUMN: CART LIST */}
            <div className="flex flex-col h-full bg-white relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] w-full">
              <header className="h-20 px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-900/20">
                    <Store className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold uppercase tracking-widest text-slate-900">{STORE_INFO.name}</h1>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md w-fit">
                      <span className="flex items-center gap-1 text-emerald-600"><Wifi size={10}/> Online</span>
                      <span className="text-slate-300">|</span>
                      <span>{STORE_INFO.id}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="block font-mono text-xl font-bold text-slate-700 leading-none">
                    {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mt-1">
                    {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </header>

              <main ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
                 {/* Empty State */}
                 {cart.length === 0 && (
                   <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                     <div className="p-6 bg-slate-50 rounded-full mb-2">
                        <ShoppingBag className="h-12 w-12 text-slate-300" />
                     </div>
                     <p className="text-slate-400 font-medium">Ready for next customer</p>
                   </div>
                 )}
                 
                 <div className="divide-y divide-slate-50">
                  <AnimatePresence initial={false}>
                    {cart.map((item, index) => (
                      <motion.div
                        key={item.id || index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-5 p-5 hover:bg-slate-50/80 transition-colors"
                      >
                        <div className="shrink-0 w-12 h-12 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 flex items-center justify-center shadow-sm">
                          <span className="font-mono font-bold text-lg">{item.qty}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-800 text-lg truncate leading-tight">{item.name}</h3>
                          <p className="text-sm text-slate-500 font-medium mt-0.5">
                            {item.variant && <span className="bg-slate-100 px-1.5 py-0.5 rounded text-xs mr-2 text-slate-600 border border-slate-200">{item.variant}</span>}
                            @{formatCurrency(item.price)}
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
              </main>
            </div>

            {/* RIGHT COLUMN: SIDEBAR */}
            <aside className="hidden lg:flex flex-col bg-slate-900 text-white shrink-0 shadow-2xl z-20 overflow-hidden relative">
              {/* Promo Background Gradient - tied to active slide */}
              <motion.div 
                 className={`absolute inset-0 bg-gradient-to-br opacity-20 transition-colors duration-1000 ${currentSlide.color}`}
              />
              
              <div className="flex-1 relative overflow-hidden flex items-center justify-center">
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={promoIndex}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="absolute inset-0"
                    >
                        <PromoSlide slide={currentSlide} isFullScreen={false} />
                    </motion.div>
                  </AnimatePresence>
                  
                  {/* Indicators */}
                  <div className="absolute bottom-6 flex gap-2 z-20">
                    {PROMO_SLIDES.map((_, idx) => (
                      <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${idx === promoIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`} 
                      />
                    ))}
                  </div>
              </div>

              {/* Financial Footer */}
              <div className="bg-slate-950/80 backdrop-blur-md p-8 border-t border-white/5 relative z-20">
                <div className="space-y-4 mb-8 text-sm font-medium">
                  <div className="flex justify-between text-slate-400">
                    <span>Subtotal</span>
                    <span className="font-mono text-slate-200 tabular-nums text-base">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  
                  <AnimatePresence>
                    {totals.discount > 0 && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex justify-between text-amber-400 overflow-hidden"
                      >
                        <span className="flex items-center gap-2"><Percent size={14}/> Promotions</span>
                        <span className="font-mono tabular-nums">- {formatCurrency(totals.discount)}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  <div className="flex justify-between text-slate-400">
                    <span>VAT (16%)</span>
                    <span className="font-mono text-slate-200 tabular-nums text-base">{formatCurrency(totals.tax)}</span>
                  </div>
                </div>

                <div className="pt-6 border-t border-dashed border-slate-800">
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded">Total Amount Due</span>
                    <motion.span 
                      key={totals.finalTotal}
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      className="text-6xl xl:text-7xl font-black tracking-tighter tabular-nums font-mono leading-none text-white mt-2"
                    >
                      {formatCurrency(totals.finalTotal)}
                    </motion.span>
                  </div>
                </div>
              </div>
            </aside>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}