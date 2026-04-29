import { Request, Response } from 'express';
import {
    COUNTRIES,
    CURRENCIES,
    CURRENCY_CATEGORY_ORDER,
    ENFORCEMENT_ACTION_TYPES,
    FIELDS,
    MAJOR_CURRENCY_CODES,
    SECTORS,
    VIOLATION_TYPES,
    categorizeCurrency,
    categorizeEnforcementAction,
    categorizeSector,
    categorizeViolationType,
} from '../constants';

export class ReferenceDataController {
  // ── Countries ──────────────────────────────────────────────────────────────

  getCountries(_req: Request, res: Response): void {
    const countries = COUNTRIES.map(c => ({ name: c, value: c }));
    res.json({
      success: true,
      data: { countries, total: countries.length },
      statusCode: 200,
    });
  }

  searchCountries(req: Request, res: Response): void {
    const { q } = req.query as { q: string };
    const term = q.toLowerCase().trim();
    const results = COUNTRIES.filter(c => c.toLowerCase().includes(term)).map(c => ({ name: c, value: c }));

    if (results.length === 0) {
      res.status(404).json({ success: false, error: `No countries found matching "${q}"`, statusCode: 404 });
      return;
    }

    res.json({ success: true, data: { countries: results, total: results.length, query: q }, statusCode: 200 });
  }

  // ── Currencies ─────────────────────────────────────────────────────────────

  getCurrencies(_req: Request, res: Response): void {
    const items = [
      { name: 'n/a', value: 'n/a', code: 'n/a', symbol: 'n/a', displayName: 'n/a' },
      ...CURRENCIES.map(c => ({
        name: `${c.name} (${c.code})`,
        value: c.code,
        code: c.code,
        symbol: c.symbol,
        displayName: c.name,
      })),
    ];
    res.json({ success: true, data: { items, total: items.length }, statusCode: 200 });
  }

  searchCurrencies(req: Request, res: Response): void {
    const { q } = req.query as { q: string };
    const term = q.toLowerCase().trim();
    const filtered = CURRENCIES.filter(
      c =>
        c.name.toLowerCase().includes(term) ||
        c.code.toLowerCase().includes(term) ||
        c.symbol.includes(term)
    );

    if (filtered.length === 0) {
      res.status(404).json({ success: false, error: `No currencies found matching "${q}"`, statusCode: 404 });
      return;
    }

    const items = filtered.map(c => ({
      name: `${c.name} (${c.code})`,
      value: c.code,
      code: c.code,
      symbol: c.symbol,
      displayName: c.name,
    }));
    res.json({ success: true, data: { items, total: items.length, query: q }, statusCode: 200 });
  }

  getCurrencyCategories(_req: Request, res: Response): void {
    const groups: Record<string, typeof CURRENCIES[number][]> = {};
    for (const currency of CURRENCIES) {
      const cat = categorizeCurrency(currency);
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(currency);
    }

    const categories = CURRENCY_CATEGORY_ORDER
      .filter(cat => groups[cat])
      .map(cat => ({
        category: cat,
        currencies: groups[cat]!.map(c => ({
          name: `${c.name} (${c.code})`,
          value: c.code,
          code: c.code,
          symbol: c.symbol,
          displayName: c.name,
        })),
        total: groups[cat]!.length,
      }));

    res.json({
      success: true,
      data: { categories, totalCategories: categories.length, totalCurrencies: CURRENCIES.length },
      statusCode: 200,
    });
  }

  getMajorCurrencies(_req: Request, res: Response): void {
    const items = CURRENCIES.filter(c => MAJOR_CURRENCY_CODES.includes(c.code)).map(c => ({
      name: `${c.name} (${c.code})`,
      value: c.code,
      code: c.code,
      symbol: c.symbol,
      displayName: c.name,
    }));
    res.json({ success: true, data: { items, total: items.length }, statusCode: 200 });
  }

  // ── Sectors ────────────────────────────────────────────────────────────────

  getSectors(_req: Request, res: Response): void {
    const items = SECTORS.map(s => ({ name: s, value: s }));
    res.json({ success: true, data: { items, total: items.length }, statusCode: 200 });
  }

  searchSectors(req: Request, res: Response): void {
    const { q } = req.query as { q: string };
    const term = q.toLowerCase().trim();
    const results = SECTORS.filter(s => s.toLowerCase().includes(term)).map(s => ({ name: s, value: s }));

    if (results.length === 0) {
      res.status(404).json({ success: false, error: `No sectors found matching "${q}"`, statusCode: 404 });
      return;
    }

    res.json({ success: true, data: { items: results, total: results.length, query: q }, statusCode: 200 });
  }

  getSectorCategories(_req: Request, res: Response): void {
    const groups: Record<string, string[]> = {};
    for (const sector of SECTORS) {
      const cat = categorizeSector(sector);
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(sector);
    }

    const categories = Object.entries(groups)
      .map(([cat, list]) => ({
        category: cat,
        sectors: list.map(s => ({ name: s, value: s })),
        total: list.length,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));

    res.json({
      success: true,
      data: { categories, totalCategories: categories.length, totalSectors: SECTORS.length },
      statusCode: 200,
    });
  }

  // ── Violation Types ────────────────────────────────────────────────────────

  getViolationTypes(_req: Request, res: Response): void {
    const items = VIOLATION_TYPES.map(t => ({ name: t, value: t }));
    res.json({ success: true, data: { items, total: items.length }, statusCode: 200 });
  }

  searchViolationTypes(req: Request, res: Response): void {
    const { q } = req.query as { q: string };
    const term = q.toLowerCase().trim();
    const results = VIOLATION_TYPES.filter(t => t.toLowerCase().includes(term)).map(t => ({ name: t, value: t }));

    if (results.length === 0) {
      res.status(404).json({ success: false, error: `No violation types found matching "${q}"`, statusCode: 404 });
      return;
    }

    res.json({ success: true, data: { items: results, total: results.length, query: q }, statusCode: 200 });
  }

  getViolationTypeCategories(_req: Request, res: Response): void {
    const groups: Record<string, string[]> = {};
    for (const type of VIOLATION_TYPES) {
      const cat = categorizeViolationType(type);
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(type);
    }

    const categories = Object.entries(groups)
      .map(([cat, list]) => ({
        category: cat,
        violationTypes: list.map(t => ({ name: t, value: t })),
        total: list.length,
      }))
      .sort((a, b) => a.category.localeCompare(b.category));

    res.json({
      success: true,
      data: { categories, totalCategories: categories.length, totalViolationTypes: VIOLATION_TYPES.length },
      statusCode: 200,
    });
  }

  // ── Enforcement Action Types ───────────────────────────────────────────────

  getEnforcementActionTypes(_req: Request, res: Response): void {
    const actionTypes = ENFORCEMENT_ACTION_TYPES.map(t => ({ name: t, value: t }));
    res.json({ success: true, data: { actionTypes, total: actionTypes.length }, statusCode: 200 });
  }

  searchEnforcementActionTypes(req: Request, res: Response): void {
    const { q } = req.query as { q: string };
    const term = q.toLowerCase().trim();
    const results = ENFORCEMENT_ACTION_TYPES.filter(t => t.toLowerCase().includes(term)).map(t => ({ name: t, value: t }));
    res.json({ success: true, data: { actionTypes: results, total: results.length, query: q }, statusCode: 200 });
  }

  getEnforcementActionTypeCategories(_req: Request, res: Response): void {
    const groups: Record<string, string[]> = {};
    for (const type of ENFORCEMENT_ACTION_TYPES) {
      const cat = categorizeEnforcementAction(type);
      if (!groups[cat]) groups[cat] = [];
      groups[cat]!.push(type);
    }

    const categories = Object.entries(groups).map(([cat, list]) => ({
      category: cat,
      actionTypes: list.map(t => ({ name: t, value: t })),
      total: list.length,
    }));

    res.json({
      success: true,
      data: { categories, totalCategories: categories.length, totalActionTypes: ENFORCEMENT_ACTION_TYPES.length },
      statusCode: 200,
    });
  }

  // ── Fields ─────────────────────────────────────────────────────────────────

  getFields(_req: Request, res: Response): void {
    const fields = FIELDS.map(f => ({ name: f, value: f }));
    res.json({ success: true, data: { fields, total: fields.length }, statusCode: 200 });
  }
}

export const referenceDataController = new ReferenceDataController();
