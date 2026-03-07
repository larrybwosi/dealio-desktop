import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key,
  MapPin,
  Check,
  Store,
  Loader2,
  ShieldCheck,
  Info,
  ExternalLink,
  Laptop,
  Settings,
  ClipboardCheck,
  Warehouse,
  ChevronLeft,
} from 'lucide-react';

// shadcn components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';

// hooks
import { usePosLocations } from '@/hooks/locations';
import { useAuthStore } from '@/store/pos-auth-store';
import { useNavigate } from 'react-router';
import { getVersion } from '@tauri-apps/api/app';
import { API_ENDPOINT } from '@/lib/axios';
import { toast } from 'sonner';
import { invoke } from '@tauri-apps/api/core';

// --- Types ---
interface Location {
  id: string;
  name: string;
  address: string;
  type: string;
  isDefault?: boolean;
}

interface SetupData {
  apiKey: string;
  location: Location | null;
}

// --- Sub-Components ---

const ApiKeyInstructions = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="space-y-6 w-full max-w-md mx-auto">
      <div className="space-y-2">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onBack} 
          className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 -ml-2 h-8 px-2 rounded-none"
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h3 className="text-2xl font-semibold tracking-tight uppercase">API Key Help</h3>
        <p className="text-base text-zinc-500 dark:text-zinc-400">
          Your security key connects this terminal to your merchant dashboard.
        </p>
      </div>

      <div className="grid gap-4">
        {[
          { icon: Laptop, title: "1. Login to Dashboard", desc: "Sign in to your Merchant Portal." },
          { icon: Settings, title: "2. Go to Settings", desc: "Navigate to Settings > API Keys." },
          { icon: Key, title: "3. Generate Key", desc: "Create a new 'POS Terminal' key." },
          { icon: ClipboardCheck, title: "4. Copy & Paste", desc: "Copy the secret starting with pk_live." }
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-4 p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
            <item.icon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-sm text-zinc-900 dark:text-zinc-200 uppercase tracking-tighter">{item.title}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" className="w-full h-11 rounded-none border-zinc-300 dark:border-zinc-700" asChild>
        <a href={`${API_ENDPOINT}/settings/integrations?tab=api_keys`} target="_blank" rel="noreferrer">
          Open Dashboard <ExternalLink className="w-4 h-4 ml-2" />
        </a>
      </Button>
    </div>
  );
};

const ApiKeyStep = ({ onNext, onShowInstructions }: { onNext: (k: string) => void, onShowInstructions: () => void }) => {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.length < 10) {
      setError('Invalid API key format');
      return;
    }
    setError('');
    setIsValidating(true);
    try {
      await invoke('start_device_setup_command', {
        baseUrl: API_ENDPOINT,
        deviceKey: apiKey
      });
      setIsValidating(false);
      onNext(apiKey);
    } catch {
      setIsValidating(false);
      setError('Failed to initialize connection');
    }
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-8 w-full max-w-md mx-auto">
      <div className="space-y-4">
        <Label htmlFor="apiKey" className="text-base font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">License Key</Label>
        <div className="relative group">
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="pl-11 font-mono text-sm h-14 bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus-visible:ring-0 focus-visible:border-blue-600 rounded-none shadow-none transition-all"
            placeholder="pk_live_..."
            autoFocus
          />
          <Key className="absolute left-4 top-4.5 h-5 w-5 text-zinc-400 group-focus-within:text-blue-600 transition-colors" />
        </div>
        {error && <p className="text-sm text-red-500 font-medium flex items-center gap-2 rounded-none"><Info size={14}/> {error}</p>}
      </div>

      <div className="flex flex-col gap-4">
        <Button 
            type="submit" 
            size="lg"
            className="w-full h-12 rounded-none text-base bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-none uppercase font-bold tracking-wide"
            disabled={isValidating || !apiKey}
        >
            {isValidating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Verify & Continue"}
        </Button>
        
        <Button 
            type="button" 
            variant="ghost" 
            className="text-zinc-500 dark:text-zinc-400 text-sm hover:bg-transparent hover:text-blue-600 hover:underline rounded-none"
            onClick={onShowInstructions}
        >
            Where do I find my API key?
        </Button>
      </div>
    </form>
  );
};

const LocationStep = ({ onBack, onComplete, isSubmitting }: { onBack: () => void, onComplete: (l: Location) => void, isSubmitting: boolean }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { locations, isLoading } = usePosLocations();

  const handleComplete = () => {
    const loc = locations?.find(l => l.id === selectedId);
    if (loc) {
      // @ts-expect-error
      onComplete(loc);
    }
  };

  const getLocationIcon = (type: string) => {
    switch (type) {
      case 'RETAIL_SHOP': return Store;
      case 'WAREHOUSE': return Warehouse;
      default: return MapPin;
    }
  };

  return (
    <div className="space-y-6 w-full max-w-md mx-auto flex flex-col h-[70vh] md:h-auto">
      <div className="space-y-1">
        <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Select Store Target</h3>
      </div>
      
      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto -mr-3 pr-3 space-y-3 custom-scrollbar min-h-[200px]">
        {locations?.map((loc) => {
            const Icon = getLocationIcon(loc.locationType);
            const isSelected = selectedId === loc.id;
            
            return (
                <div
                    key={loc.id}
                    onClick={() => setSelectedId(loc.id)}
                    className={`
                        group relative flex items-center gap-4 p-4 border cursor-pointer transition-all duration-100
                        ${isSelected 
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/10' 
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-zinc-400'
                        }
                    `}
                >
                    <div className={`p-3 transition-colors rounded-none ${isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 group-hover:text-zinc-700'}`}>
                        <Icon size={20} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 truncate uppercase tracking-tight">{loc.name}</h4>
                            {loc.isDefault && <Badge variant="secondary" className="rounded-none text-[10px] h-5 px-1.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">Default</Badge>}
                        </div>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate capitalize font-mono">{loc.locationType.toLowerCase().replace('_', ' ')}</p>
                    </div>

                    <div className={`w-6 h-6 border flex items-center justify-center transition-all ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-700 opacity-20 group-hover:opacity-100'}`}>
                        {isSelected && <Check size={14} strokeWidth={4} />}
                    </div>
                </div>
            )
        })}
      </div>

      <div className="flex gap-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-auto">
        <Button variant="outline" onClick={onBack} size="lg" className="flex-1 rounded-none h-12 uppercase font-bold tracking-wide" disabled={isSubmitting}>Back</Button>
        <Button 
            size="lg"
            className="flex-[2] rounded-none h-12 bg-blue-600 hover:bg-blue-700 text-white shadow-none uppercase font-bold tracking-wide"
            disabled={!selectedId || isLoading || isSubmitting}
            onClick={handleComplete}
        >
            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : "Confirm & Initialize"}
        </Button>
      </div>
    </div>
  );
};

const SuccessStep = ({ location }: { location: Location | null }) => {
    const [progress, setProgress] = useState(10);
    const navigate = useNavigate();
    
    useEffect(() => {
        const timer = setTimeout(() => setProgress(100), 800);
        const redirectTimer = setTimeout(() => {
            navigate('/'); 
        }, 2000); 
        
        return () => {
            clearTimeout(timer);
            clearTimeout(redirectTimer);
        };
    }, [navigate]);

    return (
        <div className="text-center w-full max-w-sm mx-auto">
            <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-24 h-24 bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-8 text-green-600 dark:text-green-500 ring-1 ring-green-600/20 rounded-none"
            >
                <Check className="w-12 h-12" strokeWidth={2} />
            </motion.div>
            
            <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3 uppercase tracking-tight">System Ready</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-10 text-lg">
                Terminal registered to <br/>
                <span className="font-semibold text-zinc-900 dark:text-zinc-200">{location?.name}</span>
            </p>

            <div className="space-y-3">
                <div className="flex justify-between text-xs text-zinc-400 uppercase font-bold tracking-wider">
                    <span>Booting Engine</span>
                    <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2 rounded-none bg-zinc-100 dark:bg-zinc-800" />
            </div>
        </div>
    )
}

// --- Main Page Component ---

export default function SetupPage() {
  const [step, setStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupData>({ apiKey: '', location: null });
  const [viewMode, setViewMode] = useState<'form' | 'instructions'>('form');
  const [appVersion, setAppVersion] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState(false);
  const { registerDevice } = useAuthStore();

  const handleApiKeyNext = (key: string) => {
    setSetupData(prev => ({ ...prev, apiKey: key }));
    setStep(2);
  };

  const handleLocationComplete = async (location: Location) => {
    setSetupData(prev => ({ ...prev, location }));
    setIsRegistering(true);
    try {
        // @ts-expect-error
        await registerDevice(setupData.apiKey, location);
        setIsRegistering(false);
        setStep(3);
    } catch (error) {
        setIsRegistering(false);
        console.error(error);
        toast.error("Failed to register device", { description: "Please check your network and try again." });
    }
  };

  
  useEffect(() => {
    // Async function to fetch version
    const fetchAppVersion = async () => {
      try {
        const v = await getVersion();
        setAppVersion(v);
      } catch (err) {
        console.error('Failed to get app version:', err);
        setAppVersion('Unknown');
      }
    };

    fetchAppVersion();
  }, []);

  return (
    <div className="h-screen w-screen flex bg-white dark:bg-zinc-950 overflow-hidden font-sans select-none">
      <div 
        data-tauri-drag-region 
        className="absolute top-0 left-0 w-full h-10 z-50 bg-transparent" 
      />

      {/* LEFT PANEL - Branding / Marketing */}
      <div className="hidden lg:flex w-[45%] bg-zinc-950 text-white relative flex-col justify-between p-12 overflow-hidden border-r border-zinc-800">
        
        {/* Abstract Background Art */}
        <div className="absolute inset-0 z-0">
             <div className="absolute -top-[20%] -left-[20%] w-[80%] h-[80%] bg-blue-900/10 rounded-full blur-[120px]" />
             <div className="absolute top-[40%] -right-[20%] w-[80%] h-[80%] bg-zinc-800/10 rounded-full blur-[120px]" />
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
        </div>

        {/* Content */}
        <div className="relative z-10">
            <div className="flex items-center gap-3 mb-10">
                <div className="w-10 h-10 bg-blue-600 flex items-center justify-center rounded-none shadow-none">
                    <Store className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight uppercase">Dealio POS</span>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-5xl font-black leading-none mb-6 text-white tracking-tighter uppercase">
                  Ready for <br/> Business.
              </h1>
              <p className="text-zinc-400 text-lg leading-relaxed max-w-sm font-light">
                  Initialize your terminal to start processing sales, tracking inventory, and managing customers in real-time.
              </p>
            </motion.div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center gap-4 text-sm text-zinc-500 font-mono">
            <div className="flex items-center gap-2 px-3 py-1.5 border border-zinc-800 backdrop-blur-sm rounded-none">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                <span>SECURE CONNECTION</span>
            </div>
            <span className="text-zinc-600">v{appVersion}</span>
        </div>
      </div>

      {/* RIGHT PANEL - Interaction / Form */}
      {/* Added overflow-y-auto so the form scrolls on small laptop screens if needed */}
      <div className="flex-1 flex flex-col items-center justify-center relative bg-white dark:bg-zinc-950 overflow-y-auto">
        <div className="w-full max-w-xl p-8 md:p-12 lg:p-16">
            
            <AnimatePresence mode="wait">
                {viewMode === 'instructions' ? (
                    <motion.div
                        key="instructions"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <ApiKeyInstructions onBack={() => setViewMode('form')} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                         {/* Form Header */}
                        <div className="mb-10 text-center lg:text-left">
                            {step < 3 && (
                                <div className="inline-flex items-center gap-2 px-3 py-1 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-6 uppercase tracking-wider rounded-none">
                                    <span>Step {step} of 2</span>
                                </div>
                            )}
                            <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-zinc-900 dark:text-zinc-50 mb-3 uppercase">
                                {step === 1 ? 'Connect Account' : step === 2 ? 'Select Location' : 'Setup Complete'}
                            </h2>
                            <p className="text-lg text-zinc-500 dark:text-zinc-400 font-light">
                                {step === 1 && "Enter your license key to initialize device."}
                                {step === 2 && "Which store is this device operating in?"}
                            </p>
                        </div>

                        {/* Steps */}
                        <div className="min-h-[300px]">
                          {step === 1 && (
                              <ApiKeyStep 
                                  onNext={handleApiKeyNext} 
                                  onShowInstructions={() => setViewMode('instructions')} 
                              />
                          )}
                          {step === 2 && (
                              <LocationStep 
                                  onBack={() => setStep(1)} 
                                  onComplete={handleLocationComplete}
                                  isSubmitting={isRegistering}
                              />
                          )}
                          {step === 3 && (
                              <SuccessStep location={setupData.location} />
                          )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            
        </div>
      </div>
    </div>
  );
}