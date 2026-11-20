import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/utils/encryption';

describe('AES-256-GCM Encryption Utility', () => {
  it('encrypts and decrypts sensitive tokens symmetrically', () => {
    const secretToken = 'test-token-value';
    const encrypted = encrypt(secretToken);

    expect(encrypted).not.toBe(secretToken);
    expect(encrypted.split(':')).toHaveLength(3); // iv:tag:cipher

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(secretToken);
  });

  it('handles empty strings gracefully', () => {
    expect(encrypt('')).toBe('');
    expect(decrypt('')).toBe('');
  });
});
