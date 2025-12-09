'use client';

import { useState, useRef, useCallback, memo, useMemo } from 'react';
import { useForm, useFieldArray, Controller, useWatch, Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  AlertCircle,
  Truck,
  User,
  MapPin,
  CreditCard,
  FileText,
  Check,
  ChevronsUpDown,
  Search,
} from 'lucide-react';
import { useFormattedCurrency, cn } from '@/lib/utils';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { FulfillmentType, PaymentMethod, PaymentStatus, TransactionType, useCreateOrder } from '@/hooks/sales';
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

interface ApiProduct {
  productId: string;
  name: string;
  imageUrl?: string;
  totalStock: number;
  variants: {
    variantId: string;
    name: string;
    sku: string;
    barcode?: string;
    stock: number;
    sellableUnits: SellableUnit[];
  }[];
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
    data, 
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage, 
    isLoading 
  } = usePosProducts({ 
    search: debouncedSearch, 
    category: "all", 
    enabled: open 
  });

  const isSearching = search !== debouncedSearch || isLoading;

  const products: FlattenedProductVariant[] = useMemo(() => {
    if (!data?.pages) return [];
    
    return data.pages.flatMap(page => {
      //@ts-expect-error
      const pageProducts = (page.products || []) as ApiProduct[];
      
      return pageProducts.flatMap(product => 
        (product.variants || []).map(variant => ({
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
      );
    });
  }, [data]);
  
  const selectedProduct = products.find(p => p.variantId === value);
  const displayText = selectedProduct 
    ? `${selectedProduct.productName} - ${selectedProduct.variantName}` 
    : (value ? "Item Selected (Search to change)" : "Select product...");

  const observer = useRef<IntersectionObserver>(null);
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (node) observer.current.observe(node);
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

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
                 const isLast = index === products.length - 1;
                 return (
                  <CommandItem
                    key={`${product.variantId}-${index}`}
                    value={product.variantId}
                    onSelect={() => {
                      onSelect(product);
                      setOpen(false);
                    }}
                    ref={isLast ? lastElementRef : undefined}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === product.variantId ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{product.productName}</span>
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
              {isFetchingNextPage && (
                <div className="p-2 text-xs text-center text-muted-foreground">Loading more...</div>
              )}
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
  formatCurrency 
}: {
  index: number;
  control: Control<any>;
  register: any;
  remove: (index: number) => void;
  setValue: any;
  errors: any;
  formatCurrency: (val: number) => string;
}) => {
  const rowValues = useWatch({
    control,
    name: `items.${index}`,
  });

  const availableUnits = rowValues?._availableUnits || [];
  const rowTotal = (rowValues?.quantity || 0) * (rowValues?.unitPrice || 0);

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
                setValue(`items.${index}.unitPrice`, defaultUnit?.price || 0);
                setValue(`items.${index}._availableUnits`, product.sellableUnits);
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
          {...register(`items.${index}.quantity`, { valueAsNumber: true })}
          className={cn("h-10 text-center", NO_SPINNER_CLASS)}
        />
        {errors.items?.[index]?.quantity && (
          <div className="mt-1 text-[10px] text-red-500">{errors.items?.[index]?.quantity.message}</div>
        )}
      </td>

      {/* TOTAL */}
      <td className="px-6 py-4 align-top text-right font-medium pt-6">
        {formatCurrency(rowTotal)}
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

  const { mutate: createOrder, isPending: isSubmitting } = useCreateOrder({
    onSuccess: (data: any) => {
      console.log('API Response:', data);
      setCreatedOrderId(data?.id || data?.orderId || 'new-order');
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
  const { fields: paymentFields, append: appendPayment, remove: removePayment } = useFieldArray({ control, name: 'payments' });

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
    <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 p-6 md:p-8 font-sans text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-8">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Order</h1>
            <p className="text-sm text-zinc-500 mt-1">Create a new invoice or delivery order for external customers.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => window.history.back()}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(onSubmit, onError)}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSubmitting ? 'Saving...' : 'Create Order'}
            </Button>
          </div>
        </div>

        {submitStatus === 'error' && (
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">There were errors with your submission</h3>
                <p className="mt-1 text-sm text-red-700">Please check the form fields and try again.</p>
                {Object.keys(errors).length > 0 && (
                   <ul className="list-disc pl-4 mt-2 text-xs">
                     {Object.entries(errors).map(([key, val]: any) => (
                       <li key={key}>{key}: {val.message || 'Invalid'}</li>
                     ))}
                   </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit, onError)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* === LEFT COLUMN: MAIN FORM (Span 2) === */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. CUSTOMER & DETAILS CARD */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 p-6">
              <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                <User className="w-4 h-4" /> Customer Details
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Customer <span className="text-red-500">*</span></Label>
                  <Controller
                    control={control}
                    name="customerId"
                    render={({ field }) => <CustomerSelect onValueChange={field.onChange} value={field.value} />}
                  />
                  {errors.customerId && <span className="text-xs text-red-500">{errors.customerId.message}</span>}
                </div>

                <div className="space-y-2">
                  <Label>Order Status</Label>
                  <Controller
                    control={control}
                    name="status"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Select Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TransactionStatus.PENDING_CONFIRMATION}>Pending Confirmation</SelectItem>
                          <SelectItem value={TransactionStatus.CONFIRMED}>Confirmed</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* 2. ORDER ITEMS CARD */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
              <div className="flex items-center justify-between p-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="font-semibold flex items-center gap-2 text-sm uppercase text-zinc-500 tracking-wider">
                  <FileText className="w-4 h-4" /> Order Items
                </h3>
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
                >
                  <Plus className="mr-2 h-3.5 w-3.5" /> Add Item
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50/50 dark:bg-zinc-900 text-xs font-medium text-zinc-500 uppercase">
                    <tr>
                      <th className="px-6 py-3 w-12">#</th>
                      <th className="px-6 py-3 min-w-[200px]">Product / Variant</th>
                      <th className="px-6 py-3 w-40">Unit</th>
                      <th className="px-6 py-3 w-24 text-center">Qty</th>
                      <th className="px-6 py-3 w-32 text-right">Total</th>
                      <th className="px-6 py-3 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
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
                      />
                    ))}
                    {itemFields.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                          No items added. Click "Add Item" to start.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals Section */}
              <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-6 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                 <OrderTotals control={control} formatCurrency={formatCurrency} register={register} />
              </div>
            </div>

            {/* 3. NOTES */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 p-6">
              <Label className="mb-2 block">Order Notes / Instructions</Label>
              <Textarea
                {...register('notes')}
                placeholder="Internal notes, delivery instructions, or special requests..."
                className="resize-none min-h-[100px]"
              />
            </div>
          </div>

          {/* === RIGHT COLUMN: SIDEBAR (Span 1) === */}
          <div className="space-y-6">
            {/* FULFILLMENT SETTINGS */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 p-5">
              <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                <Truck className="w-4 h-4" /> Fulfillment
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Controller
                    control={control}
                    name="fulfillment.type"
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={FulfillmentType.DELIVERY}>Delivery</SelectItem>
                          <SelectItem value={FulfillmentType.PICKUP}>Pickup</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {fulfillmentType === FulfillmentType.DELIVERY && (
                  <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-md border border-zinc-100 dark:border-zinc-700">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                      <MapPin className="w-3 h-3" /> Delivery Details
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Address ID (Mock)</Label>
                      <Input disabled placeholder="Select Address..." className="h-8 text-xs bg-white dark:bg-zinc-900" />
                    </div>
                  </div>
                )}
                {fulfillmentType === FulfillmentType.PICKUP && (
                  <div className="space-y-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-md border border-zinc-100 dark:border-zinc-700">
                    <div className="space-y-2">
                      <Label className="text-xs">Pickup Location</Label>
                      <Input disabled value="Main Warehouse" className="h-8 text-xs bg-white dark:bg-zinc-900" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PAYMENT RECORDING */}
            <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-500 uppercase tracking-wider">
                  <CreditCard className="w-4 h-4" /> Payments
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-indigo-600"
                  onClick={() => appendPayment({
                      method: PaymentMethod.CASH,
                      amount: 0, 
                      status: PaymentStatus.COMPLETED, 
                    })
                  }
                >
                  + Add Record
                </Button>
              </div>

              {paymentFields.length === 0 ? (
                <div className="text-sm text-zinc-500 text-center py-4 bg-zinc-50 dark:bg-zinc-800 rounded-md border border-dashed border-zinc-200 dark:border-zinc-700">
                  No payments recorded. <br /> This will create an <strong>Unpaid Invoice</strong>.
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentFields.map((field, index) => (
                    <div key={field.id} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-100 dark:border-zinc-700 space-y-2">
                      <div className="flex justify-between items-start">
                        <Label className="text-xs text-zinc-500">Payment #{index + 1}</Label>
                        <button type="button" onClick={() => removePayment(index)} className="text-zinc-400 hover:text-red-500">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Controller
                          control={control}
                          name={`payments.${index}.method`}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={PaymentMethod.CASH}>Cash</SelectItem>
                                <SelectItem value={PaymentMethod.CARD}>Card</SelectItem>
                                <SelectItem value={PaymentMethod.BANK_TRANSFER}>Bank Transfer</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                        <Input
                          type="number"
                          step="any"
                          onKeyDown={blockInvalidChar}
                          {...register(`payments.${index}.amount`, { valueAsNumber: true })}
                          className={cn("h-8 text-xs text-right", NO_SPINNER_CLASS)}
                          placeholder="Amount"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-4" />
              <PaymentBalanceDisplay control={control} formatCurrency={formatCurrency} />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}