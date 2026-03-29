import { useState, useCallback } from 'react';

// ============================================
// Validators
// ============================================

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'L\'email è obbligatoria';
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'Formato email non valido';
  return null;
}

export function validatePassword(password: string, minLength = 6): string | null {
  if (!password) return 'La password è obbligatoria';
  if (password.length < minLength) return `La password deve avere almeno ${minLength} caratteri`;
  return null;
}

export function validateRequired(value: string, fieldName: string): string | null {
  if (!value.trim()) return `${fieldName} è obbligatorio`;
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone.trim()) return null; // optional by default
  const re = /^(\+?\d{1,4}[\s-]?)?\d{6,14}$/;
  if (!re.test(phone.replace(/\s/g, ''))) return 'Numero di telefono non valido';
  return null;
}

export function validateCodiceFiscale(cf: string): string | null {
  if (!cf.trim()) return null; // optional by default
  const re = /^[A-Za-z0-9]{16}$/;
  if (!re.test(cf.trim())) return 'Il codice fiscale deve essere di 16 caratteri alfanumerici';
  return null;
}

export function validatePartitaIVA(piva: string): string | null {
  if (!piva.trim()) return null; // optional by default
  const re = /^\d{11}$/;
  if (!re.test(piva.trim())) return 'La partita IVA deve essere di 11 cifre';
  return null;
}

export function validateTarga(targa: string): string | null {
  if (!targa.trim()) return null; // optional by default
  const re = /^[A-Za-z]{2}\d{3}[A-Za-z]{2}$/;
  if (!re.test(targa.trim().replace(/\s/g, ''))) return 'Formato targa non valido (es. AB123CD)';
  return null;
}

// ============================================
// Hook
// ============================================

export function useFormValidation<T extends Record<string, string>>(
  validators: Record<keyof T, (value: string) => string | null>
) {
  const keys = Object.keys(validators) as (keyof T)[];
  const initial = Object.fromEntries(keys.map((k) => [k, null])) as Record<keyof T, string | null>;

  const [errors, setErrors] = useState<Record<keyof T, string | null>>(initial);

  const validate = useCallback((field: keyof T, value: string): boolean => {
    const error = validators[field](value);
    setErrors((prev) => ({ ...prev, [field]: error }));
    return error === null;
  }, [validators]);

  const validateAll = useCallback((values: T): boolean => {
    const newErrors = {} as Record<keyof T, string | null>;
    let allValid = true;
    for (const key of keys) {
      const error = validators[key](values[key]);
      newErrors[key] = error;
      if (error !== null) allValid = false;
    }
    setErrors(newErrors);
    return allValid;
  }, [validators, keys]);

  const isValid = Object.values(errors).every((e) => e === null);

  const clearErrors = useCallback(() => {
    setErrors(initial);
  }, []);

  return { errors, validate, validateAll, isValid, clearErrors };
}
