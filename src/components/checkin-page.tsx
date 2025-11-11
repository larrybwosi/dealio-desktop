"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { usePosStore } from "@/lib/store"
import { UserCircle2, KeyRound, ArrowRight, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export function CheckinPage() {
  const [selectedEmployee, setSelectedEmployee] = useState<string>("")
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const employees = usePosStore((state) => state.employees.filter((e) => e.active))
  const checkInEmployee = usePosStore((state) => state.checkInEmployee)
  const businessName = usePosStore((state) => state.settings.businessName)

  const handleCheckIn = async () => {
    setError("")

    if (!selectedEmployee) {
      setError("Please select an employee")
      return
    }

    if (!pin) {
      setError("Please enter your PIN")
      return
    }

    setIsLoading(true)

    // Simulate a small delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 500))

    const success = checkInEmployee(selectedEmployee, pin)

    if (!success) {
      setError("Invalid PIN. Please try again.")
      setPin("")
      setIsLoading(false)
    } else {
      // Success - the state change will trigger a re-render in the parent
      setIsLoading(false)
    }
  }

  const handlePinKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCheckIn()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary mb-4">
            <span className="text-primary-foreground font-bold text-3xl">
              {businessName.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <h1 className="text-4xl font-bold mb-2">{businessName}</h1>
          <p className="text-muted-foreground text-lg">Point of Sale System</p>
        </div>

        <Card className="p-8 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-2">Check In</h2>
            <p className="text-muted-foreground">Select your profile and enter your PIN to start your shift</p>
          </div>

          {/* Employee Selection */}
          <div className="mb-6">
            <Label className="text-base mb-3 block">Select Employee</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {employees.map((employee) => (
                <button
                  key={employee.id}
                  onClick={() => {
                    setSelectedEmployee(employee.id)
                    setError("")
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:shadow-md",
                    selectedEmployee === employee.id
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border hover:border-primary/50",
                  )}
                >
                  <div
                    className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
                      selectedEmployee === employee.id ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <UserCircle2 className="w-8 h-8" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-sm">{employee.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{employee.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* PIN Entry */}
          {selectedEmployee && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
              <Label htmlFor="pin" className="text-base mb-2 flex items-center gap-2">
                <KeyRound className="w-4 h-4" />
                Enter PIN
              </Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, ""))
                  setError("")
                }}
                onKeyPress={handlePinKeyPress}
                placeholder="••••"
                className="text-2xl text-center tracking-widest h-14"
                autoFocus
              />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Check In Button */}
          <Button
            onClick={handleCheckIn}
            disabled={!selectedEmployee || !pin || isLoading}
            className="w-full h-12 text-base gap-2"
            size="lg"
          >
            {isLoading ? (
              "Checking In..."
            ) : (
              <>
                Check In
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </Button>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-muted-foreground">
          <p>Need help? Contact your system administrator</p>
        </div>
      </div>
    </div>
  )
}
