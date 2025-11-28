import { useState, useRef, useEffect, ChangeEvent, KeyboardEvent } from 'react';
import {
  CreditCard,
  Lock,
  LogIn,
  Scan,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Terminal,
  ShieldCheck,
  Zap,
  Settings,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/pos-auth-store';
import { useNavigate } from 'react-router';
import { getVersion } from '@tauri-apps/api/app';

// --- Typewriter Effect Component ---
const TypewriterText = ({ texts }: { texts: string[] }) => {
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [loopNum, setLoopNum] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(150);

  useEffect(() => {
    const handleType = () => {
      const i = loopNum % texts.length;
      const fullText = texts[i];

      setCurrentText(
        isDeleting ? fullText.substring(0, currentText.length - 1) : fullText.substring(0, currentText.length + 1)
      );

      setTypingSpeed(isDeleting ? 30 : 150);

      if (!isDeleting && currentText === fullText) {
        setTimeout(() => setIsDeleting(true), 2000); // Pause at end
      } else if (isDeleting && currentText === '') {
        setIsDeleting(false);
        setLoopNum(loopNum + 1);
      }
    };

    const timer = setTimeout(handleType, typingSpeed);
    return () => clearTimeout(timer);
  }, [currentText, isDeleting, loopNum, typingSpeed, texts]);

  return <span className="font-mono text-blue-300 border-r-2 border-blue-400 pr-1 animate-pulse">{currentText}</span>;
};

export default function CheckinPage() {
  // --- Form Logic ---
  const [cardId, setCardId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);
  
  // --- Version State ---
  const [appVersion, setAppVersion] = useState<string>('');

  const { checkIn, isCheckingIn } = useAuth();
  const { currentLocation, setDeviceKey, setCurrentLocation } = useAuthStore();
  const navigate = useNavigate();

  const cardInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // --- Initial Setup & Version Fetch ---
  useEffect(() => {
    cardInputRef.current?.focus();

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

  const handleScan = (): void => {
    setIsScanning(true);
    setError('');
    setScanSuccess(false);

    // Simulate card reader scanning
    setTimeout(() => {
      const mockCardId = `CARD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      setCardId(mockCardId);
      setIsScanning(false);
      setScanSuccess(true);

      setTimeout(() => {
        passwordInputRef.current?.focus();
        setScanSuccess(false);
      }, 1000);
    }, 1500);
  };

  const handleCardIdChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setCardId(e.target.value);
    setError('');
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
    setError('');
  };

  const handleSubmit = async (): Promise<void> => {
    setError('');

    if (!cardId.trim()) {
      setError('Please enter or scan your card ID');
      cardInputRef.current?.focus();
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      passwordInputRef.current?.focus();
      return;
    }

    await checkIn({ cardId, password });
    setCardId('');
    setPassword('');
    setShowPassword(false);
    cardInputRef.current?.focus();
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && !isCheckingIn) {
      handleSubmit();
    }
  };

  // --- New Handler for Setup Navigation ---
  const handleResetConfig = () => {
    navigate('/setup');
    setDeviceKey('');
    // @ts-expect-error 
    setCurrentLocation(undefined);
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-950 text-white overflow-hidden">
      {/* --- LEFT SIDE: Visuals & Typewriter --- */}
      <div className="hidden lg:flex w-1/2 relative flex-col justify-between p-12 bg-slate-900 border-r border-slate-800">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0 opacity-40">
          <img
            src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop"
            alt="Tech Background"
            className="w-full h-full object-cover grayscale mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-linear-to-b from-slate-900 via-slate-900/50 to-blue-950/80"></div>
        </div>

        {/* Brand / Logo Area */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Terminal className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">Dealio</span>
        </div>

        {/* Typewriter Content */}
        <div className="relative z-10 max-w-md space-y-6">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            System Access <br />
            <TypewriterText texts={['Authorized Only.', 'Secure Login.', 'Shift Ready.', 'Data Encrypted.']} />
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            Welcome to the secure employee portal. Scan your badge or enter your credentials to begin your session.
          </p>

          <div className="flex gap-6 pt-4">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span>Secure Connection</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span>Fast Check-in</span>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="relative z-10 text-xs text-slate-500">© 2025 Dealio Corporation. All rights reserved.</div>
      </div>

      {/* --- RIGHT SIDE: Login Form --- */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative">
        {/* Mobile Background Elements (visible only on small screens) */}
        <div className="absolute inset-0 lg:hidden">
          <div className="absolute inset-0 bg-linear-to-br from-slate-950 via-blue-950 to-slate-950"></div>
        </div>

        <Card className="w-full max-w-md bg-transparent border-none shadow-none lg:bg-slate-900/50 lg:border lg:border-slate-800 lg:shadow-2xl relative z-20 backdrop-blur-sm">
          
          {/* --- NEW: Config/Reset Button --- */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleResetConfig}
            className="absolute right-4 top-4 text-slate-600 hover:text-blue-400 hover:bg-slate-800 transition-colors rounded-full"
            title="Reset API Configuration"
          >
            <Settings className="w-4 h-4" />
            <span className="sr-only">Settings</span>
          </Button>

          <CardHeader className="space-y-1 pb-8 text-center lg:text-left">
            <CardTitle className="text-3xl font-bold text-white">Check In</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your details below to access the terminal
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Scan Button */}
            <Button
              onClick={handleScan}
              disabled={isCheckingIn || isScanning}
              variant="outline"
              className={`w-full h-20 border-dashed transition-all duration-300 relative overflow-hidden group ${
                isScanning
                  ? 'border-blue-500 bg-blue-500/10'
                  : scanSuccess
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-blue-500/50'
              }`}
            >
              {/* Scan Animation Line */}
              {isScanning && (
                <div
                  className="absolute inset-0 bg-linear-to-b from-transparent via-blue-500/10 to-transparent animate-scan"
                  style={{ backgroundSize: '100% 200%' }}
                ></div>
              )}

              <div className="flex flex-row items-center gap-4 relative z-10">
                {isScanning ? (
                  <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                ) : scanSuccess ? (
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-green-400" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center border border-slate-700 group-hover:border-blue-500/50 group-hover:text-blue-400 transition-colors text-slate-400">
                    <Scan className="w-5 h-5" />
                  </div>
                )}

                <div className="flex flex-col items-start">
                  <span
                    className={`font-medium ${
                      scanSuccess ? 'text-green-400' : isScanning ? 'text-blue-400' : 'text-slate-200'
                    }`}
                  >
                    {isScanning ? 'Scanning...' : scanSuccess ? 'Card Verified' : 'Tap to Scan Badge'}
                  </span>
                  <span className="text-xs text-slate-500 hidden sm:inline-block">
                    {isScanning ? 'Please wait' : scanSuccess ? 'Redirecting...' : 'Or use manual entry below'}
                  </span>
                </div>
              </div>
            </Button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-950 lg:bg-slate-900 px-2 text-slate-500">Or continue with ID</span>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cardId" className="text-slate-300">
                  Card ID
                </Label>
                <div className="relative group">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <Input
                    ref={cardInputRef}
                    id="cardId"
                    value={cardId}
                    onChange={handleCardIdChange}
                    onKeyDown={handleKeyPress}
                    placeholder="Enter ID manually"
                    className="pl-10 bg-slate-950/50 border-slate-800 focus:border-blue-500 focus:ring-blue-500/20 h-11 transition-all"
                    disabled={isCheckingIn}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  Password
                </Label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                  <Input
                    ref={passwordInputRef}
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={handlePasswordChange}
                    onKeyDown={handleKeyPress}
                    placeholder="Enter password"
                    className="pl-10 pr-10 bg-slate-950/50 border-slate-800 focus:border-blue-500 focus:ring-blue-500/20 h-11 transition-all"
                    disabled={isCheckingIn}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <Alert variant="destructive" className="bg-red-950/20 border-red-900/50 text-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSubmit}
              disabled={isCheckingIn}
              className="w-full h-11 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium shadow-lg shadow-blue-900/20 transition-all duration-200"
            >
              {isCheckingIn ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  Check In <LogIn className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="justify-center pb-0">
            <p className="text-xs text-slate-600 text-center">
              Terminal ID: <span className="text-slate-400 font-mono">{currentLocation?.name || 'Unknown'}</span>
              {/* Displaying App Version Here */}
              <span className="mx-2">•</span>
              <span className="text-slate-500">v{appVersion}</span>
              <span className="mx-2">•</span>
              Status: <span className="text-green-500">Online</span>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}