const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cl = require("../src/claude");

test("interpreta stream-json sem duplicar texto", () => {
  const st = { sessao: null, recebeuDelta: false };
  const linhas = [
    { type: "system", subtype: "init", session_id: "s1" },
    { type: "stream_event", session_id: "s1", event: { type: "message_start" } },
    { type: "stream_event", session_id: "s1", event: { type: "content_block_delta", delta: { type: "text_delta", text: "Olá" } } },
    { type: "assistant", session_id: "s1", message: { content: [{ type: "text", text: "Olá" }, { type: "tool_use", name: "WebSearch" }] } },
    { type: "result", session_id: "s1", result: "Olá", is_error: false },
  ];
  const evs = linhas.flatMap(l => cl.interpretarLinha(JSON.stringify(l), st));
  assert.deepStrictEqual(evs, [
    { tipo: "sessao", id: "s1" },
    { tipo: "texto", delta: "Olá" },
    { tipo: "ferramenta", nome: "WebSearch" },
    { tipo: "fim", texto: "Olá", erro: false },
  ]);
  assert.deepStrictEqual(cl.interpretarLinha("não é json", st), []);
});

test("separa mensagens consecutivas com parágrafo", () => {
  const st = { sessao: "s", recebeuDelta: false };
  const d = t => ({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: t } } });
  const ini = { type: "stream_event", event: { type: "message_start" } };
  const txt = [ini, d("Vou conferir."), ini, d("MIRO")].flatMap(l => cl.interpretarLinha(JSON.stringify(l), st)).map(e => e.delta).join("");
  assert.strictEqual(txt, "Vou conferir.\n\nMIRO");
});

test("sem deltas parciais, usa o texto da mensagem completa", () => {
  const st = { sessao: "s1", recebeuDelta: false };
  const evs = cl.interpretarLinha(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Resposta" }] } }), st);
  assert.deepStrictEqual(evs, [{ tipo: "texto", delta: "Resposta" }]);
});

test("argumentos: leitura por padrão, edição só quando liberada, retoma sessão", () => {
  const a = cl.argumentos({ sessao: null, permitirEdicao: false });
  assert.ok(a.includes("Read,Grep,Glob,WebSearch,WebFetch"));
  assert.ok(!a.join(" ").includes("Edit"));
  const b = cl.argumentos({ sessao: "abc", permitirEdicao: true });
  assert.ok(b.join(" ").includes("Edit,Write"));
  assert.deepStrictEqual(b.slice(-2), ["--resume", "abc"]);
});

test("perguntar: envia a mensagem pelo stdin e repassa o stream", { skip: process.platform === "win32" }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "fakeclaude-"));
  const fake = path.join(tmp, "claude");
  fs.writeFileSync(fake, `#!/usr/bin/env node
let input = ""; process.stdin.on("data", d => input += d).on("end", () => {
  const out = o => process.stdout.write(JSON.stringify(o) + "\\n");
  out({ type: "system", subtype: "init", session_id: "fake-1" });
  out({ type: "stream_event", event: { type: "content_block_delta", delta: { type: "text_delta", text: "eco: " + input } } });
  out({ type: "result", result: "ok", is_error: false, session_id: "fake-1" });
});`);
  fs.chmodSync(fake, 0o755);
  const evs = [];
  await new Promise(resolve => cl.perguntar({ comando: fake, cwd: tmp, sessao: null, permitirEdicao: false, mensagem: "o que é OBYC? \"aspas\" $(rm -rf /)", aoEvento: e => { evs.push(e); if (e.tipo === "fim") resolve(); } }));
  assert.deepStrictEqual(evs[0], { tipo: "sessao", id: "fake-1" });
  assert.strictEqual(evs[1].delta, "eco: o que é OBYC? \"aspas\" $(rm -rf /)");
  assert.strictEqual(evs.at(-1).tipo, "fim");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("perguntar: mensagem clara quando o Claude Code não está instalado", async () => {
  const ev = await new Promise(resolve => cl.perguntar({ comando: "/caminho/inexistente/claude", cwd: os.tmpdir(), mensagem: "oi", aoEvento: e => e.tipo === "fim" && resolve(e) }));
  assert.ok(ev.erro && ev.texto.includes("Não encontrei o Claude Code"));
});
