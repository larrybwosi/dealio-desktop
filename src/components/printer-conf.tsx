import { 
  Printer, 
  RefreshCcw, 
  Settings2, 
  FileText, 
  Receipt, 
  ChefHat 
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePrinter } from '@/hooks/use-printer';
import { PrinterJobType } from '@/store/printer-store';

export default function PrinterSettings() {
  const { 
    availablePrinters, 
    assignments, 
    assignPrinter,
    refreshPrinters, 
    loading,
    printDocument 
  } = usePrinter();


  // Helper to test specific roles
  const handleTest = async (type: PrinterJobType) => {
    try {
      const timestamp = new Date().toLocaleTimeString();
      
      // We send HTML for the test. 
      // Note: We pass `false` for the isPdf argument.
      const testContent = `
        <html>
          <body>
            <h1>Test Print</h1>
            <p>Printer: ${type}</p>
            <p>Time: ${timestamp}</p>
            <hr />
            <p>If you can read this, the configuration is successful.</p>
          </body>
        </html>
      `;

      await printDocument(type, testContent, false);
      
      alert(`Sent test to ${type} printer!`);
    } catch (e: any) {
      console.error(e);
      alert(`Error: ${e.message || "Print failed"}`);
    }
  };

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Printer className="h-5 w-5 text-blue-700" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Printer Configuration</h2>
            <p className="text-sm text-muted-foreground">Manage devices and assign roles</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refreshPrinters} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {loading ? "Searching..." : "Refresh List"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Role Assignments */}
        <div className="space-y-6">
          <h3 className="font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Role Assignments
          </h3>
          
          <div className="space-y-4">
            {/* 1. Receipt Printer Assignment */}
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4 text-orange-600" />
                <label className="text-sm font-semibold">Receipt Printer</label>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Used for POS thermal receipts (58mm/80mm)</p>
              
              <div className="flex gap-2">
                <Select 
                  value={assignments.receipt || ''} 
                  onValueChange={(val) => assignPrinter('receipt', val)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select a printer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePrinters.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => handleTest('receipt')}>
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 2. Invoice Printer Assignment */}
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <label className="text-sm font-semibold">Invoice Printer</label>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Used for A4 invoices and reports</p>
              
              <div className="flex gap-2">
                <Select 
                  value={assignments.invoice || ''} 
                  onValueChange={(val) => assignPrinter('invoice', val)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select a printer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePrinters.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => handleTest('invoice')}>
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* 3. Kitchen Printer (Optional) */}
            <div className="bg-gray-50 p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <ChefHat className="h-4 w-4 text-green-600" />
                <label className="text-sm font-semibold">Kitchen Printer</label>
              </div>
              <div className="flex gap-2">
                <Select 
                  value={assignments.kitchen || ''} 
                  onValueChange={(val) => assignPrinter('kitchen', val)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select a printer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePrinters.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                 <Button variant="outline" size="icon" onClick={() => handleTest('kitchen')}>
                  <Printer className="h-4 w-4" />
                </Button>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Available Devices List */}
        <div>
           <h3 className="font-medium mb-4">Detected Devices ({availablePrinters.length})</h3>
           <div className="space-y-2 max-h-[400px] overflow-y-auto">
             {availablePrinters.length === 0 && (
                <div className="text-sm text-muted-foreground italic">No printers found.</div>
             )}
             {availablePrinters.map((printer) => {
               // Check if this printer is assigned to anything
               const roles = (Object.keys(assignments) as PrinterJobType[])
                 .filter(role => assignments[role] === printer.id);

               return (
                 <div key={printer.id} className="p-3 border rounded text-sm hover:bg-gray-50">
                   <div className="font-medium">{printer.name}</div>
                   <div className="text-xs text-muted-foreground truncate">{printer.driver_name}</div>
                   
                   {/* Badges for active roles */}
                   <div className="flex gap-1 mt-2">
                     {roles.map(role => (
                       <Badge key={role} variant="secondary" className="text-[10px] uppercase">
                         {role}
                       </Badge>
                     ))}
                   </div>
                 </div>
               )
             })}
           </div>
        </div>
      </div>
    </Card>
  );
}