"use client"

import { useState } from "react"
import { usePosStore, type Table } from "@/store/store"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Edit2, Trash2, Users, MapPin, CheckCircle2, Clock, Ban } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function ManageTablesPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTable, setEditingTable] = useState<Table | null>(null)
  const [filterSection, setFilterSection] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  const tables = usePosStore((state) => state.tables)
  const addTable = usePosStore((state) => state.addTable)
  const updateTable = usePosStore((state) => state.updateTable)
  const deleteTable = usePosStore((state) => state.deleteTable)
  const setTableStatus = usePosStore((state) => state.setTableStatus)

  const [formData, setFormData] = useState<Omit<Table, "id">>({
    number: "",
    capacity: 4,
    status: "available",
    section: "Main Hall",
    notes: "",
  })

  const sections = [...new Set(tables.map((t) => t.section).filter(Boolean))]
  const uniqueSections = sections.length > 0 ? sections : ["Main Hall", "Patio", "VIP", "Bar Area"]

  const filteredTables = tables.filter((table) => {
    const sectionMatch = filterSection === "all" || table.section === filterSection
    const statusMatch = filterStatus === "all" || table.status === filterStatus
    return sectionMatch && statusMatch
  })

  const handleSubmit = () => {
    if (!formData.number || formData.capacity < 1) return

    if (editingTable) {
      updateTable(editingTable.id, formData)
    } else {
      addTable(formData)
    }

    setFormData({
      number: "",
      capacity: 4,
      status: "available",
      section: "Main Hall",
      notes: "",
    })
    setEditingTable(null)
    setDialogOpen(false)
  }

  const handleEdit = (table: Table) => {
    setEditingTable(table)
    setFormData({
      number: table.number,
      capacity: table.capacity,
      status: table.status,
      section: table.section || "",
      notes: table.notes || "",
    })
    setDialogOpen(true)
  }

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this table?")) {
      deleteTable(id)
    }
  }

  const getStatusIcon = (status: Table["status"]) => {
    switch (status) {
      case "available":
        return <CheckCircle2 className="w-4 h-4" />
      case "occupied":
        return <Ban className="w-4 h-4" />
      case "reserved":
        return <Clock className="w-4 h-4" />
    }
  }

  const getStatusColor = (status: Table["status"]) => {
    switch (status) {
      case "available":
        return "bg-green-500/10 text-green-700 border-green-500/20"
      case "occupied":
        return "bg-red-500/10 text-red-700 border-red-500/20"
      case "reserved":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
    }
  }

  const stats = {
    total: tables.length,
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    reserved: tables.filter((t) => t.status === "reserved").length,
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage Tables</h1>
          <p className="text-muted-foreground mt-1">Organize and track your restaurant tables</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingTable(null)
                setFormData({
                  number: "",
                  capacity: 4,
                  status: "available",
                  section: "Main Hall",
                  notes: "",
                })
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Table
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTable ? "Edit Table" : "Add New Table"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Table Number *</Label>
                  <Input
                    placeholder="e.g., 1, A1, VIP-1"
                    value={formData.number}
                    onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Capacity *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number.parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Section</Label>
                  <Select
                    value={formData.section}
                    onValueChange={(value) => setFormData({ ...formData, section: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueSections.map((section) => (
                        <SelectItem key={section} value={section||''}>
                          {section}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: Table["status"]) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="occupied">Occupied</SelectItem>
                      <SelectItem value="reserved">Reserved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  placeholder="Add any special notes about this table..."
                  value={formData.notes || ""}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit}>{editingTable ? "Update" : "Add"} Table</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Tables</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="text-2xl font-bold text-green-600">{stats.available}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Occupied</p>
              <p className="text-2xl font-bold text-red-600">{stats.occupied}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <Ban className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Reserved</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.reserved}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filterSection} onValueChange={setFilterSection}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by section" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sections</SelectItem>
            {uniqueSections.map((section) => (
              <SelectItem key={section} value={section || ''}>
                {section}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="occupied">Occupied</SelectItem>
            <SelectItem value="reserved">Reserved</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTables.map((table) => (
          <Card key={table.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-lg">Table {table.number}</h3>
                {table.section && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {table.section}
                  </p>
                )}
              </div>
              <Badge className={`${getStatusColor(table.status)} flex items-center gap-1`}>
                {getStatusIcon(table.status)}
                {table.status}
              </Badge>
            </div>

            <div className="flex items-center gap-2 mb-3 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>Capacity: {table.capacity} people</span>
            </div>

            {table.notes && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{table.notes}</p>}

            <div className="flex gap-2">
              <Select value={table.status} onValueChange={(value: Table["status"]) => setTableStatus(table.id, value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="occupied">Occupied</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={() => handleEdit(table)}>
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={() => handleDelete(table.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredTables.length === 0 && (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No tables found</p>
            <p className="text-sm">Add your first table to get started</p>
          </div>
        </Card>
      )}
    </div>
  )
}
