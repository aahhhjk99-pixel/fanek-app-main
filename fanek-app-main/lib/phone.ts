export function normalizeLibyaPhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, '');

  if (digits.startsWith('00218')) {
    return `+${digits.slice(2)}`;
  }
  if (digits.startsWith('218')) {
    return `+${digits}`;
  }
  if (digits.startsWith('0')) {
    return `+218${digits.slice(1)}`;
  }
  return `+218${digits}`;
}

export function getAuthEmailForPhone(value: string): string {
  return `${normalizeLibyaPhone(value)}@services.ly`;
}

export function isValidLibyaPhone(value: string): boolean {
  return /^\+2189[1-5][0-9]{7}$/.test(normalizeLibyaPhone(value));
}
