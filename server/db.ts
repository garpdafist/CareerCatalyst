import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon Database client with WebSocket
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized connection pool configuration
// Using connection pooling best practices for serverless environments
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Set reasonable pool limits for a serverless environment
  max: 10, // Maximum number of clients
  min: 2,  // Minimum number of idle clients
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return an error after 5 seconds if connection cannot be established
  // Set statement timeout to prevent long-running queries
  statement_timeout: 10000, // 10 seconds
  // Enable for queries you know will be small and fast
  // These options help with query caching and prepared statements
  // parseInputDatesAsUTC: true,
  // keepAlive: true,
});

// Configure Drizzle with the optimized pool and our schema
export const db = drizzle({ 
  client: pool, 
  schema,
  // Uncomment to enable logging in development (avoid in production)
  // logger: process.env.NODE_ENV !== 'production',
});
