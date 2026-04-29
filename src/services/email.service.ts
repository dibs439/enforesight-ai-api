// src/services/email.service.ts
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // tls defaults to { rejectUnauthorized: true } — do not override to ensure
      // the SMTP server certificate is validated and prevent MITM attacks.
    });
  }

  async sendActivationEmail(
    to: string,
    activationCode: string,
    firstName: string
  ) {
    const activationUrl = `${process.env.FRONTEND_URL}/api/admin/users/activate/${activationCode}`;

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject: 'Activate Your Enforesight Account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; margin: 0;">Enforesight</h1>
            <p style="color: #666; margin: 5px 0;">Financial Compliance Intelligence</p>
          </div>
          
          <h2 style="color: #333;">Welcome, ${firstName}!</h2>
          <p style="color: #555; line-height: 1.6;">
            Thank you for creating your Enforesight account. To get started, please activate your account by clicking the button below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${activationUrl}" 
               style="background: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
              Activate Your Account
            </a>
          </div>
          
          <p style="color: #555; line-height: 1.6;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="color: #007bff; word-break: break-all;">
            <a href="${activationUrl}">${activationUrl}</a>
          </p>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              This activation link will expire in 24 hours.<br>
              If you didn't create this account, please ignore this email.
            </p>
          </div>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info({ messageId: info.messageId, to }, 'Activation email sent');
      return info;
    } catch (error) {
      logger.error({ err: error, to }, 'Error sending activation email');
      throw new Error('Failed to send activation email', { cause: error });
    }
  }

  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();

  private loadTemplate(templateName: string): HandlebarsTemplateDelegate {
    if (this.compiledTemplates.has(templateName)) {
      return this.compiledTemplates.get(templateName)!;
    }

    const templatePath = path.join(__dirname, '../templates', `${templateName}.hbs`);
    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const compiled = Handlebars.compile(templateSource);

    this.compiledTemplates.set(templateName, compiled);
    return compiled;
  }

  private generateAdminWelcomeEmailHtml(
    activationUrl: string,
    firstName: string,
    email: string
  ): string {
    const template = this.loadTemplate('admin-welcome');
    const logoUrl = `${process.env.FRONTEND_URL || 'https://localhost:3000'}/assets/enforesight-logo.svg`;
    const companyAddress = process.env.COMPANY_ADDRESS || 'Enforesight';

    return template({
      activationUrl,
      firstName,
      email,
      logoUrl,
      companyAddress,
    });
  }

  async sendActivationEmailWithPassword(
    to: string,
    activationCode: string,
    firstName: string,
    _password: string // password is no longer sent in email for security reasons
  ) {
    const activationUrl = `${process.env.FRONTEND_URL}/api/admin/users/activate/${activationCode}`;
    const htmlContent = this.generateAdminWelcomeEmailHtml(
      activationUrl,
      firstName,
      to
    );

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject: 'Welcome to Enforesight - Activate Your Admin Account',
      html: htmlContent,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(
        { messageId: info.messageId, to },
        'Activation email with password sent'
      );
      return info;
    } catch (error) {
      logger.error(
        { err: error, to },
        'Error sending activation email with password'
      );
      throw new Error('Failed to send activation email with password', {
        cause: error,
      });
    }
  }

  async testConnection() {
    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified');
      return true;
    } catch (error) {
      logger.error({ err: error }, 'SMTP connection failed');
      return false;
    }
  }
}
