import http from 'http';
import https from 'https';
import { logger } from './logger';

/**
 * Check if URL points to a PDF file based on URL pattern or response headers
 * @param url - URL to check
 * @returns Promise<boolean> - true if URL is likely a PDF
 */
export async function isPdfUrl(url: string): Promise<boolean> {
  // Check URL extension first
  if (url.toLowerCase().includes('.pdf')) {
    return true;
  }

  // Make a HEAD request to check content-type
  return new Promise(resolve => {
    const protocol = url.startsWith('https') ? https : http;

    try {
      const request = protocol.request(url, { method: 'HEAD' }, response => {
        const contentType = response.headers['content-type'];
        resolve(contentType?.includes('application/pdf') || false);
      });

      request.on('error', () => {
        resolve(false);
      });

      request.setTimeout(5000, () => {
        request.destroy();
        resolve(false);
      });

      request.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Fetch and extract text content from a web page
 * @param url - URL of the web page
 * @returns Promise<string> - Text content extracted from the page
 */
export async function fetchWebPageContent(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol
      .get(url, response => {
        // Check if response is successful
        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Failed to fetch web page: HTTP ${response.statusCode} - ${response.statusMessage}`
            )
          );
          return;
        }

        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on('end', () => {
          try {
            const html = Buffer.concat(chunks).toString('utf-8');

            // Extract text content from HTML
            const textContent = extractTextFromHtml(html);

            if (!textContent.trim()) {
              logger.warn('Web page parsed but no text content found');
            }

            resolve(textContent);
          } catch (error) {
            reject(
              new Error(
                `Failed to process web page content: ${
                  error instanceof Error ? error.message : 'Unknown error'
                }`
              )
            );
          }
        });

        response.on('error', error => {
          reject(
            new Error(`Network error while fetching web page: ${error.message}`)
          );
        });
      })
      .on('error', error => {
        reject(new Error(`Failed to fetch web page: ${error.message}`));
      });
  });
}

/**
 * Extract text content from HTML string
 * @param html - HTML content
 * @returns string - Extracted text content
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags and their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');

  // Remove all HTML tags
  text = text.replace(/<[^>]*>/g, ' ');

  // Decode HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, '\n\n') // Remove empty lines with just spaces
    .trim();

  return text;
}

/**
 * Fetch content with timeout and retry logic for both PDFs and web pages
 * @param url - URL to fetch
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @param retries - Number of retry attempts (default: 2)
 * @returns Promise<string> - Text content extracted
 */
export async function fetchUrlContentWithRetry(
  url: string,
  timeoutMs: number = 30000,
  retries: number = 2
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`URL fetch timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Check if it's a PDF or web page and fetch accordingly
      const isPdf = await isPdfUrl(url);

      let textData: string;

      if (isPdf) {
        // Use require to avoid ESM dynamic import in CJS context
         
        const { fetchPdfWithRetry } = require('./pdfUtils') as typeof import('./pdfUtils');
        textData = await Promise.race([
          fetchPdfWithRetry(url, timeoutMs, 0), // No retry here since we handle retries in this function
          timeoutPromise,
        ]);
      } else {
        // Fetch as web page
        textData = await Promise.race([
          fetchWebPageContent(url),
          timeoutPromise,
        ]);
      }

      return textData;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.error({ err: lastError, attempt: attempt + 1 }, `URL fetch attempt ${attempt + 1}/${retries + 1} failed`);

      // Don't retry if it's a 404 or similar client error
      if (
        lastError.message.includes('HTTP 4') ||
        lastError.message.includes('Invalid')
      ) {
        throw lastError;
      }

      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        const waitTime = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error('Failed to fetch URL content after all retries');
}
