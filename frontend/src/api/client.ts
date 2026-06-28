// Camada de dados — client-direct no Supabase (RLS protege os dados).
import { supabase } from "./supabase";
import type {
  ConfigVendas,
  Empreendimento,
  Sessao,
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
  vpl_piso_fator: 1.0,
  acao_fora_regra: "aprovacao",
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

  async listarUnidades(empId: string): Promise<Unidade[]> {
    const { data, error } = await supabase
      .from("unidades")
      .select("*")
      .eq("empreendimento_id", empId)
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
};
