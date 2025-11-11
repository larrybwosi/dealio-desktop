"use client"

import { useState, useMemo } from "react"
import { usePosStore } from "@/lib/store"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, UserCheck, Star, Clock, TrendingUp } from "lucide-react"

export function MemberCheckinPage() {
  const customers = usePosStore((state) => state.customers)
  const settings = usePosStore((state) => state.settings)
  const selectCustomer = usePosStore((state) => state.selectCustomer)
  const updateCustomer = usePosStore((state) => state.updateCustomer)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [checkedInCustomers, setCheckedInCustomers] = useState<Set<string>>(new Set())

  const filteredCustomers = useMemo(() => {
    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone.includes(searchQuery),
    )
  }, [customers, searchQuery])

  const handleCheckin = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId)
    if (!customer) return

    // Update last visit and potentially award loyalty points
    updateCustomer(customerId, {
      lastVisit: new Date(),
      loyaltyPoints: customer.loyaltyPoints + 10, // Award 10 points for check-in
    })

    selectCustomer(customerId)
    setSelectedCustomerId(customerId)
    setCheckedInCustomers((prev) => new Set(prev).add(customerId))

    // Show success message
    setTimeout(() => {
      setSelectedCustomerId(null)
    }, 3000)
  }

  const handleCheckout = (customerId: string) => {
    setCheckedInCustomers((prev) => {
      const newSet = new Set(prev)
      newSet.delete(customerId)
      return newSet
    })
  }

  const selectedCustomer = selectedCustomerId ? customers.find((c) => c.id === selectedCustomerId) : null

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Member Check-In</h1>
        <p className="text-muted-foreground mt-1">Check in members to track visits and reward loyalty points</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
            <p className="text-xs text-muted-foreground">Registered members</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {
                customers.filter((c) => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  return new Date(c.lastVisit) >= today
                }).length
              }
            </div>
            <p className="text-xs text-muted-foreground">Checked in today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loyalty Points</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customers.reduce((sum, c) => sum + c.loyaltyPoints, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Points issued</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Purchase Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings.currency}{" "}
              {customers.length > 0
                ? Math.round(
                    customers.reduce((sum, c) => sum + c.totalPurchases, 0) / customers.length,
                  ).toLocaleString()
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Per member</p>
          </CardContent>
        </Card>
      </div>

      {/* Check-in Success Message */}
      {selectedCustomer && (
        <Card className="bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-emerald-900 dark:text-emerald-100">
                  Welcome back, {selectedCustomer.name}!
                </h3>
                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                  +10 loyalty points added • Total: {selectedCustomer.loyaltyPoints} points
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Click check-in to log a member visit</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No members found{searchQuery && " matching your search"}</p>
              </div>
            ) : (
              filteredCustomers.map((customer) => {
                const isToday = () => {
                  const today = new Date()
                  today.setHours(0, 0, 0, 0)
                  return new Date(customer.lastVisit) >= today
                }

                return (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="font-semibold text-primary">
                          {customer.name.substring(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{customer.name}</h3>
                          {checkedInCustomers.has(customer.id) && (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700">
                              Currently checked in
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
                          <span>{customer.email}</span>
                          <span>{customer.phone}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            <span className="font-medium">{customer.loyaltyPoints} points</span>
                          </div>
                          <span className="text-muted-foreground">
                            Total spent: {settings.currency} {customer.totalPurchases.toLocaleString()}
                          </span>
                          <span className="text-muted-foreground">
                            Last visit: {new Date(customer.lastVisit).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!checkedInCustomers.has(customer.id) ? (
                        <Button onClick={() => handleCheckin(customer.id)} className="gap-2">
                          <UserCheck className="w-4 h-4" />
                          Check In
                        </Button>
                      ) : (
                        <Button onClick={() => handleCheckout(customer.id)} variant="outline" className="gap-2">
                          Check Out
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
