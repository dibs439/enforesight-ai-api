export const SECTORS: readonly string[] = [
  'Bank',
  'Banks',
  'Capital Markets Services',
  'Casinos',
  'Currency Exchange',
  'DNFBP - Corporate Service Provider',
  'DNFBP - Dealer in Precious Metal Stone',
  'DNFBP - Dealer Precious Metals and Stones',
  'DNFBP - Dealer Precious Metals Stones',
  'DNFBP - Legal',
  'DNFBP - Real Estate',
  'Depository Institutions',
  'Depository Institutions, Money Service Businesses',
  'Depository Institutions, Money Services Businesses',
  'Financial Services',
  'FInancial Services',
  'Gambling',
  'Individual',
  'Insurance',
  'Major Payment Institutions',
  'Money Services',
  'Money Services Business',
  'Precious Metals/Jewelry Industry',
  'Remittance',
  'Remittance Dealer',
  'Remittance Service Provider',
  'Reporting Entity',
  'Securities and Futures',
  'Stored Value Facility',
  'Trust Company',
  'Virtual Assets Service Provider',
  'Virtual Assets Services Provider (VASP)',
  'Virtual Assests Service Provider (VASP)',
].sort() as readonly string[];

export type SectorCategory =
  | 'banking'
  | 'financial_services'
  | 'money_services'
  | 'virtual_assets'
  | 'dnfbp'
  | 'capital_markets'
  | 'gaming'
  | 'insurance'
  | 'individual'
  | 'precious_metals'
  | 'other';

export function categorizeSector(sector: string): SectorCategory {
  const s = sector.toLowerCase();
  if (s.includes('bank') || s.includes('depository')) return 'banking';
  if (s.includes('financial services')) return 'financial_services';
  if (s.includes('money services') || s.includes('remittance') || s.includes('currency exchange') || s.includes('payment')) return 'money_services';
  if (s.includes('virtual assets') || s.includes('vasp')) return 'virtual_assets';
  if (s.includes('dnfbp')) return 'dnfbp';
  if (s.includes('capital markets') || s.includes('securities') || s.includes('futures') || s.includes('trust')) return 'capital_markets';
  if (s.includes('casino') || s.includes('gambling')) return 'gaming';
  if (s.includes('insurance')) return 'insurance';
  if (s.includes('individual')) return 'individual';
  if (s.includes('precious metals') || s.includes('jewelry')) return 'precious_metals';
  return 'other';
}
