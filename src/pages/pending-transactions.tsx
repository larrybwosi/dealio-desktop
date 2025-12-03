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
  invoiceLink?: string; 
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

  // --- Handlers ---
  const handleOpenPayment = (txId: string) => {
    setActiveTxId(txId);
    setIsPaymentOpen(true);
  };

  const handleOpenReconcile = (txId: string) => {
    setActiveTxId(txId);
    setIsReconcileOpen(true);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    refetch();
  };

  const handleDownloadInvoice = async (tx: Transaction) => {
    if (!tx.invoiceLink) return;
    if (isDownloading) return;

    setIsDownloading(true);

    try {
      // 1. Fetch the file as a Blob from the API link
      const response = await apiClient.get(tx.invoiceLink, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });

      // Clean up filename
      const safeOrderNum = (tx.number || tx.id).replace(/[^a-z0-9]/gi, '_');
      const fileName = `Receipt_${safeOrderNum}.pdf`;

      if (isTauri()) {
        // --- TAURI DOWNLOAD LOGIC ---
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Ensure 'Dealio' directory exists in Downloads
        if (!(await exists('Dealio', { baseDir: BaseDirectory.Download }))) {
          await mkdir('Dealio', { baseDir: BaseDirectory.Download, recursive: true });
        }

        const documentDirPath = await documentDir();
        const dealioFolderPath = `${documentDirPath}/Dealio`;
        const filePath = `${dealioFolderPath}/${fileName}`;
        
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
        // --- BROWSER DOWNLOAD LOGIC ---
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
    }
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
            {/* Enhanced Refresh Button */}
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
        transactionId={activeTxId}
        fulfillmentId={activeTransaction?.fulfillmentId}
      />
    </div>
  );
}