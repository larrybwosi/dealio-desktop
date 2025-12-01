'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  MoreHorizontal,
  AlertCircle,
  Banknote,
  CheckCircle2,
  Truck,
  Download,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { apiClient } from '@/lib/axios';
import { PaymentDialog } from '@/components/pending-page/payment';
import { ReconciliationDialog } from '@/components/pending-page/reconcile';

// --- Types ---
interface Transaction {
  id: string;
  number?: string;
  customer: string;
  email: string;
  totalAmount: number;
  paidAmount: number;
  date: string;
  status: 'pending' | 'partially_paid' | 'paid' | 'dispatched'; 
  fulfillmentId?: string | null;
  invoiceLink?: string; // Add invoice link field
}

// --- Fetch Function ---
const fetchTransactions = async (locationId?: string) => {
  const params = locationId ? { locationId } : {};
  const { data } = await apiClient.get<Transaction[]>('/api/v1/pos/sale', { params });
  return data;
};

export default function PendingTransactionsPage() {
  const queryClient = useQueryClient();
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);

  // --- Query: Get Transactions ---
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => fetchTransactions(),
  });

  // --- Handlers ---
  const handleOpenPayment = (txId: string) => {
    setActiveTxId(txId);
    setIsPaymentOpen(true);
  };

  const handleOpenReconcile = (txId: string) => {
    setActiveTxId(txId);
    setIsReconcileOpen(true);
  };

  const handleDownloadInvoice = async (tx: Transaction) => {
    if (!tx.invoiceLink) return;
    
    try {
      // You can use different approaches depending on how your invoice links work:
      
      // Approach 1: Direct download if it's a direct file URL
      const link = document.createElement('a');
      link.href = tx.invoiceLink;
      link.download = `invoice-${tx.number || tx.id.slice(-6)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Approach 2: If you need to get the file from your API
      // const response = await apiClient.get(tx.invoiceLink, {
      //   responseType: 'blob'
      // });
      // const url = window.URL.createObjectURL(new Blob([response.data]));
      // const link = document.createElement('a');
      // link.href = url;
      // link.download = `invoice-${tx.number || tx.id.slice(-6)}.pdf`;
      // document.body.appendChild(link);
      // link.click();
      // window.URL.revokeObjectURL(url);
      // document.body.removeChild(link);
      
      // Approach 3: If it's a URL that should open in a new tab
      // window.open(tx.invoiceLink, '_blank');
      
    } catch (error) {
      console.error('Failed to download invoice:', error);
      // You might want to add toast notification here
      // toast.error('Failed to download invoice');
    }
  };

  // --- Helpers ---
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KSH' }).format(amount);

  const getActiveTransaction = () => transactions.find(t => t.id === activeTxId);

  // --- Filter Logic ---
  const pendingTx = transactions.filter(t => t.status === 'pending');
  const dispatchedTx = transactions.filter(t => t.status === 'dispatched');
  const totalOutstanding = transactions.reduce((acc, curr) => acc + (curr.totalAmount - curr.paidAmount), 0);

  // --- Table Component ---
  const TransactionTable = ({ data }: { data: Transaction[] }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">ID</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
           <TableRow>
             <TableCell colSpan={6} className="text-center h-24">Loading transactions...</TableCell>
           </TableRow>
        ) : data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
              No transactions found.
            </TableCell>
          </TableRow>
        ) : (
          data.map((tx) => (
            <TableRow key={tx.id}>
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => navigator.clipboard.writeText(tx.id)}>
                      Copy ID
                    </DropdownMenuItem>
                    
                    {/* Download Invoice Menu Item */}
                    {tx.invoiceLink && (
                      <DropdownMenuItem 
                        onClick={() => handleDownloadInvoice(tx)}
                        className="text-green-600 focus:text-green-600"
                      >
                        <Download className="mr-2 h-4 w-4" /> 
                        Download Invoice
                      </DropdownMenuItem>
                    )}

                    {tx.status === 'dispatched' && (
                      <DropdownMenuItem onClick={() => handleOpenReconcile(tx.id)} className="text-blue-600 focus:text-blue-600">
                        <CheckCircle2 className="mr-2 h-4 w-4" /> Reconcile Delivery
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem onClick={() => handleOpenPayment(tx.id)}>
                      <Plus className="mr-2 h-4 w-4" /> Add Payment
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  const activeTransaction = getActiveTransaction();

  return (
    <div className="min-h-screen bg-background text-foreground p-8 space-y-8">
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1">Manage payments, balances, and outstanding invoices.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['transactions'] })}>
                Refresh
            </Button>
            <Button>
                <Plus className="mr-2 h-4 w-4" /> Create Invoice
            </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dispatched / En-Route</CardTitle>
            <Truck className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dispatchedTx.length}</div>
            <p className="text-xs text-muted-foreground">Require reconciliation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Action Required</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTx.length}</div>
            <p className="text-xs text-muted-foreground">Unpaid invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="all">All Outstanding</TabsTrigger>
              <TabsTrigger value="dispatched">Dispatched</TabsTrigger>
              <TabsTrigger value="pending">Unpaid</TabsTrigger>
            </TabsList>
            
            <div className="relative w-full sm:w-64">
               <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input placeholder="Search..." className="pl-8" />
            </div>
        </div>

        <TabsContent value="all">
          <Card><CardContent className="p-0"><TransactionTable data={transactions} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="dispatched">
          <Card><CardContent className="p-0"><TransactionTable data={dispatchedTx} /></CardContent></Card>
        </TabsContent>
        <TabsContent value="pending">
          <Card><CardContent className="p-0"><TransactionTable data={pendingTx} /></CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Components */}
      <PaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        transactionId={activeTxId}
      />

      <ReconciliationDialog
        open={isReconcileOpen}
        onOpenChange={setIsReconcileOpen}
        transactionId={activeTxId}
        fulfillmentId={activeTransaction?.fulfillmentId}
      />
    </div>
  );
}