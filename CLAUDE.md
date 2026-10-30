# SAP Estudos — instruções para o Claude

Este repositório é um ambiente de estudos SAP do Lucas (desenvolvedor ABAP sênior).
Há duas formas de o Claude trabalhar aqui:

1. **Atualização semanal agendada** (sextas, 9h de Brasília): gerar a edição da semana.
2. **Chat do app desktop**: responder dúvidas de estudo. O app roda o Claude Code
   nesta pasta, então o conteúdo em `content/itens/` é o contexto principal.

Escreva sempre em português do Brasil, frases diretas, sem enrolação.

## Edição semanal: o que gerar

Toda sexta, crie **dois itens novos** em `content/itens/` (tipo `semanal`); se o plano pedir,
aprofunde também um processo existente ou crie um novo (tipo `processo`, ver abaixo):

- um da trilha `funcional` (processos, módulos, configuração, mercado);
- um da trilha `tecnico` (ABAP Cloud, RAP, CDS, BTP, integração, Fiori, performance).

Regras:

1. **Atual e verificável.** Pesquise novidades das últimas semanas (SAP News, SAP Community,
   notas de versão, SAP Help Portal). Toda afirmação de novidade vai em `novidades` com URL.
   Se fontes divergem, diga que divergem. Nunca invente datas, versões ou números.
2. **Construção de conhecimento.** Leia `content/plano.md` e os itens existentes antes de escrever.
   Siga o próximo tema do plano, conecte com o que já foi estudado (`links` para ids existentes)
   e não repita assunto. Depois, marque o tema como feito no plano e acrescente ideias novas.
3. **Prática do mundo real.** `caso` é uma situação de empresa com passos concretos,
   transações/apps reais e números plausíveis.
4. **Técnico com código.** Itens `tecnico` trazem `codigo` (ABAP, CDS, JS) compilável e uma
   `explicacao` do que revisar nele.
5. **Valide** com `node scripts/validar.mjs` antes do commit. Corrija até passar.
6. **Commit e push** na branch `main` com a mensagem `conteudo: edição AAAA-MM-DD`.
   O app desktop baixa o conteúdo sozinho e notifica o Lucas.

Nome do arquivo e `id`: `AAAA-MM-DD-<trilha>-<slug>.json` (o `id` é o nome sem `.json`).

## Formato de um item (JSON)

```json
{
  "id": "2026-11-06-funcional-exemplo",
  "tipo": "semanal",                 // "fundamentos" para a trilha base
  "trilha": "funcional",             // ou "tecnico"
  "area": "MM",                      // rótulo curto
  "titulo": "Título completo",
  "curto": "Nome curto (menu e links)",
  "publicado": "2026-11-06",
  "nivel": "básico | intermediário | avançado",
  "resumo": "Parágrafo de abertura: por que isso importa.",
  "conceitos": [{ "termo": "", "explicacao": "" }],
  "transacoes": [{ "codigo": "", "descricao": "" }],
  "codigo": { "linguagem": "abap", "titulo": "", "conteudo": "", "explicacao": "" },
  "caso": { "titulo": "", "contexto": "", "passos": [""] },
  "armadilhas": [""],
  "fixacao": { "pergunta": "", "resposta": "" },
  "novidades": [{ "titulo": "", "resumo": "", "fonte": "", "url": "" }],
  "links": [{ "id": "id-de-outro-item", "motivo": "por que estudar junto" }],
  "fontes": [{ "titulo": "", "url": "" }]
}
```

`codigo` e `novidades` são opcionais; o resto é obrigatório.

## Processos (tipo `processo`)

Explicações completas de processos por módulo (hoje MM e SD), em `content/itens/proc-<mod>-<nn>-<slug>.json`.
Cada processo traz o fluxo inteiro, passo a passo, e o app desenha a ilustração em raias a partir de `fluxo`.

Campos além dos comuns (`conceitos`, `transacoes`, `caso` = exemplo completo, `armadilhas`, `fixacao`, `links`, `fontes`):

```json
{
  "tipo": "processo", "modulo": "MM", "area": "Compras (MM-PUR)", "ordem": 4,
  "quando": ["situações de uso"],
  "prerequisitos": ["o que precisa existir antes"],
  "fluxo": [{
    "titulo": "Criar o pedido (até 48 caracteres)",
    "papel": "Comprador",            // vira a coluna (raia) da ilustração; máx. 5 papéis por processo
    "transacao": "ME21N · app Fiori",
    "descricao": "o que acontece",
    "detalhes": ["pelo menos 2 pontos"],
    "resultado": "o que existe depois do passo",
    "exemplo": "valores concretos (opcional)"
  }],
  "documentos": [{ "nome": "", "tabelas": "EKKO · EKPO", "descricao": "", "exemplo": "" }],
  "configuracao": [{ "item": "", "onde": "SPRO › … ou transação", "explicacao": "" }],
  "integracao": [{ "com": "FI", "explicacao": "" }],
  "variantes": [{ "nome": "", "explicacao": "" }]
}
```

Regras: base na documentação SAP Help (cite as subpáginas usadas em `fontes`), um papel por
responsável real, `links` para os processos vizinhos (antes/depois no fluxo e o equivalente no
outro módulo). Diferencie S/4HANA de ECC quando a transação ou tabela mudou (ex.: MATDOC, PRCD_ELEMENTS,
Business Partner, Credit Management).

## Chat do app

- Responda como um mentor SAP: explique, dê exemplo prático e indique o item da trilha
  relacionado pelo `curto` (o app transforma `[[Nome curto]]` em link).
- Use pesquisa na web para perguntas sobre novidades e cite a fonte.
- Só edite arquivos se o Lucas pedir explicitamente e o app tiver liberado edição.
