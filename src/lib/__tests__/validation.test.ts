import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  validatePartitaIVA,
  validateCodiceFiscale,
  validateTarga,
  validatePhone,
  validateRequired,
} from '../validation';

describe('validateEmail', () => {
  it('returns null for a valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull();
  });

  it('returns null for email with subdomain', () => {
    expect(validateEmail('user@mail.example.com')).toBeNull();
  });

  it('returns error for empty string', () => {
    expect(validateEmail('')).toBe("L'email è obbligatoria");
  });

  it('returns error for whitespace-only string', () => {
    expect(validateEmail('   ')).toBe("L'email è obbligatoria");
  });

  it('returns error for email without @', () => {
    expect(validateEmail('userexample.com')).toBe('Formato email non valido');
  });

  it('returns error for email without domain', () => {
    expect(validateEmail('user@')).toBe('Formato email non valido');
  });

  it('returns error for email without local part', () => {
    expect(validateEmail('@example.com')).toBe('Formato email non valido');
  });
});

describe('validatePassword', () => {
  it('returns error for empty password', () => {
    expect(validatePassword('')).toBe('La password è obbligatoria');
  });

  it('returns error for password shorter than default min length', () => {
    expect(validatePassword('abc')).toBe('La password deve avere almeno 6 caratteri');
  });

  it('returns null for password meeting default min length', () => {
    expect(validatePassword('abcdef')).toBeNull();
  });

  it('returns null for long password', () => {
    expect(validatePassword('a-very-long-password-123!')).toBeNull();
  });

  it('respects custom min length', () => {
    expect(validatePassword('abcdefgh', 10)).toBe('La password deve avere almeno 10 caratteri');
    expect(validatePassword('abcdefghij', 10)).toBeNull();
  });
});

describe('validatePartitaIVA', () => {
  it('returns null for empty string (optional field)', () => {
    expect(validatePartitaIVA('')).toBeNull();
  });

  it('returns null for valid 11-digit P.IVA', () => {
    expect(validatePartitaIVA('12345678901')).toBeNull();
  });

  it('returns error for too short P.IVA', () => {
    expect(validatePartitaIVA('1234567890')).toBe('La partita IVA deve essere di 11 cifre');
  });

  it('returns error for too long P.IVA', () => {
    expect(validatePartitaIVA('123456789012')).toBe('La partita IVA deve essere di 11 cifre');
  });

  it('returns error for non-numeric P.IVA', () => {
    expect(validatePartitaIVA('1234567890A')).toBe('La partita IVA deve essere di 11 cifre');
  });
});

describe('validateCodiceFiscale', () => {
  it('returns null for empty string (optional field)', () => {
    expect(validateCodiceFiscale('')).toBeNull();
  });

  it('returns null for valid 16-character codice fiscale', () => {
    expect(validateCodiceFiscale('RSSMRA85M01H501Z')).toBeNull();
  });

  it('returns error for too short codice fiscale', () => {
    expect(validateCodiceFiscale('RSSMRA85M01H50')).toBe(
      'Il codice fiscale deve essere di 16 caratteri alfanumerici'
    );
  });

  it('returns error for too long codice fiscale', () => {
    expect(validateCodiceFiscale('RSSMRA85M01H501ZZ')).toBe(
      'Il codice fiscale deve essere di 16 caratteri alfanumerici'
    );
  });

  it('returns error for codice fiscale with special characters', () => {
    expect(validateCodiceFiscale('RSSMRA85M01H50!Z')).toBe(
      'Il codice fiscale deve essere di 16 caratteri alfanumerici'
    );
  });
});

describe('validateTarga', () => {
  it('returns null for empty string (optional field)', () => {
    expect(validateTarga('')).toBeNull();
  });

  it('returns null for valid Italian plate (AB123CD)', () => {
    expect(validateTarga('AB123CD')).toBeNull();
  });

  it('returns null for lowercase valid plate', () => {
    expect(validateTarga('ab123cd')).toBeNull();
  });

  it('returns error for plate with wrong format', () => {
    expect(validateTarga('1234ABC')).toBe('Formato targa non valido (es. AB123CD)');
  });

  it('returns error for plate with too few characters', () => {
    expect(validateTarga('AB12CD')).toBe('Formato targa non valido (es. AB123CD)');
  });

  it('returns error for all-letter plate', () => {
    expect(validateTarga('ABCDEFG')).toBe('Formato targa non valido (es. AB123CD)');
  });
});

describe('validatePhone', () => {
  it('returns null for empty string (optional field)', () => {
    expect(validatePhone('')).toBeNull();
  });

  it('returns null for valid Italian mobile number', () => {
    expect(validatePhone('+393331234567')).toBeNull();
  });

  it('returns null for number without country code', () => {
    expect(validatePhone('3331234567')).toBeNull();
  });

  it('returns error for too short number', () => {
    expect(validatePhone('12345')).toBe('Numero di telefono non valido');
  });

  it('returns error for letters in phone number', () => {
    expect(validatePhone('abcdefghij')).toBe('Numero di telefono non valido');
  });
});

describe('validateRequired', () => {
  it('returns error for empty string', () => {
    expect(validateRequired('', 'Nome')).toBe('Nome è obbligatorio');
  });

  it('returns error for whitespace-only string', () => {
    expect(validateRequired('   ', 'Nome')).toBe('Nome è obbligatorio');
  });

  it('returns null for non-empty string', () => {
    expect(validateRequired('Mario', 'Nome')).toBeNull();
  });
});
