import { useEffect, useMemo, useState } from "react";
import { supabase, PORTAL_URL } from "./api/supabase";
import { DEFAULT_CONFIG } from "./api/client";
import { useConfigVendas, useEmpreendimentos, useSessao } from "./hooks/useData";
import { avaliarProposta, type RegrasConfig } from "./lib/vpl";
import { brl } from "./lib/format";
import { UnidadesCadastro } from "./components/UnidadesCadastro";
import { RegrasCadastro } from "./components/RegrasCadastro";

type Aba = "unidades" | "regras" | "simulador";

const STATUS_UI = {
  aprovavel: { cor: "bg-green-100 text-green-800 border-green-300", txt: "Dentro das regras" },
  aprovacao: { cor: "bg-amber-100 text-amber-800 border-amber-300", txt: "Precisa de aprovação" },
  bloqueado: { cor: "bg-red-100 text-red-800 border-red-300", txt: "Bloqueada" },
} as const;

export default function App() {
  const { data: sessao } = useSessao();
  const { data: emps } = useEmpreendimentos();
  const [empId, setEmpId] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("unidades");

  // Seleciona o 1º empreendimento assim que a lista chega.
  useEffect(() => {
    if (!empId && emps?.length) setEmpId(emps[0].id);
  }, [emps, empId]);

  const { data: cfgData } = useConfigVendas(empId);
  const cfg = cfgData ?? (empId ? DEFAULT_CONFIG(empId) : null);
  const podeEditar = !!sessao?.aprovador;

  async function sair() {
    await supabase.auth.signOut();
    location.href = PORTAL_URL;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
        <div>
          <div className="text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
            Sopra Incorporações
          </div>
          <div className="text-lg font-bold">Propostas Comerciais</div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500 hidden sm:block">{sessao?.email}</span>
          <a href={PORTAL_URL} className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100">
            ⌂ Portal
          </a>
          <button onClick={sair} className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100">
            Sair
          </button>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 px-6 py-2 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-500">Empreendimento</label>
        <select
          value={empId ?? ""}
          onChange={(e) => setEmpId(e.target.value)}
          className="px-3 py-1.5 text-sm border rounded bg-white"
        >
          {(emps ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.codigo} — {e.nome}
            </option>
          ))}
        </select>
        <nav className="ml-auto flex gap-1">
          {(["unidades", "regras", "simulador"] as Aba[]).map((a) => (
            <button
              key={a}
              onClick={() => setAba(a)}
              className={`px-3 py-1.5 text-sm rounded capitalize ${
                aba === a ? "bg-blue-600 text-white" : "hover:bg-slate-100 text-slate-600"
              }`}
            >
              {a}
            </button>
          ))}
        </nav>
      </div>

      <main className="max-w-3xl mx-auto p-6">
        {!empId ? (
          <div className="text-sm text-slate-400 py-12 text-center">Carregando empreendimentos…</div>
        ) : aba === "unidades" ? (
          <UnidadesCadastro empId={empId} pisoFator={cfg?.vpl_piso_fator ?? 1} podeEditar={podeEditar} />
        ) : aba === "regras" ? (
          <RegrasCadastro empId={empId} podeEditar={podeEditar} />
        ) : (
          <Simulador
            regras={{
              entradaMinimaPct: cfg?.entrada_minima_pct ?? 15,
              descontoMaximoPct: cfg?.desconto_maximo_pct ?? 0,
              prazoMaximoMeses: cfg?.prazo_maximo_meses ?? 60,
              parcelaMinimaReais: cfg?.parcela_minima_reais ?? 0,
              vplPisoFator: cfg?.vpl_piso_fator ?? 1,
              acaoForaRegra: cfg?.acao_fora_regra ?? "aprovacao",
            }}
            taxaAnual={(cfg?.taxa_desconto_anual ?? 0.12) * 100}
          />
        )}
      </main>
    </div>
  );
}

function Simulador({ regras, taxaAnual }: { regras: RegrasConfig; taxaAnual: number }) {
  const [preco, setPreco] = useState(500000);
  const [entradaPct, setEntradaPct] = useState(regras.entradaMinimaPct);
  const [prazo, setPrazo] = useState(Math.min(regras.prazoMaximoMeses, 60));

  const av = useMemo(() => {
    const entrada = (preco * entradaPct) / 100;
    const saldo = preco - entrada;
    const valorParcela = prazo > 0 ? saldo / prazo : 0;
    return avaliarProposta({
      precoTabela: preco,
      precoNegociado: preco,
      config: { entrada, numParcelas: prazo, valorParcela },
      regras,
      taxaDescontoAnual: taxaAnual / 100,
    });
  }, [preco, entradaPct, prazo, regras, taxaAnual]);

  const ui = STATUS_UI[av.status];
  const parcela = prazo > 0 ? (preco - (preco * entradaPct) / 100) / prazo : 0;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold mb-1">Simulador de VPL</h2>
      <p className="text-sm text-slate-500 mb-5">
        Entrada + saldo parcelado sem juros, descontado à TMA de {taxaAnual.toFixed(1)}% a.a. das
        regras deste empreendimento.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Campo label="Preço da unidade (R$)">
          <input
            type="number"
            value={preco}
            onChange={(e) => setPreco(Number(e.target.value) || 0)}
            className="inp"
          />
        </Campo>
        <Campo label={`Entrada: ${entradaPct}%  (${brl((preco * entradaPct) / 100)})`}>
          <input
            type="range"
            min={0}
            max={100}
            value={entradaPct}
            onChange={(e) => setEntradaPct(Number(e.target.value))}
            className="w-full"
          />
        </Campo>
        <Campo label={`Prazo: ${prazo}x`}>
          <input
            type="range"
            min={1}
            max={120}
            value={prazo}
            onChange={(e) => setPrazo(Number(e.target.value))}
            className="w-full"
          />
        </Campo>
      </div>

      <div className={`rounded-lg border px-4 py-3 mb-5 ${ui.cor}`}>
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">{ui.txt}</span>
          <span className="text-sm">
            VPL {brl(av.vpl)} · piso {brl(av.vplPiso)}
          </span>
        </div>
        <div className="text-xs mt-1 opacity-80">
          Parcela {brl(parcela)} · total nominal {brl(av.totalNominal)} · VPL é{" "}
          {((av.vpl / av.vplPiso) * 100).toFixed(0)}% do piso
        </div>
      </div>

      <ul className="space-y-1.5">
        {av.checagens.map((c) => (
          <li key={c.chave} className="flex items-center gap-2 text-sm">
            <span>{c.ok ? "✅" : "⚠️"}</span>
            <span className="font-medium">{c.rotulo}</span>
            <span className="text-slate-400">— {c.detalhe}</span>
          </li>
        ))}
      </ul>
    </section>
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
