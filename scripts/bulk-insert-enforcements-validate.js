#!/usr/bin/env node

/**
 * Bulk Insert Enforcements - CSV Validator and Data Transformer
 *
 * This script validates and transforms enforcement CSV data without
 * needing a live Convex connection. Use it to:
 * 1. Validate CSV format and data
 * 2. Preview transformed data
 * 3. Generate test dataset
 *
 * Usage:
 *   node scripts/bulk-insert-enforcements-validate.js <csv-file> [--test] [--output <file>]
 */

const fs = require('fs');
const path = require('path');
const parse = require('csv-parse');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Trim whitespace from string
 */
function trimString(value) {
  return value ? String(value).trim() : '';
}

/**
 * Parse date from DD-MMM-YY format to YYYY-MM-DD
 */
function parseDateOfAction(dateStr) {
  try {
    const trimmed = trimString(dateStr);
    if (!trimmed) return null;

    const months = {
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

    const match = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const monthStr = match[2];
    let year = parseInt(match[3], 10);

    const month = months[monthStr];
    if (!month) return null;

    if (year < 100) {
      year = year < 30 ? 2000 + year : 1900 + year;
    }

    const dateStr2 = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
      date: dateStr2,
      year,
      month,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Parse fine amount
 */
function parseFineAmount(fineStr) {
  try {
    const trimmed = trimString(fineStr);
    if (!trimmed || trimmed.toLowerCase() === 'n/a') return 0;

    const cleaned = trimmed.replace(/[^\d.]/g, '');
    const amount = parseFloat(cleaned);

    return isNaN(amount) ? 0 : amount;
  } catch (error) {
    return 0;
  }
}

/**
 * Parse enforcement action types
 */
function parseActionTypes(actionStr) {
  try {
    const trimmed = trimString(actionStr);
    if (!trimmed) return [];

    return trimmed
      .split('\n')
      .map(item => trimString(item))
      .filter(item => item.length > 0);
  } catch (error) {
    return [];
  }
}

/**
 * Parse violation types
 */
function parseViolationTypes(violationStr) {
  try {
    const trimmed = trimString(violationStr);
    if (!trimmed) return [];

    return trimmed
      .split('\n')
      .map(item => trimString(item))
      .filter(item => item.length > 0);
  } catch (error) {
    return [];
  }
}

/**
 * Parse boolean from Yes/No
 */
function parseBoolean(value) {
  const trimmed = trimString(value).toLowerCase();
  return trimmed === 'yes';
}

/**
 * Read and parse CSV file using csv-parse
 */
async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    const stream = fs.createReadStream(filePath);

    const parser = parse.parse({
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: true,
    });

    parser.on('readable', function () {
      let row;
      while ((row = parser.read())) {
        rows.push(row);
      }
    });

    parser.on('error', function (err) {
      reject(err);
    });

    parser.on('end', function () {
      resolve(rows);
    });

    stream.pipe(parser);
  });
}

/**
 * Transform CSV row to enforcement record
 */
function transformRow(row, rowNumber) {
  try {
    const dateInfo = parseDateOfAction(row['Date of Action']);
    if (!dateInfo) {
      return {
        valid: false,
        rowNumber,
        error: `Invalid or missing date: "${row['Date of Action']}"`,
        subjectName: row['Subject Name (Case)'],
      };
    }

    const actionTypes = parseActionTypes(row['Enforcement Action Type']);
    if (actionTypes.length === 0) {
      return {
        valid: false,
        rowNumber,
        error: 'No enforcement action types found',
        subjectName: row['Subject Name (Case)'],
      };
    }

    const violationTypes = parseViolationTypes(row['AML Violation Type(s)']);
    if (violationTypes.length === 0) {
      return {
        valid: false,
        rowNumber,
        error: 'No violation types found',
        subjectName: row['Subject Name (Case)'],
      };
    }

    const now = new Date().toISOString();

    return {
      valid: true,
      rowNumber,
      data: {
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
      },
    };
  } catch (error) {
    return {
      valid: false,
      rowNumber,
      error: error.message,
      subjectName: row['Subject Name (Case)'],
    };
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    const args = process.argv.slice(2);
    const csvFilePath = args[0];
    const testMode = args.includes('--test');
    const outputIndex = args.indexOf('--output');
    const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : null;

    if (!csvFilePath) {
      console.error('❌ Error: CSV file path is required');
      console.error(
        'Usage: node scripts/bulk-insert-enforcements-validate.js <csv-file> [--test] [--output <file>]'
      );
      process.exit(1);
    }

    if (!fs.existsSync(csvFilePath)) {
      console.error(`❌ Error: File not found: ${csvFilePath}`);
      process.exit(1);
    }

    console.log('🚀 Enforcements CSV Validator & Data Transformer');
    console.log('═'.repeat(60));
    console.log(`📁 CSV File: ${csvFilePath}`);
    if (testMode) {
      console.log('🧪 Test Mode: Will process only first 5 records');
    }
    if (outputFile) {
      console.log(`💾 Output File: ${outputFile}`);
    }
    console.log('');

    // Read CSV
    console.log('📖 Reading CSV file...');
    const rows = await readCSV(csvFilePath);
    console.log(`✅ Read ${rows.length} rows from CSV\n`);

    // Process rows
    console.log('🔄 Transforming data...');
    const results = [];
    let rowNum = 0;

    for (const row of rows) {
      rowNum++;
      const result = transformRow(row, rowNum);
      results.push(result);
    }

    // Analyze results
    const validRecords = results.filter(r => r.valid);
    const invalidRecords = results.filter(r => !r.valid);

    console.log(`✅ Valid records: ${validRecords.length}`);
    if (invalidRecords.length > 0) {
      console.log(`⚠️  Invalid records: ${invalidRecords.length}`);
    }
    console.log('');

    // Show invalid records
    if (invalidRecords.length > 0) {
      console.log('⚠️  Invalid Records:');
      console.log('─'.repeat(60));
      invalidRecords.forEach(record => {
        console.log(`Row ${record.rowNumber}: ${record.subjectName}`);
        console.log(`  Error: ${record.error}`);
      });
      console.log('');
    }

    // Show sample of valid records
    console.log('✅ Sample Valid Records:');
    console.log('─'.repeat(60));
    const samplesToShow = testMode
      ? Math.min(5, validRecords.length)
      : Math.min(3, validRecords.length);
    validRecords.slice(0, samplesToShow).forEach((record, index) => {
      const data = record.data;
      console.log(`\n[${index + 1}] ${data.subjectName}`);
      console.log(`  Jurisdiction: ${data.jurisdiction}`);
      console.log(`  Regulator: ${data.regulatorName}`);
      console.log(
        `  Date: ${data.dateOfAction} (${data.year}-${String(data.month).padStart(2, '0')})`
      );
      console.log(
        `  Fine Amount: ${data.fineAmount} ${data.currency || 'N/A'}`
      );
      console.log(`  Action Types: ${data.enforcementActionType.join(', ')}`);
      console.log(
        `  Violations: ${data.violationTypes.slice(0, 2).join(', ')}${data.violationTypes.length > 2 ? '...' : ''}`
      );
      console.log(`  Under Appeal: ${data.underAppeal}`);
      console.log(`  Document ID: ${data.documentId}`);
    });
    console.log('');

    // Generate output
    if (testMode) {
      const testData = validRecords.slice(0, 5).map(r => r.data);
      const report = {
        timestamp: new Date().toISOString(),
        csvFile: csvFilePath,
        testMode: true,
        totalRows: rows.length,
        validRecords: validRecords.length,
        invalidRecords: invalidRecords.length,
        testRecords: testData.length,
        testData: testData,
        invalidDetails: invalidRecords.map(r => ({
          row: r.rowNumber,
          subjectName: r.subjectName,
          error: r.error,
        })),
      };

      const output = JSON.stringify(report, null, 2);

      if (outputFile) {
        fs.writeFileSync(outputFile, output);
        console.log(`💾 Test data exported to: ${outputFile}`);
      } else {
        console.log('📊 TEST DATA (JSON Format):');
        console.log('─'.repeat(60));
        console.log(output);
      }
    }

    // Summary
    console.log('');
    console.log('═'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Total rows: ${rows.length}`);
    console.log(`Valid records: ${validRecords.length}`);
    console.log(`Invalid records: ${invalidRecords.length}`);
    console.log(
      `Success rate: ${((validRecords.length / rows.length) * 100).toFixed(1)}%`
    );

    if (validRecords.length === rows.length) {
      console.log('');
      console.log('🎉 All records are valid and ready for insertion!');
    } else if (validRecords.length > 0) {
      console.log('');
      console.log(`✅ ${validRecords.length} records are ready for insertion`);
    } else {
      console.log('');
      console.log('❌ No valid records found');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
