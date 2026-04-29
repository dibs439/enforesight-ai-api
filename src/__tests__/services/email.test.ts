import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock nodemailer before any imports that use it
jest.mock('nodemailer');

import nodemailer from 'nodemailer';
import { EmailService } from '../../services/email.service';

// Stable mock functions shared across all tests
const mockSendMail = jest.fn();
const mockVerify = jest.fn();

// Wire up transporter mock before any test runs
(nodemailer.createTransport as jest.Mock).mockReturnValue({
  sendMail: mockSendMail,
  verify: mockVerify,
});

beforeEach(() => {
  jest.clearAllMocks();
  // Re-wire after clearAllMocks (mockReturnValue is cleared by clearAllMocks)
  (nodemailer.createTransport as jest.Mock).mockReturnValue({
    sendMail: mockSendMail,
    verify: mockVerify,
  });
});

describe('EmailService', () => {
  describe('sendActivationEmail', () => {
    it('sends activation email and returns info with correct fields', async () => {
      const fakeInfo = { messageId: 'msg-001' };
      mockSendMail.mockResolvedValueOnce(fakeInfo as never);

      const service = new EmailService();
      const result = await service.sendActivationEmail(
        'user@example.com',
        'token-abc',
        'Alice'
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.to).toBe('user@example.com');
      expect(callArg.subject).toBe('Activate Your Enforesight Account');
      expect(typeof callArg.html).toBe('string');
      expect((callArg.html as string)).toContain('Alice');
      expect(result).toEqual(fakeInfo);
    });

    it('includes activation token and frontend URL in email body', async () => {
      process.env.FRONTEND_URL = 'https://app.example.com';
      mockSendMail.mockResolvedValueOnce({ messageId: 'x' } as never);

      const service = new EmailService();
      await service.sendActivationEmail('u@e.com', 'CODE123', 'Bob');

      const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
      expect((callArg.html as string)).toContain('CODE123');
      expect((callArg.html as string)).toContain('https://app.example.com');
    });

    it('throws "Failed to send activation email" when sendMail rejects', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection refused') as never);

      const service = new EmailService();
      await expect(
        service.sendActivationEmail('user@example.com', 'token', 'Alice')
      ).rejects.toThrow('Failed to send activation email');
    });
  });

  describe('sendActivationEmailWithPassword', () => {
    it('sends activation-with-password email and returns info', async () => {
      const fakeInfo = { messageId: 'msg-002' };
      mockSendMail.mockResolvedValueOnce(fakeInfo as never);

      const service = new EmailService();
      const result = await service.sendActivationEmailWithPassword(
        'user@example.com',
        'token-xyz',
        'Carol',
        'supersecretpassword'
      );

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      const callArg = mockSendMail.mock.calls[0][0] as Record<string, unknown>;
      expect(callArg.to).toBe('user@example.com');
      expect(callArg.subject).toBe('Welcome to Enforesight - Activate Your Admin Account');
      expect((callArg.html as string)).toContain('Carol');
      // Password must NOT appear in email body — security requirement
      expect((callArg.html as string)).not.toContain('supersecretpassword');
      expect(result).toEqual(fakeInfo);
    });

    it('throws "Failed to send activation email with password" when sendMail rejects', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('connection timeout') as never);

      const service = new EmailService();
      await expect(
        service.sendActivationEmailWithPassword('u@e.com', 'tok', 'Dave', 'pw')
      ).rejects.toThrow('Failed to send activation email with password');
    });
  });

  describe('testConnection', () => {
    it('returns true when SMTP verify succeeds', async () => {
      mockVerify.mockResolvedValueOnce(true as never);

      const service = new EmailService();
      const result = await service.testConnection();

      expect(result).toBe(true);
      expect(mockVerify).toHaveBeenCalledTimes(1);
    });

    it('returns false when SMTP verify rejects', async () => {
      mockVerify.mockRejectedValueOnce(new Error('ECONNREFUSED') as never);

      const service = new EmailService();
      const result = await service.testConnection();

      expect(result).toBe(false);
    });
  });
});
