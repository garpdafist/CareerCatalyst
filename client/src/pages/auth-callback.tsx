import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { getSupabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';

/**
 * This page handles the magic link authentication callback.
 * It processes the URL parameters added by Supabase, authenticates the user,
 * and redirects to the home page.
 */
export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        // Get URL hash parameters from Supabase magic link
        const hash = window.location.hash;
        
        if (!hash) {
          // No hash parameters, redirect to auth page
          setLocation('/auth');
          return;
        }
        
        const supabase = await getSupabase();
        
        // Process the authentication params
        const { error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        // Redirect to the home page after successful authentication
        setLocation('/');
      } catch (err: any) {
        console.error('Error handling auth callback:', err);
        setError(err.message || 'An unexpected error occurred during authentication');
        
        // Redirect to auth page after error
        setTimeout(() => {
          setLocation('/auth');
        }, 3000);
      }
    }

    handleAuthCallback();
  }, [setLocation]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      {error ? (
        <div className="text-center">
          <h1 className="text-xl font-semibold text-destructive">Authentication Error</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <p className="mt-4">Redirecting you to the login page...</p>
        </div>
      ) : (
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4 mx-auto" />
          <h1 className="text-xl font-semibold">Signing you in</h1>
          <p className="mt-2 text-muted-foreground">Please wait while we complete the authentication process...</p>
        </div>
      )}
    </div>
  );
}