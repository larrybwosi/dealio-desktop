"use client"

import { useState } from "react"
import { useEffect } from "react"
import { usePosStore } from "@/store/store"
import { NotificationToast } from "@/components/notification-toast"
import { Toaster } from "sonner"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { UpdaterProvider } from "@/lib/providers/UpdateProvider"
import AblyInitializer from "@/lib/providers/AblyProvider"
import { ServerNotificationProvider } from "@/lib/providers/ServerNotificationProvider"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const themeConfig = usePosStore((state) => state.settings.themeConfig)
  const checkLowStockAlerts = usePosStore((state) => state.checkLowStockAlerts)

  const [queryClient] = useState(() => new QueryClient())

  useEffect(() => {
    const root = document.documentElement

    // Apply theme mode
    if (themeConfig.mode === "dark") {
      root.classList.add("dark")
    } else if (themeConfig.mode === "light") {
      root.classList.remove("dark")
    } else {
      // System preference
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches
      if (isDark) {
        root.classList.add("dark")
      } else {
        root.classList.remove("dark")
      }
    }

    // Apply font size
    if (themeConfig.fontSize === "small") {
      root.style.fontSize = "14px"
    } else if (themeConfig.fontSize === "large") {
      root.style.fontSize = "18px"
    } else {
      root.style.fontSize = "16px"
    }

    // Apply compact mode
    if (themeConfig.compactMode) {
      root.classList.add("compact-mode")
    } else {
      root.classList.remove("compact-mode")
    }
  }, [themeConfig])

  useEffect(() => {
    // Initial check
    checkLowStockAlerts()

    // Check every 5 minutes
    const interval = setInterval(
      () => {
        checkLowStockAlerts()
      },
      5 * 60 * 1000,
    )

    return () => clearInterval(interval)
  }, [checkLowStockAlerts])

  return (
    <>
      <AblyInitializer/>
      <NotificationToast />
      <QueryClientProvider client={queryClient}>
        <UpdaterProvider checkInterval={60 * 60 * 1000 * 4}>
          <ServerNotificationProvider>
            {children}
          </ServerNotificationProvider>
        </UpdaterProvider>
      </QueryClientProvider>
      
      {/* Custom Desktop POS Toaster Configuration */}
      <Toaster 
        position="top-right" 
        richColors 
        expand={true} 
        closeButton={true}
        duration={4000}
        visibleToasts={6}
        theme={themeConfig.mode === "dark" ? "dark" : "light"}
        offset={16}
        toastOptions={{
          // Adds clearer borders and shadows for better visibility on busy screens
          className: "border border-border shadow-lg font-medium",
          style: {
             // Ensures toasts are readable even if tailwind classes fail to load
             minWidth: '300px',
          }
        }}
      />
    </>
  );
}