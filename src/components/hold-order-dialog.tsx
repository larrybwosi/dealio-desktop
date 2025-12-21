'use client';

import { useState } from 'react';
import { usePosStore, type HeldOrderPriority } from '@/store/store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Pause,
  Clock,
  AlertTriangle,
  AlertCircle,
  ShoppingBag,
  User,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HoldOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onHoldComplete?: () => void;
}

const QUICK_REASONS = [
  'Customer stepped away',
  'Price check needed',
  'Manager approval',
  'Payment issue',
  'Item lookup',
  'Loyalty lookup',
];

const priorityOptions: { value: HeldOrderPriority; label: string; description: string; color: string }[] = [
  {
    value: 'normal',
    label: 'Normal',
    description: 'Standard hold priority',
    color: 'border-slate-300 bg-slate-50 hover:bg-slate-100',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Customer waiting nearby',
    color: 'border-amber-300 bg-amber-50 hover:bg-amber-100',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    description: 'Immediate attention needed',
    color: 'border-red-300 bg-red-50 hover:bg-red-100',
  },
];

export function HoldOrderDialog({ open, onOpenChange, onHoldComplete }: HoldOrderDialogProps) {
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<HeldOrderPriority>('normal');

  const currentOrder = usePosStore(state => state.currentOrder);
  const holdCurrentOrder = usePosStore(state => state.holdCurrentOrder);
  const heldOrders = usePosStore(state => state.heldOrders);
  const maxHeldOrders = usePosStore(state => state.settings.maxHeldOrders);
  const requireHoldReason = usePosStore(state => state.settings.requireHoldReason);
  const currency = usePosStore(state => state.settings.currency) || 'KSH';

  const itemsCount = currentOrder.items.length;
  const total = currentOrder.items.reduce((sum, item) => {
    return sum + (item.selectedUnit?.price ?? 0) * item.quantity;
  }, 0);

  const canHold = heldOrders.length < maxHeldOrders;
  const reasonValid = !requireHoldReason || reason.trim().length > 0;

  const handleHold = () => {
    if (!canHold) {
      toast.error('Maximum held orders reached', {
        description: `You can hold a maximum of ${maxHeldOrders} orders. Please complete or delete existing held orders.`,
      });
      return;
    }

    if (!reasonValid) {
      toast.error('Reason required', {
        description: 'Please enter a reason for holding this order.',
      });
      return;
    }

    holdCurrentOrder(reason.trim() || undefined, priority);
    
    toast.success('Order Held', {
      description: `${itemsCount} item${itemsCount !== 1 ? 's' : ''} held successfully`,
      icon: <Pause className="w-4 h-4" />,
    });

    // Reset state
    setReason('');
    setPriority('normal');
    onOpenChange(false);
    onHoldComplete?.();
  };

  const handleQuickReason = (quickReason: string) => {
    setReason(quickReason);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pause className="w-5 h-5 text-primary" />
            Hold Order
          </DialogTitle>
          <DialogDescription>
            Temporarily save this order and clear the cart. You can recall it later.
          </DialogDescription>
        </DialogHeader>

        {/* Order Summary */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <ShoppingBag className="w-4 h-4" />
              Items
            </span>
            <span className="font-medium">{itemsCount}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              Customer
            </span>
            <span className="font-medium">{currentOrder.customerName || 'Walk-in'}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Estimated Total</span>
            <span className="text-lg font-bold text-primary">
              {currency} {total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Warning for max orders */}
        {!canHold && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Maximum Held Orders Reached</p>
              <p className="text-muted-foreground">
                You have {heldOrders.length}/{maxHeldOrders} held orders. Complete or delete some before holding more.
              </p>
            </div>
          </div>
        )}

        {/* Reason Input */}
        <div className="space-y-3">
          <Label htmlFor="reason" className="flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            Reason {requireHoldReason && <span className="text-destructive">*</span>}
          </Label>
          <Input
            id="reason"
            placeholder={requireHoldReason ? 'Enter reason for holding...' : 'Optional reason for holding...'}
            value={reason}
            onChange={e => setReason(e.target.value)}
            className={cn(!reasonValid && 'border-destructive focus-visible:ring-destructive')}
          />
          
          {/* Quick Reasons */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_REASONS.map(quickReason => (
              <Badge
                key={quickReason}
                variant="outline"
                className={cn(
                  'cursor-pointer transition-colors text-xs',
                  reason === quickReason
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'hover:bg-muted'
                )}
                onClick={() => handleQuickReason(quickReason)}
              >
                {quickReason}
              </Badge>
            ))}
          </div>
        </div>

        {/* Priority Selection */}
        <div className="space-y-3">
          <Label className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Priority
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {priorityOptions.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setPriority(option.value)}
                className={cn(
                  'p-3 rounded-lg border-2 text-center transition-all',
                  option.color,
                  priority === option.value
                    ? 'ring-2 ring-primary ring-offset-2'
                    : 'hover:shadow-sm'
                )}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  {option.value === 'high' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                  {option.value === 'urgent' && <AlertCircle className="w-3 h-3 text-red-600" />}
                  <span className="font-medium text-sm">{option.label}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleHold}
            disabled={!canHold || !reasonValid || itemsCount === 0}
            className="gap-2"
          >
            <Pause className="w-4 h-4" />
            Hold Order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
