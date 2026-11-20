import { Readable } from 'stream';
import csvParser from 'csv-parser';

export interface RecipientParseResult {
  validEmails: string[];
  invalidEmails: string[];
  totalParsed: number;
}

// Standard RFC 5322 compliant email regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
}

export class RecipientParser {
  /**
   * Parses raw CSV buffer or string into valid and invalid email addresses.
   * Auto-detects columns: email, Email, recipient, Recipient, to, To, contact, etc.
   * If no matching header is found, parses first column.
   */
  public static async parseCsv(csvContent: string | Buffer): Promise<RecipientParseResult> {
    return new Promise((resolve, reject) => {
      const validSet = new Set<string>();
      const invalidSet = new Set<string>();
      let totalParsed = 0;

      const bufferStream = new Readable();
      bufferStream.push(csvContent);
      bufferStream.push(null);

      bufferStream
        .pipe(csvParser())
        .on('data', (row: Record<string, string>) => {
          totalParsed++;
          let emailCandidate = '';

          // Look for standard column names
          const keys = Object.keys(row);
          const emailKey = keys.find((k) =>
            /^(email|recipient|to|contact|email_address|recipient_email)$/i.test(k.trim())
          );

          if (emailKey && row[emailKey]) {
            emailCandidate = row[emailKey].trim();
          } else if (keys.length > 0 && row[keys[0]]) {
            // Fallback to first column
            emailCandidate = row[keys[0]].trim();
          }

          if (isValidEmail(emailCandidate)) {
            validSet.add(emailCandidate.toLowerCase());
          } else if (emailCandidate) {
            invalidSet.add(emailCandidate);
          }
        })
        .on('end', () => {
          resolve({
            validEmails: Array.from(validSet),
            invalidEmails: Array.from(invalidSet),
            totalParsed,
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  /**
   * Parses an array of raw strings or newline-separated email addresses.
   */
  public static parseEmailList(rawList: string[] | string): RecipientParseResult {
    const list = Array.isArray(rawList)
      ? rawList
      : rawList.split(/[\r\n,;]+/);

    const validSet = new Set<string>();
    const invalidSet = new Set<string>();

    for (const item of list) {
      const trimmed = item.trim();
      if (!trimmed) continue;

      if (isValidEmail(trimmed)) {
        validSet.add(trimmed.toLowerCase());
      } else {
        invalidSet.add(trimmed);
      }
    }

    return {
      validEmails: Array.from(validSet),
      invalidEmails: Array.from(invalidSet),
      totalParsed: validSet.size + invalidSet.size,
    };
  }
}
