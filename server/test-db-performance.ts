import { db } from "./db";
import { resumeAnalyses, users } from "@shared/schema";
import { eq, gt, desc, sql, asc } from "drizzle-orm";

/**
 * Test script to demonstrate and validate database optimizations
 * 
 * This script tests various query patterns with EXPLAIN ANALYZE
 * to show how our indexes improve query performance
 */
async function testDatabaseOptimizations() {
  console.log("Starting database performance tests...");
  
  try {
    // Test 1: Get recent analyses for a user with limit/offset pagination
    // This should use our composite user_id+created_at index
    console.log("\n1. Testing user analyses query with pagination (using user_time_idx index):");
    const userAnalysesQuery = db.select({
      id: resumeAnalyses.id,
      score: resumeAnalyses.score,
      createdAt: resumeAnalyses.createdAt
    })
    .from(resumeAnalyses)
    .where(eq(resumeAnalyses.userId, "test-user-id"))
    .orderBy(desc(resumeAnalyses.createdAt))
    .limit(10)
    .offset(0);
    
    const userAnalysesExplain = await db.execute(
      sql`EXPLAIN ANALYZE ${userAnalysesQuery}`
    );
    console.log(userAnalysesExplain.rows);
    
    // Test 2: Get single analysis by ID
    // This should use primary key
    console.log("\n2. Testing single analysis query by ID:");
    const singleAnalysisQuery = db.select()
      .from(resumeAnalyses)
      .where(eq(resumeAnalyses.id, 1));
      
    const singleAnalysisExplain = await db.execute(
      sql`EXPLAIN ANALYZE ${singleAnalysisQuery}`
    );
    console.log(singleAnalysisExplain.rows);
    
    // Test 3: Query by email (unique constraint + index)
    console.log("\n3. Testing user lookup by email (using unique constraint + email_idx):");
    const userByEmailQuery = db.select()
      .from(users)
      .where(eq(users.email, "test@example.com"));
      
    const userByEmailExplain = await db.execute(
      sql`EXPLAIN ANALYZE ${userByEmailQuery}`
    );
    console.log(userByEmailExplain.rows);
    
    // Test 4: Filter analyses by score range
    // Should use score_idx
    console.log("\n4. Testing analyses by score range (using score_idx):");
    const scoreRangeQuery = db.select({
      id: resumeAnalyses.id,
      score: resumeAnalyses.score,
    })
    .from(resumeAnalyses)
    .where(gt(resumeAnalyses.score, 70))
    .orderBy(desc(resumeAnalyses.score))
    .limit(20);
    
    const scoreRangeExplain = await db.execute(
      sql`EXPLAIN ANALYZE ${scoreRangeQuery}`
    );
    console.log(scoreRangeExplain.rows);
    
    // Test 5: Order recent users by login date
    // Should use last_login_idx
    console.log("\n5. Testing recent users by login date (using last_login_idx):");
    const recentLoginsQuery = db.select({
      id: users.id,
      email: users.email,
      lastLoginAt: users.lastLoginAt
    })
    .from(users)
    .where(
      sql`${users.lastLoginAt} > NOW() - INTERVAL '7 days'`
    )
    .orderBy(desc(users.lastLoginAt))
    .limit(50);
    
    const recentLoginsExplain = await db.execute(
      sql`EXPLAIN ANALYZE ${recentLoginsQuery}`
    );
    console.log(recentLoginsExplain.rows);
    
    console.log("\nCompleted database performance tests");
  } catch (error) {
    console.error("Error during database performance tests:", error);
  }
}

// Run tests when executed directly with ESM
// In ESM, there's no direct "require.main === module" equivalent
// so we'll just check if this file is being run directly
const isMainModule = import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  testDatabaseOptimizations()
    .then(() => {
      console.log("Tests completed, exiting");
      process.exit(0);
    })
    .catch(error => {
      console.error("Error running tests:", error);
      process.exit(1);
    });
}

export { testDatabaseOptimizations };