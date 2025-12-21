import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  isTestMode, 
  setTestMode, 
  getCurrentTestScenario, 
  setTestScenario,
  TEST_SCENARIOS 
} from '@/lib/updater/mock-update';
import { RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

export function UpdateTestingPanel() {
  const [testModeEnabled, setTestModeEnabled] = useState(isTestMode());
  const [currentScenario, setCurrentScenario] = useState(getCurrentTestScenario());

  const handleTestModeToggle = (enabled: boolean) => {
    setTestMode(enabled);
    setTestModeEnabled(enabled);
    // Reload to apply changes
    window.location.reload();
  };

  const handleScenarioChange = (scenario: keyof typeof TEST_SCENARIOS) => {
    setTestScenario(scenario);
    setCurrentScenario(scenario);
  };

  const triggerManualCheck = () => {
    // Force a manual update check by reloading
    window.location.reload();
  };

  const scenarioDescriptions: Record<keyof typeof TEST_SCENARIOS, { 
    label: string; 
    description: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }> = {
    NO_UPDATE: {
      label: 'No Update Available',
      description: 'Simulates when there are no updates available',
      type: 'info',
    },
    NORMAL_UPDATE: {
      label: 'Normal Update',
      description: 'Regular update with release notes, ~5 second download',
      type: 'success',
    },
    CRITICAL_UPDATE: {
      label: 'Critical Update',
      description: 'Mandatory security update that cannot be skipped',
      type: 'error',
    },
    OLD_UPDATE: {
      label: 'Outdated Version',
      description: 'Update from 20 days ago - triggers deprecation warning',
      type: 'warning',
    },
    DOWNLOAD_ERROR: {
      label: 'Download Error',
      description: 'Simulates a failed download',
      type: 'error',
    },
    SLOW_DOWNLOAD: {
      label: 'Slow Download',
      description: 'Simulates a slow 15-second download process',
      type: 'info',
    },
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Update Testing
            </CardTitle>
            <CardDescription className="mt-2">
              Test update flows without building production releases
            </CardDescription>
          </div>
          {testModeEnabled && (
            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              🧪 Test Mode Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Test Mode */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="test-mode" className="text-base font-medium">
              Enable Test Mode
            </Label>
            <p className="text-sm text-muted-foreground">
              Use mock updates instead of real update checks
            </p>
          </div>
          <Switch
            id="test-mode"
            checked={testModeEnabled}
            onCheckedChange={handleTestModeToggle}
          />
        </div>

        {/* Scenario Selection */}
        {testModeEnabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="scenario">Test Scenario</Label>
              <Select
                value={currentScenario}
                onValueChange={handleScenarioChange}
              >
                <SelectTrigger id="scenario">
                  <SelectValue placeholder="Select a test scenario" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TEST_SCENARIOS) as Array<keyof typeof TEST_SCENARIOS>).map((key) => (
                    <SelectItem key={key} value={key}>
                      {scenarioDescriptions[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Current Scenario Info */}
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex items-start gap-3">
                {scenarioDescriptions[currentScenario].type === 'success' && (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                )}
                {scenarioDescriptions[currentScenario].type === 'warning' && (
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                )}
                {scenarioDescriptions[currentScenario].type === 'error' && (
                  <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                )}
                {scenarioDescriptions[currentScenario].type === 'info' && (
                  <RefreshCw className="h-5 w-5 text-blue-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className="font-medium">
                    {scenarioDescriptions[currentScenario].label}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {scenarioDescriptions[currentScenario].description}
                  </p>
                </div>
              </div>
            </div>

            {/* Trigger Update Check */}
            <Button 
              onClick={triggerManualCheck} 
              className="w-full"
              variant="outline"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Trigger Update Check
            </Button>

            {/* Instructions */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <h4 className="text-sm font-semibold">How to Test:</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                <li>Enable test mode above</li>
                <li>Select a test scenario</li>
                <li>Click "Trigger Update Check" or wait for auto-check</li>
                <li>Observe the update dialog and download progress</li>
                <li>Test the install flow (it will show an alert instead of restarting)</li>
              </ol>
            </div>
          </div>
        )}

        {/* Warning when test mode is disabled */}
        {!testModeEnabled && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-950 p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Test mode is disabled. The app will check for real updates from GitHub releases.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
