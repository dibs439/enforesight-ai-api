import { globSync } from 'glob';
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Enforesight API',
      version: '1.0.0',
      description:
        'Regulatory enforcement intelligence platform — REST API for customer portal, admin panel, and AI chat.',
      contact: {
        name: 'Enforesight Engineering',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Versioned API (v1)',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Admin endpoints: supply a JWT obtained from POST /api/admin/users/login. ' +
            'Customer endpoints: supply a Clerk session token.',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Internal Server Error' },
            message: { type: 'string', example: 'Something went wrong.' },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'OK' },
            message: { type: 'string', example: 'Server is running' },
            timestamp: { type: 'string', format: 'date-time' },
            environment: { type: 'string', example: 'production' },
            dependencies: {
              type: 'object',
              properties: {
                convex: {
                  type: 'string',
                  enum: ['ok', 'degraded', 'unconfigured'],
                },
              },
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@enforesight.com' },
            password: { type: 'string', format: 'password', example: 'P@ssw0rd123!' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            token: { type: 'string', description: 'JWT access token' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string', format: 'email' },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                role: { type: 'string', enum: ['admin', 'editor'] },
              },
            },
          },
        },
        Enforcement: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            documentId: { type: 'string' },
            jurisdiction: { type: 'string' },
            regulatorName: { type: 'string' },
            subjectName: { type: 'string' },
            sector: { type: 'string' },
            dateOfAction: { type: 'string', format: 'date' },
            field: { type: 'string' },
            currency: { type: 'string' },
            fineAmount: { type: 'number' },
            enforcementActionType: { type: 'array', items: { type: 'string' } },
            violationTypes: { type: 'array', items: { type: 'string' } },
            enforcementNoticeUrl: { type: 'string', format: 'uri' },
            enforcementNoticeData: { type: 'string' },
            enforcementFile: { type: 'string' },
          },
        },
        Regulator: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            country: { type: 'string' },
            currency: { type: 'string' },
            active: { type: 'boolean' },
          },
        },
        Client: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            company: { type: 'string' },
            phone: { type: 'string' },
            isActive: { type: 'boolean' },
          },
        },
        ContentRecord: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            type: { type: 'string', enum: ['article', 'news', 'update'] },
            isPublished: { type: 'boolean' },
            publishedAt: { type: 'string', format: 'date-time' },
            tags: { type: 'array', items: { type: 'string' } },
          },
        },
        AdminUser: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'editor'] },
            isActive: { type: 'boolean' },
          },
        },
        Customer: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            subscriptionTier: { type: 'string' },
            active: { type: 'boolean' },
            isSuspended: { type: 'boolean' },
            phoneNumber: { type: 'string' },
            occupation: { type: 'string' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Validation failed' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Invalid email format' },
                  code: { type: 'string', example: 'invalid_string' },
                },
              },
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 340 },
            totalPages: { type: 'integer', example: 17 },
          },
        },
        Conversation: {
          type: 'object',
          description: 'An AI chat conversation thread',
          properties: {
            _id: { type: 'string', example: 'k57abc123def456ghi789' },
            title: { type: 'string', example: 'SEC enforcement actions 2025' },
            pinned: { type: 'boolean', example: false },
            archived: { type: 'boolean', example: false },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ConversationMessage: {
          type: 'object',
          description: 'A single message within an AI chat conversation',
          properties: {
            _id: { type: 'string', example: 'm5xabc987def321ghi' },
            conversationId: { type: 'string', example: 'k57abc123def456ghi789' },
            role: { type: 'string', enum: ['user', 'assistant'], example: 'assistant' },
            content: { type: 'string', example: 'The SEC has taken 47 enforcement actions in Q1 2025...' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CustomerConversation: {
          type: 'object',
          description: 'A customer support conversation record',
          properties: {
            _id: { type: 'string', example: 'conv_abc123def456' },
            customerId: { type: 'string', example: 'cust_xyz789' },
            message: { type: 'string', example: 'I need help understanding the FCA sanctions' },
            status: { type: 'string', enum: ['open', 'closed', 'pending'], example: 'open' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Health', description: 'Server health and status' },
      { name: 'Auth', description: 'Admin authentication' },
      { name: 'Admin - Users', description: 'User management (admin JWT)' },
      { name: 'Admin - Enforcements', description: 'Enforcement record management (admin JWT)' },
      { name: 'Admin - Regulators', description: 'Regulator management (admin JWT)' },
      { name: 'Admin - Clients', description: 'Client management (admin JWT)' },
      { name: 'Admin - Content', description: 'Content management (admin JWT)' },
      { name: 'Admin - Customers', description: 'Customer account management (admin JWT)' },
      { name: 'Admin - Dashboard', description: 'Dashboard statistics' },
      { name: 'Customer Portal', description: 'Customer-facing endpoints (Clerk auth)' },
      { name: 'Customer Profile', description: 'Customer profile and session management (Clerk auth)' },
      { name: 'Customer Conversations', description: 'Customer conversation management (Clerk auth)' },
      { name: 'AI Chat', description: 'AI-powered conversation endpoints (Clerk or JWT)' },
      { name: 'Content', description: 'Public content pages and slugs' },
      { name: 'Clients', description: 'Active client listing' },
      { name: 'Webhooks', description: 'Incoming webhook endpoints' },
      { name: 'Reference Data', description: 'Countries, currencies, sectors, violation types, etc.' },
    ],
  },
  // platform:'linux' forces forward slashes on Windows — swagger-jsdoc
  // cannot parse files referenced with backslash paths.
  apis: globSync([
    './src/routes/common/**/*.ts',
    './src/routes/customer/**/*.ts',
    './src/routes/admin/**/*.ts',
    './src/routes/api.ts',
    './src/routes/health.ts',
  ], { platform: 'linux' }),
};

export const swaggerSpec = (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID)
  ? {}
  : swaggerJsdoc(options);
