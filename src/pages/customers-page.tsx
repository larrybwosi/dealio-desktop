"use client"

import type React from "react"

import { useState } from "react"
import { usePosStore } from "@/store/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Search, Plus, Mail, Phone, Edit, Trash2, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export default function CustomersPage() {
  const customers = usePosStore((state) => state.customers)
  const addCustomer = usePosStore((state) => state.addCustomer)
  const updateCustomer = usePosStore((state) => state.updateCustomer)
  const deleteCustomer = usePosStore((state) => state.deleteCustomer)
  const settings = usePosStore((state) => state.settings)

  const [searchQuery, setSearchQuery] = useState("")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  })

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery),
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (editingCustomer) {
      updateCustomer(editingCustomer, formData)
      setEditingCustomer(null)
    } else {
      addCustomer(formData)
    }

    setFormData({ name: "", email: "", phone: "", notes: "" })
    setIsAddDialogOpen(false)
  }

  const handleEdit = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId)
    if (customer) {
      setFormData({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        notes: customer.notes || "",
      })
      setEditingCustomer(customerId)
      setIsAddDialogOpen(true)
    }
  }

  const handleDelete = (customerId: string) => {
    if (confirm("Are you sure you want to delete this customer?")) {
      deleteCustomer(customerId)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: settings.currency,
      minimumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Management</h1>
          <p className="text-muted-foreground mt-1">Manage your customer database</p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setFormData({ name: "", email: "", phone: "", notes: "" })
                setEditingCustomer(null)
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCustomer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">{editingCustomer ? "Update" : "Add"} Customer</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(customer.id)}>
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
