// Tipos do domínio de Propostas — espelham as tabelas do db/013.

export interface Empreendimento {
  id: string;
  codigo: string;
  nome: string;
  status: string; // em_estudo | ativo | concluido
}

export type UnidadeStatus = "disponivel" | "reservada" | "vendida";

export interface TabelaVenda {
  id: string;
  empreendimento_id: string;
  versao: number;
  descricao: string | null;
  vigente: boolean;
  criada_em: string;
}

export interface Unidade {
  id: string;
  empreendimento_id: string;
  tabela_id: string | null;
  identificador: string;
  tipo: string | null;
  area: number | null;
  preco_tabela: number; // valor nominal de tabela
  vpl_piso: number | null; // null = usa preco_tabela * config.vpl_piso_fator
  status: UnidadeStatus;
  ativo: boolean;
}

export interface UnidadeInput {
  empreendimento_id: string;
  tabela_id: string;
  identificador: string;
  tipo: string | null;
  area: number | null;
  preco_tabela: number;
  vpl_piso: number | null;
  status: UnidadeStatus;
}

export type AcaoForaRegra = "aprovacao" | "bloqueio";

export interface ConfigVendas {
  empreendimento_id: string;
  taxa_desconto_anual: number; // 0.12 = 12% a.a.
  entrada_minima_pct: number;
  desconto_maximo_pct: number;
  prazo_maximo_meses: number;
  parcela_minima_reais: number;
  vpl_piso_fator: number; // 1.0 = piso é o preço à vista
  acao_fora_regra: AcaoForaRegra;
  inicio_vendas: string | null; // ISO date (1º do mês)
  entrega: string | null; // ISO date (1º do mês) — define o mês do saldo
}

export interface Sessao {
  userId: string;
  email: string;
  role: string;
  aprovador: boolean; // admin | gestor → cadastra unidades/regras e aprova
}

export type PropostaStatus =
  | "rascunho"
  | "em_aprovacao"
  | "aprovada"
  | "rejeitada"
  | "expirada";

/** Plano de pagamento (gravado em propostas.config jsonb). */
export interface PropostaConfigJson {
  data_base: string; // ISO date — t0 do desconto
  entrada: number;
  num_parcelas: number;
  valor_parcela: number;
  reforcos: { data: string; valor: number }[]; // data mês/ano (1º do mês)
  repasse: { mes: number; valor: number } | null;
}

export interface Proposta {
  id: string;
  unidade_id: string;
  empreendimento_id: string;
  vendedor_id: string;
  cliente_nome: string | null;
  cliente_contato: string | null;
  preco_negociado: number;
  config: PropostaConfigJson;
  vpl_calculado: number | null;
  vpl_piso_snapshot: number | null;
  taxa_snapshot: number | null;
  status: PropostaStatus;
  criado_em: string;
  atualizado_em: string;
  // Campos embutidos (read-only) trazidos pela consulta da lista.
  unidades?: { identificador: string } | null;
  empreendimentos?: { codigo: string } | null;
}

export interface PropostaInput {
  unidade_id: string;
  empreendimento_id: string;
  vendedor_id: string;
  cliente_nome: string | null;
  cliente_contato: string | null;
  preco_negociado: number;
  config: PropostaConfigJson;
  vpl_calculado: number;
  vpl_piso_snapshot: number;
  taxa_snapshot: number;
  status: PropostaStatus;
}
