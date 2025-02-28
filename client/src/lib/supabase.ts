import { createClient } from '@supabase/supabase-js';

// Initialize with empty config first
let supabase = createClient('', '');

// Fetch and update configuration
async function initializeSupabase() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error('Failed to fetch Supabase configuration');
    }
    const config = await response.json();
    supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
  }
}

// Initialize on load
initializeSupabase();

export { supabase };