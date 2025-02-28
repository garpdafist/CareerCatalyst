import { createClient } from '@supabase/supabase-js';

// Create a promise to track initialization
let initializationPromise: Promise<ReturnType<typeof createClient>> | null = null;

async function initializeSupabase() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error('Failed to fetch Supabase configuration');
    }
    const config = await response.json();

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error('Invalid Supabase configuration received from server');
    }

    // Log configuration status (not the actual values)
    console.log('Supabase Configuration Status:', {
      hasUrl: !!config.supabaseUrl,
      hasAnonKey: !!config.supabaseAnonKey
    });

    return createClient(config.supabaseUrl, config.supabaseAnonKey);
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    throw error;
  }
}

// Initialize on first import
initializationPromise = initializeSupabase();

// Export a function that always returns the initialized client
export async function getSupabase() {
  if (!initializationPromise) {
    initializationPromise = initializeSupabase();
  }
  return initializationPromise;
}

// For backward compatibility
export const supabase = await getSupabase();