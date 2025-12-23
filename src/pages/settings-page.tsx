'use client';

import { useState, useEffect } from 'react';
import { usePosStore } from '@/store/store';
import { businessConfigs, type BusinessType } from '@/lib/business-configs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanBarcode, Play, Square, RefreshCcw, Search, CreditCard, Smartphone, Monitor, DoorOpen, Plus, Trash, Image, Type } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { useScanner } from '@/hooks/use-scanner';
import { useCashDrawer } from '@/hooks/use-cash-drawer';
import PrinterSettings from '@/components/printer.config';
import { toast } from 'sonner';
import { UpdateTestingPanel } from '@/components/update-testing-panel';
import GeneralSettings from '@/components/settings/general-tab';
// import { useTheme } from 'next-themes';


interface HidDevice {
  vid: number;
  pid: number;
  name: string;
}
export default function SettingsPage() {
  const settings = usePosStore(state => state.settings);
  const updateBusinessSettings = usePosStore(state => state.updateBusinessSettings);
  const toggleSidebarItem = usePosStore(state => state.toggleSidebarItem);
  const changeBusinessType = usePosStore(state => state.changeBusinessType);
  const getBusinessConfig = usePosStore(state => state.getBusinessConfig);
  const updateThemeConfig = usePosStore(state => state.updateThemeConfig);
  const updateSecurityConfig = usePosStore(state => state.updateSecurityConfig);
  const updateNotificationSettings = usePosStore(state => state.updateNotificationSettings);
  const updateCustomerDisplayConfig = usePosStore(state => state.updateCustomerDisplayConfig);

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

  const {
    openPhysicalDrawer,
    getSerialPorts,
    availablePorts,
    isOpening: isOpeningDrawer,
    isLoadingPorts,
  } = useCashDrawer();

  // const { setTheme } = useTheme()

  const THEME_PRESETS = [
    { name: 'Default', primary: 'oklch(0.623 0.188 259.815)', accent: 'oklch(0.951 0.025 236.824)' }, // Default Purple
    { name: 'Ocean', primary: '#0ea5e9', accent: '#38bdf8' }, // Sky Blue
    { name: 'Forest', primary: '#22c55e', accent: '#86efac' }, // Green
    { name: 'Rose', primary: '#f43f5e', accent: '#fda4af' }, // Rose
    { name: 'Orange', primary: '#f97316', accent: '#fdba74' }, // Orange
    { name: 'Slate', primary: '#64748b', accent: '#cbd5e1' }, // Slate
  ];

  const applyPreset = (preset: typeof THEME_PRESETS[0]) => {
    updateThemeConfig({
      primaryColor: preset.primary,
      accentColor: preset.accent,
    });
    // Optional: Reset to light/dark if needed, but let's keep user preference
  };


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
  const [printerName] = useState(settings?.printerName || '');
  const [enableEmailReceipts] = useState(settings?.enableEmailReceipts ?? false);
  const [paybillNumber, setPaybillNumber] = useState(settings?.paybillNumber || '');
  const [tillNumber, setTillNumber] = useState(settings?.tillNumber || '');
  const [enableCustomerDisplay, setEnableCustomerDisplay] = useState(settings?.enableCustomerDisplay ?? true);
  const [cashDrawerPort, setCashDrawerPort] = useState(settings?.cashDrawerPort || '');
  const [enableAutoStart, setEnableAutoStart] = useState(settings?.enableAutoStart ?? false);
  const [enableBarcodeScanner, setEnableBarcodeScanner] = useState(settings?.enableBarcodeScanner ?? true);
  
  // Hold Sale Settings
  const [enableHoldSale, setEnableHoldSale] = useState(settings?.enableHoldSale ?? true);
  const [maxHeldOrders, setMaxHeldOrders] = useState((settings?.maxHeldOrders ?? 20).toString());
  const [heldOrderExpiryHours, setHeldOrderExpiryHours] = useState((settings?.heldOrderExpiryHours ?? 24).toString());
  const [requireHoldReason, setRequireHoldReason] = useState(settings?.requireHoldReason ?? false);
  const currentConfig = getBusinessConfig();

  // Sync auto-start local state with OS setting on mount
  useEffect(() => {
    isEnabled().then(enabled => {
      setEnableAutoStart(enabled);
    }).catch(err => console.error("Failed to check auto-start status", err));
  }, []);

  const handleSaveSettings = () => {
    const newTaxRate = Number.parseFloat(taxRate) || 0;
    const newLowStockThreshold = Number.parseInt(lowStockThreshold, 10) || 10;
    const newMaxHeldOrders = Number.parseInt(maxHeldOrders, 10) || 20;
    const newHeldOrderExpiryHours = heldOrderExpiryHours ? Number.parseInt(heldOrderExpiryHours, 10) : undefined;

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
      printerName,
      enableEmailReceipts,
      paybillNumber,
      tillNumber,
      enableCustomerDisplay,
      cashDrawerPort,
      enableAutoStart,
      enableBarcodeScanner,
      enableHoldSale,
      maxHeldOrders: newMaxHeldOrders,
      heldOrderExpiryHours: newHeldOrderExpiryHours,
      requireHoldReason,
    });

    // Update Auto-start OS setting
    try {
      if (enableAutoStart) {
        enable();
      } else {
        disable();
      }
    } catch (err) {
      console.error("Failed to update auto-start setting", err);
    }

    toast.success('Settings saved successfully!');
  };

  const handleBusinessTypeChange = (newType: BusinessType) => {
    setBusinessType(newType);
    changeBusinessType(newType);
    const config = businessConfigs[newType];
    setTaxRate(config.taxSettings.defaultRate.toString());
  };


  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your business settings and preferences</p>
        </div>

        <Separator />

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-11">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="theme">Theme</TabsTrigger>
            <TabsTrigger value="enterprise">Enterprise</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="hardware">Hardware</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="customer-display">Display</TabsTrigger>
            <TabsTrigger value="navigation">Navigation</TabsTrigger>
            <TabsTrigger value="developer">Developer</TabsTrigger>
          </TabsList>

          <GeneralSettings
            businessName={businessName}
            setBusinessName={setBusinessName}
            businessType={businessType}
            handleBusinessTypeChange={handleBusinessTypeChange}
            businessConfigs={businessConfigs}
            currentConfig={currentConfig}
            currency={currency}   
            setCurrency={setCurrency}
            taxRate={taxRate}
            setTaxRate={setTaxRate}
            allowSaveUnpaidOrders={allowSaveUnpaidOrders}
            setAllowSaveUnpaidOrders={setAllowSaveUnpaidOrders}
            enableAutoStart={enableAutoStart}
            setEnableAutoStart={setEnableAutoStart}
          />

          <TabsContent value="theme" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Appearance</h2>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="themeMode">Theme Mode</Label>
                  <Select
                    value={settings.themeConfig?.mode || 'light'}
                    onValueChange={value =>{
                      updateThemeConfig({ mode: value as any })
                      // setTheme(value)
                    }}
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
              
              {/* Presets */}
              <div className="mb-6">
                 <Label className="block mb-2">Theme Presets</Label>
                 <div className="flex flex-wrap gap-2">
                    {THEME_PRESETS.map((preset) => (
                      <Button
                        key={preset.name}
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => applyPreset(preset)}
                      >
                         <div 
                           className="w-4 h-4 rounded-full border border-border" 
                           style={{ backgroundColor: preset.primary }} 
                         />
                         {preset.name}
                      </Button>
                    ))}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={settings.themeConfig?.primaryColor?.startsWith('#') ? settings.themeConfig.primaryColor : "#6366f1"}
                        onChange={(e) => updateThemeConfig({ primaryColor: e.target.value })}
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                    </div>
                    <Input
                      value={settings.themeConfig?.primaryColor || 'Default'}
                      onChange={(e) => updateThemeConfig({ primaryColor: e.target.value })}
                      className="flex-1"
                      placeholder="#000000 or oklch(...)"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Select a brand color</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="accentColor">Accent Color</Label>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Input
                        id="accentColor"
                        type="color"
                        value={settings.themeConfig?.accentColor?.startsWith('#') ? settings.themeConfig.accentColor : "#f4f4f5"}
                        onChange={(e) => updateThemeConfig({ accentColor: e.target.value })}
                        className="w-16 h-10 p-1 cursor-pointer"
                      />
                    </div>
                    <Input
                      value={settings.themeConfig?.accentColor || 'Default'}
                      onChange={(e) => updateThemeConfig({ accentColor: e.target.value })}
                      className="flex-1"
                      placeholder="#000000 or oklch(...)"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Select a secondary/highlight color</p>
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

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Hold Sale</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Hold Sale</div>
                    <p className="text-sm text-muted-foreground">
                      Allow cashiers to temporarily hold transactions
                    </p>
                  </div>
                  <Switch checked={enableHoldSale} onCheckedChange={setEnableHoldSale} />
                </div>

                {enableHoldSale && (
                  <>
                    <div className="grid grid-cols-2 gap-4 pl-6">
                      <div className="grid gap-2">
                        <Label htmlFor="maxHeldOrders">Max Held Orders</Label>
                        <Input
                          id="maxHeldOrders"
                          type="number"
                          min="1"
                          max="100"
                          value={maxHeldOrders}
                          onChange={e => setMaxHeldOrders(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Limit concurrent held orders</p>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="heldOrderExpiryHours">Auto-Expire (Hours)</Label>
                        <Input
                          id="heldOrderExpiryHours"
                          type="number"
                          min="1"
                          value={heldOrderExpiryHours}
                          onChange={e => setHeldOrderExpiryHours(e.target.value)}
                          placeholder="Never"
                        />
                        <p className="text-xs text-muted-foreground">Time before orders auto-expire</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-2 pl-6">
                      <div className="flex-1">
                        <div className="font-medium">Require Hold Reason</div>
                        <p className="text-sm text-muted-foreground">
                          Force cashiers to enter a reason when holding an order
                        </p>
                      </div>
                      <Switch checked={requireHoldReason} onCheckedChange={setRequireHoldReason} />
                    </div>
                  </>
                )}
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
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/20">
                      <Monitor className="h-5 w-5 text-indigo-700 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Customer Display</h2>
                      <p className="text-sm text-muted-foreground">Manage the secondary screen for customers</p>
                    </div>
                  </div>
              </div>

               <div className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <div className="font-medium">Enable Customer Screen</div>
                  <p className="text-sm text-muted-foreground">
                    Automatically launch the customer facing window on application startup
                  </p>
                </div>
                <Switch checked={enableCustomerDisplay} onCheckedChange={setEnableCustomerDisplay} />
              </div>
            </Card>

            <PrinterSettings/>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    enableBarcodeScanner 
                      ? 'bg-indigo-100 dark:bg-indigo-900/20' 
                      : 'bg-gray-100 dark:bg-gray-800'
                  }`}>
                    <ScanBarcode className={`h-5 w-5 ${
                      enableBarcodeScanner 
                        ? 'text-indigo-700 dark:text-indigo-400' 
                        : 'text-gray-500'
                    }`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Barcode Scanning Feature</h2>
                    <p className="text-sm text-muted-foreground">
                      Enable or disable systemic support for barcode scanning
                    </p>
                  </div>
                </div>
                <Switch checked={enableBarcodeScanner} onCheckedChange={setEnableBarcodeScanner} />
              </div>

              {enableBarcodeScanner && (
                <div className="space-y-6 pt-4 border-t">
                  <div className="flex items-center justify-between">
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
                        <h3 className="text-lg font-medium">Hardware Scanner</h3>
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
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-md text-sm">
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
                </div>
              )}
            </Card>

            {/* --- CASH DRAWER SETTINGS --- */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg transition-colors ${
                    enableCashDrawer && cashDrawerPort 
                      ? 'bg-green-100 dark:bg-green-900/20' 
                      : 'bg-orange-100 dark:bg-orange-900/20'
                  }`}>
                    <DoorOpen className={`h-5 w-5 ${
                      enableCashDrawer && cashDrawerPort 
                        ? 'text-green-700 dark:text-green-400' 
                        : 'text-orange-700 dark:text-orange-400'
                    }`} />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Cash Drawer</h2>
                    <p className="text-sm text-muted-foreground">
                      {enableCashDrawer && cashDrawerPort ? 'Connected & Ready' : 'Configure serial port'}
                    </p>
                  </div>
                </div>
                <Switch checked={enableCashDrawer} onCheckedChange={setEnableCashDrawer} />
              </div>

              {enableCashDrawer && (
                <div className="space-y-4">
                  {/* Port Selection */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cashDrawerPort">Serial Port</Label>
                      <Select value={cashDrawerPort} onValueChange={setCashDrawerPort}>
                        <SelectTrigger id="cashDrawerPort">
                          <SelectValue placeholder="Select port..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availablePorts.length === 0 ? (
                            <SelectItem value="none" disabled>No ports detected</SelectItem>
                          ) : (
                            availablePorts.map((port) => (
                              <SelectItem key={port} value={port}>{port}</SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Actions</Label>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => getSerialPorts()}
                          disabled={isLoadingPorts}
                        >
                          {isLoadingPorts ? (
                            <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4 mr-2" />
                          )}
                          Detect Ports
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => openPhysicalDrawer(cashDrawerPort)}
                          disabled={!cashDrawerPort || isOpeningDrawer}
                        >
                          {isOpeningDrawer ? (
                            <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <DoorOpen className="h-4 w-4 mr-2" />
                          )}
                          Test Drawer
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Info Box */}
                  {!cashDrawerPort && availablePorts.length === 0 && (
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                      💡 Click "Detect Ports" to find connected serial devices. Cash drawers are typically connected via USB-to-Serial adapter.
                    </div>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <CreditCard className="h-5 w-5 text-blue-700 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Mobile Money Configuration</h2>
                  <p className="text-sm text-muted-foreground">Configure M-Pesa Paybill and Till numbers for payments</p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="paybillNumber">Paybill Number</Label>
                    <Input
                      id="paybillNumber"
                      value={paybillNumber}
                      onChange={e => setPaybillNumber(e.target.value)}
                      placeholder="e.g. 123456"
                    />
                    <p className="text-xs text-muted-foreground">
                      Business number for Paybill payments
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="tillNumber">Till Number (Buy Goods)</Label>
                    <Input
                      id="tillNumber"
                      value={tillNumber}
                      onChange={e => setTillNumber(e.target.value)}
                      placeholder="e.g. 765432"
                    />
                    <p className="text-xs text-muted-foreground">
                      Store number for Buy Goods payments
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-4 h-fit">
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Preview
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-white/10">
                      <span className="text-muted-foreground">Paybill Mode:</span>
                      <span className="font-mono">{paybillNumber || 'Not Configured'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-white/10">
                      <span className="text-muted-foreground">Buy Goods Mode:</span>
                      <span className="font-mono">{tillNumber || 'Not Configured'}</span>
                    </div>
                    {(!paybillNumber && !tillNumber) && (
                      <div className="pt-2 text-amber-600 dark:text-amber-400 text-xs">
                        ⚠️ Please configure at least one payment method for mobile money payments to work correctly.
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button onClick={handleSaveSettings}>Save Payment Settings</Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="customer-display" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <Monitor className="h-5 w-5 text-purple-700 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Customer Facing Display</h2>
                  <p className="text-sm text-muted-foreground">Customize the experience on the secondary screen</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex-1">
                    <div className="font-medium">Enable Customer Display</div>
                    <p className="text-sm text-muted-foreground">Activate the secondary screen output</p>
                  </div>
                  <Switch
                    checked={settings.customerDisplayConfig?.enabled ?? true}
                    onCheckedChange={val => updateCustomerDisplayConfig({ enabled: val })}
                  />
                </div>

                {settings.customerDisplayConfig?.enabled !== false && (
                  <>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label>Welcome Message</Label>
                        <Input
                          value={settings.customerDisplayConfig?.welcomeMessage || ''}
                          onChange={e => updateCustomerDisplayConfig({ welcomeMessage: e.target.value })}
                          placeholder="e.g. Dealio Enterprise"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Sub-Message</Label>
                        <Input
                          value={settings.customerDisplayConfig?.subMessage || ''}
                          onChange={e => updateCustomerDisplayConfig({ subMessage: e.target.value })}
                          placeholder="e.g. Welcome to our store"
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between py-2 border rounded-lg p-3">
                        <div>
                          <div className="font-medium text-sm">Show Clock</div>
                        </div>
                        <Switch
                          checked={settings.customerDisplayConfig?.showTime ?? true}
                          onCheckedChange={val => updateCustomerDisplayConfig({ showTime: val })}
                        />
                      </div>
                      <div className="flex items-center justify-between py-2 border rounded-lg p-3">
                        <div>
                          <div className="font-medium text-sm">Show Company Logo</div>
                        </div>
                        <Switch
                          checked={settings.customerDisplayConfig?.showCompanyLogo ?? true}
                          onCheckedChange={val => updateCustomerDisplayConfig({ showCompanyLogo: val })}
                        />
                      </div>
                    </div>

                    <div className="grid gap-2">
                      <Label>Slide Interval (Seconds)</Label>
                      <Input
                        type="number"
                        min="3"
                        max="60"
                        value={settings.customerDisplayConfig?.slideIntervalSeconds || 8}
                        onChange={e =>
                          updateCustomerDisplayConfig({ slideIntervalSeconds: Number.parseInt(e.target.value) || 8 })
                        }
                      />
                    </div>
                  </>
                )}
              </div>
            </Card>

            {settings.customerDisplayConfig?.enabled !== false && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/20">
                      <Image className="h-5 w-5 text-pink-700 dark:text-pink-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">Promotional Slides</h2>
                      <p className="text-sm text-muted-foreground">Manage the rotating content shown when idle</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4">
                    {settings.customerDisplayConfig?.promoSlides?.map((slide, idx) => (
                      <div
                        key={slide.id || idx}
                        className="grid grid-cols-[auto_1fr_auto] gap-4 p-4 border rounded-lg items-start"
                      >
                        <div
                          className={`h-10 w-10 mt-1 rounded flex items-center justify-center text-white text-xs ${
                            slide.background.startsWith('bg-') ? slide.background : 'bg-gray-500'
                          }`}
                        >
                          {slide.type === 'qr' ? (
                            <ScanBarcode className="h-5 w-5" />
                          ) : (
                            <Type className="h-5 w-5" />
                          )}
                        </div>
                        <div className="grid gap-2">
                          <Input
                            value={slide.title}
                            onChange={e => {
                              const newSlides = [...(settings.customerDisplayConfig?.promoSlides || [])];
                              newSlides[idx] = { ...newSlides[idx], title: e.target.value };
                              updateCustomerDisplayConfig({ promoSlides: newSlides });
                            }}
                            placeholder="Title"
                            className="h-8 font-semibold"
                          />
                          <Input
                            value={slide.subtitle}
                            onChange={e => {
                              const newSlides = [...(settings.customerDisplayConfig?.promoSlides || [])];
                              newSlides[idx] = { ...newSlides[idx], subtitle: e.target.value };
                              updateCustomerDisplayConfig({ promoSlides: newSlides });
                            }}
                            placeholder="Subtitle"
                            className="h-8 text-sm"
                          />
                          <div className="flex gap-2">
                            <Select
                              value={slide.type}
                              onValueChange={(val: any) => {
                                const newSlides = [...(settings.customerDisplayConfig?.promoSlides || [])];
                                newSlides[idx] = { ...newSlides[idx], type: val };
                                updateCustomerDisplayConfig({ promoSlides: newSlides });
                              }}
                            >
                              <SelectTrigger className="h-8 w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="icon">Icon</SelectItem>
                                <SelectItem value="qr">QR Code</SelectItem>
                              </SelectContent>
                            </Select>

                            {slide.type === 'qr' && (
                              <Input
                                value={slide.payload || ''}
                                onChange={e => {
                                  const newSlides = [...(settings.customerDisplayConfig?.promoSlides || [])];
                                  newSlides[idx] = { ...newSlides[idx], payload: e.target.value };
                                  updateCustomerDisplayConfig({ promoSlides: newSlides });
                                }}
                                placeholder="https://..."
                                className="h-8 flex-1"
                              />
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newSlides = settings.customerDisplayConfig!.promoSlides.filter((_, i) => i !== idx);
                            updateCustomerDisplayConfig({ promoSlides: newSlides });
                          }}
                        >
                          <Trash className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      className="w-full border-dashed"
                      onClick={() => {
                        const newSlide: any = {
                          id: `slide_${Date.now()}`,
                          type: 'icon',
                          title: 'New Promotion',
                          subtitle: 'Edit this details',
                          iconName: 'Store',
                          background: 'bg-gradient-to-br from-indigo-600 to-purple-600',
                          textColor: 'text-white',
                          enabled: true,
                        };
                        const currentSlides = settings.customerDisplayConfig?.promoSlides || [];
                        updateCustomerDisplayConfig({ promoSlides: [...currentSlides, newSlide] });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add New Slide
                    </Button>
                  </div>
                </div>
              </Card>
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

          <TabsContent value="developer" className="space-y-6">
            <UpdateTestingPanel />
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
