"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, User, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { usePosStore } from "@/lib/store"

export function CustomerSelector() {
  const [open, setOpen] = useState(false)
  const customers = usePosStore((state) => state.customers)
  const currentOrder = usePosStore((state) => state.currentOrder)
  const selectCustomer = usePosStore((state) => state.selectCustomer)
  const setCustomerName = usePosStore((state) => state.setCustomerName)
  const getBusinessConfig = usePosStore((state) => state.getBusinessConfig)

  const businessConfig = getBusinessConfig()
  const showB2BFeatures = businessConfig.features.b2bBulkPurchase

  const selectedCustomer = customers.find((c) => c.id === currentOrder.customerId)

  const handleSelectCustomer = (customerId: string) => {
    if (customerId === "walk-in") {
      setCustomerName("")
    } else {
      selectCustomer(customerId)
    }
    setOpen(false)
  }

  const retailCustomers = customers.filter((c) => !c.customerType || c.customerType === "retail")
  const b2bCustomers = customers.filter((c) => c.customerType === "b2b")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-transparent"
        >
          {selectedCustomer ? (
            <div className="flex items-center gap-2">
              {selectedCustomer.customerType === "b2b" ? (
                <Building2 className="w-4 h-4 text-primary" />
              ) : (
                <User className="w-4 h-4" />
              )}
              <span>{selectedCustomer.name}</span>
              {selectedCustomer.customerType === "b2b" && (
                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">B2B</span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              <span>Select customer...</span>
            </div>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search customer by name, email, or phone..." />
          <CommandList>
            <CommandEmpty>No customer found.</CommandEmpty>

            <CommandGroup heading="Walk-in">
              <CommandItem value="walk-in" onSelect={() => handleSelectCustomer("walk-in")}>
                <Check className={cn("mr-2 h-4 w-4", !selectedCustomer ? "opacity-100" : "opacity-0")} />
                <div className="flex flex-col">
                  <span className="font-medium">Walk-in Customer</span>
                  <span className="text-xs text-muted-foreground">No customer selected</span>
                </div>
              </CommandItem>
            </CommandGroup>

            {retailCustomers.length > 0 && (
              <CommandGroup heading="Retail Customers">
                {retailCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={`${customer.name} ${customer.email} ${customer.phone}`}
                    onSelect={() => handleSelectCustomer(customer.id)}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0")}
                    />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{customer.name}</span>
                        <span className="text-xs text-muted-foreground">{customer.loyaltyPoints} pts</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{customer.email}</span>
                        <span>•</span>
                        <span>{customer.phone}</span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {showB2BFeatures && b2bCustomers.length > 0 && (
              <CommandGroup heading="B2B Customers">
                {b2bCustomers.map((customer) => (
                  <CommandItem
                    key={customer.id}
                    value={`${customer.name} ${customer.businessName} ${customer.email} ${customer.phone}`}
                    onSelect={() => handleSelectCustomer(customer.id)}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0")}
                    />
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-primary" />
                          <span className="font-medium">{customer.name}</span>
                        </div>
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">B2B</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{customer.businessName}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{customer.email}</span>
                        <span>•</span>
                        <span>{customer.phone}</span>
                      </div>
                      {customer.creditLimit && (
                        <div className="text-xs text-green-600 mt-1">
                          Credit Limit: KSH {customer.creditLimit.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
