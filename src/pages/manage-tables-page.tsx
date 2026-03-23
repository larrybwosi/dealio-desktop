'use client';

import { useState } from 'react';
import { usePosStore, type Table } from '@/store/store';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit2, Trash2, Users, MapPin, CheckCircle2, Clock, Ban, Search, MoreVertical, LayoutGrid, SlidersHorizontal, History as HistoryIcon, UserCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { invoke } from '@tauri-apps/api/core';
import { formatDistanceToNow, parseISO } from 'date-fns';

export default function ManageTablesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedTableForHistory, setSelectedTableForHistory] = useState<Table | null>(null);
  const [tableHistory, setTableHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const tables = usePosStore(state => state.tables);
  const addTable = usePosStore(state => state.addTable);
  const updateTable = usePosStore(state => state.updateTable);
  const deleteTable = usePosStore(state => state.deleteTable);
  const setTableStatus = usePosStore(state => state.setTableStatus);

  const [formData, setFormData] = useState<Omit<Table, 'id'>>({
    number: '',
    capacity: 4,
    status: 'available',
    section: 'Main Hall',
    notes: '',
  });

  const defaultSections = ['Main Hall', 'Patio', 'VIP', 'Bar Area'];
  const sections = [...new Set(tables.map(t => t.section).filter(Boolean))];
  const uniqueSections = [...new Set([...defaultSections, ...sections])];

  const filteredTables = tables.filter(table => {
    const sectionMatch = filterSection === 'all' || table.section === filterSection;
    const statusMatch = filterStatus === 'all' || table.status === filterStatus;
    const searchMatch = !searchQuery || 
      table.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (table.notes && table.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      
    return sectionMatch && statusMatch && searchMatch;
  });

  const handleSubmit = () => {
    if (!formData.number || formData.capacity < 1) return;

    if (editingTable) {
      updateTable(editingTable.id, formData);
    } else {
      addTable(formData);
    }

    resetForm();
    setDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      number: '',
      capacity: 4,
      status: 'available',
      section: 'Main Hall',
      notes: '',
    });
    setEditingTable(null);
  };

  const handleEdit = (table: Table) => {
    setEditingTable(table);
    setFormData({
      number: table.number,
      capacity: table.capacity,
      status: table.status,
      section: table.section || '',
      notes: table.notes || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this table? This action cannot be undone.')) {
      deleteTable(id);
    }
  };

  const getStatusConfig = (status: Table['status']) => {
    switch (status) {
      case 'available':
        return { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-200' };
      case 'occupied':
        return { icon: Ban, color: 'text-rose-600', bg: 'bg-rose-500/10', border: 'border-rose-200' };
      case 'reserved':
        return { icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-200' };
    }
  };

  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
  };

  const fetchHistory = async (table: Table) => {
    setSelectedTableForHistory(table);
    setLoadingHistory(true);
    setHistoryDialogOpen(true);
    try {
      const history = await invoke<any[]>('get_table_history_command', { tableId: table.id });
      setTableHistory(history);
    } catch (error) {
      console.error('Failed to fetch table history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Table Management</h1>
          <p className="text-muted-foreground mt-1 text-sm">Monitor, organize, and configure your floor plan</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add New Table
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-xl">{editingTable ? 'Edit Table Configuration' : 'Create New Table'}</DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="number">Table Identifier *</Label>
                  <Input
                    id="number"
                    placeholder="e.g., T-01, VIP-A"
                    value={formData.number}
                    onChange={e => setFormData({ ...formData, number: e.target.value })}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capacity">Seating Capacity *</Label>
                  <div className="relative">
                    <Users className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="capacity"
                      type="number"
                      min="1"
                      className="pl-9"
                      value={formData.capacity}
                      onChange={e => setFormData({ ...formData, capacity: Number.parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Floor Section</Label>
                  <Select
                    value={formData.section}
                    onValueChange={value => setFormData({ ...formData, section: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a section" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniqueSections.map(section => (
                        <SelectItem key={section} value={section || ''}>
                          {section}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Initial Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: Table['status']) => setFormData({ ...formData, status: value })}
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

              <div className="space-y-2">
                <Label htmlFor="notes">Operational Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="E.g., Window seat, requires high chair, wobbly leg..."
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.number}>
                {editingTable ? 'Save Changes' : 'Create Table'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Enterprise Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Capacity', value: stats.total, icon: LayoutGrid, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Ready to Seat', value: stats.available, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
          { label: 'Currently Occupied', value: stats.occupied, icon: Ban, color: 'text-rose-600', bg: 'bg-rose-500/10' },
          { label: 'Upcoming Reservations', value: stats.reserved, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-500/10' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-none shadow-sm bg-card hover:bg-accent/5 transition-colors">
              <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.bg}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Control Bar (Search & Filters) */}
      <div className="flex flex-col sm:flex-row gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search table number or notes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-background"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground hidden sm:block" />
          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sections</SelectItem>
              {uniqueSections.map(section => (
                <SelectItem key={section} value={section || ''}>
                  {section}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="occupied">Occupied</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tables Grid */}
      {filteredTables.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTables.map(table => {
            const config = getStatusConfig(table.status);
            const StatusIcon = config.icon;

            return (
              <Card key={table.id} className="group flex flex-col hover:border-primary/30 hover:shadow-md transition-all duration-200">
                <CardHeader className="p-5 pb-4 flex flex-row items-start justify-between space-y-0">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-xl font-mono">#{table.number}</h3>
                      <Badge variant="outline" className={`capitalize ${config.bg} ${config.color} ${config.border} border`}>
                        {table.status}
                      </Badge>
                    </div>
                    {table.section && (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 mr-1.5" />
                        {table.section}
                      </div>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 -mt-2 opacity-50 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(table)}>
                        <Edit2 className="w-4 h-4 mr-2" /> Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => fetchHistory(table)}>
                        <HistoryIcon className="w-4 h-4 mr-2" /> View History
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(table.id)} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete Table
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                
                <CardContent className="p-5 pt-0 flex-1">
                  <div className="flex flex-wrap gap-2 mb-3">
                    <div className="flex items-center gap-2 text-sm text-foreground/80 bg-muted/50 w-fit px-2.5 py-1 rounded-md">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">Cap: {table.capacity}</span>
                    </div>
                    {table.status === 'occupied' && (
                       <>
                        <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-500/10 w-fit px-2.5 py-1 rounded-md border border-rose-200/50">
                          <UserCircle className="w-4 h-4" />
                          <span className="font-semibold">{table.guestsCount || '?'} Guests</span>
                        </div>
                        {table.occupiedAt && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 w-fit px-2.5 py-1 rounded-md">
                            <Clock className="w-4 h-4" />
                            <span>{formatDistanceToNow(parseISO(table.occupiedAt))}</span>
                          </div>
                        )}
                       </>
                    )}
                  </div>
                  {table.notes && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-2 border-l-2 border-muted pl-2">
                      {table.notes}
                    </p>
                  )}
                </CardContent>

                <CardFooter className="p-4 bg-muted/20 border-t flex gap-2">
                  <Select 
                    value={table.status} 
                    onValueChange={(value: Table['status']) => setTableStatus(table.id, value)}
                  >
                    <SelectTrigger className="h-9 text-sm font-medium w-full">
                      <div className="flex items-center gap-2">
                        <StatusIcon className={`w-4 h-4 ${config.color}`} />
                        <span>Change Status</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Set Available</SelectItem>
                      <SelectItem value="occupied">Set Occupied</SelectItem>
                      <SelectItem value="reserved">Set Reserved</SelectItem>
                    </SelectContent>
                  </Select>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : (
        /* Empty / No Results State */
        <Card className="flex flex-col items-center justify-center py-24 text-center border-dashed">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <LayoutGrid className="w-8 h-8 text-muted-foreground opacity-50" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No tables found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            {searchQuery || filterSection !== 'all' || filterStatus !== 'all' 
              ? "We couldn't find any tables matching your current filters. Try adjusting your search."
              : "Your floor plan is currently empty. Add your first table to get started organizing your restaurant."}
          </p>
          {searchQuery || filterSection !== 'all' || filterStatus !== 'all' ? (
            <Button variant="outline" onClick={() => {
              setSearchQuery('');
              setFilterSection('all');
              setFilterStatus('all');
            }}>
              Clear Filters
            </Button>
          ) : (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Table
            </Button>
          )}
        </Card>
      )}

      {/* Table History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="w-5 h-5 text-primary" />
              Occupancy History: Table #{selectedTableForHistory?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : tableHistory.length > 0 ? (
              <div className="space-y-4">
                {tableHistory.map((entry) => (
                  <Card key={entry.id} className="border border-border/50 shadow-none">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">{entry.guestsCount} Guests</span>
                          <Badge variant="outline" className="text-xs">
                             {entry.durationMinutes} min
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(entry.startedAt).toLocaleString()} — {new Date(entry.endedAt).toLocaleTimeString()}
                        </p>
                      </div>
                      {entry.orderId && (
                        <div className="text-right">
                          <p className="text-xs font-mono text-muted-foreground">Order ID</p>
                          <p className="text-sm font-medium">{entry.orderId.substring(0, 8)}...</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <HistoryIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No occupancy history available for this table yet.</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>
              Close History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}