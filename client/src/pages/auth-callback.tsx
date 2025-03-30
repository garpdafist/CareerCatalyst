import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { getSupabase } from '@/lib/supabase';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedBackground } from '@/components/animated-background';
import { Card, CardContent } from '@/components/ui/card';

/**
 * This page handles the magic link authentication callback.
 * It processes the URL parameters added by Supabase, authenticates the user,
 * and redirects to the home page.
 */
export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        // Get URL hash parameters from Supabase magic link
        const hash = window.location.hash;
        
        if (!hash) {
          // No hash parameters, redirect to auth page
          setError('No authentication parameters found');
          setStatus('error');
          setTimeout(() => {
            setLocation('/auth');
          }, 3000);
          return;
        }
        
        const supabase = await getSupabase();
        
        // Process the authentication params
        const { error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Authentication session error:', error);
          throw new Error('Failed to establish authentication session. Please try again.');
        }
        
        // Show success state briefly before redirecting
        setStatus('success');
        setTimeout(() => {
          // Redirect to the home page after successful authentication
          setLocation('/');
        }, 1500);
      } catch (err: any) {
        console.error('Error handling auth callback:', err);
        setError(err.message || 'An unexpected error occurred during authentication');
        setStatus('error');
        
        // Redirect to auth page after error
        setTimeout(() => {
          setLocation('/auth');
        }, 3000);
      }
    }

    handleAuthCallback();
  }, [setLocation]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f8f5ee] relative overflow-hidden">
      <AnimatedBackground />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="w-[400px] bg-white/90 backdrop-blur-sm shadow-md border-none">
          <CardContent className="flex flex-col items-center justify-center text-center py-10 px-8">
            {status === 'loading' && (
              <>
                <div className="w-16 h-16 rounded-full bg-[#e8f5e9]/50 flex items-center justify-center mb-6">
                  <Loader2 className="h-10 w-10 animate-spin text-[#009963]" />
                </div>
                <h1 className="text-2xl font-semibold text-[#292929] mb-2">Signing you in</h1>
                <p className="text-muted-foreground">
                  Please wait while we complete the authentication process...
                </p>
              </>
            )}
            
            {status === 'success' && (
              <>
                <div className="w-16 h-16 rounded-full bg-[#e8f5e9] flex items-center justify-center mb-6 animate-pulse">
                  <CheckCircle2 className="h-10 w-10 text-[#009963]" />
                </div>
                <h1 className="text-2xl font-semibold text-[#292929] mb-2">Authentication successful!</h1>
                <p className="text-muted-foreground">
                  You're now being redirected to your dashboard...
                </p>
              </>
            )}
            
            {status === 'error' && (
              <>
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-6">
                  <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
                <h1 className="text-2xl font-semibold text-[#292929] mb-2">Authentication Error</h1>
                <p className="text-red-500 font-medium mb-2">{error}</p>
                <p className="text-muted-foreground">
                  Redirecting you to the login page...
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}