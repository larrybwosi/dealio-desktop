"use client"

import { useState, useEffect } from "react"
// import { trackEvent } from "@aptabase/tauri"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Mail, Phone, Edit, User, Plus, RefreshCw } from "lucide-react"
import AddCustomerSheet from "@/components/customers/add-customer"
import { useFormattedCurrency } from "@/lib/utils"
import { usePosCustomers } from "@/hooks/customers"

export default function CustomersPage() {
  const {customers, isSyncing, triggerSync} = usePosCustomers()

  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.phone?.includes(searchQuery),
  )

  useEffect(() => {
    if (searchQuery) {
      const timer = setTimeout(() => {
        // trackEvent("customer_search", { query: searchQuery.substring(0, 50) });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  const formatCurrency = useFormattedCurrency()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold">Customer Management</h1>
          <p className="text-muted-foreground font-serif mt-1">Manage your customer database</p>
        </div>

        <div className="flex items-center gap-2">
           <Button variant="outline" size="sm" onClick={triggerSync} disabled={isSyncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Customer
          </Button>
        </div>
      </div>

      <AddCustomerSheet
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search customers by name, email, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredCustomers.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <User className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground font-serif">No customers found</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setIsDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Customer
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredCustomers.map((customer) => (
            <Card key={customer.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-serif">{customer.name}</CardTitle>
                    <CardDescription className="mt-1 font-serif">
                      {!!customer?.loyaltyPoints && (
                        <Badge variant="secondary" className="mt-1">
                          {customer?.loyaltyPoints} points
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => {}}>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground font-serif" />
                    <span className="text-muted-foreground font-serif">{customer.email}</span>
                  </div>
                )}

                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground font-serif" />
                    <span className="text-muted-foreground font-serif">{customer.phone}</span>
                  </div>
                )}

                <div className="pt-3 border-t space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-serif">Total Purchases</span>
                    <span className="font-medium font-serif">{formatCurrency(customer?.totalPurchases|| 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-serif">Last Visit</span>
                    <span className="font-medium font-serif">{new Date(customer?.lastVisit|| "").toLocaleDateString()}</span>
                  </div>
                </div>

                {customer.notes && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground font-serif">{customer.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}