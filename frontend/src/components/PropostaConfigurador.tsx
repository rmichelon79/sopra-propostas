import { useMemo, useState } from "react";
import { useSalvarProposta, useTabelaVigente, useUnidades } from "../hooks/useData";
import type { ConfigVendas, Proposta, PropostaConfigJson, Sessao, Unidade } from "../types";
import { avaliarProposta, calcularVpl, type PropostaConfig } from "../lib/vpl";
import { materializarBase, totalCondicao } from "../lib/condicao";
import { brl } from "../lib/format";
import { fmtMesAno, hojeMes, mesesEntre } from "../lib/datas";
import { LinhaCond, MesAnoInput, MoneyInput } from "./inputs";

const STATUS_UI = {
  aprovavel: { cor: "bg-green-100 text-green-800 border-green-300", txt: "Dentro das regras" },
  aprovacao: { cor: "bg-amber-100 text-amber-800 border-amber-300", txt: "Precisa de aprovação" },
  bloqueado: { cor: "bg-red-100 text-red-800 border-red-300", txt: "Bloqueada pelas regras" },
} as const;

interface ReforcoUI {
  data: string | null;
  valor: number;
}

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
  const dataBase = hojeMes(); // VPL calculado na data atual
  const [entrada, setEntrada] = useState(inicial?.config.entrada ?? 0);
  const [numParcelas, setNumParcelas] = useState(inicial?.config.num_parcelas ?? 0);
  const [valorParcela, setValorParcela] = useState(inicial?.config.valor_parcela ?? 0);
  const [saldo, setSaldo] = useState(inicial?.config.repasse?.valor ?? 0);
  const [reforcos, setReforcos] = useState<ReforcoUI[]>(
    inicial?.config.reforcos?.length
      ? inicial.config.reforcos.map((r) => ({ data: r.data ?? null, valor: r.valor }))
      : [
          { data: null, valor: 0 },
          { data: null, valor: 0 },
          { data: null, valor: 0 },
        ],
  );

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

  const base = useMemo(
    () => (unidade && tabela ? materializarBase(unidade.preco_tabela, tabela) : null),
    [unidade, tabela],
  );

  // Ao escolher a unidade numa proposta NOVA, pré-preenche com a condição base.
  function escolherUnidade(id: string) {
    setUnidadeId(id);
    const u = (unidades ?? []).find((x) => x.id === id);
    if (u && tabela && !inicial) {
      const b = materializarBase(u.preco_tabela, tabela);
      setEntrada(b.entrada);
      setSaldo(b.saldo);
      setNumParcelas(b.numParcelas);
      setValorParcela(b.valorParcela);
      setReforcos(
        b.reforcos.length
          ? b.reforcos.map((r) => ({ data: r.data, valor: r.valor }))
          : [
              { data: null, valor: 0 },
              { data: null, valor: 0 },
              { data: null, valor: 0 },
            ],
      );
    }
  }

  const mesEntrega = cfg.entrega ? Math.max(1, mesesEntre(dataBase, cfg.entrega)) : numParcelas;
  const reforcosValidos = reforcos.filter((r) => r.data && r.valor > 0);
  const repasse = saldo > 0 ? { mes: mesEntrega, valor: saldo } : null;

  const av = useMemo(() => {
    if (!unidade || !base) return null;
    const flowReforcos = (refs: { data: string | null; valor: number }[]) =>
      refs
        .filter((r) => r.data && r.valor > 0)
        .map((r) => ({ mes: Math.max(0, mesesEntre(dataBase, r.data as string)), valor: r.valor }));
    // Piso = VPL da condição da tabela base materializada para esta unidade.
    const baseFlow: PropostaConfig = {
      entrada: base.entrada,
      numParcelas: base.numParcelas,
      valorParcela: base.valorParcela,
      reforcos: flowReforcos(base.reforcos),
      repasse: base.saldo > 0 ? { mes: mesEntrega, valor: base.saldo } : null,
    };
    const pisoVPL = calcularVpl(baseFlow, cfg.taxa_desconto_anual);
    return avaliarProposta({
      precoTabela: unidade.preco_tabela,
      precoNegociado: unidade.preco_tabela, // entrada % é sobre o valor da unidade
      vplPiso: pisoVPL,
      config: { entrada, numParcelas, valorParcela, reforcos: flowReforcos(reforcos), repasse },
      regras: {
        entradaMinimaPct: cfg.entrada_minima_pct,
        descontoMaximoPct: cfg.desconto_maximo_pct,
        prazoMaximoMeses:
          cfg.prazo_ate_entrega && cfg.entrega
            ? Math.max(1, mesesEntre(dataBase, cfg.entrega))
            : cfg.prazo_maximo_meses,
        parcelaMinimaReais: cfg.parcela_minima_reais,
        acaoForaRegra: cfg.acao_fora_regra,
      },
      taxaDescontoAnual: cfg.taxa_desconto_anual,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidade, base, entrada, numParcelas, valorParcela, reforcos, dataBase, saldo, mesEntrega, cfg]);

  const precoNegociavel = av?.totalNominal ?? 0;

  function montarConfig(): PropostaConfigJson {
    return {
      data_base: dataBase,
      entrada,
      num_parcelas: numParcelas,
      valor_parcela: valorParcela,
      reforcos: reforcosValidos.map((r) => ({ data: r.data as string, valor: r.valor })),
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
        preco_negociado: precoNegociavel,
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

      {unidade && base && (
        <>
          {/* Valor de tabela em destaque */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-xs text-slate-500 uppercase tracking-wide">Valor de tabela</div>
            <div className="text-3xl font-bold text-slate-800">{brl(unidade.preco_tabela)}</div>
          </div>

          {/* Tabela base (referência) — layout idêntico ao da proposta */}
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Tabela base (referência)
            </div>
            <LinhaCond label="Entrada">{brl(base.entrada)}</LinhaCond>
            {base.reforcos.map((r, i) => (
              <LinhaCond key={i} label={`Reforço ${fmtMesAno(r.data)}`}>
                {brl(r.valor)}
              </LinhaCond>
            ))}
            <LinhaCond label={`${base.numParcelas}× mensais`}>{brl(base.valorParcela)}</LinhaCond>
            <LinhaCond label={`Saldo na entrega ${cfg.entrega ? fmtMesAno(cfg.entrega) : ""}`}>
              {brl(base.saldo)}
            </LinhaCond>
            <LinhaCond label="Total (a prazo)" total>
              {brl(totalCondicao(base))}
            </LinhaCond>
          </section>

          {/* Proposta (editável) — layout IDÊNTICO à base; só o valor em R$ muda */}
          <section className="rounded-xl border border-blue-200 bg-white p-5">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
              Proposta
            </div>

            <LinhaCond label="Entrada">
              <MoneyInput value={entrada} onChange={setEntrada} className="w-full" />
            </LinhaCond>

            {reforcos.map((r, i) => (
              <LinhaCond
                key={i}
                label={
                  <>
                    <span className="text-slate-500">Reforço</span>
                    <MesAnoInput
                      value={r.data}
                      onChange={(v) =>
                        setReforcos(reforcos.map((x, j) => (j === i ? { ...x, data: v } : x)))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setReforcos(reforcos.filter((_, j) => j !== i))}
                      className="text-red-500 px-1"
                      title="Remover reforço"
                    >
                      ×
                    </button>
                  </>
                }
              >
                <MoneyInput
                  value={r.valor}
                  onChange={(v) =>
                    setReforcos(reforcos.map((x, j) => (j === i ? { ...x, valor: v } : x)))
                  }
                  className="w-full"
                />
              </LinhaCond>
            ))}
            <div className="py-1">
              <button
                type="button"
                onClick={() => setReforcos([...reforcos, { data: null, valor: 0 }])}
                className="text-xs text-blue-600 hover:underline"
              >
                + reforço
              </button>
            </div>

            <LinhaCond
              label={
                <>
                  <input
                    type="number"
                    value={numParcelas || ""}
                    onChange={(e) => setNumParcelas(Number(e.target.value) || 0)}
                    className="inp w-16"
                  />
                  <span>× mensais</span>
                </>
              }
            >
              <MoneyInput value={valorParcela} onChange={setValorParcela} className="w-full" />
            </LinhaCond>

            <LinhaCond label={`Saldo na entrega ${cfg.entrega ? fmtMesAno(cfg.entrega) : ""}`}>
              <MoneyInput value={saldo} onChange={setSaldo} className="w-full" />
            </LinhaCond>

            <LinhaCond label="Preço negociável (a prazo)" total>
              {brl(precoNegociavel)}
            </LinhaCond>
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
                  VPL é {((av.vpl / av.vplPiso) * 100).toFixed(0)}% do piso
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
