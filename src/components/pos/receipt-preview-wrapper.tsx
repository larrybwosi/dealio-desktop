import { useEffect } from 'react';
import { usePDF } from '@react-pdf/renderer';
import { Document, Page, pdfjs } from 'react-pdf';
import { Loader2 } from 'lucide-react';

// IMPORTANT: Configure the worker for production
// Using unpkg is the easiest way to ensure the worker loads correctly in Tauri without complex build config
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Setup styles for react-pdf to ensure the canvas fits the container
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

export const ReceiptPreviewWrapper = ({ document }: { document: React.ReactElement<any> | null }) => {
  const [instance, update] = usePDF({ document: document as any });
  
  
  // Update the instance when the document prop changes
  useEffect(() => {
    update(document as any);
  }, [document, update]);

  function onDocumentLoadSuccess({ numPages: _numPages }: { numPages: number }) {
    // We don't need numPages currently, but the library passes it
  }

  if (instance.loading) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-3 animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground font-medium">Generating Preview...</p>
      </div>
    );
  }

  if (instance.error) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-2 text-destructive">
        <p className="font-bold">Error generating PDF</p>
        <p className="text-xs max-w-[200px] text-center">{instance.error}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex justify-center overflow-y-auto bg-gray-100 dark:bg-neutral-900/50 p-4">
      {instance.url ? (
        <Document
          file={instance.url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className="flex items-center gap-2 text-muted-foreground mt-10">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Rendering PDF...</span>
            </div>
          }
          className="shadow-2xl"
        >
          {/* Render the first page. Receipts are usually 1 page. 
              scale={1.0} ensures it renders at 72dpi standard size, 
              adjust or make dynamic based on container width if needed */}
          <Page 
            pageNumber={1} 
            renderTextLayer={false} 
            renderAnnotationLayer={false}
            scale={1.0} 
            className="rounded-lg overflow-hidden border border-border"
          />
        </Document>
      ) : null}
    </div>
  );
};