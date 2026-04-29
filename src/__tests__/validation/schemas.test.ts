process.env.NODE_ENV = 'test';

import {
  changePasswordSchema,
  createClientSchema,
  createContentSchema,
  createEnforcementSchema,
  createRegulatorSchema,
  createUserSchema,
  enforcementFiltersSchema,
  idParamSchema,
  loginSchema,
  paginationSchema,
  updateEnforcementSchema,
  userFiltersSchema
} from '../../validation/schemas';

// ─── helpers ──────────────────────────────────────────────────────────────────

const validEnforcement = {
  documentId: 'DOC-001',
  jurisdiction: 'UK',
  regulatorName: 'FCA',
  subjectName: 'Acme Ltd',
  sector: 'Banking',
  dateOfAction: '2023-06-15',
  field: 'AML',
  currency: 'GBP',
  fineAmount: 100000,
  enforcementActionType: ['Fine'],
  violationTypes: ['AML'],
  enforcementNoticeUrl: 'https://example.com/notice.pdf',
};

// ─── paginationSchema ─────────────────────────────────────────────────────────

describe('paginationSchema', () => {
  it('defaults page=1, limit=20 when nothing supplied', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });

  it('parses string numbers into integers', () => {
    const result = paginationSchema.safeParse({ page: '3', limit: '50' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
      expect(result.data.limit).toBe(50);
    }
  });

  it('falls back to defaults for non-numeric strings', () => {
    const result = paginationSchema.safeParse({ page: 'abc', limit: 'xyz' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });
});

// ─── idParamSchema ────────────────────────────────────────────────────────────

describe('idParamSchema', () => {
  it('accepts a non-empty id', () => {
    expect(idParamSchema.safeParse({ id: 'a1b2c3' }).success).toBe(true);
  });

  it('rejects an empty id', () => {
    const result = idParamSchema.safeParse({ id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    const result = idParamSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── enforcementFiltersSchema ─────────────────────────────────────────────────

describe('enforcementFiltersSchema', () => {
  it('passes with no fields', () => {
    expect(enforcementFiltersSchema.safeParse({}).success).toBe(true);
  });

  it('transforms minFineAmount/maxFineAmount strings to floats', () => {
    const r = enforcementFiltersSchema.safeParse({ minFineAmount: '1000.5', maxFineAmount: '50000' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.minFineAmount).toBeCloseTo(1000.5);
      expect(r.data.maxFineAmount).toBe(50000);
    }
  });

  it('accepts valid ISO date strings', () => {
    const r = enforcementFiltersSchema.safeParse({ dateFrom: '2022-01-01', dateTo: '2022-12-31' });
    expect(r.success).toBe(true);
  });

  it('rejects malformed date strings', () => {
    const r = enforcementFiltersSchema.safeParse({ dateFrom: '01/01/2022' });
    expect(r.success).toBe(false);
  });

  it('rejects impossible date (Feb 30)', () => {
    const r = enforcementFiltersSchema.safeParse({ dateFrom: '2023-02-30' });
    expect(r.success).toBe(false);
  });

  it('rejects month 13', () => {
    const r = enforcementFiltersSchema.safeParse({ dateTo: '2023-13-01' });
    expect(r.success).toBe(false);
  });
});

// ─── createEnforcementSchema ──────────────────────────────────────────────────

describe('createEnforcementSchema', () => {
  it('accepts a complete valid record with URL', () => {
    expect(createEnforcementSchema.safeParse(validEnforcement).success).toBe(true);
  });

  it('accepts a complete valid record with file instead of URL', () => {
    const { enforcementNoticeUrl: _url, ...rest } = validEnforcement;
    const withFile = { ...rest, enforcementFile: 'uploads/file.pdf' };
    expect(createEnforcementSchema.safeParse(withFile).success).toBe(true);
  });

  it('rejects when neither URL nor file is provided', () => {
    const { enforcementNoticeUrl: _url, ...rest } = validEnforcement;
    const result = createEnforcementSchema.safeParse(rest);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map(i => i.message);
      expect(messages.some(m => m.includes('enforcement notice'))).toBe(true);
    }
  });

  it('accepts string fineAmount and converts to number', () => {
    const r = createEnforcementSchema.safeParse({ ...validEnforcement, fineAmount: '75000' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.fineAmount).toBe(75000);
  });

  it('rejects negative fineAmount', () => {
    const r = createEnforcementSchema.safeParse({ ...validEnforcement, fineAmount: -1 });
    expect(r.success).toBe(false);
  });

  it('rejects non-numeric string fineAmount', () => {
    const r = createEnforcementSchema.safeParse({ ...validEnforcement, fineAmount: 'not-a-number' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid dateOfAction', () => {
    const r = createEnforcementSchema.safeParse({ ...validEnforcement, dateOfAction: '15-06-2023' });
    expect(r.success).toBe(false);
  });

  it('wraps single string enforcementActionType into array', () => {
    const r = createEnforcementSchema.safeParse({ ...validEnforcement, enforcementActionType: 'Fine' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.enforcementActionType).toEqual(['Fine']);
  });

  it('rejects an invalid URL for enforcementNoticeUrl', () => {
    const r = createEnforcementSchema.safeParse({ ...validEnforcement, enforcementNoticeUrl: 'not-a-url' });
    expect(r.success).toBe(false);
  });

  it('requires documentId', () => {
    const { documentId: _d, ...rest } = validEnforcement;
    expect(createEnforcementSchema.safeParse(rest).success).toBe(false);
  });
});

// ─── updateEnforcementSchema ──────────────────────────────────────────────────

describe('updateEnforcementSchema', () => {
  it('accepts a partial record with no notice fields (fields preserved externally)', () => {
    expect(updateEnforcementSchema.safeParse({ regulatorName: 'SEC' }).success).toBe(true);
  });

  it('accepts partial with only URL provided', () => {
    expect(
      updateEnforcementSchema.safeParse({ enforcementNoticeUrl: 'https://new.example.com' }).success
    ).toBe(true);
  });

  it('rejects partial where both URL and file are present but empty', () => {
    const r = updateEnforcementSchema.safeParse({
      enforcementNoticeUrl: '',
      enforcementFile: '',
    });
    expect(r.success).toBe(false);
  });
});

// ─── createUserSchema ─────────────────────────────────────────────────────────

describe('createUserSchema', () => {
  const valid = { email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith', role: 'admin' };

  it('accepts valid admin user', () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
  });

  it('defaults isActive to true', () => {
    const r = createUserSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isActive).toBe(true);
  });

  it('rejects invalid email', () => {
    expect(createUserSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('rejects invalid role', () => {
    expect(createUserSchema.safeParse({ ...valid, role: 'superuser' }).success).toBe(false);
  });

  it('rejects missing firstName', () => {
    const { firstName: _f, ...rest } = valid;
    expect(createUserSchema.safeParse(rest).success).toBe(false);
  });
});

// ─── userFiltersSchema ────────────────────────────────────────────────────────

describe('userFiltersSchema', () => {
  it('transforms isActive string "true" to boolean true', () => {
    const r = userFiltersSchema.safeParse({ isActive: 'true' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isActive).toBe(true);
  });

  it('transforms isActive string "false" to boolean false', () => {
    const r = userFiltersSchema.safeParse({ isActive: 'false' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.isActive).toBe(false);
  });

  it('rejects invalid role', () => {
    expect(userFiltersSchema.safeParse({ role: 'superuser' }).success).toBe(false);
  });
});

// ─── createRegulatorSchema ────────────────────────────────────────────────────

describe('createRegulatorSchema', () => {
  const valid = { name: 'FCA', country: 'UK', currency: 'GBP' };

  it('accepts a valid regulator', () => {
    expect(createRegulatorSchema.safeParse(valid).success).toBe(true);
  });

  it('defaults active to true', () => {
    const r = createRegulatorSchema.safeParse(valid);
    if (r.success) expect(r.data.active).toBe(true);
  });

  it('rejects missing country', () => {
    const { country: _c, ...rest } = valid;
    expect(createRegulatorSchema.safeParse(rest).success).toBe(false);
  });
});

// ─── createClientSchema ───────────────────────────────────────────────────────

describe('createClientSchema', () => {
  const valid = { name: 'Client A', email: 'client@example.com' };

  it('accepts a minimal valid client', () => {
    expect(createClientSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(createClientSchema.safeParse({ ...valid, email: 'bad-email' }).success).toBe(false);
  });

  it('accepts optional phone and company', () => {
    const r = createClientSchema.safeParse({ ...valid, phone: '123', company: 'ACME' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBe('123');
      expect(r.data.company).toBe('ACME');
    }
  });
});

// ─── createContentSchema ──────────────────────────────────────────────────────

describe('createContentSchema', () => {
  const valid = { title: 'Article title', content: 'Body text', type: 'article' };

  it('accepts a valid article', () => {
    expect(createContentSchema.safeParse(valid).success).toBe(true);
  });

  it('defaults isPublished to false', () => {
    const r = createContentSchema.safeParse(valid);
    if (r.success) expect(r.data.isPublished).toBe(false);
  });

  it('rejects unknown type', () => {
    expect(createContentSchema.safeParse({ ...valid, type: 'blog' }).success).toBe(false);
  });

  it('accepts news and update types', () => {
    expect(createContentSchema.safeParse({ ...valid, type: 'news' }).success).toBe(true);
    expect(createContentSchema.safeParse({ ...valid, type: 'update' }).success).toBe(true);
  });
});

// ─── loginSchema ──────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('accepts valid email + password', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: 'secret' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(loginSchema.safeParse({ email: 'not-email', password: 'secret' }).success).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'user@example.com', password: '' }).success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
  });
});

// ─── changePasswordSchema ─────────────────────────────────────────────────────

describe('changePasswordSchema', () => {
  it('accepts matching passwords', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'old-pass',
      newPassword: 'new-pass-123',
      confirmPassword: 'new-pass-123',
    });
    expect(r.success).toBe(true);
  });

  it('rejects when newPassword and confirmPassword do not match', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'old-pass',
      newPassword: 'new-pass',
      confirmPassword: 'different-pass',
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      const messages = r.error.issues.map(i => i.message);
      expect(messages.some(m => m.includes("match"))).toBe(true);
    }
  });

  it('rejects newPassword shorter than 8 characters', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: 'old',
      newPassword: 'short',
      confirmPassword: 'short',
    });
    expect(r.success).toBe(false);
  });

  it('rejects empty currentPassword', () => {
    const r = changePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'new-pass-123',
      confirmPassword: 'new-pass-123',
    });
    expect(r.success).toBe(false);
  });
});
