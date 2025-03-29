/**
 * OpenAI Service
 * 
 * This service handles all interactions with the OpenAI API:
 * - Provides a unified interface for making API calls
 * - Implements rate limiting and retry logic
 * - Handles error scenarios gracefully
 * - Supports response validation with Zod schemas
 */

import OpenAI from "openai";
import { z } from "zod";
import crypto from "crypto";

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Constants for API requests
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 10000;

/**
 * Request queue for rate limiting OpenAI API calls
 */
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private processing = false;
  private lastRequestTime = 0;
  private readonly minRequestInterval = 500; // ms between requests

  /**
   * Add an operation to the queue and process it in order
   */
  async add<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          // Rate limiting with minimum interval between requests
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minRequestInterval) {
            await new Promise(r => setTimeout(r, this.minRequestInterval - timeSinceLastRequest));
          }

          const result = await operation();
          this.lastRequestTime = Date.now();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  /**
   * Process queued operations in order
   */
  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const operation = this.queue.shift();
    if (operation) {
      try {
        await operation();
      } catch (error) {
        console.error("Error in queue processing:", error);
      }
    }

    await this.processQueue();
  }
}

// Create a shared request queue for all OpenAI calls
const requestQueue = new RequestQueue();

// Create MD5 hash for caching purposes
function createMD5Hash(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Enhanced API request with retry logic and exponential backoff
 * 
 * @param operation The async operation to perform
 * @param maxRetries Maximum number of retry attempts
 * @param initialDelay Initial delay in milliseconds before retrying
 * @param timeout Maximum time to wait for operation completion
 * @returns Result of the operation
 */
export async function withExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelay: number = INITIAL_RETRY_DELAY,
  timeout: number = 60000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let canceled = false;
    
    // Set timeout for the whole operation
    const timeoutId = setTimeout(() => {
      canceled = true;
      reject(new Error("Analysis timeout exceeded"));
    }, timeout);
    
    // Execute operation with retries
    const executeWithRetry = async (retryCount: number = 0, delay: number = initialDelay) => {
      if (canceled) return;
      
      try {
        // Add to request queue to manage rate limits
        const result = await requestQueue.add(operation);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error: any) {
        // Handle rate limit errors specifically
        if (error?.status === 429) {
          const retryAfter = parseInt(error.response?.headers?.['retry-after'] || '1', 10);
          const retryMs = (retryAfter || 1) * 1000;
          
          console.warn(`Rate limit hit, retry after ${retryMs}ms`);
          
          if (retryCount < maxRetries) {
            await new Promise(r => setTimeout(r, retryMs)); 
            return executeWithRetry(retryCount + 1, Math.min(retryMs * 2, MAX_RETRY_DELAY));
          }
        }
        
        // If exceeded retries or non-retryable error
        if (retryCount >= maxRetries) {
          clearTimeout(timeoutId);
          reject(error);
          return;
        }
        
        console.warn(`API error (attempt ${retryCount + 1}/${maxRetries}): ${error.message}`);
        // Exponential backoff
        await new Promise(r => setTimeout(r, delay));
        return executeWithRetry(retryCount + 1, Math.min(delay * 2, MAX_RETRY_DELAY));
      }
    };
    
    executeWithRetry();
  });
}

/**
 * Resume analysis response type
 */
export type ResumeAnalysisResponse = {
  score: number;
  scores: {
    keywordsRelevance: {
      score: number;
      maxScore: 10;
      feedback: string;
      keywords: string[];
    };
    achievementsMetrics: {
      score: number;
      maxScore: 10;
      feedback: string;
      highlights: string[];
    };
    structureReadability: {
      score: number;
      maxScore: 10;
      feedback: string;
    };
    summaryClarity: {
      score: number;
      maxScore: 10;
      feedback: string;
    };
    overallPolish: {
      score: number;
      maxScore: 10;
      feedback: string;
    };
  };
  identifiedSkills: string[];
  primaryKeywords: string[];
  suggestedImprovements: string[];
  generalFeedback: {
    overall: string;
  };
  jobAnalysis?: {
    alignmentAndStrengths: string[];
    gapsAndConcerns: string[];
    recommendationsToTailor: string[];
    overallFit: string;
  };
};

export { openai, requestQueue };