# Bulk Insert Enforcements - Complete Guide

This guide explains how to bulk insert enforcement action data from a CSV file into the Enforesight database.

## Overview

The bulk insert process uses two complementary scripts:

1. **bulk-insert-enforcements-validate.js** - Validates and previews CSV data transformations (no database connection needed)
2. **bulk-insert-enforcements.ts** - Inserts validated data into Convex (requires running Convex dev server)

## Quick Start

### Step 1: Validate Your CSV

First, validate that your CSV file is properly formatted and will transform correctly:

```bash
node scripts/bulk-insert-enforcements-validate.js path/to/your/file.csv --test
```

This will:

- Parse the CSV file using proper CSV parsing (handles multi-line fields)
- Transform each row according to the rules in BULK_INSERT_ENFORCEMENTS.md
- Show you a preview of the first 5 records
- Display any errors in the data
- Report success rate

### Step 2: Review Test Data

The validation script will output a JSON preview of the 5 test records. Review this to ensure:

- Dates are converted correctly (DD-MMM-YY → YYYY-MM-DD)
- Fine amounts are parsed as numbers
- Arrays are properly split (action types, violation types)
- All required fields are present

### Step 3: Insert Data

Once you've validated the data, insert it into Convex:

```bash
# Make sure Convex dev server is running
npm run convex

# In another terminal, run the insert script
npx ts-node scripts/bulk-insert-enforcements.ts path/to/your/file.csv
```

For testing with just 5 records:

```bash
npx ts-node scripts/bulk-insert-enforcements.ts path/to/your/file.csv --test
```

## Detailed Usage

### Validation Script

**Command:**

```bash
node scripts/bulk-insert-enforcements-validate.js <csv-file> [--test] [--output <file>]
```

**Options:**

- `<csv-file>` - Path to your CSV file (required)
- `--test` - Test mode: process only first 5 records
- `--output <file>` - Save JSON output to a file

**Output:**

- Console display of sample valid records
- Test data in JSON format (if `--test` flag used)
- Summary statistics

**Example:**

```bash
# Validate entire file
node scripts/bulk-insert-enforcements-validate.js data/fca-enforcements.csv

# Test mode with output file
node scripts/bulk-insert-enforcements-validate.js data/fca-enforcements.csv --test --output test-data.json

# Check for issues before inserting
node scripts/bulk-insert-enforcements-validate.js data/large-file.csv
```

### Insert Script

**Command:**

```bash
npx ts-node scripts/bulk-insert-enforcements.ts <csv-file> [--test]
```

**Prerequisites:**

- Convex dev server must be running (`npm run convex`)
- `.env.local` file with `CONVEX_URL` set (usually auto-loaded)

**Options:**

- `<csv-file>` - Path to CSV file to import
- `--test` - Test mode: insert only first 5 records

**Features:**

- Validates regulator exists in database, creates if needed
- Detects duplicate records and skips them
- Provides detailed progress reporting
- Generates summary report

**Example:**

```bash
# Insert test batch (5 records)
npx ts-node scripts/bulk-insert-enforcements.ts scripts/test-fca-sample.csv --test

# Insert entire file
npx ts-node scripts/bulk-insert-enforcements.ts data/fca-enforcements.csv
```

## Test Data

A sample CSV with 5 FCA enforcement records is provided at:

```
scripts/test-fca-sample.csv
```

These records include:

1. EFG Private Bank Ltd - £4.2M fine (2013)
2. Guaranty Trust Bank (UK) Limited - £525K fine (2013)
3. Standard Bank PLC - £7.64M fine (2014)
4. Steven George Smith - £17.9K fine (2016)
5. Sonali Bank (UK) Limited - £3.25M fine (2016)

To test both scripts:

```bash
# 1. Validate the test CSV
node scripts/bulk-insert-enforcements-validate.js scripts/test-fca-sample.csv --test

# 2. Insert the test data (after starting Convex)
npx ts-node scripts/bulk-insert-enforcements.ts scripts/test-fca-sample.csv --test
```

## CSV Format Requirements

### Column Headers (Exact Names Required)

```
Jurisdiction
Regulator Name
Subject Name (Case)
Sector
Date of Action
Enforcement Action Type
Field
AML Violation Type(s)
Fine Amount
Currency
Enforcement Notice URL
Reference No.
Pending Determination
```

### Data Format Details

| Column                  | Format          | Examples                               | Notes                                    |
| ----------------------- | --------------- | -------------------------------------- | ---------------------------------------- |
| Jurisdiction            | Text            | "United Kingdom", "USA"                | Country/region                           |
| Regulator Name          | Text            | "FCA", "SEC"                           | Will be created if doesn't exist         |
| Subject Name (Case)     | Text            | "EFG Private Bank Ltd"                 | Company or individual name               |
| Sector                  | Text            | "Financial Services", "Individual"     | Optional                                 |
| Date of Action          | DD-MMM-YY       | "28-Mar-13", "22-Jan-14"               | Converted to YYYY-MM-DD                  |
| Enforcement Action Type | Multi-line text | "Financial Penalty\nProhibition Order" | Split by line breaks into array          |
| Field                   | Text            | "AML"                                  | Optional                                 |
| AML Violation Type(s)   | Multi-line text | "AML systems and controls\nEDD\nCDD"   | Split by line breaks into array          |
| Fine Amount             | Number          | "4,200,000", "17900"                   | Comma separators OK; converted to number |
| Currency                | Text            | "GBP", "USD"                           | Optional                                 |
| Enforcement Notice URL  | URL             | "https://example.com/notice.pdf"       | Optional; not parsed                     |
| Reference No.           | Text            | "144036", "SGS01046"                   | Set to "n/a" if blank                    |
| Pending Determination   | Yes/No          | "Yes", "No"                            | Converted to true/false                  |

### Multi-Line Fields

Fields that support multiple values (Action Type, Violation Types) should have each item on a new line within the quoted cell:

```csv
Subject Name,Enforcement Action Type
"My Bank","Financial Penalty
Restriction
Prohibition Order"
```

In Excel/Sheets: `Alt+Enter` or `Ctrl+Enter` to create line breaks within cells.

## Data Transformation Rules

### Date Conversion

- Input: `DD-MMM-YY` (e.g., "28-Mar-13")
- Output: `YYYY-MM-DD` (e.g., "2013-03-28")
- Year handling: 00-29 → 2000-2029, 30-99 → 1930-1999
- Extracted: `year` (2013) and `month` (3) fields

### Fine Amount

- Removes currency symbols ($, £, €, etc.)
- Removes commas
- Parses as number
- "n/a" or blank → 0

### Action Types & Violations

- Split by newline character (`\n`)
- Each item trimmed of whitespace
- Empty items filtered out
- Result: array of strings

### Pending Determination

- "Yes" (case-insensitive) → `true`
- Everything else → `false`

### Whitespace

- All strings trimmed before and after
- Internal whitespace preserved

## Troubleshooting

### CSV Parsing Issues

**Issue:** "No valid records found"

Check that:

- CSV has correct column headers (exact names required)
- Date format is DD-MMM-YY (e.g., "28-Mar-13")
- Multi-line cells are properly quoted in CSV

**Fix:** Use the validation script to see detailed error messages:

```bash
node scripts/bulk-insert-enforcements-validate.js your-file.csv
```

### Convex Connection Issues

**Issue:** "Failed to connect to Convex"

Check that:

- Convex dev server is running: `npm run convex`
- `.env.local` file exists with `CONVEX_URL`
- Network connection is active

**Fix:**

```bash
# In one terminal
npm run convex

# In another terminal
npx ts-node scripts/bulk-insert-enforcements.ts path/to/file.csv
```

### Duplicate Records

**Issue:** Some records are skipped as "already exists"

This is normal. The script detects duplicates using:

- documentId + subjectName + enforcementNoticeUrl

To force re-insert, modify one of these fields or delete the existing record from the database first.

## Advanced Usage

### Batch Processing Large Files

For very large CSV files (10,000+ records), process in batches:

```bash
# Validate the entire file first
node scripts/bulk-insert-enforcements-validate.js large-file.csv

# Then insert in batches of 100-500 records
# (Split the CSV manually or implement batch processing)
npx ts-node scripts/bulk-insert-enforcements.ts batch-1.csv
npx ts-node scripts/bulk-insert-enforcements.ts batch-2.csv
```

### Export Test Data

Save processed test data to JSON for review or import into another system:

```bash
node scripts/bulk-insert-enforcements-validate.js your-file.csv --test --output processed-data.json
```

### Track Progress

The insert script logs each record as it's processed. Redirect output to a file for tracking:

```bash
npx ts-node scripts/bulk-insert-enforcements.ts data/file.csv 2>&1 | tee import-log.txt
```

## Validation Results Interpretation

### Success Indicators

- ✅ Valid records: matches total rows
- No ⚠️ Invalid records
- Success rate: 100.0%

### Issues to Address

- ⚠️ Invalid records: 5+
  - Check dates are DD-MMM-YY format
  - Ensure multi-line fields are split by newlines
  - Verify no required fields are empty

### Common Errors

- "Invalid or missing date" - Date format not DD-MMM-YY
- "No enforcement action types found" - Action type field empty
- "No violation types found" - Violation type field empty

## Database Impact

The insert script will:

**Create (if not exists):**

- New regulator records (with country and default currency GBP)

**Insert (always):**

- New enforcement records (unless duplicate detected)

**Skip:**

- Duplicate records (same documentId + subjectName + URL)

**Set automatically:**

- createdAt, updatedAt (current timestamp)
- year, month (extracted from dateOfAction)

## Performance Notes

- Validation script: ~1-2 seconds for 1000 records
- Insert script: ~1-2 seconds per 10 records (depends on network)
- Batch processing recommended for 5000+ records

## Support

For issues or questions:

1. Check the validation results for data format issues
2. Review BULK_INSERT_ENFORCEMENTS.md for detailed requirements
3. Check Convex logs: `npm run convex`
4. Verify CSV column headers match exactly

## References

- [CSV Format Specification](BULK_INSERT_ENFORCEMENTS.md)
- [Convex Documentation](https://docs.convex.dev/)
- [Test Sample](../scripts/test-fca-sample.csv)
