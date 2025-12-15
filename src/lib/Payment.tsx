'use client';

import { useEffect, createContext } from 'react';
import Ably from 'ably';
import { toast } from 'sonner';
import { ably } from './ably';

interface PaymentNotificationContextType {
  lastPayment: any;
}

const PaymentNotificationContext = createContext<PaymentNotificationContextType | null>(null);

export function PaymentNotificationProvider({ 
  children, 
  organizationId 
}: { 
  children: React.ReactNode;
  organizationId: string;
}) {

  useEffect(() => {
    if (!organizationId) return;

    // 1. Subscribe to the Organization Channel
    const channel = ably?.channels.get(`organization:${organizationId}:payments`);

    // 2. Handle Matched Payments (STK Success or C2B Matched)
    const onPaymentUpdate = (message: Ably.Message) => {
      const { transactionId, status, data } = message.data;
      
      if (status === 'COMPLETED' || status === 'PAID') {
        toast.success(`Payment Received: KES ${data.amount || ''}`, {
          description: `Receipt: ${data.receipt}. transaction updated.`,
          duration: 5000,
        });

        // Optional: Refresh data or Redirect
        // router.refresh(); 
      } else if (status === 'FAILED') {
        toast.error('Payment Failed', {
          description: data.description,
        });
      }
    };

    // 3. Handle Unclaimed Payments (Buy Goods / Typo in Paybill)
    const onUnclaimed = (message: Ably.Message) => {
      const { amount, phone, accountRef, receipt } = message.data;

      // This creates a "Manual Action" toast for the Cashier
      toast.info('Unclaimed Payment Received', {
        description: `KES ${amount} from ${phone}. Ref: ${accountRef || 'N/A'}. Click to assign.`,
        action: {
          label: 'Assign',
          onClick: () => {
             // Logic to open a modal to assign this receipt to the current cart
             console.log('Open manual assignment modal for', receipt);
          }
        },
        duration: Infinity, // Keep it open until acknowledged
      });
    };

    channel?.subscribe('payment-update', onPaymentUpdate);
    channel?.subscribe('payment-unclaimed', onUnclaimed);

    // Cleanup
    return () => {
      channel?.unsubscribe('payment-update', onPaymentUpdate);
      channel?.unsubscribe('payment-unclaimed', onUnclaimed);
    };
  }, [organizationId]);

  return (
    <PaymentNotificationContext.Provider value={{ lastPayment: null }}>
      {children}
    </PaymentNotificationContext.Provider>
  );
}