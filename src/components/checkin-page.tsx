import { useState, useRef, useEffect, ChangeEvent, KeyboardEvent } from "react";
import {
  CreditCard,
  Lock,
  LogIn,
  Scan,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePosAuth } from "@/hooks/use-auth";

export default function CheckinPage() {
  const [cardId, setCardId] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [scanSuccess, setScanSuccess] = useState<boolean>(false);

  const { checkIn, isCheckingIn, checkInError } = usePosAuth();

  const cardInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    cardInputRef.current?.focus();
  }, []);

  const handleScan = (): void => {
    setIsScanning(true);
    setError("");
    setScanSuccess(false);

    // Simulate card reader scanning
    setTimeout(() => {
      const mockCardId = `CARD-${Math.random()
        .toString(36)
        .substr(2, 9)
        .toUpperCase()}`;
      setCardId(mockCardId);
      setIsScanning(false);
      setScanSuccess(true);

      // Auto-focus password field after successful scan
      setTimeout(() => {
        passwordInputRef.current?.focus();
        setScanSuccess(false);
      }, 1000);
    }, 1500);
  };

  const handleCardIdChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setCardId(e.target.value);
    setError("");
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>): void => {
    setPassword(e.target.value);
    setError("");
  };

  const handleSubmit = async (): Promise<void> => {
    setError("");

    if (!cardId.trim()) {
      setError("Please enter or scan your card ID");
      cardInputRef.current?.focus();
      return;
    }

    if (!password.trim()) {
      setError("Please enter your password");
      passwordInputRef.current?.focus();
      return;
    }

    setIsLoading(true);

   const res = await checkIn({ cardId, locationId: "1", password });
   console.log(res)

      setIsLoading(false);
    // Simulate API call
    // setTimeout(() => {
    //   setIsLoading(false);
    //   // Success feedback - in real app, you'd handle success state
    //   console.log("Check-in successful:", { cardId, password });

    //   // Reset form on success
    //   setCardId("");
    //   setPassword("");
    //   setShowPassword(false);
    //   cardInputRef.current?.focus();
    // }, 1500);
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && !isLoading) {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-purple-500/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      {/* Grid Pattern Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[64px_64px]"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8 space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-linear-to-br from-blue-600 to-purple-600 rounded-3xl shadow-2xl shadow-blue-500/50 mb-2 transform hover:scale-110 transition-all duration-300">
            <CreditCard className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-5xl font-bold bg-linear-to-r from-white to-blue-200 bg-clip-text text-transparent mb-2">
              Welcome Back
            </h1>
            <p className="text-slate-400 text-lg">
              Sign in to your POS terminal
            </p>
          </div>
        </div>

        {/* Main Card */}
        <Card className="bg-slate-900/50 backdrop-blur-xl border-slate-800 shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-2xl text-white">
              Employee Check-In
            </CardTitle>
            <CardDescription className="text-slate-400">
              Scan your card or enter credentials to continue
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Scan Button - Prominent */}
            <Button
              onClick={handleScan}
              disabled={isLoading || isScanning}
              variant="outline"
              className={`w-full h-24 border-2 border-dashed transition-all duration-300 ${
                isScanning
                  ? "border-blue-500 bg-blue-500/10 animate-pulse"
                  : scanSuccess
                  ? "border-green-500 bg-green-500/10"
                  : "border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-blue-500/50"
              }`}
            >
              <div className="flex flex-col items-center gap-3">
                {isScanning ? (
                  <>
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                    <span className="text-blue-400 font-medium">
                      Scanning card...
                    </span>
                  </>
                ) : scanSuccess ? (
                  <>
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <span className="text-green-400 font-medium">
                      Card scanned successfully!
                    </span>
                  </>
                ) : (
                  <>
                    <Scan className="w-8 h-8 text-slate-300" />
                    <span className="text-slate-300 font-medium">
                      Tap to Scan Card
                    </span>
                  </>
                )}
              </div>
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-slate-900 px-2 text-slate-500">
                  Or enter manually
                </span>
              </div>
            </div>

            {/* Card ID Input */}
            <div className="space-y-2">
              <Label htmlFor="cardId" className="text-slate-200 font-medium">
                Card ID
              </Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <Input
                  ref={cardInputRef}
                  id="cardId"
                  type="text"
                  value={cardId}
                  onChange={handleCardIdChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Enter your card ID"
                  className="pl-11 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-200 font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
                <Input
                  ref={passwordInputRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  onKeyDown={handleKeyPress}
                  placeholder="Enter your password"
                  className="pl-11 pr-11 h-12 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert
                variant="destructive"
                className="bg-red-950/50 border-red-900 animate-in slide-in-from-top-2"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-red-200">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full h-12 bg-linear-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Checking in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" />
                  Check In
                </>
              )}
            </Button>
          </CardContent>

          <CardFooter className="flex flex-col space-y-2 pt-2">
            <Button
              variant="link"
              className="text-blue-400 hover:text-blue-300 p-0 h-auto font-normal"
            >
              Forgot your password?
            </Button>
            <p className="text-xs text-slate-500 text-center">
              Need assistance? Contact your supervisor
            </p>
          </CardFooter>
        </Card>

        {/* Terminal Info */}
        <div className="mt-6 text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-slate-400">
              Terminal{" "}
              <span className="text-slate-300 font-mono font-semibold">
                POS-001
              </span>
            </span>
          </div>
          <p className="text-xs text-slate-600">
            System v2.1.0 • All systems operational
          </p>
        </div>
      </div>
    </div>
  );
}
