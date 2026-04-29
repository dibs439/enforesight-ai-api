# Enforesight API Documentation

Complete reference for all Enforesight API endpoints, including authentication, admin operations, customer portal, and data management.

## Table of Contents

1. [Authentication](#authentication)
2. [Admin API](#admin-api)
   - [Dashboard](#dashboard)
   - [Contents Management](#contents-management)
   - [Regulators Management](#regulators-management)
   - [Enforcements Management](#enforcements-management)
   - [Clients Management](#clients-management)
   - [Customers Management](#customers-management)
   - [Users Management](#users-management)
3. [Customer Portal API](#customer-portal-api)
4. [Data APIs](#data-apis)
   - [Countries](#countries)
   - [Currencies](#currencies)
   - [Sectors](#sectors)
   - [Violation Types](#violation-types)
   - [Enforcement Action Types](#enforcement-action-types)
5. [Image Upload](#image-upload)
6. [Bulk Upload](#bulk-upload)
7. [Error Handling](#error-handling)

---

## Authentication

### JWT Authentication Implementation

Successfully migrated to custom JWT authentication for all admin API endpoints. The system allows the API to work independently with authentication tokens from the login endpoint.

### JWT Authentication Middleware

The API uses a custom `requireJWTAuth` middleware that:

- Extracts JWT token from `Authorization: Bearer <token>` header
- Verifies token signature and expiration
- Attaches decoded user information to `req.user` object
- Returns 401 Unauthorized for missing or invalid tokens

### Login

**Endpoint:** `POST /api/admin/users/login`

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "k1234567890abcdef",
    "username": "admin",
    "name": "System Administrator",
    "role": "admin",
    "active": true
  },
  "message": "Login successful"
}
```

**Token Details:**

- **Expiry:** 24 hours
- **Algorithm:** HS256
- **Payload:** `{ userId, username, role }`

**Default Admin Credentials:**

- Username: `admin`
- Password: `admin123`
- ⚠️ **CRITICAL:** Change this password in production!

To reinitialize default admin user:

```bash
npx convex run users:initializeDefaultAdminSecure
```

---

## Admin API

**Base URL:** `http://localhost:5011/api/admin`

---

### Dashboard

Retrieve aggregated statistics for the admin panel overview.

#### Get Dashboard Stats

**Endpoint:** `GET /api/admin/dashboard`

**Response:**

```json
{
  "success": true,
  "data": {
    "customers": {
      "total": 120,
      "active": 98,
      "suspended": 22
    },
    "enforcements": {
      "total": 5430,
      "recent": 14
    }
  }
}
```

**Authentication:** All endpoints require JWT token in Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

### Contents Management

Manage static page content across the application.

#### Get All Contents

**Endpoint:** `GET /api/admin/contents`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "k1234567890abcdef",
      "title": "About Us",
      "slug": "about-us",
      "page": "about",
      "body": "Content body...",
      "bullets": ["Point 1", "Point 2"],
      "image": "https://example.com/image.jpg",
      "published": true,
      "createdAt": "2024-01-15T09:30:00Z",
      "updatedAt": "2024-01-15T09:30:00Z"
    }
  ]
}
```

#### Get Content by ID

**Endpoint:** `GET /api/admin/contents/:id`

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "k1234567890abcdef",
    "title": "About Us",
    "slug": "about-us",
    "page": "about",
    "body": "Content body...",
    "bullets": ["Point 1", "Point 2"],
    "image": "https://example.com/image.jpg",
    "published": true,
    "createdAt": "2024-01-15T09:30:00Z",
    "updatedAt": "2024-01-15T09:30:00Z"
  }
}
```

#### Create Content

**Endpoint:** `POST /api/admin/contents`

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "title": "About Us",
  "slug": "about-us",
  "page": "about",
  "body": "Content body...",
  "bullets": ["Point 1", "Point 2"],
  "image": "https://example.com/image.jpg",
  "published": true
}
```

**Response:**

```json
{
  "success": true,
  "id": "k1234567890abcdef"
}
```

#### Update Content

**Endpoint:** `PATCH /api/admin/contents/:id`

**Content-Type:** `application/json`

**Request Body:** (Any fields to update)

```json
{
  "title": "About Us - Updated",
  "body": "Updated content body..."
}
```

**Response:**

```json
{
  "success": true,
  "message": "Content updated successfully"
}
```

#### Delete Content

**Endpoint:** `DELETE /api/admin/contents/:id`

**Response:**

```json
{
  "success": true,
  "message": "Content deleted successfully"
}
```

---

### Regulators Management

Manage financial regulatory bodies.

#### Regulator Object

```json
{
  "_id": "k17h8qj2x9z8y6w5v4u3t2s1",
  "name": "Securities and Exchange Commission",
  "country": "United States",
  "currency": "USD",
  "active": true,
  "createdAt": "2024-01-15T09:30:00Z",
  "updatedAt": "2024-01-15T09:30:00Z"
}
```

#### Get All Regulators

**Endpoint:** `GET /api/admin/regulators`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "k17h8qj2x9z8y6w5v4u3t2s1",
      "name": "Securities and Exchange Commission",
      "country": "United States",
      "currency": "USD",
      "active": true,
      "createdAt": "2024-01-15T09:30:00Z",
      "updatedAt": "2024-01-15T09:30:00Z"
    }
  ]
}
```

#### Get Regulator by ID

**Endpoint:** `GET /api/admin/regulators/:id`

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "k17h8qj2x9z8y6w5v4u3t2s1",
    "name": "Securities and Exchange Commission",
    "country": "United States",
    "currency": "USD",
    "active": true,
    "createdAt": "2024-01-15T09:30:00Z",
    "updatedAt": "2024-01-15T09:30:00Z"
  }
}
```

#### Create Regulator

**Endpoint:** `POST /api/admin/regulators`

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "name": "Securities and Exchange Commission",
  "country": "United States",
  "currency": "USD",
  "active": true
}
```

**Response:**

```json
{
  "success": true,
  "id": "k17h8qj2x9z8y6w5v4u3t2s1"
}
```

#### Update Regulator

**Endpoint:** `PATCH /api/admin/regulators/:id`

**Content-Type:** `application/json`

**Request Body:** (Any fields to update)

```json
{
  "active": false
}
```

#### Delete Regulator

**Endpoint:** `DELETE /api/admin/regulators/:id`

---

### Enforcements Management

Manage enforcement actions taken by regulators.

#### Enforcement Object

```json
{
  "_id": "k9876543210abcdef",
  "documentId": "ENF-2024-001",
  "jurisdiction": "United States",
  "regulatorName": "SEC",
  "subjectName": "Example Corp",
  "sector": "Financial Services",
  "dateOfAction": "2024-01-15",
  "enforcementActionType": ["Financial Penalty", "Cease and Desist"],
  "field": "Securities Violations",
  "violationTypes": ["Insider Trading", "Market Manipulation"],
  "fineAmount": 500000,
  "currency": "USD",
  "enforcementNoticeUrl": "https://example.com/notice.pdf",
  "enforcementFile": "notice_2024_01_15.pdf",
  "createdAt": "2024-01-15T09:30:00Z",
  "updatedAt": "2024-01-15T09:30:00Z"
}
```

#### Get All Enforcements

**Endpoint:** `GET /api/admin/enforcements`

**Query Parameters:**

| Parameter      | Type   | Description                  |
| -------------- | ------ | ---------------------------- |
| `regulator`    | string | Filter by regulator name     |
| `jurisdiction` | string | Filter by jurisdiction       |
| `sector`       | string | Filter by sector             |
| `page`         | number | Pagination page (default: 1) |
| `limit`        | number | Items per page (default: 20) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "k9876543210abcdef",
      "documentId": "ENF-2024-001",
      "jurisdiction": "United States",
      "regulatorName": "SEC",
      "subjectName": "Example Corp",
      "sector": "Financial Services",
      "dateOfAction": "2024-01-15",
      "enforcementActionType": ["Financial Penalty", "Cease and Desist"],
      "field": "Securities Violations",
      "violationTypes": ["Insider Trading", "Market Manipulation"],
      "fineAmount": 500000,
      "currency": "USD",
      "enforcementNoticeUrl": "https://example.com/notice.pdf",
      "enforcementFile": "notice_2024_01_15.pdf",
      "createdAt": "2024-01-15T09:30:00Z",
      "updatedAt": "2024-01-15T09:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

#### Get Enforcement by ID

**Endpoint:** `GET /api/admin/enforcements/:id`

#### Create Enforcement

**Endpoint:** `POST /api/admin/enforcements`

**Content-Type:** `multipart/form-data` (for file upload) or `application/json`

**Request Body:**

```json
{
  "documentId": "ENF-2024-001",
  "jurisdiction": "United States",
  "regulatorName": "SEC",
  "subjectName": "Example Corp",
  "sector": "Financial Services",
  "dateOfAction": "2024-01-15",
  "enforcementActionType": ["Financial Penalty", "Cease and Desist"],
  "field": "Securities Violations",
  "violationTypes": ["Insider Trading", "Market Manipulation"],
  "fineAmount": 500000,
  "currency": "USD",
  "enforcementNoticeUrl": "https://example.com/notice.pdf"
}
```

**With File Upload:**

```
POST /api/admin/enforcements
Content-Type: multipart/form-data

documentId: ENF-2024-002
jurisdiction: United States
regulatorName: CFTC
subjectName: Trading Firm LLC
sector: Commodities
dateOfAction: 2024-02-01
enforcementActionType: Financial Penalty
field: Commodity Trading
violationTypes: Price Manipulation,Reporting Violations
fineAmount: 250000
currency: USD
enforcementFile: [PDF file upload]
```

**PDF Processing Priority:**

1. **URL First:** If `enforcementNoticeUrl` is provided, it takes priority
2. **File Upload:** If no URL provided, uploaded `enforcementFile` is processed
3. **Skip:** If URL is provided, uploaded file is ignored

**File Upload Rules:**

- Maximum file size: **10MB**
- Supported format: **PDF only**
- Upload field name: `enforcementFile`
- Uploaded files stored in: `uploads/enforcements/`

**Response:**

```json
{
  "success": true,
  "id": "k9876543210abcdef"
}
```

#### Update Enforcement

**Endpoint:** `PATCH /api/admin/enforcements/:id`

**Content-Type:** `application/json` or `multipart/form-data`

#### Delete Enforcement

**Endpoint:** `DELETE /api/admin/enforcements/:id`

#### Enforcement Filtering

Enforcements can be filtered by multiple criteria:

**Example:** Get all SEC enforcements in the US with financial penalties

```
GET /api/admin/enforcements?regulator=SEC&jurisdiction=United States&sector=Financial Services
```

---

### Clients Management

Manage API client organisations (white-label partners).

#### Get All Clients

**Endpoint:** `GET /api/admin/clients`

#### Get Client by ID

**Endpoint:** `GET /api/admin/clients/:id`

#### Create Client

**Endpoint:** `POST /api/admin/clients`

**Content-Type:** `multipart/form-data`

Supports optional logo image upload (`logo` field, max 5 MB).

#### Update Client

**Endpoint:** `PATCH /api/admin/clients/:id`

**Content-Type:** `application/json` or `multipart/form-data`

#### Delete Client

**Endpoint:** `DELETE /api/admin/clients/:id`

---

### Customers Management

Manage customer accounts and profiles.

#### Customer Object

```json
{
  "_id": "customer_123",
  "clerkId": "user_abc123",
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "imageUrl": "https://example.com/avatar.jpg",
  "active": true,
  "subscriptionTier": "premium",
  "phoneNumber": "+1-555-123-4567",
  "occupation": "Software Engineer",
  "isSuspended": false,
  "lastSignInAt": "2024-01-15T10:30:00Z",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

#### Get All Customers

**Endpoint:** `GET /api/admin/customers`

**Query Parameters:**

| Parameter          | Type    | Default | Description                          |
| ------------------ | ------- | ------- | ------------------------------------ |
| `page`             | number  | 1       | Page number for pagination           |
| `limit`            | number  | 20      | Items per page                       |
| `search`           | string  | -       | Search by email, firstName, lastName |
| `active`           | boolean | -       | Filter by active status              |
| `subscriptionTier` | string  | -       | Filter by subscription tier          |

**Example Request:**

```
GET /api/admin/customers?page=1&limit=10&search=john&active=true&subscriptionTier=premium
```

**Response:**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "_id": "customer_123",
        "clerkId": "user_abc123",
        "email": "john.doe@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "imageUrl": "https://example.com/avatar.jpg",
        "active": true,
        "subscriptionTier": "premium",
        "phoneNumber": "+1-555-123-4567",
        "occupation": "Software Engineer",
        "isSuspended": false,
        "lastSignInAt": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "statusCode": 200
}
```

#### Get Customer by ID

**Endpoint:** `GET /api/admin/customers/:id`

#### Create Customer

**Endpoint:** `POST /api/admin/customers`

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "subscriptionTier": "premium"
}
```

#### Update Customer

**Endpoint:** `PATCH /api/admin/customers/:id`

**Content-Type:** `application/json`

#### Delete Customer

**Endpoint:** `DELETE /api/admin/customers/:id`

---

### Users Management

Manage admin and editor user accounts.

#### User Object

```json
{
  "_id": "k1234567890abcdef",
  "username": "admin",
  "password": "$2b$10$...", // bcrypt hash
  "name": "System Administrator",
  "role": "admin",
  "active": true,
  "createdAt": "2024-01-15T09:30:00Z",
  "updatedAt": "2024-01-15T09:30:00Z"
}
```

#### Get All Users

**Endpoint:** `GET /api/admin/users`

#### Get User by ID

**Endpoint:** `GET /api/admin/users/:id`

#### Create User

**Endpoint:** `POST /api/admin/users`

**Content-Type:** `application/json`

**Request Body:**

```json
{
  "username": "editor1",
  "password": "secure_password_here",
  "name": "Content Editor",
  "role": "editor",
  "active": true
}
```

**Password Requirements:**

- Minimum 8 characters
- Must contain uppercase letter, lowercase letter, number, special character

#### Update User

**Endpoint:** `PATCH /api/admin/users/:id`

**Content-Type:** `application/json`

#### Delete User

**Endpoint:** `DELETE /api/admin/users/:id`

---

## Customer Portal API

**Base URL:** `http://localhost:5011/api/customer-portal`

### Webhook Integration with Clerk

The Customer Portal API provides endpoints for managing customers and handling Clerk authentication webhooks. The system automatically creates and manages customer records when users sign up through Clerk.

#### Clerk Webhook Configuration

1. In your Clerk Dashboard, go to **Webhooks**
2. Click **Add Endpoint**
3. Set the endpoint URL: `https://your-domain.com/api/customer-portal/webhooks/clerk`
4. Subscribe to events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
5. Copy the **Signing Secret** and set as `CLERK_WEBHOOK_SECRET` in `.env`

#### Handle Clerk Webhooks

**Endpoint:** `POST /api/customer-portal/webhooks/clerk`

**Headers Required:**

```
Content-Type: application/json
svix-id: <webhook-id>
svix-timestamp: <timestamp>
svix-signature: <signature>
```

**Supported Events:**

- `user.created` - Creates new customer record
- `user.updated` - Updates customer profile
- `user.deleted` - Removes customer record

**Response:**

```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

#### Get All Customers

**Endpoint:** `GET /api/customer-portal/customers`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "j971bn528dm60vde5ewadgsqyx7tj0zc",
      "clerkId": "user_34ayKxM8IHQEtkKVAoRjbtE7say",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "imageUrl": "https://img.clerk.com/...",
      "active": true,
      "subscriptionTier": "free",
      "lastSignInAt": "2025-11-15T10:30:00.000Z",
      "createdAt": "2025-11-15T10:00:00.000Z",
      "updatedAt": "2025-11-15T10:30:00.000Z"
    }
  ]
}
```

#### Get Customer by ID

**Endpoint:** `GET /api/customer-portal/customers/:id`

#### Get Current Authenticated Customer

**Endpoint:** `GET /api/customer-portal/customers/me`

**Authentication:** Clerk JWT token in `Authorization` header

---

## Data APIs

### Countries

Retrieve available countries.

**Endpoint:** `GET /api/countries`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "k1234567890abcdef",
      "name": "United States",
      "code": "US",
      "active": true
    }
  ]
}
```

### Currencies

Retrieve available currencies.

**Endpoint:** `GET /api/currencies`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "k1234567890abcdef",
      "name": "United States Dollar",
      "code": "USD",
      "symbol": "$",
      "active": true
    }
  ]
}
```

### Sectors

Retrieve available business sectors.

**Endpoint:** `GET /api/sectors`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "k1234567890abcdef",
      "name": "Financial Services",
      "description": "Banking, insurance, and investment services",
      "active": true
    }
  ]
}
```

### Violation Types

Retrieve available violation types.

**Endpoint:** `GET /api/violation-types`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "k1234567890abcdef",
      "name": "Insider Trading",
      "description": "Trading securities based on material non-public information",
      "category": "Securities",
      "active": true
    }
  ]
}
```

### Enforcement Action Types

Retrieve available enforcement action types.

**Endpoint:** `GET /api/enforcement-action-types`

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "_id": "k1234567890abcdef",
      "name": "Financial Penalty",
      "description": "Monetary penalty imposed by regulator",
      "active": true
    },
    {
      "_id": "k0987654321fedcba",
      "name": "Cease and Desist",
      "description": "Order to stop specific business activity",
      "active": true
    }
  ]
}
```

---

## Image Upload

Upload images for content and enforcement documents.

**Endpoint:** `POST /api/admin/upload`

**Content-Type:** `multipart/form-data`

**Request Body:**

```
Content-Type: multipart/form-data

file: [image file]
```

**Supported Formats:**

- `image/jpeg`
- `image/png`
- `image/webp`
- `image/gif`

**Maximum File Size:** 5MB

**Response:**

```json
{
  "success": true,
  "url": "https://example.com/uploads/images/image_123.jpg",
  "filename": "image_123.jpg"
}
```

---

## Bulk Upload

### Bulk Upload CSV Format

For bulk importing enforcement records, use the CSV template provided.

**File:** `enforcement-bulk-upload-template.csv`

#### CSV Columns

| Column                  | Type   | Required | Description                     |
| ----------------------- | ------ | -------- | ------------------------------- |
| `documentId`            | string | Yes      | Unique identifier               |
| `jurisdiction`          | string | Yes      | Country/region                  |
| `regulatorName`         | string | Yes      | Regulator abbreviation          |
| `subjectName`           | string | Yes      | Sanctioned entity name          |
| `sector`                | string | Yes      | Business sector                 |
| `dateOfAction`          | date   | Yes      | YYYY-MM-DD format               |
| `enforcementActionType` | string | Yes      | Comma-separated action types    |
| `field`                 | string | No       | Field of violation              |
| `violationTypes`        | string | No       | Comma-separated violation types |
| `fineAmount`            | number | No       | Monetary penalty                |
| `currency`              | string | No       | Currency code (USD, GBP, etc.)  |
| `enforcementNoticeUrl`  | string | No       | URL to enforcement notice       |

#### Example CSV

```csv
documentId,jurisdiction,regulatorName,subjectName,sector,dateOfAction,enforcementActionType,field,violationTypes,fineAmount,currency,enforcementNoticeUrl
ENF-2024-001,United States,SEC,Example Corp,Financial Services,2024-01-15,Financial Penalty,Securities Violations,Insider Trading,500000,USD,https://example.com/notice.pdf
ENF-2024-002,United States,CFTC,Trading Firm LLC,Commodities,2024-02-01,Cease and Desist,Commodity Trading,Price Manipulation,250000,USD,
```

**Endpoint:** `POST /api/admin/bulk-upload`

**Content-Type:** `multipart/form-data`

**Request Body:**

```
Content-Type: multipart/form-data

file: [CSV file]
```

**Response:**

```json
{
  "success": true,
  "message": "Bulk upload completed",
  "imported": 10,
  "skipped": 0,
  "errors": []
}
```

---

## Error Handling

All endpoints return consistent error responses.

### Error Response Format

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common HTTP Status Codes

| Status | Description                                  |
| ------ | -------------------------------------------- |
| 200    | Success                                      |
| 201    | Created                                      |
| 400    | Bad Request - Invalid input                  |
| 401    | Unauthorized - Missing or invalid token      |
| 403    | Forbidden - Insufficient permissions         |
| 404    | Not Found - Resource doesn't exist           |
| 409    | Conflict - Duplicate or constraint violation |
| 500    | Internal Server Error                        |

### Common Error Messages

| Error                         | Cause                       | Solution                            |
| ----------------------------- | --------------------------- | ----------------------------------- |
| `Missing authorization token` | No token in header          | Add `Authorization: Bearer <token>` |
| `Invalid token`               | Expired or malformed token  | Login again to get new token        |
| `Validation error`            | Invalid input data          | Check required fields and formats   |
| `Resource not found`          | ID doesn't exist            | Verify correct ID                   |
| `Duplicate entry`             | Unique constraint violation | Check for duplicates                |

---

## Rate Limiting

Currently no rate limiting is implemented. Production deployments should add rate limiting.

## CORS Configuration

CORS is enabled for the following origins:

```
http://localhost:3000
http://localhost:3001
https://customer-portal-enforesight.vercel.app
https://enforesight-frontend.onrender.com
```

To add additional origins, update `CORS_ORIGIN` in your `.env` file (comma-separated).

---

## Health Check

**Endpoint:** `GET /health`

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## API Status

**Endpoint:** `GET /api`

**Response:**

```json
{
  "name": "Enforesight API",
  "version": "1.0.0",
  "status": "running",
  "environment": "development"
}
```
