import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { EmailService } from '../../services/email.service';
import { generateToken } from '../../utils/auth';
import { getConvexClient } from '../../utils/convexClient';
import { logger } from '../../utils/logger';

// Dynamic import for API to handle both dev and production environments
let api: any;
try {
  // Try ES module import first (development)
  api = require('../../../convex/_generated/api').api;
} catch {
  try {
    // Fallback to dist location (production)
    api = require('../../convex/_generated/api').api;
  } catch {
    // Final fallback - create a mock API object
    logger.warn('Could not load Convex API - using fallback');
    api = null;
  }
}

export class UsersController {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Generate a cryptographically secure random 14-character password.
   * Uses uppercase, lowercase, digits, and special characters.
   */
  private generateRandomPassword(): string {
    const charset =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const bytes = crypto.randomBytes(14);
    return Array.from(bytes)
      .map(b => charset[b % charset.length])
      .join('');
  }

  /**
   * Login user with email and password
   */
  async login(req: Request, res: Response): Promise<Response> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
        });
      }

      const client = getConvexClient();

      // Authenticate user with bcrypt
      const user = await client.action(api.userActions.authenticateUser, {
        email: email.toLowerCase().trim(),
        password,
      });

      // Generate JWT token
      const token = generateToken({
        userId: user._id,
        username: user.email,
        role: user.role,
      });

      return res.json({
        success: true,
        user,
        token,
        message: 'Login successful',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Invalid email or password')) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Login failed',
        details: errorMessage,
      });
    }
  }

  /**
   * Get all users with pagination
   */
  async getAllUsers(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      // Extract filter parameters
      const { country, q } = req.query;

      const client = getConvexClient();
      let result;

      try {
        // Try with new function signature that supports filtering
        result = await client.query(api.users.getAllUsers, {
          offset,
          limit,
          ...(country && { country: country as string }),
          ...(q && { q: q as string }),
        });
      } catch (error: any) {
        // Fall back to old function signature if new parameters are not supported
        if (
          error?.message?.includes('extra field') ||
          error?.message?.includes('not in the validator')
        ) {
          logger.warn('Using legacy users function - filters not supported in deployed version');

          // Get all users without filtering
          const allUsersResult = await client.query(api.users.getAllUsers, {
            offset: 0,
            limit: 1000, // Get more records for client-side filtering
          });

          // Apply client-side filtering
          let filteredUsers = allUsersResult.users || [];

          if (country) {
            filteredUsers = filteredUsers.filter(
              (user: any) => user.country === country
            );
          }

          if (q) {
            const searchQuery = (q as string).toLowerCase();
            filteredUsers = filteredUsers.filter((user: any) => {
              const firstName = (user.firstName || '').toLowerCase();
              const lastName = (user.lastName || '').toLowerCase();
              const email = (user.email || '').toLowerCase();
              const role = (user.role || '').toLowerCase();

              return (
                firstName.includes(searchQuery) ||
                lastName.includes(searchQuery) ||
                email.includes(searchQuery) ||
                role.includes(searchQuery)
              );
            });
          }

          // Apply pagination to filtered results
          const total = filteredUsers.length;
          const paginatedUsers = filteredUsers.slice(offset, offset + limit);

          result = {
            users: paginatedUsers,
            total: total,
          };
        } else {
          throw error;
        }
      }

      return res.json({
        success: true,
        data: result.users,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page < Math.ceil(result.total / limit),
          hasPrev: page > 1,
        },
        filters: {
          ...(country && { country }),
          ...(q && { q }),
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to fetch users',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      const user = await client.query(api.users.getUserById, {
        id: req.params.id as any,
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      return res.json({ success: true, data: user });
    } catch (error) {
      return res.status(500).json({
        error: 'Failed to fetch user',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Create new user without password (activation workflow)
   */
  async createUser(req: Request, res: Response): Promise<Response> {
    try {
      const { firstName, lastName, email, role } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email || !role) {
        return res.status(400).json({
          success: false,
          message: 'firstName, lastName, email, and role are required',
        });
      }

      // Validate role
      if (!['admin', 'editor'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Role must be either "admin" or "editor"',
        });
      }

      // Generate random password
      const randomPassword = this.generateRandomPassword();

      const client = getConvexClient();
      const result = await client.action(
        api.userActions.createUserWithActivationAndPassword,
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          role: role,
          password: randomPassword,
        }
      );

      // Send activation email with password
      try {
        await this.emailService.sendActivationEmailWithPassword(
          email.trim().toLowerCase(),
          result.activationCode,
          firstName.trim(),
          randomPassword
        );
        logger.info({ email }, 'Activation email with password sent successfully');
      } catch (emailError) {
        logger.error({ err: emailError }, 'Failed to send activation email');
        // Don't fail the user creation if email fails
        // Log the error and continue
      }

      return res.status(201).json({
        success: true,
        id: result.userId,
        message: 'User created successfully. Activation email sent.',
        // TODO: Remove activationCode from response in production
        // activationCode: result.activationCode,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Handle specific errors
      if (errorMessage.includes('email already exists')) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'User with this email already exists',
        });
      }

      if (errorMessage.includes('Invalid email format')) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid email format',
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to create user',
        details: errorMessage,
      });
    }
  }

  /**
   * Update existing user
   */
  async updateUser(req: Request, res: Response): Promise<Response> {
    try {
      const { firstName, lastName, email, role } = req.body;
      const updates: any = {};

      // Only include provided fields
      if (firstName !== undefined) updates.firstName = firstName;
      if (lastName !== undefined) updates.lastName = lastName;
      if (email !== undefined) updates.email = email;
      if (role !== undefined) {
        if (!['admin', 'editor'].includes(role)) {
          return res.status(400).json({
            success: false,
            message: 'Role must be either "admin" or "editor"',
          });
        }
        updates.role = role;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid fields provided for update',
        });
      }

      const client = getConvexClient();
      await client.mutation(api.users.updateUser, {
        id: req.params.id as any,
        ...updates,
      });

      return res.json({
        success: true,
        message: 'User updated successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('User not found')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      if (errorMessage.includes('email already exists')) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'User with this email already exists',
        });
      }

      if (errorMessage.includes('Invalid email format')) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid email format',
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to update user',
        details: errorMessage,
      });
    }
  }

  /**
   * Delete user
   */
  async deleteUser(req: Request, res: Response): Promise<Response> {
    try {
      const client = getConvexClient();
      await client.mutation(api.users.deleteUser, {
        id: req.params.id as any,
      });

      return res.json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('User not found')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to delete user',
        details: errorMessage,
      });
    }
  }

  /**
   * Activate user account with activation code
   */
  async activateUser(req: Request, res: Response): Promise<Response> {
    try {
      const { activationCode } = req.body;

      if (!activationCode) {
        return res.status(400).json({
          success: false,
          message: 'Activation code is required',
        });
      }

      const client = getConvexClient();

      // Activate the user
      const result = await client.mutation(api.users.activateUser, {
        activationCode: activationCode.trim(),
      });

      // Check if request expects HTML (form submission) or JSON (API call)
      const acceptsHtml = req.get('Accept')?.includes('text/html');

      if (acceptsHtml) {
        return res.send(`
          <html>
            <head><title>Account Activated Successfully</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #007bff; font-size: 32px; margin: 0; font-weight: bold;">Enforesight</h1>
                <p style="color: #666; margin: 5px 0; font-size: 14px;">Financial Compliance Intelligence</p>
              </div>
              <h2>🎉 Account Activated Successfully!</h2>
              <p>Your account has been activated. You can now log in with the credentials provided in your email.</p>
              <br>
              <a href="${process.env.FRONTEND_URL}/login" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">Go to Login</a>
            </body>
          </html>
        `);
      }

      return res.json({
        success: true,
        userId: result.userId,
        email: result.email,
        message: 'Account activated successfully',
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      const acceptsHtml = req.get('Accept')?.includes('text/html');

      if (errorMessage.includes('Invalid activation code')) {
        if (acceptsHtml) {
          return res.status(400).send(`
            <html>
              <head><title>Invalid Activation Code</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #007bff; font-size: 32px; margin: 0; font-weight: bold;">Enforesight</h1>
                  <p style="color: #666; margin: 5px 0; font-size: 14px;">Financial Compliance Intelligence</p>
                </div>
                <h2>Invalid Activation Code</h2>
                <p>The activation code is not valid or has already been used.</p>
              </body>
            </html>
          `);
        }
        return res.status(400).json({
          success: false,
          error: 'Invalid Code',
          message: 'Invalid activation code',
        });
      }

      if (errorMessage.includes('expired')) {
        if (acceptsHtml) {
          return res.status(400).send(`
            <html>
              <head><title>Activation Code Expired</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h1 style="color: #007bff; font-size: 32px; margin: 0; font-weight: bold;">Enforesight</h1>
                  <p style="color: #666; margin: 5px 0; font-size: 14px;">Financial Compliance Intelligence</p>
                </div>
                <h2>Activation Code Expired</h2>
                <p>Your activation code has expired. Please request a new activation link.</p>
              </body>
            </html>
          `);
        }
        return res.status(400).json({
          success: false,
          error: 'Expired Code',
          message: 'Activation code has expired',
        });
      }

      if (acceptsHtml) {
        return res.status(500).send(`
          <html>
            <head><title>Activation Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #007bff; font-size: 32px; margin: 0; font-weight: bold;">Enforesight</h1>
                <p style="color: #666; margin: 5px 0; font-size: 14px;">Financial Compliance Intelligence</p>
              </div>
              <h2>Activation Error</h2>
              <p>There was an error activating your account. Please try again or contact support.</p>
              <p><small>Error: ${errorMessage}</small></p>
            </body>
          </html>
        `);
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to activate account',
        details: errorMessage,
      });
    }
  }

  /**
   * Resend activation email
   */
  async resendActivation(req: Request, res: Response): Promise<Response> {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Email is required',
        });
      }

      const client = getConvexClient();
      const result = await client.action(
        api.userActions.resendActivationEmail,
        {
          email: email.trim().toLowerCase(),
        }
      );

      // Get user details for email personalization
      const user = await client.query(api.users.getUserByEmail, {
        email: email.trim().toLowerCase(),
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User not found',
        });
      }

      // Send activation email
      try {
        await this.emailService.sendActivationEmail(
          email.trim().toLowerCase(),
          result.activationCode,
          user.firstName
        );
        logger.info({ email }, 'Activation email resent successfully');
      } catch (emailError) {
        logger.error({ err: emailError }, 'Failed to resend activation email');
        // Don't fail the request if email fails
      }

      return res.json({
        success: true,
        message: 'Activation email resent successfully.',
        // TODO: Remove activationCode from response in production
        // activationCode: result.activationCode,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('User not found')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      if (errorMessage.includes('already activated')) {
        return res.status(400).json({
          success: false,
          error: 'Already Activated',
          message: 'User account is already activated',
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to resend activation email',
        details: errorMessage,
      });
    }
  }

  /**
   * Set user password after activation
   */
  async setPassword(req: Request, res: Response): Promise<Response> {
    try {
      const { userId, password, confirmPassword } = req.body;

      if (!userId || !password || !confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'userId, password, and confirmPassword are required',
        });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: 'Passwords do not match',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long',
        });
      }

      const client = getConvexClient();
      const result = await client.action(api.userActions.setUserPassword, {
        userId: userId as any,
        password,
      });

      return res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('User not found')) {
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'User not found',
        });
      }

      if (errorMessage.includes('not activated')) {
        return res.status(400).json({
          success: false,
          error: 'Account Not Activated',
          message: 'User account is not activated',
        });
      }

      if (errorMessage.includes('Password must be at least')) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: errorMessage,
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to set password',
        details: errorMessage,
      });
    }
  }

  /**
   * Validate activation code (GET endpoint for email links)
   */
  async validateActivationCode(req: Request, res: Response): Promise<Response> {
    try {
      const { code } = req.params;

      if (!code) {
        return res.status(400).send(`
          <html>
            <head><title>Invalid Activation Link</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #007bff; font-size: 32px; margin: 0; font-weight: bold;">Enforesight</h1>
                <p style="color: #666; margin: 5px 0; font-size: 14px;">Financial Compliance Intelligence</p>
              </div>
              <h2>Invalid Activation Link</h2>
              <p>The activation link is malformed. Please check your email for the correct link.</p>
            </body>
          </html>
        `);
      }

      const client = getConvexClient();
      const user = await client.query(api.users.getUserByActivationCode, {
        activationCode: code,
      });

      if (!user) {
        return res.status(400).send(`
          <html>
            <head><title>Invalid Activation Code</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #007bff; font-size: 32px; margin: 0; font-weight: bold;">Enforesight</h1>
                <p style="color: #666; margin: 5px 0; font-size: 14px;">Financial Compliance Intelligence</p>
              </div>
              <h2>Invalid Activation Code</h2>
              <p>The activation code is not valid. Please check your email for the correct link.</p>
            </body>
          </html>
        `);
      }

      // Check if activation code is expired
      const now = Date.now();
      if (!user.activationCodeExpiry || now > user.activationCodeExpiry) {
        return res.status(400).send(`
          <html>
            <head><title>Activation Code Expired</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #007bff; font-size: 32px; margin: 0; font-weight: bold;">Enforesight</h1>
                <p style="color: #666; margin: 5px 0; font-size: 14px;">Financial Compliance Intelligence</p>
              </div>
              <h2>Activation Code Expired</h2>
              <p>Your activation code has expired. Please request a new activation link.</p>
            </body>
          </html>
        `);
      }

      // Check if user is already activated
      if (user.active) {
        return res.status(400).send(`
          <html>
            <head><title>Account Already Activated</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #007bff; font-size: 32px; margin: 0; font-weight: bold;">Enforesight</h1>
                <p style="color: #666; margin: 5px 0; font-size: 14px;">Financial Compliance Intelligence</p>
              </div>
              <h2>Account Already Activated</h2>
              <p>Your account has already been activated. You can now log in to your account.</p>
              <br>
              <a href="${process.env.FRONTEND_URL}/login" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Login</a>
            </body>
          </html>
        `);
      }

      // Activate the user account (no password input needed since password was set during creation)
      const _result = await client.mutation(api.users.activateUser, {
        activationCode: code,
      });

      return res.send(`
        <html>
          <head><title>Account Activated Successfully</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #007bff; font-size: 32px; margin: 0; font-weight: bold;">Enforesight</h1>
              <p style="color: #666; margin: 5px 0; font-size: 14px;">Financial Compliance Intelligence</p>
            </div>
            <h2>🎉 Account Activated Successfully!</h2>
            <p>Hello ${user.firstName}, your account has been activated successfully!</p>
            <p>You can now log in using the email and password provided in your welcome email.</p>
            <br>
            <a href="${process.env.FRONTEND_URL}/login" style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">Go to Login</a>
          </body>
        </html>
      `);
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Failed to validate activation code',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update user password (Admin only)
   * Hashes the password and updates it in Convex
   */
  async updatePassword(req: Request, res: Response): Promise<Response> {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters long',
        });
      }

      const client = getConvexClient();

      // Get the user first to verify it exists
      const user = await client.query(api.users.getUser, { userId: id });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update the user's password in Convex
      await client.mutation(api.users.updateUser, {
        id: id as any,
        password: hashedPassword,
      });

      return res.json({
        success: true,
        message: 'Password updated successfully',
        userId: id,
      });
    } catch (error) {
      logger.error({ err: error }, 'Update password error');
      return res.status(500).json({
        success: false,
        error: 'Failed to update password',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const usersController = new UsersController();
