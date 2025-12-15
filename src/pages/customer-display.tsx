'use client';

import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import {QRCodeCanvas} from 'qrcode.react';
import { 
  ShoppingBag, 
  Store, 
  Receipt, 
  Percent, 
  ShieldCheck,
  MonitorSmartphone
} from 'lucide-react';
import { useFormattedCurrency } from '@/lib/utils';

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

// --- Configuration ---
const PROMO_SLIDES = [
  {
    type: 'qr',
    title: "Join & Save 5%",
    desc: "Scan for deals",
    payload: "https://example.com/register?store=042", 
    bg: "bg-indigo-600"
  },
  {
    type: 'icon',
    title: "New Arrivals",
    desc: "Ask for catalog",
    icon: <Store className="h-12 w-12 text-white" />,
    bg: "bg-emerald-600"
  },
  {
    type: 'icon',
    title: "Secure Pay",
    desc: "Cards accepted",
    icon: <ShieldCheck className="h-12 w-12 text-white" />,
    bg: "bg-slate-700"
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
console.log("Customer Display: ", cart);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [promoIndex, setPromoIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const formatMoney = useFormattedCurrency();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    const promoTimer = setInterval(() => {
      setPromoIndex((prev) => (prev + 1) % PROMO_SLIDES.length);
    }, 10000);

    const unlisten = listen<CartPayload>('cart-update', (event) => {
      console.log("Received cart update:", event.payload);
      const { items, subtotal, tax, discount, finalTotal } = event.payload;
      setCart(items);
      setTotals({ subtotal, tax, discount, finalTotal });
    });

    return () => {
      clearInterval(timer);
      clearInterval(promoTimer);
      unlisten.then(f => f());
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [cart]);

  const currentSlide = PROMO_SLIDES[promoIndex];

  return (
    // MAIN CONTAINER:
    // flex-col on mobile (stack vertically), lg:flex-row on desktop (side-by-side)
    <div className="flex flex-col lg:flex-row h-screen w-screen bg-zinc-50 text-zinc-900 font-sans overflow-hidden select-none">
      
      {/* ================= SECTION A: CART (Flex-1) ================= */}
      {/* Takes full width on mobile, flexible width on desktop */}
      <div className="flex-1 flex flex-col h-full relative z-10 shadow-sm lg:shadow-[4px_0_24px_rgba(0,0,0,0.05)]">
        
        {/* Header */}
        <header className="h-14 md:h-16 px-4 md:px-6 bg-white border-b border-zinc-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center">
              <Store size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold uppercase tracking-wider text-zinc-800 hidden md:block">Dealio Inc.</h1>
              <span className="text-xs text-zinc-400">POS #042 • {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
          </div>
          <div className="px-2 py-0.5 md:px-3 md:py-1 bg-zinc-100 rounded-full text-[10px] md:text-xs font-medium text-zinc-500 border border-zinc-200">
            Online
          </div>
        </header>

        {/* Scrollable List */}
        <main ref={scrollRef} className="flex-1 overflow-y-auto bg-zinc-50/50 scrollbar-hide">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-300 space-y-4 md:space-y-6">
              <div className="p-6 md:p-8 bg-white rounded-full shadow-sm border border-zinc-100">
                <ShoppingBag className="h-12 w-12 md:h-16 md:w-16 text-zinc-300" strokeWidth={1} />
              </div>
              <div className="text-center">
                <h2 className="text-lg md:text-xl font-medium text-zinc-600">Ready for Scan</h2>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {cart.map((item, index) => (
                <div key={index} className="flex items-center gap-3 md:gap-4 p-4 md:p-5 bg-white animate-in slide-in-from-bottom-2 duration-300">
                  <div className="shrink-0 w-10 h-10 md:w-12 md:h-12 bg-zinc-100 rounded-lg flex items-center justify-center text-zinc-600 font-bold font-mono text-sm md:text-base">
                    {item.qty}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-zinc-800 text-base md:text-lg truncate">{item.name}</h3>
                    <p className="text-xs md:text-sm text-zinc-500 truncate">
                      {item.variant || 'Standard'} • {formatMoney(item.price)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="block text-lg md:text-xl font-bold text-zinc-900 tabular-nums tracking-tight">
                      {formatMoney(item.price * item.qty)}
                    </span>
                  </div>
                </div>
              ))}
              {/* Spacer at bottom of list so last item isn't covered on mobile */}
              <div className="h-4"></div>
            </div>
          )}
        </main>
      </div>

      {/* ================= SECTION B: SIDEBAR / BOTTOM BAR ================= */}
      {/* - Mobile: Fixed at bottom, stacked vertically. 
          - Tablet: Fixed at bottom, Row layout (Promo Left, Totals Right).
          - Desktop: Fixed Right Sidebar, Column layout (Promo Top, Totals Bottom).
      */}
      <div className="
        w-full lg:w-[400px] xl:w-[480px] 
        shrink-0 bg-zinc-900 text-white relative z-20 
        flex flex-row lg:flex-col
        h-auto lg:h-full
        border-t lg:border-t-0 lg:border-l border-zinc-800
      ">
        
        {/* --- PROMO SECTION --- */}
        {/* Hidden on very small screens (portrait phone), Visible on Tablet/Desktop */}
        <div className="
          hidden md:flex lg:flex 
          flex-1 lg:flex-1 
          relative overflow-hidden bg-zinc-800 
          items-center justify-center
        ">
           <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
           
           {/* Inner Content - Flex row on tablet, Flex col on desktop */}
           <div className="relative z-10 p-4 lg:p-12 w-full h-full flex flex-row lg:flex-col items-center justify-center gap-4 lg:gap-6 text-center lg:text-center text-left">
              
              {/* QR / Icon Container */}
              <div className={`p-3 rounded-xl shadow-lg ring-2 ring-white/10 shrink-0 ${currentSlide.type === 'qr' ? 'bg-white' : currentSlide.bg}`}>
                {currentSlide.type === 'qr' ? (
                  <div className="h-[80px] w-[80px] lg:h-[140px] lg:w-[140px] flex items-center justify-center">
                    <QRCodeCanvas 
                      value={currentSlide.payload || ""} 
                      style={{ height: "100%", width: "100%" }}
                      // viewBox={`0 0 256 256`}
                    />
                  </div>
                ) : (
                  <div className="h-[80px] w-[80px] lg:h-[140px] lg:w-[140px] flex items-center justify-center">
                    {/* Cloning element to adjust size dynamically if needed, or relying on parent sizing */}
                    <div className="scale-75 lg:scale-100">{currentSlide.icon}</div>
                  </div>
                )}
              </div>

              {/* Text Content */}
              <div className="flex-1 lg:flex-none">
                <h2 className="text-lg lg:text-2xl font-bold tracking-tight">{currentSlide.title}</h2>
                <p className="text-xs lg:text-base text-zinc-400 leading-snug mt-1 lg:max-w-[80%] lg:mx-auto">
                  {currentSlide.desc}
                </p>
              </div>
           </div>
        </div>

        {/* --- FINANCIAL FOOTER --- */}
        {/* Always visible. Takes full width on mobile. Half width on Tablet. Bottom half on Desktop. */}
        <div className="
          flex-1 lg:flex-none 
          bg-zinc-950 p-5 md:p-6 lg:p-8 
          flex flex-col justify-center lg:justify-end 
          shadow-[0_-4px_24px_rgba(0,0,0,0.3)]
        ">
          
          {/* Breakdown - Compact on Mobile */}
          <div className="space-y-1 md:space-y-3 mb-3 md:mb-8 text-xs md:text-sm font-medium">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums text-zinc-300">{formatMoney(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span className="flex items-center gap-1"><Percent size={12}/> Savings</span>
                <span className="font-mono tabular-nums">- {formatMoney(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-zinc-400">
              <span>Tax</span>
              <span className="font-mono tabular-nums text-zinc-300">{formatMoney(totals.tax)}</span>
            </div>
          </div>

          {/* Grand Total */}
          <div className="pt-3 md:pt-6 border-t border-zinc-800/50">
            <div className="flex flex-col gap-0 md:gap-1 items-end">
              <span className="text-[10px] md:text-sm font-medium text-zinc-500 uppercase tracking-widest">Total Due</span>
              {/* Responsive Text Size using Clamp logic via Tailwind */}
              <span className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tighter tabular-nums font-mono">
                {formatMoney(totals.finalTotal)}
              </span>
            </div>
          </div>

          {/* Instructions - Hidden on small mobile to save vertical space */}
          <div className="hidden md:flex mt-4 md:mt-8 pt-4 items-center justify-between text-zinc-500 text-xs border-t border-zinc-800/30">
             <div className="flex items-center gap-2">
               <Receipt size={14} />
               <span className="hidden xl:inline">Receipt Available</span>
             </div>
             <div className="flex items-center gap-2">
               <MonitorSmartphone size={14} />
               <span>Insert / Swipe</span>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}