import { createClient } from '@supabase/supabase-js';

let supabaseClient: ReturnType<typeof createClient> | null = null;
let initializationPromise: Promise<ReturnType<typeof createClient>> | null = null;

export async function initSupabase() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log('Fetching Supabase configuration from /api/config');
      
      // Detailed network diagnostics
      console.log('Network status:', navigator.onLine ? 'Online' : 'Offline');
      console.log('Browser user agent:', navigator.userAgent);
      console.log('Current origin:', window.location.origin);
      
      // Add timeout and retry logic
      const fetchWithTimeout = async (url: string, options = {}, timeout = 10000) => {
        const controller = new AbortController();
        const { signal } = controller;
        
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(url, { ...options, signal });
          clearTimeout(timeoutId);
          return response;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      };
      
      // Try up to 3 times with exponential backoff
      let lastError;
      let response;
      
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          console.log(`Config fetch attempt ${attempt + 1}/3`);
          
          if (attempt > 0) {
            // Wait longer between each retry (500ms, then 1500ms)
            await new Promise(resolve => setTimeout(resolve, Math.pow(3, attempt) * 500));
          }
          
          response = await fetchWithTimeout('/api/config', {}, 10000);
          break; // Successful response, exit loop
        } catch (error: any) {
          console.error(`Config fetch attempt ${attempt + 1} failed:`, error);
          lastError = error;
          
          // Diagnostic checks on failure
          if (error.name === 'AbortError') {
            console.warn('Fetch request timed out after 10 seconds');
          } else if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            console.warn('Potential network connection issue or CORS problem');
          }
        }
      }
      
      // If all attempts failed
      if (!response) {
        throw lastError || new Error('Failed to fetch config after multiple attempts');
      }
      
      if (!response.ok) {
        console.error('Config API response not OK, status:', response.status);
        const responseText = await response.text();
        console.error('Error response body:', responseText);
        throw new Error(`Failed to fetch Supabase configuration: ${response.status} ${response.statusText}`);
      }
      
      let config;
      try {
        config = await response.json();
        console.log('Config received, URL status:', config.supabaseUrl ? 
                    `exists (prefix: ${config.supabaseUrl.substring(0, 10)}...)` : 'missing',
                    'Key status:', config.supabaseAnonKey ? 
                    `exists (length: ${config.supabaseAnonKey.length})` : 'missing');
      } catch (jsonError) {
        console.error('Failed to parse config response as JSON:', jsonError);
        throw new Error('Invalid JSON response from config endpoint');
      }

      if (!config.supabaseUrl || !config.supabaseAnonKey) {
        console.error('Missing config values:', { 
          hasUrl: !!config.supabaseUrl, 
          hasKey: !!config.supabaseAnonKey 
        });
        throw new Error('Invalid Supabase configuration received from server');
      }
      
      // Test DNS connectivity to the Supabase URL
      try {
        console.log('Testing connectivity to Supabase URL before client creation...');
        const supabaseURLObj = new URL(config.supabaseUrl);
        const testDomain = supabaseURLObj.hostname;
        
        console.log(`Attempting to connect to ${testDomain} for DNS check...`);
        
        // Create a simple fetch with a 7-second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);
        
        try {
          // Try to fetch a known endpoint that should be accessible
          // We're just testing connectivity, not expecting a valid response
          const dnsTestUrl = `${config.supabaseUrl}/auth/v1/health`;
          console.log(`Connectivity test URL: ${dnsTestUrl}`);
          
          const dnsTestResponse = await fetch(dnsTestUrl, {
            signal: controller.signal,
            method: 'HEAD' // Just do a HEAD request to minimize data transfer
          });
          
          clearTimeout(timeoutId);
          console.log(`DNS connectivity check result: status ${dnsTestResponse.status}`);
        } catch (dnsError: any) {
          clearTimeout(timeoutId);
          const errorType = dnsError.name || 'Unknown';
          const errorMsg = dnsError.message || 'No message';
          
          console.error(`DNS connectivity check failed:`, {
            type: errorType,
            message: errorMsg,
            isDNSError: errorMsg.includes('resolve host') || errorMsg.includes('connect') || errorMsg.includes('network'),
            stack: dnsError.stack
          });
          
          if (errorType === 'TypeError' && 
             (errorMsg.includes('Failed to fetch') || 
              errorMsg.includes('resolve host') || 
              errorMsg.includes('network'))) {
            // This is likely a DNS resolution or connectivity issue
            throw new Error(`Cannot connect to the authentication service at ${testDomain}. Your network may be blocking access to this domain.`);
          }
        }
      } catch (connectivityError) {
        console.error('Connectivity test failed:', connectivityError);
        // Don't throw here, still try to create the client
      }

      console.log('Creating Supabase client with URL and key');
      try {
        // Try to diagnose any issues with the URL format
        const supabaseURLObj = new URL(config.supabaseUrl);
        console.log(`URL will connect to protocol: ${supabaseURLObj.protocol}, host: ${supabaseURLObj.host}`);
        
        // Verify URL structure and format before proceeding
        if (!supabaseURLObj.hostname.includes('supabase')) {
          console.warn('Warning: Supabase URL does not include "supabase" domain, this might be incorrect:', config.supabaseUrl);
        }
        
        // Verify API key format
        if (!config.supabaseAnonKey || config.supabaseAnonKey.length < 20) {
          console.warn('Warning: Supabase anon key may be invalid. Check the key format and length.');
        }
        
        // Add custom retry logic and timeout options
        const supabaseOptions = {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            storageKey: 'career-ai-auth',
            flowType: 'pkce' as const, // Type assertion to fix LSP error
            detectSessionInUrl: true
          },
          global: {
            headers: {
              'x-application-name': 'career-ai-platform'
            }
          },
          // Add retries for authentication API calls
          realtime: {
            timeout: 30000 // 30 seconds timeout for realtime subscriptions
          }
        };
        
        // Log full client configuration
        console.log('Creating Supabase client with options:', JSON.stringify(supabaseOptions, null, 2));
        
        // Create the Supabase client
        supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, supabaseOptions);
        
        // Modify fetch to handle timeouts and add retry logic for network issues
        try {
          // Save original fetch
          const originalFetch = global.fetch;
          
          // Replace with our enhanced version
          global.fetch = async function enhancedFetch(url: RequestInfo | URL, options: RequestInit = {}) {
            const urlStr = url.toString();
            const isSupabaseRequest = urlStr.includes('supabase');
            
            // Longer timeout for Supabase requests
            const timeoutMs = isSupabaseRequest ? 30000 : 15000; 
            
            // Add a timeout signal if one isn't already provided
            if (!options.signal) {
              const controller = new AbortController();
              setTimeout(() => controller.abort(), timeoutMs);
              options.signal = controller.signal;
            }
            
            // Add retry logic for auth-related Supabase requests
            if (isSupabaseRequest && urlStr.includes('/auth/')) {
              console.log(`Enhanced fetch for auth endpoint: ${urlStr.substring(0, 100)}...`);
              
              // For auth requests, try up to 3 times with exponential backoff
              let attempt = 0;
              const maxAttempts = 3;
              
              while (attempt < maxAttempts) {
                try {
                  if (attempt > 0) {
                    console.log(`Retry attempt ${attempt} for auth request`);
                    // Exponential backoff: 500ms, 1500ms, 4500ms
                    await new Promise(resolve => setTimeout(resolve, Math.pow(3, attempt) * 500));
                  }
                  
                  const response = await originalFetch(url, options);
                  return response;
                } catch (error: any) {
                  attempt++;
                  console.warn(`Fetch error (attempt ${attempt}/${maxAttempts}):`, error.name, error.message);
                  
                  // If this was the last attempt, rethrow
                  if (attempt >= maxAttempts) {
                    throw error;
                  }
                  
                  // Otherwise continue to retry
                }
              }
            }
            
            // For non-auth requests or if we get here, just do a normal fetch with timeout
            return originalFetch(url, options);
          };
        } catch (fetchError) {
          console.warn('Failed to set up enhanced fetch with timeout and retries:', fetchError);
        }
      } catch (initError: any) {
        console.error('Error creating Supabase client:', initError);
        console.error('Error details:', {
          name: initError.name,
          message: initError.message,
          stack: initError.stack
        });
        throw new Error(`Failed to initialize Supabase client: ${initError.message}`);
      }

      console.log('Supabase client initialized successfully');
      return supabaseClient;
    } catch (error: any) {
      console.error('Failed to initialize Supabase:', error);
      console.error('Stack trace:', error.stack ? error.stack : 'No stack trace available');
      initializationPromise = null; // Reset so we can try again
      throw error;
    }
  })();

  return initializationPromise;
}

export async function getSupabase() {
  if (!supabaseClient) {
    await initSupabase();
  }
  return supabaseClient!;
}

// Don't auto-initialize on import - let components handle initialization