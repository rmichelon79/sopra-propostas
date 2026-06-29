import { useEffect, useState } from "react";
import { supabase, PORTAL_URL } from "./api/supabase";
import { DEFAULT_CONFIG } from "./api/client";
import { useConfigVendas, useEmpreendimentos, usePropostas, useSessao } from "./hooks/useData";
import { UnidadesCadastro } from "./components/UnidadesCadastro";
import { RegrasCadastro } from "./components/RegrasCadastro";
import { PropostaConfigurador } from "./components/PropostaConfigurador";
import { PropostasList } from "./components/PropostasList";
import { Aprovacoes } from "./components/Aprovacoes";
import type { Proposta } from "./types";

type Aba = "nova" | "propostas" | "aprovacoes" | "unidades" | "regras";
const LABEL: Record<Aba, string> = {
  nova: "Nova proposta",
  propostas: "Propostas",
  aprovacoes: "Aprovações",
  unidades: "Tabela de vendas",
  regras: "Empreendimento",
};

export default function App() {
  const { data: sessao } = useSessao();
  const { data: emps } = useEmpreendimentos();
  const [empId, setEmpId] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("nova");
  const [editando, setEditando] = useState<Proposta | null>(null);

  useEffect(() => {
    if (!empId && emps?.length) setEmpId(emps[0].id);
  }, [emps, empId]);

  const { data: cfgData } = useConfigVendas(empId);
  const { data: propostas } = usePropostas();
  const cfg = cfgData ?? (empId ? DEFAULT_CONFIG(empId) : null);
  const podeEditar = !!sessao?.aprovador;
  const pendentes = (propostas ?? []).filter((p) => p.status === "em_aprovacao").length;
  const abas: Aba[] = podeEditar
    ? ["nova", "propostas", "aprovacoes", "unidades", "regras"]
    : ["nova", "propostas"];

  function trocarAba(a: Aba) {
    if (a !== "nova") setEditando(null);
    setAba(a);
  }

  function abrirParaEditar(p: Proposta) {
    setEditando(p);
    setEmpId(p.empreendimento_id);
    setAba("nova");
  }

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
          {abas.map((a) => (
            <button
              key={a}
              onClick={() => trocarAba(a)}
              className={`px-3 py-1.5 text-sm rounded ${
                aba === a ? "bg-blue-600 text-white" : "hover:bg-slate-100 text-slate-600"
              }`}
            >
              {LABEL[a]}
              {a === "aprovacoes" && pendentes > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-white text-xs px-1.5">
                  {pendentes}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <main className="max-w-3xl mx-auto p-6">
        {!empId || !cfg || !sessao ? (
          <div className="text-sm text-slate-400 py-12 text-center">Carregando…</div>
        ) : aba === "nova" ? (
          <PropostaConfigurador
            key={editando?.id ?? `novo-${empId}`}
            empId={empId}
            sessao={sessao}
            cfg={cfg}
            inicial={editando}
            onSalvou={() => {
              setEditando(null);
              setAba("propostas");
            }}
          />
        ) : aba === "propostas" ? (
          <PropostasList onEditar={abrirParaEditar} />
        ) : aba === "aprovacoes" ? (
          <Aprovacoes sessao={sessao} />
        ) : aba === "unidades" ? (
          <UnidadesCadastro
            empId={empId}
            cfg={cfg}
            podeEditar={podeEditar}
            isAdmin={sessao.role === "admin"}
          />
        ) : (
          <RegrasCadastro empId={empId} podeEditar={podeEditar} />
        )}
      </main>
    </div>
  );
}
