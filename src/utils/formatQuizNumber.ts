export function formatQuizNumber(value: number | string | null | undefined): string {
  const numericValue = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numericValue)) {
    return value?.toString() ?? 'Bilinmiyor';
  }

  return new Intl.NumberFormat('tr-TR', {
    maximumFractionDigits: 3
  }).format(numericValue);
}
