import type { ReactNode } from "react";
import { isoMes, parseMes } from "../lib/datas";

/** Linha de condição: descrição à esquerda, valor (R$) alinhado à direita.
 *  Usada igual na tabela base (leitura) e na proposta (edição). */
export function LinhaCond({
  label,
  children,
  total,
}: {
  label: ReactNode;
  children: ReactNode;
  total?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 ${
        total ? "border-t border-slate-200 mt-1 pt-2 font-semibold" : "py-1"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600">{label}</div>
      <div className="w-44 shrink-0 text-right tabular-nums">{children}</div>
    </div>
  );
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Campo de dinheiro em reais inteiros, com prefixo R$ e separador de milhar. */
export function MoneyInput({
  value,
  onChange,
  disabled,
  className = "",
  placeholder,
  big,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  big?: boolean;
}) {
  const display = value ? value.toLocaleString("pt-BR") : "";
  return (
    <div className="relative">
      <span
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${
          big ? "left-3 text-lg" : "left-2.5 text-xs"
        }`}
      >
        R$
      </span>
      <input
        inputMode="numeric"
        disabled={disabled}
        value={display}
        placeholder={placeholder}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          onChange(digits ? parseInt(digits, 10) : 0);
        }}
        className={`inp ${big ? "pl-11 text-3xl font-bold py-1" : "pl-8 text-right"} ${className}`}
      />
    </div>
  );
}

/** Mês/ano via dois selects. value = ISO "yyyy-mm-01" | null. */
export function MesAnoInput({
  value,
  onChange,
  disabled,
  anoMin,
  anoMax,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
  anoMin?: number;
  anoMax?: number;
}) {
  const p = parseMes(value);
  const base = new Date().getFullYear();
  const min = anoMin ?? base - 1;
  const max = anoMax ?? base + 10;
  const anos: number[] = [];
  for (let a = min; a <= max; a++) anos.push(a);

  const emit = (mes: number | null, ano: number | null) =>
    onChange(mes && ano ? isoMes(ano, mes) : null);

  return (
    <div className="flex gap-2">
      <select
        disabled={disabled}
        value={p?.mes ?? ""}
        onChange={(e) => {
          const m = e.target.value ? Number(e.target.value) : null;
          emit(m, p?.ano ?? (m ? base : null));
        }}
        className="inp"
      >
        <option value="">Mês</option>
        {MESES.map((nome, i) => (
          <option key={i} value={i + 1}>
            {nome}
          </option>
        ))}
      </select>
      <select
        disabled={disabled}
        value={p?.ano ?? ""}
        onChange={(e) => {
          const a = e.target.value ? Number(e.target.value) : null;
          emit(p?.mes ?? (a ? 1 : null), a);
        }}
        className="inp w-28"
      >
        <option value="">Ano</option>
        {anos.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}
