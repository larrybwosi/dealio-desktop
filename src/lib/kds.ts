import { invoke } from '@tauri-apps/api/core';
import { useKdsStore } from '@/store/kds-store';
import { usePosStore } from '@/store/store';

// --- 1. Role Initialization (Run this on app startup) ---
export async function initializeNetworkRole() {
  const role = localStorage.getItem('DEVICE_ROLE'); // 'MAIN_HUB', 'TABLET', or 'KDS'
  
  if (role === 'MAIN_HUB') {
    // If this device is the main register, start the local server!
    try {
      const wsUrl = await invoke<string>('start_kds_hub');
      localStorage.setItem('HUB_WS_URL', wsUrl); // Save its own IP
      console.log("Hub started at:", wsUrl);
      connectToHub(wsUrl); // Connect to itself
    } catch (e) {
      console.error("Failed to start Hub:", e);
    }
  } else if (role === 'TABLET' || role === 'KDS') {
    // For other devices, grab the IP of the Hub (Inputted during setup)
    const hubIp = localStorage.getItem('HUB_IP_ADDRESS');
    if (hubIp) {
       connectToHub(`ws://${hubIp}:8080/kds-ws`);
    }
  }
}

// --- 2. The WebSocket Client ---
let socket: WebSocket | null = null;

export function connectToHub(url: string) {
  socket = new WebSocket(url);

  socket.onopen = () => {
    console.log("Connected to Local POS Hub!");
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    // Handle incoming broadcast messages
    if (message.type === 'NewOrder') {
        const order = message.payload;
        // If this is the KDS device, add to the screen array
        useKdsStore.getState().addOrder(order);
        console.log("KDS: New Ticket Arrived!", order);
    }
    
    if (message.type === 'OrderStatusUpdated') {
        const { order_id, status } = message.payload;
        useKdsStore.getState().updateOrderStatus(order_id, status);
        
        // Also update POS store if it's running on this device
        let posStatus = 'pending';
        if (status === 'in_progress') posStatus = 'cooking';
        if (status === 'done') posStatus = 'ready';
        usePosStore.getState().updateOrderStatus(order_id, posStatus as any);
    }
  };

  socket.onclose = () => {
    console.warn("Lost connection to Hub. Reconnecting in 3s...");
    setTimeout(() => connectToHub(url), 3000); // Auto-reconnect
  };
}

// --- 3. Sending an Order from a Tablet ---
export function sendOrderToKitchen(fullOrder: any) {
  const KdsOrderPayload = {
    id: fullOrder.id,
    num: fullOrder.orderNumber || fullOrder.saleNumber || fullOrder.id.substring(0, 6) || `TKT-${Math.floor(Math.random() * 1000)}`,
    type: fullOrder.orderType === 'dine-in' ? 'dine' : fullOrder.orderType === 'delivery' ? 'delivery' : 'takeout',
    station: 'hot', // Route properly if you have logic later
    table: fullOrder.tableNumber || '',
    status: 'new',
    createdAt: Date.now(),
    items: fullOrder.items?.map((item: any) => ({
      id: item.productId + '-' + Math.random(),
      name: item.productName || item.name,
      qty: item.quantity,
      mod: '',
      isAllergy: false,
      status: 'pending'
    })) || [],
    note: fullOrder.notes || '',
    server: fullOrder.customerName || 'Cashier',
    covers: null
  };

  const payload = {
    type: "NewOrder",
    payload: KdsOrderPayload
  };

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  } else {
    // Fallback: Save to an offline queue in localStorage to send when reconnected
    console.error("Hub offline! Saving to local offline queue...");
  }
}

export function updateOrderStatusInKitchen(orderId: string, status: string) {
  const payload = {
    type: "OrderStatusUpdated",
    payload: {
      order_id: orderId,
      status: status
    }
  };

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}