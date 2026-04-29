import fs from 'fs';
import http from 'http';
import https from 'https';
import { logger } from './logger';

// Set up Node.js Canvas polyfills for pdfjs-dist
let pdfjsSetupDone = false;

async function setupPdfjsNodeEnvironment() {
  if (pdfjsSetupDone) return;

  try {
    const _canvas = await import('canvas');

    // Polyfill DOMMatrix if not available
    // @ts-ignore - Polyfilling global DOM types in Node.js
    if (typeof globalThis.DOMMatrix === 'undefined') {
      // @ts-ignore
      globalThis.DOMMatrix = class DOMMatrix {
        constructor(init?: string | number[]) {
          if (typeof init === 'string') {
            // Parse matrix string - simplified implementation
            this.a = 1;
            this.b = 0;
            this.c = 0;
            this.d = 1;
            this.e = 0;
            this.f = 0;
          } else if (Array.isArray(init)) {
            [
              this.a = 1,
              this.b = 0,
              this.c = 0,
              this.d = 1,
              this.e = 0,
              this.f = 0,
            ] = init;
          } else {
            this.a = 1;
            this.b = 0;
            this.c = 0;
            this.d = 1;
            this.e = 0;
            this.f = 0;
          }
        }
        a = 1;
        b = 0;
        c = 0;
        d = 1;
        e = 0;
        f = 0;

        translate(tx: number, ty: number) {
          return new DOMMatrix([
            this.a,
            this.b,
            this.c,
            this.d,
            this.e + tx,
            this.f + ty,
          ]);
        }

        scale(sx: number, sy?: number) {
          const scaleY = sy ?? sx;
          return new DOMMatrix([
            this.a * sx,
            this.b * sx,
            this.c * scaleY,
            this.d * scaleY,
            this.e,
            this.f,
          ]);
        }

        transform(
          a2: number,
          b2: number,
          c2: number,
          d2: number,
          e2: number,
          f2: number
        ) {
          return new DOMMatrix([
            this.a * a2 + this.c * b2,
            this.b * a2 + this.d * b2,
            this.a * c2 + this.c * d2,
            this.b * c2 + this.d * d2,
            this.a * e2 + this.c * f2 + this.e,
            this.b * e2 + this.d * f2 + this.f,
          ]);
        }
      };
    }

    pdfjsSetupDone = true;
  } catch (error) {
    logger.warn({ err: error }, 'Failed to set up pdfjs Node.js environment');
  }
}

/**
 * Fetch PDF from URL and extract plain text content
 * @param url - URL of the PDF file
 * @returns Promise<string> - Plain text content extracted from PDF
 */
export async function fetchPdfAsText(url: string): Promise<string> {
  // Set up the environment before first use
  await setupPdfjsNodeEnvironment();
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    protocol
      .get(url, response => {
        // Check if response is successful
        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Failed to fetch PDF: HTTP ${response.statusCode} - ${response.statusMessage}`
            )
          );
          return;
        }

        // Check content type
        const contentType = response.headers['content-type'];
        if (contentType && !contentType.includes('application/pdf')) {
          logger.warn({ contentType }, 'Unexpected Content-Type, expected application/pdf');
        }

        const chunks: Buffer[] = [];

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        response.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);

            // Verify it's a PDF by checking magic number
            const pdfHeader = buffer.slice(0, 5).toString();
            if (!pdfHeader.startsWith('%PDF-')) {
              reject(
                new Error(
                  'Invalid PDF file: does not start with PDF magic number'
                )
              );
              return;
            }

            // Parse PDF and extract text using pdfjs-dist
            try {
              // Use Function constructor to prevent TypeScript/CommonJS from transpiling
              // the dynamic import to require() — safe because the module path is a static string.
              const importDynamic = new Function('m', 'return import(m)');
              const pdfjs = await importDynamic('pdfjs-dist/legacy/build/pdf.mjs');

              const uint8Array = new Uint8Array(buffer);
              const loadingTask = pdfjs.getDocument({
                data: uint8Array,
                useSystemFonts: true,
              });

              const pdfDocument = await loadingTask.promise;
              const numPages = pdfDocument.numPages;
              const textParts: string[] = [];

              // Extract text from each page
              for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                  .map((item: any) => item.str)
                  .join(' ');
                textParts.push(pageText);
              }

              const fullText = textParts.join('\n\n').trim();

              if (!fullText) {
                logger.warn('PDF parsed successfully but no text content found');
              }

              resolve(fullText);
            } catch (parseError) {
              reject(
                new Error(
                  `Failed to parse PDF: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`
                )
              );
            }
          } catch (error) {
            reject(
              new Error(
                `Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
              )
            );
          }
        });

        response.on('error', error => {
          reject(
            new Error(`Network error while fetching PDF: ${error.message}`)
          );
        });
      })
      .on('error', error => {
        reject(new Error(`Failed to fetch PDF from URL: ${error.message}`));
      });
  });
}

/**
 * Fetch PDF with timeout and retry logic
 * @param url - URL of the PDF file
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @param retries - Number of retry attempts (default: 2)
 * @returns Promise<string> - Plain text content extracted from PDF
 */
export async function fetchPdfWithRetry(
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
          reject(new Error(`PDF fetch timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Race between fetch and timeout
      const textData = await Promise.race([
        fetchPdfAsText(url),
        timeoutPromise,
      ]);

      return textData;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.error({ err: lastError, attempt: attempt + 1 }, `PDF fetch attempt ${attempt + 1}/${retries + 1} failed`);

      // Don't retry if it's a 404 or similar client error
      if (
        lastError.message.includes('HTTP 4') ||
        lastError.message.includes('Invalid PDF')
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

  throw lastError || new Error('Failed to fetch PDF after all retries');
}

/**
 * Parse local PDF file and extract plain text content
 * @param filePath - Path to the local PDF file
 * @returns Promise<string> - Plain text content extracted from PDF
 */
export async function parseLocalPdf(filePath: string): Promise<string> {
  // Set up the environment before first use
  await setupPdfjsNodeEnvironment();

  return new Promise((resolve, reject) => {
    try {
      // Read the PDF file from the local filesystem
      const buffer = fs.readFileSync(filePath);

      // Verify it's a PDF by checking magic number
      const pdfHeader = buffer.slice(0, 5).toString();
      if (!pdfHeader.startsWith('%PDF-')) {
        reject(
          new Error('Invalid PDF file: does not start with PDF magic number')
        );
        return;
      }

      // Parse PDF and extract text using pdfjs-dist
      const parsePdfBuffer = async () => {
        try {
          // Use Function constructor to prevent TypeScript/CommonJS from transpiling
          // the dynamic import to require() — safe because the module path is a static string.
          const importDynamic = new Function('m', 'return import(m)');
          const pdfjs = await importDynamic('pdfjs-dist/legacy/build/pdf.mjs');

          const uint8Array = new Uint8Array(buffer);
          const loadingTask = pdfjs.getDocument({
            data: uint8Array,
            useSystemFonts: true,
          });

          const pdfDocument = await loadingTask.promise;
          const numPages = pdfDocument.numPages;
          const textParts: string[] = [];

          // Extract text from each page
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDocument.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            textParts.push(pageText);
          }

          const fullText = textParts.join('\n\n').trim();

          if (!fullText) {
            logger.warn('PDF parsed successfully but no text content found');
          }

          resolve(fullText);
        } catch (parseError) {
          reject(
            new Error(
              `Failed to parse PDF: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}`
            )
          );
        }
      };

      parsePdfBuffer();
    } catch (error) {
      if (error instanceof Error && (error as any).code === 'ENOENT') {
        reject(new Error(`PDF file not found: ${filePath}`));
      } else {
        reject(
          new Error(
            `Failed to read PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    }
  });
}

/**
 * Validate if a string is a valid URL
 * @param url - URL string to validate
 * @returns boolean
 */
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}
