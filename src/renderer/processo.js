// Renderização de conteúdos do tipo "processo": ilustração em raias, cadeia de documentos e fluxo detalhado.
(function () {
  const esc = window.escapeHtml;

  // Quebra um texto em até `max` linhas de ~`largura` caracteres, com reticências no fim.
  // `primeira` permite uma primeira linha mais curta (quando divide espaço com o número do passo).
  function quebrar(texto, largura, max, primeira = largura) {
    const palavras = String(texto).split(/\s+/);
    const linhas = [];
    let atual = "";
    for (const p of palavras) {
      const lim = linhas.length ? largura : primeira;
      if ((atual + " " + p).trim().length > lim && atual) { linhas.push(atual); atual = p; }
      else atual = (atual + " " + p).trim();
    }
    if (atual) linhas.push(atual);
    if (linhas.length > max) {
      const cortadas = linhas.slice(0, max);
      cortadas[max - 1] = cortadas[max - 1].replace(/.{0,2}$/, "") + "…";
      return cortadas;
    }
    return linhas;
  }
  const cortar = (t, n) => (String(t).length > n ? String(t).slice(0, n - 1) + "…" : String(t));

  /** Diagrama de raias vertical: uma coluna por papel (quem executa), um bloco por passo, de cima para baixo. */
  function raias(fluxo) {
    const papeis = [...new Set(fluxo.map(p => p.papel))];
    const LW = 160, HEAD = 46, RH = 104, BW = 140, BH = 84;
    const W = papeis.length * LW, H = HEAD + fluxo.length * RH + 8;
    const pos = fluxo.map((p, i) => {
      const lane = papeis.indexOf(p.papel);
      return { x: lane * LW + (LW - BW) / 2, y: HEAD + i * RH + (RH - BH) / 2, lane };
    });
    let s = `<svg class="raias" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Fluxo do processo em raias por responsável">
      <defs><marker id="seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="seta-ponta"/></marker></defs>`;
    papeis.forEach((papel, k) => {
      s += `<rect class="raia${k % 2 ? " alt" : ""}" x="${k * LW}" y="0" width="${LW}" height="${H}"/>`;
      const ls = quebrar(papel, 20, 2);
      s += `<text class="raia-rotulo" x="${k * LW + LW / 2}" y="${ls.length > 1 ? 18 : 27}" text-anchor="middle">${ls.map((l, j) => `<tspan x="${k * LW + LW / 2}" dy="${j ? 15 : 0}">${esc(l)}</tspan>`).join("")}</text>`;
    });
    s += `<line class="raia-div" x1="0" y1="${HEAD - 4}" x2="${W}" y2="${HEAD - 4}"/>`;
    for (let i = 0; i < fluxo.length - 1; i++) {
      const a = pos[i], b = pos[i + 1];
      const x1 = a.x + BW / 2, y1 = a.y + BH, x2 = b.x + BW / 2, y2 = b.y;
      const my = (y1 + y2) / 2;
      s += a.lane === b.lane
        ? `<path class="seta" d="M${x1},${y1} V${y2 - 2}" marker-end="url(#seta)"/>`
        : `<path class="seta" d="M${x1},${y1} V${my} H${x2} V${y2 - 2}" marker-end="url(#seta)"/>`;
    }
    fluxo.forEach((p, i) => {
      const { x, y } = pos[i];
      const tl = quebrar(p.titulo, 19, 3, 14);
      s += `<g class="raia-passo" data-passo="${i}" tabindex="0" role="link" aria-label="Passo ${i + 1}: ${esc(p.titulo)}">
        <rect x="${x}" y="${y}" width="${BW}" height="${BH}" rx="8"/>
        <circle cx="${x + 14}" cy="${y + 15}" r="9.5"/><text class="num" x="${x + 14}" y="${y + 19}" text-anchor="middle">${i + 1}</text>
        <text class="tit" x="${x + 29}" y="${y + 20}">${tl.map((l, j) => `<tspan x="${x + (j ? 9 : 29)}" dy="${j ? 15 : 0}">${esc(l)}</tspan>`).join("")}</text>
        <text class="tx" x="${x + 9}" y="${y + BH - 10}">${esc(cortar(p.transacao, 19))}</text>
      </g>`;
    });
    return s + "</svg>";
  }

  /** Cadeia de documentos: o que o processo cria, na ordem, com as tabelas onde fica gravado. */
  function documentos(docs) {
    return `<div class="docchain">${docs.map((d, i) => `${i ? '<span class="docarrow" aria-hidden="true">→</span>' : ""}
      <div class="doc"><b>${esc(d.nome)}</b>${d.tabelas ? `<code>${esc(d.tabelas)}</code>` : ""}<p>${esc(d.descricao)}</p>${d.exemplo ? `<small>${esc(d.exemplo)}</small>` : ""}</div>`).join("")}</div>`;
  }

  function fluxoDetalhado(fluxo) {
    return `<ol class="fluxo">${fluxo.map((p, i) => `<li id="passo-${i}">
      <div class="ph"><span class="pn">${i + 1}</span><div><b>${esc(p.titulo)}</b>
        <div class="pmeta"><span class="papel">${esc(p.papel)}</span><code>${esc(p.transacao)}</code></div></div></div>
      <p>${esc(p.descricao)}</p>
      <ul class="plain">${p.detalhes.map(d => `<li>${esc(d)}</li>`).join("")}</ul>
      <p class="res"><b>Resultado:</b> ${esc(p.resultado)}</p>
      ${p.exemplo ? `<div class="ex"><b>Exemplo:</b> ${esc(p.exemplo)}</div>` : ""}
    </li>`).join("")}</ol>`;
  }

  /** Corpo completo de um processo (depois do cabeçalho), usando o mesmo construtor de seções do leitor. */
  // Reaproveitado pelos diagramas de fluxo dos outros tipos de tema.
  window.desenharRaias = raias;

  window.renderProcesso = function (it, sec) {
    let h = sec("O fluxo em uma imagem", `<p class="hint">Cada faixa é um responsável; clique num passo para ir à explicação.</p><div class="raias-box">${raias(it.fluxo)}</div>`);
    h += sec("Quando usar", `<ul class="plain">${it.quando.map(q => `<li>${esc(q)}</li>`).join("")}</ul>`);
    h += sec("Pré-requisitos", `<ul class="plain">${it.prerequisitos.map(q => `<li>${esc(q)}</li>`).join("")}</ul>`);
    h += sec("Fluxo completo, passo a passo", fluxoDetalhado(it.fluxo));
    h += sec("Documentos gerados", documentos(it.documentos));
    h += sec("Conceitos-chave", `<dl class="terms">${it.conceitos.map(c => `<dt>${esc(c.termo)}</dt><dd>${esc(c.explicacao)}</dd>`).join("")}</dl>`);
    h += sec("Transações e apps", `<div class="tcodes">${it.transacoes.map(t => `<div class="tc"><code>${esc(t.codigo)}</code><span>${esc(t.descricao)}</span></div>`).join("")}</div>`);
    h += sec("Configuração (Customizing)", `<dl class="terms cfgl">${it.configuracao.map(c => `<dt>${esc(c.item)}<code>${esc(c.onde)}</code></dt><dd>${esc(c.explicacao)}</dd>`).join("")}</dl>`);
    if (it.integracao && it.integracao.length) h += sec("Integração com outros módulos", `<dl class="terms">${it.integracao.map(c => `<dt>${esc(c.com)}</dt><dd>${esc(c.explicacao)}</dd>`).join("")}</dl>`);
    if (it.variantes && it.variantes.length) h += sec("Variantes do processo", `<dl class="terms">${it.variantes.map(c => `<dt>${esc(c.nome)}</dt><dd>${esc(c.explicacao)}</dd>`).join("")}</dl>`);
    h += sec("Exemplo completo", `<div class="case"><p class="who">${esc(it.caso.titulo)}</p><p>${esc(it.caso.contexto)}</p><ol>${it.caso.passos.map(p => `<li>${esc(p)}</li>`).join("")}</ol></div>`);
    h += sec("Armadilhas comuns", `<ul class="plain">${it.armadilhas.map(a => `<li>${esc(a)}</li>`).join("")}</ul>`);
    return h;
  };

  // Clique ou Enter num bloco do diagrama leva à explicação do passo.
  document.addEventListener("click", e => {
    const g = e.target.closest(".raia-passo");
    if (g) document.getElementById("passo-" + g.dataset.passo)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.addEventListener("keydown", e => {
    const g = e.target.closest && e.target.closest(".raia-passo");
    if (g && e.key === "Enter") document.getElementById("passo-" + g.dataset.passo)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
