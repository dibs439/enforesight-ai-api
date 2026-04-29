# Enforesight Chatbot Response Codeflow & Requirements

## Overview

The Enforesight chatbot is an AI-powered regulatory enforcement data assistant that processes natural language queries about AML (Anti-Money Laundering) enforcement actions and generates accurate responses using OpenAI's GPT model.

**Key Purpose:** Help users find and analyze regulatory enforcement data across global regulators (SEC, CFTC, FCA, AUSTRAC, etc.)

---

## System Architecture

```
Request (User Query)
    ↓
[ROUTING LAYER]
    ↓
POST /ai/chat → Express Router → AiChatController.chat()
    ↓
[AUTH & VALIDATION]
    ↓
Clerk Auth Middleware + Zod Schema Validation
    ↓
[ORCHESTRATION LAYER]
    ↓
AiChatService.processAIQuery()
    ↓
[PARALLEL PROCESSING]
    ├─→ Query Classification (OpenAI)
    ├─→ Conversation History Retrieval
    └─→ Intent Parsing (Regex + Synchronous)
    ↓
[DATA RETRIEVAL]
    ├─→ Aggregation Service (Statistical Data)
    ├─→ Vector Similarity Search (Semantic Search)
    └─→ Convex Database (Fetch Enforcement Records)
    ↓
[LLM RESPONSE GENERATION]
    ↓
OpenAI Chat Completions API
    ↓
[POST-PROCESSING]
    ↓
Message Storage → Database
    ↓
Response (Formatted JSON) → Client
```

---

## Request Flow: Step-by-Step

### **1. HTTP Request Reception**

**Endpoint:** `POST /api/v1/ai/chat`

**Request Body (Zod Schema: `chatMessageSchema`):**

```json
{
  "query": "How many enforcement actions did the SEC take against banks in 2024?",
  "conversationId": "k57abc123def456ghi789" // Optional - omit for new conversation
}
```

**Required Auth:**

- `Authorization: Bearer <clerk-session-token>` OR `Bearer <admin-jwt>`

**File:** [src/routes/customer/chat.ts](src/routes/customer/chat.ts)

---

### **2. Authentication & Validation**

**Middleware Stack:**

1. `requireClerkAuth` or `flexibleAuth` - Verifies bearer token
2. `validateBody(chatMessageSchema)` - Ensures `query` field exists and is non-empty
3. Extracts `userId` from auth token

**File:** [src/middleware/clerkAuth.ts](src/middleware/clerkAuth.ts)

**Result:** Authenticated request object with `req.user.userId`

---

### **3. Controller Entry Point**

**File:** [src/controllers/aiChat.controller.ts](src/controllers/aiChat.controller.ts)

**Method:** `AiChatController.chat()`

```typescript
async chat(req: Request, res: Response): Promise<Response | void> {
  const { query } = req.body;
  const userId = req.user.userId;  // From auth middleware
  const { conversationId } = req.body;

  // Calls service layer
  const result = await aiChatService.processAIQuery({
    query,
    user_id: userId,
    conversation_id: conversationId,
    is_new_conversation: !conversationId
  });
}
```

---

### **4. Query Orchestration Layer**

**File:** [src/services/aiChatService.ts](src/services/aiChatService.ts)

**Main Function:** `processAIQuery(chatQueryData: ChatQueryData): Promise<ChatResult>`

**High-Level Flow:**

```
1. Validate query length (max 12,000 chars ≈ 4,000 tokens)
2. Retrieve conversation history (up to 10 previous messages)
3. Classify query (determine intent, entities, search strategy)
4. Fetch enforcement data (aggregation + semantic search)
5. Generate AI response using OpenAI
6. Store conversation message in database
7. Return formatted response with metadata
```

---

## Key Processing Stages

### **Stage 1: Query Classification**

**Purpose:** Understand what the user is asking for

**File:** [src/services/aiChatService.ts](src/services/aiChatService.ts) - `classifyQuery()` function

**Process:**

1. Sends query to OpenAI with detailed system prompt
2. OpenAI returns `QueryParams` object containing:
   - `query_type`: "statistical" | "semantic" | "hybrid" | "exact_match"
   - `intent`: What user wants (e.g., "find_fines", "count_cases", "analyze_trends")
   - `entities`: Extracted data (regulators, companies, sectors, violation types, date ranges)
   - `requires_aggregation`: Boolean flag for statistical queries
   - `requires_semantic_search`: Boolean flag for semantic similarity search
   - `semantic_depth`: "summary" | "detailed" | "comprehensive"
   - `convex_filters`: Database query filters

**System Prompt Context:**

- CRITICAL: Database contains ONLY AML enforcement data
- All records have field "AML" or "AML+"
- Supported regulators: SEC, CFTC, FRB, OCC, FINMA, BaFin, AMF, ASIC, FSA, PRA, ESMA, AUSTRAC, FCA, FinCEN, FINTRAC, MAS, HKMA, SARB, DFSA, ADGM, CBI, CBUAE, VARA
- Common violation types: SAR Reporting, KYC, Sanctions, CTF, Record Keeping, etc.

**Example Classification:**

| Query                                          | Classification                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------- |
| "How many SEC cases in 2024?"                  | `query_type: "statistical"`, `metric: "count"`, `year: 2024`                    |
| "Find enforcement actions against Binance"     | `query_type: "semantic"`, `entities.companies: ["Binance"]`                     |
| "What is the average fine for AML violations?" | `query_type: "statistical"`, `metric: "average"`, `convex_filters.field: "AML"` |

---

### **Stage 2: Intent Parsing**

**File:** [src/services/intentParser.service.ts](src/services/intentParser.service.ts)

**Note:** This is a LEGACY service - the main classification happens in `classifyQuery()`. Used as fallback for basic parsing.

**Returns:**

```typescript
{
  isAggregation: boolean; // Whether to aggregate data
  regulatorName: string | null; // e.g., "SEC", "FCA"
  metric: string | null; // "count", "average", "maximum", "minimum"
  fineOnly: boolean; // Filter to fines only
  year: number | null; // Year filter
}
```

---

### **Stage 3: Data Retrieval**

#### **A. Aggregation Service**

**Purpose:** Compute statistical summaries (counts, totals, averages)

**File:** [src/services/aggregation.service.ts](src/services/aggregation.service.ts)

**Returns:**

```typescript
interface AggregationData {
  count: number;                    // Total enforcement actions
  fines_count: number;              // Actions with monetary penalties
  total_fines: number;              // Sum of all fines
  average_fine: number;             // Mean fine amount
  currency_breakdown: {
    "USD": { total, count, average, min, max },
    "EUR": { total, count, average, min, max },
    // ... other currencies
  };
  regulator_breakdown: { "SEC": 42, "CFTC": 18, ... };
  field_breakdown: { "AML": 50, "AML+": 10, ... };
  sector_breakdown: { "Banking": 25, "Crypto": 15, ... };
  violation_breakdown: { "KYC": 30, "SAR Reporting": 20, ... };
  year_breakdown: { "2024": 35, "2023": 28, ... };
  jurisdiction_breakdown: { "US": 45, "UK": 12, ... };
  action_type_breakdown: { "Fine": 40, "License Revocation": 5, ... };
}
```

#### **B. Semantic Search**

**Purpose:** Find enforcement records similar to user query using vector embeddings

**Process:**

1. Generate embedding for user query using `text-embedding-3-small`
2. Fetch enforcement records from Convex database
3. Generate embeddings for record descriptions
4. Calculate cosine similarity scores
5. Return top N records ranked by similarity

**File:** [src/services/aiChatService.ts](src/services/aiChatService.ts) - `performSemanticSearch()` function

**Similarity Calculation:**

```typescript
function cosineSimilarity(a: number[], b: number[]): number {
  // Returns value between -1 and 1 (0.7+ is typically relevant)
  dot_product = a · b
  magnitude_a = ||a||
  magnitude_b = ||b||
  return dot_product / (magnitude_a × magnitude_b)
}
```

#### **C. Convex Database Queries**

**Purpose:** Fetch actual enforcement records and aggregated enforcement data

**Available Endpoints:**

- `enforcements:getAllEnforcements()` - Fetch all records matching filters
- `enforcements:getEnforcementById()` - Fetch single record
- `customers:getCustomer()` - Customer context
- `customerConversations:getConversation()` - Conversation history

**Enforcement Record Schema:**

```typescript
{
  _id: string;
  regulatorName: string;           // e.g., "SEC"
  subjectName: string;             // Company name
  enforcementActionType: string[]; // e.g., ["Fine", "Director Ban"]
  fineAmount: number;
  currency: string;                // "USD", "EUR", etc.
  dateOfAction: string;            // ISO date
  violationTypes: string[];        // e.g., ["KYC", "SAR Reporting"]
  sector: string;
  jurisdiction: string;
  field: string;                   // "AML" or "AML+" classification
  documentId: string;
  enforcementNoticeUrl: string;
  enforcementNoticeSummary: string;
}
```

---

### **Stage 4: Response Generation**

**Purpose:** Generate accurate, conversational AI response based on retrieved data

**File:** [src/services/aiChatService.ts](src/services/aiChatService.ts) - `generateOpenAIResponse()` function

**OpenAI Configuration:**

- **Model:** `gpt-5.5` (configurable via `OPENAI_MODEL` env var)
- **Max Tokens:** 800 (configurable via `MAX_TOKENS`)
- **Temperature:**
  - 0.0 (for JSON extraction & exact data)
  - 0.1 (for factual, concise answers)
  - 0.7 (for conversational elaborations)

**System Prompt Context:**

```
You are a professional regulatory enforcement analyst.
- ONLY answer questions about AML enforcement actions
- Use provided data as source of truth
- Always cite metrics with confidence
- Be precise about numbers, dates, and entities
- Flag any data limitations or uncertainties
- Structure responses clearly
```

**Response Format Expected:**

```typescript
{
  response: {
    summary: string; // Main answer (1-3 sentences)
    count: number; // If applicable, number of records/actions
    records: Array<{
      // If applicable, enforcement details
      regulatorName: string;
      subjectName: string;
      enforcementActionType: string[];
      fineAmount?: number;
      dateOfAction: string;
      // ... other fields
    }>;
  }
  conversation_id: string;
  message_id: string;
  metadata: {
    model: string;
    tokens_used: number;
    response_time_seconds: number;
    search_time_seconds: number;
    openai_time_seconds: number;
    enforcements_found: number;
    is_followup_question: boolean;
  }
}
```

---

## Data Models & Types

### **ChatQuery Type**

```typescript
interface ChatQuery {
  query: string; // User input
  conversation_id?: string; // To continue existing conversation
  user_id?: string;
  context?: Record<string, any>;
  search_filters?: Record<string, any>;
}
```

### **ChatMessage Type**

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO 8601
  metadata?: Record<string, any>;
}
```

### **Conversation Type**

```typescript
interface Conversation {
  id: string;
  user_id?: string;
  status: 'active' | 'inactive' | 'archived';
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
  context?: Record<string, any>;
}
```

### **QueryParams Type (From Classification)**

```typescript
interface QueryParams {
  query_type?: 'statistical' | 'semantic' | 'hybrid' | 'exact_match';
  intent?: string;
  entities?: {
    companies?: string[];
    regulators?: string[];
    dates?: { start?: string; end?: string } | string[];
    violation_types?: string[];
    jurisdictions?: string[];
    sectors?: string[];
    fields?: string[];
    years?: string[];
  };
  requires_aggregation?: boolean;
  requires_semantic_search?: boolean;
  semantic_depth?: 'summary' | 'detailed' | 'comprehensive';
  convex_filters?: Record<string, any>;
  metric?: string;
  fine_only?: boolean;
  non_fine_only?: boolean;
  original_query?: string;
  error?: string;
}
```

---

## Key Requirements for Accurate Responses

### **1. Query Understanding**

✅ **MUST Handle:**

- Statistical queries: "How many?", "What is the average?", "Total fines?"
- Semantic queries: "Find cases about X", "Show me enforcement against Y"
- Hybrid queries: "SEC actions in tech sector with fines > $1M"
- Temporal queries: "Last 5 years", "Between 2020-2024", "Since 2022"
- Entity extraction: Company names, regulator abbreviations, violation types, sectors

❌ **MUST NOT Confuse:**

- Violators (subjects being enforced against) with regulators (enforcement agencies)
- "Sanctioned" as a violation type vs. an enforcement outcome
- Monetary fines vs. non-monetary penalties

### **2. Data Accuracy**

✅ **MUST:**

- Use database as single source of truth
- Return factual counts, dates, and amounts
- Cite specific enforcement actions when available
- Include confidence levels for derived insights

❌ **MUST NOT:**

- Hallucinate enforcement data not in database
- Conflate different regulatory regimes
- Assume patterns without sufficient data
- Provide financial advice or predictions

### **3. Conversation History**

**Maximum History:** 10 previous messages (configurable via `MAX_CONVERSATION_HISTORY`)

**Usage:**

- Context for follow-up questions: "How many prosecutions resulted?" (refers to previously discussed regulator)
- Clarification of ambiguous references
- Building conversation context for relevance scoring

**File:** [src/services/customerConversationService.ts](src/services/customerConversationService.ts)

---

## Integration Points

### **OpenAI Integration**

**Configuration:**

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5.5              # Main model
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
MAX_TOKENS=800
```

**Endpoints Used:**

- `POST /v1/chat/completions` - Query classification & response generation
- `POST /v1/embeddings` - Vector embeddings for semantic search

### **Convex Database Integration**

**Configuration:**

```env
CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOYMENT_URL=...
```

**Used For:**

- Storing conversations & messages
- Fetching enforcement data
- Fetching regulator list
- Query execution with filters

**Files:**

- [convex/customerConversations.ts](convex/customerConversations.ts)
- [convex/enforcements.ts](convex/enforcements.ts)

### **Authentication Integration**

**Supported Methods:**

1. Clerk Session Tokens (Customer users)
2. Admin JWT tokens (Internal users)

**Files:**

- [src/middleware/clerkAuth.ts](src/middleware/clerkAuth.ts)
- [src/middleware/jwtAuth.ts](src/middleware/jwtAuth.ts)

---

## Common Query Examples & Expected Flow

### **Example 1: Statistical Query**

```
USER QUERY:
"How many enforcement actions did the SEC take in 2024?"

PROCESSING FLOW:
1. Classification → query_type: "statistical", metric: "count", regulator: "SEC", year: 2024
2. Intent Parsing → isAggregation: true, regulatorName: "SEC"
3. Data Retrieval → Aggregation service filters by regulator=SEC, year=2024
4. Response Gen → "The SEC took 47 enforcement actions in 2024..."
5. Storage → Save message pair to conversation

RESPONSE STRUCTURE:
{
  "summary": "The SEC took 47 enforcement actions in 2024.",
  "count": 47,
  "records": [...]  // Top records if semantic depth requires
}
```

### **Example 2: Semantic Query**

```
USER QUERY:
"Show me recent enforcement against cryptocurrency platforms"

PROCESSING FLOW:
1. Classification → query_type: "semantic", entities.companies: ["cryptocurrency"],
                      semantic_depth: "detailed"
2. Intent Parsing → (not used for semantic)
3. Data Retrieval →
   - Embedding: Generate vector for "cryptocurrency platforms"
   - Search: Find enforcement records with semantic similarity > 0.7
   - Results: Return top 10 matching records
4. Response Gen → Summarize findings with record details
5. Storage → Save conversation

RESPONSE STRUCTURE:
{
  "summary": "Found 12 recent enforcement actions against crypto platforms...",
  "count": 12,
  "records": [
    {
      "regulatorName": "SEC",
      "subjectName": "Binance",
      "fineAmount": 4300000000,
      "currency": "USD",
      "dateOfAction": "2023-06-15",
      ...
    },
    ...
  ]
}
```

### **Example 3: Hybrid Query with Temporal Filter**

```
USER QUERY:
"What were the largest fines for AML violations in the last 3 years?"

PROCESSING FLOW:
1. Classification → query_type: "hybrid", metric: "max", temporal: "last 3 years",
                      violation_types: ["AML violations"]
2. Date Parsing → { start: "2021-01-01", end: "2023-12-31" }
3. Aggregation → Filter by date range, compute MAX fine with currency conversion
4. Semantic Search → Also find contextually similar cases
5. Response Gen → "Largest AML fines in past 3 years were..."
6. Storage → Save conversation

RESPONSE STRUCTURE:
{
  "summary": "The largest AML-related fine was $4.3B against Binance (2023)...",
  "count": 3,
  "records": [
    { regulatorName: "SEC", fineAmount: 4300000000, ... },
    { regulatorName: "FCA", fineAmount: 2900000000, ... },
    { regulatorName: "AUSTRAC", fineAmount: 1900000000, ... }
  ]
}
```

---

## Date Range Parsing

**Supported Patterns (Regex-Based):**

| Pattern            | Example                 | Parsed Result            |
| ------------------ | ----------------------- | ------------------------ |
| "last N years"     | "last 5 years"          | 2019-01-01 to 2023-12-31 |
| "between X and Y"  | "between 2020 and 2023" | 2020-01-01 to 2023-12-31 |
| "from X to Y"      | "from 2020 to 2023"     | 2020-01-01 to 2023-12-31 |
| "since YYYY"       | "since 2022"            | 2022-01-01 to today      |
| "since YYYY-MM-DD" | "since 2022-03-15"      | 2022-03-15 to today      |
| "in YYYY"          | "in 2024"               | 2024-01-01 to 2024-12-31 |
| "during YYYY"      | "during 2023"           | 2023-01-01 to 2023-12-31 |

**File:** [src/services/aiChatService.ts](src/services/aiChatService.ts) - `parseRelativeTimePeriod()` function

---

## Entity Detection

### **Regulator Detection**

**Method:** String matching against supported list (case-insensitive)

**Supported Regulators:**

```
AUSTRAC, FCA, FinCEN, FINTRAC, MAS, HKMA, SARB, DFSA, ADGM,
CBI, CBUAE, VARA, SEC, CFTC, FRB, OCC, FINMA, BaFin, AMF,
ASIC, FSA, PRA, ESMA
```

### **Violation Type Detection**

**Method:** Pattern matching and entity extraction

**Common Types:**

```
SAR Reporting, Currency Transaction Reporting, AML Program,
KYC, CTF, Sanctions, Beneficial Ownership, Record Keeping,
Customer Due Diligence, Enhanced Due Diligence, Transaction Monitoring,
Reporting Failures, Compliance Program, Staff Training,
Customer Identification
```

### **Sector Detection**

**Method:** Database lookup against known sectors

**Examples:** Banking, Crypto, Insurance, Real Estate, Technology, etc.

### **Metric Detection**

**Regex Patterns:**

- `/(largest|biggest|highest|maximum|max)/` → "max"
- `/(smallest|lowest|minimum|min)/` → "min"
- `/(average|mean)/` → "average"
- `/(total|sum)/` → "sum"
- `/(how many|number of|count)/` → "count"
- `/(trend|over time|year by year)/` → "trend"

---

## Response Validation Checklist

Before returning response to user, verify:

✅ **Data Accuracy:**

- [ ] All numeric values match database records
- [ ] Dates are in correct format (ISO 8601)
- [ ] Currency codes are correct (USD, EUR, GBP, etc.)
- [ ] Regulator names match database records

✅ **Completeness:**

- [ ] Summary directly answers user's question
- [ ] Count reflects actual records returned
- [ ] All cited data has supporting records
- [ ] Time complexity < 5 seconds

✅ **Clarity:**

- [ ] Language is professional but accessible
- [ ] Numbers formatted with thousand separators
- [ ] Ambiguities explicitly flagged
- [ ] Limitations acknowledged (e.g., "Data available through Q3 2024")

✅ **Context:**

- [ ] Reference to conversation history if follow-up
- [ ] Metadata timestamps accurate
- [ ] Message IDs properly generated
- [ ] Conversation ID persisted correctly

---

## Error Handling

### **Common Error Scenarios:**

| Error                       | Cause                           | Resolution                               |
| --------------------------- | ------------------------------- | ---------------------------------------- |
| "Max query chars exceeded"  | Query > 12,000 chars            | Truncate or summarize query              |
| "No enforcement data found" | Query too specific              | Broaden search, suggest popular queries  |
| "OpenAI rate limit"         | Too many concurrent requests    | Implement retry with exponential backoff |
| "Conversation not found"    | Invalid conversationId          | Create new conversation                  |
| "Invalid date range"        | Unparseable temporal expression | Ask user to clarify date range           |
| "Regulator not recognized"  | Typo or unsupported regulator   | Suggest similar regulators               |

### **Response Format on Error:**

```json
{
  "success": false,
  "error": "Descriptive error message",
  "data": null
}
```

---

## Performance Considerations

### **Optimization Strategies:**

1. **Embedding Caching:** Store embeddings for common queries
2. **Conversation History Limit:** Keep only last 10 messages (configurable)
3. **Batch Processing:** Group similar queries for aggregation
4. **Circuit Breaker:** Fall back to cached responses on API failure
5. **Query Deduplication:** Cache responses for identical queries

### **Typical Response Times:**

- Simple statistical query: < 2 seconds
- Semantic search query: 3-5 seconds
- Complex hybrid query: 4-7 seconds
- Full processing with OpenAI: < 10 seconds

---

## File Structure & Responsibilities

```
src/
├── controllers/
│   └── aiChat.controller.ts          # HTTP request handling
├── services/
│   ├── aiChatService.ts              # Main orchestration, classification
│   ├── aggregation.service.ts        # Statistical aggregations
│   ├── intentParser.service.ts       # Legacy intent parsing
│   └── customerConversationService.ts # Conversation persistence
├── routes/
│   └── customer/chat.ts              # API route definitions
├── types/
│   └── chat.ts                       # TypeScript interfaces
├── validation/
│   ├── schemas/
│   │   └── chat.schema.ts            # Zod validation schemas
│   └── middleware.ts                 # Validation middleware
└── middleware/
    ├── clerkAuth.ts                  # Authentication
    └── errorHandler.ts               # Error handling

docs/
├── API.md                            # Full API documentation
└── CHATBOT_CODEFLOW.md              # THIS FILE

convex/
├── customerConversations.ts          # Conversation DB operations
└── enforcements.ts                   # Enforcement DB operations
```

---

## Testing Checklist for Freelancer

Before marking as complete, test these scenarios:

### **Unit Tests:**

- [ ] Query classification with various query types
- [ ] Date range parsing for all supported formats
- [ ] Entity extraction (regulators, sectors, violations)
- [ ] Cosine similarity calculation
- [ ] Response formatting

### **Integration Tests:**

- [ ] End-to-end chat request/response
- [ ] Conversation history retrieval
- [ ] Aggregation with filters
- [ ] Semantic search ranking

### **Data Accuracy Tests:**

- [ ] "How many SEC actions?" returns correct count
- [ ] "Average fine for X" calculates correctly
- [ ] "Largest enforcement" returns actual max
- [ ] Currency conversions accurate
- [ ] Date filters work as expected

### **Edge Cases:**

- [ ] Empty response handling
- [ ] Very long queries (near 12K chars)
- [ ] Queries with no matches
- [ ] Ambiguous entity references
- [ ] Cross-conversation message references

---

## Contact & Support

**Primary Files for Questions:**

1. Classification logic: `/src/services/aiChatService.ts`
2. Database operations: `/convex/customerConversations.ts`
3. Response formatting: `/src/controllers/aiChat.controller.ts`
4. Type definitions: `/src/types/chat.ts`

**Key Environment Variables:**

```env
OPENAI_API_KEY              # Required
OPENAI_MODEL                # default: gpt-5.5
OPENAI_EMBEDDING_MODEL      # default: text-embedding-3-small
MAX_TOKENS                  # default: 800
MAX_CONVERSATION_HISTORY    # default: 10
EMBEDDING_MAX_CHARS         # default: 8000
CONVEX_URL                  # Required
CONVEX_DEPLOYMENT_URL       # Required
```

---

**Document Version:** 1.0  
**Last Updated:** April 14, 2026  
**Maintainer:** Engineering Team
