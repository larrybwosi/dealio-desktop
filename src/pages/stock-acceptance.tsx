'use client';

import { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  AlertCircle, 
  Search, 
  Filter, 
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/pos-auth-store';

// --- Types matching Rust Backend ---

interface StockBatchProduct {
  name: string;
  sku: string;
}

interface StockBatchVariant {
  product: StockBatchProduct;
}

interface StockBatch {
  id: string;
  organizationId: string;
  locationId: string;
  qualityCheckStatus: 'PENDING' | 'PASSED' | 'FAILED';
  receivedDate: string;
  initialQuantity: string; 
  currentQuantity: string; 
  variant: StockBatchVariant;
}

interface StockBatchResponse {
  data: StockBatch[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface StockProcessRequest {
  batchId: string;
  locationId: string;
  action: 'ACCEPT' | 'REJECT' | 'PARTIAL';
  acceptedQuantity?: number;
  rejectedQuantity?: number;
  reason?: string;
  notes?: string;
}

export default function StockAcceptancePage() {
  const { currentLocation } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  
  // Processing State
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  
  // Form State for QC
  const [qcAction, setQcAction] = useState<'ACCEPT' | 'REJECT' | 'PARTIAL'>('ACCEPT');
  const [acceptedQty, setAcceptedQty] = useState<string>('');
  const [rejectedQty, setRejectedQty] = useState<string>('');
  const [qcNotes, setQcNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initial Data Fetch
  useEffect(() => {
    if (currentLocation?.id) {
      fetchPendingStock();
    }
  }, [currentLocation]);

  const fetchPendingStock = async () => {
    if (!currentLocation?.id) return;
    
    setIsLoading(true);
    try {
      const response = await invoke<StockBatchResponse>('fetch_pending_stock', {
        locationId: currentLocation.id,
        page: 1,
        limit: 50
      });
      setBatches(response.data);
    } catch (error) {
      console.error('Failed to fetch stock:', error);
      toast.error('Failed to load pending stock items');
    } finally {
      setIsLoading(false);
    }
  };

  const openProcessDialog = (batch: StockBatch) => {
    setSelectedBatch(batch);
    // Reset form defaults
    setQcAction('ACCEPT');
    setAcceptedQty(batch.currentQuantity); // Default to full acceptance
    setRejectedQty('0');
    setQcNotes('');
    setIsProcessDialogOpen(true);
  };

  const handleActionChange = (action: 'ACCEPT' | 'REJECT' | 'PARTIAL') => {
    setQcAction(action);
    if (!selectedBatch) return;

    const total = parseFloat(selectedBatch.currentQuantity);

    if (action === 'ACCEPT') {
      setAcceptedQty(total.toString());
      setRejectedQty('0');
    } else if (action === 'REJECT') {
      setAcceptedQty('0');
      setRejectedQty(total.toString());
    } else {
      // Partial: reset to force user entry or keep previous valid values
      setAcceptedQty('');
      setRejectedQty('');
    }
  };

  const validateSubmission = (): boolean => {
    if (!selectedBatch) return false;
    
    const total = parseFloat(selectedBatch.currentQuantity);
    const acc = parseFloat(acceptedQty) || 0;
    const rej = parseFloat(rejectedQty) || 0;

    if (acc < 0 || rej < 0) {
      toast.error('Quantities cannot be negative');
      return false;
    }

    // Floating point comparison tolerance
    if (Math.abs((acc + rej) - total) > 0.001) {
      toast.error(`Total quantity (${acc + rej}) must equal batch quantity (${total})`);
      return false;
    }

    if (qcAction === 'REJECT' && !qcNotes.trim()) {
      toast.error('Please provide a reason/note for rejection');
      return false;
    }

    return true;
  };

  const handleSubmitProcess = async () => {
    if (!selectedBatch || !currentLocation?.id) return;
    if (!validateSubmission()) return;

    setIsSubmitting(true);

    try {
      const payload: StockProcessRequest = {
        batchId: selectedBatch.id,
        locationId: currentLocation.id,
        action: qcAction,
        acceptedQuantity: parseFloat(acceptedQty) || 0,
        rejectedQuantity: parseFloat(rejectedQty) || 0,
        notes: qcNotes,
        reason: qcAction !== 'ACCEPT' ? 'Quality Check' : undefined
      };

      await invoke('submit_stock_process', { payload });
      
      toast.success('Stock processed successfully');
      setIsProcessDialogOpen(false);
      fetchPendingStock(); // Refresh list
    } catch (error) {
      console.error('Process error:', error);
      toast.error('Failed to process stock batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to safely display decimals
  const formatQty = (qty: string | number) => {
    const num = typeof qty === 'string' ? parseFloat(qty) : qty;
    return isNaN(num) ? '0' : num.toString();
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Acceptance</h1>
          <p className="text-muted-foreground mt-1">Review and process pending inventory deliveries</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchPendingStock} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="grid gap-6">
        {/* Filters / Search Bar (Placeholder for future expansion) */}
        <Card className="bg-muted/40 border-none shadow-none">
          <CardContent className="p-4 flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by SKU or Product Name..."
                className="pl-8 bg-background"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Showing pending items for <strong>{currentLocation?.name || 'Unknown Location'}</strong></span>
            </div>
          </CardContent>
        </Card>

        {/* Pending Stock Table */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Quality Checks</CardTitle>
            <CardDescription>
              {batches.length === 0 
                ? "No pending items found." 
                : `${batches.length} batch${batches.length === 1 ? '' : 'es'} waiting for approval.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-green-50 p-4 rounded-full mb-4">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold">All Caught Up!</h3>
                <p className="text-muted-foreground">There are no pending stock items to review.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Received Date</TableHead>
                    <TableHead>Product Details</TableHead>
                    <TableHead className="text-center">Initial Qty</TableHead>
                    <TableHead className="text-center">Current Qty</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-medium">
                        {new Date(batch.receivedDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold">{batch.variant.product.name}</span>
                          <span className="text-xs text-muted-foreground">SKU: {batch.variant.product.sku}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {formatQty(batch.initialQuantity)}
                      </TableCell>
                      <TableCell className="text-center font-bold text-lg">
                        {formatQty(batch.currentQuantity)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                          {batch.qualityCheckStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => openProcessDialog(batch)}>
                          Process
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quality Check / Processing Dialog */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Process Stock</DialogTitle>
            <DialogDescription>
              Verify quality and quantity for <strong>{selectedBatch?.variant.product.name}</strong>
            </DialogDescription>
          </DialogHeader>

          {selectedBatch && (
            <div className="space-y-6 py-4">
              {/* Action Selector */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleActionChange('ACCEPT')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    qcAction === 'ACCEPT' 
                      ? 'border-green-600 bg-green-50 text-green-700' 
                      : 'border-muted hover:border-green-200'
                  }`}
                >
                  <Check className="h-6 w-6 mb-2" />
                  <span className="text-sm font-semibold">Accept All</span>
                </button>

                <button
                  onClick={() => handleActionChange('PARTIAL')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    qcAction === 'PARTIAL' 
                      ? 'border-orange-500 bg-orange-50 text-orange-700' 
                      : 'border-muted hover:border-orange-200'
                  }`}
                >
                  <AlertCircle className="h-6 w-6 mb-2" />
                  <span className="text-sm font-semibold">Partial</span>
                </button>

                <button
                  onClick={() => handleActionChange('REJECT')}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${
                    qcAction === 'REJECT' 
                      ? 'border-red-600 bg-red-50 text-red-700' 
                      : 'border-muted hover:border-red-200'
                  }`}
                >
                  <X className="h-6 w-6 mb-2" />
                  <span className="text-sm font-semibold">Reject All</span>
                </button>
              </div>

              <Separator />

              {/* Quantity Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-green-700">Accepted Quantity</Label>
                  <Input 
                    type="number" 
                    value={acceptedQty}
                    onChange={(e) => setAcceptedQty(e.target.value)}
                    disabled={qcAction === 'ACCEPT' || qcAction === 'REJECT'}
                    className={qcAction === 'ACCEPT' ? 'bg-green-50 font-bold' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-red-700">Rejected Quantity</Label>
                  <Input 
                    type="number" 
                    value={rejectedQty}
                    onChange={(e) => setRejectedQty(e.target.value)}
                    disabled={qcAction === 'ACCEPT' || qcAction === 'REJECT'}
                    className={qcAction === 'REJECT' ? 'bg-red-50 font-bold' : ''}
                  />
                </div>
              </div>

              {/* Validation Feedback */}
              <div className="text-sm text-center text-muted-foreground">
                Total available: <span className="font-medium">{formatQty(selectedBatch.currentQuantity)}</span> units
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes / Reason {qcAction === 'REJECT' && <span className="text-red-500">*</span>}</Label>
                <Textarea 
                  placeholder={qcAction === 'REJECT' ? "Reason for rejection is required..." : "Optional notes..."}
                  value={qcNotes}
                  onChange={(e) => setQcNotes(e.target.value)}
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProcessDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitProcess} 
              disabled={isSubmitting}
              className={qcAction === 'REJECT' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {isSubmitting ? 'Processing...' : 'Confirm Decision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}