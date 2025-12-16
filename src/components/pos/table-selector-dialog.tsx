import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { usePosStore } from "@/store/store"
import { cn } from "@/lib/utils"
import { Users } from "lucide-react"

interface TableSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTable: (tableNumber: string) => void
}

export function TableSelectorDialog({ open, onOpenChange, onSelectTable }: TableSelectorDialogProps) {
  const tables = usePosStore(state => state.tables)
  const currentTableNumber = usePosStore(state => state.currentOrder.tableNumber)

  const sortedTables = [...tables].sort((a, b) => 
     a.number.localeCompare(b.number, undefined, { numeric: true })
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Select Table</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4 py-4 max-h-[60vh] overflow-y-auto">
           {sortedTables.map(table => {
             const isSelected = table.number === currentTableNumber;
             const isOccupied = table.status === 'occupied' && !isSelected;
             
             return (
               <button
                 key={table.id}
                 onClick={() => {
                   onSelectTable(table.number);
                   onOpenChange(false);
                 }}
                 disabled={isOccupied} // Optional: allow selecting occupied to add more items? For now, keep simple.
                 className={cn(
                   "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all aspect-square",
                   isSelected 
                     ? "border-primary bg-primary/10 text-primary" 
                     : isOccupied 
                        ? "border-destructive/20 bg-destructive/5 text-muted-foreground opacity-60 cursor-not-allowed" 
                        : "border-muted hover:border-primary/50 hover:bg-muted"
                 )}
               >
                 <span className="text-xl font-bold mb-1">{table.number}</span>
                 <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    <span>{table.capacity}</span>
                 </div>
                 {table.section && (
                    <span className="text-[10px] mt-1 uppercase tracking-wider opacity-70 truncate max-w-full">
                        {table.section}
                    </span>
                 )}
               </button>
             )
           })}
        </div>
        
        {tables.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
                No tables configured. Go to "Manage Tables" to add some.
            </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
