"use client"

import type React from "react"

import { useEffect } from "react"
import { usePosStore } from "@/lib/store"
import { NotificationToast } from "@/components/notification-toast"
import { Toaster } from "sonner"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const themeConfig = usePosStore((state) => state.settings.themeConfig)
  const checkLowStockAlerts = usePosStore((state) => state.checkLowStockAlerts)
  const queryClient = new QueryClient();

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

    // Custom colors would require proper oklch conversion to work with Tailwind v4
    // For now, using the default theme colors defined in globals.css

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
      <NotificationToast />
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      <Toaster />
    </>
  );
}
