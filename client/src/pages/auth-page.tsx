import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Redirect } from "wouter";
import { Label } from "@/components/ui/label";
import { 
  Loader2, Mail, ShieldCheck, Clock, ArrowRight, 
  AlertTriangle, CheckCircle, XCircle 
} from "lucide-react";
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
  const [emailError, setEmailError] = useState<string | null>(null);
  
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
    serviceName?: string; 
  }>({
    hasIssue: false,
    issueType: null
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
          const { canResolve, canConnect, serviceName } = config.diagnostics.dnsStatus;
          console.log('Server-side diagnostics:', { canResolve, canConnect, serviceName });
          
          // If server couldn't resolve or connect to auth service, show warning
          if (!canResolve || !canConnect) {
            console.warn('Server detected connectivity issues with authentication service');
            
            // Determine the issue type
            const issueType = !canResolve ? 'dns' : 'connection';
            
            // Update connection status state
            setConnectionStatus({
              hasIssue: true,
              issueType,
              serviceName
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
              serviceName: "authentication service"
            });
          }
        }
      } catch (error) {
        console.error('Error during connectivity check:', error);
        
        // Generic network error
        setConnectionStatus({
          hasIssue: true,
          issueType: 'network',
          serviceName: "authentication service"
        });
      }
    }
    
    testConnectivity();
  }, []);
  
  // Redirect authenticated users to home page
  if (user) {
    return <Redirect to="/" />;
  }

  // Function to validate email format
  const isValidEmail = (email: string) => {
    // More comprehensive validation
    if (!email) return false;
    
    // Check for commas in the domain part (common error)
    if (email.includes('@') && email.split('@')[1].includes(',')) {
      return false;
    }
    
    // Fixed email regex that won't cause CSP/regex syntax errors
    // Using a simpler pattern that's still effective but avoids problematic characters
    try {
      // Basic email regex with fewer special characters
      const emailRegex = new RegExp('^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
      return emailRegex.test(email);
    } catch (error) {
      console.error('Email validation regex error:', error);
      // Fallback validation if regex fails
      return email.includes('@') && email.includes('.') && email.length > 5;
    }
  };
  
  // Enhanced live validation as user types with more specific error messages
  const validateEmailInput = (value: string) => {
    if (!value) return null;
    
    // Check for common email mistakes and provide specific feedback
    if (value.includes('@') && value.split('@')[1].includes(',')) {
      return "Email domain should use periods (.) not commas (,)";
    }
    
    if (value.includes(' ')) {
      return "Email address cannot contain spaces";
    }
    
    // Check for missing @ symbol in emails with reasonable length
    if (!value.includes('@') && value.length > 5) {
      return "Email address must include an @ symbol";
    }
    
    // Check for missing domain after @ symbol
    if (value.endsWith('@')) {
      return "Please include a domain after @";
    }
    
    // Check for domain with no TLD
    if (value.includes('@') && !value.split('@')[1].includes('.') && value.split('@')[1].length > 2) {
      return "Domain must include a period (e.g., .com, .org)";
    }
    
    // General validation for other cases
    if (!isValidEmail(value) && value.length > 5) {
      return "Please enter a valid email address";
    }
    
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null); // Clear any previous errors
    
    // First check with our validateEmailInput function to get specific errors
    const validationError = validateEmailInput(email);
    if (validationError) {
      setEmailError(validationError);
      setErrorMsg(validationError);
      return;
    }
    
    // Double-check if email format is valid
    if (!isValidEmail(email)) {
      const errorMessage = "Please enter a valid email address (e.g., name@example.com)";
      setEmailError(errorMessage);
      setErrorMsg(errorMessage);
      return;
    }
    
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
      console.error('Authentication error details:', error);
      
      // Specific error handling for different scenarios
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        
        // Check for common network-related errors
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          setErrorMsg('Network error: Could not connect to authentication service. Please check your internet connection.');
          setConnectionStatus({
            hasIssue: true,
            issueType: 'network',
            serviceName: 'Authentication Service'
          });
        } 
        // Check for AbortError which occurs when fetch is timed out
        else if (error.name === 'AbortError') {
          setErrorMsg('Authentication request timed out. This could be due to slow network connection.');
          setConnectionStatus({
            hasIssue: true,
            issueType: 'connection',
            serviceName: 'Authentication Service'
          });
        } 
        // Check for browser security restrictions
        else if (error.message.includes('CORS') || error.message.includes('content security policy')) {
          setErrorMsg('Browser Security Restriction Detected: Your browser is blocking the authentication service. Try disabling extensions or using a different browser.');
          setConnectionStatus({
            hasIssue: true,
            issueType: 'browser',
            serviceName: 'Authentication Service'
          });
        }
        // Default error message
        else {
          setErrorMsg(`Authentication error: ${error.message || 'Failed to sign in'}`);
        }
      } else if (error && typeof error === 'object') {
        const errorString = JSON.stringify(error);
        console.error('Error object:', errorString);
        
        if (errorString.includes('CORS') || errorString.includes('security') || errorString.includes('blocked')) {
          setErrorMsg('Browser Security Restriction Detected: Your browser is blocking the connection to our authentication service.');
          setConnectionStatus({
            hasIssue: true,
            issueType: 'browser',
            serviceName: 'Authentication Service'
          });
        } else {
          setErrorMsg(`Authentication error: ${error.message || 'Failed to sign in'}`);
        }
      } else {
        console.error('Unknown error type:', error);
        setErrorMsg('Authentication error: Unable to connect to authentication service');
      }
      
      // Perform advanced connectivity diagnostics
      try {
        console.log('Running comprehensive connectivity diagnostics...');
        
        // Check if we can access our own API
        const apiConnectivityTest = await fetch('/api/health', { 
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' }
        });
        
        if (!apiConnectivityTest.ok) {
          console.error('API connectivity test failed');
          setErrorMsg('Cannot connect to application server. Please check your network connection.');
          return;
        }
        
        // Check if we can access the authentication service configuration
        const configResponse = await fetch('/api/config');
        
        if (!configResponse.ok) {
          console.error('Config API failed:', configResponse.status);
          setErrorMsg('Cannot retrieve authentication configuration. Please try again later.');
          return;
        }
        
        const config = await configResponse.json();
        
        if (!config.supabaseUrl) {
          console.error('No Supabase URL in config');
          setErrorMsg('Authentication service configuration is missing. Please contact support.');
          return;
        }
        
        // Attempt to directly test authentication service (will likely fail if there are security restrictions)
        try {
          const authTest = await fetch(config.supabaseUrl + '/health', { 
            mode: 'no-cors', // This allows the request but won't let us read the response
            method: 'GET',
            headers: { 'Cache-Control': 'no-cache' }
          });
          
          console.log('Authentication service connectivity test completed');
        } catch (directTestError) {
          console.error('Direct authentication service test failed:', directTestError);
          // This is expected to fail in some browsers due to CORS, so don't update error message
        }
        
        // Use our server as a proxy to test connectivity
        const proxyTest = await fetch('/api/auth-service-test');
        const proxyResult = await proxyTest.json();
        
        if (!proxyResult.success) {
          console.error('Server proxy test failed:', proxyResult.error);
          setErrorMsg(`Server cannot connect to authentication service: ${proxyResult.errorType || 'Unknown error'}`);
          setConnectionStatus({
            hasIssue: true,
            issueType: proxyResult.errorType === 'ENOTFOUND' ? 'dns' : 'connection',
            serviceName: 'Authentication Service'
          });
        }
      } catch (diagnosticError) {
        console.error('Error during connectivity diagnostics:', diagnosticError);
        // Keep the original error message
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
                    <Alert className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-md">
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
                            We're having trouble connecting to our authentication service.
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
                    <div className="space-y-1">
                      <div className="relative">
                        <Input
                          id="email"
                          type="email"
                          placeholder="Enter your email"
                          value={email}
                          onChange={(e) => {
                            const value = e.target.value;
                            setEmail(value);
                            setEmailError(validateEmailInput(value));
                          }}
                          required
                          disabled={isLoading}
                          className={`w-full py-6 px-4 pr-10 ${
                            email && email.length > 5
                              ? emailError
                                ? "border-red-300 focus:border-red-500 bg-red-50/50" 
                                : isValidEmail(email)
                                ? "border-green-300 focus:border-green-500 bg-green-50/50"
                                : "border-[#e5e5e5] focus:border-[#009963]"
                              : "border-[#e5e5e5] focus:border-[#009963]"
                          } placeholder:text-muted-foreground/60`}
                          title="Please enter a valid email address (e.g., name@example.com)"
                        />
                        {email && email.length > 5 && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            {emailError ? (
                              <XCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
                            ) : isValidEmail(email) ? (
                              <CheckCircle className="h-5 w-5 text-green-500" aria-hidden="true" />
                            ) : null}
                          </div>
                        )}
                      </div>
                      {emailError ? (
                        <p className="text-xs text-red-500 px-1 mt-1">{emailError}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground px-1">Format: name@example.com</p>
                      )}
                    </div>
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