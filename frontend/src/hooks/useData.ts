import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ConfigVendas, PropostaInput, PropostaStatus, UnidadeInput } from "../types";

export const useSessao = () =>
  useQuery({ queryKey: ["sessao"], queryFn: () => api.sessao() });

export const useEmpreendimentos = () =>
  useQuery({ queryKey: ["empreendimentos"], queryFn: () => api.listarEmpreendimentos() });

export const useUnidades = (tabelaId: string | null) =>
  useQuery({
    queryKey: ["unidades", tabelaId],
    queryFn: () => api.listarUnidades(tabelaId as string),
    enabled: !!tabelaId,
  });

export const useTabelaVigente = (empId: string | null) =>
  useQuery({
    queryKey: ["tabela-vigente", empId],
    queryFn: () => api.garantirTabelaVigente(empId as string),
    enabled: !!empId,
  });

export const useTabelas = (empId: string | null) =>
  useQuery({
    queryKey: ["tabelas", empId],
    queryFn: () => api.listarTabelas(empId as string),
    enabled: !!empId,
  });

export function useSalvarCondicoesBase(empId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      tabelaId,
      cond,
    }: {
      tabelaId: string;
      cond: Parameters<typeof api.salvarCondicoesBase>[1];
    }) => api.salvarCondicoesBase(tabelaId, cond),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tabela-vigente", empId] });
      qc.invalidateQueries({ queryKey: ["tabelas", empId] });
    },
  });
}

export function useCriarNovaVersao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ empId, sourceTabelaId }: { empId: string; sourceTabelaId?: string }) =>
      api.criarNovaVersao(empId, sourceTabelaId),
    // retorna a promise das invalidações → mutateAsync só resolve com os dados frescos
    onSuccess: (_d, v) =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["tabela-vigente", v.empId] }),
        qc.invalidateQueries({ queryKey: ["tabelas", v.empId] }),
        qc.invalidateQueries({ queryKey: ["unidades"] }),
      ]),
  });
}

export function useTornarVigente(empId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tabelaId: string) => api.tornarVigente(empId, tabelaId),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["tabela-vigente", empId] }),
        qc.invalidateQueries({ queryKey: ["tabelas", empId] }),
      ]),
  });
}

export function useSalvarDataTabela(empId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ tabelaId, data }: { tabelaId: string; data: string | null }) =>
      api.salvarDataTabela(tabelaId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tabela-vigente", empId] });
      qc.invalidateQueries({ queryKey: ["tabelas", empId] });
    },
  });
}

export function useExcluirTabela(empId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tabelaId: string) => api.excluirTabela(tabelaId),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ["tabela-vigente", empId] }),
        qc.invalidateQueries({ queryKey: ["tabelas", empId] }),
        qc.invalidateQueries({ queryKey: ["unidades"] }),
      ]),
  });
}

export const useConfigVendas = (empId: string | null) =>
  useQuery({
    queryKey: ["config", empId],
    queryFn: () => api.getConfigVendas(empId as string),
    enabled: !!empId,
  });

export function useSalvarUnidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: UnidadeInput }) =>
      id ? api.atualizarUnidade(id, input) : api.criarUnidade(input),
    onSuccess: (_d, v) =>
      qc.invalidateQueries({ queryKey: ["unidades", v.input.tabela_id] }),
  });
}

export function useExcluirUnidade(tabelaId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.excluirUnidade(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unidades", tabelaId] }),
  });
}

export function useSalvarConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cfg: ConfigVendas) => api.salvarConfigVendas(cfg),
    onSuccess: (_d, cfg) =>
      qc.invalidateQueries({ queryKey: ["config", cfg.empreendimento_id] }),
  });
}

export const usePropostas = () =>
  useQuery({ queryKey: ["propostas"], queryFn: () => api.listarPropostas() });

export function useSalvarProposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: PropostaInput }) =>
      id ? api.atualizarProposta(id, input) : api.criarProposta(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["propostas"] }),
  });
}

export function useMudarStatusProposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: PropostaStatus }) =>
      api.mudarStatusProposta(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["propostas"] }),
  });
}

export const useAprovacoes = (propostaId: string | null) =>
  useQuery({
    queryKey: ["aprovacoes", propostaId],
    queryFn: () => api.listarAprovacoes(propostaId as string),
    enabled: !!propostaId,
  });

export function useDecidirProposta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Parameters<typeof api.decidirProposta>[0]) => api.decidirProposta(args),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["propostas"] });
      qc.invalidateQueries({ queryKey: ["aprovacoes", v.propostaId] });
    },
  });
}
