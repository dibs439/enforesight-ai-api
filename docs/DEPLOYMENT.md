# Deployment Guide

Comprehensive guide for deploying Enforesight API to production on Render or other hosting platforms.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Render Deployment](#render-deployment)
3. [Environment Configuration](#environment-configuration)
4. [Convex Database Setup](#convex-database-setup)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Cold Start Handling](#cold-start-handling)

---

## Pre-Deployment Checklist

Before deploying to production, ensure:

- ✅ All environment variables configured
- ✅ Default admin password changed
- ✅ Strong JWT secret generated
- ✅ Convex database set up
- ✅ Clerk authentication configured (if used)
- ✅ CORS origins configured correctly
- ✅ SSL/TLS certificates ready
- ✅ Database backups configured
- ✅ Error logging configured
- ✅ Monitoring alerts set up

---

## Render Deployment

### Prerequisites

- ✅ Render account (render.com)
- ✅ GitHub/GitLab repository connected to Render
- ✅ Convex database configured
- ✅ Environment variables prepared

### Step 1: Connect Repository

1. Log into [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your Git repository: `enforesight-api`
4. Select the branch: `main` (production) or `feat/render-deploy` (staging)

### Step 2: Configure Service

Use these settings:

| Setting           | Value                          |
| ----------------- | ------------------------------ |
| **Name**          | `enforesight-api`              |
| **Region**        | Select closest to users        |
| **Branch**        | `main`                         |
| **Runtime**       | Node                           |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start`                    |
| **Plan**          | Starter+ (production)          |

### Step 3: Set Environment Variables

In Render dashboard, add these variables:

```bash
# Node Environment
NODE_ENV=production
PORT=10000

# API Configuration
API_BASE_URL=https://enforesight-api.onrender.com

# CORS Configuration
CORS_ORIGIN=https://enforesight.ai,https://www.enforesight.ai

# Clerk Authentication
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
CLERK_API_KEY=clerk_api_key_xxxxx

# Convex Database
CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOYMENT=prod:your-deployment-id
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# JWT Secret (⚠️ Generate strong secret)
JWT_SECRET=your_secure_random_string_here

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=your-email@example.com
SMTP_FROM_NAME=Enforesight

# OpenAI (if used)
OPENAI_API_KEY=sk-proj-xxxxx
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will automatically build and deploy
3. **Build time**: 2-3 minutes
4. Watch the deployment logs

---

## Environment Configuration

### Required Variables

#### Node Environment

```bash
NODE_ENV=production          # production, staging, or development
PORT=10000                   # Render automatically assigns this
```

#### Convex Database

```bash
# From Convex Dashboard
CONVEX_DEPLOYMENT=prod:your-id
CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

#### Authentication

```bash
# JWT Secret - Generate with: openssl rand -base64 32
JWT_SECRET=your_secure_random_string_here

# Clerk (if using for customer auth)
CLERK_SECRET_KEY=sk_live_xxxxx
CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxx
```

#### CORS & Security

```bash
# API Base URL
API_BASE_URL=https://enforesight-api.onrender.com

# Allowed Origins (comma-separated)
CORS_ORIGIN=https://enforesight.ai,https://www.enforesight.ai,https://customer-portal.com
```

#### Email Configuration

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Enforesight
```

---

## Convex Database Setup

### Development Database

```bash
# Create/use development database
npx convex dev

# Initialize default admin user
npx convex run users:initializeDefaultAdminSecure
```

### Production Database

```bash
# Deploy to production
npx convex deploy

# Initialize production admin user
npx convex run --prod users:initializeDefaultAdminSecure
```

### Database Schema

Deployed tables:

1. **Users** - Admin and editor accounts
   - Fields: username, password, name, role, active
   - Secure bcrypt password hashing

2. **Contents** - Static page content
   - Fields: title, slug, page, body, bullets, image, published
   - Index: by_slug

3. **Regulators** - Financial regulatory bodies
   - Fields: name, country, currency, active
   - Indexes: by_name, by_country, by_active

4. **Enforcements** - Enforcement actions
   - Fields: documentId, jurisdiction, regulatorName, sector, dateOfAction, enforcementActionType, violationTypes, fineAmount, currency
   - Filter by jurisdiction, regulator, sector

5. **Customers** - Customer/user accounts
   - Fields: clerkId, email, firstName, lastName, subscriptionTier, active
   - Sync with Clerk authentication

6. **Clients** - Client organizations
   - Fields: name, industry, contactEmail, contactPhone, address, active

---

## Verification

### 1. Health Check

```bash
curl https://enforesight-api.onrender.com/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

### 2. API Status

```bash
curl https://enforesight-api.onrender.com/api
```

Expected response:

```json
{
  "name": "Enforesight API",
  "version": "1.0.0",
  "status": "running",
  "environment": "production"
}
```

### 3. Test Authentication

```bash
# Login
curl -X POST https://enforesight-api.onrender.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_new_password"}'

# Use returned token to test protected endpoints
TOKEN="your_token_here"

curl -X GET https://enforesight-api.onrender.com/api/admin/contents \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Test Data APIs

```bash
# No authentication needed
curl https://enforesight-api.onrender.com/api/countries
curl https://enforesight-api.onrender.com/api/currencies
curl https://enforesight-api.onrender.com/api/sectors
curl https://enforesight-api.onrender.com/api/violation-types
```

---

## Troubleshooting

### Issue 1: 503 Service Unavailable

**Symptom**: All endpoints return 503

**Cause**: Service failed to start

**Solution**:

1. Check Render logs for build/runtime errors
2. Verify all environment variables are set
3. Confirm TypeScript compilation succeeded
4. Check Node version matches (v22.x)

### Issue 2: 401 Unauthorized on Protected Endpoints

**Symptom**: Protected endpoints return 401

**Cause**: Invalid or missing JWT token

**Solution**:

1. Login again to get new token: `POST /api/admin/login`
2. Include token in Authorization header: `Bearer <token>`
3. Check token expiration (24 hours)

### Issue 3: Convex Connection Error

**Symptom**: "Failed to connect to Convex" error

**Cause**: Wrong CONVEX_URL or CONVEX_DEPLOYMENT

**Solution**:

1. Verify values from Convex dashboard
2. Check spelling and format
3. Ensure environment variables are set in Render

### Issue 4: CORS Errors

**Symptom**: Frontend requests fail with CORS error

**Cause**: Origin not in CORS_ORIGIN list

**Solution**:

1. Add frontend URL to CORS_ORIGIN in Render environment
2. Restart the service
3. Clear browser cache

---

## Cold Start Handling

On Render's free tier, services spin down after 15 minutes of inactivity.

### First Request After Idle

- **Expected delay**: 30-60 seconds (cold start)
- **Timeout setting**: All endpoints have 60s timeout
- **User message**: "Service is starting, please wait..."

### Subsequent Requests

- **Expected delay**: 2-5 seconds (normal processing)
- **No special handling** needed

### Keep-Alive Strategy (Optional)

To prevent cold starts, ping health endpoint every 10 minutes:

```bash
# In your monitoring/cron service
curl -X GET https://enforesight-api.onrender.com/health
```

### Production Tier

For production with no cold starts:

- Use **Starter+ plan** ($7/month minimum)
- Eliminates cold start delays
- Always-on service

---

## Post-Deployment

### 1. Change Default Credentials

**CRITICAL**: Immediately change default admin password:

```bash
# Login with defaults
curl -X POST https://your-api.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Update password
curl -X PATCH https://your-api.com/api/admin/users/[admin-id] \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password":"new_secure_password"}'
```

### 2. Enable Monitoring

- Set up error logging (Sentry, Datadog, etc.)
- Configure uptime monitoring
- Set up alerts for failures

### 3. Configure Backups

- Enable Convex backups
- Set up database snapshots
- Test restore procedures

### 4. Security Hardening

- Enable HTTPS only (default on Render)
- Set secure headers (Helmet.js enabled)
- Configure DDoS protection
- Review and limit API access
- `DELETE /api/admin/regulators/:id` - Delete regulator

#### Enforcements CRUD

- `GET /api/admin/enforcements` - Get all enforcements
- `GET /api/admin/enforcements/:id` - Get enforcement by ID
- `POST /api/admin/enforcements` - Create new enforcement
- `PATCH /api/admin/enforcements/:id` - Update enforcement
- `DELETE /api/admin/enforcements/:id` - Delete enforcement

#### Clients CRUD

- `GET /api/admin/clients` - Get all clients
- `GET /api/admin/clients/:id` - Get client by ID
- `POST /api/admin/clients` - Create new client
- `PATCH /api/admin/clients/:id` - Update client
- `DELETE /api/admin/clients/:id` - Delete client

---

## Testing Results

### Users CRUD ✅

- ✅ GET all users
- ✅ CREATE user with secure password hashing
- ✅ GET user by ID
- ✅ UPDATE user
- ✅ LOGIN with hashed password verification
- ✅ JWT token generation

### Contents CRUD ✅

- ✅ GET all contents
- ✅ CREATE content
- ✅ GET content by ID
- ✅ UPDATE content
- ✅ DELETE content

### All Other CRUD Operations ✅

- ✅ Regulators, Enforcements, and Clients tables tested and functional

---

## Environment Variables

### Development (.env.local)

```bash
CONVEX_DEPLOYMENT=dev:acoustic-puffin-689
NEXT_PUBLIC_CONVEX_URL=https://acoustic-puffin-689.convex.cloud
CONVEX_URL=https://acoustic-puffin-689.convex.cloud
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-123456789
```

### Production

```bash
CONVEX_DEPLOYMENT=prod:disciplined-platypus-140
NEXT_PUBLIC_CONVEX_URL=https://disciplined-platypus-140.convex.cloud
CONVEX_URL=https://disciplined-platypus-140.convex.cloud
JWT_SECRET=<use-a-different-strong-secret-key>
```

---

## Security Enhancements Implemented

1. **Password Hashing**: bcryptjs with 10 salt rounds
2. **JWT Tokens**: 24-hour expiry, includes userId, username, and role
3. **Secure Actions**: Password verification using Convex actions with bcrypt
4. **No Plaintext Passwords**: All passwords stored as bcrypt hashes

---

## Next Steps / Recommendations

### High Priority

1. **Change default admin password** immediately in production
2. **Generate strong JWT_SECRET** for production (use 32+ character random string)
3. **Implement JWT verification middleware** for protected routes
4. **Add rate limiting** to login endpoint to prevent brute force attacks

### Medium Priority

1. **Add password reset functionality**
2. **Implement token refresh endpoint**
3. **Add user roles and permissions system**
4. **Add audit logging for all CRUD operations**

### Optional Enhancements

1. **Add email verification** for new users
2. **Implement 2FA (Two-Factor Authentication)**
3. **Add session management** and logout functionality
4. **Create admin dashboard UI**

---

## Files Modified/Created

### Created

- `convex/users.ts` - User management with secure authentication
- `convex/enforcements.ts` - Enforcement actions CRUD
- `convex/clients.ts` - Client management CRUD
- `src/routes/admin-crud.ts` - All CRUD API routes
- `src/utils/auth.ts` - JWT utilities
- `init-admin.sh` - Script to initialize default admin
- `docs/ADMIN_API.md` - API documentation

### Modified

- `convex/schema.ts` - Updated users table schema
- `convex/contents.ts` - Added getContentById
- `src/middleware/auth.ts` - Added requireClerkAuth
- `src/routes/api.ts` - Integrated admin-crud routes

---

## Documentation

Full API documentation available in: `docs/ADMIN_API.md`

---

## Support

For issues or questions:

- Email: support@enforesight.com
- Slack: #enforesight-api channel
- GitHub: Create an issue in the repository

---

**Deployment Status**: ✅ Successfully deployed and tested
**Deployment Date**: November 2, 2025
**Deployed By**: Automated deployment via Convex CLI
