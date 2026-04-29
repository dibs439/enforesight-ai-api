# Bulk Insert Enforcements Script - Requirements

## Overview

This document outlines the requirements for bulk inserting enforcement action data from a CSV file into the Enforesight database (Convex enforcements table).

## CSV Column Mapping

The following table shows the mapping between CSV column names and Convex schema field names:

| CSV Column Name         | Convex Field Name     | Data Type           | Notes                                                                                     |
| ----------------------- | --------------------- | ------------------- | ----------------------------------------------------------------------------------------- |
| Jurisdiction            | jurisdiction          | string              | Required. Trim whitespace.                                                                |
| Regulator Name          | regulatorName         | string              | Required. Trim whitespace. Will verify/create if needed.                                  |
| Subject Name (Case)     | subjectName           | string              | Required. Trim whitespace.                                                                |
| Sector                  | sector                | string              | Optional. Trim whitespace.                                                                |
| Date of Action          | dateOfAction          | string (YYYY-MM-DD) | Required. Convert from DD-MMM-YY format. Also extract year and month.                     |
| Enforcement Action Type | enforcementActionType | string[]            | Required. Array of action types. Split by line breaks in CSV.                             |
| Field                   | field                 | string              | Optional. Trim whitespace.                                                                |
| AML Violation Type(s)   | violationTypes        | string[]            | Required. Array of violation types. Split by line breaks in CSV.                          |
| Fine Amount             | fineAmount            | number              | Optional. Parse as numeric value. If blank, set to 0. Remove currency symbols and commas. |
| Currency                | currency              | string              | Optional. Trim whitespace.                                                                |
| Enforcement Notice URL  | enforcementNoticeUrl  | string (URL)        | Optional. Do not parse. Insert as-is. Trim whitespace.                                    |
| Reference No.           | documentId            | string              | Optional. If blank, set to "n/a". Trim whitespace.                                        |
| Pending Determination   | underAppeal           | boolean             | Optional. Set to true if value is "Yes", false otherwise.                                 |

## Additional Fields

The following fields are automatically set by the script:

| Field     | Value                        | Notes                                             |
| --------- | ---------------------------- | ------------------------------------------------- |
| createdAt | Current timestamp (ISO 8601) | Set to current date/time when record is inserted. |
| updatedAt | Current timestamp (ISO 8601) | Set to current date/time when record is inserted. |
| year      | Extracted from dateOfAction  | Year portion of the date (e.g., 2013)             |
| month     | Extracted from dateOfAction  | Month portion of the date as integer (1-12)       |

## Data Transformation Rules

### 1. Whitespace Trimming

- All string values must have leading and trailing whitespace trimmed.
- This applies to all fields.

### 2. Date Conversion

- **Input Format**: DD-MMM-YY (e.g., "28-Mar-13", "22-Jan-14")
- **Output Format**: YYYY-MM-DD (e.g., "2013-03-28", "2014-01-22")
- **Year Handling**:
  - 2-digit years < 30 are treated as 20xx (e.g., 13 → 2013)
  - 2-digit years >= 30 are treated as 19xx (e.g., 99 → 1999)
- Extract the year and month as separate numeric fields
- If date is invalid or missing, skip the row with a warning

### 3. Enforcement Action Type

- **Input**: Single cell containing multiple actions separated by line breaks
- **Output**: Array of strings, one action per element
- **Processing**:
  - Split by line break character (`\n`)
  - Trim each element
  - Filter out empty strings
- **Validation**: Skip row if no action types found

### 4. Violation Types

- **Input**: Single cell containing multiple violations separated by line breaks
- **Output**: Array of strings, one violation per element
- **Processing**:
  - Split by line break character (`\n`)
  - Trim each element
  - Filter out empty strings
- **Validation**: Skip row if no violation types found

### 5. Fine Amount

- **Input**: String with currency symbols, commas, and/or whitespace (e.g., "4,200,000" or "17,900")
- **Output**: Numeric value (no currency)
- **Processing**:
  - Remove all non-numeric characters except decimal point
  - Parse as float
  - If parsing fails or value is blank, use 0
- **Special Cases**:
  - "n/a" → 0
  - Blank/empty → 0
  - Non-numeric → 0

### 6. Pending Determination (underAppeal)

- **Input**: Yes/No string
- **Output**: Boolean (true/false)
- **Processing**: Case-insensitive comparison
  - "Yes" or "yes" → true
  - All other values (including "No") → false

### 7. Reference Number (documentId)

- **Input**: String or blank
- **Output**: String
- **Processing**:
  - Trim whitespace
  - If blank, set to "n/a"

### 8. Enforcement Notice URL

- **Input**: Full URL or blank
- **Output**: URL string or undefined
- **Processing**:
  - Do NOT parse or validate URL
  - Trim whitespace
  - If blank, leave as undefined/null

## Regulator Validation

Before inserting an enforcement record:

1. **Check if regulator exists**:
   - Query the `regulators` table using the "Regulator Name" value
   - Search is case-insensitive

2. **If regulator does NOT exist**:
   - Create new regulator with:
     - `name`: Regulator Name (trimmed)
     - `country`: Jurisdiction value
     - `currency`: "GBP" (default)
     - `active`: true
   - Log action: "Creating new regulator: [name]"

3. **If regulator EXISTS**:
   - Continue with enforcement insert
   - Log: "Regulator exists: [name]"

## Record Insertion

### Duplicate Detection

The enforcements table uses a composite unique constraint:

- **Unique fields**: documentId + subjectName + enforcementNoticeUrl

If a record with the same combination already exists:

- Do NOT insert the record
- Log a warning message with record details
- Continue processing next record

### Convex Mutation

Use the `createEnforcement` mutation with:

- All required fields (see CSV Column Mapping table above)
- `enforcementNoticeData`: Empty string (can be populated later via document processing)
- `enforcementNoticeSummary`: Empty string (can be populated later via AI summarization)
- `subjectNameCase`: Same as `subjectName` (optional field for case preservation)

## Error Handling

The script should:

1. **Log errors** with clear messages indicating:
   - Row number
   - Field that caused error
   - Error details

2. **Skip invalid rows**:
   - Rows with missing/invalid dates
   - Rows with no enforcement action types
   - Rows with no violation types

3. **Continue processing**:
   - Do not stop on individual row errors
   - Process all rows and report summary

4. **Report duplicates**:
   - Log when duplicate records are skipped
   - Do not treat duplicates as errors

## Script Output

The script should provide:

1. **Progress indicators**:
   - Total rows read
   - Rows transformed
   - Rows skipped (with reason)
   - Current record being processed

2. **Summary report**:
   - Successful inserts count
   - Duplicate records skipped count
   - Errors count
   - Total processed

3. **Error messages**:
   - Clear indication of what went wrong
   - Record identifier (subject name, document ID)
   - Actionable information

## Testing

### Test Mode

The script supports a `--test` flag to process only the first 5 records:

```bash
npx ts-node scripts/bulk-insert-enforcements.ts <csv-file> --test
```

This is useful for:

- Validating CSV format
- Testing data transformation
- Verifying regulator creation
- Checking database connectivity

### Test CSV

A sample CSV file (`test-fca-sample.csv`) is included with 5 FCA enforcement records for testing.

## Usage

### Command Line

```bash
# Production run - insert all records
npx ts-node scripts/bulk-insert-enforcements.ts path/to/your/file.csv

# Test mode - insert only first 5 records
npx ts-node scripts/bulk-insert-enforcements.ts path/to/your/file.csv --test
```

### Environment Setup

Required environment variable:

- `CONVEX_URL`: Convex deployment URL

This should be set in `.env.local` or as an environment variable.

## Implementation Notes

1. **Line Break Handling**: The CSV may contain multi-line cells for action types and violation types. These are separated by literal newline characters (`\n`) in the CSV file.

2. **Date Format Flexibility**: The script handles both 2-digit and 4-digit years.

3. **Regulator Case Sensitivity**: Regulator name matching is case-insensitive to prevent duplicate regulator records.

4. **Idempotency**: The script can be run multiple times safely. Duplicate records are detected and skipped.

5. **Currency Defaults**: If currency is blank, it remains undefined in the database. The regulator creation uses "GBP" as a default for new regulators.

## Example Data Transformation

### Input CSV Row

```
1,United Kingdom,FCA,EFG Private Bank Ltd,Financial Services,28-Mar-13,Financial Penalty,AML,"AML systems and controls
Enhanced Due Diligence (EDD)
Customer Due Diligence (CDD)","4,200,000",GBP,https://www.fca.org.uk/publication/final-notices/efg-private-bank.pdf,144036,No
```

### Transformed Record

```javascript
{
  documentId: "144036",
  jurisdiction: "United Kingdom",
  regulatorName: "FCA",
  subjectName: "EFG Private Bank Ltd",
  sector: "Financial Services",
  dateOfAction: "2013-03-28",
  enforcementActionType: [
    "Financial Penalty"
  ],
  field: "AML",
  violationTypes: [
    "AML systems and controls",
    "Enhanced Due Diligence (EDD)",
    "Customer Due Diligence (CDD)"
  ],
  fineAmount: 4200000,
  currency: "GBP",
  enforcementNoticeUrl: "https://www.fca.org.uk/publication/final-notices/efg-private-bank.pdf",
  underAppeal: false,
  year: 2013,
  month: 3,
  createdAt: "2026-04-25T12:34:56.789Z",
  updatedAt: "2026-04-25T12:34:56.789Z"
}
```

## References

- [Convex Documentation](https://docs.convex.dev/)
- CSV Format: RFC 4180 (with multi-line cell support)
- Date Format: ISO 8601 (YYYY-MM-DD)
- Timestamp Format: ISO 8601 with timezone (RFC 3339)
