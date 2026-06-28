import { useState } from "react";
import { useExcluirUnidade, useSalvarUnidade, useUnidades } from "../hooks/useData";
import type { Unidade, UnidadeInput, UnidadeStatus } from "../types";
import { brl } from "../lib/format";

const STATUS_LABEL: Record<UnidadeStatus, string> = {
  disponivel: "Disponível",
  reservada: "Reservada",
  vendida: "Vendida",
};

const vazia = (empId: string): UnidadeInput => ({
  empreendimento_id: empId,
  identificador: "",
  tipo: "",
  area: null,
  preco_tabela: 0,
  vpl_piso: null,
  status: "disponivel",
});

export function UnidadesCadastro({
  empId,
  pisoFator,
  podeEditar,
}: {
  empId: string;
  pisoFator: number;
  podeEditar: boolean;
}) {
  const { data: unidades, isLoading } = useUnidades(empId);
  const salvar = useSalvarUnidade();
  const excluir = useExcluirUnidade(empId);

  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<UnidadeInput | null>(null);

  function abrirNova() {
    setEditId(null);
    setForm(vazia(empId));
  }
  function abrirEdicao(u: Unidade) {
    setEditId(u.id);
    setForm({
      empreendimento_id: u.empreendimento_id,
      identificador: u.identificador,
      tipo: u.tipo ?? "",
      area: u.area,
      preco_tabela: u.preco_tabela,
      vpl_piso: u.vpl_piso,
      status: u.status,
    });
  }
  function fechar() {
    setForm(null);
    setEditId(null);
  }

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !form.identificador.trim() || form.preco_tabela <= 0) return;
    await salvar.mutateAsync({ id: editId ?? undefined, input: form });
    fechar();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Unidades</h2>
        {podeEditar && (
          <button
            onClick={abrirNova}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            + Nova unidade
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Carregando…</div>
      ) : !unidades?.length ? (
        <div className="text-sm text-slate-400 py-8 text-center border border-dashed rounded">
          Nenhuma unidade cadastrada para este empreendimento.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Identificador</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium text-right">Área</th>
                <th className="px-3 py-2 font-medium text-right">Preço de tabela</th>
                <th className="px-3 py-2 font-medium text-right">VPL piso</th>
                <th className="px-3 py-2 font-medium">Status</th>
                {podeEditar && <th className="px-3 py-2"></th>}
              </tr>
            </thead>
            <tbody>
              {unidades.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{u.identificador}</td>
                  <td className="px-3 py-2 text-slate-500">{u.tipo || "—"}</td>
                  <td className="px-3 py-2 text-right">{u.area ? `${u.area} m²` : "—"}</td>
                  <td className="px-3 py-2 text-right">{brl(u.preco_tabela)}</td>
                  <td className="px-3 py-2 text-right text-slate-500">
                    {brl(u.vpl_piso ?? u.preco_tabela * pisoFator)}
                  </td>
                  <td className="px-3 py-2">{STATUS_LABEL[u.status]}</td>
                  {podeEditar && (
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => abrirEdicao(u)}
                        className="text-blue-600 hover:underline mr-3"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Excluir a unidade "${u.identificador}"?`))
                            excluir.mutate(u.id);
                        }}
                        className="text-red-600 hover:underline"
                      >
                        Excluir
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <form
            onSubmit={submeter}
            className="bg-white rounded-xl p-6 w-[440px] max-w-full shadow-2xl"
          >
            <h3 className="text-base font-semibold mb-4">
              {editId ? "Editar unidade" : "Nova unidade"}
            </h3>
            <div className="space-y-3">
              <Campo label="Identificador *">
                <input
                  value={form.identificador}
                  onChange={(e) => setForm({ ...form, identificador: e.target.value })}
                  placeholder="Quadra 3 Lote 12 / Torre A apto 504"
                  className="inp"
                  autoFocus
                />
              </Campo>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Tipo">
                  <input
                    value={form.tipo ?? ""}
                    onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    placeholder="lote / apartamento"
                    className="inp"
                  />
                </Campo>
                <Campo label="Área (m²)">
                  <input
                    type="number"
                    value={form.area ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, area: e.target.value ? Number(e.target.value) : null })
                    }
                    className="inp"
                  />
                </Campo>
              </div>
              <Campo label="Preço de tabela (R$) *">
                <input
                  type="number"
                  value={form.preco_tabela || ""}
                  onChange={(e) => setForm({ ...form, preco_tabela: Number(e.target.value) || 0 })}
                  className="inp"
                />
              </Campo>
              <Campo label={`VPL piso (R$) — vazio = preço × ${(pisoFator * 100).toFixed(0)}%`}>
                <input
                  type="number"
                  value={form.vpl_piso ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, vpl_piso: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder={brl(form.preco_tabela * pisoFator)}
                  className="inp"
                />
              </Campo>
              <Campo label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as UnidadeStatus })}
                  className="inp"
                >
                  <option value="disponivel">Disponível</option>
                  <option value="reservada">Reservada</option>
                  <option value="vendida">Vendida</option>
                </select>
              </Campo>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={fechar} className="px-3 py-1.5 text-sm rounded border">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvar.isPending}
                className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {salvar.isPending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
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
