export type BusinessType =
  | "restaurant"
  | "cafe"
  | "retail"
  | "wholesale"
  | "pharmacy"
  | "bookshop"
  | "grocery"
  | "bakery"
  | "bar"
  | "clothing"
  | "electronics"
  | "hardware"

export interface BusinessConfig {
  type: BusinessType
  label: string
  description: string
  features: {
    tableManagement: boolean
    deliveryTracking: boolean
    prescriptionManagement: boolean
    bookIsbn: boolean
    batchTracking: boolean
    expiryTracking: boolean
    sizeVariants: boolean
    warrantyTracking: boolean
    loyaltyProgram: boolean
    onlineOrdering: boolean
    kitchenDisplay: boolean
    ageVerification: boolean
    showOrdersList: boolean
    b2bBulkPurchase: boolean
  }
  orderTypes: Array<"takeaway" | "delivery" | "dine-in" | "pickup" | "online">
  defaultCategories: string[]
  requiredFields: {
    customerName: boolean
    customerPhone: boolean
    customerAddress: boolean
    prescription: boolean
    doctorName: boolean
  }
  taxSettings: {
    defaultRate: number
    taxLabel: string
  }
}

export const businessConfigs: Record<BusinessType, BusinessConfig> = {
  restaurant: {
    type: "restaurant",
    label: "Restaurant",
    description: "Full-service restaurant with dine-in, takeaway, and delivery",
    features: {
      tableManagement: true,
      deliveryTracking: true,
      prescriptionManagement: false,
      bookIsbn: false,
      batchTracking: false,
      expiryTracking: false,
      sizeVariants: false,
      warrantyTracking: false,
      loyaltyProgram: true,
      onlineOrdering: true,
      kitchenDisplay: true,
      ageVerification: false,
      showOrdersList: true,
      b2bBulkPurchase: false,
    },
    orderTypes: ["dine-in", "takeaway", "delivery"],
    defaultCategories: ["Appetizer", "Main Dish", "Beverage", "Dessert", "Snack"],
    requiredFields: {
      customerName: true,
      customerPhone: false,
      customerAddress: false,
      prescription: false,
      doctorName: false,
    },
    taxSettings: {
      defaultRate: 10,
      taxLabel: "Service Tax",
    },
  },
  cafe: {
    type: "cafe",
    label: "Cafe",
    description: "Coffee shop and cafe with quick service",
    features: {
      tableManagement: true,
      deliveryTracking: true,
      prescriptionManagement: false,
      bookIsbn: false,
      batchTracking: false,
      expiryTracking: false,
      sizeVariants: true,
      warrantyTracking: false,
      loyaltyProgram: true,
      onlineOrdering: true,
      kitchenDisplay: false,
      ageVerification: false,
      showOrdersList: true,
      b2bBulkPurchase: false,
    },
    orderTypes: ["dine-in", "takeaway", "delivery"],
    defaultCategories: ["Coffee", "Tea", "Pastry", "Sandwich", "Smoothie"],
    requiredFields: {
      customerName: true,
      customerPhone: false,
      customerAddress: false,
      prescription: false,
      doctorName: false,
    },
    taxSettings: {
      defaultRate: 5,
      taxLabel: "Sales Tax",
    },
  },
  retail: {
    type: "retail",
    label: "Retail Store",
    description: "General retail store for various products",
    features: {
      tableManagement: false,
      deliveryTracking: true,
      prescriptionManagement: false,
      bookIsbn: false,
      batchTracking: true,
      expiryTracking: false,
      sizeVariants: true,
      warrantyTracking: false,
      loyaltyProgram: true,
      onlineOrdering: true,
      kitchenDisplay: false,
      ageVerification: false,
      showOrdersList: false,
      b2bBulkPurchase: true,
    },
    orderTypes: ["pickup", "delivery", "online"],
    defaultCategories: ["Clothing", "Accessories", "Footwear", "Home", "Beauty"],
    requiredFields: {
      customerName: false,
      customerPhone: true,
      customerAddress: false,
      prescription: false,
      doctorName: false,
    },
    taxSettings: {
      defaultRate: 7,
      taxLabel: "Sales Tax",
    },
  },
  wholesale: {
    type: "wholesale",
    label: "Wholesale",
    description: "Bulk sales and wholesale distribution",
    features: {
      tableManagement: false,
      deliveryTracking: true,
      prescriptionManagement: false,
      bookIsbn: false,
      batchTracking: true,
      expiryTracking: true,
      sizeVariants: false,
      warrantyTracking: false,
      loyaltyProgram: false,
      onlineOrdering: true,
      kitchenDisplay: false,
      ageVerification: false,
      showOrdersList: false,
      b2bBulkPurchase: true,
    },
    orderTypes: ["pickup", "delivery"],
    defaultCategories: ["Electronics", "Food Items", "Household", "Office Supplies", "Industrial"],
    requiredFields: {
      customerName: true,
      customerPhone: true,
      customerAddress: true,
      prescription: false,
      doctorName: false,
    },
    taxSettings: {
      defaultRate: 0,
      taxLabel: "VAT",
    },
  },
  pharmacy: {
    type: "pharmacy",
    label: "Pharmacy",
    description: "Medical pharmacy with prescription management",
    features: {
      tableManagement: false,
      deliveryTracking: true,
      prescriptionManagement: true,
      bookIsbn: false,
      batchTracking: true,
      expiryTracking: true,
      sizeVariants: false,
      warrantyTracking: false,
      loyaltyProgram: true,
      onlineOrdering: false,
      kitchenDisplay: false,
      ageVerification: false,
      showOrdersList: false,
      b2bBulkPurchase: false,
    },
    orderTypes: ["pickup", "delivery"],
    defaultCategories: ["Prescription", "OTC Medicine", "Vitamins", "First Aid", "Personal Care"],
    requiredFields: {
      customerName: true,
      customerPhone: true,
      customerAddress: false,
      prescription: true,
      doctorName: true,
    },
    taxSettings: {
      defaultRate: 0,
      taxLabel: "Medical Tax",
    },
  },
  bookshop: {
    type: "bookshop",
    label: "Bookshop",
    description: "Bookstore with ISBN tracking",
    features: {
      tableManagement: false,
      deliveryTracking: true,
      prescriptionManagement: false,
      bookIsbn: true,
      batchTracking: false,
      expiryTracking: false,
      sizeVariants: false,
      warrantyTracking: false,
      loyaltyProgram: true,
      onlineOrdering: true,
      kitchenDisplay: false,
      ageVerification: false,
      showOrdersList: false,
      b2bBulkPurchase: false,
    },
    orderTypes: ["pickup", "delivery", "online"],
    defaultCategories: ["Fiction", "Non-Fiction", "Educational", "Children", "Magazine"],
    requiredFields: {
      customerName: false,
      customerPhone: false,
      customerAddress: false,
      prescription: false,
      doctorName: false,
    },
    taxSettings: {
      defaultRate: 0,
      taxLabel: "Sales Tax",
    },
  },
  grocery: {
    type: "grocery",
    label: "Grocery Store",
    description: "Supermarket and grocery store",
    features: {
      tableManagement: false,
      deliveryTracking: true,
      prescriptionManagement: false,
      bookIsbn: false,
      batchTracking: true,
      expiryTracking: true,
      sizeVariants: false,
      warrantyTracking: false,
      loyaltyProgram: true,
      onlineOrdering: true,
      kitchenDisplay: false,
      ageVerification: false,
      showOrdersList: false,
      b2bBulkPurchase: true,
    },
    orderTypes: ["pickup", "delivery", "online"],
    defaultCategories: ["Fruits", "Vegetables", "Dairy", "Meat", "Bakery", "Beverages"],
    requiredFields: {
      customerName: false,
      customerPhone: false,
      customerAddress: false,
      prescription: false,
      doctorName: false,
    },
    taxSettings: {
      defaultRate: 5,
      taxLabel: "Sales Tax",
    },
  },
  bakery: {
    type: "bakery",
    label: "Bakery",
    description: "Bakery with fresh baked goods",
    features: {
      tableManagement: false,
      deliveryTracking: true,
      prescriptionManagement: false,
      bookIsbn: false,
      batchTracking: true,
      expiryTracking: true,
      sizeVariants: false,
      warrantyTracking: false,
      loyaltyProgram: true,
      onlineOrdering: true,
      kitchenDisplay: false,
      ageVerification: false,
      showOrdersList: true,
      b2bBulkPurchase: false,
    },
    orderTypes: ["pickup", "delivery", "online"],
    defaultCategories: ["Bread", "Pastries", "Cakes", "Cookies", "Pies"],
    requiredFields: {
      customerName: false,
      customerPhone: true,
      customerAddress: false,
      prescription: false,
      doctorName: false,
    },
    taxSettings: {
      defaultRate: 5,
      taxLabel: "Sales Tax",
    },
  },
  bar: {
    type: "bar",
    label: "Bar / Pub",
    description: "Bar with age verification",
    features: {
      tableManagement: true,
      deliveryTracking: false,
      prescriptionManagement: false,
      bookIsbn: false,
      batchTracking: false,
      expiryTracking: false,
      sizeVariants: true,
      warrantyTracking: false,
      loyaltyProgram: true,
      onlineOrdering: false,
      kitchenDisplay: true,
      ageVerification: true,
      showOrdersList: true,
      b2bBulkPurchase: false,
    },
    orderTypes: ["dine-in", "takeaway"],
    defaultCategories: ["Beer", "Wine", "Spirits", "Cocktails", "Appetizers", "Food"],
    requiredFields: {
      customerName: true,
      customerPhone: false,
      customerAddress: false,
      prescription: false,
      doctorName: false,
    },
    taxSettings: {
      defaultRate: 15,
      taxLabel: "Alcohol Tax",
    },
  },
  clothing: {
    type: "clothing",
    label: "Clothing Store",
    description: "Fashion and clothing retail",
    features: {
      tableManagement: false,
      deliveryTracking: true,
      prescriptionManagement: false,
      bookIsbn: false,
      batchTracking: true,
      expiryTracking: false,
      sizeVariants: true,
      warrantyTracking: false,
      loyaltyProgram: true,
      onlineOrdering: true,
      kitchenDisplay: false,
      ageVerification: false,
      showOrdersList: false,
      b2bBulkPurchase: false,
    },
    orderTypes: ["pickup", "delivery", "online"],
    defaultCategories: ["Men", "Women", "Kids", "Accessories", "Shoes"],
    requiredFields: {
      customerName: false,
      customerPhone: true,
      customerAddress: false,
      prescription: false,
      doctorName: false,
    },
    taxSettings: {
      defaultRate: 7,
      taxLabel: "Sales Tax",
    },
  },
  electronics: {
    type: "electronics",
    label: "Electronics Store",
    description: "Electronics and gadgets store",
    features: {
      tableManagement: false,
      deliveryTracking: true,
      prescriptionManagement: false,
      bookIsbn: false,
      batchTracking: true,
      expiryTracking: false,
      sizeVariants: false,
      warrantyTracking: true,
      loyaltyProgram: true,
      onlineOrdering: true,
      kitchenDisplay: false,
      ageVerification: false,
      showOrdersList: false,
      b2bBulkPurchase: false,
    },
    orderTypes: ["pickup", "delivery", "online"],
    defaultCategories: ["Phones", "Laptops", "Accessories", "Audio", "Cameras"],
    requiredFields: {
      customerName: true,
      customerPhone: true,
      customerAddress: false,
      prescription: false,
      doctorName: false,
    },
    taxSettings: {
      defaultRate: 10,
      taxLabel: "Sales Tax",
    },
  },
  hardware: {
    type: "hardware",
    label: "Hardware Store",
    description: "Tools and hardware supplies",
    features: {
      tableManagement: false,
      deliveryTracking: true,
      prescriptionManagement: false,
      bookIsbn: false,
      batchTracking: true,
      expiryTracking: false,
      sizeVariants: false,
      warrantyTracking: true,
      loyaltyProgram: false,
      onlineOrdering: true,
      kitchenDisplay: false,
      ageVerification: false,
      showOrdersList: false,
      b2bBulkPurchase: true,
    },
    orderTypes: ["pickup", "delivery"],
    defaultCategories: ["Tools", "Plumbing", "Electrical", "Paint", "Lumber"],
    requiredFields: {
      customerName: false,
      customerPhone: false,
      customerAddress: false,
      prescription: false,
      doctorName: false,
    },
    taxSettings: {
      defaultRate: 7,
      taxLabel: "Sales Tax",
    },
  },
}

export function getBusinessConfig(type: BusinessType): BusinessConfig {
  return businessConfigs[type] || businessConfigs.retail
}

interface SidebarItem {
  id: string
  label: string
  icon: string
  enabled: boolean
}

export const getDefaultSidebarItems = (businessType: BusinessType): SidebarItem[] => {
  const config = getBusinessConfig(businessType)

  const items: SidebarItem[] = [
    { id: "order", label: "Order", icon: "ShoppingBag", enabled: true },
    { id: "inventory", label: "Inventory", icon: "Package", enabled: true },
    { id: "history", label: "History", icon: "History", enabled: true },
    { id: "analytic", label: "Analytics", icon: "BarChart3", enabled: true },
  ]

  items.push({ id: "customers", label: "Customers", icon: "Users", enabled: true })

  if (config.features.tableManagement) {
    items.push({ id: "manage-table", label: "Manage Tables", icon: "Table", enabled: true })
  }

  if (config.features.kitchenDisplay) {
    items.push({ id: "kitchen-display", label: "Kitchen Display", icon: "ChefHat", enabled: true })
  }

  if (config.features.prescriptionManagement) {
    items.push({ id: "prescriptions", label: "Prescriptions", icon: "FileText", enabled: true })
  }

  if (config.features.warrantyTracking) {
    items.push({ id: "warranty", label: "Warranty", icon: "Shield", enabled: true })
  }

  if (businessType === "retail" || businessType === "wholesale") {
    items.push({ id: "till-management", label: "Till Management", icon: "Calculator", enabled: true })
  }

  if (config.features.loyaltyProgram) {
    items.push({ id: "loyalty", label: "Loyalty Program", icon: "Gift", enabled: true })
  }

  items.push(
    { id: "withdrawl", label: "Cash Drawer", icon: "DollarSign", enabled: true },
    { id: "payment", label: "Payment", icon: "CreditCard", enabled: true },
  )

  return items
}
