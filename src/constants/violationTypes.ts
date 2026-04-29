export const VIOLATION_TYPES: readonly string[] = [
  'AML Policies and Procedures',
  'AML systems and controls',
  'Business Risk Assessment (BRA)',
  'Business risk assessment',
  'Customer Due Diligence (CDD)',
  'Customer Risk Assessment',
  'Customer Risk Assessment (CRA)',
  'Customer risk assessment',
  'Enhanced Due Diligence (EDD)',
  'Failure to comply with requirement(s)',
  'Risk based policies and procedures',
  'Sanctions screening',
  'Skill, care and diligence',
  'Staff Training',
  'Suspicious Activity Reports (SARS)',
  'Transaction Monitoring',
  'Transaction monitoring',
  'Unlicensed VA activities',
].sort() as readonly string[];

export type ViolationTypeCategory =
  | 'aml'
  | 'due_diligence'
  | 'risk_assessment'
  | 'transaction_monitoring'
  | 'sanctions'
  | 'training_compliance'
  | 'policies_procedures'
  | 'reporting'
  | 'licensing'
  | 'compliance'
  | 'other';

export function categorizeViolationType(violationType: string): ViolationTypeCategory {
  const t = violationType.toLowerCase();
  if (t.includes('aml') || t.includes('anti-money laundering')) return 'aml';
  if (t.includes('due diligence') || t.includes('cdd') || t.includes('edd')) return 'due_diligence';
  if (t.includes('risk assessment') || t.includes('bra') || t.includes('cra')) return 'risk_assessment';
  if (t.includes('transaction monitoring')) return 'transaction_monitoring';
  if (t.includes('sanctions') || t.includes('screening')) return 'sanctions';
  if (t.includes('training') || t.includes('skill') || t.includes('care')) return 'training_compliance';
  if (t.includes('policies') || t.includes('procedures')) return 'policies_procedures';
  if (t.includes('suspicious') || t.includes('sars')) return 'reporting';
  if (t.includes('unlicensed') || t.includes('activities')) return 'licensing';
  if (t.includes('failure') || t.includes('comply')) return 'compliance';
  return 'other';
}
