import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Redirect } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ShieldCheck, Clock, ArrowRight, AlertTriangle } from "lucide-react";
import { AnimatedBackground } from "@/components/animated-background";
import { OtpInput } from "@/components/ui/otp-input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [showResend, setShowResend] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const { signIn, isLoading, verifyOtp, isVerifyingOtp, user } = useAuth();
  
  // Use useEffect for timer management
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (showResend && countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setShowResend(false);
      setCountdown(60);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [showResend, countdown]);
  
  // State to track connectivity issues
  const [connectionStatus, setConnectionStatus] = useState<{
    hasIssue: boolean;
    issueType: 'dns' | 'connection' | 'network' | 'browser' | null;
    domain: string | null;
  }>({
    hasIssue: false,
    issueType: null,
    domain: null
  });

  // Check for connectivity issues with Supabase on page load
  useEffect(() => {
    // Perform a connectivity test to Supabase
    async function testConnectivity() {
      try {
        // First check the API config endpoint which performs server-side DNS checks
        console.log('Fetching API config with connection diagnostics...');
        const configResponse = await fetch('/api/config');
        const config = await configResponse.json();
        
        // Check if server-side diagnostics detected DNS issues
        if (config.diagnostics?.dnsStatus) {
          const { canResolve, canConnect, domain } = config.diagnostics.dnsStatus;
          console.log('Server-side DNS diagnostics:', { canResolve, canConnect, domain });
          
          // If server couldn't resolve or connect to Supabase, show warning
          if (!canResolve || !canConnect) {
            console.warn('Server detected connectivity issues with Supabase');
            
            // Determine the issue type
            const issueType = !canResolve ? 'dns' : 'connection';
            
            // Update connection status state
            setConnectionStatus({
              hasIssue: true,
              issueType,
              domain
            });
          }
        }
        
        // Now test direct connectivity from browser 
        try {
          console.log('Testing direct Supabase connectivity from browser...');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const testResponse = await fetch(config.supabaseUrl + '/auth/v1/health', {
            method: 'HEAD',
            signal: controller.signal,
            mode: 'no-cors', // This won't provide response data but won't fail on CORS issues
            cache: 'no-cache',
            credentials: 'omit'
          });
          
          clearTimeout(timeoutId);
          console.log('Supabase connectivity test completed');
        } catch (fetchError: any) {
          console.error('Browser connectivity test failed:', fetchError);
          
          // Determine the type of connection error
          let issueType: 'browser' | 'network' = 'network';
          if (fetchError.name === 'TypeError' && fetchError.message?.includes('Failed to fetch')) {
            issueType = 'browser';
          }
          
          // Update connection status
          if (!connectionStatus.hasIssue) {
            setConnectionStatus({
              hasIssue: true,
              issueType,
              domain: config.supabaseUrl ? new URL(config.supabaseUrl).hostname : null
            });
          }
        }
      } catch (error) {
        console.error('Error during connectivity check:', error);
        
        // Generic network error
        setConnectionStatus({
          hasIssue: true,
          issueType: 'network',
          domain: null
        });
      }
    }
    
    testConnectivity();
  }, []);
  
  // Redirect authenticated users to home page
  if (user) {
    return <Redirect to="/" />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null); // Clear any previous errors
    try {
      console.log('Initiating sign-in process for:', email);
      
      // Add network logging
      console.log('Network status:', navigator.onLine ? 'Online' : 'Offline');
      console.log('Current URL:', window.location.href);
      console.log('API endpoint:', '/api/config');
      
      await signIn(email);
      console.log('Sign-in successful, OTP should be sent');
      setShowResend(true);
      setShowOtp(true); // Show OTP verification screen
    } catch (error: any) {
      console.error('Auth page sign-in error:', error);
      
      // Detailed error logging
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        setErrorMsg(`Authentication error: ${error.message || 'Failed to sign in'}`);
      } else if (error && typeof error === 'object') {
        console.error('Error object:', JSON.stringify(error, null, 2));
        setErrorMsg(`Authentication error: ${error.message || 'Failed to sign in'}`);
      } else {
        console.error('Unknown error type:', error);
        setErrorMsg('Authentication error: Unable to connect to authentication service');
      }
      
      // Let's test if we can access Supabase directly
      try {
        console.log('Testing direct fetch to Supabase URL...');
        const response = await fetch('https://pwiysqqirjnjqacevzfp.supabase.co/health');
        console.log('Supabase health check response:', response.status, response.statusText);
        if (!response.ok) {
          setErrorMsg('Authentication service connection issue. Please try again later.');
        }
      } catch (networkError) {
        console.error('Supabase direct fetch error:', networkError);
        setErrorMsg('Cannot connect to authentication service. Please check your network connection.');
      }
    }
  };

  const handleResend = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await signIn(email);
      setCountdown(60);
      setShowResend(true);
    } catch (error) {
      // Error is handled in useAuth
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      console.log('Verifying OTP:', { email, otpLength: otp.length });
      await verifyOtp(email, otp);
      console.log('OTP verification successful');
    } catch (error: any) {
      console.error('Auth page OTP verification error:', error);
      
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        setErrorMsg(`Verification error: ${error.message || 'Invalid code'}`);
      } else if (error && typeof error === 'object') {
        console.error('Error object:', JSON.stringify(error, null, 2));
        setErrorMsg(`Verification error: ${error.message || 'Invalid code'}`);
      } else {
        console.error('Unknown error type:', error);
        setErrorMsg('Verification error: Unable to verify code');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f5ee] relative overflow-hidden">
      {/* Animated background */}
      <AnimatedBackground />
      
      {/* Content container */}
      <div className="container px-4 py-16 md:py-24 flex flex-col lg:flex-row max-w-6xl mx-auto gap-8 lg:gap-16 items-center">
        {/* Hero section (left on desktop, top on mobile) */}
        <motion.div 
          className="w-full lg:w-1/2 flex flex-col text-center lg:text-left space-y-6 mb-8 lg:mb-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#292929] leading-tight">
            Enhance your career with <span className="bg-gradient-to-r from-[#009963] to-emerald-600 bg-clip-text text-transparent">AI-powered</span> insights
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
            CareerAI helps you optimize your resume, craft compelling cover letters, and improve your job application success rate.
          </p>
          
          <div className="flex flex-col space-y-4 mt-4">
            <div className="flex items-center space-x-3 p-3 bg-white/50 rounded-lg backdrop-blur-sm">
              <div className="bg-[#e8f5e9] p-2 rounded-full">
                <ShieldCheck className="h-5 w-5 text-[#2e7d32]" />
              </div>
              <div className="text-sm text-left">
                Secure passwordless login with magic links and one-time codes
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-white/50 rounded-lg backdrop-blur-sm">
              <div className="bg-[#e8f5e9] p-2 rounded-full">
                <Mail className="h-5 w-5 text-[#2e7d32]" />
              </div>
              <div className="text-sm text-left">
                Get personalized career advice delivered to your inbox
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Auth form (right on desktop, bottom on mobile) */}
        <motion.div
          className="w-full lg:w-1/2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="w-full max-w-md mx-auto bg-white/90 backdrop-blur-sm shadow-md border-none">
            <CardHeader className="space-y-3 pb-5">
              <CardTitle className="text-2xl font-bold text-center text-[#292929]">
                Welcome to CareerAI
              </CardTitle>
              <CardDescription className="text-center text-base">
                Sign in with your email to get started
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {!showOtp ? (
                // Initial email input form
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Connection warning banner - conditionally shown based on connectionStatus */}
                  {connectionStatus.hasIssue && (
                    <Alert variant="warning" className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
                      <div className="flex items-start">
                        <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-medium text-amber-800">
                            {connectionStatus.issueType === 'dns' 
                              ? 'DNS Resolution Issue Detected' 
                              : connectionStatus.issueType === 'browser'
                              ? 'Browser Security Restriction Detected'
                              : 'Network Connectivity Issue Detected'}
                          </h3>
                          <p className="text-sm text-amber-700 mt-1">
                            We're having trouble connecting to our authentication service
                            {connectionStatus.domain ? ` (${connectionStatus.domain})` : ''}.
                          </p>
                          <ul className="list-disc pl-5 mt-1 text-sm text-amber-700">
                            {connectionStatus.issueType === 'dns' && (
                              <>
                                <li>Your network may have DNS resolution restrictions</li>
                                <li>The hostname may be temporarily unavailable</li>
                              </>
                            )}
                            {connectionStatus.issueType === 'browser' && (
                              <>
                                <li>Your browser's security settings may be blocking the connection</li>
                                <li>Content Security Policy restrictions may be in effect</li>
                              </>
                            )}
                            {(connectionStatus.issueType === 'network' || connectionStatus.issueType === 'connection') && (
                              <>
                                <li>Your network connection may be unstable</li>
                                <li>A firewall or proxy might be blocking authentication requests</li>
                              </>
                            )}
                          </ul>
                          <p className="text-sm text-amber-700 mt-1">
                            Sign-in may still work, but you might experience issues. If you continue to
                            have problems, please try a different network connection.
                          </p>
                        </div>
                      </div>
                    </Alert>
                  )}
                  
                  {errorMsg && (
                    <Alert variant="destructive" className="bg-[#ffebee] border-red-200 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Authentication Error</AlertTitle>
                      <AlertDescription>
                        {errorMsg}
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-sm font-medium">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      className="w-full bg-white py-6 px-4 border border-[#e5e5e5] placeholder:text-muted-foreground/60 focus:border-[#009963]"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-[#009963] hover:bg-[#008955] transition-all duration-200 shadow-sm hover:shadow-md rounded-md text-white font-medium" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Sending verification...
                      </>
                    ) : (
                      <>
                        Sign In Securely
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                // OTP verification form
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  {errorMsg && (
                    <Alert variant="destructive" className="bg-[#ffebee] border-red-200 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Verification Error</AlertTitle>
                      <AlertDescription>
                        {errorMsg}
                      </AlertDescription>
                    </Alert>
                  )}
                
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#e8f5e9] mb-3">
                      <Mail className="h-6 w-6 text-[#2e7d32]" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">Check your email</h3>
                    <p className="text-sm text-muted-foreground">
                      We've sent a verification email to <span className="font-medium">{email}</span>
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <Label htmlFor="otp" className="text-sm font-medium">
                      Enter the 6-digit code
                    </Label>
                    
                    {/* Custom OTP input component */}
                    <OtpInput
                      value={otp}
                      onChange={setOtp}
                      length={6}
                      disabled={isVerifyingOtp}
                      className="py-2"
                      inputClassName="bg-white border-[#e5e5e5] focus:border-[#009963]"
                    />
                  </div>
                  
                  <Button 
                    type="submit" 
                    className="w-full h-12 bg-[#009963] hover:bg-[#008955] transition-all duration-200 shadow-sm hover:shadow-md rounded-md text-white font-medium" 
                    disabled={isVerifyingOtp}
                  >
                    {isVerifyingOtp ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        Verify & Sign In
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  
                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-[#009963] hover:text-[#008955]"
                      onClick={handleResend}
                      disabled={countdown > 0 || isLoading}
                    >
                      {countdown > 0 ? (
                        <div className="flex items-center">
                          <Clock className="mr-2 h-4 w-4" />
                          Resend email in {countdown}s
                        </div>
                      ) : (
                        "Resend verification email"
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
            
            <CardFooter className="flex flex-col text-center text-sm text-muted-foreground px-8 pb-6 pt-3 border-t border-[#e5e5e5]/50">
              <div className="flex items-center justify-center mb-2 space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground/70" />
                <p>
                  {!showOtp 
                    ? "You'll receive both a magic link and one-time code via email"
                    : "Both the magic link and OTP code expire after 10 minutes"}
                </p>
              </div>
              {!showOtp && (
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Use either method to securely access your account
                </p>
              )}
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}