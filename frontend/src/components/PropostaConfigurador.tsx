import { useMemo, useState } from "react";
import { useSalvarProposta, useUnidades } from "../hooks/useData";
import type { ConfigVendas, Proposta, PropostaConfigJson, Sessao, Unidade } from "../types";
import { avaliarProposta } from "../lib/vpl";
import { brl } from "../lib/format";

const STATUS_UI = {
  aprovavel: { cor: "bg-green-100 text-green-800 border-green-300", txt: "Dentro das regras" },
  aprovacao: { cor: "bg-amber-100 text-amber-800 border-amber-300", txt: "Precisa de aprovação" },
  bloqueado: { cor: "bg-red-100 text-red-800 border-red-300", txt: "Bloqueada pelas regras" },
} as const;

const hoje = () => new Date().toISOString().slice(0, 10);

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
  const { data: unidades } = useUnidades(empId);
  const salvar = useSalvarProposta();

  const disponiveis = (unidades ?? []).filter(
    (u) => u.status === "disponivel" || u.id === inicial?.unidade_id,
  );

  const [unidadeId, setUnidadeId] = useState(inicial?.unidade_id ?? "");
  const [cliente, setCliente] = useState(inicial?.cliente_nome ?? "");
  const [contato, setContato] = useState(inicial?.cliente_contato ?? "");
  const [preco, setPreco] = useState(inicial?.preco_negociado ?? 0);
  const [dataBase, setDataBase] = useState(inicial?.config.data_base ?? hoje());
  const [entradaPct, setEntradaPct] = useState(
    inicial && inicial.preco_negociado
      ? (inicial.config.entrada / inicial.preco_negociado) * 100
      : cfg.entrada_minima_pct,
  );
  const [numParcelas, setNumParcelas] = useState(inicial?.config.num_parcelas ?? 36);
  const [reforcos, setReforcos] = useState<{ mes: number; valor: number }[]>(
    inicial?.config.reforcos ?? [],
  );
  const [repasse, setRepasse] = useState<{ mes: number; valor: number } | null>(
    inicial?.config.repasse ?? null,
  );

  const unidade: Unidade | undefined = disponiveis.find((u) => u.id === unidadeId);

  // Ao escolher a unidade, semeia o preço negociado com o de tabela.
  function escolherUnidade(id: string) {
    setUnidadeId(id);
    const u = (unidades ?? []).find((x) => x.id === id);
    if (u && !preco) setPreco(u.preco_tabela);
  }

  const entrada = (preco * entradaPct) / 100;
  const somaReforcos = reforcos.reduce((s, r) => s + r.valor, 0);
  const repasseValor = repasse?.valor ?? 0;
  // Parcelas cobrem o que sobra; total nominal = preço negociado por construção.
  const valorParcela = useMemo(() => {
    const saldo = preco - entrada - somaReforcos - repasseValor;
    return numParcelas > 0 ? Math.max(0, saldo / numParcelas) : 0;
  }, [preco, entrada, somaReforcos, repasseValor, numParcelas]);

  const av = useMemo(() => {
    if (!unidade) return null;
    return avaliarProposta({
      precoTabela: unidade.preco_tabela,
      precoNegociado: preco,
      vplPiso: unidade.vpl_piso,
      config: {
        entrada,
        numParcelas,
        valorParcela,
        reforcos,
        repasse,
      },
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
  }, [unidade, preco, entrada, numParcelas, valorParcela, reforcos, repasse, cfg]);

  function montarConfig(): PropostaConfigJson {
    return {
      data_base: dataBase,
      entrada,
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
      <h2 className="text-base font-semibold">
        {inicial ? "Editar proposta" : "Nova proposta"}
      </h2>

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
          {/* Plano de pagamento */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Campo label={`Preço negociado (tabela ${brl(unidade.preco_tabela)})`}>
                <input
                  type="number"
                  value={preco || ""}
                  onChange={(e) => setPreco(Number(e.target.value) || 0)}
                  className="inp"
                />
              </Campo>
              <Campo label="Data-base">
                <input
                  type="date"
                  value={dataBase}
                  onChange={(e) => setDataBase(e.target.value)}
                  className="inp"
                />
              </Campo>
            </div>

            <Campo label={`Entrada: ${entradaPct.toFixed(0)}%  (${brl(entrada)})`}>
              <input
                type="range"
                min={0}
                max={100}
                value={entradaPct}
                onChange={(e) => setEntradaPct(Number(e.target.value))}
                className="w-full"
              />
            </Campo>

            <Campo label={`Prazo: ${numParcelas}x de ${brl(valorParcela)}`}>
              <input
                type="range"
                min={1}
                max={120}
                value={numParcelas}
                onChange={(e) => setNumParcelas(Number(e.target.value))}
                className="w-full"
              />
            </Campo>

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

            {/* Repasse / chaves */}
            <div>
              <label className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                <input
                  type="checkbox"
                  checked={!!repasse}
                  onChange={(e) => setRepasse(e.target.checked ? { mes: numParcelas, valor: 0 } : null)}
                />
                Repasse / financiamento bancário nas chaves
              </label>
              {repasse && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 w-8">mês</span>
                  <input
                    type="number"
                    value={repasse.mes}
                    onChange={(e) => setRepasse({ ...repasse, mes: Number(e.target.value) || 0 })}
                    className="inp w-20"
                  />
                  <span className="text-xs text-slate-400">R$</span>
                  <input
                    type="number"
                    value={repasse.valor || ""}
                    onChange={(e) => setRepasse({ ...repasse, valor: Number(e.target.value) || 0 })}
                    className="inp flex-1"
                  />
                </div>
              )}
            </div>
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
                  title={av.status === "bloqueado" ? "Proposta bloqueada pelas regras" : ""}
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
