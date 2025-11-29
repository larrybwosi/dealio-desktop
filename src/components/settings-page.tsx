'use client';

import { useState } from 'react';
import { usePosStore } from '@/store/store';
import { businessConfigs, type BusinessType } from '@/lib/business-configs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanBarcode, Play, Square, RefreshCcw, Search } from 'lucide-react';
import { useAuthStore } from '@/store/pos-auth-store';
import { invoke } from '@tauri-apps/api/core';
import { useScanner } from '@/hooks/use-scanner';
import PrinterSettings from './printer.config';

interface HidDevice {
  vid: number;
  pid: number;
  name: string;
}
export function SettingsPage() {
  const settings = usePosStore(state => state.settings);
  const updateBusinessSettings = usePosStore(state => state.updateBusinessSettings);
  const toggleSidebarItem = usePosStore(state => state.toggleSidebarItem);
  const changeBusinessType = usePosStore(state => state.changeBusinessType);
  const getBusinessConfig = usePosStore(state => state.getBusinessConfig);
  const updateThemeConfig = usePosStore(state => state.updateThemeConfig);
  const updateSecurityConfig = usePosStore(state => state.updateSecurityConfig);
  const updateApiSyncConfig = usePosStore(state => state.updateApiSyncConfig);
  const syncDataToApi = usePosStore(state => state.syncDataToApi);
  const updateNotificationSettings = usePosStore(state => state.updateNotificationSettings);
  const { setDeviceKey } = useAuthStore(state => state);

  const {
    vid,
    pid,
    setVid,
    setPid,
    startScanner,
    stopScanner,
    isScanning,
    isConnected,
    scanHistory,
    error: scannerError,
    clearHistory
  } = useScanner();


  // 2. Local state for device discovery
  const [detectedDevices, setDetectedDevices] = useState<HidDevice[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 3. Helper to find devices via Rust
  const handleDetectDevices = async () => {
    setIsSearching(true);
    try {
      // Calls the Rust command: fn list_hid_devices
      const devices = await invoke<[number, number, string][]>('list_hid_devices');
      
      // Transform tuple to object for easier handling
      const mapped = devices.map(([vid, pid, name]) => ({ vid, pid, name }));
      setDetectedDevices(mapped);
    } catch (err) {
      console.error("Failed to list devices", err);
    } finally {
      setIsSearching(false);
    }
  };

  // 4. Helper to auto-fill inputs when a device is clicked
  const selectDevice = (device: HidDevice) => {
    // Convert decimal to Hex string (e.g. 59473 -> 0xE851)
    const vidHex = '0x' + device.vid.toString(16).toUpperCase();
    const pidHex = '0x' + device.pid.toString(16).toUpperCase();
    
    setVid(vidHex);
    setPid(pidHex);
    setDetectedDevices([]);
  };

  const [businessName, setBusinessName] = useState(settings?.businessName || '');
  const [businessType, setBusinessType] = useState<BusinessType>(settings?.businessType || 'restaurant');
  const [currency, setCurrency] = useState(settings?.currency || 'USD');
  const [taxRate, setTaxRate] = useState((settings?.taxRate ?? 0).toString());
  const [allowSaveUnpaidOrders, setAllowSaveUnpaidOrders] = useState(settings?.allowSaveUnpaidOrders ?? false);
  const [enableCustomerManagement, setEnableCustomerManagement] = useState(settings?.enableCustomerManagement ?? false);
  const [enableEmployeeManagement, setEnableEmployeeManagement] = useState(settings?.enableEmployeeManagement ?? false);
  const [enableLowStockAlerts, setEnableLowStockAlerts] = useState(settings?.enableLowStockAlerts ?? false);
  const [lowStockThreshold, setLowStockThreshold] = useState((settings?.lowStockThreshold ?? 10).toString());
  const [enableCashDrawer, setEnableCashDrawer] = useState(settings?.enableCashDrawer ?? false);
  const [requireEmployeePin, setRequireEmployeePin] = useState(settings?.requireEmployeePin ?? false);
  const [enableAutoPrint, setEnableAutoPrint] = useState(settings?.enableAutoPrint ?? false);
  const [printerName] = useState(settings?.printerName || '');
  const [enableEmailReceipts] = useState(settings?.enableEmailReceipts ?? false);

  const [syncing, setSyncing] = useState(false);

  const currentConfig = getBusinessConfig();

  const handleSaveSettings = () => {
    const newTaxRate = Number.parseFloat(taxRate) || 0;
    const newLowStockThreshold = Number.parseInt(lowStockThreshold, 10) || 10;

    updateBusinessSettings({
      businessName,
      currency,
      taxRate: newTaxRate,
      allowSaveUnpaidOrders,
      enableCustomerManagement,
      enableEmployeeManagement,
      enableLowStockAlerts,
      lowStockThreshold: newLowStockThreshold,
      enableCashDrawer,
      requireEmployeePin,
      enableAutoPrint,
      printerName,
      enableEmailReceipts,
    });
    alert('Settings saved successfully!');
  };

  const handleBusinessTypeChange = (newType: BusinessType) => {
    setBusinessType(newType);
    changeBusinessType(newType);
    const config = businessConfigs[newType];
    setTaxRate(config.taxSettings.defaultRate.toString());
  };

  const handleSyncData = async () => {
    setSyncing(true);
    const result = await syncDataToApi();
    setSyncing(false);

    if (result.success) {
      alert('Data synced successfully!');
    } else {
      alert(`Sync failed: ${result.error}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your business settings and preferences</p>
        </div>

        <Separator />

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            {' '}
            {/* Changed from 7 to 8 columns */}
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="theme">Theme</TabsTrigger>
            <TabsTrigger value="enterprise">Enterprise</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger> {/* Added notifications tab */}
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
            <TabsTrigger value="api">API Sync</TabsTrigger>
            <TabsTrigger value="navigation">Navigation</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Business Information</h2>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    placeholder="Enter business name"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="businessType">Business Type</Label>
                  <Select value={businessType} onValueChange={handleBusinessTypeChange}>
                    <SelectTrigger id="businessType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(businessConfigs).map(config => (
                        <SelectItem key={config.type} value={config.type}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">{currentConfig.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IDR">IDR - Indonesian Rupiah</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="GBP">GBP - British Pound</SelectItem>
                        <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                        <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                        <SelectItem value="KSH">KSH Kenyan Shilling</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="taxRate">Tax Rate (%) - {currentConfig.taxSettings.taxLabel}</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={taxRate}
                      onChange={e => setTaxRate(e.target.value)}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">All product prices are tax-inclusive</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Order Management</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Allow Save Unpaid Orders</div>
                    <p className="text-sm text-muted-foreground">
                      Enable the option to save orders to the order list without payment
                    </p>
                  </div>
                  <Switch checked={allowSaveUnpaidOrders} onCheckedChange={setAllowSaveUnpaidOrders} />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-2">Business Features</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Features available for your {currentConfig.label} business type
              </p>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(currentConfig.features).map(([key, enabled]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Badge variant={enabled ? 'default' : 'secondary'} className="w-full justify-center">
                      {enabled ? '✓' : '✗'}{' '}
                      {key
                        .replace(/([A-Z])/g, ' $1')
                        .trim()
                        .replace(/^\w/, c => c.toUpperCase())}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Available Order Types</h2>
              <div className="flex flex-wrap gap-2">
                {currentConfig.orderTypes.map(orderType => (
                  <Badge key={orderType} variant="outline" className="text-sm">
                    {orderType.charAt(0).toUpperCase() + orderType.slice(1)}
                  </Badge>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="theme" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Appearance</h2>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="themeMode">Theme Mode</Label>
                  <Select
                    value={settings.themeConfig?.mode || 'light'}
                    onValueChange={value => updateThemeConfig({ mode: value as any })}
                  >
                    <SelectTrigger id="themeMode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="fontSize">Font Size</Label>
                  <Select
                    value={settings.themeConfig?.fontSize || 'medium'}
                    onValueChange={value => updateThemeConfig({ fontSize: value as any })}
                  >
                    <SelectTrigger id="fontSize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Compact Mode</div>
                    <p className="text-sm text-muted-foreground">Reduce spacing for more content on screen</p>
                  </div>
                  <Switch
                    checked={settings.themeConfig?.compactMode || false}
                    onCheckedChange={value => updateThemeConfig({ compactMode: value })}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Color Customization</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Custom colors require oklch format conversion and are currently managed in globals.css
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value="#4f46e5"
                      disabled
                      className="w-16 h-10 p-1 opacity-50"
                    />
                    <Input
                      value={settings.themeConfig?.primaryColor || 'oklch(0.42 0.145 265)'}
                      readOnly
                      className="flex-1"
                      placeholder="Defined in CSS theme"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Edit colors in app/globals.css for custom themes</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accentColor"
                      type="color"
                      value="#f5f5f5"
                      disabled
                      className="w-16 h-10 p-1 opacity-50"
                    />
                    <Input
                      value={settings.themeConfig?.accentColor || 'oklch(0.96 0.005 240)'}
                      readOnly
                      className="flex-1"
                      placeholder="Defined in CSS theme"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Edit colors in app/globals.css for custom themes</p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="enterprise" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Customer Management</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Customer Management</div>
                    <p className="text-sm text-muted-foreground">
                      Track customer information, purchase history, and loyalty points
                    </p>
                  </div>
                  <Switch checked={enableCustomerManagement} onCheckedChange={setEnableCustomerManagement} />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Employee Management</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Employee Management</div>
                    <p className="text-sm text-muted-foreground">
                      Manage employee accounts, roles, and access permissions
                    </p>
                  </div>
                  <Switch checked={enableEmployeeManagement} onCheckedChange={setEnableEmployeeManagement} />
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Require Employee PIN</div>
                    <p className="text-sm text-muted-foreground">Employees must enter PIN to process transactions</p>
                  </div>
                  <Switch
                    checked={requireEmployeePin}
                    onCheckedChange={setRequireEmployeePin}
                    disabled={!enableEmployeeManagement}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Inventory Management</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Low Stock Alerts</div>
                    <p className="text-sm text-muted-foreground">Get notifications when products are running low</p>
                  </div>
                  <Switch checked={enableLowStockAlerts} onCheckedChange={setEnableLowStockAlerts} />
                </div>

                {enableLowStockAlerts && (
                  <div className="grid gap-2 pl-6">
                    <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                    <Input
                      id="lowStockThreshold"
                      type="number"
                      min="0"
                      value={lowStockThreshold}
                      onChange={e => setLowStockThreshold(e.target.value)}
                      placeholder="10"
                    />
                    <p className="text-xs text-muted-foreground">Alert when stock falls below this number</p>
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Cash Management</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Cash Drawer</div>
                    <p className="text-sm text-muted-foreground">Track cash drawer sessions and reconciliation</p>
                  </div>
                  <Switch checked={enableCashDrawer} onCheckedChange={setEnableCashDrawer} />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Notification Preferences</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Notifications</div>
                    <p className="text-sm text-muted-foreground">
                      Show system notifications for orders, alerts, and updates
                    </p>
                  </div>
                  <Switch
                    checked={settings.notificationSettings?.enabled ?? true}
                    onCheckedChange={value => updateNotificationSettings({ enabled: value })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Sound</div>
                    <p className="text-sm text-muted-foreground">Play sound when notifications appear</p>
                  </div>
                  <Switch
                    checked={settings.notificationSettings?.soundEnabled ?? true}
                    onCheckedChange={value => updateNotificationSettings({ soundEnabled: value })}
                    disabled={!settings.notificationSettings?.enabled}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Notification Types</h2>
              <p className="text-sm text-muted-foreground mb-4">Choose which types of notifications to receive</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Online Orders</div>
                    <p className="text-sm text-muted-foreground">Get notified when new online orders are placed</p>
                  </div>
                  <Switch
                    checked={settings.notificationSettings?.showOnlineOrders ?? true}
                    onCheckedChange={value => updateNotificationSettings({ showOnlineOrders: value })}
                    disabled={!settings.notificationSettings?.enabled}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Low Stock Alerts</div>
                    <p className="text-sm text-muted-foreground">
                      Get notified when products are running low or out of stock
                    </p>
                  </div>
                  <Switch
                    checked={settings.notificationSettings?.showLowStock ?? true}
                    onCheckedChange={value => updateNotificationSettings({ showLowStock: value })}
                    disabled={!settings.notificationSettings?.enabled}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">System Alerts</div>
                    <p className="text-sm text-muted-foreground">
                      Get notified about system updates, warnings, and errors
                    </p>
                  </div>
                  <Switch
                    checked={settings.notificationSettings?.showSystemAlerts ?? true}
                    onCheckedChange={value => updateNotificationSettings({ showSystemAlerts: value })}
                    disabled={!settings.notificationSettings?.enabled}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Display Settings</h2>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="notificationPosition">Notification Position</Label>
                  <Select
                    value={settings.notificationSettings?.position || 'top-right'}
                    onValueChange={(value: any) => updateNotificationSettings({ position: value })}
                    disabled={!settings.notificationSettings?.enabled}
                  >
                    <SelectTrigger id="notificationPosition">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top-right">Top Right</SelectItem>
                      <SelectItem value="top-left">Top Left</SelectItem>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="autoCloseDelay">Auto Close Delay (milliseconds)</Label>
                  <Input
                    id="autoCloseDelay"
                    type="number"
                    min="1000"
                    step="1000"
                    value={settings.notificationSettings?.autoCloseDelay || 5000}
                    onChange={e => updateNotificationSettings({ autoCloseDelay: Number.parseInt(e.target.value) })}
                    disabled={!settings.notificationSettings?.enabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Time before notifications automatically disappear (min: 1000ms)
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">API Integration</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configure your API endpoint to receive real-time notifications for online orders, inventory updates, and
                system events.
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Webhook Endpoint:</p>
                <code className="text-xs bg-background px-2 py-1 rounded">POST /api/notifications</code>
                <p className="text-xs text-muted-foreground mt-2">
                  Your API can send notifications with the following structure:
                </p>
                <pre className="text-xs bg-background p-2 rounded mt-2 overflow-auto">
                  {`{
  "type": "order" | "stock" | "system",
  "priority": "low" | "medium" | "high",
  "title": "Notification Title",
  "message": "Notification message",
  "soundEnabled": true,
  "autoClose": true,
  "metadata": { /* custom data */ }
}`}
                </pre>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Session Management</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Session Timeout</div>
                    <p className="text-sm text-muted-foreground">Automatically log out users after inactivity</p>
                  </div>
                  <Switch
                    checked={settings.securityConfig?.enableSessionTimeout || false}
                    onCheckedChange={value => updateSecurityConfig({ enableSessionTimeout: value })}
                  />
                </div>

                {settings.securityConfig?.enableSessionTimeout && (
                  <div className="grid gap-2 pl-6">
                    <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                    <Input
                      id="sessionTimeout"
                      type="number"
                      min="1"
                      value={settings.securityConfig?.sessionTimeoutMinutes || 30}
                      onChange={e => updateSecurityConfig({ sessionTimeoutMinutes: Number.parseInt(e.target.value) })}
                    />
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Login Security</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Failed Login Lock</div>
                    <p className="text-sm text-muted-foreground">Lock account after multiple failed attempts</p>
                  </div>
                  <Switch
                    checked={settings.securityConfig?.enableFailedLoginLock || false}
                    onCheckedChange={value => updateSecurityConfig({ enableFailedLoginLock: value })}
                  />
                </div>

                {settings.securityConfig?.enableFailedLoginLock && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="grid gap-2">
                      <Label htmlFor="maxAttempts">Max Failed Attempts</Label>
                      <Input
                        id="maxAttempts"
                        type="number"
                        min="1"
                        value={settings.securityConfig?.maxFailedAttempts || 5}
                        onChange={e => updateSecurityConfig({ maxFailedAttempts: Number.parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="lockoutDuration">Lockout Duration (minutes)</Label>
                      <Input
                        id="lockoutDuration"
                        type="number"
                        min="1"
                        value={settings.securityConfig?.lockoutDurationMinutes || 15}
                        onChange={e =>
                          updateSecurityConfig({ lockoutDurationMinutes: Number.parseInt(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Require Strong Passwords</div>
                    <p className="text-sm text-muted-foreground">Enforce minimum 8 characters with mixed case</p>
                  </div>
                  <Switch
                    checked={settings.securityConfig?.requireStrongPasswords || false}
                    onCheckedChange={value => updateSecurityConfig({ requireStrongPasswords: value })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Two-Factor Authentication</div>
                    <p className="text-sm text-muted-foreground">Add extra security layer for admin accounts</p>
                  </div>
                  <Switch
                    checked={settings.securityConfig?.enableTwoFactorAuth || false}
                    onCheckedChange={value => updateSecurityConfig({ enableTwoFactorAuth: value })}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Audit & Compliance</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Audit Log</div>
                    <p className="text-sm text-muted-foreground">Track all user actions and system changes</p>
                  </div>
                  <Switch
                    checked={settings.securityConfig?.enableAuditLog || false}
                    onCheckedChange={value => updateSecurityConfig({ enableAuditLog: value })}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Data Encryption</div>
                    <p className="text-sm text-muted-foreground">Encrypt sensitive data at rest</p>
                  </div>
                  <Switch
                    checked={settings.securityConfig?.enableDataEncryption || false}
                    onCheckedChange={value => updateSecurityConfig({ enableDataEncryption: value })}
                  />
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="hardware" className="space-y-6">
            <PrinterSettings/>
            {/* --- BARCODE SCANNER SECTION (Completely Revamped) --- */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    isConnected 
                      ? 'bg-green-100 dark:bg-green-900/20' 
                      : 'bg-orange-100 dark:bg-orange-900/20'
                  }`}>
                    <ScanBarcode className={`h-5 w-5 ${
                      isConnected 
                        ? 'text-green-700 dark:text-green-400' 
                        : 'text-orange-700 dark:text-orange-400'
                    }`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Barcode Scanner</h2>
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        isConnected 
                          ? 'bg-green-500' 
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`} />
                      <p className="text-sm text-muted-foreground">
                        {isConnected ? 'Device Active & Ready' : 'Not Connected'}
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Start/Stop Controls */}
                <div className="flex gap-2">
                  {!isScanning ? (
                    <Button onClick={startScanner} disabled={!vid || !pid} className="bg-green-600 hover:bg-green-700">
                      <Play className="h-4 w-4 mr-2" /> Start Listener
                    </Button>
                  ) : (
                    <Button onClick={stopScanner} variant="destructive">
                      <Square className="h-4 w-4 mr-2" /> Stop Listener
                    </Button>
                  )}
                </div>
              </div>

              {/* Scanner Error Alert */}
              {scannerError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
                  ⚠️ {scannerError}
                </div>
              )}

              {/* Configuration Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Column: Settings */}
                <div className="space-y-4">
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-2">
                      <label className="text-sm font-medium">Vendor ID (Hex)</label>
                      <Input 
                        value={vid} 
                        onChange={(e) => setVid(e.target.value)} 
                        placeholder="0xE851" 
                        disabled={isScanning}
                        className="font-mono"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-sm font-medium">Product ID (Hex)</label>
                      <Input 
                        value={pid} 
                        onChange={(e) => setPid(e.target.value)} 
                        placeholder="0x2100" 
                        disabled={isScanning}
                        className="font-mono"
                      />
                    </div>
                  </div>

                  {/* Auto-detect Helper */}
                  <div className="pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full border-dashed"
                      onClick={handleDetectDevices}
                      disabled={isScanning || isSearching}
                    >
                      {isSearching ? <RefreshCcw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                      {isSearching ? 'Scanning USB Ports...' : 'Detect Connected Devices'}
                    </Button>

                    {/* Detected Devices List */}
                    {detectedDevices.length > 0 && (
                      <div className="mt-2 border rounded-md divide-y max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-900/50">
                        {detectedDevices.map((device, idx) => (
                          <button
                            key={idx}
                            onClick={() => selectDevice(device)}
                            className="w-full text-left p-2 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 flex justify-between items-center group"
                          >
                            <span className="truncate max-w-[200px]">{device.name || "Unknown Device"}</span>
                            <span className="text-muted-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 font-mono">
                              0x{device.vid.toString(16).toUpperCase()}:0x{device.pid.toString(16).toUpperCase()}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Live Test */}
                <div className="bg-muted/50 rounded-lg p-4 flex flex-col h-full min-h-[160px]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Live Feed</span>
                    {scanHistory.length > 0 && (
                      <button onClick={clearHistory} className="text-xs text-muted-foreground hover:text-destructive">
                        Clear
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 bg-background rounded-md border p-2 overflow-y-auto h-[120px] shadow-inner">
                    {scanHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-xs text-center">
                        <ScanBarcode className="h-8 w-8 mb-2 opacity-20" />
                        Scan a barcode to test
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {scanHistory.map((scan, i) => (
                          <div key={i} className="flex justify-between text-sm py-1 border-b dark:border-gray-700 last:border-0 animate-in fade-in slide-in-from-top-1">
                            <span className="font-mono font-medium">{scan.code}</span>
                            <span className="text-xs text-muted-foreground">{scan.timestamp}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* --- AUTO PRINT SETTINGS (Kept the same) --- */}
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Auto-Print Settings</h2>
              <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <div className="font-medium">Auto-Print Receipts</div>
                  <p className="text-sm text-muted-foreground">
                    Automatically print receipt after completing payment
                  </p>
                </div>
                <Switch checked={enableAutoPrint} onCheckedChange={setEnableAutoPrint} />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">API Configuration</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable API Sync</div>
                    <p className="text-sm text-muted-foreground">Synchronize data with external API</p>
                  </div>
                  <Switch
                    checked={settings.apiSyncConfig?.enabled || false}
                    onCheckedChange={value => updateApiSyncConfig({ enabled: value })}
                  />
                </div>

                {settings.apiSyncConfig?.enabled && (
                  <>
                    {/* <div className="grid gap-2">
                      <Label htmlFor="apiEndpoint">API Endpoint</Label>
                      <Input
                        id="apiEndpoint"
                        placeholder="https://api.example.com/pos/sync"
                        value={settings.apiSyncConfig?.apiEndpoint || ""}
                        onChange={(e) => updateApiSyncConfig({ apiEndpoint: e.target.value })}
                      />
                    </div> */}

                    <div className="grid gap-2">
                      <Label htmlFor="apiKey">API Key</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        placeholder="Enter your API key"
                        value={settings.apiSyncConfig?.apiKey || ''}
                        onChange={e => {
                          updateApiSyncConfig({ apiKey: e.target.value });
                          setDeviceKey(e.target.value);
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </Card>

            {settings.apiSyncConfig?.enabled && (
              <>
                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Sync Options</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <div className="flex-1">
                        <div className="font-medium">Auto Sync</div>
                        <p className="text-sm text-muted-foreground">Automatically sync data periodically</p>
                      </div>
                      <Switch
                        checked={settings.apiSyncConfig?.autoSync || false}
                        onCheckedChange={value => updateApiSyncConfig({ autoSync: value })}
                      />
                    </div>

                    {settings.apiSyncConfig?.autoSync && (
                      <div className="grid gap-2 pl-6">
                        <Label htmlFor="syncInterval">Sync Interval (seconds)</Label>
                        <Input
                          id="syncInterval"
                          type="number"
                          min="60"
                          value={settings.apiSyncConfig?.syncInterval || 300}
                          onChange={e => updateApiSyncConfig({ syncInterval: Number.parseInt(e.target.value) })}
                        />
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-center justify-between py-2">
                      <div className="flex-1">
                        <div className="font-medium">Sync on Order Complete</div>
                        <p className="text-sm text-muted-foreground">Sync immediately after completing orders</p>
                      </div>
                      <Switch
                        checked={settings.apiSyncConfig?.syncOnOrderComplete || false}
                        onCheckedChange={value => updateApiSyncConfig({ syncOnOrderComplete: value })}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="flex-1">
                        <div className="font-medium">Enable Offline Mode</div>
                        <p className="text-sm text-muted-foreground">Continue working when API is unavailable</p>
                      </div>
                      <Switch
                        checked={settings.apiSyncConfig?.enableOfflineMode || false}
                        onCheckedChange={value => updateApiSyncConfig({ enableOfflineMode: value })}
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Data Selection</h2>
                  <p className="text-sm text-muted-foreground mb-4">Choose which data to sync with the API</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2">
                      <span>Orders</span>
                      <Switch
                        checked={settings.apiSyncConfig?.syncOrders || false}
                        onCheckedChange={value => updateApiSyncConfig({ syncOrders: value })}
                      />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span>Inventory</span>
                      <Switch
                        checked={settings.apiSyncConfig?.syncInventory || false}
                        onCheckedChange={value => updateApiSyncConfig({ syncInventory: value })}
                      />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span>Customers</span>
                      <Switch
                        checked={settings.apiSyncConfig?.syncCustomers || false}
                        onCheckedChange={value => updateApiSyncConfig({ syncCustomers: value })}
                      />
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span>Employees</span>
                      <Switch
                        checked={settings.apiSyncConfig?.syncEmployees || false}
                        onCheckedChange={value => updateApiSyncConfig({ syncEmployees: value })}
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Manual Sync</h2>
                  <div className="space-y-4">
                    {settings.apiSyncConfig?.lastSyncTimestamp && (
                      <p className="text-sm text-muted-foreground">
                        Last synced: {new Date(settings.apiSyncConfig.lastSyncTimestamp).toLocaleString()}
                      </p>
                    )}
                    <Button onClick={handleSyncData} disabled={syncing} className="w-full">
                      {syncing ? 'Syncing...' : 'Sync Now'}
                    </Button>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="navigation" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Sidebar Navigation</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Customize which navigation items appear in your sidebar. Some items are automatically configured based
                on your business type.
              </p>
              <div className="space-y-3">
                {settings.sidebarItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between py-2">
                    <div className="flex-1">
                      <div className="font-medium">{item.label}</div>
                    </div>
                    <Switch checked={item.enabled} onCheckedChange={() => toggleSidebarItem(item.id)} />
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSaveSettings} size="lg">
            Save All Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
