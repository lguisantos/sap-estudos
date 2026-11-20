# Roteiro: prints da WebGUI com o Claude Code no seu PC

Faça uma vez:

1. Abra o PowerShell numa pasta de trabalho e clone o repositório (se ainda não tiver):
   `git clone https://github.com/lguisantos/sap-estudos.git` e depois `cd sap-estudos` e `npm install`.
2. Faça o login na WebGUI (a senha fica só no seu .env; o script guarda apenas a sessão):
   `node scripts/webgui/login.mjs --env "D:\OneDrive\Documentos\Clientes\Everedge\Endima\.env"`
   - Se aparecer "Não achei usuário e senha", rode de novo com `--user-var NOME --pass-var NOME`
     usando os nomes das variáveis do seu .env.
   - Para ver o navegador durante o login, acrescente `--visivel 1`.
3. Na mesma pasta, rode `claude`. Na primeira vez ele pergunta se pode usar o servidor `webgui`
   do `.mcp.json`: aprove.

Depois cole este pedido no Claude:

> Siga a seção "Prints da WebGUI" do CLAUDE.md. Comece pela trilha MM, na ordem do content/trilhas.json,
> processo por processo (proc-mm-01-requisicao primeiro). Para cada um: monte um cenário com dados que
> existam no DEV, execute na WebGUI tirando prints de cada passo, registre o que faltou configurar
> (o quê, por quê, como e a dependência) e os destaques do S/4HANA. Não altere configuração nem dados
> mestres; só crie os documentos de teste. Valide, faça commit e push a cada processo concluído e me
> mostre um resumo do que encontrou antes de passar para o próximo.

Se a sessão expirar no meio (volta a tela de logon), rode o passo 2 de novo.
