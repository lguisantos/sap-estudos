// Leitura dos itens de estudo e sincronização com o repositório de conteúdo.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 120000, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }, ...opts }, (err, stdout, stderr) => {
      if (err) { err.stderr = String(stderr || ""); reject(err); } else resolve(String(stdout));
    });
  });
}

/** Lê todos os itens JSON de uma pasta. Arquivos inválidos são ignorados e reportados. */
function carregarItens(pasta) {
  const itens = [];
  const erros = [];
  if (!fs.existsSync(pasta)) return { itens, erros: [`Pasta não encontrada: ${pasta}`] };
  for (const f of fs.readdirSync(pasta).filter(f => f.endsWith(".json"))) {
    try {
      const bruto = fs.readFileSync(path.join(pasta, f), "utf8");
      const it = JSON.parse(bruto);
      if (!it.id || !it.titulo) throw new Error("sem id ou título");
      it.versao = crypto.createHash("sha1").update(bruto).digest("hex").slice(0, 12);
      itens.push(it);
    } catch (e) {
      erros.push(`${f}: ${e.message}`);
    }
  }
  itens.sort(ordenar);
  return { itens, erros };
}

// Processos por módulo, depois edições semanais (mais novas primeiro), depois fundamentos.
const PESO = { processo: 0, semanal: 1, fundamentos: 2 };
function ordenar(a, b) {
  if (a.tipo !== b.tipo) return (PESO[a.tipo] ?? 3) - (PESO[b.tipo] ?? 3);
  if (a.tipo === "semanal") return (b.publicado || "").localeCompare(a.publicado || "") || a.trilha.localeCompare(b.trilha);
  if (a.tipo === "processo") return (a.modulo || "").localeCompare(b.modulo || "") || (a.ordem || 0) - (b.ordem || 0);
  return (a.ordem || 0) - (b.ordem || 0);
}

/**
 * Itens que contam como atualização não vista: edições semanais e processos novos ou
 * alterados desde a última leitura. Fundamentos nunca geram notificação.
 */
function naoVistos(itens, vistos) {
  return itens.filter(it => it.tipo !== "fundamentos" && vistos[it.id] !== it.versao);
}

/** Itens que ainda não geraram notificação nativa (evita repetir a cada sincronização). */
function paraNotificar(itens, vistos, notificados) {
  return naoVistos(itens, vistos).filter(it => notificados[it.id] !== it.versao);
}

/**
 * Clona ou atualiza o repositório de conteúdo usando o git instalado (e as credenciais
 * que o usuário já tem configuradas). Retorna a pasta de itens a usar.
 */
async function sincronizar({ repoUrl, branch, pastaClone, pasta = "" }) {
  const marcador = `${pastaClone}.origem`;
  const origem = `${repoUrl}#${branch}`;
  const existe = fs.existsSync(path.join(pastaClone, ".git"));
  let aviso = "";
  if (existe && fs.existsSync(marcador) && fs.readFileSync(marcador, "utf8") === origem) {
    await run("git", ["-C", pastaClone, "fetch", "origin", branch]);
    // Edições feitas pelo chat e ainda não enviadas nunca são descartadas.
    const sujo = (await run("git", ["-C", pastaClone, "status", "--porcelain", "--untracked-files=no"])).trim();
    const aFrente = Number((await run("git", ["-C", pastaClone, "rev-list", "--count", "FETCH_HEAD..HEAD"])).trim() || 0);
    if (sujo || aFrente > 0) aviso = "Há alterações locais do chat ainda não enviadas; o conteúdo novo será baixado depois do push.";
    else await run("git", ["-C", pastaClone, "reset", "--hard", "FETCH_HEAD"]);
  } else {
    fs.rmSync(pastaClone, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(pastaClone), { recursive: true });
    await run("git", ["clone", "--branch", branch, repoUrl, pastaClone]);
    fs.writeFileSync(marcador, origem);
  }
  const commit = (await run("git", ["-C", pastaClone, "log", "-1", "--format=%h %cI"])).trim();
  const raiz = path.join(pastaClone, pasta);
  return { raiz, pastaItens: path.join(raiz, "content", "itens"), commit, aviso };
}

const chave = f => crypto.createHash("sha1").update(`${f.repoUrl}#${f.branch}`).digest("hex").slice(0, 8);
const pastaDaFonte = (base, f) => `${base}-${chave(f)}`;

/**
 * Tenta cada fonte de conteúdo na ordem e usa a primeira que funcionar. Uma fonte que falhou
 * só é tentada de novo depois de `pausaMs` (evita bater num repositório que ainda não existe
 * a cada sincronização).
 */
async function sincronizarFontes({ fontes, base, falhas = {}, pausaMs = 6 * 3600000, agora = Date.now() }) {
  const erros = [];
  for (const f of fontes) {
    const k = chave(f);
    if (falhas[k] && agora - falhas[k] < pausaMs && f !== fontes[fontes.length - 1]) continue;
    try {
      const r = await sincronizar({ ...f, pastaClone: pastaDaFonte(base, f) });
      if (!fs.existsSync(r.pastaItens)) throw new Error(`pasta de conteúdo não encontrada (${path.join(f.pasta || "", "content", "itens")})`);
      delete falhas[k];
      return { ...r, fonte: f, erros };
    } catch (e) {
      falhas[k] = agora;
      erros.push(`${f.repoUrl} (${f.branch}): ${(e.stderr || e.message || "").trim().split("\n").pop()}`);
    }
  }
  const err = new Error(erros.join(" | "));
  err.erros = erros;
  throw err;
}

module.exports = { carregarItens, naoVistos, paraNotificar, sincronizar, sincronizarFontes, pastaDaFonte, run };
