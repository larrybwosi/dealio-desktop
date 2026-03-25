import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Monitor,
  ChefHat,
  Tablet,
  Activity,
  Wifi,
  RefreshCcw,
  Clock,
  ShieldCheck,
  Server,
  Users,
  UserMinus,
  UserCheck
} from 'lucide-react';
import { useAuthStore } from '@/store/pos-auth-store';
import { usePosStore } from '@/store/store';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ConnectedDevice {
  id: string;
  name: string;
  device_type: string;
  ip: string;
  last_seen: number;
  status: string;
  current_user_id: string | null;
  current_user_name: string | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
}

export default function HubOverviewPage() {
  const { currentLocation } = useAuthStore();
  const { employees } = usePosStore();
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hubIp, setHubIp] = useState<string>('Loading...');

  const fetchDevices = async () => {
    setIsRefreshing(true);
    try {
      const ip = await invoke<string>('get_local_ip_command').catch(() => '127.0.0.1');
      setHubIp(ip);

      const connectedDevices = await invoke<ConnectedDevice[]>('get_connected_devices');
      setDevices(connectedDevices);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAssign = async (deviceId: string, userId: string | null) => {
    const user = employees.find(e => e.id === userId);
    try {
      await invoke('assign_user_to_device', {
        deviceId,
        userId,
        userName: user?.name || null
      });
      toast.success(userId ? `Assigned ${user?.name} to device` : 'User unassigned');
      fetchDevices();
    } catch (error) {
      toast.error('Failed to update assignment');
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'KDS': return <ChefHat className="w-5 h-5" />;
      case 'TABLET': return <Tablet className="w-5 h-5" />;
      case 'MAIN_HUB': return <Monitor className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  const isRecentlySeen = (lastSeen: number) => {
    return Date.now() - lastSeen < 30000; // 30 seconds
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">Enterprise Hub Overview</h1>
          <p className="text-muted-foreground mt-1">
            Monitor and manage terminals in <span className="font-bold text-foreground">{currentLocation?.name}</span>
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchDevices}
          disabled={isRefreshing}
          className="gap-2"
        >
          <RefreshCcw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          Refresh Status
        </Button>
      </div>

      <Tabs defaultValue="devices" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-8">
          <TabsTrigger value="devices" className="gap-2">
            <Monitor className="w-4 h-4" />
            Devices
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2">
            <Users className="w-4 h-4" />
            Staff Assignments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
          {/* Hub Status Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 bg-zinc-950 text-white border-zinc-800 shadow-2xl">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-zinc-400">Hub Server Status</CardTitle>
                <Server className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex-1">
                    <div className="text-4xl font-black tracking-tighter uppercase">Active</div>
                    <div className="flex items-center gap-2 mt-2 text-zinc-400 font-mono text-sm">
                      <Wifi className="w-4 h-4 text-green-500" />
                      Broadcasting on {hubIp}:8080
                    </div>
                  </div>
                  <div className="hidden sm:block p-4 bg-zinc-900 border border-zinc-800 rounded-none">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Security</p>
                    <div className="flex items-center gap-2 text-green-500">
                      <ShieldCheck className="w-4 h-4" />
                      <span className="text-xs font-bold">ENCRYPTED</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Terminals</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-black tracking-tighter">{devices.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {devices.filter(d => isRecentlySeen(d.last_seen)).length} active / {devices.filter(d => !isRecentlySeen(d.last_seen)).length} inactive
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Connected Terminals</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {devices.length === 0 ? (
                <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
                   <p className="text-muted-foreground">No devices connected yet.</p>
                </div>
              ) : (
                devices.map((device) => {
                  const active = isRecentlySeen(device.last_seen);
                  return (
                    <Card key={device.id} className={cn("transition-all shadow-sm hover:shadow-md", !active && "opacity-60")}>
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                          <div className={cn(
                            "p-3 rounded-none mb-4",
                            active ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"
                          )}>
                            {getDeviceIcon(device.device_type)}
                          </div>
                          <Badge variant={active ? 'default' : 'secondary'} className="uppercase text-[10px] font-bold">
                            {active ? 'online' : 'offline'}
                          </Badge>
                        </div>

                        <h4 className="font-bold text-lg leading-tight truncate">{device.name}</h4>
                        {device.current_user_name && (
                           <div className="flex items-center gap-1.5 mt-1 text-green-600 font-bold uppercase text-[10px]">
                              <UserCheck className="w-3 h-3" />
                              Active: {device.current_user_name}
                           </div>
                        )}
                        {device.assigned_user_name && !device.current_user_name && (
                           <div className="flex items-center gap-1.5 mt-1 text-blue-600 font-bold uppercase text-[10px]">
                              <Users className="w-3 h-3" />
                              Assigned: {device.assigned_user_name}
                           </div>
                        )}

                        <div className="mt-6 space-y-2 border-t pt-4">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground uppercase font-bold tracking-tighter text-[10px]">IP Address</span>
                            <span className="font-mono">{device.ip}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground uppercase font-bold tracking-tighter text-[10px]">Last Seen</span>
                            <span className="flex items-center gap-1 font-medium">
                              <Clock className="w-3 h-3" />
                              {new Date(device.last_seen).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground uppercase font-bold tracking-tighter text-[10px]">Role</span>
                            <span className="font-bold text-blue-500">{device.device_type}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="staff" className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
           <Card>
              <CardHeader>
                 <CardTitle>Staff Assignments</CardTitle>
                 <CardDescription>Assign checked-in staff members to specific KDS or Tablet devices.</CardDescription>
              </CardHeader>
              <CardContent>
                 <div className="rounded-md border">
                    <Table>
                       <TableHeader>
                          <TableRow>
                             <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Terminal</TableHead>
                             <TableHead className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Current Operator</TableHead>
                             <TableHead className="text-right font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Action</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {devices.map(device => (
                             <TableRow key={device.id}>
                                <TableCell>
                                   <div className="flex items-center gap-3">
                                      <div className="p-2 bg-muted rounded-none">
                                         {getDeviceIcon(device.device_type)}
                                      </div>
                                      <div>
                                         <p className="font-bold leading-tight">{device.name}</p>
                                         <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">{device.device_type} · {device.ip}</p>
                                      </div>
                                   </div>
                                </TableCell>
                                <TableCell>
                                   <div className="flex flex-col gap-1">
                                      {device.current_user_name ? (
                                         <Badge variant="default" className="gap-2 py-1 px-3 bg-green-500 text-white border-transparent w-fit">
                                            <UserCheck className="w-3.5 h-3.5" />
                                            {device.current_user_name} (Logged In)
                                         </Badge>
                                      ) : device.assigned_user_name ? (
                                         <Badge variant="outline" className="gap-2 py-1 px-3 bg-blue-50/50 text-blue-700 border-blue-200 w-fit">
                                            <Users className="w-3.5 h-3.5" />
                                            {device.assigned_user_name} (Assigned)
                                         </Badge>
                                      ) : (
                                         <span className="text-muted-foreground italic text-xs">Unassigned</span>
                                      )}
                                   </div>
                                </TableCell>
                                <TableCell className="text-right">
                                   <div className="flex justify-end gap-2">
                                      <select
                                         className="h-8 rounded-none border border-input bg-background px-3 py-1 text-xs focus-visible:ring-1 focus-visible:ring-ring"
                                         value={device.assigned_user_id || ''}
                                         onChange={(e) => handleAssign(device.id, e.target.value || null)}
                                      >
                                         <option value="">Choose User...</option>
                                         {employees.map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                                         ))}
                                      </select>
                                      {device.assigned_user_id && (
                                         <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => handleAssign(device.id, null)}
                                         >
                                            <UserMinus className="h-4 w-4" />
                                         </Button>
                                      )}
                                   </div>
                                </TableCell>
                             </TableRow>
                          ))}
                          {devices.length === 0 && (
                             <TableRow>
                                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground italic">No terminals connected.</TableCell>
                             </TableRow>
                          )}
                       </TableBody>
                    </Table>
                 </div>
              </CardContent>
           </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
