# SAP Estudos

Aplicativo desktop (Windows) para estudar SAP toda sexta-feira. O conteúdo chega sozinho:
o Claude publica uma edição nova **toda sexta às 9h (Brasília)**, com um tema **funcional** e
um **técnico**, baseado no que há de mais atual no mercado. O app baixa, avisa com
notificação do Windows e marca o que você ainda não viu.

## O que tem no app

- **Leitura**: cada tema traz resumo, novidades do mercado com fonte, conceitos-chave,
  transações/apps para praticar, código comentado (trilha técnica), caso do mundo real,
  armadilhas, pergunta de fixação e fontes.
- **Novidades e notificações**: o sino mostra as edições não vistas; o Windows notifica quando
  chega conteúdo novo ou quando um item é revisado. O app fica na bandeja e verifica a cada 30 min.
- **Caderno**: anotação por tema, salva automaticamente. Escreva `[[MM — Compras]]` para criar
  link para outro tema. A aba *Anotações* junta tudo.
- **Conexões**: cada tema lista temas relacionados (e quem o cita). O *Mapa de conexões* mostra
  a trilha inteira como grafo.
- **Perguntar ao Claude**: chat ligado ao **Claude Code instalado no seu computador**, com o seu
  login. Ele lê o conteúdo do app, pesquisa na web e mantém o histórico da conversa. Em
  *Configurações* você pode liberar que ele edite o conteúdo (criar/corrigir itens, commit e push).

## Instalação (Windows)

Pré-requisitos, uma vez só:

1. **Git para Windows**: https://git-scm.com/download/win (o app usa o Git e suas credenciais do
   GitHub para baixar o conteúdo deste repositório privado).
2. **Claude Code**, para o chat: siga https://docs.claude.com/claude-code e rode `claude` uma vez
   no terminal para fazer login.

Instalador:

- **Opção A, pronto**: em *Actions → Instalador Windows → Run workflow* (ou criando uma tag `v1.0.0`),
  o GitHub gera `SAP Estudos Setup 1.0.0.exe`. Baixe em *Artifacts* (ou em *Releases* quando for tag).
- **Opção B, no seu PC** (precisa do Node.js 22):

```bash
git clone https://github.com/lguisantos/sap-estudos.git
```

```bash
cd sap-estudos
```

```bash
npm install
```

```bash
npm run dist
```

O instalador fica em `dist\`. Para rodar sem instalar: `npm start`.

Na primeira vez que o app buscar o conteúdo, o Git pode abrir a janela de login do GitHub.

## Como o conteúdo é atualizado

```
Sexta 9h ── tarefa agendada do Claude ──► pesquisa novidades ──► cria 2 itens em content/itens/
                                                                  valida (node scripts/validar.mjs)
                                                                  commit + push na main
App (bandeja) ── a cada 30 min ── git fetch ──► itens novos ──► notificação + sino
```

- Formato dos itens, regras de qualidade e plano de estudos: [`CLAUDE.md`](CLAUDE.md) e
  [`content/plano.md`](content/plano.md). Edite o plano para direcionar os próximos temas.
- O app guarda suas anotações e o que já foi visto em `%APPDATA%\SAP Estudos\estado.json`.

## Desenvolvimento

```bash
npm test
```

```bash
npm run validar
```
