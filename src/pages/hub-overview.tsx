import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Monitor,
  ChefHat,
  Tablet,
  Activity,
  Wifi,
  RefreshCcw,
  Clock,
  ShieldCheck,
  Server
} from 'lucide-react';
import { useAuthStore } from '@/store/pos-auth-store';
import { invoke } from '@tauri-apps/api/core';
import { cn } from '@/lib/utils';

interface ConnectedDevice {
  id: string;
  name: string;
  device_type: string;
  ip: string;
  last_seen: number;
  status: string;
  version?: string;
}

export default function HubOverviewPage() {
  const { currentLocation } = useAuthStore();
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
            Monitor and manage all connected terminals in <span className="font-bold text-foreground">{currentLocation?.name}</span>
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

      {/* Hub Status Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2 bg-zinc-950 text-white border-zinc-800">
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
              <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-none">
                <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Security</p>
                <div className="flex items-center gap-2 text-green-500">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs font-bold">ENCRYPTED</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
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

      {/* Device List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Connected Devices</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.length === 0 ? (
            <div className="col-span-full py-12 text-center border-2 border-dashed rounded-xl">
               <p className="text-muted-foreground">No devices connected yet.</p>
            </div>
          ) : (
            devices.map((device) => {
              const active = isRecentlySeen(device.last_seen);
              return (
                <Card key={device.id} className={cn("transition-all", !active && "opacity-60")}>
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
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground uppercase font-bold tracking-tighter">IP Address</span>
                        <span className="font-mono">{device.ip}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground uppercase font-bold tracking-tighter">Last Seen</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(device.last_seen).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground uppercase font-bold tracking-tighter">Role</span>
                        <span className="font-bold">{device.device_type}</span>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1 text-[10px] uppercase font-bold">
                        Ping
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 text-[10px] uppercase font-bold">
                        Remote Log
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
