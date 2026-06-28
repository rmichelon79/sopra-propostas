import { useEffect, useState } from "react";
import {
  useCriarNovaVersao,
  useTabelaVigente,
  useTabelas,
  useUnidades,
} from "../hooks/useData";
import { api } from "../api/client";
import { useQueryClient } from "@tanstack/react-query";
import type { Unidade, UnidadeStatus } from "../types";
import { MoneyInput } from "./inputs";
import { CondicoesBase } from "./CondicoesBase";

interface Linha {
  key: string;
  id?: string;
  identificador: string;
  tipo: string;
  area: string;
  preco_tabela: string;
  status: UnidadeStatus;
}

let seq = 0;
const novaLinha = (): Linha => ({
  key: `nova-${seq++}`,
  identificador: "",
  tipo: "",
  area: "",
  preco_tabela: "",
  status: "disponivel",
});

const paraLinha = (u: Unidade): Linha => ({
  key: u.id,
  id: u.id,
  identificador: u.identificador,
  tipo: u.tipo ?? "",
  area: u.area != null ? String(u.area) : "",
  preco_tabela: String(u.preco_tabela),
  status: u.status,
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
  const qc = useQueryClient();
  const { data: tabela } = useTabelaVigente(empId);
  const { data: tabelas } = useTabelas(empId);
  const { data: unidades, isLoading } = useUnidades(tabela?.id ?? null);
  const novaVersao = useCriarNovaVersao();

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Semeia a grade quando as unidades da tabela carregam (ou troca de tabela).
  useEffect(() => {
    if (unidades) {
      setLinhas(unidades.map(paraLinha));
      setRemovidos([]);
    }
  }, [unidades, tabela?.id]);

  function set(key: string, campo: keyof Linha, valor: string) {
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  }
  function remover(l: Linha) {
    if (l.id) setRemovidos((r) => [...r, l.id as string]);
    setLinhas((ls) => ls.filter((x) => x.key !== l.key));
  }

  async function salvar() {
    if (!tabela) return;
    setErro(null);
    setSalvando(true);
    try {
      for (const id of removidos) await api.excluirUnidade(id);
      for (const l of linhas) {
        if (!l.identificador.trim() || !l.preco_tabela) continue;
        const input = {
          empreendimento_id: empId,
          tabela_id: tabela.id,
          identificador: l.identificador.trim(),
          tipo: l.tipo.trim() || null,
          area: l.area ? Number(l.area) : null,
          preco_tabela: Number(l.preco_tabela) || 0,
          vpl_piso: null,
          status: l.status,
        };
        if (l.id) await api.atualizarUnidade(l.id, input);
        else await api.criarUnidade(input);
      }
      await qc.invalidateQueries({ queryKey: ["unidades", tabela.id] });
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  async function criarVersao() {
    const desc = prompt("Descrição da nova versão da tabela (ex.: reajuste jun/2026):", "");
    if (desc === null) return;
    await novaVersao.mutateAsync({ empId, descricao: desc });
  }

  if (isLoading || !tabela)
    return <div className="text-sm text-slate-400 py-8 text-center">Carregando…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold">Tabela de unidades</h2>
          <div className="text-xs text-slate-500">
            Versão {tabela.versao} (vigente){tabela.descricao ? ` — ${tabela.descricao}` : ""}
            {tabelas && tabelas.length > 1 && ` · ${tabelas.length} versões`}
          </div>
        </div>
        {podeEditar && (
          <button
            onClick={criarVersao}
            disabled={novaVersao.isPending}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
          >
            {novaVersao.isPending ? "Criando…" : "Nova versão"}
          </button>
        )}
      </div>

      <CondicoesBase tabela={tabela} empId={empId} podeEditar={podeEditar} />

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Identificador</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium text-right">Área (m²)</th>
              <th className="px-3 py-2 font-medium text-right">Valor (R$)</th>
              <th className="px-3 py-2 font-medium">Status</th>
              {podeEditar && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.key} className="border-t border-slate-100">
                <td className="px-2 py-1">
                  <input
                    disabled={!podeEditar}
                    value={l.identificador}
                    onChange={(e) => set(l.key, "identificador", e.target.value)}
                    placeholder="Lote 12"
                    className="inp"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    disabled={!podeEditar}
                    value={l.tipo}
                    onChange={(e) => set(l.key, "tipo", e.target.value)}
                    className="inp"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    type="number"
                    disabled={!podeEditar}
                    value={l.area}
                    onChange={(e) => set(l.key, "area", e.target.value)}
                    className="inp text-right"
                  />
                </td>
                <td className="px-2 py-1">
                  <MoneyInput
                    disabled={!podeEditar}
                    value={Number(l.preco_tabela) || 0}
                    onChange={(v) => set(l.key, "preco_tabela", String(v))}
                  />
                </td>
                <td className="px-2 py-1">
                  <select
                    disabled={!podeEditar}
                    value={l.status}
                    onChange={(e) => set(l.key, "status", e.target.value)}
                    className="inp"
                  >
                    <option value="disponivel">Disponível</option>
                    <option value="reservada">Reservada</option>
                    <option value="vendida">Vendida</option>
                  </select>
                </td>
                {podeEditar && (
                  <td className="px-2 py-1 text-right">
                    <button onClick={() => remover(l)} className="text-red-500 px-2" title="Remover">
                      ×
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!linhas.length && (
              <tr>
                <td colSpan={podeEditar ? 6 : 5} className="px-3 py-6 text-center text-slate-400">
                  Nenhuma unidade nesta tabela.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {podeEditar && (
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={() => setLinhas((ls) => [...ls, novaLinha()])}
            className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50"
          >
            + Linha
          </button>
          <button
            onClick={salvar}
            disabled={salvando}
            className="px-4 py-1.5 text-sm rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? "Salvando…" : "Salvar tabela"}
          </button>
          {erro && <span className="text-sm text-red-600">{erro}</span>}
          <span className="ml-auto text-xs text-slate-400">
            VPL piso = valor × {(pisoFator * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}
