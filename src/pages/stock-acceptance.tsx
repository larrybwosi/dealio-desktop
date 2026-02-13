'use client';

import { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  AlertCircle, 
  RefreshCw,
  Package,
  ArrowRight,
  FileText,
  X as XIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/pos-auth-store';
import { FileReceiveDialog } from '@/components/file-receive';

// --- Interfaces ---
interface StockBatchProduct {
  id: string;
  name: string;
  sku: string;
  imageUrls: string[];
}
interface StockBatchVariant {
  product: StockBatchProduct;
}
interface StockBatchSource {
  type: string;
  reference: string;
  name: string;
}
interface StockBatch {
  id: string;
  locationId: string;
  qualityCheckStatus: 'PENDING' | 'PASSED' | 'FAILED';
  receivedDate: string;
  initialQuantity: string;
  currentQuantity: string;
  variant: StockBatchVariant;
  source: StockBatchSource;
  batchNumber?: string;
  expiryDate?: string;
}
interface StockBatchResponse {
  data: StockBatch[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export default function StockAcceptancePage() {
  const { currentLocation } = useAuthStore();
  const locationId = currentLocation?.id;

  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Dialog State
  const [selectedBatch, setSelectedBatch] = useState<StockBatch | null>(null);
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [qcAction, setQcAction] = useState<'ACCEPT' | 'REJECT' | 'PARTIAL'>('ACCEPT');
  const [qcNotes, setQcNotes] = useState('');
  const [acceptedQty, setAcceptedQty] = useState('');
  const [rejectedQty, setRejectedQty] = useState('');
  
  // File State
  const [qcFiles, setQcFiles] = useState<string[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (locationId) {
      fetchBatches();
    }
  }, [locationId]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (selectedBatch) {
      setQcAction('ACCEPT');
      setQcNotes('');
      setAcceptedQty(selectedBatch.currentQuantity);
      setRejectedQty('0');
      setQcFiles([]); // Reset files
    }
  }, [selectedBatch, isProcessDialogOpen]);

  const fetchBatches = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const response = await invoke<StockBatchResponse>('fetch_pending_stock', {
        locationId,
        page: 1,
        limit: 50
      });
      setBatches(response.data);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load pending stock");
    } finally {
      setLoading(false);
    }
  };

  const openProcessDialog = (batch: StockBatch) => {
    setSelectedBatch(batch);
    setIsProcessDialogOpen(true);
  };

  const handleFileReceived = (path: string) => {
    if(!qcFiles.includes(path)) {
        setQcFiles(prev => [...prev, path]);
        toast.success("Document attached");
    }
  };

  const removeFile = (path: string) => {
    setQcFiles(prev => prev.filter(p => p !== path));
  };

  const handleSubmitProcess = async () => {
    if (!selectedBatch || !locationId) return;

    if (qcAction === 'PARTIAL') {
      const acc = parseFloat(acceptedQty || '0');
      const rej = parseFloat(rejectedQty || '0');
      const total = parseFloat(selectedBatch.currentQuantity);
      if (acc + rej !== total) {
        toast.error(`Quantities must sum to ${total}`);
        return;
      }
    }

    if (qcAction === 'REJECT' && !qcNotes) {
        toast.error("Please provide a reason for rejection");
        return;
    }

    setIsSubmitting(true);
    try {
      await invoke('submit_stock_process', {
        payload: {
          batchId: selectedBatch.id,
          locationId,
          action: qcAction,
          acceptedQuantity: qcAction === 'PARTIAL' ? parseFloat(acceptedQty) : undefined,
          rejectedQuantity: qcAction === 'PARTIAL' ? parseFloat(rejectedQty) : undefined,
          reason: qcAction !== 'ACCEPT' ? qcNotes : undefined,
          notes: qcNotes,
          documents: qcFiles.length > 0 ? qcFiles : undefined // Send files
        }
      });
      toast.success('Stock processed successfully');
      setIsProcessDialogOpen(false);
      fetchBatches();
    } catch (error: any) {
      console.error('Process error:', error);
      toast.error('Failed to process stock', { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Acceptance</h1>
          <p className="text-muted-foreground mt-1">Review and accept incoming inventory</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchBatches} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Pending Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                    No pending stock to review
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>
                        <div className="flex flex-col">
                            <span>{new Date(batch.receivedDate).toLocaleDateString()}</span>
                            <span className="text-xs text-muted-foreground">{new Date(batch.receivedDate).toLocaleTimeString()}</span>
                        </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{batch.source.name}</span>
                        <Badge variant="secondary" className="w-fit text-[10px] mt-1">
                          {batch.source.reference}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{batch.variant.product.name}</div>
                      <div className="text-xs text-muted-foreground">SKU: {batch.variant.product.sku}</div>
                    </TableCell>
                    <TableCell className="font-mono">{batch.currentQuantity}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => openProcessDialog(batch)}>
                        Process
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Process Dialog */}
      <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Process Stock</DialogTitle>
          </DialogHeader>
          
          {selectedBatch && (
            <div className="space-y-6 py-2">
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <div className="flex justify-between font-medium">
                    <span>{selectedBatch.variant.product.name}</span>
                    <span>x{selectedBatch.currentQuantity}</span>
                </div>
                <div className="text-xs text-muted-foreground flex justify-between">
                    <span>From: {selectedBatch.source.name}</span>
                    <span>Ref: {selectedBatch.source.reference}</span>
                </div>
              </div>

              {/* Action Selection */}
              <div className="grid grid-cols-3 gap-2">
                <Button 
                  variant={qcAction === 'ACCEPT' ? 'default' : 'outline'}
                  className={qcAction === 'ACCEPT' ? 'bg-green-600 hover:bg-green-700' : ''}
                  onClick={() => setQcAction('ACCEPT')}
                >
                  <Check className="mr-2 h-4 w-4" /> Accept
                </Button>
                <Button 
                   variant={qcAction === 'PARTIAL' ? 'default' : 'outline'}
                   className={qcAction === 'PARTIAL' ? 'bg-orange-500 hover:bg-orange-600' : ''}
                   onClick={() => setQcAction('PARTIAL')}
                >
                  <AlertCircle className="mr-2 h-4 w-4" /> Partial
                </Button>
                <Button 
                   variant={qcAction === 'REJECT' ? 'default' : 'outline'}
                   className={qcAction === 'REJECT' ? 'bg-red-600 hover:bg-red-700' : ''}
                   onClick={() => setQcAction('REJECT')}
                >
                   <X className="mr-2 h-4 w-4" /> Reject
                </Button>
              </div>

              {/* Dynamic Form Based on Action */}
              <div className="space-y-4 border p-4 rounded-md">
                {qcAction === 'PARTIAL' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Accepted Qty</Label>
                      <Input 
                        type="number" 
                        value={acceptedQty}
                        onChange={(e) => setAcceptedQty(e.target.value)}
                        className="border-green-200 focus:ring-green-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Rejected Qty</Label>
                      <Input 
                        type="number" 
                        value={rejectedQty}
                        onChange={(e) => setRejectedQty(e.target.value)}
                        className="border-red-200 focus:ring-red-500"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>
                    {qcAction === 'REJECT' ? 'Rejection Reason (Required)' : 'Notes (Optional)'}
                  </Label>
                  <Textarea 
                    placeholder={qcAction === 'REJECT' ? "e.g., Damaged packaging, Expired..." : "Any observations..."}
                    value={qcNotes}
                    onChange={(e) => setQcNotes(e.target.value)}
                    className="resize-none"
                    rows={3}
                  />
                </div>

                {/* File Attachment Section */}
                <div className="space-y-2">
                    <Label className="flex justify-between items-center">
                        <span>Attachments</span>
                        <span className="text-xs text-muted-foreground">{qcFiles.length} file(s)</span>
                    </Label>
                    
                    {/* File List */}
                    <div className="space-y-2">
                        {qcFiles.map((file, i) => (
                            <div key={i} className="flex justify-between items-center bg-muted p-2 rounded text-xs">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="h-3 w-3 flex-shrink-0" />
                                    <span className="truncate">{file.split(/[\\/]/).pop()}</span>
                                </div>
                                <Button size="icon" variant="ghost" className="h-5 w-5 flex-shrink-0" onClick={() => removeFile(file)}>
                                    <XIcon className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>

                    {/* Mobile Upload Dialog Nested */}
                    <FileReceiveDialog onFileReceived={handleFileReceived} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsProcessDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitProcess} 
              disabled={isSubmitting}
              className={
                qcAction === 'REJECT' ? 'bg-red-600 hover:bg-red-700' : 
                qcAction === 'PARTIAL' ? 'bg-orange-600 hover:bg-orange-700' : 
                'bg-green-600 hover:bg-green-700'
              }
            >
              {isSubmitting ? 'Processing...' : 'Confirm Decision'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}