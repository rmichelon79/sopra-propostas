import type { Proposta } from "../types";
import { brl } from "./format";
import { fmtMesAno } from "./datas";
import { LOGO_SOPRA } from "./logoSopra";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Abre uma folha imprimível (cliente) da proposta e dispara a impressão → PDF. */
export function gerarPropostaPDF(p: Proposta) {
  const emp = p.empreendimentos?.codigo ?? "";
  const unidade = p.unidades?.identificador ?? "—";
  const valorTabela = p.unidades?.preco_tabela ?? 0;
  const c = p.config;
  const data = p.criado_em ? p.criado_em.slice(0, 10).split("-").reverse().join("/") : "";

  const linhas: string[] = [];
  linhas.push(linha("Entrada", brl(c.entrada)));
  for (const r of c.reforcos ?? []) linhas.push(linha(`Reforço ${fmtMesAno(r.data)}`, brl(r.valor)));
  if (c.num_parcelas > 0)
    linhas.push(linha(`${c.num_parcelas}× parcelas mensais`, brl(c.valor_parcela)));
  if (c.repasse && c.repasse.valor > 0)
    linhas.push(linha("Saldo na entrega", brl(c.repasse.valor)));

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Proposta — ${esc(unidade)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #1f2937; margin: 0; padding: 40px; }
  .wrap { max-width: 720px; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #4a443d; padding-bottom: 16px; margin-bottom: 24px; }
  .logo-img { height: 46px; width: auto; display: block; }
  .doc { text-align: right; font-size: 12px; color: #6b7280; }
  .doc b { display: block; font-size: 16px; color: #1f2937; }
  h1 { font-size: 18px; margin: 0 0 18px; }
  .info { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; font-size: 13px; margin-bottom: 24px; }
  .info div { display: flex; justify-content: space-between; border-bottom: 1px dotted #e5e7eb; padding: 4px 0; }
  .info span { color: #6b7280; }
  .destaque { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: baseline; }
  .destaque .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }
  .destaque .val { font-size: 24px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding: 8px 0; }
  td { padding: 9px 0; border-bottom: 1px solid #f1f3f5; }
  td.v { text-align: right; font-variant-numeric: tabular-nums; }
  tr.total td { border-top: 2px solid #1f2937; border-bottom: none; font-weight: 700; font-size: 15px; padding-top: 12px; }
  .ass { display: flex; gap: 40px; margin-top: 64px; }
  .ass div { flex: 1; border-top: 1px solid #9ca3af; padding-top: 6px; font-size: 12px; color: #6b7280; text-align: center; }
  .nota { margin-top: 28px; font-size: 11px; color: #9ca3af; }
  @media print { body { padding: 0; } @page { margin: 18mm; } }
</style></head>
<body><div class="wrap">
  <div class="top">
    <img class="logo-img" src="${LOGO_SOPRA}" alt="Sopra Incorporadora">
    <div class="doc"><b>Proposta Comercial</b>${esc(emp)} · ${esc(unidade)}${data ? "<br>Emitida em " + esc(data) : ""}</div>
  </div>

  <div class="info">
    <div><span>Empreendimento</span><b>${esc(emp)}</b></div>
    <div><span>Unidade</span><b>${esc(unidade)}</b></div>
    <div><span>Cliente</span><b>${esc(p.cliente_nome ?? "—")}</b></div>
    <div><span>CPF</span><b>${esc(p.cliente_cpf ?? "—")}</b></div>
    <div><span>Vendedor</span><b>${esc(p.vendedor_nome ?? "—")}</b></div>
    <div><span>Data</span><b>${esc(data)}</b></div>
  </div>

  <div class="destaque">
    <span class="lbl">Valor da unidade (tabela)</span>
    <span class="val">${brl(valorTabela)}</span>
  </div>

  <h1>Condições de pagamento</h1>
  <table>
    <thead><tr><th>Descrição</th><th style="text-align:right">Valor</th></tr></thead>
    <tbody>
      ${linhas.join("")}
      <tr class="total"><td>Total da proposta</td><td class="v">${brl(p.preco_negociado)}</td></tr>
    </tbody>
  </table>

  <div class="ass">
    <div>${esc(p.cliente_nome ?? "")}<br>Cliente</div>
    <div>${esc(p.vendedor_nome ?? "")}<br>Vendedor</div>
  </div>

  <p class="nota">Proposta sujeita à análise e aprovação. Valores em reais (R$). Documento gerado pela Plataforma Sopra.</p>
</div>
<script>window.onload = function(){ window.focus(); window.print(); };</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Permita pop-ups para gerar o PDF da proposta.");
    return;
  }
  w.document.write(html);
  w.document.close();
}

function linha(desc: string, valor: string): string {
  return `<tr><td>${esc(desc)}</td><td class="v">${esc(valor)}</td></tr>`;
}
