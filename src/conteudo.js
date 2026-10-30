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

// Edições semanais mais novas primeiro; depois os fundamentos na ordem da trilha.
function ordenar(a, b) {
  if (a.tipo !== b.tipo) return a.tipo === "semanal" ? -1 : 1;
  if (a.tipo === "semanal") return (b.publicado || "").localeCompare(a.publicado || "") || a.trilha.localeCompare(b.trilha);
  return (a.ordem || 0) - (b.ordem || 0);
}

/**
 * Itens que contam como atualização não vista: edições semanais novas ou alteradas
 * desde a última leitura. Fundamentos nunca geram notificação.
 */
function naoVistos(itens, vistos) {
  return itens.filter(it => it.tipo === "semanal" && vistos[it.id] !== it.versao);
}

/** Itens que ainda não geraram notificação nativa (evita repetir a cada sincronização). */
function paraNotificar(itens, vistos, notificados) {
  return naoVistos(itens, vistos).filter(it => notificados[it.id] !== it.versao);
}

/**
 * Clona ou atualiza o repositório de conteúdo usando o git instalado (e as credenciais
 * que o usuário já tem configuradas). Retorna a pasta de itens a usar.
 */
async function sincronizar({ repoUrl, branch, pastaClone }) {
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
  return { pastaItens: path.join(pastaClone, "content", "itens"), commit, aviso };
}

module.exports = { carregarItens, naoVistos, paraNotificar, sincronizar, run };
