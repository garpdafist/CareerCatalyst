import fs from 'fs';
import { PDFExtract } from 'pdf.js-extract';
import { createRequire } from 'module';

// Fix for pdf-parse module that uses CommonJS
const require = createRequire(import.meta.url);

// Create an empty directory structure that pdf-parse tries to access
try {
  if (!fs.existsSync('./test')) {
    fs.mkdirSync('./test');
  }
  if (!fs.existsSync('./test/data')) {
    fs.mkdirSync('./test/data');
  }
  if (!fs.existsSync('./test/data/05-versions-space.pdf')) {
    fs.writeFileSync('./test/data/05-versions-space.pdf', 'dummy content');
  }
} catch (error) {
  console.warn('Failed to create directories for pdf-parse:', error);
}

// Import the pdf-parse module
let pdfParse: any;
try {
  pdfParse = require('pdf-parse');
} catch (error) {
  console.error('Error importing pdf-parse:', error);
  // Fallback implementation if import fails
  pdfParse = async (dataBuffer: Buffer) => ({
    text: 'PDF parsing unavailable',
    numpages: 0
  });
}

// Create a singleton instance
const pdfExtract = new PDFExtract();

// Parser timeout constants
const PDF_PARSING_TIMEOUT = 30000; // 30 seconds max for parsing
const FALLBACK_TIMEOUT = 15000; // 15 seconds for fallback parsing

interface ParseOptions {
  cleanText?: boolean; // Whether to clean the extracted text
  timeout?: number; // Custom timeout in milliseconds
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
 * Enhanced PDF parser service with robust error handling, timeouts, and multiple fallback methods
 */
export async function parsePdf(pdfBuffer: Buffer, options: ParseOptions = {}): Promise<string> {
  const requestId = Math.random().toString(36).substring(2, 8);
  const startTime = Date.now();
  
  console.log(`[${new Date().toISOString()}] [${requestId}] Starting PDF parsing with buffer size: ${pdfBuffer.length} bytes`);
  const { cleanText = true, timeout: customTimeout } = options;
  
  // Try primary parsing method with timeout
  try {
    console.log(`[${new Date().toISOString()}] [${requestId}] Attempting primary PDF parsing method with timeout ${PDF_PARSING_TIMEOUT}ms`);
    
    // Use Promise.race to implement timeout
    const result = await Promise.race([
      pdfExtract.extractBuffer(pdfBuffer),
      timeout(customTimeout || PDF_PARSING_TIMEOUT)
    ]);
    
    console.log(`[${new Date().toISOString()}] [${requestId}] PDF extraction completed in ${Date.now() - startTime}ms`);
    
    const pageCount = result.pages.length;
    console.log(`[${new Date().toISOString()}] [${requestId}] PDF document loaded with ${pageCount} pages`);
    
    // Extract text from each page
    let fullText = '';
    
    for (let i = 0; i < result.pages.length; i++) {
      const page = result.pages[i];
      console.log(`[${new Date().toISOString()}] [${requestId}] Processing page ${i+1}/${pageCount} with ${page.content.length} content items`);
      
      // Extract text content with positioning
      const pageText = page.content
        .map(item => item.str)
        .join(' ');
      
      fullText += pageText + '\n\n';
      console.log(`[${new Date().toISOString()}] [${requestId}] Page ${i+1} text length: ${pageText.length} chars`);
    }
    
    let extractedText = fullText;
    
    if (cleanText) {
      // Clean up the text
      console.log(`[${new Date().toISOString()}] [${requestId}] Cleaning extracted text (length before: ${extractedText.length})`);
      extractedText = cleanPdfText(extractedText);
      console.log(`[${new Date().toISOString()}] [${requestId}] Text cleaned (length after: ${extractedText.length})`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] [${requestId}] PDF parsed successfully in ${duration}ms: ${extractedText.length} chars, ${pageCount} pages`);
    
    // Return a truncated sample for debugging
    const sample = extractedText.substring(0, 100);
    console.log(`[${new Date().toISOString()}] [${requestId}] Text sample: "${sample.replace(/\n/g, ' ')}..."`);
    
    return extractedText;
  } catch (primaryError: any) {
    console.error(`[${new Date().toISOString()}] [${requestId}] Primary PDF parsing method failed after ${Date.now() - startTime}ms:`, {
      message: primaryError.message,
      type: primaryError.constructor.name
    });
    
    // Try fallback method with pdf-parse library
    try {
      console.log(`[${new Date().toISOString()}] [${requestId}] Attempting fallback PDF parsing method with timeout ${FALLBACK_TIMEOUT}ms`);
      
      // Create an AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, FALLBACK_TIMEOUT);
      
      // Use the pdf-parse library as fallback
      const pdfParseOptions = {
        // Set max pages to parse, lower than default to improve speed
        max: 100
      };
      
      const pdfData = await Promise.race([
        pdfParse(pdfBuffer, pdfParseOptions),
        timeout(FALLBACK_TIMEOUT)
      ]);
      
      clearTimeout(timeoutId);
      
      let extractedText = pdfData.text || '';
      console.log(`[${new Date().toISOString()}] [${requestId}] Fallback parsing extracted ${extractedText.length} chars`);
      
      if (cleanText) {
        extractedText = cleanPdfText(extractedText);
        console.log(`[${new Date().toISOString()}] [${requestId}] Fallback text cleaned. Final length: ${extractedText.length} chars`);
      }
      
      const duration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] [${requestId}] Fallback PDF parsing completed in ${duration}ms (total)`);
      
      // Return a sample for debugging
      const sample = extractedText.substring(0, 100);
      console.log(`[${new Date().toISOString()}] [${requestId}] Fallback text sample: "${sample.replace(/\n/g, ' ')}..."`);
      
      return extractedText;
    } catch (fallbackError: any) {
      console.error(`[${new Date().toISOString()}] [${requestId}] All PDF parsing methods failed after ${Date.now() - startTime}ms:`, {
        primaryError: primaryError.message,
        fallbackError: fallbackError.message
      });
      
      // Last resort attempt - try to extract any readable text
      try {
        // Convert Buffer to string and attempt to find any readable text
        const rawText = pdfBuffer.toString('utf-8');
        
        // Simple heuristic to check if we got text or binary garbage
        const readableChars = rawText.replace(/[^\x20-\x7E]/g, '');
        
        if (readableChars.length > pdfBuffer.length * 0.1) { // If at least 10% is readable
          console.log(`[${new Date().toISOString()}] [${requestId}] Using raw text extraction as last resort`);
          
          const extractedText = cleanPdfText(readableChars);
          console.log(`[${new Date().toISOString()}] [${requestId}] Last resort extraction: ${extractedText.length} chars`);
          
          return extractedText;
        }
      } catch (lastResortError) {
        // Ignore any errors, we've already tried our best
      }
      
      // At this point, all methods have failed
      throw new Error(
        `PDF parsing failed: ${primaryError.message}. Fallback method also failed: ${fallbackError.message}`
      );
    }
  }
}

/**
 * Enhanced text cleaning for PDF extracted content
 * - Fixes encoding issues
 * - Normalizes whitespace
 * - Improves resume-specific formatting (bullets, sections, etc.)
 * - Removes garbage characters
 */
function cleanPdfText(text: string): string {
  if (!text) return '';
  
  // Display text sample before cleaning for diagnostics
  const beforeSample = text.substring(0, 50).replace(/\n/g, '\\n');
  console.log(`Text sample before cleaning: "${beforeSample}..."`);
  
  let cleanedText = text
    // Fix common encoding issues
    .replace(/â€™/g, "'")
    .replace(/â€"/g, "-")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€¢/g, '•') // Fix bullet points
    .replace(/Â/g, '') // Remove non-breaking space prefix
    
    // Fix common PDF extraction artifacts
    .replace(/([a-z])- ([a-z])/gi, '$1$2') // Fix hyphenated words
    .replace(/\f/g, '\n\n') // Replace form feeds with double newlines
    
    // Normalize bullets and lists
    .replace(/[•·∙◦⦿⦾◆◇■□●○]/g, '• ') // Standardize bullet points
    .replace(/^\s*[-–—]\s+/gm, '• ') // Convert dashes at start of line to bullets
    .replace(/\n\s*[0-9]+\.\s+/g, '\n• ') // Convert "1. " to bullets
    
    // Fix spacing issues
    .replace(/\s{2,}/g, ' ') // Replace multiple spaces with single space
    .replace(/(\n\s*){3,}/g, '\n\n') // Max 2 consecutive newlines
    
    // Remove control characters and other garbage
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    
    // Improve section formatting (e.g., "EXPERIENCE" or "EDUCATION" sections)
    .replace(/\n([A-Z][A-Z\s]{3,}:?)\s*\n/g, '\n\n$1\n\n') // Add space around ALL CAPS section headers
    
    // Fix email addresses that might have spaces in them
    .replace(/([a-zA-Z0-9._%+-]+)\s+@\s+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1@$2')
    
    // Clean up URLs
    .replace(/(?:https?:\/\/)?(?:www\.)?\s+([a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, 'https://www.$1')
    
    // Remove any leading/trailing whitespace
    .trim();
    
  // Additional resume-specific improvements
  
  // Fix LinkedIn URLs
  cleanedText = cleanedText.replace(/linkedin\.com\s+\/\s+in\s+\/\s+([a-zA-Z0-9-]+)/g, 'linkedin.com/in/$1');
  
  // Fix date ranges
  cleanedText = cleanedText.replace(/(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})\s+[-–—]\s+(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}|Present\b)/gi, '$1 - $2');
  
  // Ensure appropriate spacing after commas
  cleanedText = cleanedText.replace(/,([^\s])/g, ', $1');
  
  // Display text sample after cleaning for comparison
  const afterSample = cleanedText.substring(0, 50).replace(/\n/g, '\\n');
  console.log(`Text sample after cleaning: "${afterSample}..."`);
  
  return cleanedText;
}

/**
 * Extract text from a PDF file path
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