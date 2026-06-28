import { useEffect, useMemo, useState } from "react";
import { supabase, PORTAL_URL } from "./api/supabase";
import { avaliarProposta, type RegrasConfig } from "./lib/vpl";

const brl = (v: number) => "R$ " + Math.round(v).toLocaleString("pt-BR");

// Regras-exemplo do simulador (na Fase 1 virão de config_vendas por empreendimento).
const REGRAS_DEMO: RegrasConfig = {
  entradaMinimaPct: 15,
  descontoMaximoPct: 0,
  prazoMaximoMeses: 60,
  parcelaMinimaReais: 0,
  vplPisoFator: 1.0,
  acaoForaRegra: "aprovacao",
};

const STATUS_UI = {
  aprovavel: { cor: "bg-green-100 text-green-800 border-green-300", txt: "Dentro das regras" },
  aprovacao: { cor: "bg-amber-100 text-amber-800 border-amber-300", txt: "Precisa de aprovação" },
  bloqueado: { cor: "bg-red-100 text-red-800 border-red-300", txt: "Bloqueada" },
} as const;

export default function App() {
  const [userEmail, setUserEmail] = useState<string>("");
  const [numEmps, setNumEmps] = useState<number | null>(null);

  // Simulador
  const [preco, setPreco] = useState(500000);
  const [taxaAnual, setTaxaAnual] = useState(12); // % a.a.
  const [entradaPct, setEntradaPct] = useState(15);
  const [prazo, setPrazo] = useState(60);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? "");
      const { count } = await supabase
        .from("empreendimentos")
        .select("*", { count: "exact", head: true });
      setNumEmps(count ?? 0);
    })();
  }, []);

  const av = useMemo(() => {
    const entrada = (preco * entradaPct) / 100;
    const saldo = preco - entrada;
    const valorParcela = prazo > 0 ? saldo / prazo : 0;
    return avaliarProposta({
      precoTabela: preco,
      precoNegociado: preco,
      config: { entrada, numParcelas: prazo, valorParcela },
      regras: REGRAS_DEMO,
      taxaDescontoAnual: taxaAnual / 100,
    });
  }, [preco, taxaAnual, entradaPct, prazo]);

  const ui = STATUS_UI[av.status];

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
          <span className="text-slate-500 hidden sm:block">{userEmail}</span>
          <a
            href={PORTAL_URL}
            className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100"
          >
            ⌂ Portal
          </a>
          <button
            onClick={sair}
            className="px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-100"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <b>Fase 0 — fundação.</b> Login único e cadastro canônico conectados
          {numEmps !== null && <> ({numEmps} empreendimentos visíveis)</>}. O simulador
          abaixo demonstra o motor de VPL; as telas de cadastro, configurador e aprovação
          chegam nas próximas fases.
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold mb-1">Simulador de VPL</h2>
          <p className="text-sm text-slate-500 mb-5">
            Entrada + saldo parcelado sem juros, descontado à TMA. Mostra se o valor
            presente da proposta atinge o piso (= preço à vista).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <Campo label="Preço da unidade (R$)">
              <input
                type="number"
                value={preco}
                onChange={(e) => setPreco(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded"
              />
            </Campo>
            <Campo label={`TMA: ${taxaAnual}% a.a.`}>
              <input
                type="range"
                min={0}
                max={24}
                step={0.5}
                value={taxaAnual}
                onChange={(e) => setTaxaAnual(Number(e.target.value))}
                className="w-full"
              />
            </Campo>
            <Campo label={`Entrada: ${entradaPct}%  (${brl((preco * entradaPct) / 100)})`}>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
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
                step={1}
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
              Parcela {brl(prazo > 0 ? (preco - (preco * entradaPct) / 100) / prazo : 0)} ·
              total nominal {brl(av.totalNominal)} · VPL é {((av.vpl / av.vplPiso) * 100).toFixed(0)}% do piso
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
      </main>
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
