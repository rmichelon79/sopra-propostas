import { useEffect, useState } from "react";
import { useSalvarCondicoesBase } from "../hooks/useData";
import type { ReforcoBasePct, TabelaVenda } from "../types";
import { MesAnoInput } from "./inputs";

export function CondicoesBase({
  tabela,
  empId,
  podeEditar,
}: {
  tabela: TabelaVenda;
  empId: string;
  podeEditar: boolean;
}) {
  const salvar = useSalvarCondicoesBase(empId);
  const [entrada, setEntrada] = useState(0);
  const [saldo, setSaldo] = useState(0);
  const [num, setNum] = useState(0);
  const [reforcos, setReforcos] = useState<ReforcoBasePct[]>([]);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setEntrada(tabela.cond_entrada_pct);
    setSaldo(tabela.cond_saldo_pct);
    setNum(tabela.cond_num_parcelas);
    setReforcos(tabela.cond_reforcos ?? []);
    setOk(false);
  }, [tabela]);

  const somaReforcos = reforcos.reduce((s, r) => s + r.pct, 0);
  const mensaisPct = 100 - entrada - saldo - somaReforcos;
  const ro = !podeEditar;

  async function gravar() {
    await salvar.mutateAsync({
      tabelaId: tabela.id,
      cond: {
        cond_entrada_pct: entrada,
        cond_saldo_pct: saldo,
        cond_num_parcelas: num,
        cond_reforcos: reforcos.filter((r) => r.data && r.pct > 0),
      },
    });
    setOk(true);
  }

  const pctInput = (value: number, onChange: (v: number) => void) => (
    <div className="relative w-24">
      <input
        type="number"
        step="0.1"
        disabled={ro}
        value={value || ""}
        onChange={(e) => {
          onChange(Number(e.target.value) || 0);
          setOk(false);
        }}
        className="inp pr-6 text-right"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">
        %
      </span>
    </div>
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 mb-4">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        Condições da tabela base (% do valor da unidade)
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Entrada</span>
          {pctInput(entrada, setEntrada)}
        </div>

        {reforcos.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Reforço</span>
              <MesAnoInput
                value={r.data || null}
                disabled={ro}
                onChange={(v) => {
                  setReforcos(reforcos.map((x, j) => (j === i ? { ...x, data: v ?? "" } : x)));
                  setOk(false);
                }}
              />
              {podeEditar && (
                <button
                  type="button"
                  onClick={() => setReforcos(reforcos.filter((_, j) => j !== i))}
                  className="text-red-500 px-1"
                >
                  ×
                </button>
              )}
            </div>
            {pctInput(r.pct, (v) =>
              setReforcos(reforcos.map((x, j) => (j === i ? { ...x, pct: v } : x))),
            )}
          </div>
        ))}
        {podeEditar && (
          <button
            type="button"
            onClick={() => setReforcos([...reforcos, { data: "", pct: 0 }])}
            className="text-xs text-blue-600 hover:underline"
          >
            + reforço
          </button>
        )}

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">
            Mensais
            <input
              type="number"
              disabled={ro}
              value={num || ""}
              onChange={(e) => {
                setNum(Number(e.target.value) || 0);
                setOk(false);
              }}
              className="inp w-16 mx-2 inline-block"
              placeholder="nº"
            />
            parcelas
          </span>
          <span className="text-sm text-slate-500 tabular-nums">
            {mensaisPct.toFixed(1)}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Saldo na entrega</span>
          {pctInput(saldo, setSaldo)}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-4">
        {podeEditar && (
          <button
            onClick={gravar}
            disabled={salvar.isPending}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {salvar.isPending ? "Salvando…" : "Salvar condições"}
          </button>
        )}
        {ok && <span className="text-sm text-green-600">Salvo ✓</span>}
        <span
          className={`ml-auto text-xs ${
            Math.abs(entrada + saldo + somaReforcos + mensaisPct - 100) < 0.01 && mensaisPct >= 0
              ? "text-slate-400"
              : "text-amber-600"
          }`}
        >
          Soma: {(entrada + saldo + somaReforcos + Math.max(0, mensaisPct)).toFixed(1)}%
        </span>
      </div>
    </section>
  );
}
