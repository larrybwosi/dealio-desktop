import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Key,
  MapPin,
  Check,
  Store,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Info,
  ExternalLink,
  Laptop,
  Settings,
  ClipboardCheck,
  WarehouseIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePosLocations } from '@/hooks/locations';
import { usePosAuthStore } from '@/store/pos-auth-store';

// --- Types ---
interface Location {
  id: string;
  name: string;
  address: string;
  type: string;
  icon: React.ComponentType<any>;
}

interface SetupData {
  apiKey: string;
  location: Location | null;
}

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

interface InstructionItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}

interface ApiKeyStepProps {
  onNext: (apiKey: string) => void;
  onShowInstructions: () => void;
}

interface LocationStepProps {
  onBack: () => void;
  onComplete: (location: Location) => void;
}

interface SuccessStepProps {
  location: Location | null;
}

interface ApiKeyInstructionsProps {
  onBack: () => void;
}

// --- Components ---

const StepIndicator = ({ currentStep, totalSteps }: StepIndicatorProps) => {
  return (
    <div className="flex items-center justify-center space-x-2 mb-8">
      {[...Array(totalSteps)].map((_, index) => (
        <div key={index} className="flex items-center">
          <motion.div
            initial={false}
            animate={{
              backgroundColor: index + 1 <= currentStep ? '#3b82f6' : '#27272a',
              borderColor: index + 1 <= currentStep ? '#3b82f6' : '#3f3f46',
              scale: index + 1 === currentStep ? 1.1 : 1,
            }}
            className="w-3 h-3 rounded-full border-2 transition-colors duration-300"
          />
          {index < totalSteps - 1 && (
            <div className={`w-8 h-0.5 mx-1 ${index + 1 < currentStep ? 'bg-blue-500' : 'bg-zinc-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
};

const ApiKeyInstructions = ({ onBack }: ApiKeyInstructionsProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-md text-zinc-200"
    >
      <div className="text-center mb-8">
        <div className="bg-blue-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-400 ring-1 ring-blue-500/20">
          <Info size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">How to Find Your API Key</h2>
        <p className="text-zinc-400">Follow these steps to generate and copy your API key.</p>
      </div>

      <div className="space-y-4 mb-8">
        <InstructionItem
          icon={<Laptop size={20} />}
          title="1. Login to Your Dashboard"
          description="Go to the Dealio Merchant Dashboard and sign in with your credentials."
          action={
            <Button variant="link" className="text-blue-400 hover:text-blue-300 p-0 h-auto">
              Go to Dashboard <ExternalLink size={14} className="ml-1" />
            </Button>
          }
        />
        <InstructionItem
          icon={<Settings size={20} />}
          title="2. Navigate to API Keys"
          description="In the dashboard, find 'Settings' or 'Developer' and select 'API Keys'."
        />
        <InstructionItem
          icon={<Key size={20} />}
          title="3. Generate & Copy Key"
          description="Create a new key (e.g., 'POS Terminal Key') with necessary permissions and copy the generated secret key."
        />
        <InstructionItem
          icon={<ClipboardCheck size={20} />}
          title="4. Paste Here"
          description="Return to this setup page and paste your API key into the field."
        />
      </div>

      <Button
        onClick={onBack}
        variant="secondary"
        className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl font-medium transition-colors"
      >
        Go Back to API Key Entry
      </Button>
    </motion.div>
  );
};

const InstructionItem = ({ icon, title, description, action }: InstructionItemProps) => (
  <Card className="bg-zinc-900/50 border-zinc-800">
    <CardContent className="p-4">
      <div className="flex items-start space-x-4">
        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">{icon}</div>
        <div className="flex-1">
          <h3 className="font-medium text-white mb-1">{title}</h3>
          <p className="text-sm text-zinc-400">{description}</p>
          {action && <div className="mt-2 text-sm">{action}</div>}
        </div>
      </div>
    </CardContent>
  </Card>
);

const ApiKeyStep = ({ onNext, onShowInstructions }: ApiKeyStepProps) => {
  const [apiKey, setApiKey] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState('');
  const { setDeviceKey } = usePosAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.length < 10) {
      setError('API Key must be at least 10 characters');
      return;
    }

    setError('');
    setIsValidating(true);

    setDeviceKey(apiKey);
    setIsValidating(false);
    onNext(apiKey);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <div className="bg-blue-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-400 ring-1 ring-blue-500/20">
          <Key size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Connect Your Account</h2>
        <p className="text-zinc-400">Enter your license key to initialize the POS terminal.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative group">
          <Input
            type="text"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className="w-full bg-zinc-900/50 border-zinc-700 text-white px-4 py-4 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-zinc-600 font-mono tracking-wider"
            placeholder="pk_live_..."
            autoFocus
          />
          <div className="absolute right-4 top-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors">
            <ShieldCheck size={20} />
          </div>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-red-400 text-sm flex items-center justify-center"
          >
            {error}
          </motion.p>
        )}

        <Button
          type="submit"
          disabled={isValidating || !apiKey}
          className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-4 rounded-xl font-semibold shadow-lg shadow-blue-900/20 flex items-center justify-center space-x-2 transition-all"
        >
          {isValidating ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <span>Continue Setup</span>
              <ArrowRight size={20} />
            </>
          )}
        </Button>
      </form>

      <div className="mt-8 text-center">
        <Button
          variant="link"
          onClick={onShowInstructions}
          className="text-xs text-zinc-500 hover:text-zinc-400 p-0 h-auto"
        >
          Where do I find my API key?
        </Button>
      </div>
    </motion.div>
  );
};

const LocationStep = ({ onBack, onComplete }: LocationStepProps) => {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const { locations, isLoading } = usePosLocations();
  const { setCurrentLocation } = usePosAuthStore();

  const handleComplete = async () => {
    if (!selectedLocation) return;
    setCurrentLocation(selectedLocation);
    onComplete(selectedLocation);
  };

  // Get appropriate icon based on location type
  const getLocationIcon = (locationType: string) => {
    switch (locationType) {
      case 'RETAIL_SHOP':
        return Store; // Assuming you have a Store icon
      case 'WAREHOUSE':
        return WarehouseIcon; // Assuming you have a Warehouse icon
      default:
        return MapPin;
    }
  };

  // Format location type for display
  const formatLocationType = (locationType: string) => {
    return locationType.toLowerCase().replace('_', ' ');
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full max-w-md"
    >
      <div className="text-center mb-8">
        <div className="bg-emerald-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400 ring-1 ring-emerald-500/20">
          <MapPin size={32} />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Select Location</h2>
        <p className="text-zinc-400">Which store is this device located in?</p>
      </div>

      <div className="space-y-3 mb-8 max-h-[400px] overflow-y-auto pr-2">
        {locations.map(loc => {
          const Icon = getLocationIcon(loc.locationType);
          const isSelected = selectedLocation?.id === loc.id;
          const displayAddress = loc.address || 'No address provided';

          return (
            <motion.div key={loc.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Card
                className={`cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'bg-emerald-900/20 border-emerald-500/50 ring-1 ring-emerald-500/50'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'
                }`}
                onClick={() => setSelectedLocation(loc)}
              >
                <CardContent className="p-4 flex items-center space-x-4">
                  <div
                    className={`p-3 rounded-lg ${
                      isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    <Icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-medium ${isSelected ? 'text-white' : 'text-zinc-200'}`}>{loc.name}</h3>
                      {loc.isDefault && (
                        <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-400">
                          Default
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {formatLocationType(loc.locationType)}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-500">{displayAddress}</p>
                  </div>
                  {isSelected && (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-400">
                      <Check size={20} />
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="flex space-x-3">
        <Button onClick={onBack} variant="outline" className="flex-1 text-zinc-400 hover:bg-zinc-900">
          Back
        </Button>
        <Button
          onClick={handleComplete}
          disabled={!selectedLocation || isLoading}
          className="flex-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/20 flex items-center justify-center space-x-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" size={20} />
              <span>Syncing Catalog...</span>
            </>
          ) : (
            <>
              <span>Finish Setup</span>
              <Check size={20} />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
};

const SuccessStep = ({ location }: SuccessStepProps) => {
  const [progress, setProgress] = useState(0);

  React.useEffect(() => {
    const timer = setTimeout(() => setProgress(100), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center w-full max-w-md"
    >
      <div className="relative w-24 h-24 mx-auto mb-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className="absolute inset-0 bg-linear-to-tr from-blue-500 to-emerald-500 rounded-full opacity-20 blur-xl"
        />
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="relative w-full h-full bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center"
        >
          <motion.div
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
          >
            <Check className="w-10 h-10 text-emerald-400" strokeWidth={3} />
          </motion.div>
        </motion.div>
      </div>

      <h2 className="text-3xl font-bold text-white mb-4">All Set!</h2>
      <p className="text-zinc-400 mb-8">
        Terminal successfully registered to <span className="text-white font-medium">{location?.name}</span>. Starting
        POS engine...
      </p>

      <Progress value={progress} className="w-full bg-zinc-900" />
    </motion.div>
  );
};

export default function SetupPage() {
  const [step, setStep] = useState(1);
  const [setupData, setSetupData] = useState<SetupData>({
    apiKey: '',
    location: null,
  });
  const [showInstructions, setShowInstructions] = useState(false);

  const handleApiKeyNext = (key: string) => {
    setSetupData(prev => ({ ...prev, apiKey: key }));
    setStep(2);
  };

  const handleLocationComplete = (location: Location) => {
    setSetupData(prev => ({ ...prev, location }));
    setStep(3);
  };

  const handleShowInstructions = () => {
    setShowInstructions(true);
  };

  const handleBackToApiKey = () => {
    setShowInstructions(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col lg:flex-row items-center justify-center font-sans selection:bg-blue-500/30 text-zinc-100 relative overflow-hidden">
      {/* Ambient Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-1/2 -left-1/2 w-full h-full bg-blue-500/5 blur-[120px] rounded-full mix-blend-screen animate-pulse"
          style={{ animationDuration: '4s' }}
        />
        <div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-emerald-500/5 blur-[120px] rounded-full mix-blend-screen animate-pulse"
          style={{ animationDuration: '7s' }}
        />
      </div>

      {/* Image Section - Takes half screen on larger devices */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="hidden lg:flex flex-1 items-center justify-center p-8 relative min-h-screen bg-linear-to-br from-zinc-900/50 to-zinc-950/50 border-r border-zinc-800/50 overflow-hidden"
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2670&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')",
          }}
        />
        <div className="absolute inset-0 bg-linear-to-t from-zinc-950/90 via-transparent to-zinc-950/90" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="relative z-10 text-center max-w-lg"
        >
          <h1 className="text-5xl font-extrabold text-white leading-tight mb-6 tracking-tight">
            Seamlessly Power Your Business.
          </h1>
          <p className="text-zinc-300 text-lg mb-8">
            Connect your store, manage inventory, and delight customers with Dealio's intuitive interface.
          </p>
          <div className="flex justify-center space-x-4">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-blue-900/30">
              Learn More
            </Button>
            <Button variant="outline" className="border-zinc-600 text-zinc-300 hover:border-zinc-500 hover:text-white">
              Get Support
            </Button>
          </div>
        </motion.div>
      </motion.div>

      {/* Form Section - Also takes half screen on larger devices */}
      <div className="w-full lg:flex-1 flex flex-col items-center justify-center p-4 py-12 z-10">
        <div className="w-full max-w-2xl">
          {/* Header Logo Area */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex flex-col items-center mb-12"
          >
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-8 h-8 bg-linear-to-br from-blue-600 to-emerald-600 rounded-lg flex items-center justify-center">
                <Store className="text-white w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">Dealio</span>
            </div>
            <div className="h-px w-full max-w-[200px] bg-linear-to-r from-transparent via-zinc-800 to-transparent mt-4" />
          </motion.div>

          {/* Main Card */}
          <div className="relative">
            {/* Card Glow */}
            <div className="absolute -inset-0.5 bg-linear-to-r from-blue-500/30 to-emerald-500/30 rounded-2xl blur opacity-30" />

            <Card className="relative bg-zinc-950 border-zinc-800/50 rounded-2xl p-8 md:p-12 shadow-2xl flex flex-col items-center min-h-[500px] justify-center backdrop-blur-xl">
              <CardContent className="p-0 w-full">
                {step < 3 && !showInstructions && <StepIndicator currentStep={step} totalSteps={2} />}

                <AnimatePresence mode="wait">
                  {showInstructions ? (
                    <ApiKeyInstructions key="instructions" onBack={handleBackToApiKey} />
                  ) : (
                    <>
                      {step === 1 && (
                        <ApiKeyStep key="step1" onNext={handleApiKeyNext} onShowInstructions={handleShowInstructions} />
                      )}
                      {step === 2 && (
                        <LocationStep key="step2" onBack={() => setStep(1)} onComplete={handleLocationComplete} />
                      )}
                      {step === 3 && <SuccessStep key="step3" location={setupData.location} />}
                    </>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>

          {/* Footer Info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="text-center text-zinc-600 text-xs mt-8"
          >
            v2.4.0-stable • Secured by 256-bit encryption •{' '}
            <Button variant="link" className="text-zinc-500 hover:text-zinc-400 p-0 h-auto text-xs">
              Help Center
            </Button>
          </motion.p>
        </div>
      </div>
    </div>
  );
}
