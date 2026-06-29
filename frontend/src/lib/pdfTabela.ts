import type { TabelaVenda, Unidade, UnidadeStatus } from "../types";
import { brl } from "./format";
import { fmtMesAno } from "./datas";
import { LOGO_SOPRA } from "./logoSopra";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const num = (v: number) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const STATUS: Record<UnidadeStatus, string> = {
  disponivel: "Disponível",
  reservada: "Reservada",
  vendida: "Vendida",
};

/** Abre a tabela de vendas imprimível (para imobiliárias) e dispara a impressão → PDF. */
export function gerarTabelaPDF(args: {
  empCodigo: string;
  empNome: string;
  tabela: TabelaVenda;
  unidades: Unidade[];
}) {
  const { empCodigo, empNome, tabela, unidades } = args;
  const disp = unidades.filter((u) => u.status === "disponivel").length;

  const cond: string[] = [];
  cond.push(condLinha("Entrada", `${num(tabela.cond_entrada_pct)}%`));
  for (const r of tabela.cond_reforcos ?? [])
    cond.push(condLinha(`Reforço ${fmtMesAno(r.data)}`, `${num(r.pct)}%`));
  if (tabela.cond_num_parcelas > 0) cond.push(condLinha("Mensais", `${tabela.cond_num_parcelas}×`));
  cond.push(condLinha("Saldo na entrega", `${num(tabela.cond_saldo_pct)}%`));

  const linhas = unidades
    .map(
      (u) => `<tr>
      <td>${esc(u.identificador)}</td>
      <td>${esc(u.tipo ?? "—")}</td>
      <td class="r">${u.area ? num(u.area) + " m²" : "—"}</td>
      <td class="r">${brl(u.preco_tabela)}</td>
      <td>${STATUS[u.status]}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Tabela de vendas — ${esc(empNome)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f2937; margin: 0; padding: 36px 40px; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #4a443d; padding-bottom: 16px; margin-bottom: 22px; }
  .logo-img { height: 44px; width: auto; display: block; }
  .doc { text-align: right; font-size: 12px; color: #6b7280; }
  .doc b { display: block; font-size: 16px; color: #1f2937; }
  h1 { font-size: 17px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 18px; }
  .cond { display: flex; flex-wrap: wrap; gap: 6px 28px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; }
  .cond .c { display: flex; gap: 8px; }
  .cond .c span { color: #6b7280; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; border-bottom: 1.5px solid #4a443d; padding: 8px 6px; }
  td { padding: 8px 6px; border-bottom: 1px solid #f1f3f5; }
  td.r, th.r { text-align: right; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .nota { margin-top: 22px; font-size: 11px; color: #9ca3af; }
  @media print { body { padding: 0; } @page { margin: 14mm; } }
</style></head>
<body>
  <div class="top">
    <img class="logo-img" src="${LOGO_SOPRA}" alt="Sopra Incorporadora">
    <div class="doc"><b>Tabela de Vendas</b>Versão ${tabela.versao}${tabela.data ? " · " + esc(fmtMesAno(tabela.data)) : ""}</div>
  </div>

  <h1>${esc(empCodigo)} — ${esc(empNome)}</h1>
  <div class="meta">${unidades.length} unidades · ${disp} disponíveis</div>

  <div class="cond">${cond.join("")}</div>

  <table>
    <thead><tr>
      <th>Unidade</th><th>Tipo</th><th class="r">Área</th><th class="r">Valor</th><th>Status</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table>

  <p class="nota">Condições padrão em % do valor da unidade. Valores e disponibilidade sujeitos a alteração sem aviso prévio. Tabela gerada pela Plataforma Sopra.</p>
<script>window.onload = function(){ window.focus(); window.print(); };</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Permita pop-ups para gerar o PDF da tabela.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

function condLinha(rotulo: string, valor: string): string {
  return `<div class="c"><span>${esc(rotulo)}:</span> ${esc(valor)}</div>`;
}
