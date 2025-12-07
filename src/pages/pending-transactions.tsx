// pending-transactions-page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  AlertCircle,
  Banknote,
  Truck,
  RefreshCw, 
  Loader2    
} from 'lucide-react';
import { toast } from 'sonner'; 

import { isTauri } from '@tauri-apps/api/core';
import { writeFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import { documentDir } from '@tauri-apps/api/path';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiClient } from '@/lib/axios';
import { PaymentDialog } from '@/components/pending-page/payment';
import { ReconciliationDialog } from '@/components/pending-page/reconcile';
import { DispatchDialog } from '@/components/pending-page/dispatch-dialog'; // Import DispatchDialog
import { useSearchParams } from 'react-router';

// Import the new components
import { TransactionRow } from '@/components/pending-page/transaction-row';
import { Transaction } from '@/types';

// --- Fetch Functions ---
const fetchTransactions = async (locationId?: string) => {
  const params = locationId ? { locationId } : {};
  const { data } = await apiClient.get<Transaction[]>('/api/v1/pos/sale', { params });
  return data;
};

// Fetch drivers function
const fetchDrivers = async () => {
  const { data } = await apiClient.get('/api/v1/drivers');
  return data;
};

interface DriverOption {
  id: string;
  member: {
    name: string;
  };
}

export default function PendingTransactionsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  
  // Get the ID from URL if it exists (e.g., /transactions?id=123)
  const [highlightId] = searchParams;

  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [isDispatchOpen, setIsDispatchOpen] = useState(false); // New state for dispatch dialog
  
  // State to control which dropdown is open programmatically
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // State for download tracking
  const [isDownloading, setIsDownloading] = useState(false);

  // --- Query: Get Transactions ---
  const { 
    data: transactions = [], 
    isLoading, 
    isRefetching, 
    refetch 
  } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => fetchTransactions(),
  });

  // --- Query: Get Drivers ---
  const { 
    data: drivers = [], 
    // isLoading: isLoadingDrivers 
  } = useQuery<DriverOption[]>({
    queryKey: ['drivers'],
    queryFn: () => fetchDrivers(),
    enabled: isDispatchOpen, // Only fetch when dispatch dialog is open
  });

  // --- Effect: Handle Deep Linking / Highlighting ---
  useEffect(() => {
    if (highlightId && transactions.length > 0 && !isLoading) {
      // 1. Open the menu for this transaction
      setOpenMenuId(highlightId.get('id'));

      // 2. Scroll the row into view
      const rowElement = document.getElementById(`tx-row-${highlightId}`);
      if (rowElement) {
        rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightId, transactions, isLoading]);

  // --- Handlers ---
  const handleOpenPayment = (txId: string) => {
    setActiveTxId(txId);
    setIsPaymentOpen(true);
    setOpenMenuId(null); // Close menu after action
  };

  const handleOpenReconcile = (txId: string) => {
    setActiveTxId(txId);
    setIsReconcileOpen(true);
    setOpenMenuId(null);
  };

  const handleOpenDispatch = (txId: string) => { // New handler
    setActiveTxId(txId);
    setIsDispatchOpen(true);
    setOpenMenuId(null);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    refetch();
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    toast.success('Transaction ID copied to clipboard');
  };

  const handleDownloadInvoice = async (tx: Transaction) => {
    if (!tx.invoiceLink) return;
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      const response = await apiClient.get(tx.invoiceLink, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const safeOrderNum = (tx.number || tx.id).replace(/[^a-z0-9]/gi, '_');
      const fileName = `Receipt_${safeOrderNum}.pdf`;

      if (isTauri()) {
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        if (!(await exists('Dealio', { baseDir: BaseDirectory.Download }))) {
          await mkdir('Dealio', { baseDir: BaseDirectory.Download, recursive: true });
        }
        const documentDirPath = await documentDir();
        const filePath = `${documentDirPath}/Dealio/${fileName}`;
        await writeFile(filePath, uint8Array, { baseDir: BaseDirectory.Download });
        
        toast.success('Saved to Downloads', {
          action: {
            label: 'Open',
            onClick: async () => {
              try {
                const { openPath } = await import('@tauri-apps/plugin-opener');
                await openPath(filePath);
              } catch (e) {
                console.error('Could not open file', e);
              }
            },
          },
          duration: 5000,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Download started');
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to save receipt');
    } finally {
      setIsDownloading(false);
      setOpenMenuId(null);
    }
  };

  const handleOpenMenuChange = (isOpen: boolean, txId: string) => {
    setOpenMenuId(isOpen ? txId : null);
  };

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KSH' }).format(amount);

  const getActiveTransaction = () => transactions.find(t => t.id === activeTxId);

  const pendingTx = transactions.filter(t => t.status === 'pending');
  const dispatchedTx = transactions.filter(t => t.status === 'dispatched');
  const totalOutstanding = transactions.reduce((acc, curr) => acc + (curr.totalAmount - curr.paidAmount), 0);

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
        {isLoading && data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center h-24">
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading transactions...
              </div>
            </TableCell>
          </TableRow>
        ) : data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
              No transactions found.
            </TableCell>
          </TableRow>
        ) : (
          data.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              isHighlighted={tx.id === highlightId.get('id')}
              isDownloading={isDownloading}
              openMenuId={openMenuId}
              onOpenMenuChange={(isOpen) => handleOpenMenuChange(isOpen, tx.id)}
              onCopyId={handleCopyId}
              onDownloadInvoice={handleDownloadInvoice}
              onOpenReconcile={handleOpenReconcile}
              onOpenPayment={handleOpenPayment}
              onOpenDispatch={handleOpenDispatch} // Pass dispatch handler
            />
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
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isLoading || isRefetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
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
        fulfillmentId={activeTransaction?.fulfillmentId}
      />

      {/* Dispatch Dialog */}
      <DispatchDialog
        open={isDispatchOpen}
        onOpenChange={setIsDispatchOpen}
        transactionId={activeTxId || ''}
        drivers={drivers}
      />
    </div>
  );
}