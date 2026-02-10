'use client';

import { useState, memo, useMemo, useEffect } from 'react';
import { useForm, useFieldArray, Controller, useWatch, Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  Check,
  ChevronsUpDown,
  Search,
} from 'lucide-react';
import { useFormattedCurrency, cn } from '@/lib/utils';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { FulfillmentType, TransactionType, useCreateOrder } from '@/hooks/sales';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CreateOrderSchema, OrderFormValues, TransactionStatus } from '@/lib/validation/transactions';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CustomerSelect } from '@/components/customer.select';
import { usePosProducts } from '@/hooks/products';
import { useAuthStore } from '@/store/pos-auth-store';
import { useDebounce } from 'use-debounce';
import OrderSuccessView from '@/components/order-success';
import { usePosPricingSync, useBatchPricing } from '@/hooks/use-pricing-sync';
import { notify } from '@/lib/notify';

// --- TYPES ---

export interface SellableUnit {
  unitId: string;
  unitName: string;
  price: number;
  conversion: number;
  isBaseUnit: boolean;
}

export interface FlattenedProductVariant {
  productId: string;
  productName: string;
  imageUrl?: string;
  variantId: string;
  variantName: string;
  sku: string;
  barcode?: string;
  stock: number;
  sellableUnits: SellableUnit[];
}

// --- UTILS ---

const NO_SPINNER_CLASS = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

const blockInvalidChar = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (["e", "E", "+", "-"].includes(e.key)) {
    e.preventDefault();
  }
};

// --- SUB-COMPONENTS ---

interface ProductSearchComboboxProps {
  value?: string;
  onSelect: (product: FlattenedProductVariant) => void;
  error?: boolean;
}

function ProductSearchCombobox({ value, onSelect, error }: ProductSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 500);
  
  const { 
    products: data,
    isSyncing
  } = usePosProducts({ 
    search: debouncedSearch, 
    category: "all", 
    enabled: open 
  });

  const isSearching = search !== debouncedSearch || isSyncing;

  const products: FlattenedProductVariant[] = useMemo(() => {
    
    return data?.flatMap((product: any) => 
      (product.variants || []).map((variant:any) => ({
        productId: product.productId,
        productName: product.name,
        imageUrl: product.imageUrl,
        variantId: variant.variantId,
        variantName: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        stock: variant.stock,
        sellableUnits: variant.sellableUnits || []
      }))
    )
  }, [data]);
  
  const selectedProduct = products.find(p => p.variantId === value);
  const displayText = selectedProduct 
    ? `${selectedProduct.productName} - ${selectedProduct.variantName}` 
    : (value ? "Item Selected (Search to change)" : "Select product...");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal truncate",
            !value && "text-muted-foreground",
            error && "border-red-500 ring-red-500/20"
          )}
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder="Search by name, SKU, or barcode..." 
              value={search}
              onValueChange={setSearch}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            {isSearching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          
          <CommandList>
            {!isSearching && products.length === 0 && (
              <CommandEmpty>No products found.</CommandEmpty>
            )}

            <CommandGroup>
              {products.map((product, index) => {
                //  const isLast = index === products.length - 1;
                 return (
                  <CommandItem
                    key={`${product.variantId}-${index}`}
                    value={product.variantId}
                    onSelect={() => {
                      if (product.stock <= 0) {
                        notify.error(`Item Out of Stock`, { duration: 2000 });
                        return;
                      }
                      onSelect(product);
                      setOpen(false);
                    }}
                    className={cn(
                      "cursor-pointer",
                      product.stock <= 0 && "opacity-50"
                    )}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === product.variantId ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                         <span className={cn("font-medium", product.stock <= 0 && "text-muted-foreground line-through")}>
                           {product.productName}
                         </span>
                         {product.stock <= 0 && (
                           <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">
                             Out of Stock
                           </span>
                         )}
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                          <span className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{product.variantName}</span>
                          <span>•</span>
                          <span className={product.stock < 5 ? "text-amber-500 font-medium" : ""}>
                            Stock: {product.stock}
                          </span>
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const UnitSelect = memo(function UnitSelect({ units, value, onValueChange, disabled }: {
  units: SellableUnit[];
  value: string;
  onValueChange: (unitId: string, price: number) => void;
  disabled?: boolean;
}) {
  const handleChange = (newUnitId: string) => {
    const selectedUnit = units.find(u => u.unitId === newUnitId);
    if (selectedUnit) {
      onValueChange(newUnitId, selectedUnit.price);
    }
  };

  return (
    <Select value={value || ''} onValueChange={handleChange} disabled={disabled || units.length === 0}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Unit" />
      </SelectTrigger>
      <SelectContent>
        {units.map((unit) => (
          <SelectItem key={unit.unitId} value={unit.unitId}>
            {unit.unitName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});

// 2. Memoized Row Component
const OrderItemRow = memo(({ 
  index, 
  control, 
  register, 
  remove, 
  setValue, 
  errors,
  formatCurrency,
  customerId,
  priceMap
}: {
  index: number;
  control: Control<any>;
  register: any;
  remove: (index: number) => void;
  setValue: any;
  errors: any;
  formatCurrency: (val: number) => string;
  customerId?: string;
  priceMap: Record<string, number>; 
}) => {
  const rowValues = useWatch({
    control,
    name: `items.${index}`,
  });

  const availableUnits = rowValues?._availableUnits || [];
  const rowTotal = (rowValues?.quantity || 0) * (rowValues?.unitPrice || 0);

  // --- AUTO-UPDATE PRICE LOIC ---
  // Watches for changes in Product, Unit, or Customer and updates price accordingly
  useEffect(() => {
    if (!rowValues?.variantId || !rowValues?.sellingUnitId) return;

    // 1. Find Standard Price from the available units on the row
    const standardUnit = rowValues._availableUnits?.find((u: any) => u.unitId === rowValues.sellingUnitId);
    if (!standardUnit) return; // Can't pricing without unit data

    let finalPrice = standardUnit.price;

    // 2. Check for Custom/Customer Price
    const key = `${rowValues.variantId}:${rowValues.sellingUnitId ?? 'null'}`;
    const customPrice = priceMap[key];
    
    // const customPrice = resolveCustomerPrice(pricingData, customerId, rowValues.variantId, rowValues.sellingUnitId);
    if (typeof customPrice === 'number') {
      finalPrice = customPrice;
    }

    // 3. Update if different (prevent loops)
    // We utilize a small epsilon for float comparison just in case, though usually exact match works for currency
    if (Math.abs((rowValues.unitPrice || 0) - finalPrice) > 0.001) {
       setValue(`items.${index}.unitPrice`, finalPrice);
    }

  }, [
    rowValues?.variantId, 
    rowValues?.sellingUnitId, 
    customerId, 
    priceMap, 
    // We deliberately exclude unitPrice to avoid circular dependency, 
    // but include _availableUnits to ensure we have base data
    JSON.stringify(rowValues?._availableUnits) 
  ]);

  return (
    <tr className="group hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
      <td className="px-6 py-4 text-xs text-zinc-400 font-mono align-top pt-6">{index + 1}</td>
      
      {/* PRODUCT */}
      <td className="px-6 py-4 align-top">
        <Controller
          control={control}
          name={`items.${index}.variantId`}
          render={({ field }) => (
            <ProductSearchCombobox 
              value={field.value}
              error={!!errors.items?.[index]?.variantId}
              onSelect={(product) => {
                field.onChange(product.variantId);
                const defaultUnit = product.sellableUnits.find(u => u.isBaseUnit) || product.sellableUnits[0];
                
                setValue(`items.${index}.sellingUnitId`, defaultUnit?.unitId || undefined);
                // We set an initial price, but the useEffect will immediately verify/override it if a custom price applies
                setValue(`items.${index}.unitPrice`, defaultUnit?.price || 0);
                setValue(`items.${index}._availableUnits`, product.sellableUnits);
                setValue(`items.${index}._maxStock`, product.stock); // Track max stock
              }}
            />
          )}
        />
        {errors.items?.[index]?.variantId && (
          <div className="mt-1 text-[10px] text-red-500">Required</div>
        )}
      </td>

      {/* UNIT */}
      <td className="px-6 py-4 align-top">
        <Controller
          control={control}
          name={`items.${index}.sellingUnitId`}
          render={({ field }) => (
            <UnitSelect 
              value={field.value}
              units={availableUnits}
              disabled={!rowValues.variantId}
              onValueChange={(unitId, price) => {
                field.onChange(unitId);
                // Again, set standard price initially; useEffect handles overrides
                setValue(`items.${index}.unitPrice`, price);
              }}
            />
          )}
        />
        {errors.items?.[index]?.sellingUnitId && (
          <div className="mt-1 text-[10px] text-red-500">Required</div>
        )}
      </td>

      {/* QUANTITY */}
      <td className="px-6 py-4 align-top">
        <Input
          type="number"
          min="1"
          onKeyDown={blockInvalidChar}
          {...register(`items.${index}.quantity`, { 
            valueAsNumber: true,
          })}
          className={cn(
            "h-10 text-center", 
            NO_SPINNER_CLASS,
            errors.items?.[index]?.quantity && "border-red-500 focus-visible:ring-red-500"
          )}
        />
        {errors.items?.[index]?.quantity && (
          <div className="mt-1 text-[10px] text-red-500">{errors.items?.[index]?.quantity.message}</div>
        )}
      </td>

      {/* TOTAL */}
      <td className="px-6 py-4 align-top text-right font-medium pt-6">
        {formatCurrency(rowTotal)}
        {/* Optional: Indicator for custom pricing */}
        {rowValues?.unitPrice !==  rowValues._availableUnits?.find((u: any) => u.unitId === rowValues.sellingUnitId)?.price 
            && rowValues?.unitPrice > 0 
            && ( customerId ? <div className="text-[10px] text-blue-600 font-semibold mt-1">Special Price</div> : null )
        }
      </td>

      {/* DELETE */}
      <td className="px-6 py-4 align-top text-center pt-5">
        <button
          type="button"
          onClick={() => remove(index)}
          className="text-zinc-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
});
OrderItemRow.displayName = 'OrderItemRow';


// 3. Isolated Order Totals Component
function OrderTotals({ control, formatCurrency, register }: { control: Control<any>, formatCurrency: any, register: any }) {
  const items = useWatch({ control, name: 'items' });
  const shippingFee = useWatch({ control, name: 'shippingFee' }) || 0;
  const discountAmount = useWatch({ control, name: 'discountAmount' }) || 0;

  const itemsSubtotal = items?.reduce((acc: number, item: any) => {
    return acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }, 0) || 0;

  const orderTotal = itemsSubtotal + shippingFee - discountAmount;

  return (
    <div className="w-64 space-y-3">
      <div className="flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
        <span>Subtotal</span>
        <span>{formatCurrency(itemsSubtotal)}</span>
      </div>
      <div className="flex justify-between items-center text-sm text-zinc-600 dark:text-zinc-400">
        <Label className="font-normal text-xs">Shipping Fee</Label>
        <Input
          type="number"
          step="any"
          onKeyDown={blockInvalidChar}
          className={cn("h-7 w-20 text-right text-xs", NO_SPINNER_CLASS)}
          {...register('shippingFee', { valueAsNumber: true })}
        />
      </div>
      <div className="flex justify-between items-center text-sm text-zinc-600 dark:text-zinc-400">
        <Label className="font-normal text-xs">Discount</Label>
        <Input
          type="number"
          step="any"
          onKeyDown={blockInvalidChar}
          className={cn("h-7 w-20 text-right text-xs", NO_SPINNER_CLASS)}
          {...register('discountAmount', { valueAsNumber: true })}
        />
      </div>
      <Separator />
      <div className="flex justify-between text-base font-bold text-zinc-900 dark:text-zinc-100">
        <span>Total</span>
        <span>{formatCurrency(orderTotal)}</span>
      </div>
    </div>
  );
}

// 4. Isolated Balance Component
function PaymentBalanceDisplay({ control, formatCurrency }: { control: Control<any>, formatCurrency: any }) {
  const items = useWatch({ control, name: 'items' });
  const payments = useWatch({ control, name: 'payments' });
  const shippingFee = useWatch({ control, name: 'shippingFee' }) || 0;
  const discountAmount = useWatch({ control, name: 'discountAmount' }) || 0;

  const itemsSubtotal = items?.reduce((acc: number, item: any) => {
    return acc + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }, 0) || 0;
  
  const orderTotal = itemsSubtotal + shippingFee - discountAmount;
  const totalPaid = payments?.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0) || 0;
  const balanceDue = orderTotal - totalPaid;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Total Order</span>
        <span className="font-medium">{formatCurrency(orderTotal)}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Total Paid</span>
        <span className="font-medium text-emerald-600">-{formatCurrency(totalPaid)}</span>
      </div>
      <div className="flex justify-between text-base font-bold pt-2 border-t border-zinc-100 dark:border-zinc-800 mt-2">
        <span>Balance Due</span>
        <span className={balanceDue > 0 ? 'text-red-600' : 'text-zinc-900 dark:text-zinc-100'}>
          {formatCurrency(balanceDue)}
        </span>
      </div>
    </div>
  )
}


// --- MAIN PAGE COMPONENT ---

export default function CreateOrderPage() {
  const formatCurrency = useFormattedCurrency();
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [createdInvoiceUrl, setCreatedInvoiceUrl] = useState<string | null>(null);
  const [customerAddresses, setCustomerAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

  const { mutate: createOrder, isPending: isSubmitting } = useCreateOrder({
    onSuccess: (data: any) => {
      console.log('API Response:', data);
      setCreatedOrderId(data?.number || data?.orderId || 'new-order');
      setCreatedInvoiceUrl(data?.invoiceUrl || null);
      setSubmitStatus('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (error) => {
      console.error('API Error:', error);
      setSubmitStatus('error');
    }
  });
  
  const { currentLocation } = useAuthStore();
  const locationId = currentLocation?.id||'';

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(CreateOrderSchema),
    mode: 'onChange',
    defaultValues: {
      type: TransactionType.SALES_ORDER,
      locationId: locationId,
      items: [{ 
        variantId: '', 
        quantity: 1, 
        unitPrice: 0,
        sellingUnitId: undefined,
      }],
      payments: [],
      fulfillment: { type: FulfillmentType.DELIVERY },
      shippingFee: 0,
      discountAmount: 0,
      status: TransactionStatus.PENDING_CONFIRMATION,
    },
  });

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({ control, name: 'items' });
  // const { fields: paymentFields, append: appendPayment, remove: removePayment } = useFieldArray({ control, name: 'payments' });

  // --- PRICING DATA FETCHING ---
  // A. Trigger Sync
  usePosPricingSync();
  const customerId = watch('customerId');
  const items = watch('items');

  // B. Construct Batch Request
  const batchPricingItems = useMemo(() => {
      return items.map((item: any) => {
          // Need variantId. unitId can be optional
          if (!item.variantId) return null;
          
          // Find if it is a base unit
          const unit = item._availableUnits?.find((u: any) => u.unitId === item.sellingUnitId);
          
          return {
              variantId: item.variantId,
              unitId: item.sellingUnitId || null,
              isBaseUnit: !!(unit?.isBaseUnit)
          }
      }).filter((i): i is { variantId: string; unitId: string | null; isBaseUnit: boolean } => i !== null);
  }, [items]);

  // C. Fetch Price Map (Rust)
  const { priceMap } = useBatchPricing(batchPricingItems, customerId);

  // Only watch fields necessary for conditional logic
  const fulfillmentType = watch('fulfillment.type');

  const onSubmit = (data: OrderFormValues) => {
    setSubmitStatus('idle');
    const cleanData = {
      ...data,
      items: data.items.map((item: any) => {
        const { _availableUnits, ...rest } = item;
        return rest;
      })
    };
    createOrder(cleanData);
  };

  const onError = (errors: any) => {
    console.error('Validation Errors:', errors);
    setSubmitStatus('error');
  };

  const handleReset = () => {
    setSubmitStatus('idle');
    setCreatedOrderId(null);
    setCustomerAddresses([]);
    setSelectedAddressId('');
    reset({
      type: TransactionType.SALES_ORDER,
      locationId: locationId,
      items: [{ 
        variantId: '', 
        quantity: 1, 
        unitPrice: 0,
        sellingUnitId: undefined,
      }],
      payments: [],
      fulfillment: { type: FulfillmentType.DELIVERY },
      shippingFee: 0,
      discountAmount: 0,
      status: TransactionStatus.PENDING_CONFIRMATION,
    });
  };

  // --- RENDER SUCCESS VIEW IF SUCCESSFUL ---
  if (submitStatus === 'success' && createdOrderId) {
    return (
      <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 p-6 md:p-8 font-sans">
        <div className="mx-auto max-w-3xl bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
           <OrderSuccessView 
             orderId={createdOrderId} 
             invoiceUrl={createdInvoiceUrl!} 
             onReset={handleReset} 
           />
        </div>
      </div>
    );
  }

  // --- RENDER FORM ---
  return (
    // FULL WIDTH CONTAINER: Removed padding and max-width logic
    <div className="min-h-screen bg-white dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 flex flex-col">
      <div className="w-full bg-white dark:bg-zinc-900 flex flex-col min-h-screen">
        
        {/* === HEADER ACTIONS BAR === */}
        <div className="px-8 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/50">
           <div className="flex items-center gap-2 text-zinc-500">
           </div>
           <div className="flex items-center gap-3">
              <div className="text-xs text-zinc-400 mr-2 uppercase tracking-widest font-semibold hidden md:block">
                Draft Order
              </div>
              <Button
                onClick={handleSubmit(onSubmit, onError)}
                disabled={isSubmitting}
                className="bg-zinc-900 hover:bg-zinc-800 text-white min-w-[140px] h-9 shadow-sm"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {isSubmitting ? 'Processing...' : 'Create Invoice'}
              </Button>
           </div>
        </div>

        {/* === MAIN INVOICE CONTENT === */}
        <div className="p-8 md:p-12 space-y-8 flex-1 w-full">
          
          {/* HEADER SECTION */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 border-b border-zinc-100 dark:border-zinc-800 pb-8">
             <div>
                <h1 className="text-3xl font-serif font-bold tracking-tight text-zinc-900 dark:text-zinc-50">New Order</h1>
                <p className="text-sm text-zinc-500 mt-2 max-w-md">
                  Create a commercial invoice or sales order. Ensure all customer details are verified before saving.
                </p>
             </div>
             <div className="flex flex-col items-end gap-1 text-right">
                <div className="flex items-center gap-2">
                   <Label className="uppercase text-[10px] tracking-widest text-zinc-400 font-semibold">Status</Label>
                   <Controller
                      control={control}
                      name="status"
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger className="h-8 w-[180px] text-xs border-zinc-200 bg-transparent text-right">
                            <SelectValue placeholder="Select Status" />
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectItem value={TransactionStatus.PENDING_CONFIRMATION}>Pending Confirmation</SelectItem>
                            <SelectItem value={TransactionStatus.CONFIRMED}>Confirmed</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                </div>
                <div className="text-xs text-zinc-400 mt-1">
                   Draft Date: {new Date().toLocaleDateString()}
                </div>
             </div>
          </div>

          {submitStatus === 'error' && (
             <div className="bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 p-4 rounded-r-md">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Submission Error</h3>
                    <div className="mt-1 text-sm text-red-700 dark:text-red-400">
                      Please check the highlighted fields below.
                    </div>
                  </div>
                </div>
             </div>
          )}

          {/* GRID: BILL TO | SHIP TO | SETTINGS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
             
             {/* LEFT: CUSTOMER (BILL TO) */}
             <div className="lg:col-span-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-4">
                  Bill To
                </h3>
                
                <div className="space-y-4">
                   <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500 font-normal">Customer Account</Label>
                      <Controller
                        control={control}
                        name="customerId"
                        render={({ field }) => (
                          <CustomerSelect 
                            onValueChange={field.onChange} 
                            value={field.value} 
                            onSelect={(customer: any) => {
                              const addrs = customer.addresses || [];
                              setCustomerAddresses(addrs);
                              const primary = addrs.find((a:any) => a.isDefault) || addrs[0];
                              if (primary) {
                                  setSelectedAddressId(primary.id); 
                              } else {
                                  setSelectedAddressId('');
                              }
                            }}
                          />
                        )}
                      />
                      {errors.customerId && <span className="text-xs text-red-500">Customer is required</span>}
                   </div>
                   
                   {/* Address Display (Static for now based on selection logic) */}
                   <div className="p-4 bg-zinc-50/50 dark:bg-zinc-800/20 rounded-md border border-zinc-100 dark:border-zinc-800 text-sm text-zinc-600 min-h-[100px] flex items-center justify-center text-center">
                      {customerId ? (
                          <div className="text-left w-full">
                             {/* Ideally we show the selected customer details here */}
                             <span className="font-semibold text-zinc-900 dark:text-zinc-100 block mb-1">SELECTED CUSTOMER</span>
                             <span className="text-zinc-500 text-xs">Address integration coming soon...</span>
                          </div>
                      ) : (
                          <span className="text-zinc-400 italic">No customer selected</span>
                      )}
                   </div>
                </div>
             </div>

             {/* MIDDLE: SHIP TO / FULFILLMENT */}
             <div className="lg:col-span-4 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-4">
                  Ship To & Delivery
                </h3>
                 
                <div className="space-y-4">
                   <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500 font-normal">Fulfillment Method</Label>
                      <Controller
                          control={control}
                          name="fulfillment.type"
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={FulfillmentType.DELIVERY}>Dispatch / Delivery</SelectItem>
                                <SelectItem value={FulfillmentType.PICKUP}>Counter Pickup</SelectItem>
                                <SelectItem value={FulfillmentType.DINE_IN}>Dine In / On-Site</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                   </div>

                   {fulfillmentType === FulfillmentType.DELIVERY && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-500 font-normal">Delivery Address</Label>
                        <Select 
                          value={selectedAddressId} 
                          onValueChange={(val) => setSelectedAddressId(val)}
                          disabled={!customerId || customerAddresses.length === 0}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={customerAddresses.length === 0 ? "No addresses on file" : "Select Address"} />
                          </SelectTrigger>
                          <SelectContent>
                             {customerAddresses.map((addr: any) => (
                                <SelectItem key={addr.id} value={addr.id}>
                                  {addr.label} - {addr.street}, {addr.city}
                                </SelectItem>
                             ))}
                             {customerAddresses.length === 0 && <SelectItem value="none" disabled>No addresses found</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                   )}
                </div>
             </div>

             {/* RIGHT: NOTES */}
             <div className="lg:col-span-3 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-4">
                   Notes
                </h3>
                <Textarea
                  {...register('notes')}
                  placeholder="Internal notes..."
                  className="resize-none h-[180px] text-xs bg-zinc-50/50 dark:bg-zinc-800/20 border-zinc-200"
                />
             </div>
          </div>

          {/* ITEM LIST */}
          <div className="mt-12">
              <div className="flex items-center justify-between mb-2">
                 <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Items Ordered</h3>
                 {/* Quick Add Button logic can go here if needed, or keeping it inline in table */}
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-md overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 w-10 text-center">#</th>
                      <th className="px-4 py-3">Item Details</th>
                      <th className="px-4 py-3 w-32">Unit</th>
                      <th className="px-4 py-3 w-24 text-center">Qty</th>
                      <th className="px-4 py-3 w-32 text-right">Amount</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                    {itemFields.map((field, index) => (
                      <OrderItemRow 
                        key={field.id} 
                        index={index} 
                        control={control} 
                        register={register} 
                        remove={removeItem} 
                        setValue={setValue}
                        errors={errors}
                        formatCurrency={formatCurrency}
                        customerId={customerId}
                        priceMap={priceMap}
                      />
                    ))}
                  </tbody>
                </table>
                
                {/* ADD ITEM BAR */}
                <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-center">
                   <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendItem({ 
                        variantId: '', 
                        quantity: 1, 
                        unitPrice: 0, 
                        sellingUnitId: undefined,
                      })}
                      className="text-zinc-500 border-dashed border-zinc-300 hover:border-zinc-400 hover:text-zinc-700"
                    >
                      <Plus className="mr-2 h-3.5 w-3.5" /> Add Line Item
                    </Button>
                </div>
              </div>
          </div>

          {/* FOOTER TOTALS */}
          <div className="flex flex-col md:flex-row justify-end mt-8 gap-12">
             <div className="w-full md:w-80">
                <OrderTotals control={control} formatCurrency={formatCurrency} register={register} />
                
                {/* BALANCE PREVIEW */}
                <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                   <PaymentBalanceDisplay control={control} formatCurrency={formatCurrency} />
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );

}