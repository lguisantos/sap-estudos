// Processo principal: janela, bandeja, sincronização periódica, notificações e chat.
const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const conteudo = require("./conteudo");
const claude = require("./claude");

const APP_ID = "br.lguisantos.sapestudos";
const PADRAO = {
  repoUrl: "https://github.com/lguisantos/sap-estudos.git",
  branch: "main",
  intervaloMin: 30,
  claudeCmd: "claude",
  permitirEdicao: false,
  iniciarComWindows: true,
};

let janela = null;
let bandeja = null;
let saindo = false;
let timer = null;
let pararChat = null;

const dados = () => app.getPath("userData");
const arqEstado = () => path.join(dados(), "estado.json");
const pastaClone = () => path.join(dados(), "conteudo");
const pastaEmbutida = path.join(__dirname, "..", "content", "itens");

/* ---------- estado persistido ---------- */
let estado = { config: { ...PADRAO }, vistos: {}, notificados: {}, notas: {}, chat: [], sessaoChat: null };
function lerEstado() {
  try {
    const e = JSON.parse(fs.readFileSync(arqEstado(), "utf8"));
    estado = { ...estado, ...e, config: { ...PADRAO, ...(e.config || {}) } };
  } catch { /* primeira execução */ }
}
let gravando = null;
function salvarEstado() {
  clearTimeout(gravando);
  gravando = setTimeout(() => {
    const tmp = arqEstado() + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(estado, null, 2));
    fs.renameSync(tmp, arqEstado());
  }, 300);
}

/* ---------- conteúdo ---------- */
let biblioteca = { itens: [], origem: "embutido", commit: "", ultimaSync: null, erro: "", aviso: "" };

function carregar(pasta, origem) {
  const { itens, erros } = conteudo.carregarItens(pasta);
  if (!itens.length) return false;
  // Fundamentos não contam como novidade: marcados como vistos na primeira leitura.
  for (const it of itens) if (it.tipo !== "semanal" && !estado.vistos[it.id]) estado.vistos[it.id] = it.versao;
  biblioteca = { ...biblioteca, itens, origem, erro: erros.length ? `Itens ignorados: ${erros.join("; ")}` : "" };
  return true;
}

async function sincronizar(manual = false) {
  enviar("sync:status", { sincronizando: true });
  try {
    const r = await conteudo.sincronizar({ repoUrl: estado.config.repoUrl, branch: estado.config.branch, pastaClone: pastaClone() });
    if (!carregar(r.pastaItens, "repositorio")) carregar(pastaEmbutida, "embutido");
    biblioteca.commit = r.commit;
    biblioteca.aviso = r.aviso;
  } catch (e) {
    const clonado = path.join(pastaClone(), "content", "itens");
    if (!carregar(clonado, "repositorio")) carregar(pastaEmbutida, "embutido");
    const msg = (e.stderr || e.message || "").trim().split("\n").pop();
    biblioteca.erro = e.code === "ENOENT"
      ? "Git não encontrado. Instale o Git para Windows para receber as atualizações."
      : `Não consegui baixar o conteúdo novo: ${msg}`;
  }
  biblioteca.ultimaSync = new Date().toISOString();
  salvarEstado();
  notificarNovos();
  atualizarBandeja();
  enviar("biblioteca", resumo());
  enviar("sync:status", { sincronizando: false, manual });
}

function notificarNovos() {
  const novos = conteudo.paraNotificar(biblioteca.itens, estado.vistos, estado.notificados);
  if (!novos.length) return;
  for (const it of novos) estado.notificados[it.id] = it.versao;
  salvarEstado();
  if (!Notification.isSupported()) return;
  const n = novos.length === 1
    ? new Notification({ title: `Novo conteúdo SAP · ${rotuloTrilha(novos[0].trilha)}`, body: novos[0].titulo })
    : new Notification({ title: `${novos.length} conteúdos SAP novos`, body: novos.map(i => `• ${i.curto}`).join("\n") });
  n.on("click", () => { mostrar(); enviar("abrir", novos[0].id); });
  n.show();
  if (janela && !janela.isFocused()) janela.flashFrame(true);
}

const rotuloTrilha = t => (t === "tecnico" ? "Técnico" : "Funcional");

function resumo() {
  return {
    itens: biblioteca.itens,
    naoVistos: conteudo.naoVistos(biblioteca.itens, estado.vistos).map(i => i.id),
    origem: biblioteca.origem,
    commit: biblioteca.commit,
    ultimaSync: biblioteca.ultimaSync,
    erro: biblioteca.erro,
    aviso: biblioteca.aviso,
  };
}

function agendar() {
  clearInterval(timer);
  const min = Math.max(5, Number(estado.config.intervaloMin) || 30);
  timer = setInterval(() => sincronizar(false), min * 60000);
}

/* ---------- janela e bandeja ---------- */
function enviar(canal, payload) {
  if (janela && !janela.isDestroyed()) janela.webContents.send(canal, payload);
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1400, height: 900, minWidth: 900, minHeight: 600,
    title: "SAP Estudos",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    backgroundColor: "#eef1f0",
    show: false,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  janela.removeMenu();
  janela.loadFile(path.join(__dirname, "renderer", "index.html"));
  janela.once("ready-to-show", () => { if (!process.argv.includes("--oculto")) janela.show(); });
  janela.on("focus", () => janela.flashFrame(false));
  // Fechar a janela mantém o app na bandeja para continuar recebendo atualizações.
  janela.on("close", e => { if (!saindo) { e.preventDefault(); janela.hide(); } });
  // Links externos (fontes, documentação) abrem no navegador padrão.
  janela.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  janela.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
}

function mostrar() {
  if (!janela) criarJanela();
  janela.show();
  if (janela.isMinimized()) janela.restore();
  janela.focus();
}

function atualizarBandeja() {
  if (!bandeja) return;
  const n = conteudo.naoVistos(biblioteca.itens, estado.vistos).length;
  bandeja.setToolTip(n ? `SAP Estudos · ${n} novidade(s) não vista(s)` : "SAP Estudos");
  bandeja.setContextMenu(Menu.buildFromTemplate([
    { label: n ? `Abrir (${n} novidade${n > 1 ? "s" : ""})` : "Abrir", click: mostrar },
    { label: "Buscar atualizações agora", click: () => sincronizar(true) },
    { type: "separator" },
    { label: "Sair", click: () => { saindo = true; app.quit(); } },
  ]));
}

/* ---------- IPC ---------- */
ipcMain.handle("estado:inicial", () => ({
  ...resumo(),
  notas: estado.notas,
  config: estado.config,
  chat: estado.chat,
  temSessaoChat: !!estado.sessaoChat,
  versaoApp: app.getVersion(),
}));
ipcMain.handle("sync:agora", () => sincronizar(true));
ipcMain.handle("item:visto", (_e, id) => {
  const it = biblioteca.itens.find(i => i.id === id);
  if (it && estado.vistos[id] !== it.versao) {
    estado.vistos[id] = it.versao;
    salvarEstado();
    atualizarBandeja();
  }
  return resumo().naoVistos;
});
ipcMain.handle("itens:marcarTodosVistos", () => {
  for (const it of biblioteca.itens) estado.vistos[it.id] = it.versao;
  salvarEstado();
  atualizarBandeja();
  return [];
});
ipcMain.handle("nota:salvar", (_e, id, nota) => {
  estado.notas[id] = { ...nota, atualizado: new Date().toISOString() };
  salvarEstado();
  return estado.notas[id];
});
ipcMain.handle("config:salvar", (_e, cfg) => {
  const antes = estado.config;
  estado.config = { ...PADRAO, ...antes, ...cfg };
  salvarEstado();
  aplicarInicioAutomatico();
  agendar();
  if (antes.repoUrl !== estado.config.repoUrl || antes.branch !== estado.config.branch) sincronizar(true);
  return estado.config;
});
ipcMain.handle("claude:versao", async () => {
  try { return { ok: true, versao: await claude.versao(estado.config.claudeCmd) }; }
  catch (e) { return { ok: false, erro: e.code === "ENOENT" ? "Claude Code não encontrado." : (e.stderr || e.message) }; }
});
ipcMain.handle("chat:enviar", async (_e, { texto, itemId }) => {
  if (pararChat) return { ok: false, erro: "Aguarde a resposta anterior." };
  const it = biblioteca.itens.find(i => i.id === itemId);
  const contexto = it
    ? `[Contexto do app SAP Estudos: o Lucas está lendo "${it.titulo}" (arquivo content/itens/${it.id}.json, trilha ${rotuloTrilha(it.trilha)}). Ao citar itens da trilha, use [[nome curto]].]\n\n`
    : "[Contexto do app SAP Estudos. Ao citar itens da trilha, use [[nome curto]].]\n\n";
  estado.chat.push({ papel: "eu", texto, em: new Date().toISOString(), itemId: itemId || null });
  const resposta = { papel: "claude", texto: "", em: new Date().toISOString() };
  estado.chat.push(resposta);
  estado.chat = estado.chat.slice(-300);
  salvarEstado();
  const cwd = fs.existsSync(path.join(pastaClone(), ".git")) ? pastaClone() : dados();
  pararChat = await claude.perguntar({
    comando: estado.config.claudeCmd,
    cwd,
    sessao: estado.sessaoChat,
    permitirEdicao: !!estado.config.permitirEdicao,
    mensagem: contexto + texto,
    aoEvento: ev => {
      if (ev.tipo === "sessao") { estado.sessaoChat = ev.id; }
      if (ev.tipo === "texto") resposta.texto += ev.delta;
      if (ev.tipo === "fim") {
        if (!resposta.texto && ev.texto) resposta.texto = ev.texto;
        if (ev.erro) resposta.erro = true;
        pararChat = null;
        salvarEstado();
        // Com edição liberada, o Claude pode ter alterado o conteúdo: recarrega.
        if (estado.config.permitirEdicao) { carregar(path.join(pastaClone(), "content", "itens"), "repositorio"); enviar("biblioteca", resumo()); }
      }
      enviar("chat:evento", ev);
    },
  });
  return { ok: true };
});
ipcMain.handle("chat:parar", () => { if (pararChat) pararChat(); pararChat = null; return true; });
ipcMain.handle("chat:nova", () => { estado.chat = []; estado.sessaoChat = null; salvarEstado(); return true; });
// O selo numérico da barra de tarefas é desenhado pela interface (canvas → PNG).
ipcMain.handle("selo", (_e, dataUrl, n) => {
  if (!janela || process.platform !== "win32") return;
  janela.setOverlayIcon(dataUrl ? nativeImage.createFromDataURL(dataUrl) : null, n ? `${n} novidades` : "");
});
ipcMain.handle("abrir:externo", (_e, url) => { if (/^https?:/.test(url)) shell.openExternal(url); });
ipcMain.handle("abrir:pastaConteudo", () => shell.openPath(fs.existsSync(pastaClone()) ? pastaClone() : dados()));

function aplicarInicioAutomatico() {
  if (process.platform !== "win32" || !app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: !!estado.config.iniciarComWindows, args: ["--oculto"] });
}

/* ---------- ciclo de vida ---------- */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", mostrar);
  app.whenReady().then(() => {
    app.setAppUserModelId(APP_ID);
    lerEstado();
    carregar(fs.existsSync(path.join(pastaClone(), "content", "itens")) ? path.join(pastaClone(), "content", "itens") : pastaEmbutida,
      fs.existsSync(path.join(pastaClone(), "content", "itens")) ? "repositorio" : "embutido");
    criarJanela();
    bandeja = new Tray(nativeImage.createFromPath(path.join(__dirname, "..", "build", "tray.png")));
    bandeja.on("click", mostrar);
    atualizarBandeja();
    aplicarInicioAutomatico();
    agendar();
    setTimeout(() => sincronizar(false), 1500);
  });
  app.on("before-quit", () => { saindo = true; });
  app.on("window-all-closed", () => { /* continua na bandeja */ });
}
