import { describe, it, expect } from 'vitest';
import { RecipientParser, isValidEmail } from '../src/utils/csvParser';

describe('Recipient & Email Validation', () => {
  it('correctly validates valid email formats', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('john.doe+tag@reachinbox.ai')).toBe(true);
    expect(isValidEmail('user123@sub.domain.org')).toBe(true);
  });

  it('rejects invalid email formats', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('@missingusername.com')).toBe(false);
    expect(isValidEmail('missingatsign.com')).toBe(false);
    expect(isValidEmail('trailingdot@domain.')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('parses email list and removes duplicates', () => {
    const raw = `
      test1@example.com
      TEST1@example.com
      invalid-email
      test2@example.com
      test1@example.com
    `;

    const result = RecipientParser.parseEmailList(raw);
    expect(result.validEmails).toHaveLength(2);
    expect(result.validEmails).toContain('test1@example.com');
    expect(result.validEmails).toContain('test2@example.com');
    expect(result.invalidEmails).toContain('invalid-email');
  });

  it('parses CSV buffer with headers and extracts email column', async () => {
    const csvData = `First Name,Email,Company
Alice,alice@corp.com,Acme Corp
Bob,bob@corp.com,Beta LLC
Charlie,invalid-charles,Gamma Inc
Dave,alice@corp.com,Duplicate Acme`;

    const result = await RecipientParser.parseCsv(Buffer.from(csvData));
    expect(result.validEmails).toHaveLength(2);
    expect(result.validEmails).toContain('alice@corp.com');
    expect(result.validEmails).toContain('bob@corp.com');
    expect(result.invalidEmails).toContain('invalid-charles');
  });
});
