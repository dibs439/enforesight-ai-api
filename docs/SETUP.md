# Enforesight API - Setup Guide

This guide will help you set up the Enforesight API from scratch on a new machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 22.x or higher (recommended: 22.21.0)
  - Check version: `node --version`
  - Download from: https://nodejs.org/
  - Or install via nvm: `nvm install 22.21.0 && nvm use 22.21.0`

- **npm**: Version 10.x or higher (comes with Node.js)
  - Check version: `npm --version`

- **Git**: For cloning the repository
  - Check version: `git --version`

- **Convex Account**: Free account at https://convex.dev
  - You'll need this for the database backend

## Installation Steps

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd enforesight-api
```

### 2. Install Dependencies

Install all required Node.js packages:

```bash
npm install
```

This will install:

- **Express.js** (v5.1.0) - Web framework
- **TypeScript** (v5.x) - Type safety
- **Convex** (v1.27.3) - Database and backend
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT token generation and verification
- **@clerk/backend** - Clerk authentication (legacy, optional)
- **cors**, **helmet**, **morgan** - Security and logging middleware
- **dotenv** - Environment variable management
- **ts-node**, **nodemon** - Development tools

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local  # If .env.example exists
# OR create manually:
touch .env.local
```

Add the following configuration to `.env.local`:

```bash
# Server Configuration
PORT=5011
NODE_ENV=development

# Convex Configuration
# Option A: Use the existing qualified-labrador-723 deployment
CONVEX_DEPLOYMENT=dev:qualified-labrador-723
CONVEX_URL=https://qualified-labrador-723.convex.cloud
NEXT_PUBLIC_CONVEX_URL=https://qualified-labrador-723.convex.cloud

# Option B: Create your own Convex deployment (see step 4)
# CONVEX_DEPLOYMENT=dev:your-deployment-name
# CONVEX_URL=https://your-deployment-name.convex.cloud
# NEXT_PUBLIC_CONVEX_URL=https://your-deployment-name.convex.cloud

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-123456789

# Clerk Configuration (Optional - for legacy routes)
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

**⚠️ Important**:

- Change `JWT_SECRET` to a strong, unique secret in production
- Generate a secure secret: `openssl rand -base64 32`

### 4. Set Up Convex Database

#### Option A: Use Existing Deployment (Recommended for Team)

If you're joining an existing team, you can use the shared `qualified-labrador-723` deployment:

1. Install Convex CLI globally (if not already installed):

   ```bash
   npm install -g convex
   ```

2. Login to Convex:

   ```bash
   npx convex login
   ```

3. Link to the existing deployment:
   ```bash
   npx convex dev --once --env-file .env.local
   ```

#### Option B: Create Your Own Deployment

If you want your own separate database:

1. Login to Convex:

   ```bash
   npx convex login
   ```

2. Initialize Convex:

   ```bash
   npx convex dev
   ```

3. This will:
   - Create a new Convex project
   - Deploy the schema and functions
   - Generate `.env.local` with your deployment URL
   - Create the `convex/_generated` folder with type definitions

4. The Convex dashboard will open automatically at: https://dashboard.convex.dev

### 5. Initialize the Database

Create the default admin user:

```bash
# Start the Convex dev server (if not already running)
npx convex dev

# In another terminal, initialize the admin user
npx convex run users:initializeDefaultAdminSecure
```

This creates:

- **Username**: `admin`
- **Password**: `admin123` (hashed with bcrypt)
- **Role**: `admin`

**⚠️ Security**: Change the default password immediately in production!

### 6. Start the Development Server

Start the Express API server:

```bash
npm run dev
```

You should see:

```
🚀 Server is running on port 5011
📊 Health check: http://localhost:5011/health
🔗 API endpoint: http://localhost:5011/api
🌍 Environment: development
```

### 7. Verify Installation

Test that everything is working:

```bash
# Test 1: Health check
curl http://localhost:5011/health

# Test 2: Login and get JWT token
curl -X POST http://localhost:5011/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Test 3: Run the comprehensive test suite
chmod +x test-jwt-auth.sh
./test-jwt-auth.sh
```

If all tests pass, you're ready to go! 🎉

## Project Structure

```
enforesight-api/
├── src/
│   ├── index.ts              # Express app entry point
│   ├── middleware/
│   │   └── auth.ts           # JWT authentication middleware
│   ├── routes/
│   │   ├── api.ts            # Main API router
│   │   ├── admin-crud.ts     # Admin CRUD endpoints (JWT protected)
│   │   ├── admin.ts          # Admin utilities and debug routes
│   │   ├── content.ts        # Public content routes
│   │   ├── health.ts         # Health check endpoint
│   │   └── demo.ts           # Demo routes
│   ├── utils/
│   │   ├── auth.ts           # JWT and bcrypt utilities
│   │   └── convexClient.ts   # Convex client setup
│   └── types/
│       └── index.ts          # TypeScript type definitions
├── convex/
│   ├── schema.ts             # Database schema
│   ├── users.ts              # User management functions
│   ├── contents.ts           # Content management functions
│   ├── regulators.ts         # Regulator management functions
│   ├── enforcements.ts       # Enforcement management functions (to be created)
│   ├── clients.ts            # Client management functions (to be created)
│   └── _generated/           # Auto-generated Convex types
├── docs/
│   ├── JWT_AUTHENTICATION.md # JWT authentication guide
│   └── ...                   # Other documentation
├── .env.local                # Environment variables (create this)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── test-jwt-auth.sh          # Authentication test script
```

## Available Scripts

```bash
# Development
npm run dev           # Start dev server with hot reload (nodemon + ts-node)
npm run convex        # Start Convex dev server

# Production
npm run build         # Compile TypeScript to JavaScript
npm start             # Run compiled JavaScript (production)

# Testing
npm test              # Run Jest tests
npm run test:watch    # Run tests in watch mode
./test-jwt-auth.sh    # Run JWT authentication tests

# Linting & Formatting
npm run lint          # Run ESLint
npm run format        # Format code with Prettier
```

## API Endpoints

### Public Endpoints (No Authentication)

- `GET /health` - Health check
- `POST /api/admin/login` - Login and get JWT token

### Protected Endpoints (Requires JWT Token)

All protected endpoints require `Authorization: Bearer <token>` header.

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
- `PATCH /api/admin/users/:id/toggle-active` - Toggle user active status

## Authentication Flow

1. **Login**: POST to `/api/admin/login` with credentials

   ```bash
   curl -X POST http://localhost:5011/api/admin/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin","password":"admin123"}'
   ```

2. **Get Token**: Extract the `token` from the response

   ```json
   {
     "success": true,
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "user": { ... }
   }
   ```

3. **Use Token**: Include in `Authorization` header for protected routes
   ```bash
   curl -X GET http://localhost:5011/api/admin/users \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

## Troubleshooting

### Port Already in Use

If port 5011 is already in use:

```bash
# Find process using port 5011
lsof -ti:5011

# Kill the process
kill -9 $(lsof -ti:5011)

# Or change port in .env.local
PORT=3000
```

### Convex Connection Issues

```bash
# Clear Convex cache
rm -rf convex/_generated
rm -rf .convex

# Re-deploy
npx convex dev
```

### TypeScript Compilation Errors

```bash
# Clear TypeScript cache
rm -rf dist/
rm -rf node_modules/
npm install

# Rebuild
npm run build
```

### Database Not Initialized

If you see "User not found" when logging in:

```bash
# Initialize the admin user
npx convex run users:initializeDefaultAdminSecure
```

### JWT Token Invalid

If you get "Invalid or expired token":

1. Token expires after 24 hours - login again to get a fresh token
2. Ensure `JWT_SECRET` in `.env.local` matches the one used to generate the token
3. Check that the token is properly formatted: `Bearer <token>`

## Environment Variables Reference

| Variable                | Required | Description                   | Example                                       |
| ----------------------- | -------- | ----------------------------- | --------------------------------------------- |
| `PORT`                  | No       | Server port                   | `5011`                                        |
| `NODE_ENV`              | No       | Environment                   | `development` or `production`                 |
| `CONVEX_DEPLOYMENT`     | Yes      | Convex deployment ID          | `dev:qualified-labrador-723`                  |
| `CONVEX_URL`            | Yes      | Convex backend URL            | `https://qualified-labrador-723.convex.cloud` |
| `JWT_SECRET`            | Yes      | Secret for signing JWT tokens | `your-secret-key`                             |
| `CLERK_SECRET_KEY`      | No       | Clerk secret (legacy)         | Optional                                      |
| `CLERK_PUBLISHABLE_KEY` | No       | Clerk public key (legacy)     | Optional                                      |

## Security Considerations

### Production Deployment

Before deploying to production:

1. **Change Default Credentials**

   ```bash
   # Use the admin panel or API to update the admin password
   curl -X PATCH http://your-domain.com/api/admin/users/ADMIN_ID \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"password":"new_secure_password"}'
   ```

2. **Update JWT Secret**
   - Generate a strong secret: `openssl rand -base64 32`
   - Update `.env.local` (or production environment variables)

3. **Use HTTPS**
   - Always use HTTPS in production
   - JWT tokens should never be transmitted over HTTP

4. **Set Proper CORS**
   - Configure allowed origins in production
   - Don't use `*` for CORS in production

5. **Environment Variables**
   - Never commit `.env.local` to git
   - Use proper secrets management in production (e.g., AWS Secrets Manager, Azure Key Vault)

### Security Best Practices

- ✅ Passwords are hashed with bcrypt (10 salt rounds)
- ✅ JWT tokens expire after 24 hours
- ✅ All admin endpoints require authentication
- ✅ No sensitive data in logs or error messages
- ⚠️ Change default admin password immediately
- ⚠️ Use strong JWT secret in production
- ⚠️ Enable rate limiting for login endpoint

## Need Help?

- 📖 Documentation: `/docs/` folder
- 🔐 JWT Authentication: `/docs/JWT_AUTHENTICATION.md`
- 🧪 Run tests: `./test-jwt-auth.sh`
- 🐛 Issues: Check the console logs for error messages

## Next Steps

After successful setup:

1. Change the default admin password
2. Create additional users as needed
3. Populate the database with your content
4. Configure your frontend to use the API
5. Set up production deployment

Happy coding! 🚀
