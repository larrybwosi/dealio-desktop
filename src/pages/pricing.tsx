"use client";

import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  ListFilter,
  Users,
  Tag
} from "lucide-react";


// Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePosPricingSync } from "@/hooks/use-pricing-sync";

// Types (Mirroring your Prisma Schema for UI logic)
interface PriceListUI {
  id: string;
  code: string;
  name?: string; // If you added name to schema
  priority: number;
  isGlobal: boolean;
  isActive: boolean;
  validFrom: string | null;
  validTo: string | null;
  customers?: { id: string }[];
}

export default function PricingSyncDashboard() {
  const { 
    isSyncing, 
    syncError, 
    triggerSync, 
    lastSyncTime, 
    data: syncData,
    metadata
  } = usePosPricingSync();
  console.log("Sync Data:", syncData);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  // Derived State for UI Statistics
  const stats = useMemo(() => {
    if (!syncData?.lists) return { total: 0, global: 0, targeted: 0 };
    const lists = syncData.lists as PriceListUI[];
    return {
      total: lists.length,
      global: lists.filter((l) => l.isGlobal).length,
      targeted: lists.filter((l) => !l.isGlobal).length,
      totalItems: syncData.items?.length || 0
    };
  }, [syncData]);

  const filteredLists = useMemo(() => {
    if (!syncData?.lists) return [];
    const lists = syncData.lists as PriceListUI[];
    if (!searchTerm) return lists;
    return lists.filter(l => l.code.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [syncData, searchTerm]);

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Pricing Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Manage and verify local pricing data for the Point of Sale.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-medium text-foreground">Last Synchronization</p>
            <p className="text-xs text-muted-foreground">
              {lastSyncTime 
                ? formatDistanceToNow(new Date(lastSyncTime), { addSuffix: true }) 
                : "Never synced"}
            </p>
          </div>
          <Button 
            onClick={() => triggerSync()} 
            disabled={isSyncing}
            variant={isSyncing ? "secondary" : "default"}
            className="w-full md:w-auto min-w-[140px]"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </>
            )}
          </Button>
        </div>
      </div>

      <Separator />

      {/* ERROR ALERT */}
      {syncError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Sync Failed</AlertTitle>
          <AlertDescription>
            {(syncError as Error).message || "Unable to connect to the pricing server."}
          </AlertDescription>
        </Alert>
      )}

      {/* TABS NAVIGATION */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="lists">Price Lists</TabsTrigger>
          <TabsTrigger value="allocations">Allocations</TabsTrigger>
        </TabsList>

        {/* --- TAB: OVERVIEW --- */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard 
              title="Total Lists" 
              value={stats.total} 
              icon={<ListFilter className="h-4 w-4 text-muted-foreground" />} 
              loading={isSyncing && !syncData}
            />
            <StatsCard 
              title="Global Strategies" 
              value={stats.global} 
              icon={<GlobeIcon className="h-4 w-4 text-muted-foreground" />} 
              loading={isSyncing && !syncData}
            />
            <StatsCard 
              title="Targeted Deals" 
              value={stats.targeted} 
              icon={<Users className="h-4 w-4 text-muted-foreground" />} 
              loading={isSyncing && !syncData}
            />
            <StatsCard 
              title="Cached SKU Prices" 
              value={stats.totalItems || 0} 
              icon={<Tag className="h-4 w-4 text-muted-foreground" />} 
              loading={isSyncing && !syncData}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sync Health</CardTitle>
              <CardDescription>System status and version information.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-green-500 h-5 w-5" />
                <span className="text-sm font-medium">Local Database is active</span>
              </div>
              <div className="mt-4 text-xs text-muted-foreground bg-muted p-3 rounded-md font-mono">
                Client ID: {metadata?.syncedAt || "Connecting..."} <br/>
                Protocol: Delta V2 <br/>
                Last Type: {metadata?.isDelta ? "Delta Patch" : "Full Download"}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB: PRICE LISTS --- */}
        <TabsContent value="lists">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle>Active Price Lists</CardTitle>
                <CardDescription>
                  Priority determines which price wins (Higher = Winner).
                </CardDescription>
              </div>
              <div className="w-[250px]">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search codes..." 
                    className="pl-8" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] w-full pr-4">
                {isSyncing && !syncData ? (
                  <div className="space-y-3">
                     <Skeleton className="h-12 w-full" />
                     <Skeleton className="h-12 w-full" />
                     <Skeleton className="h-12 w-full" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Priority</TableHead>
                        <TableHead>Code / Name</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Validity</TableHead>
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLists.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center">
                            No price lists found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLists.map((list) => (
                          <TableRow key={list.id}>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {list.priority}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {list.code}
                              {list.name && <span className="block text-xs text-muted-foreground font-normal">{list.name}</span>}
                            </TableCell>
                            <TableCell>
                              {list.isGlobal ? (
                                <Badge variant="secondary">Global</Badge>
                              ) : (
                                <Badge variant="default" className="bg-indigo-600 hover:bg-indigo-700">Targeted</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {list.validTo ? (
                                <span>Until {new Date(list.validTo).toLocaleDateString()}</span>
                              ) : (
                                <span className="italic">Indefinite</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {list.isActive ? (
                                <span className="text-green-600 text-xs font-bold uppercase">Active</span>
                              ) : (
                                <span className="text-red-500 text-xs font-bold uppercase">Inactive</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB: ALLOCATIONS --- */}
        <TabsContent value="allocations">
           <Card>
             <CardHeader>
               <CardTitle>Customer Allocations</CardTitle>
               <CardDescription>Which customers have access to exclusive lists.</CardDescription>
             </CardHeader>
             <CardContent>
               <div className="text-sm text-muted-foreground">
                 {/* This section would iterate over `syncData.data.customerAllocations`.
                    Since that object is a simple Record<string, string[]>, 
                    you would map Keys (Customer IDs) to Values (List IDs).
                 */}
                 {syncData?.customerAllocations ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {Object.entries(syncData.customerAllocations).map(([customerId, listIds]) => (
                        <div key={customerId} className="p-4 border rounded-lg bg-card text-card-foreground shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                             <Users className="h-4 w-4 text-muted-foreground" />
                             <span className="font-mono text-xs">{customerId.slice(0, 8)}...</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {(listIds as string[]).map(lid => (
                               <Badge key={lid} variant="outline" className="text-xs">{lid.slice(0, 5)}..</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                 ) : (
                   <p>No special allocations found.</p>
                 )}
               </div>
             </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper Component for Stats
function StatsCard({ title, value, icon, loading }: { title: string, value: number, icon: React.ReactNode, loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
           <Skeleton className="h-8 w-20" />
        ) : (
           <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}

function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" x2="22" y1="12" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  )
}