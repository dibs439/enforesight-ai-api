export const ENFORCEMENT_ACTION_TYPES: readonly string[] = [
  'Cancellation of registration',
  'Cancellation of registration of remittance service providers',
  'Direction',
  'Enforceable Undertaking',
  'Financial Penalty',
  'Infringement Notice',
  'Licence Application Rejected',
  'Licence Revoked',
  'Licence Suspension',
  'Licence cancellation',
  'Licence suspension',
  'Prohibition Order',
  'Public Censure',
  'Public Reprimand',
  'Refusal of registration',
  'Refusal of registration of remittance service providers',
  'Refusal to renew registration',
  'Refusal to renew the registration of remittance service providers',
  'Registration Cancellation',
  'Remedial Direction',
  'Remediation',
  'Reprimand',
  'Restriction',
  'Restitution',
  'Skilled Person Review',
  'Suspension of registration',
  'Suspension of registration of remittance service providers',
].sort() as readonly string[];

export type EnforcementActionCategory =
  | 'financial'
  | 'registration'
  | 'prohibition'
  | 'remedial'
  | 'reprimand'
  | 'other';

export function categorizeEnforcementAction(actionType: string): EnforcementActionCategory {
  const t = actionType.toLowerCase();
  if (t.includes('financial') || t.includes('penalty')) return 'financial';
  if (t.includes('registration') || t.includes('licence') || t.includes('license')) return 'registration';
  if (t.includes('prohibition') || t.includes('restriction') || t.includes('suspension')) return 'prohibition';
  if (t.includes('remedial') || t.includes('remediation') || t.includes('direction')) return 'remedial';
  if (t.includes('reprimand') || t.includes('censure')) return 'reprimand';
  return 'other';
}
