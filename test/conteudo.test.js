const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const c = require("../src/conteudo");

const ITENS = path.join(__dirname, "..", "content", "itens");

test("carrega itens e ordena semanais antes dos fundamentos", () => {
  const { itens, erros } = c.carregarItens(ITENS);
  assert.deepStrictEqual(erros, []);
  assert.ok(itens.length >= 14);
  assert.strictEqual(itens[0].tipo, "semanal");
  const fund = itens.filter(i => i.tipo === "fundamentos").map(i => i.ordem);
  assert.deepStrictEqual(fund, [...fund].sort((a, b) => a - b));
  assert.ok(itens.every(i => /^[0-9a-f]{12}$/.test(i.versao)));
});

test("não vistos: só semanais, e voltam a aparecer quando o conteúdo muda", () => {
  const { itens } = c.carregarItens(ITENS);
  const sem = itens.filter(i => i.tipo === "semanal");
  assert.deepStrictEqual(c.naoVistos(itens, {}).map(i => i.id), sem.map(i => i.id));
  const vistos = Object.fromEntries(itens.map(i => [i.id, i.versao]));
  assert.strictEqual(c.naoVistos(itens, vistos).length, 0);
  vistos[sem[0].id] = "versao-antiga";
  assert.deepStrictEqual(c.naoVistos(itens, vistos).map(i => i.id), [sem[0].id]);
});

test("notifica cada versão uma única vez", () => {
  const { itens } = c.carregarItens(ITENS);
  const notificados = {};
  const primeira = c.paraNotificar(itens, {}, notificados);
  for (const i of primeira) notificados[i.id] = i.versao;
  assert.strictEqual(c.paraNotificar(itens, {}, notificados).length, 0);
});

test("sincroniza: clona, recebe edição nova e preserva alterações locais", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sapest-"));
  const git = (cwd, ...a) => execFileSync("git", a, { cwd, stdio: "pipe" }).toString();
  const origem = path.join(tmp, "origem");
  fs.mkdirSync(path.join(origem, "content", "itens"), { recursive: true });
  git(origem, "init", "-q", "-b", "main");
  git(origem, "config", "user.email", "t@t"); git(origem, "config", "user.name", "t");
  fs.copyFileSync(path.join(ITENS, "base-mm.json"), path.join(origem, "content", "itens", "base-mm.json"));
  git(origem, "add", "."); git(origem, "commit", "-qm", "1");

  const clone = path.join(tmp, "app", "conteudo");
  let r = await c.sincronizar({ repoUrl: origem, branch: "main", pastaClone: clone });
  assert.strictEqual(c.carregarItens(r.pastaItens).itens.length, 1);

  const novo = path.join(ITENS, "2026-10-30-tecnico-joule-abap.json");
  fs.copyFileSync(novo, path.join(origem, "content", "itens", path.basename(novo)));
  git(origem, "add", "."); git(origem, "commit", "-qm", "2");
  r = await c.sincronizar({ repoUrl: origem, branch: "main", pastaClone: clone });
  assert.strictEqual(c.carregarItens(r.pastaItens).itens.length, 2);
  assert.strictEqual(r.aviso, "");

  // Alteração local não enviada: a sincronização não pode apagar.
  fs.appendFileSync(path.join(clone, "content", "itens", "base-mm.json"), "\n");
  fs.writeFileSync(path.join(origem, "x.txt"), "x"); git(origem, "add", "."); git(origem, "commit", "-qm", "3");
  r = await c.sincronizar({ repoUrl: origem, branch: "main", pastaClone: clone });
  assert.ok(r.aviso.includes("alterações locais"));
  assert.ok(fs.readFileSync(path.join(clone, "content", "itens", "base-mm.json"), "utf8").endsWith("\n\n"));
  fs.rmSync(tmp, { recursive: true, force: true });
});
