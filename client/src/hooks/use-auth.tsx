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

const isDevelopment = import.meta.env.DEV;

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
        if (isDevelopment) {
          // In development, create a mock user
          const mockUser = {
            id: 'test-user',
            email: 'test@example.com',
            aud: 'authenticated',
            role: 'authenticated',
            email_confirmed_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
            app_metadata: { provider: 'email' },
            user_metadata: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          if (mounted) {
            setUser(mockUser as User);
            setIsLoading(false);
          }
          return;
        }

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
      if (isDevelopment) {
        // In development, auto-sign in with mock user
        const mockUser = {
          id: 'test-user',
          email: email,
          aud: 'authenticated',
          role: 'authenticated',
          email_confirmed_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString(),
          app_metadata: { provider: 'email' },
          user_metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        setUser(mockUser as User);
        toast({
          title: "Development Mode",
          description: "Signed in with mock user. Use OTP code: 123456 for testing.",
        });
        setLocation('/');
        return;
      }

      // Configure enhanced email template with OTP instructions
      const supabase = await getSupabase();
      const { error } = await supabase.auth.signInWithOtp({
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

      if (error) throw error;

      toast({
        title: "Check your email",
        description: "We sent you a magic link and OTP code to sign in.",
        duration: 6000,
      });
      
      // Log auth attempt for auditing
      console.log(`Authentication attempt initiated for email: ${email} at ${new Date().toISOString()}`);
    } catch (error: any) {
      console.error('Authentication error:', error);
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
      if (isDevelopment) {
        setUser(null);
        toast({
          title: "Signed out",
          description: "Development mode: Successfully signed out.",
        });
        setLocation('/auth');
        return;
      }

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
      if (isDevelopment) {
        // In development, auto-sign in with mock user when OTP is '123456'
        if (otp === '123456') {
          const mockUser = {
            id: 'test-user',
            email: email,
            aud: 'authenticated',
            role: 'authenticated',
            email_confirmed_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
            app_metadata: { provider: 'email' },
            user_metadata: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
  
          setUser(mockUser as User);
          toast({
            title: "Development Mode",
            description: "Signed in with mock user using OTP.",
          });
          setLocation('/');
          return;
        } else {
          throw new Error('Invalid OTP code in development mode. Use 123456.');
        }
      }

      const supabase = await getSupabase();
      const { error, data } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email'
      });

      if (error) throw error;

      // Successful OTP verification
      setUser(data.user);
      toast({
        title: "Success",
        description: "You have successfully signed in.",
      });
      setLocation('/');
    } catch (error: any) {
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