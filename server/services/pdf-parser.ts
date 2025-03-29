/**
 * Enhanced PDF Parser Service
 * 
 * This service provides robust PDF text extraction with:
 * - Multiple parsing methods with automatic fallback
 * - Timeout handling to prevent hanging
 * - Resume-specific text cleaning
 * - Detailed logging and error recovery
 * 
 * It uses a single primary library (pdf.js-extract) with a fallback (pdf-parse)
 * to ensure reliable text extraction across different PDF formats.
 */

import fs from 'fs';
import { PDFExtract } from 'pdf.js-extract';
import { createRequire } from 'module';
import crypto from 'crypto';

// Basic caching for parsed PDFs
interface CacheEntry {
  timestamp: number;
  text: string;
}
const pdfCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour cache TTL

// Fix for pdf-parse module that uses CommonJS
const require = createRequire(import.meta.url);

// Create a singleton instance of PDFExtract
const pdfExtract = new PDFExtract();

// Import the pdf-parse module as fallback
let pdfParse: any;
try {
  // Create necessary directories for pdf-parse
  if (!fs.existsSync('./test')) fs.mkdirSync('./test');
  if (!fs.existsSync('./test/data')) fs.mkdirSync('./test/data');
  if (!fs.existsSync('./test/data/05-versions-space.pdf')) {
    fs.writeFileSync('./test/data/05-versions-space.pdf', 'dummy content');
  }
  
  // Import the module
  pdfParse = require('pdf-parse');
} catch (error) {
  console.error('Error setting up pdf-parse:', error);
  // Fallback implementation if import fails
  pdfParse = async (dataBuffer: Buffer) => ({
    text: 'PDF parsing unavailable',
    numpages: 0
  });
}

// Parser timeout constants
const DEFAULT_TIMEOUT = 25000;        // 25 seconds default timeout
const FALLBACK_TIMEOUT = 15000;       // 15 seconds for fallback parsing

/**
 * Options for PDF parsing
 */
export interface ParseOptions {
  /** Whether to clean and normalize the extracted text (default: true) */
  cleanText?: boolean;
  
  /** Custom timeout in milliseconds (default: 25000ms) */
  timeout?: number;
  
  /** Whether to use cache for previously parsed PDFs (default: true) */
  useCache?: boolean;
}

/**
 * Creates a promise that resolves after the specified time
 */
function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`PDF parsing timed out after ${ms}ms`));
    }, ms);
  });
}

/**
 * Calculate MD5 hash for buffer to use as cache key
 */
function createMD5Hash(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Enhanced PDF parser with robust error handling, timeouts, and fallback methods
 * 
 * @param pdfBuffer The PDF file as a buffer
 * @param options Parsing options
 * @returns Extracted text from the PDF
 */
export async function parsePdf(pdfBuffer: Buffer, options: ParseOptions = {}): Promise<string> {
  const requestId = Math.random().toString(36).substring(2, 8);
  const startTime = Date.now();
  
  // Extract options with defaults
  const { 
    cleanText = true, 
    timeout: customTimeout = DEFAULT_TIMEOUT,
    useCache = true
  } = options;
  
  console.log(`[${new Date().toISOString()}] [${requestId}] Starting PDF parsing with buffer size: ${pdfBuffer.length} bytes`);
  
  // Check cache if enabled
  if (useCache) {
    const cacheKey = createMD5Hash(pdfBuffer);
    const cachedResult = pdfCache.get(cacheKey);
    
    if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL) {
      console.log(`[${new Date().toISOString()}] [${requestId}] Using cached PDF extraction from ${new Date(cachedResult.timestamp).toISOString()}`);
      return cachedResult.text;
    }
  }
  
  // Try primary parsing method with timeout
  try {
    console.log(`[${new Date().toISOString()}] [${requestId}] Attempting primary PDF parsing with timeout ${customTimeout}ms`);
    
    // Use Promise.race to implement timeout
    const result = await Promise.race([
      pdfExtract.extractBuffer(pdfBuffer),
      timeout(customTimeout)
    ]);
    
    console.log(`[${new Date().toISOString()}] [${requestId}] PDF extraction completed in ${Date.now() - startTime}ms`);
    
    // Extract text from each page
    let fullText = '';
    const pageCount = result.pages.length;
    
    for (let i = 0; i < pageCount; i++) {
      const page = result.pages[i];
      const pageText = page.content.map(item => item.str).join(' ');
      fullText += pageText + '\n\n';
    }
    
    // Clean the text if requested
    let extractedText = fullText;
    if (cleanText) {
      extractedText = cleanPdfText(extractedText);
    }
    
    // Cache the result if caching is enabled
    if (useCache) {
      const cacheKey = createMD5Hash(pdfBuffer);
      pdfCache.set(cacheKey, {
        timestamp: Date.now(),
        text: extractedText
      });
    }
    
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] [${requestId}] PDF parsed successfully in ${duration}ms: ${extractedText.length} chars, ${pageCount} pages`);
    
    return extractedText;
  } catch (primaryError: any) {
    console.error(`[${new Date().toISOString()}] [${requestId}] Primary PDF parsing failed:`, {
      message: primaryError.message,
      type: primaryError.constructor.name
    });
    
    // Try fallback method with pdf-parse library
    try {
      console.log(`[${new Date().toISOString()}] [${requestId}] Attempting fallback PDF parsing with timeout ${FALLBACK_TIMEOUT}ms`);
      
      // Use the pdf-parse library as fallback with timeout
      const pdfData = await Promise.race([
        pdfParse(pdfBuffer, { max: 100 }),
        timeout(FALLBACK_TIMEOUT)
      ]);
      
      let extractedText = pdfData.text || '';
      if (cleanText) {
        extractedText = cleanPdfText(extractedText);
      }
      
      // Cache the result if caching is enabled
      if (useCache) {
        const cacheKey = createMD5Hash(pdfBuffer);
        pdfCache.set(cacheKey, {
          timestamp: Date.now(),
          text: extractedText
        });
      }
      
      const duration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] [${requestId}] Fallback PDF parsing completed in ${duration}ms`);
      
      return extractedText;
    } catch (fallbackError: any) {
      console.error(`[${new Date().toISOString()}] [${requestId}] All PDF parsing methods failed:`, {
        primaryError: primaryError.message,
        fallbackError: fallbackError.message
      });
      
      // Last resort - try to extract any readable text
      try {
        const rawText = pdfBuffer.toString('utf-8');
        const readableChars = rawText.replace(/[^\x20-\x7E]/g, '');
        
        if (readableChars.length > pdfBuffer.length * 0.1) {
          console.log(`[${new Date().toISOString()}] [${requestId}] Using raw text extraction as last resort`);
          const extractedText = cleanText ? cleanPdfText(readableChars) : readableChars;
          return extractedText;
        }
      } catch (lastResortError) {
        // Ignore errors in last resort method
      }
      
      // At this point, all methods have failed
      throw new Error(`PDF parsing failed: ${primaryError.message}. Fallback also failed: ${fallbackError.message}`);
    }
  }
}

/**
 * Enhanced text cleaning optimized for resume content
 * 
 * @param text Raw text from PDF
 * @returns Cleaned and normalized text
 */
function cleanPdfText(text: string): string {
  if (!text) return '';
  
  let cleanedText = text
    // Fix common encoding issues
    .replace(/â€™/g, "'")
    .replace(/â€"/g, "-")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€¢/g, '•')
    .replace(/Â/g, '')
    
    // Fix common PDF extraction artifacts
    .replace(/([a-z])- ([a-z])/gi, '$1$2')
    .replace(/\f/g, '\n\n')
    
    // Normalize bullets and lists
    .replace(/[•·∙◦⦿⦾◆◇■□●○]/g, '• ')
    .replace(/^\s*[-–—]\s+/gm, '• ')
    .replace(/\n\s*[0-9]+\.\s+/g, '\n• ')
    
    // Fix spacing issues
    .replace(/\s{2,}/g, ' ')
    .replace(/(\n\s*){3,}/g, '\n\n')
    
    // Remove control characters and other garbage
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    
    // Improve section formatting
    .replace(/\n([A-Z][A-Z\s]{3,}:?)\s*\n/g, '\n\n$1\n\n')
    
    // Fix email addresses and URLs
    .replace(/([a-zA-Z0-9._%+-]+)\s+@\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1@$2')
    .replace(/(?:https?:\/\/)?(?:www\.)?\s+([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, 'https://www.$1')
    
    // Resume-specific improvements
    .replace(/linkedin\.com\s+\/\s+in\s+\/\s+([a-zA-Z0-9-]+)/g, 'linkedin.com/in/$1')
    .replace(/(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\s+[-–—]\s+(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|Present\b)/gi, '$1 - $2')
    .replace(/,([^\s])/g, ', $1')
    .trim();
  
  return cleanedText;
}

/**
 * Extract text from a PDF file path
 * 
 * @param filePath Path to the PDF file
 * @param options Parsing options
 * @returns Extracted text from the PDF
 */
export async function parsePdfFile(filePath: string, options: ParseOptions = {}): Promise<string> {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    return await parsePdf(dataBuffer, options);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] PDF file parsing error:`, {
      filePath,
      message: error.message
    });
    throw new Error(`Failed to parse PDF file: ${error.message}`);
  }
}