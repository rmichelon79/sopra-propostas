export const brl = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR");

export const brlPreciso = (v: number) =>
  "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
