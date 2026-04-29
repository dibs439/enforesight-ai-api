process.env.NODE_ENV = 'test';

// Mock node built-ins at module level so properties are configurable
jest.mock('https');
jest.mock('http');
// pdfUtils is dynamically imported by fetchUrlContentWithRetry — mock it entirely
jest.mock('../../utils/pdfUtils', () => ({
  fetchPdfWithRetry: jest.fn(),
}));

import { EventEmitter } from 'events';
import * as http from 'http';
import * as https from 'https';
import { fetchPdfWithRetry } from '../../utils/pdfUtils';
import { fetchUrlContentWithRetry, fetchWebPageContent, isPdfUrl } from '../../utils/webUtils';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeFakeReq() {
  const req = new EventEmitter() as any;
  req.end = jest.fn();
  req.destroy = jest.fn();
  req.setTimeout = jest.fn();
  return req;
}

function makeFakeRes(statusCode: number, contentType: string, body = '') {
  const res = new EventEmitter() as any;
  res.statusCode = statusCode;
  res.statusMessage = statusCode === 200 ? 'OK' : 'Error';
  res.headers = { 'content-type': contentType };
  res._body = body;
  return res;
}

/** Call after the consumer has had a chance to attach listeners */
function emitBody(res: any) {
  process.nextTick(() => {
    res.emit('data', Buffer.from(res._body || ''));
    res.emit('end');
  });
}

const mockHttpsRequest = https.request as jest.Mock;
const mockHttpsGet = https.get as jest.Mock;
const mockHttpGet = http.get as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── isPdfUrl ─────────────────────────────────────────────────────────────────

describe('utils/webUtils - isPdfUrl', () => {
  it('returns true immediately for a URL containing .pdf (no network call)', async () => {
    await expect(isPdfUrl('https://example.com/report.pdf')).resolves.toBe(true);
    expect(mockHttpsRequest).not.toHaveBeenCalled();
  });

  it('returns true for a URL with .PDF in uppercase', async () => {
    await expect(isPdfUrl('https://example.com/REPORT.PDF?v=1')).resolves.toBe(true);
  });

  it('returns true when HEAD response content-type is application/pdf', async () => {
    const fakeReq = makeFakeReq();
    const fakeRes = makeFakeRes(200, 'application/pdf');
    mockHttpsRequest.mockImplementation((_url: any, _opts: any, cb?: any) => {
      if (cb) process.nextTick(() => cb(fakeRes));
      return fakeReq;
    });

    await expect(isPdfUrl('https://example.com/doc')).resolves.toBe(true);
  });

  it('returns false when HEAD response content-type is text/html', async () => {
    const fakeReq = makeFakeReq();
    const fakeRes = makeFakeRes(200, 'text/html; charset=utf-8');
    mockHttpsRequest.mockImplementation((_url: any, _opts: any, cb?: any) => {
      if (cb) process.nextTick(() => cb(fakeRes));
      return fakeReq;
    });

    await expect(isPdfUrl('https://example.com/page')).resolves.toBe(false);
  });

  it('returns false on network error', async () => {
    const fakeReq = makeFakeReq();
    mockHttpsRequest.mockImplementation((_url: any, _opts: any, _cb?: any) => {
      process.nextTick(() => fakeReq.emit('error', new Error('ECONNREFUSED')));
      return fakeReq;
    });

    await expect(isPdfUrl('https://unreachable.example.com/doc')).resolves.toBe(false);
  });
});

// ─── fetchWebPageContent ──────────────────────────────────────────────────────

describe('utils/webUtils - fetchWebPageContent', () => {
  it('extracts text from HTML returned by the server', async () => {
    const html = '<html><head><title>Test</title></head><body><p>Hello world</p></body></html>';
    const fakeRes = makeFakeRes(200, 'text/html', html);
    mockHttpsGet.mockImplementation((_url: any, cb?: any) => {
      if (cb) process.nextTick(() => { cb(fakeRes); emitBody(fakeRes); });
      return new EventEmitter() as any;
    });

    const text = await fetchWebPageContent('https://example.com/page');
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('rejects when server returns a non-200 status', async () => {
    const fakeRes = makeFakeRes(404, 'text/html', 'Not Found');
    mockHttpsGet.mockImplementation((_url: any, cb?: any) => {
      if (cb) process.nextTick(() => { cb(fakeRes); emitBody(fakeRes); });
      return new EventEmitter() as any;
    });

    await expect(fetchWebPageContent('https://example.com/missing')).rejects.toThrow('404');
  });
});

// ─── fetchUrlContentWithRetry ─────────────────────────────────────────────────

describe('utils/webUtils - fetchUrlContentWithRetry', () => {
  it('fetches a web page and returns its text content', async () => {
    const html = '<body><p>Regulation text</p></body>';
    const fakeRes = makeFakeRes(200, 'text/html', html);
    // isPdfUrl will make a HEAD request — return non-pdf content-type
    const fakeHeadReq = makeFakeReq();
    const fakeHeadRes = makeFakeRes(200, 'text/html');
    mockHttpsRequest.mockImplementation((_url: any, _opts: any, cb?: any) => {
      if (cb) process.nextTick(() => cb(fakeHeadRes));
      return fakeHeadReq;
    });
    mockHttpsGet.mockImplementation((_url: any, cb?: any) => {
      if (cb) process.nextTick(() => { cb(fakeRes); emitBody(fakeRes); });
      return new EventEmitter() as any;
    });

    const text = await fetchUrlContentWithRetry('https://example.com/page', 5000, 0);
    expect(text).toContain('Regulation text');
  });

  it('fetches PDF content via fetchPdfWithRetry when URL resolves to PDF', async () => {
    (fetchPdfWithRetry as jest.Mock).mockResolvedValue('Extracted PDF text');
    // Make isPdfUrl return true via URL extension (no network needed)
    const text = await fetchUrlContentWithRetry('https://example.com/doc.pdf', 5000, 0);
    expect(text).toBe('Extracted PDF text');
    expect(fetchPdfWithRetry).toHaveBeenCalled();
  });

  it('throws immediately on HTTP 4xx without retrying', async () => {
    const fakeRes = makeFakeRes(404, 'text/html', 'Not Found');
    // isPdfUrl HEAD request — non-pdf
    const fakeHeadReq = makeFakeReq();
    const fakeHeadRes = makeFakeRes(200, 'text/html');
    mockHttpsRequest.mockImplementation((_url: any, _opts: any, cb?: any) => {
      if (cb) process.nextTick(() => cb(fakeHeadRes));
      return fakeHeadReq;
    });
    mockHttpsGet.mockImplementation((_url: any, cb?: any) => {
      if (cb) process.nextTick(() => { cb(fakeRes); emitBody(fakeRes); });
      return new EventEmitter() as any;
    });

    await expect(
      fetchUrlContentWithRetry('https://example.com/missing', 5000, 0)
    ).rejects.toThrow('HTTP 4');
  });

  it('uses http module for http:// URLs', async () => {
    const html = '<body><p>HTTP page</p></body>';
    const fakeRes = makeFakeRes(200, 'text/html', html);
    // isPdfUrl uses https.request for HEAD — but URL is http:// so it uses http.request
    const fakeHeadReq = makeFakeReq();
    const fakeHeadRes = makeFakeRes(200, 'text/html');
    (http.request as jest.Mock).mockImplementation((_url: any, _opts: any, cb?: any) => {
      if (cb) process.nextTick(() => cb(fakeHeadRes));
      return fakeHeadReq;
    });
    mockHttpGet.mockImplementation((_url: any, cb?: any) => {
      if (cb) process.nextTick(() => { cb(fakeRes); emitBody(fakeRes); });
      return new EventEmitter() as any;
    });

    const text = await fetchUrlContentWithRetry('http://example.com/page', 5000, 0);
    expect(text).toContain('HTTP page');
  });
});
