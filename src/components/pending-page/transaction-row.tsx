// components/pending-page/transaction-row.tsx
'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { TableCell, TableRow } from "@/components/ui/table";
import { CheckCircle2, Download, Loader2, MoreHorizontal, Plus, Truck, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { Transaction } from "@/types";

interface TransactionRowProps {
  tx: Transaction;
  isHighlighted: boolean;
  isDownloading: boolean;
  openMenuId: string | null;
  onOpenMenuChange: (isOpen: boolean) => void;
  onCopyId: (id: string) => void;
  onDownloadInvoice: (tx: Transaction) => void;
  onOpenReconcile: (id: string) => void;
  onOpenPayment: (id: string) => void;
  onOpenDispatch: (id: string) => void;
}

export function TransactionRow({
  tx,
  isHighlighted,
  isDownloading,
  openMenuId,
  onOpenMenuChange,
  onCopyId,
  onDownloadInvoice,
  onOpenReconcile,
  onOpenPayment,
  onOpenDispatch,
}: TransactionRowProps) {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KSH' }).format(amount);

  return (
    <TableRow 
      key={tx.id} 
      id={`tx-row-${tx.id}`}
      className={cn(
        "transition-colors duration-500",
        isHighlighted ? "bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-l-indigo-500" : ""
      )}
    >
      <TableCell className="font-medium">{tx.number || tx.id.slice(-6)}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium">{tx.customer}</span>
          <span className="text-xs text-muted-foreground">{tx.email}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge 
          variant={
            tx.status === 'dispatched' ? 'default' : 
            tx.status === 'pending' ? 'destructive' : 'secondary'
          } 
          className="capitalize"
        >
          {tx.status === 'dispatched' && <Truck className="w-3 h-3 mr-1" />}
          {tx.status.replace('_', ' ')}
        </Badge>
      </TableCell>
      <TableCell className="w-[200px]">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Paid: {formatCurrency(tx.paidAmount)}</span>
            <span className="font-medium">
              {Math.round((tx.paidAmount / tx.totalAmount) * 100)}%
            </span>
          </div>
          <Progress value={(tx.paidAmount / tx.totalAmount) * 100} className="h-2" />
        </div>
      </TableCell>
      <TableCell className="text-right font-bold font-mono">
        {formatCurrency(tx.totalAmount - tx.paidAmount)}
      </TableCell>
      <TableCell>
        <DropdownMenu 
          open={openMenuId === tx.id} 
          onOpenChange={onOpenMenuChange}
        >
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onCopyId(tx.id)}>
              Copy ID
            </DropdownMenuItem>
            
            {tx.invoiceLink && (
              <DropdownMenuItem 
                onClick={() => onDownloadInvoice(tx)}
                disabled={isDownloading}
                className="text-green-600 focus:text-green-600 cursor-pointer"
              >
                {isDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" /> 
                )}
                Download Invoice
              </DropdownMenuItem>
            )}

            {/* Dispatch option - only show for non-dispatched transactions */}
            {tx.status !== 'dispatched' && (
              <DropdownMenuItem 
                onClick={() => onOpenDispatch(tx.id)} 
                className="text-purple-600 focus:text-purple-600"
              >
                <Package className="mr-2 h-4 w-4" /> Dispatch Order
              </DropdownMenuItem>
            )}

            {tx.status === 'dispatched' && (
              <DropdownMenuItem onClick={() => onOpenReconcile(tx.id)} className="text-blue-600 focus:text-blue-600">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Reconcile Delivery
              </DropdownMenuItem>
            )}

            <DropdownMenuItem onClick={() => onOpenPayment(tx.id)}>
              <Plus className="mr-2 h-4 w-4" /> Add Payment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}