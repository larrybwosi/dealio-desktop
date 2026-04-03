import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

import { Shift, shiftService } from '@/lib/shift-service';
import { useCashDrawer } from '@/hooks/use-cash-drawer';
import { toast } from 'sonner';
import { usePrinterStore } from '@/store/printer-store';

const ShiftManager: React.FC = () => {
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const { openPhysicalDrawer } = useCashDrawer();
  const { assignments } = usePrinterStore();
  const [loading, setLoading] = useState(false);

  // Auth State
  const [cardId, setCardId] = useState('');
  const [pin, setPin] = useState('');

  // Form State
  const [amount, setAmount] = useState('');
  const [view, setView] = useState<'STATUS' | 'OPEN' | 'CLOSE' | 'DROP'>('STATUS');

  // 1. Initialize: Check if shift is open
  useEffect(() => {
    loadShiftStatus();

    // 2. Setup NFC Listener
    const unlisten = listen<string>('nfc-read', event => {
      setCardId(event.payload); // Auto-fill the Card ID

      // Optional: Auto-focus the PIN input for better UX
      document.getElementById('pin-input')?.focus();
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const loadShiftStatus = async () => {
    try {
      const shift = await shiftService.getShiftStatus();
      setCurrentShift(shift);
      setView(shift ? 'STATUS' : 'OPEN');
    } catch (err) {
      // Failed to load shift
    }
  };

  // --- ACTIONS ---

  const handleOpenShift = async () => {
    if (!cardId || !pin) return toast.error('Please scan card and enter PIN');
    setLoading(true);
    try {
      const shift = await shiftService.openShift(cardId, pin, Number(amount));
      setCurrentShift(shift);
      setView('STATUS');

      // Open Drawer & Notify
      await openPhysicalDrawer();
      toast.success('Shift Opened Successfully');

      clearAuth();
    } catch (e) {
      toast.error('Error opening shift: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    if (!cardId || !pin) return toast.error('Please scan card and enter PIN');
    setLoading(true);
    try {
      // Pass a printer name if you want auto-printing, e.g., "Thermal_Printer_1"
      const receiptPrinter = assignments.receipt || undefined;
      const shift = await shiftService.closeShift(cardId, pin, Number(amount), receiptPrinter);

      setCurrentShift(null); // Shift is gone

      await openPhysicalDrawer();

      toast.success('Shift Closed', {
        description: `Variance: ${shift.variance?.toFixed(2)}`,
      });

      setView('OPEN');
      clearAuth();
    } catch (e) {
      toast.error('Error closing shift: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const clearAuth = () => {
    setCardId('');
    setPin('');
    setAmount('');
  };

  // --- RENDER HELPERS ---

  const AuthForm = () => (
    <div className="p-4 bg-gray-100 rounded mb-4 border border-gray-300">
      <h3 className="font-bold text-sm mb-2 text-gray-700">🔐 Manager Authorization</h3>

      <div className="mb-2">
        <label className="block text-xs uppercase text-gray-500">NFC Card ID</label>
        <input
          type="text"
          value={cardId}
          readOnly // Prevent typing, force scanning
          placeholder="Scan Card..."
          className="w-full p-2 bg-white border rounded text-gray-500 italic"
        />
        {!cardId && <small className="text-blue-500 animate-pulse">Waiting for NFC Scan...</small>}
      </div>

      <div className="mb-2">
        <label className="block text-xs uppercase text-gray-500">Employee PIN</label>
        <input
          id="pin-input"
          type="password"
          value={pin}
          onChange={e => setPin(e.target.value)}
          placeholder="Enter PIN"
          className="w-full p-2 border rounded"
        />
      </div>
    </div>
  );

  // --- MAIN VIEWS ---

  if (view === 'OPEN') {
    return (
      <div className="max-w-md mx-auto p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-xl font-bold mb-4">☀️ Start New Shift</h2>
        <AuthForm />

        <label className="block text-sm font-bold mb-1">Opening Float Amount</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full p-3 border rounded text-lg mb-4"
          placeholder="0.00"
        />

        <button
          onClick={handleOpenShift}
          disabled={loading || !cardId || !pin}
          className="w-full bg-green-600 text-white p-3 rounded font-bold hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Opening...' : 'Open Shift'}
        </button>
      </div>
    );
  }

  if (view === 'CLOSE') {
    return (
      <div className="max-w-md mx-auto p-6 bg-white shadow-lg rounded-lg">
        <h2 className="text-xl font-bold mb-4 text-red-600">🌙 End Shift</h2>
        <div className="mb-4 text-sm bg-yellow-50 p-2 border border-yellow-200 rounded">
          Expected Cash in Drawer: <strong>{currentShift?.expected_cash.toFixed(2)}</strong>
        </div>

        <AuthForm />

        <label className="block text-sm font-bold mb-1">Actual Cash Counted</label>
        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full p-3 border rounded text-lg mb-4"
          placeholder="0.00"
        />

        <div className="flex gap-2">
          <button onClick={() => setView('STATUS')} className="flex-1 bg-gray-300 p-3 rounded">
            Cancel
          </button>
          <button
            onClick={handleCloseShift}
            disabled={loading || !cardId || !pin}
            className="flex-1 bg-red-600 text-white p-3 rounded font-bold hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? 'Closing...' : 'Close & Print Report'}
          </button>
        </div>
      </div>
    );
  }

  // STATUS VIEW
  return (
    <div className="p-6 bg-white shadow rounded">
      <div className="flex justify-between items-center mb-6 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-green-700">Shift Active</h2>
          <p className="text-gray-500 text-sm">Operator: {currentShift?.operator_id || 'Unknown'}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">Started At</div>
          <div className="font-mono">{new Date(currentShift?.opened_at || '').toLocaleTimeString()}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded border border-blue-100">
          <div className="text-xs text-blue-500 uppercase">Cash Sales</div>
          <div className="text-2xl font-bold">{currentShift?.total_cash_sales.toFixed(2)}</div>
        </div>
        <div className="p-4 bg-orange-50 rounded border border-orange-100">
          <div className="text-xs text-orange-500 uppercase">Cash Drops</div>
          <div className="text-2xl font-bold">{currentShift?.total_cash_drops.toFixed(2)}</div>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded border mb-6 flex justify-between items-center">
        <span className="font-bold text-gray-700">Current Expected Cash:</span>
        <span className="text-xl font-bold">{currentShift?.expected_cash.toFixed(2)}</span>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => {
            setView('CLOSE');
            clearAuth();
          }}
          className="flex-1 bg-red-500 text-white py-3 rounded shadow hover:bg-red-600"
        >
          Close Shift
        </button>
        {/* You could add a 'Cash Drop' button here similarly */}
      </div>
    </div>
  );
};

export default ShiftManager;
