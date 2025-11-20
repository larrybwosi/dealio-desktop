import { PaymentMethod } from "@/hooks/sales";

export type OrderType = 'Dine in' | 'Takeaway' | 'Delivery' | 'Pickup' | 'Online';

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyaltyPoints?: number;
}

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  // Variant/Unit details specific to the modal's mapping
  variantId?: string;
  variant?: string;
  variantName?: string;
  unitId?: string;
  unitName?: string;
  addition?: string;
  // Reference to original structure if needed
  selectedUnit?: {
    unitId: string;
    unitName: string;
    price: number;
  };
}

export interface Order {
  id: string;
  orderNumber: string;
  saleNumber?: string;
  items: CartItem[];
  customer: Customer | null;

  // Financials
  subtotal: number; // Net amount (before tax) or Gross depending on logic
  discount: number;
  tax: number;
  total: number;
  amountPaid?: number;
  change?: number;

  // Order Details
  orderType: OrderType;
  tableNumber?: string;
  status: 'pending-payment' | 'completed' | 'cancelled';
  paymentMethod: PaymentMethod;
  datetime: string;
  notes?: string;

  // Mobile Payment Specifics
  mobilePaymentPhone?: string;
}
