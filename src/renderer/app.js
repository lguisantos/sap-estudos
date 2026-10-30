// Interface do SAP Estudos.
const esc = window.escapeHtml;
const $ = id => document.getElementById(id);

const st = {
  itens: [], porId: {}, naoVistos: new Set(), notas: {}, config: {}, chat: [],
  atual: null, view: "estudo", trilha: "todas", busca: "", respondendo: false, fechados: new Set(),
};

/* ---------- utilidades ---------- */
const dataBR = iso => {
  const [a, m, d] = String(iso).split("-").map(Number);
  return new Date(a, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).replace(".", "");
};
const rotulo = t => (t === "tecnico" ? "Técnico" : "Funcional");
const estudado = id => !!(st.notas[id] && st.notas[id].estudado);

function indexar(lista) {
  st.itens = lista;
  st.porId = Object.fromEntries(lista.map(i => [i.id, i]));
  st.alias = {};
  for (const it of lista) for (const k of [it.id, it.curto, it.titulo, it.curto.split(" — ")[0]]) st.alias[k.toLowerCase().trim()] = it.id;
}
const resolver = nome => st.alias[String(nome).toLowerCase().trim()] || null;
const wikiLink = nome => { const id = resolver(nome); return id ? `<button class="chip" data-abrir="${id}">↗ ${esc(st.porId[id].curto)}</button>` : ""; };

/* ---------- lista lateral ---------- */
function filtrados() {
  const q = st.busca.toLowerCase();
  const passa = it => st.trilha === "todas" || it.trilha === st.trilha || it.modulo === st.trilha;
  return st.itens.filter(it => passa(it) && (!q || JSON.stringify(it).toLowerCase().includes(q)));
}
function linha(it) {
  const novo = st.naoVistos.has(it.id);
  const cls = ["it", estudado(it.id) ? "done" : "", novo ? "novo" : ""].join(" ");
  const sub = it.tipo === "semanal" ? `${dataBR(it.publicado)}` : it.tipo === "processo" ? `${esc(it.area)}` : `fundamento ${it.ordem}`;
  return `<button class="${cls}" data-abrir="${it.id}" aria-current="${it.id === st.atual}">
    <span class="dot" aria-hidden="true"></span>
    <span><span class="t">${esc(it.curto)}${novo ? '<span class="pill novo">novo</span>' : ""}</span>
    <span class="d">${sub}${it.tipo === "processo" ? "" : `<span class="pill ${it.trilha}">${rotulo(it.trilha)}</span>`}</span></span></button>`;
}
function renderLista() {
  const its = filtrados();
  const grupos = [
    ["proc-MM", "Processos MM · Materiais", its.filter(i => i.tipo === "processo" && i.modulo === "MM")],
    ["proc-SD", "Processos SD · Vendas", its.filter(i => i.tipo === "processo" && i.modulo === "SD")],
    ["semanal", "Edições semanais", its.filter(i => i.tipo === "semanal")],
    ["fund", "Fundamentos", its.filter(i => i.tipo === "fundamentos")],
  ];
  // Grupos recolhíveis; a busca abre todos para mostrar os resultados.
  const html = grupos.filter(g => g[2].length).map(([k, nome, lista]) => {
    const aberto = st.busca || !st.fechados.has(k) || lista.some(i => i.id === st.atual);
    return `<details class="grupo" data-grupo="${k}"${aberto ? " open" : ""}><summary class="grp">${nome} <span class="cnt">${lista.length}</span></summary>${lista.map(linha).join("")}</details>`;
  }).join("");
  $("lista").innerHTML = html || `<p class="empty">Nada encontrado.</p>`;
  $("lista").querySelectorAll("details.grupo").forEach(d => d.addEventListener("toggle", () => {
    if (d.open) st.fechados.delete(d.dataset.grupo); else st.fechados.add(d.dataset.grupo);
  }));
}

/* ---------- novidades ---------- */
function renderSino() {
  const n = st.naoVistos.size;
  $("bell-count").hidden = !n;
  $("bell-count").textContent = n > 9 ? "9+" : n;
  const lista = st.itens.filter(i => st.naoVistos.has(i.id));
  $("pop-lista").innerHTML = lista.length
    ? lista.map(i => `<button class="pop-item" data-abrir="${i.id}"><b>${esc(i.titulo)}</b><small>${i.tipo === "processo" ? "Processo " + esc(i.modulo) : rotulo(i.trilha)} · ${dataBR(i.publicado)} · ${esc(i.area)}</small></button>`).join("")
    : `<p class="empty pad">Você está em dia. A próxima edição chega na sexta às 9h.</p>`;
  desenharSelo(n);
}
function desenharSelo(n) {
  if (!n) { window.sap.definirSelo(null, 0); return; }
  const c = document.createElement("canvas"); c.width = c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#c8372d"; g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff"; g.font = `700 ${n > 9 ? 14 : 19}px Segoe UI, Arial`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(n > 9 ? "9+" : String(n), 16, 17);
  window.sap.definirSelo(c.toDataURL("image/png"), n);
}

/* ---------- leitor ---------- */
function backlinks(id) { return st.itens.filter(i => (i.links || []).some(l => l.id === id)); }
function renderItem() {
  const it = st.porId[st.atual];
  if (!it) { $("reader").innerHTML = `<p class="empty">Selecione um tema na lista.</p>`; return; }
  const bl = backlinks(it.id);
  const sec = (titulo, corpo) => `<section class="blk"><h3>${titulo}</h3>${corpo}</section>`;
  const onde = it.tipo === "semanal" ? "Edição de " + dataBR(it.publicado)
    : it.tipo === "processo" ? `Processo ${esc(it.modulo)} · ${esc(it.area)}` : "Fundamento " + it.ordem + " de 12";
  let h = `<div class="meta"><span class="area">${esc(it.tipo === "processo" ? it.modulo : it.area)}</span><span>${rotulo(it.trilha)} · ${esc(it.nivel)}</span>
    <span>${onde}</span></div>
    <h2>${esc(it.titulo)}</h2><p class="lede">${esc(it.resumo)}</p>`;
  if (it.novidades && it.novidades.length) h += sec("O que há de novo no mercado", `<div class="news">${it.novidades.map(n => `<div class="news-i"><b>${esc(n.titulo)}</b><p>${esc(n.resumo)}</p><button class="ext" data-url="${esc(n.url)}">${esc(n.fonte || "Fonte")}</button></div>`).join("")}</div>`);
  if (it.tipo === "processo") h += window.renderProcesso(it, sec);
  else {
  h += sec("Conceitos-chave", `<dl class="terms">${it.conceitos.map(c => `<dt>${esc(c.termo)}</dt><dd>${esc(c.explicacao)}</dd>`).join("")}</dl>`);
  h += sec("Transações e apps para praticar", `<div class="tcodes">${it.transacoes.map(t => `<div class="tc"><code>${esc(t.codigo)}</code><span>${esc(t.descricao)}</span></div>`).join("")}</div>`);
  if (it.codigo) h += sec("Código comentado", `<p class="codetitle">${esc(it.codigo.titulo || "")}</p><pre class="code"><code>${esc(it.codigo.conteudo)}</code></pre><p class="codeexp">${esc(it.codigo.explicacao || "")}</p>`);
  h += sec("No mundo real", `<div class="case"><p class="who">${esc(it.caso.titulo)}</p><p>${esc(it.caso.contexto)}</p><ol>${it.caso.passos.map(p => `<li>${esc(p)}</li>`).join("")}</ol></div>`);
  h += sec("Armadilhas comuns", `<ul class="plain">${it.armadilhas.map(a => `<li>${esc(a)}</li>`).join("")}</ul>`);
  }
  h += sec("Pergunta de fixação", `<p class="quiz">${esc(it.fixacao.pergunta)}</p><details class="ans"><summary>Ver resposta comentada</summary><p>${esc(it.fixacao.resposta)}</p></details>
    <p class="quiz-cta"><button class="link" id="btn-quiz">Discutir minha resposta com o Claude →</button></p>`);
  const links = (it.links || []).filter(l => st.porId[l.id]);
  h += sec("Conexões com outros temas", `<div class="links">${links.map(l => `<button class="lnk" data-abrir="${l.id}"><b>${esc(st.porId[l.id].curto)} →</b><span>${esc(l.motivo)}</span></button>`).join("") || '<p class="empty">Sem conexões declaradas.</p>'}</div>
    ${bl.length ? `<div class="backl">Citado por: ${bl.map(b => `<button class="chip" data-abrir="${b.id}">${esc(b.curto)}</button>`).join("")}</div>` : ""}`);
  if (it.fontes && it.fontes.length) h += sec("Fontes", `<ul class="sources">${it.fontes.map(f => `<li><button class="ext" data-url="${esc(f.url)}">${esc(f.titulo)}</button></li>`).join("")}</ul>`);
  $("reader").innerHTML = h;
  $("reader").scrollTop = 0;
  $("btn-quiz").onclick = () => { abrirAba("chat"); $("chat-in").value = `Minha resposta para a pergunta de fixação "${it.fixacao.pergunta}":\n\n`; $("chat-in").focus(); };
}

async function abrir(id) {
  if (!st.porId[id]) return;
  st.atual = id;
  mostrarView("estudo");
  renderItem(); renderLista(); renderCaderno(); renderChatCtx();
  if (st.naoVistos.has(id)) {
    st.naoVistos = new Set(await window.sap.marcarVisto(id));
    renderSino(); renderLista();
  }
}

/* ---------- caderno ---------- */
let tNota = null;
function renderCaderno() {
  const n = st.notas[st.atual] || {};
  $("nb-text").value = n.texto || "";
  $("nb-done").checked = !!n.estudado;
  $("nb-status").textContent = n.atualizado ? "Salvo em " + new Date(n.atualizado).toLocaleString("pt-BR") : "";
  renderCitados();
}
function renderCitados() {
  const refs = [...$("nb-text").value.matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
  $("nb-cited").innerHTML = refs.map(r => wikiLink(r) || `<span class="chip bad" title="Tema não encontrado">[[${esc(r)}]]?</span>`).join("");
}
async function salvarNota() {
  const id = st.atual;
  const nota = { texto: $("nb-text").value, estudado: $("nb-done").checked };
  st.notas[id] = await window.sap.salvarNota(id, nota);
  $("nb-status").textContent = "Salvo às " + new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
$("nb-text").addEventListener("input", () => { renderCitados(); $("nb-status").textContent = "Digitando…"; clearTimeout(tNota); tNota = setTimeout(salvarNota, 700); });
$("nb-done").addEventListener("change", async () => { await salvarNota(); renderLista(); });

/* ---------- chat ---------- */
function abrirAba(qual) {
  const chat = qual === "chat";
  $("tab-chat").setAttribute("aria-selected", chat); $("tab-caderno").setAttribute("aria-selected", !chat);
  $("p-chat").hidden = !chat; $("p-caderno").hidden = chat;
  if (chat) { renderChat(); $("chat-in").focus(); }
}
$("tab-chat").onclick = () => abrirAba("chat");
$("tab-caderno").onclick = () => abrirAba("caderno");

function renderChatCtx() {
  const it = st.porId[st.atual];
  $("chat-ctx").textContent = it ? `Contexto: ${it.curto}` : "";
  $("chat-mode").textContent = st.config.permitirEdicao ? "Edição de conteúdo liberada" : "Somente leitura e pesquisa";
}
function msgHtml(m) {
  if (m.papel === "eu") return `<div class="msg eu">${esc(m.texto)}</div>`;
  const ferramentas = (m.ferramentas || []).map(f => `<span class="tool">· ${esc(f)}</span>`).join("");
  const corpo = m.texto ? window.renderMarkdown(m.texto, wikiLink) : (st.respondendo ? "<p class=\"hint\">Pensando…</p>" : "");
  return `<div class="msg claude${m.erro ? " erro" : ""}"><span class="who">Claude</span>${ferramentas}${corpo}</div>`;
}
function renderChat() {
  const box = $("msgs");
  if (!st.chat.length) {
    const it = st.porId[st.atual];
    const sugestoes = it ? [
      `Explique "${it.curto}" com um exemplo da minha rotina como desenvolvedor ABAP.`,
      `Monte 3 exercícios práticos sobre ${it.curto} para eu fazer num sistema SAP.`,
      `O que mudou recentemente no mercado sobre ${it.curto}? Cite fontes.`,
    ] : [];
    box.innerHTML = `<div class="empty-chat"><p>Pergunte qualquer coisa sobre SAP. O Claude Code roda no seu computador, lê o conteúdo do app e pode pesquisar na web.</p>${sugestoes.map(s => `<button class="link" data-sugestao="${esc(s)}">${esc(s)}</button>`).join("")}</div>`;
  } else {
    box.innerHTML = st.chat.map(msgHtml).join("");
  }
  box.scrollTop = box.scrollHeight;
  $("btn-parar").hidden = !st.respondendo;
  $("btn-enviar").disabled = st.respondendo;
}
async function enviarPergunta(texto) {
  texto = texto.trim();
  if (!texto || st.respondendo) return;
  st.respondendo = true;
  st.chat.push({ papel: "eu", texto }, { papel: "claude", texto: "", ferramentas: [] });
  $("chat-in").value = "";
  renderChat();
  const r = await window.sap.enviarChat({ texto, itemId: st.atual });
  if (!r.ok) { const m = st.chat[st.chat.length - 1]; m.texto = r.erro; m.erro = true; st.respondendo = false; renderChat(); }
}
let tChat = null;
window.sap.aoChat(ev => {
  const m = st.chat[st.chat.length - 1];
  if (!m || m.papel !== "claude") return;
  if (ev.tipo === "texto") m.texto += ev.delta;
  if (ev.tipo === "ferramenta") (m.ferramentas = m.ferramentas || []).push(nomeFerramenta(ev.nome));
  if (ev.tipo === "fim") { if (!m.texto && ev.texto) m.texto = ev.texto; if (ev.erro) m.erro = true; st.respondendo = false; }
  // Agrupa atualizações do stream para não redesenhar a cada token.
  if (ev.tipo === "fim") { clearTimeout(tChat); tChat = null; renderChat(); }
  else if (!tChat) tChat = setTimeout(() => { tChat = null; renderChat(); }, 60);
});
const nomeFerramenta = n => ({ Read: "lendo conteúdo", Grep: "procurando no conteúdo", Glob: "listando arquivos", WebSearch: "pesquisando na web", WebFetch: "lendo página", Edit: "editando arquivo", Write: "criando arquivo", Bash: "executando comando" }[n] || n);
$("chat-form").addEventListener("submit", e => { e.preventDefault(); enviarPergunta($("chat-in").value); });
$("chat-in").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviarPergunta($("chat-in").value); } });
$("btn-parar").onclick = () => window.sap.pararChat();
$("btn-nova").onclick = async () => { await window.sap.novaConversa(); st.chat = []; renderChat(); };

/* ---------- mapa ---------- */
function renderMapa() {
  const svg = $("mapsvg"), cx = 500, cy = 380;
  const fund = st.itens.filter(i => i.tipo === "fundamentos").sort((a, b) => a.ordem - b.ordem);
  const sem = st.itens.filter(i => i.tipo === "semanal").sort((a, b) => a.publicado.localeCompare(b.publicado));
  const proc = st.itens.filter(i => i.tipo === "processo");
  const pos = {};
  const anel = (lista, r, giro) => lista.forEach((it, k) => {
    const a = -Math.PI / 2 + giro + k * 2 * Math.PI / Math.max(lista.length, 1);
    pos[it.id] = [cx + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), a];
  });
  anel(fund, 175, 0);
  anel(sem, 300, Math.PI / Math.max(sem.length, 1));
  anel(proc, 470, 0);
  const vistos = new Set(); let arestas = "";
  for (const it of st.itens) for (const l of it.links || []) {
    if (!pos[l.id]) continue;
    const k = [it.id, l.id].sort().join("|"); if (vistos.has(k)) continue; vistos.add(k);
    const [x1, y1] = pos[it.id], [x2, y2] = pos[l.id];
    arestas += `<line class="edge" data-a="${it.id}" data-b="${l.id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  const nos = st.itens.map(it => {
    const [x, y, c, ang] = pos[it.id];
    if (it.tipo === "processo") {
      // Rótulo radial, apontando para fora, sempre legível (vira no lado esquerdo).
      const graus = ang * 180 / Math.PI, esq = Math.cos(ang) < 0;
      const cls = ["node", "processo", it.modulo, estudado(it.id) ? "done" : "", st.naoVistos.has(it.id) ? "novo" : ""].join(" ");
      return `<g class="${cls}" data-abrir="${it.id}" tabindex="0" role="link" aria-label="${esc(it.curto)}"><circle cx="${x}" cy="${y}" r="7"/><text transform="translate(${x},${y}) rotate(${esq ? graus + 180 : graus})" x="${esq ? -12 : 12}" y="4" text-anchor="${esq ? "end" : "start"}">${esc(it.modulo)} · ${esc(it.curto)}</text></g>`;
    }
    const lado = c > 0.25 ? "start" : c < -0.25 ? "end" : "middle";
    const dx = lado === "start" ? 14 : lado === "end" ? -14 : 0, dy = lado === "middle" ? (y < cy ? -16 : 24) : 4;
    const cls = ["node", it.tipo, estudado(it.id) ? "done" : "", st.naoVistos.has(it.id) ? "novo" : ""].join(" ");
    return `<g class="${cls}" data-abrir="${it.id}" tabindex="0" role="link" aria-label="${esc(it.curto)}"><circle cx="${x}" cy="${y}" r="${it.tipo === "semanal" ? 9 : 11}"/><text x="${x + dx}" y="${y + dy}" text-anchor="${lado}">${esc(it.curto)}</text></g>`;
  }).join("");
  svg.innerHTML = arestas + nos;
  // Enquadra o desenho no conteúdo real (rótulos incluídos) para não sobrar espaço vazio.
  const xs = Object.values(pos).map(p => p[0]), ys = Object.values(pos).map(p => p[1]);
  const m = proc.length ? 230 : 0;
  const x0 = Math.min(...xs) - 200 - m / 2, y0 = Math.min(...ys) - 40 - m, x1 = Math.max(...xs) + 200 + m / 2, y1 = Math.max(...ys) + 50 + m;
  svg.setAttribute("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
  svg.querySelectorAll(".node").forEach(g => {
    const id = g.dataset.abrir;
    const quente = on => svg.querySelectorAll(`.edge[data-a="${id}"],.edge[data-b="${id}"]`).forEach(e => e.classList.toggle("hot", on));
    g.onmouseenter = () => quente(true); g.onmouseleave = () => quente(false);
    g.onfocus = () => quente(true); g.onblur = () => quente(false);
    g.onkeydown = e => { if (e.key === "Enter") abrir(id); };
  });
}

/* ---------- anotações ---------- */
function renderAnotacoes() {
  const lista = Object.entries(st.notas).filter(([id, n]) => st.porId[id] && (n.texto || "").trim())
    .sort((a, b) => (b[1].atualizado || "").localeCompare(a[1].atualizado || ""));
  $("notelist").innerHTML = lista.length ? lista.map(([id, n]) => `<div class="nitem"><button data-abrir="${id}">${esc(st.porId[id].titulo)}</button><small>${new Date(n.atualizado).toLocaleDateString("pt-BR")}${n.estudado ? " · estudado" : ""}</small><pre>${esc(n.texto)}</pre></div>`).join("")
    : `<p class="empty">Nenhuma anotação ainda. Abra um tema e escreva no Caderno.</p>`;
}

/* ---------- configurações ---------- */
function renderConfig() {
  const c = st.config;
  $("cfg-repo").value = c.repoUrl; $("cfg-branch").value = c.branch; $("cfg-int").value = c.intervaloMin;
  $("cfg-claude").value = c.claudeCmd; $("cfg-edit").checked = !!c.permitirEdicao; $("cfg-start").checked = !!c.iniciarComWindows;
}
$("cfg").addEventListener("submit", async e => {
  e.preventDefault();
  st.config = await window.sap.salvarConfig({
    repoUrl: $("cfg-repo").value.trim(), branch: $("cfg-branch").value.trim() || "main",
    intervaloMin: Number($("cfg-int").value) || 30, claudeCmd: $("cfg-claude").value.trim() || "claude",
    permitirEdicao: $("cfg-edit").checked, iniciarComWindows: $("cfg-start").checked,
  });
  $("cfg-st").textContent = "Configurações salvas.";
  renderChatCtx();
});
$("btn-testar").onclick = async () => {
  $("cfg-claude-st").textContent = "Testando…";
  const r = await window.sap.versaoClaude();
  $("cfg-claude-st").textContent = r.ok ? `Conectado: Claude Code ${r.versao}` : r.erro;
};
$("btn-pasta").onclick = () => window.sap.abrirPastaConteudo();

/* ---------- navegação e status ---------- */
function mostrarView(v) {
  st.view = v;
  for (const b of document.querySelectorAll(".views button")) {
    if (b.dataset.view === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  }
  $("v-estudo").hidden = v !== "estudo"; $("v-mapa").hidden = v !== "mapa"; $("v-anotacoes").hidden = v !== "anotacoes"; $("v-config").hidden = v !== "config";
  if (v === "mapa") renderMapa();
  if (v === "anotacoes") renderAnotacoes();
  if (v === "config") renderConfig();
}
document.querySelectorAll(".views button").forEach(b => (b.onclick = () => mostrarView(b.dataset.view)));
document.querySelectorAll(".filters button").forEach(b => (b.onclick = () => {
  st.trilha = b.dataset.trilha;
  document.querySelectorAll(".filters button").forEach(x => x.setAttribute("aria-pressed", x === b));
  renderLista();
}));
$("busca").addEventListener("input", e => { st.busca = e.target.value; renderLista(); });

// Cliques delegados: abrir item, links externos, sugestões do chat.
document.addEventListener("click", e => {
  const a = e.target.closest("[data-abrir]");
  if (a) { fecharPop(); abrir(a.dataset.abrir); return; }
  const u = e.target.closest("[data-url]");
  if (u) { window.sap.abrirExterno(u.dataset.url); return; }
  const s = e.target.closest("[data-sugestao]");
  if (s) { enviarPergunta(s.dataset.sugestao); return; }
  if (!e.target.closest(".bellwrap")) fecharPop();
});
function fecharPop() { $("pop-novidades").hidden = true; $("btn-bell").setAttribute("aria-expanded", "false"); }
$("btn-bell").onclick = () => { const h = !$("pop-novidades").hidden; $("pop-novidades").hidden = h; $("btn-bell").setAttribute("aria-expanded", String(!h)); };
$("btn-todos-vistos").onclick = async () => { st.naoVistos = new Set(await window.sap.marcarTodosVistos()); renderSino(); renderLista(); fecharPop(); };
$("btn-sync").onclick = () => window.sap.sincronizar();

function renderStatus(b) {
  const quando = b.ultimaSync ? new Date(b.ultimaSync).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
  $("sync-status").textContent = b.origem === "repositorio" ? `Atualizado às ${quando}${b.commit ? " · " + b.commit.split(" ")[0] : ""}` : "Conteúdo embutido";
  const msg = [b.erro, b.aviso].filter(Boolean).join(" ");
  $("banner").hidden = !msg; $("banner").textContent = msg;
  $("cfg-origem").textContent = b.origem === "repositorio" ? `Usando o repositório (commit ${b.commit || "?"}).` : "Usando o conteúdo que veio com o instalador.";
}
function aplicarBiblioteca(b) {
  const antes = new Set(st.naoVistos);
  indexar(b.itens);
  st.naoVistos = new Set(b.naoVistos);
  if (!st.atual || !st.porId[st.atual]) st.atual = (b.itens.find(i => st.naoVistos.has(i.id)) || b.itens[0] || {}).id;
  renderLista(); renderSino(); renderStatus(b);
  if (st.view === "estudo") { renderItem(); renderCaderno(); renderChatCtx(); }
  if (st.view === "mapa") renderMapa();
  return [...st.naoVistos].filter(id => !antes.has(id));
}
window.sap.aoBiblioteca(aplicarBiblioteca);
window.sap.aoSync(s => { $("btn-sync").disabled = !!s.sincronizando; if (s.sincronizando) $("sync-status").textContent = "Buscando atualizações…"; });
window.sap.aoAbrir(id => abrir(id));

(async () => {
  const ini = await window.sap.inicial();
  st.notas = ini.notas || {}; st.config = ini.config || {};
  st.chat = (ini.chat || []).map(m => ({ ...m }));
  aplicarBiblioteca(ini);
  if (st.atual && st.naoVistos.has(st.atual)) abrir(st.atual);
  renderChatCtx();
})();
