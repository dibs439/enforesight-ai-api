import { clerkClient } from '@clerk/express';
import { Response } from 'express';
import { ClerkAuthRequest } from '../../middleware/clerkAuth';
import { logger } from '../../utils/logger';

/**
 * Get current user's profile from Clerk
 */
export const getProfile = async (req: ClerkAuthRequest, res: Response) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Fetch complete user details from Clerk
    const user = await clerkClient.users.getUser(userId);

    const profile = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || '',
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      imageUrl: user.imageUrl,
      createdAt: user.createdAt,
      lastSignInAt: user.lastSignInAt,
      publicMetadata: user.publicMetadata,
    };

    return res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching user profile');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch user profile',
    });
  }
};

/**
 * Update current user's profile in Clerk
 */
export const updateProfile = async (req: ClerkAuthRequest, res: Response) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    const { firstName, lastName, publicMetadata } = req.body;

    // Validate input
    if (!firstName && !lastName && !publicMetadata) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'At least one field must be provided',
      });
    }

    // Update user in Clerk
    const updateData: any = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (publicMetadata !== undefined)
      updateData.publicMetadata = publicMetadata;

    const updatedUser = await clerkClient.users.updateUser(userId, updateData);

    return res.json({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.emailAddresses[0]?.emailAddress || '',
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        publicMetadata: updatedUser.publicMetadata,
      },
      message: 'Profile updated successfully',
    });
  } catch (error) {
    logger.error({ err: error }, 'Error updating user profile');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update profile',
    });
  }
};

/**
 * Get user's active sessions from Clerk
 */
export const getSessions = async (req: ClerkAuthRequest, res: Response) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    // Get all sessions for the user
    const sessions = await clerkClient.sessions.getSessionList({ userId });

    return res.json({
      success: true,
      data: Array.isArray(sessions)
        ? sessions.map((session: any) => ({
            id: session.id,
            status: session.status,
            lastActiveAt: session.lastActiveAt,
            expireAt: session.expireAt,
            abandonAt: session.abandonAt,
          }))
        : [],
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching sessions');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to fetch sessions',
    });
  }
};

/**
 * Revoke a specific session
 */
export const revokeSession = async (req: ClerkAuthRequest, res: Response) => {
  try {
    const userId = req.auth?.userId;
    const { sessionId } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Session ID is required',
      });
    }

    // Revoke the session
    await clerkClient.sessions.revokeSession(sessionId as string);

    return res.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    logger.error({ err: error }, 'Error revoking session');
    return res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to revoke session',
    });
  }
};
