import { apiClient } from '@/lib/axios';
import { CheckCircle2, ExternalLink, Loader2, Plus, Printer } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { processFileDownload } from '@/lib/utils';

function OrderSuccessView({ 
  orderId, 
  invoiceUrl,
  onReset 
}: { 
  orderId: string, 
  invoiceUrl: string,
  onReset: () => void 
}) {
  const navigate = useNavigate();
  const [isDownloading, setIsDownloading] = useState(false);

    const handleDownloadInvoice = async () => {
      if (!invoiceUrl) return;
      if (isDownloading) return;
      const loadingToastId = toast.loading('Downloading invoice...', {
        description: `Order: ${orderId}`
      });
  
      setIsDownloading(true);
      try {
        const response = await apiClient.get(invoiceUrl, { responseType: 'blob' });
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const safeOrderNum = (orderId).replace(/[^a-z0-9]/gi, '_');
        const fileName = `Receipt_${safeOrderNum}.pdf`;
  
        await processFileDownload(blob, fileName, loadingToastId);
      } catch (error) {
        console.error('Download error:', error);
        toast.error('Failed to save invoice', {
          description: 'Please try again',
          id: loadingToastId
        });
      } finally {
        setIsDownloading(false);
      }
    };

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
      <div className="h-20 w-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6">
        <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
      </div>
      
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Order Created Successfully!</h2>
      <p className="text-zinc-500 max-w-md mb-8">
        The order has been recorded in the system. You can now view the details, download the invoice, or create another order.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Button 
          variant="outline" 
          className="flex-1 gap-2"
          onClick={handleDownloadInvoice}
          disabled={!invoiceUrl || isDownloading} // Disable if no URL
        >
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Printer className="h-4 w-4" />}
          Download Invoice
        </Button>
        
        <Button 
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => navigate(`/pending-transactions?id=${orderId}`)}
        >
          <ExternalLink className="h-4 w-4" />
          View Transaction
        </Button>
      </div>

      <div className="mt-8">
        <Button 
          size="lg" 
          className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[200px] gap-2"
          onClick={onReset}
        >
          <Plus className="h-4 w-4" />
          Create Another Order
        </Button>
      </div>
    </div>
  );
}

export default OrderSuccessView;