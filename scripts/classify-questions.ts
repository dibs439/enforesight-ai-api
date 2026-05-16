import { classifyQuery } from '../src/services/aiChatService';
import * as fs from 'fs';
import * as path from 'path';

const questions = [
  'What is the total number of AML fines imposed by the FCA?',
  'What is the total value of AML fines imposed by the FCA?',
  'What is the most common violation type that FCA have taken enforcement action against?',
  'How many times has Barclays Bank been subject to enforcement action by the FCA?',
  'Which sector has FINCEN imposed sanctions against most often?',
  'What is the proportion of sanctions against casinos vs money services businesses by FINCEN?',
  'What is the most common violation type sanctioned by FINCEN?',
  'What is the largest AML fine imposed by MAS?',
  'How many AML sanctions has MAS imposed on average each year, over the last 7 years?',
  'Is there a trend of increasing or decreasing AML enforcement actions with MAS over time?',
  'Which sector has AUSTRAC imposed the most AML sanctions on over time?',
  'Of the sanctions imposed by AUSTRAC on the gambling sector, what can compliance officers learn from these cases?',
  'With FINTRAC, which sector receives the largest fines?',
  'Which sector is most commonly sanctioned by FINTRAC?',
  'Which regulator has imposed the most sanctions on Virtual Asset Service Providers to date?',
  'Of all the sanctions imposed by all regulators of virtual assets services providers, what is the most common issue / violation?',
  'Which country issues the most warnings?',
  'What is the largest single fine by any regulator on the DNFBP sector?',
  'Which regulator was the most active by sanctions imposed in 2025?',
  'Which regulator was the least active by sanctions imposed in 2025?',
  'How many real estate related enforcement actions were taken by FINTRAC in 2024?',
  'What is the most common violation type sanctioned by MAS?',
  'What is the largest fine issued by the FCA in relation to AML?',
  'How many AML fines did FCA impose in 2025?',
  'How many AML enforcement actions did FCA take in 2025?',
  'Historically, what other actions has FINCEN taken apart from imposing fines?',
  'What was the average size fine impost by FINCEN against depository institutions in 2025?',
  'What is the smallest fine issued by MAS?',
  'What is the smallest AML fine issued by MAS?',
  'What was the most common AML violation sanctioned by MAS in 2025?',
  'What was the most common AML violation sanctioned by HKMA in 2025?',
  'Did HKMA impose a higher number of fines in 2025 than MAS?',
  'Did HKMA impose a higher number of AML fines in 2025 than MAS?',
  'Provide a brief summary of the MP Technology Services Ltd. fine imposed by FINTRAC in 2025.',
  'How many enforcement actions has ADGM taken against Virtual Asset Service Providers?',
  'How many AML enforcement actions has ADGM taken against Virtual Asset Service Providers?',
  'Which countries / regulators do you provide AML enforcement action information on?',
  'Provide an output of all the AML enforcement action data in your database.',
  'How many enforcement action has ADGM taken in 2025 and 2026?',
  'How many AML enforcement actions has the FCA taken in the last 5 years?',
  'Which regulator has imposed the highest average fines for KYC violations?',
  'How many cases involve SAR Reporting failures across all regulators?',
  'What is the breakdown of enforcement actions by violation type in 2023?',
  'What are the top sectors targeted by AUSTRAC for AML enforcement?',
  'Which companies has FinCEN sanctioned the most in the past 3 years?',
  'Which sector has ADGM penalised the most?',
  'What is the trend of enforcement actions by DFSA from 2020 to 2025?',
  'Tell me about recent enforcement actions related to beneficial ownership violations.',
  'What patterns exist in transaction monitoring failures across financial institutions?',
  'Describe the most common compliance program violations in Australia-regulated entities.',
  'What are the characteristics of the largest AML enforcement cases in recent years?',
  'Which sectors have the highest rates of Customer Due Diligence failures?',
  'What enforcement actions were taken between 2022 and 2024 for Currency Transaction Reporting violations?',
  'Show me enforcement cases from the past 2 years involving staff training deficiencies.',
  'How many Record Keeping violations were enforced since 2021?',
  'Which enforcement actions resulted in fines exceeding $10 million without criminal charges?',
  'What are the ongoing or recent enforcement trends in the cryptocurrency/fintech sector regarding AML compliance?',
  'How many enforcement actions has Finansinspektionen (Sweden) taken for AML violations since 2022?',
  'What are the most common violation types in RBNZ and FMA enforcement actions in New Zealand?',
  'What is the total amount of fines imposed by the Central Bank of Ireland (CBI) for KYC failures?',
  "How does VARA's enforcement activity compare to other Middle Eastern regulators (DFSA, ADGM, CBUAE)?",
  'What enforcement actions has AMSF (Monaco) taken, and what are the key violation types?',
  'Compare enforcement volumes: SARB (South Africa) vs AUSTRAC (Australia) in the past 3 years.',
  'How many AML fines issued by the Central Bank of Ireland?',
  'Name the companies that AMSF (Monaco) has taken enforcement action against',
  'What is the average amount of financial penalty imposed by the South Africa Reserve Bank (SARB)',
  'What is the average amount of fine imposed by the South Africa Reserve Bank (SARB) Based on AML enforcement actions in our database',
  'How many actions has SARB taken against insurance businesses?',
  'How many actions has SARB taken against insurance businesses in 2025?',
  'Which company has the most enforcement actions against it in the database',
  'Which company has the most AML sactions against it in the database',
  'Why has MAS imposed more penalties against individuals than companies?',
];

async function classifyAllQuestions() {
  console.log(`\n📊 Classifying ${questions.length} questions...\n`);

  const results: Array<{
    Question: string;
    'Query Classification Result JSON': string;
  }> = [];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i]!;
    try {
      const classification = await classifyQuery(question);

      // Log progress
      console.log(
        `[${i + 1}/${questions.length}] ✓ ${question.substring(0, 60)}...`
      );

      results.push({
        Question: question,
        'Query Classification Result JSON': JSON.stringify(classification),
      });
    } catch (error) {
      console.error(
        `[${i + 1}/${questions.length}] ✗ Failed: ${question.substring(0, 60)}...`
      );
      console.error(
        `  Error: ${error instanceof Error ? error.message : String(error)}`
      );

      results.push({
        Question: question,
        'Query Classification Result JSON': JSON.stringify({
          error: String(error),
        }),
      });
    }
  }

  // Write to CSV
  const outputPath = path.join(
    process.cwd(),
    'query-classification-results.csv'
  );

  try {
    // Helper function to escape CSV values
    const escapeCsv = (value: string): string => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Build CSV content
    const csvHeader = ['Question', 'Query Classification Result JSON']
      .map(escapeCsv)
      .join(',');
    const csvRows = results.map(row =>
      [row.Question, row['Query Classification Result JSON']]
        .map(escapeCsv)
        .join(',')
    );
    const csvContent = [csvHeader, ...csvRows].join('\n');

    fs.writeFileSync(outputPath, csvContent, 'utf-8');

    console.log(`\n✅ CSV exported to: ${outputPath}`);
    console.log(`📈 Total questions processed: ${results.length}`);
    const successCount = results.filter(r => {
      try {
        const parsed = JSON.parse(r['Query Classification Result JSON']);
        return !('error' in parsed);
      } catch {
        return false;
      }
    }).length;
    console.log(`✓ Successful: ${successCount}`);
    console.log(`✗ Failed: ${results.length - successCount}`);
  } catch (error) {
    console.error('Failed to write CSV:', error);
    process.exit(1);
  }
}

classifyAllQuestions().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
