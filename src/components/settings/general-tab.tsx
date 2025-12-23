import { 
  Building2, 
  Wallet, 
  Percent, 
  Settings2, 
  CheckCircle2, 
  XCircle, 
  Store,
  CreditCard,
  Power
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TabsContent } from "@/components/ui/tabs";
import { BusinessType, BusinessConfig } from '@/lib/business-configs';

export default function GeneralSettings({
  businessName,
  setBusinessName,
  businessType,
  handleBusinessTypeChange,
  businessConfigs,
  currentConfig,
  currency,
  setCurrency,
  taxRate,
  setTaxRate,
  allowSaveUnpaidOrders,
  setAllowSaveUnpaidOrders,
  enableAutoStart,
  setEnableAutoStart
}: {
  businessName: string;
  setBusinessName: (name: string) => void;
  businessType: BusinessType;
  handleBusinessTypeChange: (type: BusinessType) => void;
  businessConfigs: Record<BusinessType, BusinessConfig>;
  currentConfig: BusinessConfig;
  currency: string;
  setCurrency: (currency: string) => void;
  taxRate: string;
  setTaxRate: (rate: string) => void;
  allowSaveUnpaidOrders: boolean;
  setAllowSaveUnpaidOrders: (allow: boolean) => void;
  enableAutoStart: boolean;
  setEnableAutoStart: (enable: boolean) => void;
}) {
  return (
    <TabsContent value="general" className="space-y-6">
      <div className="grid gap-6 md:grid-cols-12">
        
        {/* LEFT COLUMN: Input & Configuration */}
        <div className="md:col-span-7 lg:col-span-8 space-y-6">
          
          {/* Business Identity Card */}
          <Card className="border-muted/60 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Business Identity</CardTitle>
                  <CardDescription>Manage your primary business details and classification.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator className="mb-6" />
            <CardContent className="grid gap-6">
              
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="businessName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Business Name
                  </Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="businessName"
                      value={businessName}
                      onChange={e => setBusinessName(e.target.value)}
                      placeholder="e.g. Acme Corp"
                      className="pl-9 bg-muted/30 focus:bg-background transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label htmlFor="businessType" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Business Model
                  </Label>
                  <Select value={businessType} onValueChange={handleBusinessTypeChange}>
                    <SelectTrigger id="businessType" className="bg-muted/30 focus:bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(businessConfigs).map(config => (
                        <SelectItem key={config.type} value={config.type}>
                          <span className="font-medium">{config.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {currentConfig.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financial Settings Card */}
          <Card className="border-muted/60 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Wallet className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">Financial Settings</CardTitle>
                  <CardDescription>Configure currency and tax regulations.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator className="mb-6" />
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <Label htmlFor="currency" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Operating Currency
                  </Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency" className="bg-muted/30 focus:bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD"><span className="font-mono text-muted-foreground mr-2">USD</span> US Dollar</SelectItem>
                      <SelectItem value="EUR"><span className="font-mono text-muted-foreground mr-2">EUR</span> Euro</SelectItem>
                      <SelectItem value="GBP"><span className="font-mono text-muted-foreground mr-2">GBP</span> British Pound</SelectItem>
                      <SelectItem value="JPY"><span className="font-mono text-muted-foreground mr-2">JPY</span> Japanese Yen</SelectItem>
                      <SelectItem value="IDR"><span className="font-mono text-muted-foreground mr-2">IDR</span> Indonesian Rupiah</SelectItem>
                      <SelectItem value="KSH"><span className="font-mono text-muted-foreground mr-2">KSH</span> Kenyan Shilling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <Label htmlFor="taxRate" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {currentConfig.taxSettings.taxLabel}
                    </Label>
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Inclusive</span>
                  </div>
                  <div className="relative">
                    <Percent className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="taxRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={taxRate}
                      onChange={e => setTaxRate(e.target.value)}
                      className="pl-9 bg-muted/30 focus:bg-background"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Preferences */}
          <Card className="border-muted/60 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-slate-500/10 rounded-lg">
                  <Settings2 className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-semibold">System Preferences</CardTitle>
                  <CardDescription>Application behavior and workflow controls.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator className="mb-0" />
            <CardContent className="divide-y divide-muted">
              
              <div className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Defer Payment</Label>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-[300px]">
                    Allow staff to save orders to the system without collecting immediate payment.
                  </p>
                </div>
                <Switch checked={allowSaveUnpaidOrders} onCheckedChange={setAllowSaveUnpaidOrders} />
              </div>

              <div className="flex items-center justify-between py-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Power className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm font-medium">Auto-Start</Label>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-[300px]">
                    Launch application automatically on system boot.
                  </p>
                </div>
                <Switch checked={enableAutoStart} onCheckedChange={setEnableAutoStart} />
              </div>

            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Summary & Status */}
        <div className="md:col-span-5 lg:col-span-4 space-y-6">
          
          <Card className="bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-800 h-full">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-700 dark:text-slate-300">
                Configuration Summary
              </CardTitle>
              <CardDescription>
                Active features for {currentConfig.label}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Features List */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Module Availability
                </h4>
                {Object.entries(currentConfig.features).map(([key, enabled]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      {key.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase())}
                    </span>
                    {enabled ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-slate-300" />
                    )}
                  </div>
                ))}
              </div>

              <Separator />

              {/* Order Types */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Supported Order Types
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentConfig.orderTypes.map(orderType => (
                    <Badge 
                      key={orderType} 
                      variant="secondary" 
                      className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-normal"
                    >
                      {orderType.charAt(0).toUpperCase() + orderType.slice(1)}
                    </Badge>
                  ))}
                </div>
              </div>

            </CardContent>
          </Card>
        </div>

      </div>
    </TabsContent>
  );
}