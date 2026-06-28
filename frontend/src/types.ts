// Tipos do domínio de Propostas — espelham as tabelas do db/013.

export interface Empreendimento {
  id: string;
  codigo: string;
  nome: string;
  status: string; // em_estudo | ativo | concluido
}

export type UnidadeStatus = "disponivel" | "reservada" | "vendida";

/** Reforço da condição base, em % do valor da unidade. */
export interface ReforcoBasePct {
  data: string; // mês/ano (1º do mês)
  pct: number;
}

export interface TabelaVenda {
  id: string;
  empreendimento_id: string;
  versao: number;
  descricao: string | null;
  vigente: boolean;
  criada_em: string;
  // Condição base (padrão), em % do valor da unidade.
  cond_entrada_pct: number;
  cond_saldo_pct: number;
  cond_num_parcelas: number;
  cond_reforcos: ReforcoBasePct[];
}

/** Condição de pagamento materializada em R$ (base ou proposta). */
export interface CondicaoMaterializada {
  entrada: number;
  reforcos: { data: string; valor: number }[];
  numParcelas: number;
  valorParcela: number;
  saldo: number;
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
  prazo_ate_entrega: boolean; // true: prazo máx = meses até a entrega
  parcela_minima_reais: number;
  acao_fora_regra: AcaoForaRegra;
  inicio_vendas: string | null; // ISO date (1º do mês)
  entrega: string | null; // ISO date (1º do mês) — define o mês do saldo
}

export interface Sessao {
  userId: string;
  email: string;
  nome: string;
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
  vendedor_nome: string | null;
  cliente_nome: string | null;
  cliente_cpf: string | null;
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

export interface Aprovacao {
  id: string;
  proposta_id: string;
  aprovador_id: string;
  decisao: "aprovada" | "rejeitada";
  comentario: string | null;
  criado_em: string;
}

export interface PropostaInput {
  unidade_id: string;
  empreendimento_id: string;
  vendedor_id: string;
  vendedor_nome: string | null;
  cliente_nome: string | null;
  cliente_cpf: string | null;
  preco_negociado: number;
  config: PropostaConfigJson;
  vpl_calculado: number;
  vpl_piso_snapshot: number;
  taxa_snapshot: number;
  status: PropostaStatus;
}
