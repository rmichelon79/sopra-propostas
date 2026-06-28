import { isoMes, parseMes } from "../lib/datas";

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
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const display = value ? value.toLocaleString("pt-BR") : "";
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
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
        className={`inp pl-8 text-right ${className}`}
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
