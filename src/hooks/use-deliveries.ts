// hooks/use-delivery-form.ts

import { useState, useCallback, useMemo } from 'react';
import {
  DeliveryItem,
  UploadedDocument,
  DeliveryValidationError,
  QualityStatus,
} from '@/types/delivery';
import {
  calculateDeliveryTotals,
  validateDelivery,
  formatValidationErrors,
  determineQualityStatus,
} from '@/lib/delivery-utils';

interface UseDeliveryFormOptions {
  onSuccess?: (deliveryId: string) => void;
  onError?: (error: Error) => void;
}

export function useDeliveryForm(options: UseDeliveryFormOptions = {}) {
  // Form state
  const [deliveryReference, setDeliveryReference] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<DeliveryValidationError[]>([]);

  // Computed values
  const totals = useMemo(
    () => calculateDeliveryTotals(deliveryItems),
    [deliveryItems]
  );

  const isDirty = useMemo(
    () =>
      deliveryReference !== '' ||
      selectedSupplier !== '' ||
      deliveryItems.length > 0 ||
      documents.length > 0 ||
      generalNotes !== '',
    [deliveryReference, selectedSupplier, deliveryItems, documents, generalNotes]
  );

  const isValid = useMemo(() => {
    const validationErrors = validateDelivery(
      deliveryReference,
      selectedSupplier,
      deliveryItems
    );
    return validationErrors.length === 0;
  }, [deliveryReference, selectedSupplier, deliveryItems]);

  // Item management
  const addDeliveryItem = useCallback(() => {
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
    setDeliveryItems((prev) => [...prev, newItem]);
  }, []);

  const removeDeliveryItem = useCallback((id: string) => {
    setDeliveryItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateDeliveryItem = useCallback(
    (id: string, updates: Partial<DeliveryItem>) => {
      setDeliveryItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    []
  );

  const handleProductSelect = useCallback(
    //@ts-ignore
    (itemId: string, productId: string, product: any) => {
      updateDeliveryItem(itemId, {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitPrice: product.unitPrice || 0,
      });
    },
    [updateDeliveryItem]
  );

  const handleQualityCheck = useCallback(
    (itemId: string, status: QualityStatus) => {
      const item = deliveryItems.find((i) => i.id === itemId);
      if (!item) return;

      let updates: Partial<DeliveryItem> = { qualityStatus: status };

      if (status === 'approved') {
        updates.rejectedQuantity = 0;
      } else if (status === 'rejected') {
        updates.rejectedQuantity = item.receivedQuantity;
      }

      updateDeliveryItem(itemId, updates);
    },
    [deliveryItems, updateDeliveryItem]
  );

  const handleRejectedQuantityChange = useCallback(
    (itemId: string, rejectedQuantity: number) => {
      const item = deliveryItems.find((i) => i.id === itemId);
      if (!item) return;

      const validRejectedQty = Math.max(
        0,
        Math.min(rejectedQuantity, item.receivedQuantity)
      );

      const newStatus = determineQualityStatus(
        item.receivedQuantity,
        validRejectedQty
      );

      updateDeliveryItem(itemId, {
        rejectedQuantity: validRejectedQty,
        qualityStatus: newStatus,
      });
    },
    [deliveryItems, updateDeliveryItem]
  );

  // Document management
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // In production, upload to server
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Upload failed');
        }

        const data = await response.json();

        return {
          id: `doc-${Date.now()}-${Math.random()}`,
          name: file.name,
          type: file.type,
          url: data.url,
          size: file.size,
          uploadedAt: new Date(),
        };
      });

      const uploadedDocs = await Promise.all(uploadPromises);
      setDocuments((prev) => [...prev, ...uploadedDocs]);
    } catch (error) {
      console.error('Upload error:', error);
      options.onError?.(error as Error);
    } finally {
      setIsUploading(false);
    }
  }, [options]);

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  // Form validation
  const validate = useCallback(() => {
    const validationErrors = validateDelivery(
      deliveryReference,
      selectedSupplier,
      deliveryItems
    );
    setErrors(validationErrors);
    return validationErrors.length === 0;
  }, [deliveryReference, selectedSupplier, deliveryItems]);

  // Form submission
  const saveDelivery = useCallback(async () => {
    if (!validate()) {
      const errorMessage = formatValidationErrors(errors);
      alert(`Please fix the following errors:\n${errorMessage}`);
      return;
    }

    setIsSaving(true);

    try {
      const deliveryData = {
        reference: deliveryReference,
        supplierId: selectedSupplier,
        deliveryDate,
        items: deliveryItems,
        documents: documents.map((doc) => ({
          name: doc.name,
          url: doc.url,
          type: doc.type,
        })),
        notes: generalNotes,
        totals,
        createdAt: new Date().toISOString(),
      };

      const response = await fetch('/api/deliveries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deliveryData),
      });

      if (!response.ok) {
        throw new Error('Failed to save delivery');
      }

      const result = await response.json();

      options.onSuccess?.(result.delivery.id);
      resetForm();
    } catch (error) {
      console.error('Error saving delivery:', error);
      options.onError?.(error as Error);
    } finally {
      setIsSaving(false);
    }
  }, [
    validate,
    errors,
    deliveryReference,
    selectedSupplier,
    deliveryDate,
    deliveryItems,
    documents,
    generalNotes,
    totals,
    options,
  ]);

  // Form reset
  const resetForm = useCallback(() => {
    setDeliveryReference('');
    setSelectedSupplier('');
    setDeliveryDate(new Date().toISOString().split('T')[0]);
    setDeliveryItems([]);
    setDocuments([]);
    setGeneralNotes('');
    setErrors([]);
  }, []);

  // Bulk actions
  const approveAllItems = useCallback(() => {
    setDeliveryItems((prev) =>
      prev.map((item) => ({
        ...item,
        qualityStatus: 'approved' as QualityStatus,
        rejectedQuantity: 0,
      }))
    );
  }, []);

  const clearAllItems = useCallback(() => {
    if (
      window.confirm('Are you sure you want to remove all items?')
    ) {
      setDeliveryItems([]);
    }
  }, []);

  return {
    // State
    deliveryReference,
    selectedSupplier,
    deliveryDate,
    deliveryItems,
    documents,
    generalNotes,
    
    // Computed
    totals,
    isDirty,
    isValid,
    errors,
    
    // UI state
    isSaving,
    isUploading,
    
    // Setters
    setDeliveryReference,
    setSelectedSupplier,
    setDeliveryDate,
    setGeneralNotes,
    
    // Item management
    addDeliveryItem,
    removeDeliveryItem,
    updateDeliveryItem,
    handleProductSelect,
    handleQualityCheck,
    handleRejectedQuantityChange,
    
    // Document management
    handleFileUpload,
    removeDocument,
    
    // Form actions
    validate,
    saveDelivery,
    resetForm,
    
    // Bulk actions
    approveAllItems,
    clearAllItems,
  };
}