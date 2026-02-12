'use client';

import React, { useState, useRef } from 'react';
import { Camera, Upload, Plus, Check, X, FileText, Save, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/pos-auth-store';

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
  
  const { currentLocation } = useAuthStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Mock suppliers - replace with actual API call
  const suppliers: Supplier[] = [
    { id: '1', name: 'ABC Wholesale Ltd', code: 'ABC001' },
    { id: '2', name: 'Premium Suppliers Inc', code: 'PREM002' },
    { id: '3', name: 'Fresh Goods Co', code: 'FG003' },
  ];

  // Mock products - replace with actual API call
  const availableProducts = [
    { id: 'p1', name: 'Product A', sku: 'SKU001' },
    { id: 'p2', name: 'Product B', sku: 'SKU002' },
    { id: 'p3', name: 'Product C', sku: 'SKU003' },
  ];

  const addDeliveryItem = () => {
    const newItem: DeliveryItem = {
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
    };
    setDeliveryItems([...deliveryItems, newItem]);
  };

  const removeDeliveryItem = (id: string) => {
    setDeliveryItems(deliveryItems.filter(item => item.id !== id));
  };

  const updateDeliveryItem = (id: string, updates: Partial<DeliveryItem>) => {
    setDeliveryItems(deliveryItems.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const handleProductSelect = (itemId: string, productId: string) => {
    const product = availableProducts.find(p => p.id === productId);
    if (product) {
      updateDeliveryItem(itemId, {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
      });
    }
  };

  const handleQualityCheck = (itemId: string, status: 'approved' | 'rejected' | 'partial') => {
    const item = deliveryItems.find(i => i.id === itemId);
    if (!item) return;

    let updates: Partial<DeliveryItem> = { qualityStatus: status };

    if (status === 'approved') {
      updates.rejectedQuantity = 0;
    } else if (status === 'rejected') {
      updates.rejectedQuantity = item.receivedQuantity;
    }

    updateDeliveryItem(itemId, updates);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      // In production, upload to server/cloud storage
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

    // Reset input
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

    deliveryItems.forEach((item, index) => {
      if (!item.productId) {
        errors.push(`Item ${index + 1}: Product must be selected`);
      }
      if (item.receivedQuantity === 0) {
        errors.push(`Item ${index + 1}: Received quantity must be greater than 0`);
      }
      if (item.qualityStatus === 'pending') {
        errors.push(`Item ${index + 1}: Quality check must be completed`);
      }
      if (item.qualityStatus === 'partial' && item.rejectedQuantity === 0) {
        errors.push(`Item ${index + 1}: Rejected quantity required for partial approval`);
      }
    });

    return errors;
  };

  const handleSaveDelivery = async () => {
    const errors = validateDelivery();
    
    if (errors.length > 0) {
      alert('Please fix the following errors:\n' + errors.join('\n'));
      return;
    }

    setIsSaving(true);

    try {
      const deliveryData = {
      supplierId: selectedSupplier,
      purchaseId: undefined,
      locationId: currentLocation?.id,
      notes: generalNotes,
      receivedDate: new Date(deliveryDate).toISOString(), 
      
      items: deliveryItems.map(item => ({
        variantId: item.productId,
        quantity: item.receivedQuantity - item.rejectedQuantity,
        unitCost: item.unitPrice,
        batchNumber: item.batchNumber || undefined,
        expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : undefined,
      }))
    };

      await invoke('submit_delivery',deliveryData);
      console.log('Saving delivery:', deliveryData);

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

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Stock Delivery</h1>
        <p className="text-muted-foreground">Record and verify incoming stock from suppliers</p>
      </div>

      {/* Delivery Header Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Delivery Information</CardTitle>
          <CardDescription>Enter the basic details of the stock delivery</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reference">Delivery Reference *</Label>
              <Input
                id="reference"
                placeholder="e.g., DEL-2024-001"
                value={deliveryReference}
                onChange={(e) => setDeliveryReference(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier *</Label>
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
              <Label htmlFor="date">Delivery Date *</Label>
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
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Delivery Items</CardTitle>
              <CardDescription>Add items received and perform quality checks</CardDescription>
            </div>
            <Button onClick={addDeliveryItem} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {deliveryItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No items added yet. Click "Add Item" to start.
            </div>
          ) : (
            <div className="space-y-4">
              {deliveryItems.map((item, index) => (
                <Card key={item.id} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Item {index + 1}</span>
                        {item.qualityStatus !== 'pending' && (
                          <Badge 
                            variant={
                              item.qualityStatus === 'approved' ? 'default' :
                              item.qualityStatus === 'rejected' ? 'destructive' :
                              'secondary'
                            }
                          >
                            {item.qualityStatus}
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDeliveryItem(item.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2 lg:col-span-2">
                        <Label>Product *</Label>
                        <Select
                          value={item.productId}
                          onValueChange={(value) => handleProductSelect(item.id, value)}
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

                      <div className="space-y-2">
                        <Label>Expected Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.expectedQuantity}
                          onChange={(e) => updateDeliveryItem(item.id, {
                            expectedQuantity: parseInt(e.target.value) || 0
                          })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Received Qty *</Label>
                        <Input
                          type="number"
                          min="0"
                          value={item.receivedQuantity}
                          onChange={(e) => updateDeliveryItem(item.id, {
                            receivedQuantity: parseInt(e.target.value) || 0
                          })}
                          className={item.receivedQuantity !== item.expectedQuantity ? 'border-yellow-500' : ''}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Unit Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateDeliveryItem(item.id, {
                            unitPrice: parseFloat(e.target.value) || 0
                          })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Batch Number</Label>
                        <Input
                          value={item.batchNumber}
                          onChange={(e) => updateDeliveryItem(item.id, {
                            batchNumber: e.target.value
                          })}
                          placeholder="Optional"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Expiry Date</Label>
                        <Input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) => updateDeliveryItem(item.id, {
                            expiryDate: e.target.value
                          })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Rejected Qty</Label>
                        <Input
                          type="number"
                          min="0"
                          max={item.receivedQuantity}
                          value={item.rejectedQuantity}
                          onChange={(e) => {
                            const rejected = parseInt(e.target.value) || 0;
                            updateDeliveryItem(item.id, {
                              rejectedQuantity: Math.min(rejected, item.receivedQuantity),
                              qualityStatus: rejected === 0 ? 'approved' : 
                                           rejected === item.receivedQuantity ? 'rejected' : 
                                           'partial'
                            });
                          }}
                          disabled={item.qualityStatus === 'pending'}
                        />
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <Label>Quality Check *</Label>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant={item.qualityStatus === 'approved' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleQualityCheck(item.id, 'approved')}
                          className="flex-1 min-w-[120px]"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approve All
                        </Button>
                        <Button
                          type="button"
                          variant={item.qualityStatus === 'partial' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleQualityCheck(item.id, 'partial')}
                          className="flex-1 min-w-[120px]"
                        >
                          <AlertCircle className="w-4 h-4 mr-2" />
                          Partial Accept
                        </Button>
                        <Button
                          type="button"
                          variant={item.qualityStatus === 'rejected' ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => handleQualityCheck(item.id, 'rejected')}
                          className="flex-1 min-w-[120px]"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject All
                        </Button>
                      </div>

                      {item.qualityStatus !== 'pending' && (
                        <div className="space-y-2">
                          <Label>Quality Notes</Label>
                          <Textarea
                            value={item.qualityNotes}
                            onChange={(e) => updateDeliveryItem(item.id, {
                              qualityNotes: e.target.value
                            })}
                            placeholder="Enter any quality issues or notes..."
                            rows={2}
                          />
                        </div>
                      )}
                    </div>

                    {item.receivedQuantity > 0 && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Accepted: {item.receivedQuantity - item.rejectedQuantity} units</strong>
                          {item.rejectedQuantity > 0 && ` | Rejected: ${item.rejectedQuantity} units`}
                          {item.unitPrice > 0 && ` | Value: $${((item.receivedQuantity - item.rejectedQuantity) * item.unitPrice).toFixed(2)}`}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Delivery Documents</CardTitle>
          <CardDescription>Upload delivery notes, invoices, or other supporting documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
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
            </div>

            {documents.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {documents.map(doc => (
                  <Card key={doc.id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
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
                        className="flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* General Notes */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Additional Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Enter any additional notes about this delivery..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Summary and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Expected Items</p>
              <p className="text-2xl font-bold">{totals.totalExpected}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Received Items</p>
              <p className="text-2xl font-bold">{totals.totalReceived}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rejected Items</p>
              <p className="text-2xl font-bold text-destructive">{totals.totalRejected}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">${totals.totalValue.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={resetForm} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSaveDelivery} disabled={isSaving}>
            {isSaving ? (
              <>
                <span className="mr-2">Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Delivery
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}