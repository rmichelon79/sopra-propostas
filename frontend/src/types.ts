// Tipos do domínio de Propostas — espelham as tabelas do db/013.

export interface Empreendimento {
  id: string;
  codigo: string;
  nome: string;
  status: string; // em_estudo | ativo | concluido
}

export type UnidadeStatus = "disponivel" | "reservada" | "vendida";

export interface Unidade {
  id: string;
  empreendimento_id: string;
  identificador: string;
  tipo: string | null;
  area: number | null;
  preco_tabela: number;
  vpl_piso: number | null; // null = usa preco_tabela * config.vpl_piso_fator
  status: UnidadeStatus;
  ativo: boolean;
}

export interface UnidadeInput {
  empreendimento_id: string;
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
}

export interface Sessao {
  userId: string;
  email: string;
  role: string;
  aprovador: boolean; // admin | gestor → cadastra unidades/regras e aprova
}
