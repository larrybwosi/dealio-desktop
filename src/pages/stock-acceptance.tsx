'use client';

import React, { useState, useRef } from 'react';
import { Camera, Upload, Plus, Check, X, FileText, Save, AlertCircle, Package, Truck, Calendar, Building2, Edit2, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/pos-auth-store';
import { FileReceiveDialog } from '@/components/file-receive';
import { downloadDir, join } from '@tauri-apps/api/path';

interface DeliveryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  expectedQuantity: number;
  receivedQuantity: number;
  unitPrice: number;
  qualityStatus: 'pending' | 'approved' | 'rejected' | 'partial';
  qualityNotes: string;
  rejectedQuantity: number;
  expiryDate?: string;
  batchNumber?: string;
}

interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

export default function StockDeliveryPage() {
  const [deliveryReference, setDeliveryReference] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Dialog state
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DeliveryItem | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<DeliveryItem | null>(null);
  
  const { currentLocation } = useAuthStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Mock suppliers
  const suppliers: Supplier[] = [
    { id: '1', name: 'ABC Wholesale Ltd', code: 'ABC001' },
    { id: '2', name: 'Premium Suppliers Inc', code: 'PREM002' },
    { id: '3', name: 'Fresh Goods Co', code: 'FG003' },
  ];

  // Mock products
  const availableProducts = [
    { id: 'p1', name: 'Product A', sku: 'SKU001' },
    { id: 'p2', name: 'Product B', sku: 'SKU002' },
    { id: 'p3', name: 'Product C', sku: 'SKU003' },
  ];

  const openAddItemDialog = () => {
    setEditingItem({
      id: `item-${Date.now()}`,
      productId: '',
      productName: '',
      sku: '',
      expectedQuantity: 0,
      receivedQuantity: 0,
      unitPrice: 0,
      qualityStatus: 'pending',
      qualityNotes: '',
      rejectedQuantity: 0,
      expiryDate: '',
      batchNumber: '',
    });
    setIsItemDialogOpen(true);
  };

  const openEditItemDialog = (item: DeliveryItem) => {
    setEditingItem({ ...item });
    setIsItemDialogOpen(true);
  };

  const openViewItemDialog = (item: DeliveryItem) => {
    setViewingItem(item);
    setIsViewDialogOpen(true);
  };

  const handleSaveItem = () => {
    if (!editingItem) return;

    // Validation
    if (!editingItem.productId) {
      toast.error('Please select a product');
      return;
    }
    if (editingItem.receivedQuantity <= 0) {
      toast.error('Received quantity must be greater than 0');
      return;
    }
    if (editingItem.qualityStatus === 'pending') {
      toast.error('Please complete the quality check');
      return;
    }

    const existingIndex = deliveryItems.findIndex(item => item.id === editingItem.id);
    
    if (existingIndex >= 0) {
      // Update existing item
      setDeliveryItems(deliveryItems.map(item => 
        item.id === editingItem.id ? editingItem : item
      ));
      toast.success('Item updated successfully');
    } else {
      // Add new item
      setDeliveryItems([...deliveryItems, editingItem]);
      toast.success('Item added successfully');
    }

    setIsItemDialogOpen(false);
    setEditingItem(null);
  };

  const removeDeliveryItem = (id: string) => {
    setDeliveryItems(deliveryItems.filter(item => item.id !== id));
    toast.success('Item removed');
  };

  const updateEditingItem = (updates: Partial<DeliveryItem>) => {
    if (editingItem) {
      setEditingItem({ ...editingItem, ...updates });
    }
  };

  const handleProductSelect = (productId: string) => {
    const product = availableProducts.find(p => p.id === productId);
    if (product) {
      updateEditingItem({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
      });
    }
  };

  const handleQualityCheck = (status: 'approved' | 'rejected' | 'partial') => {
    if (!editingItem) return;

    let updates: Partial<DeliveryItem> = { qualityStatus: status };

    if (status === 'approved') {
      updates.rejectedQuantity = 0;
    } else if (status === 'rejected') {
      updates.rejectedQuantity = editingItem.receivedQuantity;
    }

    updateEditingItem(updates);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const mockUrl = URL.createObjectURL(file);
      
      const newDocument: UploadedDocument = {
        id: `doc-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: file.type,
        url: mockUrl,
        size: file.size,
        uploadedAt: new Date(),
      };

      setDocuments(prev => [...prev, newDocument]);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(event);
  };

  const removeDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  const calculateTotals = () => {
    const totalExpected = deliveryItems.reduce((sum, item) => sum + item.expectedQuantity, 0);
    const totalReceived = deliveryItems.reduce((sum, item) => sum + item.receivedQuantity, 0);
    const totalRejected = deliveryItems.reduce((sum, item) => sum + item.rejectedQuantity, 0);
    const totalValue = deliveryItems.reduce((sum, item) => 
      sum + (item.receivedQuantity - item.rejectedQuantity) * item.unitPrice, 0
    );

    return { totalExpected, totalReceived, totalRejected, totalValue };
  };

  const validateDelivery = (): string[] => {
    const errors: string[] = [];

    if (!deliveryReference.trim()) {
      errors.push('Delivery reference is required');
    }
    if (!selectedSupplier) {
      errors.push('Supplier must be selected');
    }
    if (deliveryItems.length === 0) {
      errors.push('At least one item must be added');
    }

    return errors;
  };

  const handlePhoneFile = async (fileName: string) => {
    const downloadPath = await downloadDir();
    const filePath = await join(downloadPath, fileName);
    const assetUrl = convertFileSrc(filePath);
    const newDoc: UploadedDocument = {
      id: crypto.randomUUID(), 
      name: fileName,
      type: 'image/jpeg',      
      size: 0,       
      url: assetUrl,          
      uploadedAt: new Date(),
    };

    // @ts-ignore
    setDocuments(prev => [...prev, newDoc]);
    toast.success(`Received ${fileName} from phone`);
  };

  const handleSaveDelivery = async () => {
    const errors = validateDelivery();
    
    if (errors.length > 0) {
      toast.error(errors.join(', '));
      return;
    }

    setIsSaving(true);

    const filePaths = documents.map(doc => doc.url.replace('asset://', '')); 
    
    try {
      const deliveryData = {
        supplierId: selectedSupplier,
        purchaseId: undefined,
        locationId: currentLocation?.id,
        notes: generalNotes,
        receivedDate: new Date(deliveryDate).toISOString(), 
        filePaths,
        items: deliveryItems.map(item => ({
          variantId: item.productId,
          quantity: item.receivedQuantity - item.rejectedQuantity,
          unitCost: item.unitPrice,
          batchNumber: item.batchNumber || undefined,
          expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : undefined,
        }))
      };

      await invoke('submit_delivery', { payload: deliveryData });
      toast.success('Delivery saved successfully!');
      resetForm();
    } catch (error) {
      console.error('Error saving delivery:', error);
      toast.error('Failed to save delivery. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setDeliveryReference('');
    setSelectedSupplier('');
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setDeliveryItems([]);
    setDocuments([]);
    setGeneralNotes('');
  };

  const totals = calculateTotals();

  const getQualityBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      case 'partial': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Stock Delivery</h1>
          <p className="text-muted-foreground mt-1">Record and verify incoming stock from suppliers</p>
        </div>
        <Package className="w-12 h-12 text-muted-foreground opacity-20" />
      </div>

      {/* Delivery Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <CardTitle>Delivery Information</CardTitle>
          </div>
          <CardDescription>Enter the basic details of the stock delivery</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="reference" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Delivery Reference *
              </Label>
              <Input
                id="reference"
                placeholder="e.g., DEL-2024-001"
                value={deliveryReference}
                onChange={(e) => setDeliveryReference(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Supplier *
              </Label>
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Delivery Date *
              </Label>
              <Input
                id="date"
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <CardTitle>Delivery Items</CardTitle>
              </div>
              <CardDescription className="mt-1">
                {deliveryItems.length === 0 
                  ? 'No items added yet' 
                  : `${deliveryItems.length} item${deliveryItems.length !== 1 ? 's' : ''} added`}
              </CardDescription>
            </div>
            <Button onClick={openAddItemDialog}>
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deliveryItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
              <Package className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-medium">No items added yet</p>
              <p className="text-sm text-muted-foreground mt-1">Click "Add Item" to start adding products</p>
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Expected</TableHead>
                    <TableHead className="text-center">Received</TableHead>
                    <TableHead className="text-center">Rejected</TableHead>
                    <TableHead className="text-center">Accepted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-muted-foreground">{item.sku}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">{item.expectedQuantity}</TableCell>
                      <TableCell className="text-center">
                        <span className={item.receivedQuantity !== item.expectedQuantity ? 'text-yellow-600 font-semibold' : ''}>
                          {item.receivedQuantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.rejectedQuantity > 0 && (
                          <span className="text-destructive font-semibold">{item.rejectedQuantity}</span>
                        )}
                        {item.rejectedQuantity === 0 && '-'}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {item.receivedQuantity - item.rejectedQuantity}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getQualityBadgeVariant(item.qualityStatus)}>
                          {item.qualityStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${((item.receivedQuantity - item.rejectedQuantity) * item.unitPrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewItemDialog(item)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditItemDialog(item)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDeliveryItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <CardTitle>Supporting Documents</CardTitle>
          </div>
          <CardDescription>Upload delivery notes, invoices, or other supporting documents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Files
            </Button>
            
            <Button
              type="button"
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="w-4 h-4 mr-2" />
              Scan Document
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleCameraCapture}
              className="hidden"
            />

            <Separator className="my-2" />
            
            <FileReceiveDialog onFileReceived={handlePhoneFile} />
          </div>

          {documents.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map(doc => (
                <Card key={doc.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-muted rounded-lg">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(doc.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDocument(doc.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
          <CardDescription>Any special instructions or observations about this delivery</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Enter any additional notes about this delivery..."
            rows={4}
            className="resize-none"
          />
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Expected Items</p>
              <p className="text-3xl font-bold">{totals.totalExpected}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Received Items</p>
              <p className="text-3xl font-bold text-blue-600">{totals.totalReceived}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Rejected Items</p>
              <p className="text-3xl font-bold text-destructive">{totals.totalRejected}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-3xl font-bold text-green-600">${totals.totalValue.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={resetForm} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSaveDelivery} disabled={isSaving} size="lg">
            {isSaving ? (
              <>Saving...</>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Delivery
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Add/Edit Item Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem && deliveryItems.find(i => i.id === editingItem.id) ? 'Edit Item' : 'Add Item'}
            </DialogTitle>
            <DialogDescription>
              Enter the details of the product being delivered
            </DialogDescription>
          </DialogHeader>

          {editingItem && (
            <div className="space-y-6 py-4">
              {/* Product Selection */}
              <div className="space-y-2">
                <Label>Product *</Label>
                <Select
                  value={editingItem.productId}
                  onValueChange={handleProductSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map(product => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Quantities */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expected Quantity</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editingItem.expectedQuantity}
                    onChange={(e) => updateEditingItem({
                      expectedQuantity: parseInt(e.target.value) || 0
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Received Quantity *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={editingItem.receivedQuantity}
                    onChange={(e) => updateEditingItem({
                      receivedQuantity: parseInt(e.target.value) || 0
                    })}
                  />
                </div>
              </div>

              {/* Pricing and Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingItem.unitPrice}
                    onChange={(e) => updateEditingItem({
                      unitPrice: parseFloat(e.target.value) || 0
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Batch Number</Label>
                  <Input
                    value={editingItem.batchNumber}
                    onChange={(e) => updateEditingItem({
                      batchNumber: e.target.value
                    })}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={editingItem.expiryDate}
                  onChange={(e) => updateEditingItem({
                    expiryDate: e.target.value
                  })}
                />
              </div>

              <Separator />

              {/* Quality Check */}
              <div className="space-y-4">
                <Label>Quality Check *</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={editingItem.qualityStatus === 'approved' ? 'default' : 'outline'}
                    onClick={() => handleQualityCheck('approved')}
                    className="w-full"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant={editingItem.qualityStatus === 'partial' ? 'default' : 'outline'}
                    onClick={() => handleQualityCheck('partial')}
                    className="w-full"
                  >
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Partial
                  </Button>
                  <Button
                    type="button"
                    variant={editingItem.qualityStatus === 'rejected' ? 'destructive' : 'outline'}
                    onClick={() => handleQualityCheck('rejected')}
                    className="w-full"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>

                {editingItem.qualityStatus !== 'pending' && (
                  <>
                    {(editingItem.qualityStatus === 'partial' || editingItem.qualityStatus === 'rejected') && (
                      <div className="space-y-2">
                        <Label>Rejected Quantity</Label>
                        <Input
                          type="number"
                          min="0"
                          max={editingItem.receivedQuantity}
                          value={editingItem.rejectedQuantity}
                          onChange={(e) => {
                            const rejected = parseInt(e.target.value) || 0;
                            updateEditingItem({
                              rejectedQuantity: Math.min(rejected, editingItem.receivedQuantity)
                            });
                          }}
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Quality Notes</Label>
                      <Textarea
                        value={editingItem.qualityNotes}
                        onChange={(e) => updateEditingItem({
                          qualityNotes: e.target.value
                        })}
                        placeholder="Enter any quality issues or notes..."
                        rows={3}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Summary */}
              {editingItem.receivedQuantity > 0 && editingItem.qualityStatus !== 'pending' && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <p><strong>Accepted:</strong> {editingItem.receivedQuantity - editingItem.rejectedQuantity} units</p>
                      {editingItem.rejectedQuantity > 0 && (
                        <p><strong>Rejected:</strong> {editingItem.rejectedQuantity} units</p>
                      )}
                      {editingItem.unitPrice > 0 && (
                        <p><strong>Value:</strong> ${((editingItem.receivedQuantity - editingItem.rejectedQuantity) * editingItem.unitPrice).toFixed(2)}</p>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveItem}>
              <Check className="w-4 h-4 mr-2" />
              Save Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Item Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Item Details</DialogTitle>
            <DialogDescription>View complete information about this delivery item</DialogDescription>
          </DialogHeader>

          {viewingItem && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p className="font-medium">{viewingItem.productName}</p>
                  <p className="text-sm text-muted-foreground">{viewingItem.sku}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={getQualityBadgeVariant(viewingItem.qualityStatus)} className="mt-1">
                    {viewingItem.qualityStatus}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Expected</p>
                  <p className="text-2xl font-bold">{viewingItem.expectedQuantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Received</p>
                  <p className="text-2xl font-bold">{viewingItem.receivedQuantity}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Accepted</p>
                  <p className="text-2xl font-bold text-green-600">
                    {viewingItem.receivedQuantity - viewingItem.rejectedQuantity}
                  </p>
                </div>
              </div>

              {viewingItem.rejectedQuantity > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground">Rejected Quantity</p>
                    <p className="text-2xl font-bold text-destructive">{viewingItem.rejectedQuantity}</p>
                  </div>
                </>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Unit Price</p>
                  <p className="font-medium">${viewingItem.unitPrice.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="font-medium text-green-600">
                    ${((viewingItem.receivedQuantity - viewingItem.rejectedQuantity) * viewingItem.unitPrice).toFixed(2)}
                  </p>
                </div>
              </div>

              {(viewingItem.batchNumber || viewingItem.expiryDate) && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    {viewingItem.batchNumber && (
                      <div>
                        <p className="text-sm text-muted-foreground">Batch Number</p>
                        <p className="font-medium">{viewingItem.batchNumber}</p>
                      </div>
                    )}
                    {viewingItem.expiryDate && (
                      <div>
                        <p className="text-sm text-muted-foreground">Expiry Date</p>
                        <p className="font-medium">
                          {new Date(viewingItem.expiryDate).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {viewingItem.qualityNotes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Quality Notes</p>
                    <p className="text-sm">{viewingItem.qualityNotes}</p>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}