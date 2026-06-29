import type { CondicaoMaterializada, TabelaVenda } from "../types";

type CondBase = Pick<
  TabelaVenda,
  "cond_entrada_pct" | "cond_saldo_pct" | "cond_num_parcelas" | "cond_reforcos"
>;

/** Materializa a condição base (% do valor) em R$ para um valor de unidade. */
export function materializarBase(valor: number, t: CondBase): CondicaoMaterializada {
  const entrada = Math.round((valor * t.cond_entrada_pct) / 100);
  const saldo = Math.round((valor * t.cond_saldo_pct) / 100);
  const reforcos = (t.cond_reforcos ?? []).map((r) => ({
    data: r.data,
    valor: Math.round((valor * r.pct) / 100),
  }));
  const somaReforcos = reforcos.reduce((s, r) => s + r.valor, 0);
  const mensaisTotal = valor - entrada - saldo - somaReforcos;
  const numParcelas = t.cond_num_parcelas;
  const valorParcela = numParcelas > 0 ? Math.round(mensaisTotal / numParcelas) : 0;
  return { entrada, reforcos, numParcelas, valorParcela, saldo };
}

/** Soma nominal de uma condição materializada (= preço a prazo). */
export function totalCondicao(c: CondicaoMaterializada): number {
  const r = c.reforcos.reduce((s, x) => s + x.valor, 0);
  return c.entrada + r + c.numParcelas * c.valorParcela + c.saldo;
}
