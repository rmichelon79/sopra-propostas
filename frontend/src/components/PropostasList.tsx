import { useMudarStatusProposta, usePropostas } from "../hooks/useData";
import type { Proposta, PropostaStatus } from "../types";
import { brl } from "../lib/format";

const STATUS_BADGE: Record<PropostaStatus, { txt: string; cls: string }> = {
  rascunho: { txt: "Rascunho", cls: "bg-slate-100 text-slate-600" },
  em_aprovacao: { txt: "Em aprovação", cls: "bg-amber-100 text-amber-700" },
  aprovada: { txt: "Aprovada", cls: "bg-green-100 text-green-700" },
  rejeitada: { txt: "Rejeitada", cls: "bg-red-100 text-red-700" },
  expirada: { txt: "Expirada", cls: "bg-slate-100 text-slate-400" },
};

export function PropostasList({ onEditar }: { onEditar: (p: Proposta) => void }) {
  const { data: propostas, isLoading } = usePropostas();
  const mudarStatus = useMudarStatusProposta();

  if (isLoading)
    return <div className="text-sm text-slate-400 py-12 text-center">Carregando…</div>;

  if (!propostas?.length)
    return (
      <div className="text-sm text-slate-400 py-12 text-center border border-dashed rounded">
        Nenhuma proposta ainda. Use a aba <b>Nova proposta</b> para criar a primeira.
      </div>
    );

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Unidade</th>
            <th className="px-3 py-2 font-medium">Cliente</th>
            <th className="px-3 py-2 font-medium text-right">Preço</th>
            <th className="px-3 py-2 font-medium text-right">VPL</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {propostas.map((p) => {
            const b = STATUS_BADGE[p.status];
            const abaixoPiso =
              p.vpl_calculado != null &&
              p.vpl_piso_snapshot != null &&
              p.vpl_calculado < p.vpl_piso_snapshot;
            return (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">
                  {p.empreendimentos?.codigo && (
                    <span className="text-slate-400 mr-1">{p.empreendimentos.codigo}</span>
                  )}
                  {p.unidades?.identificador ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-600">{p.cliente_nome || "—"}</td>
                <td className="px-3 py-2 text-right">{brl(p.preco_negociado)}</td>
                <td className={`px-3 py-2 text-right ${abaixoPiso ? "text-amber-600" : ""}`}>
                  {p.vpl_calculado != null ? brl(p.vpl_calculado) : "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${b.cls}`}>{b.txt}</span>
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {(p.status === "rascunho" || p.status === "rejeitada") && (
                    <button
                      onClick={() => onEditar(p)}
                      className="text-blue-600 hover:underline mr-3"
                    >
                      Abrir
                    </button>
                  )}
                  {p.status === "em_aprovacao" && (
                    <button
                      onClick={() => {
                        if (confirm("Voltar esta proposta para rascunho?"))
                          mudarStatus.mutate({ id: p.id, status: "rascunho" });
                      }}
                      className="text-slate-500 hover:underline"
                    >
                      Reabrir
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
