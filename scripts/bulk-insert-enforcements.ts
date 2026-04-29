import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { parse } from 'csv-parse';

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// ============================================================================
// BULK INSERT SCRIPT FOR ENFORCEMENTS FROM CSV
// ============================================================================
// This script reads enforcement data from a CSV file and inserts it into
// the Convex database, with proper data transformation and validation.
//
// Usage:
//   npx ts-node scripts/bulk-insert-enforcements.ts <csv-file-path> [--test]
//
// Arguments:
//   csv-file-path: Path to the CSV file to import
//   --test:        (Optional) Test mode - insert only first 5 records
//
// Environment Variables:
//   CONVEX_URL: Convex deployment URL (from .env.local or environment)
// ============================================================================

interface EnforcementRecord {
  documentId?: string;
  jurisdiction: string;
  regulatorName: string;
  subjectName: string;
  sector?: string | undefined;
  dateOfAction?: string;
  enforcementActionType: string[];
  field?: string | undefined;
  violationTypes: string[];
  fineAmount: number;
  currency?: string | undefined;
  enforcementNoticeUrl?: string | undefined;
  underAppeal: boolean;
  createdAt: string;
  updatedAt: string;
  year?: number;
  month?: number;
}

interface CSVRow {
  [key: string]: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Trim whitespace from string
 */
function trimString(value: string | undefined): string {
  return value ? value.trim() : '';
}

/**
 * Parse date from DD-MMM-YY format to YYYY-MM-DD
 * Example: "28-Mar-13" -> "2013-03-28"
 */
function parseDateOfAction(
  dateStr: string | undefined
): { date: string; year: number; month: number } | null {
  try {
    const trimmed = trimString(dateStr);
    if (!trimmed) return null;

    const months: { [key: string]: number } = {
      Jan: 1,
      Feb: 2,
      Mar: 3,
      Apr: 4,
      May: 5,
      Jun: 6,
      Jul: 7,
      Aug: 8,
      Sep: 9,
      Oct: 10,
      Nov: 11,
      Dec: 12,
    };

    // Match pattern: DD-MMM-YY or DD-MMM-YYYY
    const match = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
    if (!match) return null;

    const day = parseInt(match[1]!, 10);
    const monthStr = match[2]!;
    let year = parseInt(match[3]!, 10);

    const month = months[monthStr];
    if (!month) return null;

    // Convert 2-digit year to 4-digit year
    if (year < 100) {
      year = year < 30 ? 2000 + year : 1900 + year;
    }

    // Format as YYYY-MM-DD
    const dateStr2 = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
      date: dateStr2,
      year,
      month,
    };
  } catch (error) {
    console.error(`Error parsing date "${dateStr}":`, error);
    return null;
  }
}

/**
 * Parse fine amount - extract numeric value or return 0
 */
function parseFineAmount(fineStr: string | undefined): number {
  try {
    const trimmed = trimString(fineStr);
    if (!trimmed || trimmed.toLowerCase() === 'n/a') return 0;

    // Remove currency symbols, commas, and whitespace
    const cleaned = trimmed.replace(/[^\d.]/g, '');
    const amount = parseFloat(cleaned);

    return isNaN(amount) ? 0 : amount;
  } catch (error) {
    console.error(`Error parsing fine amount "${fineStr}":`, error);
    return 0;
  }
}

/**
 * Parse enforcement action types - split by line breaks and filter empty
 */
function parseActionTypes(actionStr: string | undefined): string[] {
  try {
    const trimmed = trimString(actionStr);
    if (!trimmed) return [];

    return trimmed
      .split('\n')
      .map(item => trimString(item))
      .filter(item => item.length > 0);
  } catch (error) {
    console.error(`Error parsing action types "${actionStr}":`, error);
    return [];
  }
}

/**
 * Parse violation types - split by line breaks and filter empty
 */
function parseViolationTypes(violationStr: string | undefined): string[] {
  try {
    const trimmed = trimString(violationStr);
    if (!trimmed) return [];

    return trimmed
      .split('\n')
      .map(item => trimString(item))
      .filter(item => item.length > 0);
  } catch (error) {
    console.error(`Error parsing violation types "${violationStr}":`, error);
    return [];
  }
}

/**
 * Parse boolean from Yes/No string
 */
function parseBoolean(value: string | undefined): boolean {
  const trimmed = trimString(value).toLowerCase();
  return trimmed === 'yes';
}

/**
 * Read and parse CSV file using csv-parse
 */
async function readCSV(filePath: string): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const rows: CSVRow[] = [];

    // Read the file content and skip header metadata rows
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const fileLines = fileContent.split('\n');

    // Find the actual header row (should contain 'Jurisdiction', 'Regulator Name', etc.)
    let headerIndex = 0;
    for (let i = 0; i < fileLines.length; i++) {
      if (
        fileLines[i]!.includes('Jurisdiction') &&
        fileLines[i]!.includes('Regulator Name')
      ) {
        headerIndex = i;
        break;
      }
    }

    // Get the data (header + data rows only)
    const dataLines = fileLines.slice(headerIndex).join('\n');

    const parser = parse(dataLines, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    });

    parser.on('readable', function () {
      let record;
      while ((record = parser.read()) !== null) {
        const row: CSVRow = {};
        // Trim all values
        for (const [key, value] of Object.entries(record)) {
          row[trimString(key)] = typeof value === 'string' ? value : '';
        }
        rows.push(row);
      }
    });

    parser.on('error', (error: Error) => {
      reject(error);
    });

    parser.on('end', () => {
      resolve(rows);
    });
  });
}

/**
 * Transform CSV row to enforcement record
 */
function transformRow(row: CSVRow): EnforcementRecord | null {
  try {
    // Parse date first
    const dateInfo = parseDateOfAction(row['Date of Action']);
    if (!dateInfo) {
      console.warn(
        `⚠️  Skipping row - invalid or missing date: "${row['Date of Action']}"`
      );
      return null;
    }

    // Parse enforcement action types - support both FCA and FINCEN formats
    // FCA uses 'Enforcement Action Type', FINCEN uses 'Action Type'
    const actionTypeStr =
      row['Enforcement Action Type'] || row['Action Type'] || '';
    const actionTypes = parseActionTypes(actionTypeStr);
    if (actionTypes.length === 0) {
      console.warn(
        `⚠️  Skipping row - no enforcement action types: "${row['Subject Name (Case)']}"}`
      );
      return null;
    }

    // Parse violation types - support both FINCEN and ADGM formats
    // FINCEN uses 'AML Violation Type(s)', ADGM uses 'AML Violation Type'
    // Violation types are optional - some records may not have them specified
    const violationTypeStr =
      row['AML Violation Type(s)'] || row['AML Violation Type'] || '';
    const violationTypes = parseViolationTypes(violationTypeStr);

    const now = new Date().toISOString();

    const record: EnforcementRecord = {
      documentId: trimString(row['Reference No.']) || 'n/a',
      jurisdiction: trimString(row['Jurisdiction']),
      regulatorName: trimString(row['Regulator Name']),
      subjectName: trimString(row['Subject Name (Case)']),
      sector: trimString(row['Sector']) || undefined,
      dateOfAction: dateInfo.date,
      enforcementActionType: actionTypes,
      field: trimString(row['Field']) || undefined,
      violationTypes: violationTypes,
      fineAmount: parseFineAmount(row['Fine Amount']),
      currency: trimString(row['Currency']) || undefined,
      enforcementNoticeUrl:
        trimString(row['Enforcement Notice URL']) || undefined,
      underAppeal: parseBoolean(row['Pending Determination']),
      year: dateInfo.year,
      month: dateInfo.month,
      createdAt: now,
      updatedAt: now,
    };

    return record;
  } catch (error) {
    console.error(`Error transforming row:`, error);
    return null;
  }
}

/**
 * Check if regulator exists, create if not
 */
async function ensureRegulatorExists(
  convexUrl: string,
  regulatorName: string,
  jurisdiction: string
): Promise<void> {
  try {
    // Query regulators by name using the HTTP API
    const queryResponse = await fetch(`${convexUrl}/api/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: 'regulators:getAllRegulators',
        args: {
          name: regulatorName,
          offset: 0,
          limit: 100,
        },
      }),
    });

    if (!queryResponse.ok) {
      throw new Error(`Query failed: ${queryResponse.statusText}`);
    }

    const queryData = (await queryResponse.json()) as any;
    const regulators = queryData.value?.regulators || [];

    const exists = regulators.some(
      (reg: any) => reg.name.toLowerCase() === regulatorName.toLowerCase()
    );

    if (!exists) {
      console.log(`  📝 Creating new regulator: ${regulatorName}`);

      const createResponse = await fetch(`${convexUrl}/api/mutation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: 'regulators:createRegulator',
          args: {
            name: regulatorName,
            country: jurisdiction,
            currency: 'GBP',
            active: true,
          },
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Create regulator failed: ${errorText}`);
      }

      console.log(`  ✅ Regulator created: ${regulatorName}`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log(`  ℹ️  Regulator already exists: ${regulatorName}`);
    } else {
      throw error;
    }
  }
}

/**
 * Insert enforcement record
 */
async function insertEnforcement(
  convexUrl: string,
  record: EnforcementRecord
): Promise<string> {
  try {
    const response = await fetch(`${convexUrl}/api/mutation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        path: 'enforcements:createEnforcement',
        args: {
          documentId: record.documentId,
          jurisdiction: record.jurisdiction,
          regulatorName: record.regulatorName,
          subjectName: record.subjectName,
          sector: record.sector || '',
          dateOfAction: record.dateOfAction,
          enforcementActionType: record.enforcementActionType,
          field: record.field || '',
          violationTypes: record.violationTypes,
          fineAmount: record.fineAmount,
          currency: record.currency,
          enforcementNoticeUrl: record.enforcementNoticeUrl,
          enforcementFile: null,
          enforcementNoticeData: '',
          enforcementNoticeSummary: '',
          underAppeal: record.underAppeal,
          year: record.year,
          month: record.month,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes('already exists')) {
        console.log(
          `  ℹ️  Enforcement record already exists for: ${record.subjectName}`
        );
        return 'duplicate';
      }
      throw new Error(`Insert failed: ${errorText}`);
    }

    const data = (await response.json()) as any;
    return data.value;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log(
        `  ℹ️  Enforcement record already exists for: ${record.subjectName}`
      );
      return 'duplicate';
    }
    throw error;
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const csvFilePath = args[0];
    const testMode = args.includes('--test');

    if (!csvFilePath) {
      console.error('❌ Error: CSV file path is required');
      console.error(
        'Usage: npx ts-node scripts/bulk-insert-enforcements.ts <csv-file-path> [--test]'
      );
      process.exit(1);
    }

    if (!fs.existsSync(csvFilePath)) {
      console.error(`❌ Error: File not found: ${csvFilePath}`);
      process.exit(1);
    }

    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      console.error('❌ Error: CONVEX_URL environment variable is not set');
      console.error(
        'Please set it in .env.local or as an environment variable'
      );
      process.exit(1);
    }

    console.log('🚀 Bulk Insert Enforcements');
    console.log('═'.repeat(50));
    console.log(`📁 CSV File: ${csvFilePath}`);
    console.log(`🔗 Convex URL: ${convexUrl}`);
    if (testMode) {
      console.log('🧪 Test Mode: Will insert only 5 records');
    }
    console.log('');

    // Verify Convex connection
    console.log('🔗 Verifying Convex connection...');
    try {
      const testResponse = await fetch(`${convexUrl}/api/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: 'regulators:getAllRegulators',
          args: {
            offset: 0,
            limit: 1,
          },
        }),
      });

      if (!testResponse.ok) {
        throw new Error(`Connection failed: ${testResponse.statusText}`);
      }

      console.log('✅ Convex connection successful');
    } catch (error) {
      console.error(
        '❌ Failed to connect to Convex:',
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
    console.log('');

    // Read CSV
    console.log('📖 Reading CSV file...');
    const rows = await readCSV(csvFilePath);
    console.log(`✅ Read ${rows.length} rows from CSV`);
    console.log('');

    // Process rows
    console.log('🔄 Processing rows...');
    const recordsToInsert: { row: CSVRow; record: EnforcementRecord }[] = [];
    let skippedCount = 0;

    for (const row of rows) {
      const record = transformRow(row);
      if (record) {
        recordsToInsert.push({ row, record });
      } else {
        skippedCount++;
      }
    }

    console.log(`✅ Transformed ${recordsToInsert.length} records`);
    if (skippedCount > 0) {
      console.log(`⏭️  Skipped ${skippedCount} rows (invalid data)`);
    }
    console.log('');

    // Limit to test mode
    const recordsToProcess = testMode
      ? recordsToInsert.slice(0, 5)
      : recordsToInsert;

    if (testMode && recordsToInsert.length > 5) {
      console.log(
        `🧪 Test mode: Processing first 5 records (${recordsToInsert.length} available)`
      );
    }
    console.log('');

    // Insert records
    console.log('💾 Inserting records into database...');
    console.log('');

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < recordsToProcess.length; i++) {
      const item = recordsToProcess[i]!;
      const { record } = item;
      console.log(
        `[${i + 1}/${recordsToProcess.length}] ${record.subjectName}`
      );

      try {
        // Ensure regulator exists
        await ensureRegulatorExists(
          convexUrl,
          record.regulatorName,
          record.jurisdiction
        );

        // Insert enforcement
        const id = await insertEnforcement(convexUrl, record);

        if (id === 'duplicate') {
          duplicateCount++;
        } else {
          console.log(`  ✅ Inserted with ID: ${id}`);
          successCount++;
        }
      } catch (error) {
        console.error(
          `  ❌ Error:`,
          error instanceof Error ? error.message : String(error)
        );
        errorCount++;
      }

      console.log('');
    }

    // Summary
    console.log('═'.repeat(50));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(50));
    console.log(`✅ Successful inserts: ${successCount}`);
    if (duplicateCount > 0) {
      console.log(`ℹ️  Duplicate records skipped: ${duplicateCount}`);
    }
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount}`);
    }
    console.log(
      `📈 Total processed: ${successCount + duplicateCount + errorCount}/${recordsToProcess.length}`
    );
    console.log('');

    if (errorCount === 0 && duplicateCount === 0) {
      console.log('🎉 All records inserted successfully!');
    } else if (errorCount === 0) {
      console.log('✅ All records processed (some were duplicates)');
    }

    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error(
      '❌ Fatal error:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
