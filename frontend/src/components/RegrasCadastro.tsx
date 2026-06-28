import { useEffect, useState } from "react";
import { useConfigVendas, useSalvarConfig } from "../hooks/useData";
import { DEFAULT_CONFIG } from "../api/client";
import type { AcaoForaRegra, ConfigVendas } from "../types";

export function RegrasCadastro({
  empId,
  podeEditar,
}: {
  empId: string;
  podeEditar: boolean;
}) {
  const { data, isLoading } = useConfigVendas(empId);
  const salvar = useSalvarConfig();
  const [cfg, setCfg] = useState<ConfigVendas | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (!isLoading) setCfg(data ?? DEFAULT_CONFIG(empId));
  }, [data, isLoading, empId]);

  if (!cfg) return <div className="text-sm text-slate-400 py-8 text-center">Carregando…</div>;

  const set = <K extends keyof ConfigVendas>(k: K, v: ConfigVendas[K]) => {
    setCfg({ ...cfg, [k]: v });
    setOk(false);
  };

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    await salvar.mutateAsync(cfg);
    setOk(true);
  }

  const ro = !podeEditar;

  return (
    <form onSubmit={submeter} className="max-w-lg">
      <h2 className="text-base font-semibold mb-1">Regras de venda</h2>
      <p className="text-sm text-slate-500 mb-5">
        Limites aplicados a cada proposta deste empreendimento. Propostas fora da regra
        seguem a ação escolhida abaixo.
      </p>

      <div className="space-y-4">
        <Linha label="Taxa de desconto (TMA)" sufixo="% a.a.">
          <input
            type="number"
            step="0.01"
            disabled={ro}
            value={(cfg.taxa_desconto_anual * 100).toFixed(2)}
            onChange={(e) => set("taxa_desconto_anual", (Number(e.target.value) || 0) / 100)}
            className="inp"
          />
        </Linha>
        <Linha label="Entrada mínima" sufixo="% do preço negociado">
          <input
            type="number"
            disabled={ro}
            value={cfg.entrada_minima_pct}
            onChange={(e) => set("entrada_minima_pct", Number(e.target.value) || 0)}
            className="inp"
          />
        </Linha>
        <Linha label="Desconto máximo" sufixo="% sobre o preço de tabela">
          <input
            type="number"
            disabled={ro}
            value={cfg.desconto_maximo_pct}
            onChange={(e) => set("desconto_maximo_pct", Number(e.target.value) || 0)}
            className="inp"
          />
        </Linha>
        <Linha label="Prazo máximo" sufixo="parcelas">
          <input
            type="number"
            disabled={ro}
            value={cfg.prazo_maximo_meses}
            onChange={(e) => set("prazo_maximo_meses", Number(e.target.value) || 0)}
            className="inp"
          />
        </Linha>
        <Linha label="Parcela mínima" sufixo="R$">
          <input
            type="number"
            disabled={ro}
            value={cfg.parcela_minima_reais}
            onChange={(e) => set("parcela_minima_reais", Number(e.target.value) || 0)}
            className="inp"
          />
        </Linha>
        <Linha label="VPL piso" sufixo="% do preço à vista">
          <input
            type="number"
            disabled={ro}
            value={(cfg.vpl_piso_fator * 100).toFixed(0)}
            onChange={(e) => set("vpl_piso_fator", (Number(e.target.value) || 0) / 100)}
            className="inp"
          />
        </Linha>
        <Linha label="Fora da regra" sufixo="">
          <select
            disabled={ro}
            value={cfg.acao_fora_regra}
            onChange={(e) => set("acao_fora_regra", e.target.value as AcaoForaRegra)}
            className="inp"
          >
            <option value="aprovacao">Enviar para aprovação do gestor</option>
            <option value="bloqueio">Bloquear a proposta</option>
          </select>
        </Linha>
      </div>

      {podeEditar && (
        <div className="flex items-center gap-3 mt-6">
          <button
            type="submit"
            disabled={salvar.isPending}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {salvar.isPending ? "Salvando…" : "Salvar regras"}
          </button>
          {ok && <span className="text-sm text-green-600">Salvo ✓</span>}
        </div>
      )}
      {ro && (
        <p className="mt-6 text-xs text-slate-400">
          Somente gestores/admin editam as regras.
        </p>
      )}
    </form>
  );
}

function Linha({
  label,
  sufixo,
  children,
}: {
  label: string;
  sufixo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1fr_140px_auto] items-center gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div>{children}</div>
      <span className="text-xs text-slate-400">{sufixo}</span>
    </div>
  );
}
