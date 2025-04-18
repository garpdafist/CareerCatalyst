import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { getSupabase } from "@/lib/supabase";

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  verifyOtp: (email: string, otp: string) => Promise<void>;
  isVerifyingOtp: boolean;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        // Always check for real session from Supabase
        const supabase = await getSupabase();

        // Check for initial session
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setUser(session?.user ?? null);
          setIsLoading(false);
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          if (mounted) {
            setUser(session?.user ?? null);
            setIsLoading(false);
          }
        });

        return () => {
          mounted = false;
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();
  }, []);

  const signIn = async (email: string) => {
    setIsLoading(true);
    try {
      // Log config data for debugging
      console.log('Fetching Supabase client');
      
      // Advanced CSP and network diagnostics
      try {
        console.log('Testing connectivity to Supabase domain...');
        console.log('Testing if browser CSP allows external connections...');
        
        // Check actual CSP by examining document.head meta tags
        try {
          // Get CSP from meta tag if it exists (this is the most reliable method)
          const cspMetaTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
          if (cspMetaTag) {
            const cspMetaContent = cspMetaTag.getAttribute('content');
            console.log('Found CSP meta tag with content:', cspMetaContent);
            
            // Check if connect-src includes Supabase domains
            if (cspMetaContent) {
              const hasSupabaseDomains = cspMetaContent.includes('supabase.co');
              const hasWildcardDomains = cspMetaContent.includes('*');
              
              console.log(`CSP meta tag analysis:
                Has Supabase domains: ${hasSupabaseDomains}
                Has wildcard domains: ${hasWildcardDomains}`);
              
              if (!hasSupabaseDomains && !hasWildcardDomains) {
                console.error('CSP META TAG DOES NOT ALLOW SUPABASE CONNECTIONS!');
              }
            }
          } else {
            console.warn('No CSP meta tag found in document head - relying on HTTP header CSP');
          }
          
          // Also check server-side CSP configuration
          const cspDebugResponse = await fetch('/api/debug-csp');
          const cspDebugData = await cspDebugResponse.json();
          console.log('Server CSP debug information:', cspDebugData);
          
          // Analyze the applied CSP to confirm it allows Supabase connections
          const serverCsp = cspDebugData.appliedCsp || '';
          if (serverCsp) {
            console.log('Server CSP value:', serverCsp);
            
            // Check if connect-src includes wildcards or specific Supabase domains
            const connectSrcMatch = serverCsp.match(/connect-src([^;]*)/);
            if (connectSrcMatch) {
              const connectSrc = connectSrcMatch[1];
              console.log('Server connect-src directive:', connectSrc);
              
              const hasWildcard = connectSrc.includes('*');
              const hasSupabase = connectSrc.includes('supabase');
              const hasSpecificSupabase = connectSrc.includes('pwiysqqirjnjqacevzfp.supabase.co');
              
              console.log(`Server CSP connect-src analysis: 
                Has wildcard: ${hasWildcard}
                Has supabase domain: ${hasSupabase}
                Has specific Supabase project: ${hasSpecificSupabase}`);
            } else {
              console.warn('No connect-src directive found in server CSP!');
            }
          } else {
            console.warn('No CSP found in server response!');
          }
        } catch (cspDebugError) {
          console.error('Failed during CSP analysis:', cspDebugError);
        }
        
        // Now test actual connectivity to Supabase endpoints
        console.log('Attempting live connectivity tests to Supabase services...');
        
        // Array of test endpoints to try
        const testEndpoints = [
          'https://api.supabase.com/ping',
          'https://pwiysqqirjnjqacevzfp.supabase.co/rest/v1/',
          'https://pwiysqqirjnjqacevzfp.supabase.co/auth/v1/health'
        ];
        
        // Test each endpoint
        for (const endpoint of testEndpoints) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          try {
            console.log(`Testing connectivity to: ${endpoint}`);
            const response = await fetch(endpoint, {
              signal: controller.signal,
              mode: 'cors', // Explicitly request CORS
              headers: {
                'Content-Type': 'application/json'
              }
            });
            clearTimeout(timeoutId);
            console.log(`Endpoint ${endpoint} test result: ${response.status}`);
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            console.error(`Endpoint ${endpoint} test failed:`, fetchError);
            
            // Check if this is a CSP error
            if (fetchError instanceof DOMException && 
                fetchError.name === 'SecurityError') {
              console.error('CSP VIOLATION DETECTED! This is a Content Security Policy issue.');
            }
            
            // Check for network errors vs CSP errors
            if (fetchError.name === 'TypeError' && fetchError.message.includes('Failed to fetch')) {
              console.error('Network error detected - likely connectivity issue rather than CSP');
            }
          }
        }
      } catch (diagnosticError) {
        console.error('Failed during connection diagnostics:', diagnosticError);
      }
      
      // Configure enhanced email template with OTP instructions
      let supabase;
      try {
        supabase = await getSupabase();
        console.log('Supabase client initialized successfully');
      } catch (initError) {
        console.error('Failed to initialize Supabase client:', initError);
        // Try to get the specific error
        if (initError instanceof Error) {
          console.error('Supabase client error details:', {
            message: initError.message,
            name: initError.name,
            stack: initError.stack
          });
        }
        throw new Error(`Authentication service connection failed: ${initError instanceof Error ? initError.message : 'Unknown error'}`);
      }
      
      console.log('Supabase client initialized, sending OTP');
      
      // Detailed logging before API call
      console.log(`Starting signInWithOtp for ${email} with redirect to ${window.location.origin}`);
      console.log('Hybrid authentication enabled:', true);
      
      // Add timeout handling for OTP request
      const authPromise = supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
          // For security purposes, we generate the OTP server-side in Supabase
          // This adds our custom email template reference
          data: {
            useHybridAuthentication: true,
          }
        },
      });
      
      // Set up a timeout to catch hanging requests
      let timeoutId: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Supabase authentication request timed out after 15 seconds'));
        }, 15000);
      });
      
      // Race between the actual request and the timeout
      const { error, data } = await Promise.race([
        authPromise,
        timeoutPromise.then(() => { throw new Error('Authentication request timed out'); })
      ]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      }) as any;

      console.log('signInWithOtp response:', data ? 'Data received' : 'No data', error ? 'Error present' : 'No error');
      
      if (error) {
        console.error('Supabase signInWithOtp error details:', error);
        throw error;
      }

      toast({
        title: "Check your email",
        description: "We sent you a magic link and OTP code to sign in.",
        duration: 6000,
      });
      
      // Log auth attempt for auditing
      console.log(`Authentication attempt initiated for email: ${email} at ${new Date().toISOString()}`);
    } catch (error: any) {
      console.error('Authentication error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      toast({
        title: "Signed out",
        description: "Successfully signed out.",
      });

      setLocation('/auth');
    } catch (error: any) {
      toast({
        title: "Sign out failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (email: string, otp: string) => {
    setIsVerifyingOtp(true);
    try {
      console.log('Starting OTP verification for:', email);
      console.log('OTP code length:', otp.length);
      
      const supabase = await getSupabase();
      console.log('Supabase client retrieved for OTP verification');
      
      const { error, data } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email'
      });

      console.log('OTP verification response:', {
        success: !error,
        hasUserData: !!data?.user,
        errorMessage: error?.message || 'none'
      });

      if (error) {
        console.error('OTP verification error details:', error);
        throw error;
      }

      // Successful OTP verification
      if (data?.user) {
        console.log('User authenticated successfully:', data.user.id);
        setUser(data.user);
        toast({
          title: "Success",
          description: "You have successfully signed in.",
        });
      } else {
        console.error('Authentication successful but no user data returned');
        toast({
          title: "Sign in issue",
          description: "Authentication successful, but user data is missing. Please try again.",
          variant: "destructive",
        });
        throw new Error('No user data returned from successful authentication');
      }
      setLocation('/');
    } catch (error: any) {
      console.error('OTP verification error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signOut,
        verifyOtp,
        isVerifyingOtp
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}