import { createWithEqualityFn as create } from 'zustand/traditional';
import { persist, createJSONStorage } from 'zustand/middleware';
import { type BusinessType, getBusinessConfig, getDefaultSidebarItems } from '../lib/business-configs';

export type OrderType = 'takeaway' | 'delivery' | 'dine-in' | 'pickup' | 'online';
export type OrderStatus = 'waiting' | 'ready' | 'canceled' | 'completed';

export type NotificationType = 'order' | 'stock' | 'system' | 'warning' | 'error' | 'success';
export type NotificationPriority = 'low' | 'medium' | 'high';

export interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  metadata?: Record<string, any>;
  soundEnabled?: boolean;
  autoClose?: boolean;
  duration?: number;
}

export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  showOnlineOrders: boolean;
  showLowStock: boolean;
  showSystemAlerts: boolean;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  autoCloseDelay: number;
}

export interface SellableUnit {
  unitId: string;
  unitName: string;
  price: number;
  conversion: number;
  isBaseUnit: boolean;
}

export interface Product {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  category: string;
  sku: string;
  barcode?: string;
  imageUrl?: string;
  stock: number;
  sellableUnits: SellableUnit[];
}

export interface OrderItem {
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  selectedUnit: SellableUnit;
  quantity: number;
  isWholesale?: boolean;
  imageUrl?: string;
  sku?: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  orderType: OrderType;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: Date;
  subTotal: number;
  discount: number;
  taxes: number;
  total: number;
  paymentMethod: string;
  tableNumber?: string;
  instructions?: string;
  metadata?: Record<string, any>;
  cashierName?: string;
}

export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
}
export interface ReceiptConfig {
  // Branding
  showLogo: boolean;
  logoUrl: string;
  logoWidth: number; // Percentage
  logoPosition: 'left' | 'center' | 'right';

  // Business Details
  headerText: string;
  footerText: string;
  showAddress: boolean;
  address: string;
  showPhone: boolean;
  phone: string;
  showEmail: boolean;
  email: string;
  showTaxNumber: boolean;
  taxNumber: string;
  showWebsite: boolean;
  website: string;

  // Enterprise / Social
  showSocialMedia: boolean;
  socialMediaHandle: string; // e.g., @dealio_pos
  showReturnPolicy: boolean;
  returnPolicyText: string;

  // Layout & Typography
  paperSize: '80mm' | '58mm' | 'Letter';
  fontFamily: 'monospace' | 'sans' | 'serif';
  fontSize: 'small' | 'medium' | 'large';
  textAlignment: 'left' | 'center';
  marginHorizontal: number;

  // Content Granularity
  dateFormat: string;
  showCashier: boolean; // "Served by..."
  showCustomerName: boolean;
  showOrderType: boolean; // Dine-in / Takeaway
  showPaymentMethod: boolean; // Card / Cash
  showItemSku: boolean;
  showItemNotes: boolean;

  // Codes
  showBarcode: boolean;
  showQrCode: boolean;
  qrCodeTarget: 'order-link' | 'review-link' | 'website'; // What the QR does
  qrCodeCustomUrl?: string; // If target is review/website
}

export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system';
  primaryColor: string;
  accentColor: string;
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
}

export interface PrinterConfig {
  id: string;
  name: string;
  type: 'receipt' | 'invoice' | 'label' | 'kitchen';
  connection: 'usb' | 'network' | 'bluetooth';
  ipAddress?: number;
  port?: number;
  isDefault: boolean;
  paperSize: '80mm' | '58mm' | 'a4';
  enabled: boolean;
}

export interface SecurityConfig {
  enableSessionTimeout: boolean;
  sessionTimeoutMinutes: number;
  enableFailedLoginLock: boolean;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  requireStrongPasswords: boolean;
  enableTwoFactorAuth: boolean;
  enableAuditLog: boolean;
  allowedIpAddresses: string[];
  enableDataEncryption: boolean;
}

export interface ApiSyncConfig {
  enabled: boolean;
  apiEndpoint: string;
  apiKey: string;
  syncInterval: number;
  lastSyncTimestamp?: Date;
  autoSync: boolean;
  syncOnOrderComplete: boolean;
  syncInventory: boolean;
  syncCustomers: boolean;
  syncEmployees: boolean;
  syncOrders: boolean;
  enableOfflineMode: boolean;
  conflictResolution: 'server' | 'client' | 'manual';
}

export interface BusinessSettings {
  businessName: string;
  businessType: BusinessType;
  currency: string;
  taxRate: number;
  sidebarItems: SidebarItem[];
  receiptConfig: ReceiptConfig;
  allowSaveUnpaidOrders: boolean;
  enableCustomerManagement: boolean;
  enableEmployeeManagement: boolean;
  enableLowStockAlerts: boolean;
  lowStockThreshold: number;
  enableCashDrawer: boolean;
  requireEmployeePin: boolean;
  enableAutoPrint: boolean;
  printerName: string;
  enableEmailReceipts: boolean;
  themeConfig: ThemeConfig;
  printers: PrinterConfig[];
  securityConfig: SecurityConfig;
  apiSyncConfig: ApiSyncConfig;
  notificationSettings: NotificationSettings; // Added notification settings
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalPurchases: number;
  lastVisit: Date;
  loyaltyPoints: number;
  notes?: string;
  customerType?: 'retail' | 'b2b';
  businessName?: string;
  taxId?: string;
  creditLimit?: number;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'cashier' | 'manager' | 'admin';
  pin: string;
  active: boolean;
  hireDate: Date;
}

export interface CashDrawer {
  id: string;
  employeeId: string;
  employeeName: string;
  openedAt: Date;
  closedAt?: Date;
  openingBalance: number;
  closingBalance?: number;
  expectedBalance?: number;
  difference?: number;
  status: 'open' | 'closed';
  transactions: {
    type: 'sale' | 'refund' | 'cash-in' | 'cash-out';
    amount: number;
    timestamp: Date;
    orderId?: string;
    notes?: string;
  }[];
}

export interface InventoryAlert {
  productId: string;
  productName: string;
  currentStock: number;
  minimumStock: number;
  alertType: 'low' | 'out';
}

export interface DailySummary {
  date: string;
  totalSales: number;
  totalOrders: number;
  totalTax: number;
  totalDiscount: number;
  paymentMethods: Record<string, number>;
  topProducts: { productId: string; productName: string; quantity: number; revenue: number }[];
}

// Added Table interface
export interface Table {
  id: string;
  number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved';
  currentOrderId?: string;
  section?: string;
  notes?: string;
}

interface PosStore {
  currentOrder: {
    customerName: string;
    orderType: OrderType;
    items: OrderItem[];
    tableNumber?: string;
    instructions?: string;
    metadata?: Record<string, any>;
    customerId?: string;
  };

  orders: Order[];
  products: Product[];
  settings: BusinessSettings;
  lastCompletedOrder: Order | null;

  customers: Customer[];
  employees: Employee[];
  cashDrawers: CashDrawer[];
  currentEmployeeId: string | null;
  activeCashDrawerId: string | null;

  notifications: Notification[];
  unreadNotificationCount: number;

  // Added tables and related methods
  tables: Table[];
  addTable: (table: Omit<Table, 'id'>) => void;
  updateTable: (id: string, table: Partial<Table>) => void;
  deleteTable: (id: string) => void;
  setTableStatus: (id: string, status: Table['status']) => void;
  assignOrderToTable: (tableId: string, orderId: string) => void;
  clearTableOrder: (tableId: string) => void;

  getBusinessConfig: () => ReturnType<typeof getBusinessConfig>;

  setCustomerName: (name: string) => void;
  setOrderType: (type: OrderType) => void;
  addItemToOrder: (product: Product, unit: SellableUnit, quantity: number, options?: { isWholesale?: boolean }) => void;
  updateItemQuantity: (productId: string, unitId: string, quantity: number) => void;
  removeItemFromOrder: (productId: string, unitId: string) => void;
  resetOrder: () => void;
  completeOrder: (paymentMethod: string, discountAmount: number) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;

  updateBusinessSettings: (settings: Partial<BusinessSettings>) => void;
  toggleSidebarItem: (itemId: string) => void;
  changeBusinessType: (type: BusinessType) => void;
  updateReceiptConfig: (config: Partial<ReceiptConfig>) => void;
  saveUnpaidOrder: (discountAmount: number) => void;

  addCustomer: (customer: Omit<Customer, 'id' | 'totalPurchases' | 'lastVisit' | 'loyaltyPoints'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  selectCustomer: (customerId: string) => void;

  addEmployee: (employee: Omit<Employee, 'id'>) => void;
  updateEmployee: (id: string, employee: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;
  loginEmployee: (pin: string) => boolean;
  logoutEmployee: () => void;

  openCashDrawer: (openingBalance: number) => void;
  closeCashDrawer: (closingBalance: number) => void;
  addCashTransaction: (type: 'cash-in' | 'cash-out', amount: number, notes?: string) => void;

  updateProductStock: (productId: string, newStock: number) => void;
  getLowStockProducts: () => InventoryAlert[];
  getDailySummary: (date: string) => DailySummary;
  getTopProducts: (limit: number) => {
    productId: string;
    productName: string;
    quantity: number;
    revenue: number;
  }[];

  printReceipt: (orderId: string) => void;
  emailReceipt: (orderId: string, email: string) => void;

  addPrinter: (printer: Omit<PrinterConfig, 'id'>) => void;
  updatePrinter: (id: string, printer: Partial<PrinterConfig>) => void;
  deletePrinter: (id: string) => void;
  setDefaultPrinter: (id: string) => void;

  updateThemeConfig: (config: Partial<ThemeConfig>) => void;

  updateSecurityConfig: (config: Partial<SecurityConfig>) => void;

  updateApiSyncConfig: (config: Partial<ApiSyncConfig>) => void;

  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  deleteNotification: (id: string) => void;
  clearAllNotifications: () => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  simulateOnlineOrder: () => void;
  checkLowStockAlerts: () => void;

  syncDataToApi: () => Promise<{ success: boolean; error?: string }>;

  setTableNumber: (tableNumber: string) => void;
  setInstructions: (instructions: string) => void;
}

const mockProducts: Product[] = [
  {
    productId: 'prod_001',
    productName: 'Green Grass Jelly Drink',
    variantId: 'var_001',
    variantName: 'Regular',
    category: 'Beverage',
    sku: 'CENDOL-REG',
    barcode: '001',
    imageUrl: '/placeholder.svg?height=200&width=300',
    stock: 50,
    sellableUnits: [
      {
        unitId: 'unit_glass',
        unitName: 'Glass',
        price: 20000,
        conversion: 1.0,
        isBaseUnit: true,
      },
      {
        unitId: 'unit_large',
        unitName: 'Large',
        price: 25000,
        conversion: 1.5,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_half_dozen',
        unitName: 'Half Dozen (6)',
        price: 110000,
        conversion: 6.0,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_dozen',
        unitName: 'Dozen (12)',
        price: 210000,
        conversion: 12.0,
        isBaseUnit: false,
      },
    ],
  },
  {
    productId: 'prod_002',
    productName: 'Young Coconut Ice',
    variantId: 'var_002',
    variantName: 'Regular',
    category: 'Beverage',
    sku: 'KELAPA-REG',
    barcode: '002',
    imageUrl: '/placeholder.svg?height=200&width=300',
    stock: 30,
    sellableUnits: [
      {
        unitId: 'unit_glass',
        unitName: 'Glass',
        price: 22000,
        conversion: 1.0,
        isBaseUnit: true,
      },
      {
        unitId: 'unit_large',
        unitName: 'Large',
        price: 28000,
        conversion: 1.5,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_half_dozen',
        unitName: 'Half Dozen (6)',
        price: 125000,
        conversion: 6.0,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_dozen',
        unitName: 'Dozen (12)',
        price: 240000,
        conversion: 12.0,
        isBaseUnit: false,
      },
    ],
  },
  {
    productId: 'prod_003',
    productName: 'Grass Jelly Drink',
    variantId: 'var_003',
    variantName: 'Regular',
    category: 'Beverage',
    sku: 'CINCAU-REG',
    barcode: '003',
    imageUrl: '/placeholder.svg?height=200&width=300',
    stock: 40,
    sellableUnits: [
      {
        unitId: 'unit_glass',
        unitName: 'Glass',
        price: 20000,
        conversion: 1.0,
        isBaseUnit: true,
      },
      {
        unitId: 'unit_large',
        unitName: 'Large',
        price: 26000,
        conversion: 1.5,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_half_dozen',
        unitName: 'Half Dozen (6)',
        price: 110000,
        conversion: 6.0,
        isBaseUnit: false,
      },
    ],
  },
  {
    productId: 'prod_004',
    productName: 'Mixed Fruit Cocktail',
    variantId: 'var_004',
    variantName: 'Regular',
    category: 'Beverage',
    sku: 'BUAH-REG',
    barcode: '004',
    imageUrl: '/placeholder.svg?height=200&width=300',
    stock: 25,
    sellableUnits: [
      {
        unitId: 'unit_bowl',
        unitName: 'Bowl',
        price: 26000,
        conversion: 1.0,
        isBaseUnit: true,
      },
      {
        unitId: 'unit_large_bowl',
        unitName: 'Large Bowl',
        price: 35000,
        conversion: 1.5,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_half_dozen',
        unitName: 'Half Dozen (6)',
        price: 150000,
        conversion: 6.0,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_dozen',
        unitName: 'Dozen (12)',
        price: 290000,
        conversion: 12.0,
        isBaseUnit: false,
      },
    ],
  },
  {
    productId: 'prod_005',
    productName: 'Avocado & Coconut Mix',
    variantId: 'var_005',
    variantName: 'Regular',
    category: 'Beverage',
    sku: 'TELER-REG',
    barcode: '005',
    imageUrl: '/placeholder.svg?height=200&width=300',
    stock: 35,
    sellableUnits: [
      {
        unitId: 'unit_bowl',
        unitName: 'Bowl',
        price: 28000,
        conversion: 1.0,
        isBaseUnit: true,
      },
      {
        unitId: 'unit_large_bowl',
        unitName: 'Large Bowl',
        price: 38000,
        conversion: 1.5,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_half_dozen',
        unitName: 'Half Dozen (6)',
        price: 160000,
        conversion: 6.0,
        isBaseUnit: false,
      },
    ],
  },
  {
    productId: 'prod_006',
    productName: 'Green Banana Coconut',
    variantId: 'var_006',
    variantName: 'Regular',
    category: 'Dessert',
    sku: 'PISANG-REG',
    barcode: '006',
    imageUrl: '/placeholder.svg?height=200&width=300',
    stock: 20,
    sellableUnits: [
      {
        unitId: 'unit_plate',
        unitName: 'Plate',
        price: 25000,
        conversion: 1.0,
        isBaseUnit: true,
      },
      {
        unitId: 'unit_half_dozen',
        unitName: 'Half Dozen (6)',
        price: 140000,
        conversion: 6.0,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_dozen',
        unitName: 'Dozen (12)',
        price: 270000,
        conversion: 12.0,
        isBaseUnit: false,
      },
    ],
  },
  {
    productId: 'prod_007',
    productName: 'Milk Coffee',
    variantId: 'var_007',
    variantName: 'Regular',
    category: 'Beverage',
    sku: 'KOPI-REG',
    barcode: '007',
    imageUrl: '/placeholder.svg?height=200&width=300',
    stock: 60,
    sellableUnits: [
      {
        unitId: 'unit_cup',
        unitName: 'Cup',
        price: 18000,
        conversion: 1.0,
        isBaseUnit: true,
      },
      {
        unitId: 'unit_large_cup',
        unitName: 'Large Cup',
        price: 24000,
        conversion: 1.5,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_half_dozen',
        unitName: 'Half Dozen (6)',
        price: 100000,
        conversion: 6.0,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_dozen',
        unitName: 'Dozen (12)',
        price: 190000,
        conversion: 12.0,
        isBaseUnit: false,
      },
    ],
  },
  {
    productId: 'prod_008',
    productName: 'Fried Rice',
    variantId: 'var_008',
    variantName: 'Regular',
    category: 'Main Course',
    sku: 'NASI-REG',
    barcode: '008',
    imageUrl: '/placeholder.svg?height=200&width=300',
    stock: 45,
    sellableUnits: [
      {
        unitId: 'unit_plate',
        unitName: 'Plate',
        price: 35000,
        conversion: 1.0,
        isBaseUnit: true,
      },
      {
        unitId: 'unit_large_plate',
        unitName: 'Large Plate',
        price: 45000,
        conversion: 1.5,
        isBaseUnit: false,
      },
      {
        unitId: 'unit_half_dozen',
        unitName: 'Half Dozen (6)',
        price: 200000,
        conversion: 6.0,
        isBaseUnit: false,
      },
    ],
  },
];

export const getDefaultReceiptConfig = (): ReceiptConfig => ({
  // Branding
  showLogo: true,
  logoUrl: '',
  logoWidth: 50, // Default to 50% width
  logoPosition: 'center', // Center align logo by default

  // Business Details
  headerText: 'Thank you for your purchase!',
  footerText: 'Please come again',
  showAddress: true,
  address: '123 Main Street, City, Country',
  showPhone: true,
  phone: '+1 234 567 8900',
  showEmail: true,
  email: 'contact@business.com',
  showTaxNumber: true,
  taxNumber: 'TAX-123456789',
  showWebsite: true,
  website: 'www.business.com',

  // Enterprise / Social
  showSocialMedia: false,
  socialMediaHandle: '', // e.g., @yourbusiness
  showReturnPolicy: false,
  returnPolicyText: 'Items may be returned within 7 days of purchase with original receipt.',

  // Layout & Typography
  paperSize: '80mm',
  fontFamily: 'monospace',
  fontSize: 'medium',
  textAlignment: 'center',
  marginHorizontal: 0,

  // Content Granularity
  dateFormat: 'yyyy-MM-dd HH:mm',
  showCashier: true, // Useful for tracking who served the customer
  showCustomerName: true, // Important for enterprise accounts
  showOrderType: true, // Dine-in / Takeaway / Delivery
  showPaymentMethod: true, // Card / Cash
  showItemSku: false,
  showItemNotes: true,

  // Codes
  showBarcode: true,
  showQrCode: false,
  qrCodeTarget: 'order-link', // Default to tracking link
  qrCodeCustomUrl: '',
});

const getDefaultThemeConfig = (): ThemeConfig => ({
  mode: 'light',
  primaryColor: 'oklch(0.42 0.145 265)',
  accentColor: 'oklch(0.96 0.005 240)',
  fontSize: 'medium',
  compactMode: false,
});

const getDefaultPrinters = (): PrinterConfig[] => [
  {
    id: 'printer_default',
    name: 'Default Receipt Printer',
    type: 'receipt',
    connection: 'usb',
    isDefault: true,
    paperSize: '80mm',
    enabled: true,
  },
];

const getDefaultSecurityConfig = (): SecurityConfig => ({
  enableSessionTimeout: true,
  sessionTimeoutMinutes: 30,
  enableFailedLoginLock: true,
  maxFailedAttempts: 5,
  lockoutDurationMinutes: 15,
  requireStrongPasswords: true,
  enableTwoFactorAuth: false,
  enableAuditLog: true,
  allowedIpAddresses: [],
  enableDataEncryption: false,
});

const getDefaultApiSyncConfig = (): ApiSyncConfig => ({
  enabled: false,
  apiEndpoint: '',
  apiKey: '',
  syncInterval: 300,
  autoSync: false,
  syncOnOrderComplete: false,
  syncInventory: true,
  syncCustomers: true,
  syncEmployees: true,
  syncOrders: true,
  enableOfflineMode: true,
  conflictResolution: 'server',
});

const getDefaultNotificationSettings = (): NotificationSettings => ({
  enabled: true,
  soundEnabled: true,
  showOnlineOrders: true,
  showLowStock: true,
  showSystemAlerts: true,
  position: 'top-right',
  autoCloseDelay: 5000,
});

export const usePosStore = create<PosStore>()(
  persist(
    (set, get) => ({
      currentOrder: {
        customerName: '',
        orderType: 'takeaway',
        items: [],
        tableNumber: '',
        instructions: '',
        metadata: {},
      },
      orders: [
        {
          id: '1',
          orderNumber: '#324398',
          customerName: 'Juna Wok',
          orderType: 'takeaway',
          status: 'waiting',
          items: [],
          createdAt: new Date('2025-05-07T15:19:00'),
          subTotal: 100000,
          discount: 0,
          taxes: 2000,
          total: 102000,
          paymentMethod: 'cash',
        },
        {
          id: '2',
          orderNumber: '#223399',
          customerName: 'Jung Kit',
          orderType: 'delivery',
          status: 'ready',
          items: [],
          createdAt: new Date('2025-05-07T15:19:00'),
          subTotal: 150000,
          discount: 0,
          taxes: 3000,
          total: 153000,
          paymentMethod: 'card',
        },
        {
          id: '3',
          orderNumber: '#448',
          customerName: 'John Pantau',
          orderType: 'dine-in',
          status: 'canceled',
          items: [],
          createdAt: new Date('2025-05-07T14:19:00'),
          subTotal: 200000,
          discount: 0,
          taxes: 4000,
          total: 204000,
          paymentMethod: 'ewallet',
          metadata: { tableNumber: '3A' },
        },
      ],
      products: mockProducts,
      lastCompletedOrder: null,
      settings: {
        businessName: 'Dealio',
        businessType: 'restaurant',
        currency: 'KSH',
        taxRate: 2,
        sidebarItems: getDefaultSidebarItems('restaurant'),
        receiptConfig: getDefaultReceiptConfig(),
        allowSaveUnpaidOrders: true,
        enableCustomerManagement: true,
        enableEmployeeManagement: true,
        enableLowStockAlerts: true,
        lowStockThreshold: 10,
        enableCashDrawer: true,
        requireEmployeePin: false,
        enableAutoPrint: false,
        printerName: '',
        enableEmailReceipts: false,
        themeConfig: getDefaultThemeConfig(),
        printers: getDefaultPrinters(),
        securityConfig: getDefaultSecurityConfig(),
        apiSyncConfig: getDefaultApiSyncConfig(),
        notificationSettings: getDefaultNotificationSettings(), // Added default notification settings
      },
      customers: [
        {
          id: 'cust_001',
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: '+1 234 567 8900',
          totalPurchases: 450000,
          lastVisit: new Date('2025-05-06'),
          loyaltyPoints: 45,
          notes: 'Regular customer, prefers contactless payment',
          customerType: 'retail',
        },
        {
          id: 'cust_002',
          name: 'Jane Smith',
          email: 'jane.smith@example.com',
          phone: '+1 234 567 8901',
          totalPurchases: 320000,
          lastVisit: new Date('2025-05-05'),
          loyaltyPoints: 32,
          notes: 'Allergic to peanuts',
          customerType: 'retail',
        },
        {
          id: 'cust_003',
          name: 'Robert Johnson',
          email: 'robert.j@example.com',
          phone: '+1 234 567 8902',
          totalPurchases: 680000,
          lastVisit: new Date('2025-05-07'),
          loyaltyPoints: 68,
          notes: 'VIP customer, owns a restaurant',
          customerType: 'retail',
        },
        {
          id: 'cust_004',
          name: 'Maria Garcia',
          email: 'maria.garcia@example.com',
          phone: '+1 234 567 8903',
          totalPurchases: 210000,
          lastVisit: new Date('2025-05-04'),
          loyaltyPoints: 21,
          customerType: 'retail',
        },
        {
          id: 'cust_005',
          name: 'David Lee',
          email: 'david.lee@example.com',
          phone: '+1 234 567 8904',
          totalPurchases: 550000,
          lastVisit: new Date('2025-05-07'),
          loyaltyPoints: 55,
          notes: 'Prefers delivery orders',
          customerType: 'retail',
        },
        {
          id: 'cust_b2b_001',
          name: 'Sarah Anderson',
          email: 'sarah@techinnovations.com',
          phone: '+1 555 123 4567',
          totalPurchases: 5400000,
          lastVisit: new Date('2025-05-07'),
          loyaltyPoints: 0,
          notes: 'Monthly bulk orders, prefers bank transfer',
          customerType: 'b2b',
          businessName: 'Tech Innovations Inc.',
          taxId: 'TAX-B2B-001',
          creditLimit: 10000000,
        },
        {
          id: 'cust_b2b_002',
          name: 'Michael Chen',
          email: 'michael@globaltrading.com',
          phone: '+1 555 234 5678',
          totalPurchases: 8200000,
          lastVisit: new Date('2025-05-06'),
          loyaltyPoints: 0,
          notes: 'Large volume orders, net 30 payment terms',
          customerType: 'b2b',
          businessName: 'Global Trading Co.',
          taxId: 'TAX-B2B-002',
          creditLimit: 15000000,
        },
        {
          id: 'cust_b2b_003',
          name: 'Jennifer Williams',
          email: 'jennifer@retailchain.com',
          phone: '+1 555 345 6789',
          totalPurchases: 6750000,
          lastVisit: new Date('2025-05-05'),
          loyaltyPoints: 0,
          notes: 'Weekly bulk orders for retail chain',
          customerType: 'b2b',
          businessName: 'Retail Chain Solutions',
          taxId: 'TAX-B2B-003',
          creditLimit: 12000000,
        },
      ],

      employees: [
        {
          id: 'emp_001',
          name: 'Admin User',
          email: 'admin@business.com',
          role: 'admin',
          pin: '1234',
          active: true,
          hireDate: new Date('2024-01-01'),
        },
      ],
      cashDrawers: [],
      currentEmployeeId: null,
      activeCashDrawerId: null,
      isCheckedIn: false,

      notifications: [],
      unreadNotificationCount: 0,

      // Initialize tables with default values
      tables: [
        { id: 'table_1', number: '1', capacity: 4, status: 'available', section: 'Main Hall' },
        { id: 'table_2', number: '2', capacity: 2, status: 'available', section: 'Main Hall' },
        { id: 'table_3', number: '3', capacity: 6, status: 'available', section: 'Main Hall' },
        { id: 'table_4', number: '4', capacity: 4, status: 'available', section: 'Patio' },
        { id: 'table_5', number: '5', capacity: 8, status: 'available', section: 'VIP' },
      ],

      getBusinessConfig: () => {
        return getBusinessConfig(get().settings.businessType);
      },

      setCustomerName: name =>
        set(state => ({
          currentOrder: { ...state.currentOrder, customerName: name },
        })),

      setOrderType: type =>
        set(state => ({
          currentOrder: { ...state.currentOrder, orderType: type },
        })),

      addItemToOrder: (product, unit, quantity, options) =>
        set(state => {
          const existingItemIndex = state.currentOrder.items.findIndex(
            i =>
              i.productId === product.productId &&
              i.selectedUnit.unitId === unit.unitId &&
              i.isWholesale === options?.isWholesale
          );

          if (existingItemIndex >= 0) {
            const updatedItems = [...state.currentOrder.items];
            updatedItems[existingItemIndex].quantity += quantity;
            return {
              currentOrder: { ...state.currentOrder, items: updatedItems },
            };
          }

          const newItem: OrderItem = {
            productId: product.productId,
            variantId: product.variantId,
            productName: product.productName,
            variantName: product.variantName,
            selectedUnit: unit,
            quantity,
            imageUrl: product.imageUrl,
            isWholesale: options?.isWholesale || false,
          };

          return {
            currentOrder: {
              ...state.currentOrder,
              items: [...state.currentOrder.items, newItem],
            },
          };
        }),

      updateItemQuantity: (productId, unitId, quantity) =>
        set(state => ({
          currentOrder: {
            ...state.currentOrder,
            items: state.currentOrder.items.map(item =>
              item.productId === productId && item.selectedUnit.unitId === unitId ? { ...item, quantity } : item
            ),
          },
        })),

      removeItemFromOrder: (productId, unitId) =>
        set(state => ({
          currentOrder: {
            ...state.currentOrder,
            items: state.currentOrder.items.filter(
              item => !(item.productId === productId && item.selectedUnit.unitId === unitId)
            ),
          },
        })),

      resetOrder: () =>
        set({
          currentOrder: {
            customerName: '',
            orderType: 'takeaway',
            items: [],
            tableNumber: '',
            instructions: '',
            metadata: {},
          },
        }),

      completeOrder: (paymentMethod, discountAmount) =>
        set(state => {
          const totalWithTax = state.currentOrder.items.reduce((sum, item) => {
            const itemPrice = item.selectedUnit?.price ?? 0;
            return sum + itemPrice * item.quantity;
          }, 0);

          // Extract tax from total (prices are tax-inclusive)
          const taxes = (totalWithTax * state.settings.taxRate) / (100 + state.settings.taxRate);
          const subTotal = totalWithTax - taxes;

          const discount = discountAmount;
          const finalTotal = totalWithTax - discount;

          const newOrder: Order = {
            id: Date.now().toString(),
            orderNumber: `#${Math.floor(100000 + Math.random() * 900000)}`,
            customerName: state.currentOrder.customerName || 'Walk-in Customer',
            orderType: state.currentOrder.orderType,
            status: 'completed',
            items: state.currentOrder.items,
            createdAt: new Date(),
            subTotal: subTotal - discount,
            discount,
            taxes: taxes - (taxes * discount) / totalWithTax, // Proportional tax reduction
            total: finalTotal,
            paymentMethod,
            tableNumber: state.currentOrder.tableNumber,
            instructions: state.currentOrder.instructions,
            metadata: state.currentOrder.metadata,
          };

          if (state.activeCashDrawerId && paymentMethod === 'cash') {
            const updatedDrawers = state.cashDrawers.map(drawer =>
              drawer.id === state.activeCashDrawerId
                ? {
                    ...drawer,
                    transactions: [
                      ...drawer.transactions,
                      {
                        type: 'sale' as const,
                        amount: totalWithTax, // Use totalWithTax for the sale amount
                        timestamp: new Date(),
                        orderId: newOrder.id,
                      },
                    ],
                  }
                : drawer
            );

            return {
              orders: [newOrder, ...state.orders],
              lastCompletedOrder: newOrder,
              cashDrawers: updatedDrawers,
              currentOrder: {
                customerName: '',
                orderType: 'takeaway',
                items: [],
                tableNumber: '',
                instructions: '',
                metadata: {},
              },
            };
          }

          return {
            orders: [newOrder, ...state.orders],
            lastCompletedOrder: newOrder,
            currentOrder: {
              customerName: '',
              orderType: 'takeaway',
              items: [],
              tableNumber: '',
              instructions: '',
              metadata: {},
            },
          };
        }),

      updateOrderStatus: (orderId, status) =>
        set(state => ({
          orders: state.orders.map(order => (order.id === orderId ? { ...order, status } : order)),
        })),

      updateBusinessSettings: newSettings =>
        set(state => ({
          settings: { ...state.settings, ...newSettings },
        })),

      toggleSidebarItem: itemId =>
        set(state => ({
          settings: {
            ...state.settings,
            sidebarItems: state.settings.sidebarItems.map(item =>
              item.id === itemId ? { ...item, enabled: !item.enabled } : item
            ),
          },
        })),

      changeBusinessType: (type: BusinessType) =>
        set(state => {
          const config = getBusinessConfig(type);
          return {
            settings: {
              ...state.settings,
              businessType: type,
              taxRate: config.taxSettings.defaultRate,
              sidebarItems: getDefaultSidebarItems(type),
            },
          };
        }),
      updateReceiptConfig: config =>
        set(state => ({
          settings: {
            ...state.settings,
            receiptConfig: { ...state.settings.receiptConfig, ...config },
          },
        })),

      saveUnpaidOrder: discountAmount =>
        set(state => {
          const totalWithTax = state.currentOrder.items.reduce((sum, item) => {
            const itemPrice = item.selectedUnit?.price ?? 0;
            return sum + itemPrice * item.quantity;
          }, 0);

          // Extract tax from total
          const taxes = (totalWithTax * state.settings.taxRate) / (100 + state.settings.taxRate);
          const subTotal = totalWithTax - taxes;

          const discount = discountAmount;
          const finalTotal = totalWithTax - discount;

          const newOrder: Order = {
            id: Date.now().toString(),
            orderNumber: `#${Math.floor(100000 + Math.random() * 900000)}`,
            customerName: state.currentOrder.customerName || 'Walk-in Customer',
            orderType: state.currentOrder.orderType,
            status: 'waiting',
            items: state.currentOrder.items,
            createdAt: new Date(),
            subTotal: subTotal - discount,
            discount,
            taxes: taxes - (taxes * discount) / totalWithTax,
            total: finalTotal,
            paymentMethod: 'pending',
            tableNumber: state.currentOrder.tableNumber,
            instructions: state.currentOrder.instructions,
            metadata: state.currentOrder.metadata,
          };

          return {
            orders: [newOrder, ...state.orders],
            currentOrder: {
              customerName: '',
              orderType: 'takeaway',
              items: [],
              tableNumber: '',
              instructions: '',
              metadata: {},
            },
          };
        }),

      addCustomer: customer =>
        set(state => ({
          customers: [
            ...state.customers,
            {
              ...customer,
              id: `cust_${Date.now()}`,
              totalPurchases: 0,
              lastVisit: new Date(),
              loyaltyPoints: 0,
            },
          ],
        })),

      updateCustomer: (id, customer) =>
        set(state => ({
          customers: state.customers.map(c => (c.id === id ? { ...c, ...customer } : c)),
        })),

      deleteCustomer: id =>
        set(state => ({
          customers: state.customers.filter(c => c.id !== id),
        })),

      selectCustomer: customerId =>
        set(state => {
          const customer = state.customers.find(c => c.id === customerId);
          if (!customer) return state;

          return {
            currentOrder: {
              ...state.currentOrder,
              customerName: customer.name,
              customerId: customer.id,
            },
          };
        }),

      addEmployee: employee =>
        set(state => ({
          employees: [
            ...state.employees,
            {
              ...employee,
              id: `emp_${Date.now()}`,
            },
          ],
        })),

      updateEmployee: (id, employee) =>
        set(state => ({
          employees: state.employees.map(e => (e.id === id ? { ...e, ...employee } : e)),
        })),

      deleteEmployee: id =>
        set(state => ({
          employees: state.employees.filter(e => e.id !== id),
        })),

      loginEmployee: pin => {
        const state = get();
        const employee = state.employees.find(e => e.pin === pin && e.active);
        if (employee) {
          set({ currentEmployeeId: employee.id });
          return true;
        }
        return false;
      },

      logoutEmployee: () => set({ currentEmployeeId: null }),

      openCashDrawer: openingBalance =>
        set(state => {
          const employee = state.employees.find(e => e.id === state.currentEmployeeId);
          const newDrawer: CashDrawer = {
            id: `drawer_${Date.now()}`,
            employeeId: state.currentEmployeeId || 'unknown',
            employeeName: employee?.name || 'Unknown',
            openedAt: new Date(),
            openingBalance,
            status: 'open',
            transactions: [],
          };

          return {
            cashDrawers: [...state.cashDrawers, newDrawer],
            activeCashDrawerId: newDrawer.id,
          };
        }),

      closeCashDrawer: closingBalance =>
        set(state => {
          if (!state.activeCashDrawerId) return state;

          const drawer = state.cashDrawers.find(d => d.id === state.activeCashDrawerId);
          if (!drawer) return state;

          const totalSales = drawer.transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.amount, 0);
          const totalCashIn = drawer.transactions
            .filter(t => t.type === 'cash-in')
            .reduce((sum, t) => sum + t.amount, 0);
          const totalCashOut = drawer.transactions
            .filter(t => t.type === 'cash-out')
            .reduce((sum, t) => sum + t.amount, 0);
          const totalRefunds = drawer.transactions
            .filter(t => t.type === 'refund')
            .reduce((sum, t) => sum + t.amount, 0);

          const expectedBalance = drawer.openingBalance + totalSales + totalCashIn - totalCashOut - totalRefunds;

          const updatedDrawers = state.cashDrawers.map(d =>
            d.id === state.activeCashDrawerId
              ? {
                  ...d,
                  closedAt: new Date(),
                  closingBalance,
                  expectedBalance,
                  difference: closingBalance - expectedBalance,
                  status: 'closed' as const,
                }
              : d
          );

          return {
            cashDrawers: updatedDrawers,
            activeCashDrawerId: null,
          };
        }),

      addCashTransaction: (type, amount, notes) =>
        set(state => {
          if (!state.activeCashDrawerId) return state;

          const updatedDrawers = state.cashDrawers.map(drawer =>
            drawer.id === state.activeCashDrawerId
              ? {
                  ...drawer,
                  transactions: [
                    ...drawer.transactions,
                    {
                      type,
                      amount,
                      timestamp: new Date(),
                      notes,
                    },
                  ],
                }
              : drawer
          );

          return { cashDrawers: updatedDrawers };
        }),

      updateProductStock: (productId, newStock) =>
        set(state => ({
          products: state.products.map(p => (p.productId === productId ? { ...p, stock: newStock } : p)),
        })),

      getLowStockProducts: () => {
        const state = get();
        return state.products
          .filter(p => p.stock <= state.settings.lowStockThreshold)
          .map(p => ({
            productId: p.productId,
            productName: p.productName,
            currentStock: p.stock,
            minimumStock: state.settings.lowStockThreshold,
            alertType: p.stock === 0 ? ('out' as const) : ('low' as const),
          }));
      },

      getDailySummary: date => {
        const state = get();
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const dayOrders = state.orders.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= startOfDay && orderDate <= endOfDay && order.status === 'completed';
        });

        const totalSales = dayOrders.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = dayOrders.length;
        const totalTax = dayOrders.reduce((sum, order) => sum + order.taxes, 0);
        const totalDiscount = dayOrders.reduce((sum, order) => sum + order.discount, 0);

        const paymentMethods: Record<string, number> = {};
        dayOrders.forEach(order => {
          paymentMethods[order.paymentMethod] = (paymentMethods[order.paymentMethod] || 0) + order.total;
        });

        const productStats: Record<string, { name: string; quantity: number; revenue: number }> = {};
        dayOrders.forEach(order => {
          order.items.forEach(item => {
            if (!productStats[item.productId]) {
              productStats[item.productId] = {
                name: item.productName,
                quantity: 0,
                revenue: 0,
              };
            }
            productStats[item.productId].quantity += item.quantity;
            productStats[item.productId].revenue += (item.selectedUnit?.price ?? 0) * item.quantity;
          });
        });

        const topProducts = Object.entries(productStats)
          .map(([productId, stats]) => ({
            productId,
            productName: stats.name,
            quantity: stats.quantity,
            revenue: stats.revenue,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        return {
          date,
          totalSales,
          totalOrders,
          totalTax,
          totalDiscount,
          paymentMethods,
          topProducts,
        };
      },

      getTopProducts: limit => {
        const state = get();
        const productStats: Record<string, { name: string; quantity: number; revenue: number }> = {};

        state.orders
          .filter(order => order.status === 'completed')
          .forEach(order => {
            order.items.forEach(item => {
              if (!productStats[item.productId]) {
                productStats[item.productId] = {
                  name: item.productName,
                  quantity: 0,
                  revenue: 0,
                };
              }
              productStats[item.productId].quantity += item.quantity;
              productStats[item.productId].revenue += (item.selectedUnit?.price ?? 0) * item.quantity;
            });
          });

        return Object.entries(productStats)
          .map(([productId, stats]) => ({
            productId,
            productName: stats.name,
            quantity: stats.quantity,
            revenue: stats.revenue,
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, limit);
      },

      printReceipt: orderId => {
        const state = get();
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return;

        console.log(' Printing receipt for order:', orderId);
        if (window && 'print' in window) {
          window.print();
        }
      },

      emailReceipt: (orderId, email) => {
        const state = get();
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return;

        console.log(' Emailing receipt for order:', orderId, 'to:', email);
        // In a real implementation, this would call an API to send the email
      },

      addPrinter: (printer: Omit<PrinterConfig, 'id'>) =>
        set(state => {
          const newPrinter: PrinterConfig = {
            ...printer,
            id: `printer_${Date.now()}`,
          };

          // If this is set as default, unset other defaults
          let printers = state.settings.printers;
          if (newPrinter.isDefault) {
            printers = printers.map(p => ({ ...p, isDefault: false }));
          }

          return {
            settings: {
              ...state.settings,
              printers: [...printers, newPrinter],
            },
          };
        }),

      updatePrinter: (id: string, printer: Partial<PrinterConfig>) =>
        set(state => {
          let printers = state.settings.printers.map(p => (p.id === id ? { ...p, ...printer } : p));

          // If this printer is being set as default, unset others
          if (printer.isDefault === true) {
            printers = printers.map(p => (p.id === id ? { ...p, isDefault: true } : { ...p, isDefault: false }));
          }

          return {
            settings: {
              ...state.settings,
              printers,
            },
          };
        }),

      deletePrinter: (id: string) =>
        set(state => ({
          settings: {
            ...state.settings,
            printers: state.settings.printers.filter(p => p.id !== id),
          },
        })),

      setDefaultPrinter: (id: string) =>
        set(state => ({
          settings: {
            ...state.settings,
            printers: state.settings.printers.map(p => ({
              ...p,
              isDefault: p.id === id,
            })),
          },
        })),

      updateThemeConfig: (config: Partial<ThemeConfig>) =>
        set(state => ({
          settings: {
            ...state.settings,
            themeConfig: { ...state.settings.themeConfig, ...config },
          },
        })),

      updateSecurityConfig: (config: Partial<SecurityConfig>) =>
        set(state => ({
          settings: {
            ...state.settings,
            securityConfig: { ...state.settings.securityConfig, ...config },
          },
        })),

      updateApiSyncConfig: (config: Partial<ApiSyncConfig>) =>
        set(state => ({
          settings: {
            ...state.settings,
            apiSyncConfig: { ...state.settings.apiSyncConfig, ...config },
          },
        })),

      addNotification: notification =>
        set(state => {
          const newNotification: Notification = {
            ...notification,
            id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            read: false,
          };

          return {
            notifications: [newNotification, ...state.notifications],
            unreadNotificationCount: state.unreadNotificationCount + 1,
          };
        }),

      markNotificationAsRead: id =>
        set(state => {
          const notification = state.notifications.find(n => n.id === id);
          if (!notification || notification.read) return state;

          return {
            notifications: state.notifications.map(n => (n.id === id ? { ...n, read: true } : n)),
            unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1),
          };
        }),

      markAllNotificationsAsRead: () =>
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, read: true })),
          unreadNotificationCount: 0,
        })),

      deleteNotification: id =>
        set(state => {
          const notification = state.notifications.find(n => n.id === id);
          const wasUnread = notification && !notification.read;

          return {
            notifications: state.notifications.filter(n => n.id !== id),
            unreadNotificationCount: wasUnread
              ? Math.max(0, state.unreadNotificationCount - 1)
              : state.unreadNotificationCount,
          };
        }),

      clearAllNotifications: () =>
        set({
          notifications: [],
          unreadNotificationCount: 0,
        }),

      updateNotificationSettings: settings =>
        set(state => ({
          settings: {
            ...state.settings,
            notificationSettings: { ...state.settings.notificationSettings, ...settings },
          },
        })),

      simulateOnlineOrder: () => {
        const state = get();
        if (!state.settings.notificationSettings?.enabled || !state.settings.notificationSettings?.showOnlineOrders) {
          return;
        }

        const orderNumber = `#${Math.floor(100000 + Math.random() * 900000)}`;
        get().addNotification({
          type: 'order',
          priority: 'high',
          title: 'New Online Order',
          message: `Order ${orderNumber} has been placed. Customer: John Doe`,
          soundEnabled: state.settings.notificationSettings?.soundEnabled,
          autoClose: true,
          duration: state.settings.notificationSettings?.autoCloseDelay,
          metadata: {
            orderNumber,
            customerName: 'John Doe',
            orderType: 'online',
          },
        });
      },

      checkLowStockAlerts: () => {
        const state = get();
        if (!state.settings.notificationSettings?.enabled || !state.settings.notificationSettings?.showLowStock) {
          return;
        }

        const lowStockProducts = state.getLowStockProducts();
        lowStockProducts.forEach(alert => {
          const existingNotification = state.notifications.find(
            n => n.type === 'stock' && n.metadata?.productId === alert.productId && !n.read
          );

          if (!existingNotification) {
            get().addNotification({
              type: 'stock',
              priority: alert.alertType === 'out' ? 'high' : 'medium',
              title: alert.alertType === 'out' ? 'Out of Stock' : 'Low Stock Alert',
              message: `${alert.productName} - Current stock: ${alert.currentStock}`,
              soundEnabled: false,
              autoClose: false,
              metadata: {
                productId: alert.productId,
                currentStock: alert.currentStock,
                minimumStock: alert.minimumStock,
              },
            });
          }
        });
      },

      syncDataToApi: async () => {
        const state = get();
        const { apiSyncConfig } = state.settings;

        if (!apiSyncConfig.enabled || !apiSyncConfig.apiEndpoint) {
          console.warn(' API sync is not configured');
          return { success: false, error: 'API sync not configured' };
        }

        try {
          const dataToSync: any = {};

          if (apiSyncConfig.syncOrders) {
            dataToSync.orders = state.orders;
          }
          if (apiSyncConfig.syncInventory) {
            dataToSync.products = state.products;
          }
          if (apiSyncConfig.syncCustomers) {
            dataToSync.customers = state.customers;
          }
          if (apiSyncConfig.syncEmployees) {
            dataToSync.employees = state.employees;
          }

          const response = await fetch(apiSyncConfig.apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiSyncConfig.apiKey}`,
            },
            body: JSON.stringify({
              businessId: state.settings.businessName,
              timestamp: new Date().toISOString(),
              data: dataToSync,
            }),
          });

          if (!response.ok) {
            throw new Error(`API sync failed: ${response.statusText}`);
          }

          set(state => ({
            settings: {
              ...state.settings,
              apiSyncConfig: {
                ...state.settings.apiSyncConfig,
                lastSyncTimestamp: new Date(),
              },
            },
          }));

          console.log(' Data synced successfully to API');
          return { success: true };
        } catch (error: any) {
          console.error(' API sync error:', error);
          return { success: false, error: error.message };
        }
      },

      setTableNumber: tableNumber =>
        set(state => ({
          currentOrder: { ...state.currentOrder, tableNumber },
        })),

      setInstructions: instructions =>
        set(state => ({
          currentOrder: { ...state.currentOrder, instructions },
        })),

      // Implementations for table management
      addTable: table =>
        set(state => ({
          tables: [
            ...state.tables,
            {
              ...table,
              id: `table_${Date.now()}`,
            },
          ],
        })),

      updateTable: (id, table) =>
        set(state => ({
          tables: state.tables.map(t => (t.id === id ? { ...t, ...table } : t)),
        })),

      deleteTable: id =>
        set(state => ({
          tables: state.tables.filter(t => t.id !== id),
        })),

      setTableStatus: (id, status) =>
        set(state => ({
          tables: state.tables.map(t => (t.id === id ? { ...t, status } : t)),
        })),

      assignOrderToTable: (tableId, orderId) =>
        set(state => ({
          tables: state.tables.map(t =>
            t.id === tableId ? { ...t, status: 'occupied' as const, currentOrderId: orderId } : t
          ),
        })),

      clearTableOrder: tableId =>
        set(state => ({
          tables: state.tables.map(t =>
            t.id === tableId ? { ...t, status: 'available' as const, currentOrderId: undefined } : t
          ),
        })),
    }),
    {
      name: 'dealio-pos-storage',
      storage: createJSONStorage(() => localStorage),
      skipHydration: false,
      partialize: state => ({
        currentOrder: state.currentOrder,
        orders: state.orders,
        products: state.products,
        settings: state.settings,
        lastCompletedOrder: state.lastCompletedOrder,
        customers: state.customers,
        employees: state.employees,
        cashDrawers: state.cashDrawers,
        currentEmployeeId: state.currentEmployeeId,
        activeCashDrawerId: state.activeCashDrawerId,
        notifications: state.notifications, // Added notifications to persistence
        unreadNotificationCount: state.unreadNotificationCount,
        // Add tables to persistence
        tables: state.tables,
      }),
    }
  )
);
