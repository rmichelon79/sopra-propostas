// Helpers de mês/ano sobre datas ISO (1º do mês). Granularidade mensal.

export function isoMes(ano: number, mes: number): string {
  return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-01`;
}

export function parseMes(iso: string | null): { ano: number; mes: number } | null {
  if (!iso) return null;
  const [a, m] = iso.split("-");
  return { ano: Number(a), mes: Number(m) };
}

/** Meses de `de` até `ate` (pode ser negativo). Usa só ano/mês. */
export function mesesEntre(de: string, ate: string): number {
  const d = parseMes(de);
  const a = parseMes(ate);
  if (!d || !a) return 0;
  return (a.ano - d.ano) * 12 + (a.mes - d.mes);
}

export function fmtMesAno(iso: string | null): string {
  const p = parseMes(iso);
  return p ? `${String(p.mes).padStart(2, "0")}/${p.ano}` : "—";
}

export function hojeMes(): string {
  const d = new Date();
  return isoMes(d.getFullYear(), d.getMonth() + 1);
}
