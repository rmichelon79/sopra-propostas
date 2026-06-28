// Camada de dados — client-direct no Supabase (RLS protege os dados).
import { supabase } from "./supabase";
import type {
  ConfigVendas,
  Empreendimento,
  Proposta,
  PropostaInput,
  PropostaStatus,
  Sessao,
  TabelaVenda,
  Unidade,
  UnidadeInput,
} from "../types";

function fail(e: { message?: string } | null): never {
  throw new Error(e?.message ?? "Erro no Supabase.");
}

export const DEFAULT_CONFIG = (empId: string): ConfigVendas => ({
  empreendimento_id: empId,
  taxa_desconto_anual: 0.12,
  entrada_minima_pct: 15,
  desconto_maximo_pct: 0,
  prazo_maximo_meses: 60,
  parcela_minima_reais: 0,
  acao_fora_regra: "aprovacao",
  inicio_vendas: null,
  entrega: null,
});

export const api = {
  async sessao(): Promise<Sessao> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Sem sessão.");
    const { data: prof } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    const role = (prof as { role?: string } | null)?.role ?? "viewer";
    return {
      userId: user.id,
      email: user.email ?? "",
      role,
      aprovador: role === "admin" || role === "gestor",
    };
  },

  async listarEmpreendimentos(): Promise<Empreendimento[]> {
    const { data, error } = await supabase
      .from("empreendimentos")
      .select("id,codigo,nome,status")
      .order("codigo");
    if (error) fail(error);
    return (data ?? []) as Empreendimento[];
  },

  // ─── Tabelas de venda (versões) ─────────────────────────────────────────────
  async tabelaVigente(empId: string): Promise<TabelaVenda | null> {
    const { data, error } = await supabase
      .from("tabelas_venda")
      .select("*")
      .eq("empreendimento_id", empId)
      .eq("vigente", true)
      .maybeSingle();
    if (error) fail(error);
    return data as TabelaVenda | null;
  },

  async listarTabelas(empId: string): Promise<TabelaVenda[]> {
    const { data, error } = await supabase
      .from("tabelas_venda")
      .select("*")
      .eq("empreendimento_id", empId)
      .order("versao", { ascending: false });
    if (error) fail(error);
    return (data ?? []) as TabelaVenda[];
  },

  /** Garante que exista uma tabela vigente; cria a v1 se faltar. */
  async garantirTabelaVigente(empId: string): Promise<TabelaVenda> {
    const atual = await api.tabelaVigente(empId);
    if (atual) return atual;
    const { data, error } = await supabase
      .from("tabelas_venda")
      .insert({ empreendimento_id: empId, versao: 1, descricao: "Tabela inicial", vigente: true })
      .select()
      .single();
    if (error) fail(error);
    return data as TabelaVenda;
  },

  /** Clona a tabela vigente para uma nova versão (com suas unidades) e a torna vigente. */
  async criarNovaVersao(empId: string, descricao: string): Promise<TabelaVenda> {
    const atual = await api.garantirTabelaVigente(empId);
    const tabelas = await api.listarTabelas(empId);
    const proxima = Math.max(...tabelas.map((t) => t.versao)) + 1;
    // desativa a vigente
    const off = await supabase
      .from("tabelas_venda")
      .update({ vigente: false })
      .eq("id", atual.id);
    if (off.error) fail(off.error);
    // cria a nova versão vigente (copia as condições base da anterior)
    const { data: nova, error } = await supabase
      .from("tabelas_venda")
      .insert({
        empreendimento_id: empId,
        versao: proxima,
        descricao,
        vigente: true,
        cond_entrada_pct: atual.cond_entrada_pct,
        cond_saldo_pct: atual.cond_saldo_pct,
        cond_num_parcelas: atual.cond_num_parcelas,
        cond_reforcos: atual.cond_reforcos,
      })
      .select()
      .single();
    if (error) fail(error);
    const novaTabela = nova as TabelaVenda;
    // clona as unidades da versão anterior
    const antigas = await api.listarUnidades(atual.id);
    if (antigas.length) {
      const clones = antigas.map((u) => ({
        empreendimento_id: empId,
        tabela_id: novaTabela.id,
        identificador: u.identificador,
        tipo: u.tipo,
        area: u.area,
        preco_tabela: u.preco_tabela,
        vpl_piso: u.vpl_piso,
        status: u.status, // preserva vendida/reservada
      }));
      const ins = await supabase.from("unidades").insert(clones);
      if (ins.error) fail(ins.error);
    }
    return novaTabela;
  },

  async salvarCondicoesBase(
    tabelaId: string,
    cond: Pick<
      TabelaVenda,
      "cond_entrada_pct" | "cond_saldo_pct" | "cond_num_parcelas" | "cond_reforcos"
    >,
  ): Promise<void> {
    const { error } = await supabase.from("tabelas_venda").update(cond).eq("id", tabelaId);
    if (error) fail(error);
  },

  // ─── Unidades (por tabela de venda) ─────────────────────────────────────────
  async listarUnidades(tabelaId: string): Promise<Unidade[]> {
    const { data, error } = await supabase
      .from("unidades")
      .select("*")
      .eq("tabela_id", tabelaId)
      .eq("ativo", true)
      .order("identificador");
    if (error) fail(error);
    return (data ?? []) as Unidade[];
  },

  async criarUnidade(input: UnidadeInput): Promise<Unidade> {
    const { data, error } = await supabase
      .from("unidades")
      .insert(input)
      .select()
      .single();
    if (error) fail(error);
    return data as Unidade;
  },

  async atualizarUnidade(id: string, patch: Partial<UnidadeInput>): Promise<Unidade> {
    const { data, error } = await supabase
      .from("unidades")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) fail(error);
    return data as Unidade;
  },

  async excluirUnidade(id: string): Promise<void> {
    const { error } = await supabase.from("unidades").delete().eq("id", id);
    if (error) fail(error);
  },

  async getConfigVendas(empId: string): Promise<ConfigVendas | null> {
    const { data, error } = await supabase
      .from("config_vendas")
      .select("*")
      .eq("empreendimento_id", empId)
      .maybeSingle();
    if (error) fail(error);
    return data as ConfigVendas | null;
  },

  async salvarConfigVendas(cfg: ConfigVendas): Promise<ConfigVendas> {
    const { data, error } = await supabase
      .from("config_vendas")
      .upsert(cfg)
      .select()
      .single();
    if (error) fail(error);
    return data as ConfigVendas;
  },

  // ─── Propostas ────────────────────────────────────────────────────────────
  // A RLS já filtra: vendedor enxerga só as próprias; aprovador vê todas.
  async listarPropostas(): Promise<Proposta[]> {
    const { data, error } = await supabase
      .from("propostas")
      .select("*, unidades(identificador), empreendimentos(codigo)")
      .order("atualizado_em", { ascending: false });
    if (error) fail(error);
    return (data ?? []) as Proposta[];
  },

  async criarProposta(input: PropostaInput): Promise<Proposta> {
    const { data, error } = await supabase
      .from("propostas")
      .insert(input)
      .select()
      .single();
    if (error) fail(error);
    return data as Proposta;
  },

  async atualizarProposta(id: string, patch: Partial<PropostaInput>): Promise<Proposta> {
    const { data, error } = await supabase
      .from("propostas")
      .update({ ...patch, atualizado_em: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) fail(error);
    return data as Proposta;
  },

  async mudarStatusProposta(id: string, status: PropostaStatus): Promise<void> {
    const { error } = await supabase
      .from("propostas")
      .update({ status, atualizado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) fail(error);
  },
};
