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
    console.log(`Connecting to Hub at ${hubIp}...`);
    if (hubIp) {
       connectToHub(`ws://${hubIp}:8080/kds-ws`);
    }
  }
}

// --- 2. The WebSocket Client ---
let socket: WebSocket | null = null;

function getOfflineQueue(): string[] {
  const stored = localStorage.getItem('KDS_OFFLINE_QUEUE');
  return stored ? JSON.parse(stored) : [];
}

function addToOfflineQueue(payload: string) {
  const queue = getOfflineQueue();
  queue.push(payload);
  localStorage.setItem('KDS_OFFLINE_QUEUE', JSON.stringify(queue));
}

function clearOfflineQueue() {
  localStorage.removeItem('KDS_OFFLINE_QUEUE');
}

export function connectToHub(url: string) {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  socket = new WebSocket(url);

  socket.onopen = () => {
    console.log("Connected to Local POS Hub!");
    // Send initial status/heartbeat
    const role = localStorage.getItem('DEVICE_ROLE');
    const user = JSON.parse(localStorage.getItem('pos-auth-storage-v3') || '{}').state?.currentMember;

    socket?.send(JSON.stringify({
      type: 'DeviceStatus',
      payload: {
        id: localStorage.getItem('DEVICE_ID') || 'unknown',
        name: localStorage.getItem('DEVICE_NAME') || 'Terminal',
        device_type: role,
        status: 'online',
        last_seen: Date.now(),
        current_user_id: user?.id || null,
        current_user_name: user?.name || null,
        station: localStorage.getItem('KDS_STATION') || null
      }
    }));

    // Process offline queue
    const queue = getOfflineQueue();
    if (queue.length > 0) {
      console.log(`Processing ${queue.length} offline messages...`);
      queue.forEach(msg => {
        socket?.send(msg);
      });
      clearOfflineQueue();
    }
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    // Handle incoming broadcast messages
    if (message.type === 'NewOrder') {
        const order = message.payload;
        // If this is the KDS device, add to the screen array
        useKdsStore.getState().addOrder(order);
        console.log("KDS: New Ticket Arrived!", order);

        // Check for Auto-Print (Only on KDS role)
        const role = localStorage.getItem('DEVICE_ROLE');
        const kdsConfig = usePosStore.getState().settings.kitchenTicketConfig;
        if (role === 'KDS' && kdsConfig.autoPrintKds) {
            console.log("KDS: Auto-printing ticket...");
            usePosStore.getState().printReceipt(order.id);
        }
    }
    
    if (message.type === 'OrderStatusUpdated') {
        const { order_id, new_status } = message.payload;
        useKdsStore.getState().updateOrderStatus(order_id, new_status);
        
        // Also update POS store if it's running on this device
        let posStatus = 'pending';
        if (new_status === 'in_progress') posStatus = 'cooking';
        if (new_status === 'done') posStatus = 'ready';
        usePosStore.getState().updateOrderStatus(order_id, posStatus as any);
    }

    if (message.type === 'AssignmentUpdate') {
      const { device_id, user_id, user_name } = message.payload;
      const myDeviceId = localStorage.getItem('DEVICE_ID');

      if (device_id === myDeviceId) {
        console.log(`My assignment updated: ${user_name}`);
        localStorage.setItem('ASSIGNED_USER_ID', user_id || '');
        localStorage.setItem('ASSIGNED_USER_NAME', user_name || '');

        // Optional: Trigger a custom event or store update if needed UI-wide
        window.dispatchEvent(new CustomEvent('assignment-updated', {
          detail: { userId: user_id, userName: user_name }
        }));
      }
    }

    if (message.type === 'OrderEtaQuery') {
      const { order_id, station } = message.payload;
      const myStation = localStorage.getItem('KDS_STATION') || 'all';
      if (station === 'all' || station === myStation) {
        window.dispatchEvent(new CustomEvent('order-eta-query', {
          detail: { orderId: order_id }
        }));
      }
    }

    if (message.type === 'OrderEtaResponse') {
      const { order_id, eta_minutes } = message.payload;
      window.dispatchEvent(new CustomEvent('order-eta-response', {
        detail: { orderId: order_id, etaMinutes: eta_minutes }
      }));
    }

    if (message.type === 'TabletActivity') {
      window.dispatchEvent(new CustomEvent('tablet-activity-update', {
        detail: message.payload
      }));
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

  const jsonPayload = JSON.stringify(payload);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(jsonPayload);
  } else {
    console.error("Hub offline! Saving to local offline queue...");
    addToOfflineQueue(jsonPayload);
  }
}

export function updateOrderStatusInKitchen(orderId: string, status: string) {
  const payload = {
    type: "OrderStatusUpdated",
    payload: {
      order_id: orderId,
      new_status: status
    }
  };

  const jsonPayload = JSON.stringify(payload);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(jsonPayload);
  } else {
    addToOfflineQueue(jsonPayload);
  }
}

export function sendTabletActivity(activity: { current_page: string, cart_items: any[], table_number: string | null }) {
  const payload = {
    type: "TabletActivity",
    payload: {
      device_id: localStorage.getItem('DEVICE_ID') || 'unknown',
      ...activity
    }
  };

  const jsonPayload = JSON.stringify(payload);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(jsonPayload);
  }
}

export function queryOrderEta(orderId: string, station: string = 'all') {
  const payload = {
    type: "OrderEtaQuery",
    payload: {
      order_id: orderId,
      station: station
    }
  };

  const jsonPayload = JSON.stringify(payload);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(jsonPayload);
  }
}

export function sendOrderEtaResponse(orderId: string, etaMinutes: number) {
  const payload = {
    type: "OrderEtaResponse",
    payload: {
      order_id: orderId,
      eta_minutes: etaMinutes
    }
  };

  const jsonPayload = JSON.stringify(payload);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(jsonPayload);
  }
}