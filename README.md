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
curl -X POST http://localhost:5011/api/admin/login \
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
- `POST /api/admin/login` - Login and get JWT token

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
- `PATCH /api/admin/users/:id/toggle-active` - Toggle user active status

## Available Scripts

```bash
# Development
npm run dev           # Start dev server with hot reload
npm run convex        # Start Convex dev server

# Production
npm run build         # Build TypeScript to JavaScript
npm start             # Start production server

# Testing
npm test              # Run Jest tests
./test-jwt-auth.sh    # Run JWT authentication tests

# Utilities
npm run clean         # Remove build directory
```

## Testing

Run the comprehensive authentication test suite:

```bash
# Make script executable (first time only)
chmod +x test-jwt-auth.sh

# Run all tests
./test-jwt-auth.sh
```

This will test:

- ✅ Login and token generation
- ✅ Protected endpoint access with valid token
- ✅ Rejection of requests without token
- ✅ Rejection of invalid tokens
- ✅ All CRUD endpoints
- ✅ Create and delete operations

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
│   ├── enforcements.ts       # Enforcement management (to be created)
│   ├── clients.ts            # Client management (to be created)
│   └── _generated/           # Auto-generated Convex types
├── docs/
│   ├── JWT_AUTHENTICATION.md # JWT authentication guide
│   └── ...                   # Other documentation
├── SETUP.md                  # Detailed setup instructions
├── .env.example              # Environment variables template
├── .env.local                # Environment variables (create this)
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── test-jwt-auth.sh          # Authentication test script
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
- � **[DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Deployment guide (especially after git pull)
- �🔐 **[JWT_AUTHENTICATION.md](./docs/JWT_AUTHENTICATION.md)** - JWT authentication documentation
- 📚 **[docs/](./docs/)** - Additional documentation

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

## Integrate with your tools

- [ ] [Set up project integrations](https://gitlab.com/enforesight-group/backend/api/enforesight-api/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thanks to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
```
