// Chat com o Claude Code instalado no computador (usa o login do próprio usuário).
const { spawn } = require("node:child_process");
const { run } = require("./conteudo");

const FERRAMENTAS_LEITURA = "Read,Grep,Glob,WebSearch,WebFetch";
const FERRAMENTAS_EDICAO = "Read,Grep,Glob,WebSearch,WebFetch,Edit,Write,Bash(git:*),Bash(node:*)";

/** Descobre o executável do Claude Code. Prefere o .exe nativo, que dispensa shell. */
async function localizarClaude(comando) {
  if (comando && comando !== "claude") return comando;
  try {
    const saida = await run(process.platform === "win32" ? "where" : "which", ["claude"]);
    const linhas = saida.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return linhas.find(l => /\.exe$/i.test(l)) || linhas[0] || "claude";
  } catch {
    return "claude";
  }
}

function argumentos({ sessao, permitirEdicao }) {
  const args = ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages",
    "--allowedTools", permitirEdicao ? FERRAMENTAS_EDICAO : FERRAMENTAS_LEITURA];
  if (permitirEdicao) args.push("--permission-mode", "acceptEdits");
  if (sessao) args.push("--resume", sessao);
  return args;
}

/**
 * Interpreta uma linha do stream-json do Claude Code e devolve eventos simples para a UI:
 * {tipo:"texto", delta} | {tipo:"ferramenta", nome} | {tipo:"sessao", id} | {tipo:"fim", texto, erro}
 */
function interpretarLinha(linha, estado) {
  let ev;
  try { ev = JSON.parse(linha); } catch { return []; }
  const out = [];
  if (ev.session_id && ev.session_id !== estado.sessao) {
    estado.sessao = ev.session_id;
    out.push({ tipo: "sessao", id: ev.session_id });
  }
  if (ev.type === "stream_event" && ev.event) {
    const e = ev.event;
    if (e.type === "content_block_delta" && e.delta && e.delta.type === "text_delta") {
      out.push({ tipo: "texto", delta: separar(estado) + e.delta.text });
      estado.recebeuDelta = true;
    }
    if (e.type === "message_start") { estado.recebeuDelta = false; estado.novaMensagem = true; }
  } else if (ev.type === "assistant" && ev.message && Array.isArray(ev.message.content)) {
    for (const b of ev.message.content) {
      if (b.type === "tool_use") out.push({ tipo: "ferramenta", nome: b.name });
      if (b.type === "text" && !estado.recebeuDelta && b.text) out.push({ tipo: "texto", delta: separar(estado) + b.text });
    }
  } else if (ev.type === "result") {
    out.push({ tipo: "fim", texto: ev.result || "", erro: !!ev.is_error });
  }
  return out;
}

// Respostas com várias mensagens (texto, ferramenta, texto) ganham um parágrafo entre elas.
function separar(estado) {
  const sep = estado.novaMensagem && estado.teveTexto ? "\n\n" : "";
  estado.novaMensagem = false;
  estado.teveTexto = true;
  return sep;
}

/** Envia uma pergunta. A mensagem vai pelo stdin, então nenhum texto do usuário passa pelo shell. */
async function perguntar({ comando, cwd, sessao, permitirEdicao, mensagem, aoEvento }) {
  const exe = await localizarClaude(comando);
  const usarShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(exe);
  const args = argumentos({ sessao, permitirEdicao }).map(a => (usarShell && /[\s(),*]/.test(a) ? `"${a}"` : a));
  const filho = spawn(usarShell ? `"${exe}"` : exe, args, { cwd, shell: usarShell, windowsHide: true, env: process.env });
  const estado = { sessao, recebeuDelta: false };
  let resto = "";
  let erroTxt = "";
  let terminou = false;

  filho.stdout.on("data", buf => {
    resto += buf.toString("utf8");
    const linhas = resto.split(/\r?\n/);
    resto = linhas.pop();
    for (const l of linhas) for (const ev of interpretarLinha(l, estado)) {
      if (ev.tipo === "fim") terminou = true;
      aoEvento(ev);
    }
  });
  filho.stderr.on("data", buf => { erroTxt += buf.toString("utf8"); });
  filho.on("error", e => {
    terminou = true;
    aoEvento({ tipo: "fim", erro: true, texto: e.code === "ENOENT"
      ? "Não encontrei o Claude Code. Instale com `npm install -g @anthropic-ai/claude-code` (ou o instalador nativo) e faça login rodando `claude` uma vez no terminal. Depois confira o caminho em Configurações."
      : `Falha ao iniciar o Claude Code: ${e.message}` });
  });
  filho.on("close", code => {
    if (resto) for (const ev of interpretarLinha(resto, estado)) { if (ev.tipo === "fim") terminou = true; aoEvento(ev); }
    if (!terminou) aoEvento({ tipo: "fim", erro: code !== 0, texto: erroTxt.trim() || (code === null ? "Resposta interrompida." : `O Claude Code terminou com código ${code}.`) });
  });
  filho.stdin.end(mensagem, "utf8");
  return () => { try { filho.kill(); } catch {} };
}

async function versao(comando) {
  const exe = await localizarClaude(comando);
  const usarShell = process.platform === "win32" && /\.(cmd|bat)$/i.test(exe);
  return (await run(usarShell ? `"${exe}"` : exe, ["--version"], { shell: usarShell, timeout: 20000 })).trim();
}

module.exports = { perguntar, versao, interpretarLinha, argumentos, localizarClaude };
