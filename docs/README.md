# Enforesight API

A modern Express.js API server built with TypeScript, featuring JWT authentication, Convex database backend, and comprehensive CRUD operations.

## Features

- ✅ **Express.js v5** - Latest version with improved performance
- ✅ **TypeScript** - Full type safety and modern JavaScript features
- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Convex Database** - Real-time backend with type-safe queries
- ✅ **bcrypt Password Hashing** - Secure password storage
- ✅ **Security** - Helmet.js for security headers, CORS enabled
- ✅ **Logging** - Morgan for HTTP request logging
- ✅ **Hot Reload** - Nodemon with ts-node for development
- ✅ **Error Handling** - Global error handling middleware
- ✅ **Organized Routes** - Modular route structure
- ✅ **Health Check** - Built-in health monitoring endpoint
- ✅ **Admin CRUD API** - Complete CRUD operations for all entities

## Quick Start

### Prerequisites

- **Node.js** v22.x or higher (recommended: 22.21.0)
- **npm** v10.x or higher
- **Convex account** (free at https://convex.dev)

### Installation

**📖 For detailed setup instructions, see [SETUP.md](./SETUP.md)**

1. Clone and install:

   ```bash
   git clone <repository-url>
   cd enforesight-api
   npm install
   ```

2. Configure environment:

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. Set up Convex database:

   ```bash
   npx convex dev
   ```

   ⚠️ **Important**: Keep this terminal running! Convex must be running for the API to work.

4. Initialize admin user (in a new terminal):

   ```bash
   npx convex run users:initializeDefaultAdminSecure
   ```

5. Start development server (in another terminal):
   ```bash
   npm run dev
   ```

Server will start on `http://localhost:5011`

### After Pulling Changes

When you pull new changes from git, you must redeploy Convex functions:

```bash
git pull origin <branch-name>
npm install              # If package.json changed
npx convex dev          # Or `npx convex deploy` for production
```

**Why?** Convex functions are not stored in git. When code changes include new or modified Convex functions, you must deploy them to make them available.

## Authentication

This API uses JWT (JSON Web Tokens) for authentication.

### Login

```bash
curl -X POST http://localhost:5011/api/admin/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

Response:

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "...",
    "username": "admin",
    "role": "admin",
    "active": true
  }
}
```

### Using the Token

Include the token in the `Authorization` header for protected endpoints:

```bash
curl -X GET http://localhost:5011/api/admin/users \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Default Credentials:**

- Username: `admin`
- Password: `admin123`

⚠️ **Change the default password in production!**

## API Endpoints

### Public Endpoints (No Authentication)

- `GET /health` - Health check
- `POST /api/admin/users/login` - Login and get JWT token

### Protected Endpoints (Requires JWT)

All endpoints require `Authorization: Bearer <token>` header.

#### Contents

- `GET /api/admin/contents` - List all contents
- `GET /api/admin/contents/:id` - Get content by ID
- `POST /api/admin/contents` - Create content
- `PATCH /api/admin/contents/:id` - Update content
- `DELETE /api/admin/contents/:id` - Delete content

#### Regulators

- `GET /api/admin/regulators` - List all regulators
- `GET /api/admin/regulators/:id` - Get regulator by ID
- `POST /api/admin/regulators` - Create regulator
- `PATCH /api/admin/regulators/:id` - Update regulator
- `DELETE /api/admin/regulators/:id` - Delete regulator

#### Enforcements

- `GET /api/admin/enforcements` - List all enforcements
- `GET /api/admin/enforcements/:id` - Get enforcement by ID
- `POST /api/admin/enforcements` - Create enforcement
- `PATCH /api/admin/enforcements/:id` - Update enforcement
- `DELETE /api/admin/enforcements/:id` - Delete enforcement

#### Clients

- `GET /api/admin/clients` - List all clients
- `GET /api/admin/clients/:id` - Get client by ID
- `POST /api/admin/clients` - Create client
- `PATCH /api/admin/clients/:id` - Update client
- `DELETE /api/admin/clients/:id` - Delete client

#### Users

- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get user by ID
- `POST /api/admin/users` - Create user
- `PATCH /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

## Available Scripts

```bash
# Development
npm run dev           # Start dev server with hot reload
npm run convex        # Start Convex dev server

# Production
npm run build         # Build TypeScript to JavaScript
npm start             # Start production server

# Testing
npm test              # Run Jest test suite

# Utilities
npm run clean         # Remove build directory
```

## Testing

The test suite uses Jest with Supertest. Run all tests:

```bash
npm test
```

The suite covers middleware (JWT auth, flexible auth), services (aggregation, content, email, intent parser), utilities (auth, record sanitizer), and validation schemas.

## Project Structure

```
enforesight-api/
├── src/
│   ├── index.ts              # Express app entry point
│   ├── controllers/
│   │   ├── admin/            # Admin panel controllers
│   │   └── customer/         # Customer portal controllers
│   ├── middleware/
│   │   ├── admin-auth.ts     # JWT authentication middleware (admin)
│   │   ├── auth.ts           # Clerk authentication middleware (customer)
│   │   ├── upload.ts         # Multer file upload middleware
│   │   └── flexibleAuth.ts   # Flexible auth (JWT or Clerk)
│   ├── routes/
│   │   ├── api.ts            # Main API router
│   │   ├── admin/            # Admin panel routes (JWT protected)
│   │   ├── customer/         # Customer portal routes (Clerk protected)
│   │   └── common/           # Shared reference-data routes (public)
│   ├── services/             # Business logic services
│   ├── utils/
│   │   ├── auth.ts           # JWT and bcrypt utilities
│   │   └── convexClient.ts   # Convex client setup
│   ├── validation/           # Zod schemas and validation middleware
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── convex/
│   ├── schema.ts             # Database schema
│   ├── users.ts              # User management functions
│   ├── contents.ts           # Content management functions
│   ├── regulators.ts         # Regulator management functions
│   ├── enforcements.ts       # Enforcement management functions
│   ├── clients.ts            # Client management functions
│   └── _generated/           # Auto-generated Convex types
├── docs/                     # Documentation
├── .env.example              # Environment variables template
├── .env.local                # Environment variables (create this)
├── package.json              # Dependencies and scripts
└── tsconfig.json             # TypeScript configuration
```

## Environment Variables

Create `.env.local` from `.env.example`:

```bash
# Server Configuration
PORT=5011
NODE_ENV=development

# Convex Configuration
CONVEX_DEPLOYMENT=dev:qualified-labrador-723
CONVEX_URL=https://qualified-labrador-723.convex.cloud
NEXT_PUBLIC_CONVEX_URL=https://qualified-labrador-723.convex.cloud

# JWT Configuration (⚠️ Change in production!)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-123456789

# Clerk Configuration (Optional - for legacy routes)
# CLERK_SECRET_KEY=your_clerk_secret_key
# CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

## Documentation

- 📖 **[SETUP.md](./SETUP.md)** - Complete setup guide for new developers
- 🚀 **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Deployment guide (especially after git pull)
- 📚 **[API.md](./docs/API.md)** - Full API reference documentation

## Technology Stack

- **Runtime**: Node.js 22.x
- **Framework**: Express.js 5.1.0
- **Language**: TypeScript 5.x
- **Database**: Convex (real-time backend)
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Security**: Helmet, CORS
- **Logging**: Morgan
- **Dev Tools**: Nodemon, ts-node

## Security

- ✅ Passwords hashed with bcrypt (10 salt rounds)
- ✅ JWT tokens with 24-hour expiration
- ✅ All admin endpoints require authentication
- ✅ Helmet.js for security headers
- ✅ CORS configured
- ⚠️ **Change default admin password immediately**
- ⚠️ **Use strong JWT secret in production**
- ⚠️ **Always use HTTPS in production**

## Deployment

See [SETUP.md](./SETUP.md) for detailed deployment instructions.

Quick deployment checklist:

1. ✅ Update environment variables
2. ✅ Change default admin password
3. ✅ Generate strong JWT secret
4. ✅ Configure CORS for production domain
5. ✅ Enable HTTPS
6. ✅ Set up proper logging and monitoring
7. ✅ Deploy Convex functions to production

## Troubleshooting

### Common Issues

**Port already in use:**

```bash
lsof -ti:5011 | xargs kill -9
```

**Convex connection issues:**

```bash
rm -rf convex/_generated
npx convex dev
```

**Admin user not found:**

```bash
npx convex run users:initializeDefaultAdminSecure
```

For more troubleshooting tips, see [SETUP.md](./SETUP.md#troubleshooting).

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

- 📖 Documentation: Check the `/docs/` folder
- 🐛 Issues: Open an issue on GitLab
- 💬 Questions: Contact the development team

---

**Built with ❤️ by the Enforesight Team**

```


```
