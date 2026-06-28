import { useEffect, useMemo, useState } from "react";
import { useSalvarCondicoesBase } from "../hooks/useData";
import type { ConfigVendas, ReforcoBasePct, TabelaVenda } from "../types";
import { MesAnoInput } from "./inputs";
import { materializarBase } from "../lib/condicao";
import { calcularVpl } from "../lib/vpl";
import { hojeMes, mesesEntre } from "../lib/datas";

const VREF = 100000; // valor de referência: VPL% independe do valor (tudo escala)

export function CondicoesBase({
  tabela,
  cfg,
  empId,
  podeEditar,
}: {
  tabela: TabelaVenda;
  cfg: ConfigVendas;
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

  // VPL da condição base como % do valor de tabela (= piso em %). Independe do valor.
  const vplPct = useMemo(() => {
    const t0 = cfg.inicio_vendas ?? hojeMes();
    const b = materializarBase(VREF, {
      ...tabela,
      cond_entrada_pct: entrada,
      cond_saldo_pct: saldo,
      cond_num_parcelas: num,
      cond_reforcos: reforcos.filter((r) => r.data && r.pct > 0),
    });
    const mesEntrega = cfg.entrega ? Math.max(1, mesesEntre(t0, cfg.entrega)) : num;
    const flow = {
      entrada: b.entrada,
      numParcelas: b.numParcelas,
      valorParcela: b.valorParcela,
      reforcos: b.reforcos
        .filter((r) => r.valor > 0)
        .map((r) => ({ mes: Math.max(0, mesesEntre(t0, r.data)), valor: r.valor })),
      repasse: b.saldo > 0 ? { mes: mesEntrega, valor: b.saldo } : null,
    };
    return (calcularVpl(flow, cfg.taxa_desconto_anual) / VREF) * 100;
  }, [entrada, saldo, num, reforcos, cfg, tabela]);

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

      <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-between">
        <span className="text-sm text-slate-600">VPL da tabela base (piso)</span>
        <span className="text-lg font-bold tabular-nums">
          {vplPct.toFixed(1)}%
          <span className="ml-1 text-xs font-normal text-slate-400">do valor de tabela</span>
        </span>
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
