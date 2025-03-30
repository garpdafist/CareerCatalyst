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
        
        // Add custom retry logic and timeout options
        supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            storageKey: 'career-ai-auth',
            flowType: 'pkce',
            detectSessionInUrl: true
          },
          global: {
            headers: {
              'x-application-name': 'career-ai-platform'
            }
          }
        });
        
        // Add timeout handling through custom HTTP request handling
        try {
          // Set a default timeout for requests
          const originalFetch = global.fetch;
          global.fetch = function timeoutFetch(url: RequestInfo | URL, options: RequestInit = {}) {
            // Add a timeout signal if one isn't already provided
            if (!options.signal) {
              const controller = new AbortController();
              setTimeout(() => controller.abort(), 15000); // 15-second timeout
              options.signal = controller.signal;
            }
            return originalFetch(url, options);
          };
        } catch (fetchError) {
          console.warn('Failed to set up custom fetch with timeout:', fetchError);
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