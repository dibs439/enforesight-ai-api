/**
 * Utility functions for handling bytes conversion
 */

/**
 * Convert bytes (Buffer) to UTF-8 string
 */
export function bytesToString(data: any): string {
  if (data === null || data === undefined) {
    return '';
  }

  if (typeof data === 'string') {
    return data;
  }

  if (Buffer.isBuffer(data)) {
    return data.toString('utf-8');
  }

  if (data instanceof Uint8Array) {
    return Buffer.from(data).toString('utf-8');
  }

  return String(data);
}

/**
 * Convert string to bytes (Buffer)
 */
export function stringToBytes(data: any): Buffer | undefined {
  if (data === null || data === undefined || data === '') {
    return undefined;
  }

  if (Buffer.isBuffer(data)) {
    return data;
  }

  if (typeof data === 'string') {
    return Buffer.from(data, 'utf-8');
  }

  return Buffer.from(String(data), 'utf-8');
}

/**
 * Ensure data is a string, converting from bytes if necessary
 */
export function ensureString(data: any): string {
  return bytesToString(data);
}

/**
 * Ensure data is bytes, converting from string if necessary
 */
export function ensureBytes(data: any): Buffer | undefined {
  return stringToBytes(data);
}
