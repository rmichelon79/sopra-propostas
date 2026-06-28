import { useState } from "react";
import { useAprovacoes, useDecidirProposta, usePropostas } from "../hooks/useData";
import type { Proposta, Sessao } from "../types";
import { brl } from "../lib/format";
import { fmtMesAno } from "../lib/datas";
import { LinhaCond } from "./inputs";

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

  const vpl = p.vpl_calculado ?? 0;
  const piso = p.vpl_piso_snapshot ?? 0;
  const abaixo = vpl < piso;
  const pct = piso > 0 ? (vpl / piso) * 100 : 0;

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

      {/* Condições da proposta */}
      <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2 mb-3">
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
