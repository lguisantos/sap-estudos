// Valida os itens de content/itens. Uso: node scripts/validar.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "content", "itens");
const files = readdirSync(dir).filter(f => f.endsWith(".json"));
const errors = [];
const items = new Map();

const str = v => typeof v === "string" && v.trim().length > 0;
const arr = (v, min = 1) => Array.isArray(v) && v.length >= min;

for (const f of files) {
  let it;
  try { it = JSON.parse(readFileSync(join(dir, f), "utf8")); }
  catch (e) { errors.push(`${f}: JSON inválido (${e.message})`); continue; }
  const err = m => errors.push(`${f}: ${m}`);
  if (it.id !== f.replace(/\.json$/, "")) err(`id "${it.id}" deve ser igual ao nome do arquivo`);
  if (items.has(it.id)) err("id duplicado");
  items.set(it.id, it);
  if (!["fundamentos", "semanal", "processo", "guia"].includes(it.tipo)) err("tipo deve ser fundamentos, semanal, processo ou guia");
  if (it.tipo === "guia" && !["MM", "SD", "FI", "CO", "PP"].includes(it.modulo)) err("guia: modulo obrigatório");
  if (it.tipo === "guia" && !arr(it.fontes)) err("guia precisa de fontes");
  if (!["funcional", "tecnico"].includes(it.trilha)) err("trilha deve ser funcional ou tecnico");
  for (const k of ["area", "titulo", "curto", "nivel", "resumo"]) if (!str(it[k])) err(`${k} obrigatório`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(it.publicado || "")) err("publicado deve ser AAAA-MM-DD");
  if (!arr(it.conceitos, 3) || !it.conceitos.every(c => str(c.termo) && str(c.explicacao))) err("conceitos: pelo menos 3 com termo e explicacao");
  if (!arr(it.transacoes) || !it.transacoes.every(t => str(t.codigo) && str(t.descricao))) err("transacoes: pelo menos 1 com codigo e descricao");
  if (!it.caso || !str(it.caso.titulo) || !str(it.caso.contexto) || !arr(it.caso.passos, 3)) err("caso: titulo, contexto e pelo menos 3 passos");
  if (!arr(it.armadilhas) || !it.armadilhas.every(str)) err("armadilhas obrigatórias");
  if (!it.fixacao || !str(it.fixacao.pergunta) || !str(it.fixacao.resposta)) err("fixacao: pergunta e resposta");
  if (!Array.isArray(it.links)) err("links deve ser lista");
  if (!Array.isArray(it.fontes)) err("fontes deve ser lista");
  if (it.tipo === "semanal") {
    if (!arr(it.fontes)) err("item semanal precisa de fontes");
    if (it.trilha === "tecnico" && (!it.codigo || !str(it.codigo.conteudo) || !str(it.codigo.explicacao))) err("item técnico semanal precisa de codigo com conteudo e explicacao");
  }
  if (it.tipo === "processo") {
    if (!["MM", "SD", "FI", "CO", "PP", "QM", "PM", "WM", "EWM"].includes(it.modulo)) err("processo: modulo inválido");
    if (!Number.isInteger(it.ordem)) err("processo: ordem (inteiro) obrigatória");
    if (!arr(it.quando) || !it.quando.every(str)) err("processo: quando (lista) obrigatório");
    if (!arr(it.prerequisitos) || !it.prerequisitos.every(str)) err("processo: prerequisitos (lista) obrigatório");
    if (!arr(it.fluxo, 4)) err("processo: fluxo com pelo menos 4 passos");
    (it.fluxo || []).forEach((p, i) => {
      for (const k of ["titulo", "papel", "transacao", "descricao", "resultado"]) if (!str(p[k])) err(`fluxo[${i}].${k} obrigatório`);
      if (!arr(p.detalhes, 2) || !p.detalhes.every(str)) err(`fluxo[${i}].detalhes: pelo menos 2`);
      if (p.titulo && p.titulo.length > 48) err(`fluxo[${i}].titulo longo demais para a ilustração (máx. 48)`);
    });
    if (!arr(it.documentos, 1) || !it.documentos.every(d => str(d.nome) && str(d.descricao))) err("processo: documentos com nome e descricao");
    if (!arr(it.configuracao, 1) || !it.configuracao.every(c => str(c.item) && str(c.onde) && str(c.explicacao))) err("processo: configuracao com item, onde e explicacao");
    if (!Array.isArray(it.integracao) || !it.integracao.every(c => str(c.com) && str(c.explicacao))) err("processo: integracao com 'com' e explicacao");
    if (!arr(it.fontes)) err("processo precisa de fontes");
  }
  for (const n of it.novidades || []) if (!str(n.titulo) || !str(n.resumo) || !/^https?:\/\//.test(n.url || "")) err("novidades: titulo, resumo e url http(s)");
  for (const s of it.fontes || []) if (!/^https?:\/\//.test(s.url || "")) err(`fonte sem url válida: ${s.titulo}`);
}
for (const it of items.values())
  for (const l of it.links || []) if (!items.has(l.id)) errors.push(`${it.id}.json: link para id inexistente "${l.id}"`);

// Trilhas de aprendizado: etapas escritas precisam existir; lacunas precisam de tema e tipo.
const arqTrilhas = join(dir, "..", "trilhas.json");
let lacunas = 0;
try {
  const { trilhas } = JSON.parse(readFileSync(arqTrilhas, "utf8"));
  for (const t of trilhas) {
    const vistos = new Set();
    if (!str(t.id) || !str(t.modulo) || !str(t.titulo) || !arr(t.niveis)) errors.push(`trilhas.json: trilha ${t.id} incompleta`);
    for (const n of t.niveis) for (const e of n.etapas || []) {
      const onde = `trilhas.json [${t.id}/${n.id}] ${e.item}`;
      if (vistos.has(e.item)) errors.push(`${onde}: etapa repetida`);
      vistos.add(e.item);
      if (!str(e.porque) || !str(e.consegue)) errors.push(`${onde}: porque e consegue obrigatórios`);
      if (items.has(e.item)) continue;
      if (!str(e.tema) || !["guia", "processo"].includes(e.tipo)) errors.push(`${onde}: item inexistente (lacunas precisam de tema e tipo guia/processo)`);
      else lacunas++;
    }
  }
} catch (e) { errors.push(`trilhas.json: ${e.message}`); }

if (errors.length) { console.error(errors.join("\n")); console.error(`\n${errors.length} problema(s) em ${files.length} itens.`); process.exit(1); }
console.log(`OK: ${files.length} itens válidos; trilhas com ${lacunas} etapa(s) ainda por escrever.`);
