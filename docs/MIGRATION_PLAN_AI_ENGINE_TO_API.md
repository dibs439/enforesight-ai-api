# Migration Plan: Consolidating enforesight-ai-engine APIs into enforesight-api

## Executive Summary

Consolidate AI Chat and Enforcement APIs from `enforesight-ai-engine` into `enforesight-api` without removing any code from either repository. This creates a single unified API server while maintaining both codebases for reference and gradual transition.

**Timeline Estimate:** 2-3 days
**Complexity:** High (involves Python service integration, dependency alignment, auth consolidation)
**Risk Level:** Medium (mitigated by keeping both repos intact)

---

## Current State Analysis

### enforesight-ai-engine APIs to Migrate

```
POST   /api/chat                           → Chat completion endpoint
GET    /api/chat/conversations/:userId    → Get user conversations
GET    /api/chat/conversations/:id        → Get specific conversation
POST   /api/chat/conversations            → Create new conversation
POST   /api/chat/archive                  → Archive conversation
GET    /api/enforcement/:enforcementId    → Get enforcement details
```

### Source Code Structure (enforesight-ai-engine)

```
src/
├── routes/
│   ├── chat.ts              (1446 lines) - Main chat service
│   ├── enforcement.ts       (60 lines)   - Enforcement getter
│   └── api.ts               (30 lines)   - Route registration
├── middleware/
│   ├── flexibleAuth.ts      - Auth wrapper (supports JWT + Clerk)
│   └── clerkAuth.ts         - Clerk-specific auth
└── utils/
    └── convexClient.ts      - Convex database client

python/src/api/
├── chat_endpoint.py         - Main chat logic
├── advanced_chat_endpoint.py
├── get_conversation.py
├── create_conversation.py
├── get_conversation_history.py
└── [other Python services]

convex/
└── enforcements.ts          - Enforcement queries (251 lines)
```

### Target Structure (enforesight-api)

```
src/
├── routes/
│   ├── ai-chat.ts           (exists - unused/partial)
│   ├── enforcement.ts       (NEW - from ai-engine)
│   ├── chat.ts              (exists - basic)
│   └── api.ts               (UPDATE - register new endpoints)
├── middleware/
│   ├── auth.ts              (exists - JWT only)
│   ├── flexibleAuth.ts      (NEW - from ai-engine)
│   └── clerkAuth.ts         (NEW - from ai-engine)
└── utils/
    └── convexClient.ts      (exists - reuse)

python/src/api/
├── [copy all Python services]

convex/
└── enforcements.ts          (UPDATE - merge/enhance)
```

### Dependencies Analysis

**enforesight-ai-engine unique packages:**

```json
{
  "@clerk/clerk-sdk-node": "^4.13.23", // Has Convex integration
  "pdfkit": "^0.17.2" // PDF generation
}
```

**enforesight-api already has:**

```json
{
  "@clerk/backend": "^2.32.0", // More recent
  "@clerk/express": "^1.7.73", // Express integration
  "pdfjs-dist": "^5.4.394", // PDF extraction
  "pdf-parse": "^2.4.5",
  "canvas": "^3.2.0",
  "openai": "^6.16.0", // ✓ Already present
  "convex": "^1.28.2"
}
```

**Actions Needed:**

- Update enforesight-api package.json: Add `pdfkit` if not present
- Note: @clerk packages are slightly different versions but compatible

---

## Detailed Migration Plan

### Phase 1: Preparation (Day 1, 2 hours)

#### 1.1 Dependency Alignment

- [ ] Add missing packages to enforesight-api:
  ```bash
  npm install pdfkit
  npm install --save-dev @types/pdfkit
  ```
- [ ] Verify OpenAI version compatibility (both have ^6.16.0) ✓
- [ ] Update @clerk packages if needed (api has newer versions)
- [ ] Update package.json in enforesight-api with all chat dependencies

#### 1.2 Code Analysis & Documentation

- [ ] Catalog all chat.ts endpoints and their implementations
- [ ] Identify Python service dependencies
- [ ] Document auth requirements (JWT vs Clerk vs Flexible)
- [ ] Map type definitions (ChatQuery, ChatResponse, etc.)

#### 1.3 Create Integration Checklist

- [ ] Middleware migration checklist
- [ ] Route integration checklist
- [ ] Python service integration checklist
- [ ] Type definition merge checklist

---

### Phase 2: Middleware & Utilities Migration (Day 1, 4 hours)

#### 2.1 Copy Authentication Middleware

**Source:** `enforesight-ai-engine/src/middleware/`
**Target:** `enforesight-api/src/middleware/`

Files to copy:

- [ ] `clerkAuth.ts` → `src/middleware/clerkAuth.ts` (as-is)
- [ ] `flexibleAuth.ts` → `src/middleware/flexibleAuth.ts` (as-is)

**Action:** Direct copy - no modifications needed, these are self-contained

#### 2.2 Verify/Update Convex Client

**Source:** `enforesight-ai-engine/src/utils/convexClient.ts`
**Target:** `enforesight-api/src/utils/convexClient.ts`

**Action:** Compare implementations

- Both should use same approach
- If identical, keep existing
- If different, merge approaches or keep api version (it's more recent)

#### 2.3 Copy Type Definitions

**Source:** `enforesight-ai-engine/src/types/`
**Target:** `enforesight-api/src/types/`

Create/update type files:

- [ ] `types/chat.ts` - ChatQuery, ChatResponse, Conversation, ChatMessage, ApiResponse
- [ ] `types/enforcement.ts` - Enforcement types (if used)
- [ ] Ensure no conflicts with existing types in enforesight-api

**Note:** Check if type definitions already exist partially in enforesight-api

---

### Phase 3: Python Service Integration (Day 1, 3 hours)

#### 3.1 Copy Python API Services

**Source:** `enforesight-ai-engine/python/src/api/`
**Target:** `enforesight-api/python/src/api/`

Files to copy:

- [ ] `chat_endpoint.py`
- [ ] `advanced_chat_endpoint.py`
- [ ] `get_conversation.py`
- [ ] `create_conversation.py`
- [ ] `get_conversation_history.py`
- [ ] `simple_chat_endpoint.py`
- [ ] `archive_conversation.py`
- [ ] All supporting files

**Action:**

1. Create `enforesight-api/python/src/api/` if doesn't exist
2. Copy all Python files as-is
3. Verify `PYTHONPATH` configuration in package.json scripts

#### 3.2 Verify Python Dependencies

**Check:** `enforesight-ai-engine/requirements.txt` vs `enforesight-api/requirements.txt`

- [ ] Ensure all required Python packages are listed in api repo
- [ ] Note any version differences
- [ ] Update api repo requirements.txt if needed

#### 3.3 Update ts-node/Python Integration

Verify in `src/routes/chat.ts`:

- [ ] Python path resolution works correctly
- [ ] `__dirname` handling for both CommonJS and ES modules
- [ ] PYTHON_EXECUTABLE environment variable support
- [ ] Error handling for Python process spawning

---

### Phase 4: Route & Controller Integration (Day 2, 4 hours)

#### 4.1 Copy Chat Route Handler

**Source:** `enforesight-ai-engine/src/routes/chat.ts` (1446 lines)
**Target:** `enforesight-api/src/routes/chat.ts` OR `enforesight-api/src/routes/ai-chat.ts`

**Action:**

- [ ] Copy entire chat.ts file
- [ ] Update import paths:
  ```typescript
  // Update these to match enforesight-api structure
  import { flexibleAuth } from "../middleware/flexibleAuth";
  import { ChatQuery, ChatResponse, ... } from "../types/chat";
  import { getConvexClient } from "../utils/convexClient";
  ```
- [ ] Verify all dependency imports resolve
- [ ] Test Python service calls work with new paths

**Integration Strategy:**

- Option A: Create separate `src/routes/ai-chat.ts` (keeps chat separated, existing ai-chat.ts was unused)
- Option B: Replace existing `src/routes/chat.ts` (consolidates, cleaner)
- **Recommendation:** Option A - `src/routes/ai-chat.ts` to avoid conflict with simple chat route

#### 4.2 Copy Enforcement Route Handler

**Source:** `enforesight-ai-engine/src/routes/enforcement.ts` (60 lines)
**Target:** `enforesight-api/src/routes/enforcement.ts`

**Action:**

- [ ] Copy enforcement.ts file
- [ ] Update imports for new location
- [ ] Verify Convex client integration

#### 4.3 Merge Convex Functions

**Source:** `enforesight-ai-engine/convex/enforcements.ts`
**Target:** `enforesight-api/convex/enforcements.ts`

**Current State:**

- enforesight-api already has `convex/enforcements.ts` (enhanced version)
- enforesight-ai-engine has older version with less functionality

**Action:**

- [ ] Review both implementations
- [ ] Keep enforesight-api version (more recent)
- [ ] Verify ai-engine routes work with api's Convex schema
- [ ] No action needed - api version is superset

---

### Phase 5: API Route Registration (Day 2, 2 hours)

#### 5.1 Update api.ts Route Handler

**File:** `enforesight-api/src/routes/api.ts`

**Current routes:** Countries, Currencies, Sectors, Violation Types, etc.

**Add new imports:**

```typescript
import aiChatRoutes from "./ai-chat"; // New - from ai-engine
import enforcementRoutes from "./enforcement"; // New - from ai-engine
```

**Add new route registrations:**

```typescript
router.use("/chat", aiChatRoutes); // POST /api/chat, etc.
router.use("/enforcement", enforcementRoutes); // GET /api/enforcement/:id
```

**Update endpoints list:**

```typescript
endpoints: {
  // ... existing ...
  aiChat: '/api/chat',
  enforcement: '/api/enforcement',
}
```

#### 5.2 Middleware Verification

**File:** `enforesight-api/src/index.ts`

Verify setup:

- [ ] All middleware chains initialized
- [ ] CORS configured for chat endpoints
- [ ] Error handling compatible with ai-engine routes
- [ ] dotenv configured for Python service environment variables

---

### Phase 6: Testing & Validation (Day 2, 3 hours)

#### 6.1 Unit Tests

- [ ] Test chat endpoint: `POST /api/chat`
- [ ] Test conversations: `GET /api/chat/conversations/:userId`
- [ ] Test enforcement: `GET /api/enforcement/:id`
- [ ] Test Python service integration
- [ ] Test auth (both JWT and Clerk)

#### 6.2 Integration Tests

- [ ] Full chat flow: Create conversation → Send message → Get response
- [ ] Verify Convex database calls work
- [ ] Verify Python service process spawning
- [ ] Error handling and edge cases

#### 6.3 Compatibility Tests

- [ ] Verify existing API endpoints still work
- [ ] Test alongside original enforces-ai-engine
- [ ] Performance baseline testing

#### 6.4 Environment Configuration

- [ ] `.env.example` includes all chat variables
- [ ] `PYTHON_EXECUTABLE` path configured
- [ ] OpenAI API key available
- [ ] Convex project configured for both tables

---

### Phase 7: Documentation & Cleanup (Day 3, 2 hours)

#### 7.1 Update API Documentation

- [ ] `docs/API.md` - Add chat and enforcement endpoints
- [ ] Document auth requirements per endpoint
- [ ] Add example requests/responses
- [ ] Document Python service dependencies

#### 7.2 Create Migration Reference Doc

- [ ] Document what was copied from ai-engine
- [ ] List any modifications made
- [ ] Provide rollback procedure if needed
- [ ] Note environment variable requirements

#### 7.3 Verify Both Repos Still Work

- [ ] enforesight-ai-engine still deploys independently ✓
- [ ] enforesight-api now has all apis ✓
- [ ] No breaking changes to either repo

---

## Risk Mitigation Strategy

### High Risk Areas & Mitigation

**Risk 1: Python Service Path Issues**

- Problem: Python service spawning fails due to path differences
- Mitigation:
  - Use absolute paths
  - Test on target environment before production
  - Add comprehensive logging
  - Provide fallback mechanisms

**Risk 2: Dependency Conflicts**

- Problem: @clerk or other package versions conflict
- Mitigation:
  - Lock versions in package.json
  - Run full test suite after dependency update
  - Keep enforesight-ai-engine version for reference

**Risk 3: Auth Middleware Incompatibility**

- Problem: Existing auth in api conflicts with ai-engine auth
- Mitigation:
  - Use flexibleAuth for all migrated endpoints
  - Maintain separate middleware files
  - Test all auth flows
  - Document auth requirements per route

**Risk 4: Convex Schema Differences**

- Problem: Different schema versions between repos
- Mitigation:
  - Use enforesight-api's newer schema (superset)
  - Verify all queries work with api schema
  - Test data access patterns
  - Keep ai-engine Convex functions as reference

---

## Execution Checklist

### Pre-Migration

- [ ] Backup both repositories
- [ ] Create feature branch in enforesight-api
- [ ] Document current API endpoints
- [ ] Record performance baselines

### Migration Execution

- [ ] Phase 1: Prepare & align dependencies
- [ ] Phase 2: Copy middleware & utilities
- [ ] Phase 3: Copy Python services
- [ ] Phase 4: Copy route handlers
- [ ] Phase 5: Register routes
- [ ] Phase 6: Test all functionality
- [ ] Phase 7: Document changes

### Post-Migration

- [ ] Run full test suite
- [ ] Performance testing
- [ ] Deploy to staging
- [ ] Deploy to production
- [ ] Monitor both APIs in parallel
- [ ] Keep ai-engine as backup
- [ ] Schedule cleanup of ai-engine (future)

---

## Rollback Plan

If issues occur:

1. **Immediate:** Revert git commits in enforesight-api

   ```bash
   git reset --hard <previous-commit>
   ```

2. **Fallback:** Continue using enforesight-ai-engine until stable

   ```bash
   docker pull enforesight-ai-engine:latest
   docker run ... # Original service continues
   ```

3. **Analysis:** Review test results and error logs

4. **Retry:** Fix issues and attempt migration again

---

## Success Criteria

Migration is successful when:

- ✓ All chat endpoints work identically to ai-engine
- ✓ All enforcement endpoints functional
- ✓ Python service integration verified
- ✓ All tests pass
- ✓ Performance acceptable (< 100ms avg response)
- ✓ No regressions in existing API endpoints
- ✓ Both repositories unchanged but api is superset
- ✓ Documentation updated
- ✓ Production deployment successful

---

## Resource Requirements

**Development Time:** 2-3 days
**Team:** 1-2 developers
**Testing:** 1 QA engineer
**Total Effort:** ~40-60 hours

**Tools Needed:**

- TypeScript compiler
- Python 3.8+
- Node.js 18+
- Convex CLI
- Git
- Docker (for testing)

---

## Next Steps

1. **Approve Plan:** Stakeholder review and sign-off
2. **Schedule:** Allocate 3 days of dev time
3. **Prepare:** Set up branches and testing environment
4. **Execute:** Follow phases in sequential order
5. **Verify:** Comprehensive testing before production
6. **Deploy:** Graduated rollout (staging → production)
7. **Monitor:** 24/7 monitoring for first week

---

## Questions for Clarification

Before starting:

1. Preferred endpoint for chat: `/api/chat` or `/api/ai-chat` or `/api/ai-chat`?
2. Should we keep ai-engine running in parallel post-migration?
3. What's the SLA for cutover?
4. Any specific performance requirements?
5. Timeline for deprecating ai-engine?
