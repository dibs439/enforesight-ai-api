# Manual Testing Suites

## Admin Panel & Customer Portal

**Last Updated:** 25 April 2026  
**Test Coverage:** Admin API & Customer Portal  
**API Base URLs:**

- Admin: `http://localhost:3000/api/admin`
- Customer: `http://localhost:3000/api/customer`

---

## Table of Contents

1. [Authentication Testing](#authentication-testing)
2. [Admin Panel Testing](#admin-panel-testing)
3. [Customer Portal Testing](#customer-portal-testing)
4. [Integration Testing](#integration-testing)
5. [Error Handling & Edge Cases](#error-handling--edge-cases)

---

## Authentication Testing

### TS-AUTH-001: User Login

**Objective:** Verify user login functionality

**Preconditions:**

- API server is running
- Default admin user exists (admin/admin123)

**Test Steps:**

1. Send `POST /api/admin/users/login` with credentials:
   ```json
   {
     "username": "admin",
     "password": "admin123"
   }
   ```
2. Verify response contains JWT token
3. Copy token for use in subsequent tests

**Expected Results:**

- Status: 200 OK
- Response includes `token`, `user`, and `success: true`
- Token is a valid JWT (can be decoded)
- Token expires in 24 hours

**Tools:** Postman, cURL

---

### TS-AUTH-002: JWT Token Validation

**Objective:** Verify JWT authentication for protected endpoints

**Preconditions:**

- Valid JWT token from TS-AUTH-001

**Test Steps:**

1. Call any protected admin endpoint with header: `Authorization: Bearer <token>`
2. Verify endpoint responds with 200
3. Call same endpoint without Authorization header
4. Call with invalid token
5. Call with expired token (if available)

**Expected Results:**

- With valid token: 200 OK
- Without token: 401 Unauthorized
- With invalid token: 401 Unauthorized
- With expired token: 401 Unauthorized

---

### TS-AUTH-003: Unauthorized Access

**Objective:** Verify unauthorized users cannot access admin endpoints

**Test Steps:**

1. Call `GET /api/admin/dashboard` without token
2. Call `POST /api/admin/contents` without token
3. Attempt with malformed Authorization header

**Expected Results:**

- All requests return 401 Unauthorized
- Error message indicates missing or invalid token

---

## Admin Panel Testing

### TS-ADMIN-001: Dashboard Stats

**Objective:** Verify dashboard retrieves aggregated statistics

**Test Steps:**

1. Authenticate with admin credentials
2. Call `GET /api/admin/dashboard`
3. Verify response structure
4. Create/update records and verify stats update

**Expected Results:**

- Status: 200 OK
- Response includes: `customers`, `enforcements`, `active/total counts`
- Stats are accurate based on database records

---

### TS-ADMIN-002: Contents Management - List

**Objective:** Verify retrieving all content pages

**Test Steps:**

1. Call `GET /api/admin/contents`
2. Verify response contains array of content objects
3. Check pagination if implemented
4. Filter by type/category if supported

**Expected Results:**

- Status: 200 OK
- Array contains all content items
- Each item has: id, title, slug, type, content, status
- Sorting/filtering works correctly

---

### TS-ADMIN-003: Contents Management - Create

**Objective:** Verify creating new content page

**Test Steps:**

1. Call `POST /api/admin/contents` with:
   ```json
   {
     "title": "Terms & Conditions",
     "slug": "terms-and-conditions",
     "type": "legal",
     "content": "<h1>T&C Content</h1>",
     "status": "published"
   }
   ```
2. Verify content is created
3. Retrieve it with GET and verify details

**Expected Results:**

- Status: 201 Created
- Response includes created content with ID
- Content is queryable immediately after creation

---

### TS-ADMIN-004: Contents Management - Update

**Objective:** Verify updating existing content

**Test Steps:**

1. Create content (TS-ADMIN-003)
2. Call `PATCH /api/admin/contents/<id>` with updated data
3. Verify changes are reflected
4. Attempt partial update (some fields only)

**Expected Results:**

- Status: 200 OK
- Only specified fields are updated
- Other fields remain unchanged

---

### TS-ADMIN-005: Contents Management - Delete

**Objective:** Verify deleting content

**Test Steps:**

1. Create content (TS-ADMIN-003)
2. Call `DELETE /api/admin/contents/<id>`
3. Verify content is deleted
4. Attempt to retrieve deleted content

**Expected Results:**

- Status: 204 No Content or 200 OK
- Content cannot be retrieved afterward (404)

---

### TS-ADMIN-006: Regulators Management - List

**Objective:** Verify retrieving all regulators

**Test Steps:**

1. Call `GET /api/admin/regulators`
2. Verify response contains array of regulators
3. Test pagination/filtering

**Expected Results:**

- Status: 200 OK
- Array contains all regulator records
- Each item has: id, name, code, country, jurisdiction, active status

---

### TS-ADMIN-007: Regulators Management - Create

**Objective:** Verify creating new regulator

**Test Steps:**

1. Call `POST /api/admin/regulators` with:
   ```json
   {
     "name": "Financial Conduct Authority",
     "code": "FCA",
     "country": "UK",
     "jurisdiction": "EMEA",
     "active": true
   }
   ```
2. Verify regulator is created
3. Verify uniqueness constraint (code)

**Expected Results:**

- Status: 201 Created
- Regulator record is created with unique code
- Duplicate codes are rejected

---

### TS-ADMIN-008: Enforcements Management - List

**Objective:** Verify retrieving all enforcements

**Test Steps:**

1. Call `GET /api/admin/enforcements`
2. Test with filters: regulator, year, jurisdiction, status
3. Test pagination
4. Test sorting

**Expected Results:**

- Status: 200 OK
- Results filtered correctly
- Pagination works (limit, offset/page)
- Sorting by date, amount, status works

---

### TS-ADMIN-009: Enforcements Management - Create

**Objective:** Verify creating new enforcement record

**Test Steps:**

1. Call `POST /api/admin/enforcements` with form data:
   - Text fields: subject, violation type, amount, regulator
   - Optional PDF file upload (multipart/form-data)
   - Optional enforcement notice URL
2. Verify record is created
3. Verify file is stored if uploaded
4. Verify vector embeddings are generated

**Expected Results:**

- Status: 201 Created
- Enforcement record created with all fields
- PDF file stored at `/var/data/enforcements/` (production) or `uploads/enforcements/` (dev)
- File path recorded in `enforcementFile` field
- Embeddings generated for search

---

### TS-ADMIN-010: Enforcements Management - Update

**Objective:** Verify updating enforcement record

**Test Steps:**

1. Create enforcement (TS-ADMIN-009)
2. Call `PATCH /api/admin/enforcements/<id>` with:
   - Text field updates
   - New PDF file (replaces old)
   - Enforcement notice data changes
3. Verify partial updates work
4. Verify file replacement works

**Expected Results:**

- Status: 200 OK
- Fields updated correctly
- Old file is handled appropriately (backup/delete)
- Manual `enforcementNoticeData` edits are preserved
- Embeddings regenerated for updated content

---

### TS-ADMIN-011: Enforcements Management - Download PDF

**Objective:** Verify downloading uploaded enforcement PDF

**Test Steps:**

1. Create enforcement with PDF file (TS-ADMIN-009)
2. Call `GET /api/admin/enforcements/<id>/file`
3. Verify file is returned with correct headers
4. Attempt download on enforcement without file
5. Attempt download with invalid ID

**Expected Results:**

- Status: 200 OK with PDF file
- Content-Type: application/pdf
- Content-Length header present
- Content-Disposition: attachment header set
- 404 if file not found

---

### TS-ADMIN-012: Enforcements Management - Delete

**Objective:** Verify deleting enforcement record

**Test Steps:**

1. Create enforcement (TS-ADMIN-009)
2. Call `DELETE /api/admin/enforcements/<id>`
3. Verify record is deleted
4. Verify associated file is deleted/archived
5. Verify vectors are removed from search

**Expected Results:**

- Status: 204 No Content or 200 OK
- Record cannot be retrieved (404)
- Associated files cleaned up
- Record doesn't appear in search results

---

### TS-ADMIN-013: Enforcements Management - Bulk Upload

**Objective:** Verify CSV bulk upload functionality

**Test Steps:**

1. Prepare CSV file with enforcement records (see BULK_UPLOAD_CSV_FORMAT.md)
2. Call `POST /api/admin/enforcements/bulk-upload` with CSV file
3. Verify all records are processed
4. Test with duplicate records
5. Test with invalid/malformed data

**Expected Results:**

- Status: 200 OK
- Response indicates: total records, created, duplicates, errors
- Valid records are inserted
- Duplicates are detected and skipped
- Invalid records generate detailed error messages with row numbers

---

### TS-ADMIN-014: Clients Management - List

**Objective:** Verify retrieving all clients

**Test Steps:**

1. Call `GET /api/admin/clients`
2. Test filtering by status, sector, country
3. Test pagination and sorting

**Expected Results:**

- Status: 200 OK
- Array contains all client records
- Filters work correctly
- Pagination/sorting functional

---

### TS-ADMIN-015: Clients Management - Create

**Objective:** Verify creating new client

**Test Steps:**

1. Call `POST /api/admin/clients` with:
   ```json
   {
     "name": "Acme Corporation",
     "email": "contact@acme.com",
     "phone": "+1234567890",
     "sector": "Technology",
     "country": "US",
     "status": "active"
   }
   ```
2. Verify client is created
3. Verify email uniqueness

**Expected Results:**

- Status: 201 Created
- Client created with all fields
- Duplicate emails rejected

---

### TS-ADMIN-016: Customers Management - List

**Objective:** Verify retrieving all customers

**Test Steps:**

1. Call `GET /api/admin/customers`
2. Test filtering by status, subscription, created date
3. Test pagination

**Expected Results:**

- Status: 200 OK
- All customers listed with correct fields
- Filtering and pagination work

---

### TS-ADMIN-017: Customers Management - Create

**Objective:** Verify creating new customer

**Test Steps:**

1. Call `POST /api/admin/customers` with:
   ```json
   {
     "name": "John Doe",
     "email": "john@example.com",
     "client_id": "<valid-client-id>",
     "subscription": "premium",
     "status": "active"
   }
   ```
2. Verify customer is created
3. Link to client is established

**Expected Results:**

- Status: 201 Created
- Customer created and linked to client
- Email uniqueness enforced

---

### TS-ADMIN-018: Users Management - List

**Objective:** Verify retrieving all admin users

**Test Steps:**

1. Call `GET /api/admin/users`
2. Verify only admin users are returned
3. Sensitive fields (password) are not exposed

**Expected Results:**

- Status: 200 OK
- All users listed
- No password hashes in response

---

### TS-ADMIN-019: Users Management - Create

**Objective:** Verify creating new admin user

**Test Steps:**

1. Call `POST /api/admin/users` with:
   ```json
   {
     "username": "newadmin",
     "password": "SecurePassword123!",
     "name": "New Admin User",
     "email": "admin@example.com",
     "role": "admin"
   }
   ```
2. Verify user is created
3. Test login with new credentials

**Expected Results:**

- Status: 201 Created
- User created and can login
- Duplicate username rejected

---

### TS-ADMIN-020: Users Management - Update Password

**Objective:** Verify updating user password

**Test Steps:**

1. Call `PATCH /api/admin/users/<id>` with:
   ```json
   {
     "password": "NewPassword456!"
   }
   ```
2. Test login with old password (should fail)
3. Test login with new password (should succeed)

**Expected Results:**

- Status: 200 OK
- Old password no longer works
- New password works immediately

---

### TS-ADMIN-021: Users Management - Delete

**Objective:** Verify deleting admin user

**Test Steps:**

1. Create user (TS-ADMIN-019)
2. Call `DELETE /api/admin/users/<id>`
3. Verify user cannot login
4. Verify user doesn't appear in list

**Expected Results:**

- Status: 204 No Content
- User deleted and unusable
- System maintains audit trail

---

## Customer Portal Testing

### TS-CUSTOMER-001: Customer Profile Access

**Objective:** Verify customer can view their profile

**Test Steps:**

1. Authenticate as customer
2. Call `GET /api/customer/profile`
3. Verify profile data matches customer record
4. Check all profile fields are present

**Expected Results:**

- Status: 200 OK
- Profile data includes: name, email, company, subscription, status
- Data is read-only or editable per requirements

---

### TS-CUSTOMER-002: Customer Profile Update

**Objective:** Verify customer can update their profile

**Test Steps:**

1. Call `PATCH /api/customer/profile` with:
   ```json
   {
     "phone": "+9999999999",
     "title": "CFO"
   }
   ```
2. Verify changes are saved
3. Verify restricted fields (subscription, status) cannot be changed

**Expected Results:**

- Status: 200 OK
- Editable fields are updated
- Restricted fields are rejected or ignored

---

### TS-CUSTOMER-003: Content Browsing

**Objective:** Verify customer can browse public content

**Test Steps:**

1. Call `GET /api/customer/content`
2. Verify only published content is returned
3. Check filtering and search functionality

**Expected Results:**

- Status: 200 OK
- Published content visible
- Draft/hidden content not visible
- Search/filter works

---

### TS-CUSTOMER-004: Enforcement Search

**Objective:** Verify customer can search enforcements

**Test Steps:**

1. Call `GET /api/customer/customer/portal/enforcements` with:
   - Query search term
   - Filters: regulator, year, jurisdiction, amount range
2. Verify results match search criteria
3. Test pagination

**Expected Results:**

- Status: 200 OK
- Results match search query
- Filters applied correctly
- Pagination works

---

### TS-CUSTOMER-005: Enforcement Details

**Objective:** Verify customer can view enforcement details

**Test Steps:**

1. Search for enforcement (TS-CUSTOMER-004)
2. Call `GET /api/customer/customer/portal/enforcements/<id>`
3. Verify full details including summary, attached documents

**Expected Results:**

- Status: 200 OK
- Complete enforcement details displayed
- Any associated files/links accessible

---

### TS-CUSTOMER-006: Download Enforcement Document

**Objective:** Verify customer can download enforcement PDF

**Test Steps:**

1. View enforcement details (TS-CUSTOMER-005)
2. Click/call download endpoint for PDF
3. Verify file downloads successfully

**Expected Results:**

- PDF file downloaded
- File integrity verified (not corrupted)
- Correct enforcement data

---

### TS-CUSTOMER-007: Conversation History

**Objective:** Verify customer can view conversation history

**Test Steps:**

1. Call `GET /api/customer/customer/conversations`
2. Verify customer's conversations are listed
3. Test pagination and sorting
4. Verify other customers' conversations are not visible

**Expected Results:**

- Status: 200 OK
- Only own conversations visible
- Sorted by date (newest first)
- Pagination works

---

### TS-CUSTOMER-008: Start New Conversation

**Objective:** Verify customer can start new conversation

**Test Steps:**

1. Call `POST /api/customer/customer/conversations` with:
   ```json
   {
     "subject": "Query about enforcement record"
   }
   ```
2. Verify conversation is created
3. Verify customer is associated

**Expected Results:**

- Status: 201 Created
- Conversation created with unique ID
- Customer linked automatically

---

### TS-CUSTOMER-009: Send Chat Message

**Objective:** Verify customer can send and receive chat messages

**Test Steps:**

1. Create/get conversation (TS-CUSTOMER-008)
2. Call `POST /api/customer/chat` with message:
   ```json
   {
     "message": "Can you explain this enforcement?",
     "conversationId": "<id>"
   }
   ```
3. Verify message is sent
4. Verify AI response is generated
5. Verify message history is maintained

**Expected Results:**

- Status: 200 OK
- Message saved to conversation
- AI response generated within ~3-5 seconds
- Full conversation history accessible

---

### TS-CUSTOMER-010: Chat Search

**Objective:** Verify customer can search previous conversations

**Test Steps:**

1. Call `GET /api/customer/customer/conversations?search=<query>`
2. Search for conversations by subject/keyword
3. Verify results match search term

**Expected Results:**

- Status: 200 OK
- Matching conversations returned
- Non-matching conversations excluded

---

### TS-CUSTOMER-011: Client Portal Access

**Objective:** Verify customer can access client portal content

**Test Steps:**

1. Call `GET /api/customer/clients`
2. Verify client information is accessible
3. Verify only client's content visible

**Expected Results:**

- Status: 200 OK
- Client details available
- Content filtered by client

---

### TS-CUSTOMER-012: Favorite Enforcements

**Objective:** Verify customer can favorite/bookmark enforcements

**Test Steps:**

1. Search enforcements (TS-CUSTOMER-004)
2. Call endpoint to add enforcement to favorites
3. Retrieve favorite list
4. Remove favorite and verify removal

**Expected Results:**

- Enforcement added to favorites
- Appears in favorite list
- Can be removed
- Persists across sessions

---

## Integration Testing

### TS-INT-001: Admin Creates Enforcement → Customer Searches

**Objective:** Verify end-to-end enforcement visibility

**Test Steps:**

1. Admin creates enforcement with PDF (TS-ADMIN-009)
2. Customer searches for the enforcement (TS-CUSTOMER-004)
3. Customer can view details and download PDF

**Expected Results:**

- Enforcement immediately visible to customer
- All details and files accessible
- No latency issues

---

### TS-INT-002: Admin Updates Content → Customer Views

**Objective:** Verify content updates visible to customers

**Test Steps:**

1. Admin creates/updates content (TS-ADMIN-003/004)
2. Customer browses content (TS-CUSTOMER-003)
3. Verify updated content is visible
4. Test real-time updates if implemented

**Expected Results:**

- Changes visible within seconds
- All formatting/media preserved
- No stale cache issues

---

### TS-INT-003: Customer Creates Conversation → Admin Receives

**Objective:** Verify admin notification of new customer conversations

**Test Steps:**

1. Customer starts conversation (TS-CUSTOMER-008)
2. Admin checks customer support queue/dashboard
3. Verify conversation appears for admin review

**Expected Results:**

- Conversation visible in admin panel
- Timestamp and customer info correct
- Admin can respond if needed

---

### TS-INT-004: File Upload & Download Chain

**Objective:** Verify file integrity through upload/download cycle

**Test Steps:**

1. Admin uploads PDF (TS-ADMIN-009)
2. Verify file stored correctly
3. Customer downloads file (TS-CUSTOMER-006)
4. Compare downloaded file with original
5. Verify file hash/integrity

**Expected Results:**

- File integrity maintained
- No data corruption
- File accessible from both endpoints
- Performance acceptable (< 2s for typical PDF)

---

### TS-INT-005: Search & Filter Performance

**Objective:** Verify search performance with large dataset

**Test Steps:**

1. Ensure 1000+ enforcement records in database
2. Execute searches with filters
3. Measure response time
4. Test various filter combinations
5. Test pagination with large result sets

**Expected Results:**

- Response time < 1 second for typical query
- Results accurate despite large dataset
- Pagination efficient
- No server errors under load

---

## Error Handling & Edge Cases

### TS-ERROR-001: Missing Required Fields

**Objective:** Verify validation of required fields

**Test Steps:**

1. Create enforcement without required fields:
   - Missing subject
   - Missing regulator
   - Missing violation type
2. Create client without email
3. Create user without password

**Expected Results:**

- Status: 400 Bad Request
- Error message lists missing fields
- Record not created

---

### TS-ERROR-002: Invalid Data Types

**Objective:** Verify type validation

**Test Steps:**

1. Send enforcement with:
   - amount as string instead of number
   - date as invalid format
   - status as invalid enum
2. Similar tests for other endpoints

**Expected Results:**

- Status: 400 Bad Request
- Clear error messages indicating type mismatch

---

### TS-ERROR-003: Invalid Relationships

**Objective:** Verify referential integrity

**Test Steps:**

1. Create enforcement with non-existent regulator ID
2. Create customer with non-existent client ID
3. Test with deleted parent records

**Expected Results:**

- Status: 400/422 Unprocessable Entity
- Clear error about invalid relationship

---

### TS-ERROR-004: Duplicate Records

**Objective:** Verify duplicate detection

**Test Steps:**

1. Create regulator with code "FCA"
2. Try to create another with same code
3. Try bulk upload with duplicate records
4. Create user with duplicate username

**Expected Results:**

- Duplicates rejected with error
- Error message clear about duplication
- First record preserved

---

### TS-ERROR-005: File Upload Errors

**Objective:** Verify file upload validation

**Test Steps:**

1. Upload non-PDF file (e.g., .docx)
2. Upload file exceeding size limit (>10MB)
3. Upload empty file
4. Upload corrupted PDF
5. Attempt upload without required fields

**Expected Results:**

- Non-PDF rejected
- Oversized file rejected
- Empty file rejected
- Corrupted file rejected with specific error
- Error messages guide user to resolution

---

### TS-ERROR-006: Rate Limiting

**Objective:** Verify rate limiting on endpoints

**Test Steps:**

1. Execute 100+ login attempts in quick succession
2. Execute rapid API calls to search endpoint
3. Verify response after hitting limit

**Expected Results:**

- Requests throttled after threshold
- Status: 429 Too Many Requests
- Clear error message about retry after

---

### TS-ERROR-007: SQL Injection / XSS Prevention

**Objective:** Verify security input sanitization

**Test Steps:**

1. Send content with malicious scripts: `<script>alert('xss')</script>`
2. Send search query with SQL syntax: `' OR '1'='1`
3. Create regulator with special characters
4. Verify all inputs are sanitized

**Expected Results:**

- Malicious input rejected or sanitized
- Scripts not executed
- SQL not interpreted
- Special characters handled safely

---

### TS-ERROR-008: Timeout & Performance

**Objective:** Verify system handles slow operations

**Test Steps:**

1. Execute bulk upload of 5000+ records
2. Search on very large result set
3. Generate embeddings for large document
4. Verify timeouts are appropriate

**Expected Results:**

- Long operations complete without timeout
- User gets feedback on progress
- No server crashes
- Graceful degradation if needed

---

### TS-ERROR-009: Concurrent Operations

**Objective:** Verify system handles concurrent requests

**Test Steps:**

1. Multiple admins updating same enforcement
2. Multiple customers searching simultaneously
3. Admin upload while customer downloading
4. Verify data consistency

**Expected Results:**

- No race conditions
- Last write wins or conflict error
- No data corruption
- Performance acceptable

---

### TS-ERROR-010: Session/Token Expiration

**Objective:** Verify token expiration handling

**Test Steps:**

1. Obtain valid token
2. Wait for token to expire (or use test token)
3. Attempt API call with expired token
4. Attempt refresh token if implemented
5. Must re-login to get new token

**Expected Results:**

- 401 Unauthorized on expired token
- Clear message: "Token expired"
- User directed to login
- Refresh works if implemented

---

## Test Data Requirements

### Sample Enforcement Record

```json
{
  "subject": "ACME Inc.",
  "regulators": ["FCA"],
  "jurisdiction": ["UK"],
  "violationType": "Market Abuse",
  "enforcementActionType": "Fine",
  "amount": 5000000,
  "currency": "USD",
  "enforcementDate": "2024-04-15",
  "shortDescription": "Violation of market abuse regulations",
  "tags": ["financial-crime", "enforcement"],
  "status": "active"
}
```

### Sample Client Record

```json
{
  "name": "Global Bank Ltd",
  "email": "contact@globalbank.com",
  "phone": "+44 20 1234 5678",
  "sector": "Financial Services",
  "country": "UK",
  "subscriptionLevel": "premium",
  "status": "active"
}
```

### Sample User (Admin)

```json
{
  "username": "testadmin",
  "password": "TestPassword123!",
  "name": "Test Administrator",
  "email": "test@admin.com",
  "role": "admin",
  "active": true
}
```

---

## Testing Tools & Setup

### Recommended Tools

- **API Testing:** Postman, Insomnia, REST Client
- **Browser Testing:** Chrome DevTools, Firefox Inspector
- **Load Testing:** Apache JMeter, k6
- **Security Testing:** OWASP ZAP, Burp Suite
- **Database:** MongoDB Compass, Convex Dashboard

### Setup for Testing

1. **Start API Server:** `npm run dev`
2. **Access Swagger UI:** `http://localhost:3000/api/docs` (if available)
3. **Import Postman Collection:** `docs/postman-collection.json`
4. **Login:** Use default credentials or create test user
5. **Keep Bearer token:** Reuse for subsequent requests

### Test Data Cleanup

```bash
# After testing, clean up test records:
# Admin panel > Users > Delete test users
# Admin panel > Contents > Delete test content
# Admin panel > Clients > Delete test clients
```

---

## Test Execution Checklist

- [ ] All authentication tests passing
- [ ] All admin CRUD operations working
- [ ] All customer features accessible
- [ ] Search functionality accurate
- [ ] File uploads/downloads working
- [ ] Error handling appropriate
- [ ] Performance acceptable
- [ ] Security validations in place
- [ ] Data consistency maintained
- [ ] No broken links/endpoints
- [ ] Proper HTTP status codes
- [ ] Error messages helpful
- [ ] PDF files not corrupted
- [ ] Concurrent operations safe
- [ ] Rate limiting working

---

## Known Issues & Workarounds

### Issue: PDF Upload File Path

**Status:** ✅ FIXED  
**Details:** Files uploaded to `/var/data/enforcements/` in production and `uploads/enforcements/` in development
**Workaround:** Ensure base directory exists before uploading

### Issue: Vector Embeddings Generation

**Status:** ✅ WORKING  
**Details:** Embeddings auto-generated on enforcement creation
**Note:** May take 2-3 seconds for large documents

---

## Sign-Off

| Role            | Name | Date | Status  |
| --------------- | ---- | ---- | ------- |
| QA Lead         |      |      | Pending |
| Dev Lead        |      |      | Pending |
| Product Manager |      |      | Pending |

---

**Questions or Issues?** Contact the development team or create an issue in the repository.
