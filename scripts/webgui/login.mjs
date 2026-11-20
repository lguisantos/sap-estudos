// Faz login na SAP WebGUI com as credenciais do .env e salva só a sessão (cookies) em .webgui/sessao.json.
// Assim o navegador controlado pelo Claude já abre logado e a senha nunca passa pela conversa.
//
// Uso:  node scripts/webgui/login.mjs --env "D:\caminho\.env" [--url "https://host:porta/sap/bc/gui/sap/its/webgui/?sap-client=300&sap-language=PT"] [--visivel 1] [--navegador caminho]
// O .env precisa ter um usuário e uma senha. Nomes aceitos: SAP_USER / SAP_USERNAME / USERNAME / USER e
// SAP_PASSWORD / SAP_PASS / PASSWORD / PASS (ou indique com --user-var e --pass-var).
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SAIDA = join(RAIZ, ".webgui", "sessao.json");
const URL_PADRAO = "https://10.23.10.42:44301/sap/bc/gui/sap/its/webgui/?sap-client=300&sap-language=PT";

function args() {
  const a = process.argv.slice(2), o = {};
  for (let i = 0; i < a.length; i++) if (a[i].startsWith("--")) o[a[i].slice(2)] = a[i + 1], i++;
  return o;
}

/** Lê um .env simples (CHAVE=valor, com ou sem aspas, ignora comentários). */
export function lerEnv(texto) {
  const env = {};
  for (const linha of texto.split(/\r?\n/)) {
    const m = linha.match(/^\s*(?:export\s+)?([A-Za-z_][\w.-]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    env[m[1]] = v;
  }
  return env;
}

export function credenciais(env, userVar, passVar) {
  const achar = (preferida, nomes) => {
    if (preferida) return env[preferida] !== undefined ? preferida : null;
    const k = Object.keys(env);
    for (const n of nomes) { const hit = k.find(x => x.toUpperCase() === n); if (hit) return hit; }
    return null;
  };
  const u = achar(userVar, ["SAP_USER", "SAP_USERNAME", "SAP_USUARIO", "USERNAME", "USUARIO", "USER"]);
  const p = achar(passVar, ["SAP_PASSWORD", "SAP_PASS", "SAP_SENHA", "PASSWORD", "SENHA", "PASS"]);
  return { userVar: u, passVar: p, user: u && env[u], pass: p && env[p] };
}

async function main() {
  const o = args();
  if (!o.env) throw new Error("Informe o arquivo de credenciais: --env \"D:\\...\\.env\"");
  const env = lerEnv(readFileSync(o.env, "utf8"));
  const c = credenciais(env, o["user-var"], o["pass-var"]);
  if (!c.user || !c.pass) {
    // Mostra só os NOMES das variáveis encontradas, nunca os valores.
    throw new Error(`Não achei usuário e senha no .env. Variáveis existentes: ${Object.keys(env).join(", ") || "(nenhuma)"}. Use --user-var e --pass-var.`);
  }
  const { chromium } = await import("playwright");
  // No Windows usa o Microsoft Edge já instalado (não precisa baixar navegador); --navegador aponta outro executável.
  const lanc = { headless: o.visivel ? false : true };
  if (o.navegador) lanc.executablePath = o.navegador;
  else if (process.platform === "win32") lanc.channel = "msedge";
  const navegador = await chromium.launch(lanc);
  const ctx = await navegador.newContext({ ignoreHTTPSErrors: true, locale: "pt-BR", viewport: { width: 1440, height: 900 } });
  const pagina = await ctx.newPage();
  const url = o.url || URL_PADRAO;
  await pagina.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Tela de logon do ITS: campos sap-user / sap-password e botão de logon.
  const campoUser = pagina.locator('input[name="sap-user"], #sap-user').first();
  if (await campoUser.count()) {
    await campoUser.fill(c.user);
    await pagina.locator('input[name="sap-password"], #sap-password').first().fill(c.pass);
    const botao = pagina.locator('#LOGON_BUTTON, button[type="submit"], input[type="submit"]').first();
    if (await botao.count()) await botao.click(); else await pagina.keyboard.press("Enter");
  }

  // Aviso de logon múltiplo: escolhe "continuar com este logon sem encerrar os outros" e confirma.
  await pagina.waitForLoadState("domcontentloaded").catch(() => {});
  if (await pagina.getByText(/logon múltiplo|multiple logon/i).first().isVisible().catch(() => false)) {
    const opcao = pagina.getByLabel(/sem encerrar|without ending/i).first();
    if (await opcao.count()) await opcao.check().catch(() => {});
    await pagina.locator('#MULTI_LOGON_SUBMIT_BUTTON, button[type="submit"], input[type="submit"]').first().click().catch(() => {});
  }

  // Logado quando aparece o campo de comando (OK-code) da WebGUI.
  try {
    await pagina.locator('#ToolbarOkCode, input[id*="OkCode"], input[title*="ransação"], input[title*="ransaction"]').first().waitFor({ timeout: 45000 });
  } catch {
    const erro = await pagina.locator('.urMsgBarTxt, .lsMessageBar, #ERROR_MESSAGE, .error').first().textContent().catch(() => "");
    throw new Error(`Não consegui confirmar o login. Mensagem da página: ${(erro || "").trim() || "(nenhuma)"} — rode com --visivel 1 para ver a tela.`);
  }
  mkdirSync(dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, JSON.stringify(await ctx.storageState(), null, 2));
  await navegador.close();
  console.log(`Login OK com o usuário da variável ${c.userVar}. Sessão salva em .webgui/sessao.json (não vai para o git).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(e => { console.error("Falha no login: " + e.message); process.exit(1); });
}
