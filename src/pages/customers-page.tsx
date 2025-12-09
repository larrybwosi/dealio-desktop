"use client"

import { useState } from "react"
import { usePosStore } from "@/store/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Mail, Phone, Edit, Trash2, User, Plus } from "lucide-react"
import AddCustomerSheet from "@/components/customers/add-customer"
import { useFormattedCurrency } from "@/lib/utils"

export default function CustomersPage() {
  const customers = usePosStore((state) => state.customers)
  const deleteCustomer = usePosStore((state) => state.deleteCustomer)

  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery),
  )

  const handleDelete = (customerId: string) => {
    if (confirm("Are you sure you want to delete this customer?")) {
      deleteCustomer(customerId)
    }
  }
  
  const formatCurrency = useFormattedCurrency()

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Management</h1>
          <p className="text-muted-foreground mt-1">Manage your customer database</p>
        </div>

        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Customer
        </Button>
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
              <p className="text-muted-foreground">No customers found</p>
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
                    <CardTitle className="text-lg">{customer.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {customer.loyaltyPoints > 0 && (
                        <Badge variant="secondary" className="mt-1">
                          {customer.loyaltyPoints} points
                        </Badge>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => {}}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(customer.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{customer.email}</span>
                  </div>
                )}

                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{customer.phone}</span>
                  </div>
                )}

                <div className="pt-3 border-t space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Purchases</span>
                    <span className="font-medium">{formatCurrency(customer.totalPurchases)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Last Visit</span>
                    <span className="font-medium">{new Date(customer.lastVisit).toLocaleDateString()}</span>
                  </div>
                </div>

                {customer.notes && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground">{customer.notes}</p>
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