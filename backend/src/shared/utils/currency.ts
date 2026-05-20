export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[R$\s.,]/g, (match) => {
    if (match === ',') return '.';
    if (match === '.') return '';
    return '';
  })) || 0;
}
