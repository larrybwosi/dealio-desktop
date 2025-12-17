import { toast } from "sonner"
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Receipt, 
  WifiOff, 
  Loader2, 
  Info,
  Bell
} from "lucide-react"

export const notify = {
  // 1. Standard Success (e.g., "Settings Saved")
  success: (message: string, options?: { duration?: number }) => {
    toast.success(message, {
      icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
      duration: options?.duration ?? 3000,
    })
  },

  // 2. Standard Error (e.g., "Invalid Password")
  error: (message: string, options?: { duration?: number }) => {
    toast.error(message, {
      icon: <XCircle className="h-5 w-5 text-red-600" />,
      duration: options?.duration ?? 5000,
    })
  },

  // 3. Info / Announcement (Server-sent messages)
  info: (title: string, options?: { description?: string, duration?: number }) => {
    toast.info(title, {
      description: options?.description,
      icon: <Info className="h-5 w-5 text-blue-500" />,
      duration: options?.duration ?? 4000,
    })
  },

  // 4. Warning (Generic or Server-sent)
  warning: (title: string, options?: { description?: string, duration?: number }) => {
    toast.warning(title, {
      description: options?.description,
      icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
      duration: options?.duration ?? 5000,
    })
  },

  // 5. POS Specific: Sale Complete
  saleSuccess: (amount: number, receiptId: string) => {
    toast.success(
      <div className="flex flex-col gap-1">
        <span className="font-bold text-base">Sale Complete: ${amount.toFixed(2)}</span>
        <span className="text-xs text-muted-foreground">Receipt #{receiptId}</span>
      </div>, 
      {
        icon: <Receipt className="h-6 w-6 text-green-600" />,
        duration: 4000,
        action: {
          label: "Print",
          onClick: () => console.log(`Printing receipt ${receiptId}...`),
        },
      }
    )
  },

  // 6. POS Specific: Low Stock Warning
  lowStock: (itemName: string, count: number) => {
    toast.warning(`Low Stock: ${itemName}`, {
      description: `Only ${count} units remaining.`,
      icon: <AlertTriangle className="h-5 w-5 text-yellow-500" />,
      duration: 6000,
    })
  },

  // 7. POS Specific: Network/Hardware Error
  connectionError: (device: "Printer" | "Network" | "Scanner") => {
    toast.error(`${device} Disconnected`, {
      description: "Check connection and try again.",
      icon: <WifiOff className="h-5 w-5 text-red-500" />,
      duration: Infinity, // Persistent
    })
  },
  
  // 8. Loading State
  loading: (message: string) => {
    return toast.loading(message, {
      icon: <Loader2 className="h-4 w-4 animate-spin" />,
    })
  },

  // 9. Custom Action (Server-triggered actions)
  action: (title: string, actionLabel: string, onAction: () => void) => {
    toast(title, {
      icon: <Bell className="h-5 w-5 text-primary" />,
      action: {
        label: actionLabel,
        onClick: onAction,
      },
      duration: 8000,
    })
  },
  
  // Helper to dismiss loading toasts
  dismiss: (toastId: string | number) => toast.dismiss(toastId)
}