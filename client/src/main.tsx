import { createRoot } from "react-dom/client";
import App from "./App";
import "./global.css";
import "./index.css";

// Dynamically ensure CSP is properly applied to allow Supabase connections
// This is a fallback in case the meta tag or server headers aren't properly processed
function ensureCSPAllowsSupabase() {
  try {
    // Check if there's already a CSP meta tag
    const existingCspTag = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    
    // If no tag exists or we want to ensure it has the right content
    if (!existingCspTag) {
      console.log('No CSP meta tag found - adding programmatically');
      
      // Create and add a CSP meta tag with the right permissions
      const cspMetaTag = document.createElement('meta');
      cspMetaTag.httpEquiv = 'Content-Security-Policy';
      cspMetaTag.content = "default-src 'self'; connect-src 'self' https://*.supabase.co https://*.supabase.in " +
        "https://api.supabase.com https://api.supabase.io https://identity.supabase.com " + 
        "https://pwiysqqirjnjqacevzfp.supabase.co wss://*.supabase.co https://api.openai.com " +
        "https://*.algolia.net https://*.algolia.com data: blob:; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "font-src 'self' https://fonts.gstatic.com data:; " +
        "img-src 'self' data: https: blob:; " +
        "object-src 'none'; " +
        "media-src 'self'";
      
      // Add it to the head
      document.head.appendChild(cspMetaTag);
      console.log('CSP meta tag added programmatically');
    } else {
      console.log('CSP meta tag already exists');
      
      // Check if the existing tag includes Supabase domains
      const content = existingCspTag.getAttribute('content') || '';
      if (!content.includes('supabase.co')) {
        console.warn('Existing CSP meta tag does not include Supabase domains');
      }
    }
  } catch (error) {
    console.error('Error setting up CSP:', error);
  }
}

// Run the CSP check early in the application lifecycle
ensureCSPAllowsSupabase();

// Render the application
createRoot(document.getElementById("root")!).render(<App />);
