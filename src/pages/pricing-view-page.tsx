import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Search, Tag, Users, List } from 'lucide-react';
import { useFormattedCurrency } from '@/lib/utils';
import { format } from 'date-fns';

interface ClientPriceList {
    id: string;
    code: string;
    priority: number;
    isGlobal: boolean;
    isActive: boolean;
    validFrom?: string;
    validTo?: string;
    updatedAt: string;
}

interface ClientPriceListItem {
    id: string;
    priceListId: string;
    variantId: string;
    sellingUnitId?: string;
    minQuantity: number;
    price: string;
    updatedAt: string;
}

interface PosPricingData {
    lists: ClientPriceList[];
    items: ClientPriceListItem[];
    allocations: Record<string, string[]>;
}

export default function PricingViewPage() {
    const [data, setData] = useState<PosPricingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const formatCurrency = useFormattedCurrency();

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await invoke<PosPricingData>('get_pos_pricing_command');
            console.log("Pricing Data:", result);
            setData(result);
        } catch (error) {
            console.error("Failed to fetch pricing:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const filteredLists = data?.lists.filter(l => 
        l.code.toLowerCase().includes(filter.toLowerCase()) || 
        l.id.toLowerCase().includes(filter.toLowerCase())
    ) || [];

    const getItemsForList = (listId: string) => {
        return data?.items.filter(i => i.priceListId === listId) || [];
    };

    if (loading && !data) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-50/50 dark:bg-zinc-950 p-8 font-sans">
            <div className="mx-auto max-w-7xl space-y-8">
                
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Pricing Engine</h1>
                        <p className="text-zinc-500">View active price lists, items, and customer rules.</p>
                    </div>
                    <Button onClick={fetchData} variant="outline" size="sm">
                        <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Lists</CardTitle>
                            <List className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data?.lists.length}</div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
                            <Tag className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data?.items.length}</div>
                        </CardContent>
                    </Card>
                     <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Allocations</CardTitle>
                            <Users className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{Object.keys(data?.allocations || {}).length}</div>
                        </CardContent>
                    </Card>
                </div>

                <Tabs defaultValue="lists" className="w-full">
                    <TabsList>
                        <TabsTrigger value="lists">Price Lists</TabsTrigger>
                        <TabsTrigger value="allocations">Customer Allocations</TabsTrigger>
                        <TabsTrigger value="debug">Raw Data</TabsTrigger>
                    </TabsList>

                    <TabsContent value="lists" className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <Search className="h-4 w-4 text-zinc-500" />
                            <Input 
                                placeholder="Filter lists..." 
                                value={filter} 
                                onChange={(e) => setFilter(e.target.value)}
                                className="max-w-sm h-8"
                            />
                        </div>

                        {filteredLists.map(list => (
                            <Card key={list.id} className="overflow-hidden">
                                <CardHeader className="bg-zinc-50 dark:bg-zinc-900 border-b py-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="font-semibold text-lg">{list.code}</div>
                                            {list.isGlobal && <Badge variant="secondary">Global</Badge>}
                                            {list.isActive ? <Badge className="bg-emerald-600">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}
                                            <Badge variant="outline">Priority: {list.priority}</Badge>
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                            ID: {list.id}
                                        </div>
                                    </div>
                                    <div className="flex gap-4 text-xs text-zinc-500 mt-1">
                                        <span>From: {list.validFrom ? format(new Date(list.validFrom), 'PPP') : 'N/A'}</span>
                                        <span>To: {list.validTo ? format(new Date(list.validTo), 'PPP') : 'N/A'}</span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="max-h-[300px] overflow-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[300px]">Variant ID</TableHead>
                                                    <TableHead>Unit ID (Base if Empty)</TableHead>
                                                    <TableHead>Min Qty</TableHead>
                                                    <TableHead className="text-right">Price</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {getItemsForList(list.id).map(item => (
                                                    <TableRow key={item.id}>
                                                        <TableCell className="font-mono text-xs text-zinc-600">{item.variantId}</TableCell>
                                                        <TableCell className="font-mono text-xs text-zinc-600">{item.sellingUnitId || <span className="text-zinc-400 italic">Base Unit</span>}</TableCell>
                                                        <TableCell>{item.minQuantity}</TableCell>
                                                        <TableCell className="text-right font-medium">{formatCurrency(parseFloat(item.price))}</TableCell>
                                                    </TableRow>
                                                ))}
                                                {getItemsForList(list.id).length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} className="text-center text-zinc-500 py-4">No items defined in this list</TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                    <TabsContent value="allocations">
                         <Card>
                            <CardHeader>
                                <CardTitle>Customer Rules</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Customer ID</TableHead>
                                            <TableHead>Assigned Price Lists</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Object.entries(data?.allocations || {}).map(([custId, lists]) => (
                                            <TableRow key={custId}>
                                                <TableCell className="font-mono text-xs">{custId}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        {lists.map(lid => {
                                                            const listName = data?.lists.find(l => l.id === lid)?.code || lid;
                                                            return <Badge key={lid} variant="outline" className="text-xs">{listName}</Badge>
                                                        })}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                         {Object.keys(data?.allocations || {}).length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center text-zinc-500 py-8">No specific customer allocations found</TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="debug">
                         <Card>
                            <CardHeader>
                                <CardTitle>Raw JSON Data</CardTitle>
                            </CardHeader>
                             <CardContent>
                                <pre className="bg-zinc-100 dark:bg-zinc-900 p-4 rounded text-xs overflow-auto max-h-[500px]">
                                    {JSON.stringify(data, null, 2)}
                                </pre>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
