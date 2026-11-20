import { describe, it, expect } from 'vitest';

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function parseRecipients(rawText: string) {
  const lines = rawText.split(/[\r\n,;]+/);
  const valid = new Set<string>();
  const invalid = new Set<string>();

  for (const item of lines) {
    const trimmed = item.trim().replace(/^["']|["']$/g, '');
    if (!trimmed || trimmed.toLowerCase() === 'email' || trimmed.toLowerCase() === 'recipient') {
      continue;
    }

    if (EMAIL_REGEX.test(trimmed)) {
      valid.add(trimmed.toLowerCase());
    } else if (trimmed.length > 3) {
      invalid.add(trimmed);
    }
  }

  return {
    valid: Array.from(valid),
    invalid: Array.from(invalid),
  };
}

describe('Frontend CSV & Recipient Parsing', () => {
  it('extracts valid emails and eliminates header and duplicates', () => {
    const input = `Email
test1@company.com
test2@startup.io
test1@company.com
invalid-address
TEST2@startup.io`;

    const { valid, invalid } = parseRecipients(input);

    expect(valid).toHaveLength(2);
    expect(valid).toContain('test1@company.com');
    expect(valid).toContain('test2@startup.io');
    expect(invalid).toHaveLength(1);
    expect(invalid).toContain('invalid-address');
  });

  it('handles comma and semicolon separated recipient strings', () => {
    const input = 'user1@a.com, user2@b.com; user3@c.com, user1@a.com';
    const { valid } = parseRecipients(input);

    expect(valid).toHaveLength(3);
    expect(valid).toEqual(['user1@a.com', 'user2@b.com', 'user3@c.com']);
  });
});
