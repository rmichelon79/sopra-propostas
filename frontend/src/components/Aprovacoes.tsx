import { useMemo, useState } from "react";
import { useAprovacoes, useDecidirProposta, usePropostas } from "../hooks/useData";
import type { Proposta, Sessao } from "../types";
import { brl } from "../lib/format";
import { fmtMesAno, mesesEntre } from "../lib/datas";
import { calcularVpl } from "../lib/vpl";
import { materializarBase, totalCondicao } from "../lib/condicao";
import { LinhaCond, MesAnoInput, MoneyInput } from "./inputs";

export function Aprovacoes({ sessao }: { sessao: Sessao }) {
  const { data: propostas, isLoading } = usePropostas();
  const pendentes = (propostas ?? []).filter((p) => p.status === "em_aprovacao");

  if (isLoading)
    return <div className="text-sm text-slate-400 py-12 text-center">Carregando…</div>;

  if (!pendentes.length)
    return (
      <div className="text-sm text-slate-400 py-12 text-center border border-dashed rounded">
        Nenhuma proposta aguardando aprovação.
      </div>
    );

  return (
    <div className="space-y-4">
      {pendentes.map((p) => (
        <ReviewCard key={p.id} p={p} sessao={sessao} />
      ))}
    </div>
  );
}

function ReviewCard({ p, sessao }: { p: Proposta; sessao: Sessao }) {
  const decidir = useDecidirProposta();
  const { data: trilha } = useAprovacoes(p.id);
  const [comentario, setComentario] = useState("");
  const [showSim, setShowSim] = useState(false);

  const vpl = p.vpl_calculado ?? 0;
  const piso = p.vpl_piso_snapshot ?? 0;
  const abaixo = vpl < piso;
  const pct = piso > 0 ? (vpl / piso) * 100 : 0;

  const u = p.unidades;
  const base = u?.tabelas_venda ? materializarBase(u.preco_tabela, u.tabelas_venda) : null;

  function decide(decisao: "aprovada" | "rejeitada") {
    decidir.mutate({ propostaId: p.id, aprovadorId: sessao.userId, decisao, comentario });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <div className="font-semibold">
            {p.empreendimentos?.codigo && (
              <span className="text-slate-400 mr-1">{p.empreendimentos.codigo}</span>
            )}
            {p.unidades?.identificador ?? "unidade"}
          </div>
          <div className="text-sm text-slate-500">
            {p.cliente_nome || "—"}
            {p.cliente_cpf ? ` · ${p.cliente_cpf}` : ""} · vendedor {p.vendedor_nome || "—"}
          </div>
        </div>
        <div
          className={`rounded-lg border px-3 py-2 text-right ${
            abaixo
              ? "bg-amber-50 border-amber-300 text-amber-800"
              : "bg-green-50 border-green-300 text-green-800"
          }`}
        >
          <div className="text-xs">VPL {pct.toFixed(0)}% do piso</div>
          <div className="text-sm font-semibold">
            {brl(vpl)} <span className="font-normal opacity-70">vs {brl(piso)}</span>
          </div>
        </div>
      </div>

      {/* Tabela base (referência) × Proposta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {base && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Tabela base
            </div>
            <LinhaCond label="Entrada">{brl(base.entrada)}</LinhaCond>
            {base.reforcos.map((r, i) => (
              <LinhaCond key={i} label={`Reforço ${fmtMesAno(r.data)}`}>
                {brl(r.valor)}
              </LinhaCond>
            ))}
            <LinhaCond label={`${base.numParcelas}× mensais`}>{brl(base.valorParcela)}</LinhaCond>
            {base.saldo > 0 && <LinhaCond label="Saldo na entrega">{brl(base.saldo)}</LinhaCond>}
            <LinhaCond label="Total" total>
              {brl(totalCondicao(base))}
            </LinhaCond>
          </div>
        )}
        <div className="rounded-lg bg-white border border-blue-200 px-4 py-2">
          <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wide mb-1">
            Proposta
          </div>
          <LinhaCond label="Entrada">{brl(p.config.entrada)}</LinhaCond>
          {(p.config.reforcos ?? []).map((r, i) => (
            <LinhaCond key={i} label={`Reforço ${fmtMesAno(r.data)}`}>
              {brl(r.valor)}
            </LinhaCond>
          ))}
          <LinhaCond label={`${p.config.num_parcelas}× mensais`}>
            {brl(p.config.valor_parcela)}
          </LinhaCond>
          {p.config.repasse && (
            <LinhaCond label="Saldo na entrega">{brl(p.config.repasse.valor)}</LinhaCond>
          )}
          <LinhaCond label="Total da proposta" total>
            {brl(p.preco_negociado)}
          </LinhaCond>
        </div>
      </div>

      {/* Simulador de pagamento (não altera a proposta; ajuda a responder) */}
      <div className="mb-3">
        <button
          onClick={() => setShowSim((s) => !s)}
          className="text-xs text-blue-600 hover:underline"
        >
          {showSim ? "Fechar simulador" : "Simular outra forma de pagamento"}
        </button>
        {showSim && <SimuladorPagamento p={p} />}
      </div>

      {/* Trilha anterior */}
      {trilha && trilha.length > 0 && (
        <div className="text-xs text-slate-500 mb-3 space-y-0.5">
          {trilha.map((a) => (
            <div key={a.id}>
              <span className={a.decisao === "aprovada" ? "text-green-600" : "text-red-600"}>
                {a.decisao === "aprovada" ? "Aprovada" : "Rejeitada"}
              </span>{" "}
              em {a.criado_em.slice(0, 10)}
              {a.comentario ? ` — ${a.comentario}` : ""}
            </div>
          ))}
        </div>
      )}

      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        placeholder="Comentário (opcional)"
        rows={2}
        className="w-full px-3 py-2 border border-slate-300 rounded text-sm mb-3 outline-none focus:border-blue-500"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => decide("aprovada")}
          disabled={decidir.isPending}
          className="px-4 py-2 text-sm rounded bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50"
        >
          Aprovar
        </button>
        <button
          onClick={() => decide("rejeitada")}
          disabled={decidir.isPending}
          className="px-4 py-2 text-sm rounded bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50"
        >
          Rejeitar
        </button>
      </div>
    </section>
  );
}

interface ReforcoUI {
  data: string | null;
  valor: number;
}

/** Simula uma forma de pagamento alternativa para a mesma unidade/piso/TMA,
 *  sem alterar a proposta. Ajuda o gestor a propor um contraponto. */
function SimuladorPagamento({ p }: { p: Proposta }) {
  const dataBase = p.config.data_base;
  const taxa = p.taxa_snapshot ?? 0;
  const piso = p.vpl_piso_snapshot ?? 0;
  const mesSaldo = p.config.repasse?.mes ?? p.config.num_parcelas;

  const [entrada, setEntrada] = useState(p.config.entrada);
  const [numParcelas, setNumParcelas] = useState(p.config.num_parcelas);
  const [valorParcela, setValorParcela] = useState(p.config.valor_parcela);
  const [saldo, setSaldo] = useState(p.config.repasse?.valor ?? 0);
  const [reforcos, setReforcos] = useState<ReforcoUI[]>(
    (p.config.reforcos ?? []).map((r) => ({ data: r.data, valor: r.valor })),
  );

  const total =
    entrada +
    reforcos.reduce((s, r) => s + r.valor, 0) +
    numParcelas * valorParcela +
    saldo;

  const vpl = useMemo(() => {
    const flow = {
      entrada,
      numParcelas,
      valorParcela,
      reforcos: reforcos
        .filter((r) => r.data && r.valor > 0)
        .map((r) => ({ mes: Math.max(0, mesesEntre(dataBase, r.data as string)), valor: r.valor })),
      repasse: saldo > 0 ? { mes: mesSaldo, valor: saldo } : null,
    };
    return calcularVpl(flow, taxa);
  }, [entrada, numParcelas, valorParcela, reforcos, saldo, dataBase, mesSaldo, taxa]);

  const abaixo = vpl < piso;
  const pct = piso > 0 ? (vpl / piso) * 100 : 0;

  return (
    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
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
              >
                ×
              </button>
            </>
          }
        >
          <MoneyInput
            value={r.valor}
            onChange={(v) => setReforcos(reforcos.map((x, j) => (j === i ? { ...x, valor: v } : x)))}
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
      <LinhaCond label="Saldo na entrega">
        <MoneyInput value={saldo} onChange={setSaldo} className="w-full" />
      </LinhaCond>
      <LinhaCond label="Total simulado" total>
        {brl(total)}
      </LinhaCond>

      <div
        className={`mt-2 rounded px-3 py-2 text-sm font-medium ${
          abaixo ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"
        }`}
      >
        VPL simulado {brl(vpl)} · piso {brl(piso)} · {pct.toFixed(0)}% do piso
        {abaixo ? " — ainda abaixo" : " — atinge o piso"}
      </div>
    </div>
  );
}
