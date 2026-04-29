# Enforcement Bulk Upload CSV Format

## Overview

Upload enforcement records in bulk using a CSV file. Maximum 500 rows per upload.

## API Endpoint

```
POST /api/admin/enforcements/bulk-upload
Content-Type: multipart/form-data
Authorization: Bearer <JWT_TOKEN>
```

## Field Name: `file`

Upload the CSV file with field name `file` in the multipart form data.

## CSV Format Requirements

### Required Columns

- `subjectName` - Name of the subject/entity (REQUIRED)
- `regulatorName` - Name of the regulatory body (REQUIRED)

### Optional Columns

- `documentId` - Unique document identifier
- `jurisdiction` - Jurisdiction/country
- `sector` - Business sector
- `field` - Field of violation
- `dateOfAction` - Date of enforcement action (YYYY-MM-DD format)
- `year` - Year of action (number)
- `month` - Month of action (1-12)
- `enforcementActionType` - Type of action (string or comma-separated values or JSON array)
- `violationTypes` - Types of violations (string or comma-separated values or JSON array)
- `fineAmount` - Fine amount (number)
- `currency` - Currency code (e.g., USD, EUR, GBP)
- `enforcementNoticeUrl` - URL to enforcement notice
- `enforcementNoticeURL` - Alternative URL field
- `enforcementNoticeData` - Full text of enforcement notice (summary will be auto-generated using AI)
- `enforcementFile` - File reference
- `subjectNameCase` - Case-preserved subject name
- `underAppeal` - Whether under appeal (true/false/1/0)

## Auto-Generated Summary

**Important**: If you provide `enforcementNoticeData`, the system will automatically generate an AI-powered summary (3000-4000 characters) and save it as `enforcementNoticeSummary`. You do NOT need to include `enforcementNoticeSummary` in your CSV file.

The AI summary includes:

- Key violations and findings
- Penalties and fines
- Regulatory body and subject details
- Important dates
- Formatted as clear, readable paragraphs

## Sample CSV

```csv
documentId,regulatorName,subjectName,jurisdiction,sector,field,dateOfAction,year,month,enforcementActionType,violationTypes,fineAmount,currency,enforcementNoticeUrl,enforcementNoticeData,underAppeal
DOC-001,AUSTRAC,ABC Bank Limited,Australia,Banking,AML/CFT,2023-05-15,2023,5,"Civil Penalty,Warning","Money Laundering,KYC Failures",500000,AUD,https://example.com/notice1.pdf,"Full text of the enforcement notice goes here...",false
DOC-002,FINCEN,XYZ Corporation,United States,Financial Services,BSA/AML,2023-06-20,2023,6,Civil Penalty,Suspicious Activity Reporting,250000,USD,https://example.com/notice2.pdf,"Detailed enforcement notice content...",false
```

## Array Fields Format

Array fields (`enforcementActionType`, `violationTypes`) can be provided in three formats:

1. **Comma-separated string**: `"Civil Penalty,Warning"`
2. **JSON array string**: `"[\"Civil Penalty\",\"Warning\"]"`
3. **Single value**: `"Civil Penalty"`

## Duplicate Detection

Records are checked for duplicates using this combination:

- `subjectName`
- `regulatorName`
- `dateOfAction`

If a match is found, the record is skipped.

## Response Format

### Success Response

```json
{
  "success": true,
  "message": "Bulk upload completed",
  "results": {
    "total": 100,
    "inserted": 95,
    "skipped": 5,
    "errors": [
      {
        "row": 23,
        "error": "Missing required fields: subjectName and regulatorName are required",
        "data": { ... }
      }
    ]
  }
}
```

### Error Response

```json
{
  "error": "Too many rows",
  "details": "CSV file contains 750 rows. Maximum allowed is 500 rows"
}
```

## Common Error Messages

| Error                     | Description                                  |
| ------------------------- | -------------------------------------------- |
| `No file uploaded`        | No CSV file was provided                     |
| `Invalid file type`       | File is not a CSV (must have .csv extension) |
| `Empty CSV file`          | CSV contains no data rows                    |
| `Too many rows`           | CSV exceeds 500 row limit                    |
| `Invalid CSV format`      | CSV file cannot be parsed                    |
| `Missing required fields` | Row missing subjectName or regulatorName     |

## Notes

1. **File Size Limit**: Maximum 10MB
2. **Row Limit**: Maximum 500 rows per upload
3. **Encoding**: UTF-8 encoding recommended
4. **Headers**: First row must contain column names
5. **Empty Lines**: Empty lines are automatically skipped
6. **Whitespace**: Leading and trailing whitespace is automatically trimmed
7. **Date Format**: Use YYYY-MM-DD for `dateOfAction`
8. **Boolean Values**: Use `true/false` or `1/0` for `underAppeal`
9. **Numbers**: `fineAmount`, `year`, `month` are parsed as numbers
10. **Cleanup**: Uploaded file is deleted after processing
11. **AI Summary Generation**: If `enforcementNoticeData` is provided, an AI-powered summary will be automatically generated (may take a few seconds per row)
12. **Processing Time**: Expect longer processing times when `enforcementNoticeData` is included due to AI summary generation

## Tips for Best Results

- Keep field names exactly as specified (case-sensitive)
- Use consistent date formats
- Validate data before upload
- Split large datasets into multiple 500-row batches
- Review the error results to fix rejected rows
- For array fields, prefer comma-separated format for simplicity
- Include `enforcementNoticeData` for automatic AI summary generation
- Be patient during upload - AI summary generation takes time (~2-3 seconds per row with data)
