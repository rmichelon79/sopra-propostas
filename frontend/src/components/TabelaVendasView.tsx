import { useTabelaVigente, useUnidades } from "../hooks/useData";
import type { ConfigVendas, UnidadeStatus } from "../types";
import { brl } from "../lib/format";
import { fmtMesAno } from "../lib/datas";

const STATUS_LABEL: Record<UnidadeStatus, string> = {
  disponivel: "Disponível",
  reservada: "Reservada",
  vendida: "Vendida",
};
const STATUS_CLS: Record<UnidadeStatus, string> = {
  disponivel: "bg-green-100 text-green-700",
  reservada: "bg-amber-100 text-amber-700",
  vendida: "bg-slate-100 text-slate-500",
};

/** Visão só-leitura da tabela de vendas vigente — para o vendedor consultar. */
export function TabelaVendasView({ empId, cfg }: { empId: string; cfg: ConfigVendas }) {
  const { data: tabela } = useTabelaVigente(empId);
  const { data: unidades, isLoading } = useUnidades(tabela?.id ?? null);

  if (isLoading || !tabela)
    return <div className="text-sm text-slate-400 py-8 text-center">Carregando…</div>;

  const somaRef = (tabela.cond_reforcos ?? []).reduce((s, r) => s + r.pct, 0);
  const mensaisPct = 100 - tabela.cond_entrada_pct - tabela.cond_saldo_pct - somaRef;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Tabela de vendas</h2>
        <div className="text-xs text-slate-500">
          Versão {tabela.versao}
          {tabela.data ? ` · ${fmtMesAno(tabela.data)}` : ""}
          {cfg.entrega ? ` · entrega ${fmtMesAno(cfg.entrega)}` : ""}
        </div>
      </div>

      {/* Condições padrão de pagamento (% do valor da unidade) */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Condições padrão (% do valor da unidade)
        </div>
        <div className="space-y-1.5 text-sm">
          <Linha rotulo="Entrada" valor={`${num(tabela.cond_entrada_pct)}%`} />
          {(tabela.cond_reforcos ?? []).map((r, i) => (
            <Linha key={i} rotulo={`Reforço ${fmtMesAno(r.data)}`} valor={`${num(r.pct)}%`} />
          ))}
          <Linha rotulo={`${tabela.cond_num_parcelas}× mensais`} valor={`${num(mensaisPct)}%`} />
          <Linha rotulo="Saldo na entrega" valor={`${num(tabela.cond_saldo_pct)}%`} />
        </div>
      </section>

      {/* Unidades */}
      {!unidades?.length ? (
        <div className="text-sm text-slate-400 py-8 text-center border border-dashed rounded">
          Nenhuma unidade cadastrada nesta tabela.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Identificador</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium text-right">Área</th>
                <th className="px-3 py-2 font-medium text-right">Valor</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{u.identificador}</td>
                  <td className="px-3 py-2 text-slate-500">{u.tipo || "—"}</td>
                  <td className="px-3 py-2 text-right">{u.area ? `${u.area} m²` : "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{brl(u.preco_tabela)}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLS[u.status]}`}>
                      {STATUS_LABEL[u.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const num = (v: number) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-200 pb-1">
      <span className="text-slate-600">{rotulo}</span>
      <span className="font-medium tabular-nums">{valor}</span>
    </div>
  );
}
