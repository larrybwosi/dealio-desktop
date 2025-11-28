import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  ArrowUpRight, 
  Clock, 
  AlertCircle,
  CreditCard,
  Banknote,
  FileText,
  CheckCircle2
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// --- Types ---
type TransactionStatus = 'pending' | 'partially_paid' | 'paid';
type PaymentMethod = 'credit_card' | 'bank_transfer' | 'cash' | 'check';

interface Transaction {
  id: string;
  customer: string;
  email: string;
  totalAmount: number;
  paidAmount: number;
  date: string;
  status: TransactionStatus;
}

interface PaymentFormData {
  amount: string;
  method: PaymentMethod | '';
  reference: string;
  notes: string;
}

// --- Mock Data ---
const initialTransactions: Transaction[] = [
  { id: "INV-001", customer: "Acme Corp", email: "finance@acme.com", totalAmount: 1200.00, paidAmount: 0, date: "2023-10-25", status: "pending" },
  { id: "INV-002", customer: "Globex Inc", email: "billing@globex.com", totalAmount: 5000.00, paidAmount: 2500.00, date: "2023-10-28", status: "partially_paid" },
  { id: "INV-003", customer: "Soylent Corp", email: "pay@soylent.com", totalAmount: 750.00, paidAmount: 100.00, date: "2023-11-01", status: "partially_paid" },
  { id: "INV-004", customer: "Initech", email: "peter@initech.com", totalAmount: 2400.00, paidAmount: 0, date: "2023-11-05", status: "pending" },
  { id: "INV-005", customer: "Umbrella Corp", email: "alice@umbrella.com", totalAmount: 10000.00, paidAmount: 0, date: "2023-11-10", status: "pending" },
];

export default function PaymentDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  
  // Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTxId, setActiveTxId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<PaymentFormData>({
    amount: '',
    method: '',
    reference: '',
    notes: ''
  });

  // --- Helpers ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getActiveTransaction = () => transactions.find(t => t.id === activeTxId);

  // --- Handlers ---
  const openPaymentDialog = (txId: string) => {
    setActiveTxId(txId);
    setFormData({ amount: '', method: '', reference: '', notes: '' });
    setIsDialogOpen(true);
  };

  const handleFormChange = (field: keyof PaymentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

const handleAddPayment = async () => {
    if (!activeTxId || !formData.amount || !formData.method) return;

    try {
        const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transactionId: activeTxId,
                amount: formData.amount,
                method: formData.method,
                reference: formData.reference,
                notes: formData.notes
            })
        });

        if (!res.ok) throw new Error("Payment failed");

        // Optimistic UI update or Re-fetch
        // Option A: Re-fetch all data (easiest)
        const refreshRes = await fetch('/api/transactions');
        const newData = await refreshRes.json();
        setTransactions(newData);
        
        // Reset and close
        setIsDialogOpen(false);
        setFormData({ amount: '', method: '', reference: '', notes: '' });

    } catch (error) {
        console.error("Error saving payment", error);
        // You could add a toast notification here
    }
};

  // Filter Logic
  const pendingTx = transactions.filter(t => t.status === 'pending');
  const partialTx = transactions.filter(t => t.status === 'partially_paid');
  const totalOutstanding = transactions.reduce((acc, curr) => acc + (curr.totalAmount - curr.paidAmount), 0);

  // Reusable Table Component
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
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
              No transactions found.
            </TableCell>
          </TableRow>
        ) : (
          data.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="font-medium">{tx.id}</TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{tx.customer}</span>
                  <span className="text-xs text-muted-foreground">{tx.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={tx.status === 'pending' ? 'destructive' : 'secondary'} className="capitalize">
                  {tx.status.replace('_', ' ')}
                </Badge>
              </TableCell>
              <TableCell className="w-[250px]">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                       Paid: {formatCurrency(tx.paidAmount)}
                    </span>
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
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem 
                      onClick={() => navigator.clipboard.writeText(tx.id)}
                    >
                      Copy ID
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => openPaymentDialog(tx.id)}>
                      <Plus className="mr-2 h-4 w-4" /> Add Payment
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <FileText className="mr-2 h-4 w-4" /> View Invoice
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

  return (
    // 'dark' class is usually on HTML, but here we use bg-background text-foreground for semantics
    <div className="min-h-screen bg-background text-foreground p-8 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground mt-1">Manage payments, balances, and outstanding invoices.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline">
                <FileText className="mr-2 h-4 w-4" /> Reports
            </Button>
            <Button>
                <Plus className="mr-2 h-4 w-4" /> Create Invoice
            </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">Total receivables</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Action</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingTx.length}</div>
            <p className="text-xs text-muted-foreground">Invoices with $0 payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{partialTx.length}</div>
            <p className="text-xs text-muted-foreground">Partially paid invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Interface */}
      <Tabs defaultValue="all" className="w-full">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <TabsList>
              <TabsTrigger value="all">All Outstanding</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="partial">Partially Paid</TabsTrigger>
            </TabsList>
            
            <div className="relative w-full sm:w-64">
               <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
               <Input placeholder="Search..." className="pl-8" />
            </div>
        </div>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
               <TransactionTable data={transactions.filter(t => t.status !== 'paid')} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="pending">
          <Card>
            <CardContent className="p-0">
               <TransactionTable data={pendingTx} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="partial">
          <Card>
            <CardContent className="p-0">
               <TransactionTable data={partialTx} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Add a payment for invoice <span className="font-mono font-bold text-foreground">{activeTxId}</span>.
            </DialogDescription>
          </DialogHeader>
          
          {getActiveTransaction() && (
            <div className="grid gap-6 py-4">
              
              {/* Context Info */}
              <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border">
                 <div className="text-sm">
                    <p className="text-muted-foreground">Current Balance</p>
                    <p className="font-bold text-lg">
                        {formatCurrency(getActiveTransaction()!.totalAmount - getActiveTransaction()!.paidAmount)}
                    </p>
                 </div>
                 <div className="text-right text-sm">
                    <p className="text-muted-foreground">Total Invoice</p>
                    <p className="font-medium">{formatCurrency(getActiveTransaction()!.totalAmount)}</p>
                 </div>
              </div>

              <div className="grid gap-4">
                {/* Row 1: Method & Amount */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="method">Payment Method</Label>
                        <Select 
                            value={formData.method} 
                            onValueChange={(val) => handleFormChange('method', val)}
                        >
                        <SelectTrigger>
                            <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="credit_card">Credit Card</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="check">Check</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="amount">Amount</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                            <Input 
                                id="amount" 
                                type="number" 
                                className="pl-7" 
                                placeholder="0.00"
                                value={formData.amount}
                                onChange={(e) => handleFormChange('amount', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Row 2: Reference */}
                <div className="grid gap-2">
                    <Label htmlFor="reference">Reference / Transaction ID</Label>
                    <Input 
                        id="reference" 
                        placeholder="e.g. TRX-883920"
                        value={formData.reference}
                        onChange={(e) => handleFormChange('reference', e.target.value)}
                    />
                </div>

                {/* Row 3: Notes */}
                <div className="grid gap-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea 
                        id="notes" 
                        placeholder="Add details about this payment..." 
                        value={formData.notes}
                        onChange={(e) => handleFormChange('notes', e.target.value)}
                    />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPayment} disabled={!formData.amount || !formData.method}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}