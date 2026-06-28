import { useMemo, useState } from "react";
import { useSalvarProposta, useTabelaVigente, useUnidades } from "../hooks/useData";
import type { ConfigVendas, Proposta, PropostaConfigJson, Sessao, Unidade } from "../types";
import { avaliarProposta } from "../lib/vpl";
import { brl } from "../lib/format";
import { fmtMesAno, hojeMes, mesesEntre } from "../lib/datas";

const STATUS_UI = {
  aprovavel: { cor: "bg-green-100 text-green-800 border-green-300", txt: "Dentro das regras" },
  aprovacao: { cor: "bg-amber-100 text-amber-800 border-amber-300", txt: "Precisa de aprovação" },
  bloqueado: { cor: "bg-red-100 text-red-800 border-red-300", txt: "Bloqueada pelas regras" },
} as const;

export function PropostaConfigurador({
  empId,
  sessao,
  cfg,
  inicial,
  onSalvou,
}: {
  empId: string;
  sessao: Sessao;
  cfg: ConfigVendas;
  inicial?: Proposta | null;
  onSalvou: () => void;
}) {
  const { data: tabela } = useTabelaVigente(empId);
  const { data: unidades } = useUnidades(tabela?.id ?? null);
  const salvar = useSalvarProposta();

  const disponiveis = (unidades ?? []).filter(
    (u) => u.status === "disponivel" || u.id === inicial?.unidade_id,
  );

  const [unidadeId, setUnidadeId] = useState(inicial?.unidade_id ?? "");
  const [cliente, setCliente] = useState(inicial?.cliente_nome ?? "");
  const [contato, setContato] = useState(inicial?.cliente_contato ?? "");
  const [preco, setPreco] = useState(inicial?.preco_negociado ?? 0);
  const [dataBase, setDataBase] = useState(inicial?.config.data_base ?? `${hojeMes()}`);
  const [entradaValor, setEntradaValor] = useState(inicial?.config.entrada ?? 0);
  const [numParcelas, setNumParcelas] = useState(inicial?.config.num_parcelas ?? 36);
  const [reforcos, setReforcos] = useState<{ mes: number; valor: number }[]>(
    inicial?.config.reforcos ?? [],
  );
  const [saldoEntrega, setSaldoEntrega] = useState(inicial?.config.repasse?.valor ?? 0);

  // Resolve a unidade: da lista vigente, ou sintética (proposta antiga de outra versão).
  const unidadeLista = disponiveis.find((u) => u.id === unidadeId);
  const unidade: Unidade | undefined =
    unidadeLista ??
    (inicial && inicial.unidade_id === unidadeId
      ? {
          id: inicial.unidade_id,
          empreendimento_id: empId,
          tabela_id: null,
          identificador: inicial.unidades?.identificador ?? "unidade",
          tipo: null,
          area: null,
          preco_tabela: inicial.preco_negociado,
          vpl_piso: inicial.vpl_piso_snapshot,
          status: "disponivel",
          ativo: true,
        }
      : undefined);

  function escolherUnidade(id: string) {
    setUnidadeId(id);
    const u = (unidades ?? []).find((x) => x.id === id);
    if (u) {
      if (!preco) setPreco(u.preco_tabela);
      if (!entradaValor) setEntradaValor(Math.round((u.preco_tabela * cfg.entrada_minima_pct) / 100));
    }
  }

  // Mês do saldo: automático pela data de entrega (relativo à data-base).
  const mesEntrega = cfg.entrega ? Math.max(1, mesesEntre(dataBase, cfg.entrega)) : numParcelas;
  const somaReforcos = reforcos.reduce((s, r) => s + r.valor, 0);
  const entradaPct = preco > 0 ? (entradaValor / preco) * 100 : 0;

  const valorParcela = useMemo(() => {
    const saldo = preco - entradaValor - somaReforcos - saldoEntrega;
    return numParcelas > 0 ? Math.max(0, saldo / numParcelas) : 0;
  }, [preco, entradaValor, somaReforcos, saldoEntrega, numParcelas]);

  const repasse = saldoEntrega > 0 ? { mes: mesEntrega, valor: saldoEntrega } : null;

  const av = useMemo(() => {
    if (!unidade) return null;
    return avaliarProposta({
      precoTabela: unidade.preco_tabela,
      precoNegociado: preco,
      vplPiso: unidade.vpl_piso,
      config: { entrada: entradaValor, numParcelas, valorParcela, reforcos, repasse },
      regras: {
        entradaMinimaPct: cfg.entrada_minima_pct,
        descontoMaximoPct: cfg.desconto_maximo_pct,
        prazoMaximoMeses: cfg.prazo_maximo_meses,
        parcelaMinimaReais: cfg.parcela_minima_reais,
        vplPisoFator: cfg.vpl_piso_fator,
        acaoForaRegra: cfg.acao_fora_regra,
      },
      taxaDescontoAnual: cfg.taxa_desconto_anual,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidade, preco, entradaValor, numParcelas, valorParcela, somaReforcos, saldoEntrega, mesEntrega, cfg]);

  function montarConfig(): PropostaConfigJson {
    return {
      data_base: dataBase,
      entrada: entradaValor,
      num_parcelas: numParcelas,
      valor_parcela: valorParcela,
      reforcos,
      repasse,
    };
  }

  async function persistir(enviar: boolean) {
    if (!unidade || !av) return;
    if (enviar && av.status === "bloqueado") return;
    const status = !enviar
      ? "rascunho"
      : av.status === "aprovavel"
        ? "aprovada"
        : "em_aprovacao";
    await salvar.mutateAsync({
      id: inicial?.id,
      input: {
        unidade_id: unidade.id,
        empreendimento_id: empId,
        vendedor_id: sessao.userId,
        cliente_nome: cliente || null,
        cliente_contato: contato || null,
        preco_negociado: preco,
        config: montarConfig(),
        vpl_calculado: av.vpl,
        vpl_piso_snapshot: av.vplPiso,
        taxa_snapshot: cfg.taxa_desconto_anual,
        status,
      },
    });
    onSalvou();
  }

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold">{inicial ? "Editar proposta" : "Nova proposta"}</h2>

      {/* Unidade + cliente */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <Campo label="Unidade *">
          <select value={unidadeId} onChange={(e) => escolherUnidade(e.target.value)} className="inp">
            <option value="">Selecione…</option>
            {disponiveis.map((u) => (
              <option key={u.id} value={u.id}>
                {u.identificador} — {brl(u.preco_tabela)}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Cliente">
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} className="inp" />
          </Campo>
          <Campo label="Contato">
            <input value={contato} onChange={(e) => setContato(e.target.value)} className="inp" />
          </Campo>
        </div>
      </section>

      {unidade && (
        <>
          {/* Valor de tabela em destaque */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-end justify-between">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wide">Valor de tabela</div>
              <div className="text-3xl font-bold text-slate-800">{brl(unidade.preco_tabela)}</div>
            </div>
            <div className="text-right">
              <Campo label="Preço negociado">
                <input
                  type="number"
                  value={preco || ""}
                  onChange={(e) => setPreco(Number(e.target.value) || 0)}
                  className="inp w-44 text-right"
                />
              </Campo>
            </div>
          </div>

          {/* Plano de pagamento */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo label={`Entrada (R$) — ${entradaPct.toFixed(1)}% do preço`}>
                <input
                  type="number"
                  value={entradaValor || ""}
                  onChange={(e) => setEntradaValor(Number(e.target.value) || 0)}
                  className="inp"
                />
              </Campo>
              <Campo label="Data-base">
                <input
                  type="month"
                  value={dataBase.slice(0, 7)}
                  onChange={(e) => setDataBase(`${e.target.value}-01`)}
                  className="inp"
                />
              </Campo>
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <Campo label="Nº de parcelas mensais">
                <input
                  type="number"
                  value={numParcelas || ""}
                  onChange={(e) => setNumParcelas(Number(e.target.value) || 0)}
                  className="inp"
                />
              </Campo>
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <div className="text-xs text-slate-500">Parcela mensal (calculada)</div>
                <div className="text-xl font-semibold">{brl(valorParcela)}</div>
              </div>
            </div>

            {/* Reforços */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Reforços / balões</span>
                <button
                  type="button"
                  onClick={() => setReforcos([...reforcos, { mes: 12, valor: 0 }])}
                  className="text-xs text-blue-600 hover:underline"
                >
                  + adicionar
                </button>
              </div>
              {reforcos.map((r, i) => (
                <div key={i} className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-slate-400 w-8">mês</span>
                  <input
                    type="number"
                    value={r.mes}
                    onChange={(e) =>
                      setReforcos(reforcos.map((x, j) => (j === i ? { ...x, mes: Number(e.target.value) || 0 } : x)))
                    }
                    className="inp w-20"
                  />
                  <span className="text-xs text-slate-400">R$</span>
                  <input
                    type="number"
                    value={r.valor || ""}
                    onChange={(e) =>
                      setReforcos(reforcos.map((x, j) => (j === i ? { ...x, valor: Number(e.target.value) || 0 } : x)))
                    }
                    className="inp flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setReforcos(reforcos.filter((_, j) => j !== i))}
                    className="text-red-500 px-2"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Saldo na entrega (mês automático pela data de entrega) */}
            <Campo
              label={
                cfg.entrega
                  ? `Saldo na entrega (R$) — entrega ${fmtMesAno(cfg.entrega)}, mês ${mesEntrega}`
                  : "Saldo na entrega (R$) — defina a data de entrega no empreendimento"
              }
            >
              <input
                type="number"
                value={saldoEntrega || ""}
                onChange={(e) => setSaldoEntrega(Number(e.target.value) || 0)}
                className="inp"
              />
            </Campo>
          </section>

          {/* Avaliação ao vivo */}
          {av && (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <div className={`rounded-lg border px-4 py-3 mb-4 ${STATUS_UI[av.status].cor}`}>
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{STATUS_UI[av.status].txt}</span>
                  <span className="text-sm">
                    VPL {brl(av.vpl)} · piso {brl(av.vplPiso)}
                  </span>
                </div>
                <div className="text-xs mt-1 opacity-80">
                  Total nominal {brl(av.totalNominal)} · VPL é{" "}
                  {((av.vpl / av.vplPiso) * 100).toFixed(0)}% do piso
                </div>
              </div>
              <ul className="space-y-1.5 mb-5">
                {av.checagens.map((c) => (
                  <li key={c.chave} className="flex items-center gap-2 text-sm">
                    <span>{c.ok ? "✅" : "⚠️"}</span>
                    <span className="font-medium">{c.rotulo}</span>
                    <span className="text-slate-400">— {c.detalhe}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => persistir(false)}
                  disabled={salvar.isPending}
                  className="px-4 py-2 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  Salvar rascunho
                </button>
                <button
                  onClick={() => persistir(true)}
                  disabled={salvar.isPending || av.status === "bloqueado"}
                  className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {av.status === "aprovavel" ? "Fechar proposta" : "Enviar para aprovação"}
                </button>
                {av.status === "bloqueado" && (
                  <span className="text-xs text-red-600">Ajuste o plano para destravar.</span>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-slate-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
