// ============================================================
// Motor de VPL e regras — Plataforma Sopra / Propostas.
//
// Ótica da empresa (entradas positivas). Valores NOMINAIS no V1
// (sem índice de correção), descontados à TMA efetiva mensal.
// VPL piso = valor presente mínimo aceito pela unidade (≈ preço à vista).
// Funções puras — sem dependência de React/Supabase, testáveis isoladas.
// ============================================================

export interface Reforco {
  mes: number;
  valor: number;
}
export interface Repasse {
  mes: number;
  valor: number;
}

/** Como o pagamento foi montado pelo vendedor. */
export interface PropostaConfig {
  entrada: number; // R$ no t0 (data-base)
  numParcelas: number; // nº de parcelas mensais
  valorParcela: number; // R$ por parcela
  reforcos?: Reforco[]; // balões anuais/semestrais
  repasse?: Repasse | null; // financiamento/chaves: aporte único num mês
}

/** Regras de negócio do empreendimento (config_vendas). */
export interface RegrasConfig {
  entradaMinimaPct: number; // % do preço negociado
  descontoMaximoPct: number; // % sobre o preço de tabela
  prazoMaximoMeses: number;
  parcelaMinimaReais: number;
  vplPisoFator: number; // 1.0 = piso é o preço à vista
  acaoForaRegra: "aprovacao" | "bloqueio";
}

export interface Checagem {
  chave: string;
  rotulo: string;
  ok: boolean;
  detalhe: string;
}

export type StatusProposta = "aprovavel" | "aprovacao" | "bloqueado";

export interface Avaliacao {
  vpl: number;
  vplPiso: number;
  entradaPct: number;
  descontoPct: number;
  prazo: number;
  totalNominal: number;
  checagens: Checagem[];
  status: StatusProposta; // verde / amarelo / vermelho
}

export interface AvaliacaoInput {
  precoTabela: number;
  precoNegociado: number;
  vplPiso?: number | null; // se null: precoTabela * regras.vplPisoFator
  config: PropostaConfig;
  regras: RegrasConfig;
  taxaDescontoAnual: number; // TMA, ex. 0.12 = 12% a.a.
}

const EPS = 1e-6;

/** TMA anual → taxa efetiva mensal: (1+i)^(1/12) - 1. */
export function taxaMensal(taxaAnual: number): number {
  return Math.pow(1 + taxaAnual, 1 / 12) - 1;
}

/** Fluxo de caixa mês a mês (índice = mês a partir do t0). */
export function fluxoMensal(c: PropostaConfig): number[] {
  const maxMes = Math.max(
    c.numParcelas,
    ...(c.reforcos ?? []).map((r) => r.mes),
    c.repasse?.mes ?? 0,
    0,
  );
  const fluxo = new Array<number>(maxMes + 1).fill(0);
  fluxo[0] += c.entrada;
  for (let m = 1; m <= c.numParcelas; m++) fluxo[m] += c.valorParcela;
  for (const r of c.reforcos ?? []) fluxo[r.mes] += r.valor;
  if (c.repasse) fluxo[c.repasse.mes] += c.repasse.valor;
  return fluxo;
}

/** Valor presente de um fluxo à taxa mensal informada. */
export function valorPresente(fluxo: number[], iMensal: number): number {
  return fluxo.reduce((acc, cf, t) => acc + cf / Math.pow(1 + iMensal, t), 0);
}

/** Soma nominal (sem desconto) — o "preço a prazo" total. */
export function totalNominal(c: PropostaConfig): number {
  return fluxoMensal(c).reduce((a, b) => a + b, 0);
}

/** VPL da proposta à TMA do empreendimento. */
export function calcularVpl(config: PropostaConfig, taxaDescontoAnual: number): number {
  return valorPresente(fluxoMensal(config), taxaMensal(taxaDescontoAnual));
}

/** Avalia a proposta contra o piso e as regras; classifica em verde/amarelo/vermelho. */
export function avaliarProposta(inp: AvaliacaoInput): Avaliacao {
  const vpl = calcularVpl(inp.config, inp.taxaDescontoAnual);
  const vplPiso = inp.vplPiso ?? inp.precoTabela * inp.regras.vplPisoFator;
  const entradaPct =
    inp.precoNegociado > 0 ? (inp.config.entrada / inp.precoNegociado) * 100 : 0;
  const descontoPct =
    inp.precoTabela > 0
      ? ((inp.precoTabela - inp.precoNegociado) / inp.precoTabela) * 100
      : 0;
  const prazo = inp.config.numParcelas;

  const brl = (v: number) =>
    "R$ " + Math.round(v).toLocaleString("pt-BR");

  const checagens: Checagem[] = [
    {
      chave: "entrada",
      rotulo: `Entrada mínima ${inp.regras.entradaMinimaPct}%`,
      ok: entradaPct + EPS >= inp.regras.entradaMinimaPct,
      detalhe: `Entrada de ${entradaPct.toFixed(1)}%`,
    },
    {
      chave: "desconto",
      rotulo: `Desconto máximo ${inp.regras.descontoMaximoPct}%`,
      ok: descontoPct <= inp.regras.descontoMaximoPct + EPS,
      detalhe: `Desconto de ${descontoPct.toFixed(1)}%`,
    },
    {
      chave: "prazo",
      rotulo: `Prazo máximo ${inp.regras.prazoMaximoMeses}x`,
      ok: prazo <= inp.regras.prazoMaximoMeses,
      detalhe: `${prazo} parcelas`,
    },
    {
      chave: "parcela",
      rotulo: `Parcela mínima ${brl(inp.regras.parcelaMinimaReais)}`,
      ok: inp.config.valorParcela + EPS >= inp.regras.parcelaMinimaReais,
      detalhe: `Parcela de ${brl(inp.config.valorParcela)}`,
    },
    {
      chave: "vpl",
      rotulo: "VPL ≥ piso",
      ok: vpl + EPS >= vplPiso,
      detalhe: `VPL ${brl(vpl)} vs piso ${brl(vplPiso)}`,
    },
  ];

  const algumViolado = checagens.some((c) => !c.ok);
  const status: StatusProposta = !algumViolado
    ? "aprovavel"
    : inp.regras.acaoForaRegra === "bloqueio"
      ? "bloqueado"
      : "aprovacao";

  return {
    vpl,
    vplPiso,
    entradaPct,
    descontoPct,
    prazo,
    totalNominal: totalNominal(inp.config),
    checagens,
    status,
  };
}
