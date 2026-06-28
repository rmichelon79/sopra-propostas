import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ConfigVendas, UnidadeInput } from "../types";

export const useSessao = () =>
  useQuery({ queryKey: ["sessao"], queryFn: () => api.sessao() });

export const useEmpreendimentos = () =>
  useQuery({ queryKey: ["empreendimentos"], queryFn: () => api.listarEmpreendimentos() });

export const useUnidades = (empId: string | null) =>
  useQuery({
    queryKey: ["unidades", empId],
    queryFn: () => api.listarUnidades(empId as string),
    enabled: !!empId,
  });

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
      qc.invalidateQueries({ queryKey: ["unidades", v.input.empreendimento_id] }),
  });
}

export function useExcluirUnidade(empId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.excluirUnidade(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["unidades", empId] }),
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
