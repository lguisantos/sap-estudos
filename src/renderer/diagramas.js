// Ilustrações dos temas: dependências (gerada da trilha e das conexões), fluxo em raias e hierarquia.
(function () {
  const esc = window.escapeHtml;

  function quebrar(texto, largura, max) {
    const linhas = [];
    let atual = "";
    for (const p of String(texto).split(/\s+/)) {
      if ((atual + " " + p).trim().length > largura && atual) { linhas.push(atual); atual = p; }
      else atual = (atual + " " + p).trim();
    }
    if (atual) linhas.push(atual);
    if (linhas.length > max) { const c = linhas.slice(0, max); c[max - 1] = c[max - 1].replace(/.{0,2}$/, "") + "…"; return c; }
    return linhas;
  }
  const tspans = (linhas, x, dy) => linhas.map((l, j) => `<tspan x="${x}" dy="${j ? dy : 0}">${esc(l)}</tspan>`).join("");
  const grupo = it => it.tipo === "fundamentos" ? "base" : it.tipo === "semanal" ? "semanal" : (it.modulo === "MM" || it.modulo === "SD") ? it.modulo : "outro";

  /**
   * Dependências: à esquerda o que vem antes (base necessária), no centro o tema, à direita o que ele
   * destrava. Usa a posição na trilha (etapa anterior/seguinte e conexões antes/depois dela); temas
   * conectados fora da trilha ficam numa faixa de "relacionados".
   */
  function dependencias(it, ctx) {
    const pos = ctx.posicao(it.id);
    const ordem = {};
    if (pos) ctx.etapasDa(pos.t).forEach(e => { ordem[e.item] = e.n; });
    const meu = pos ? pos.etapa.n : null;
    const conectados = new Map();
    for (const l of it.links || []) if (ctx.porId[l.id]) conectados.set(l.id, l.motivo || "");
    for (const o of ctx.itens) for (const l of o.links || []) if (l.id === it.id && !conectados.has(o.id)) conectados.set(o.id, l.motivo || "");
    const antes = new Map(), depois = new Map(), rel = new Map();
    if (pos && pos.ant) antes.set(pos.ant.item, "Etapa anterior da trilha");
    if (pos && pos.prox) depois.set(pos.prox.item, "Próxima etapa da trilha");
    for (const [id, motivo] of conectados) {
      if (antes.has(id) || depois.has(id)) continue;
      if (meu && ordem[id] && ordem[id] < meu) antes.set(id, motivo);
      else if (meu && ordem[id] && ordem[id] > meu) depois.set(id, motivo);
      else rel.set(id, motivo);
    }
    const ord = m => [...m.entries()].sort((a, b) => (ordem[a[0]] || 999) - (ordem[b[0]] || 999)).slice(0, 6);
    const A = ord(antes), B = ord(depois), R = [...rel.entries()].slice(0, 6);
    if (!A.length && !B.length && !R.length) return "";

    // Dimensionado para caber na largura de leitura (~640 px) sem reduzir o texto.
    const W = 640, BW = 182, BH = 54, GAP = 10, CW = 190, CH = 88;
    const colH = n => n * BH + Math.max(0, n - 1) * GAP;
    const altoCols = Math.max(colH(A.length), colH(B.length), CH);
    const topo = 34, relY = topo + altoCols + 54;
    const H = (R.length ? relY + 30 + Math.ceil(R.length / 3) * (BH + GAP) : topo + altoCols + 16);
    const cx = (W - CW) / 2, cy = topo + (altoCols - CH) / 2;
    const caixa = (id, x, y, motivo, n) => {
      const o = ctx.porId[id], est = ctx.estudado(id);
      const t = quebrar(`${est ? "✓ " : ""}${n ? n + ". " : ""}${o.curto}`, 25, 1);
      const m = quebrar(motivo || "", 30, 1);
      return `<g class="dp-no g-${grupo(o)}${est ? " estudado" : ""}" data-abrir="${esc(id)}" tabindex="0" role="link" aria-label="${esc(o.titulo)}">
        <rect x="${x}" y="${y}" width="${BW}" height="${BH}" rx="8"/>
        <text class="dp-tit" x="${x + 10}" y="${y + 22}">${tspans(t, x + 10, 14)}</text>
        <text class="dp-sub" x="${x + 10}" y="${y + 40}">${tspans(m, x + 10, 13)}</text></g>`;
    };
    let s = `<svg class="diag dp" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Dependências do tema">
      <defs><marker id="dp-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="dp-ponta"/></marker></defs>
      <text class="dp-col" x="${BW / 2}" y="16" text-anchor="middle">Você precisa antes</text>
      <text class="dp-col" x="${W / 2}" y="16" text-anchor="middle">Este tema</text>
      <text class="dp-col" x="${W - BW / 2}" y="16" text-anchor="middle">Isso destrava depois</text>`;
    const coluna = (lista, x) => {
      const y0 = topo + (altoCols - colH(lista.length)) / 2;
      return lista.map(([id, motivo], i) => ({ id, motivo, x, y: y0 + i * (BH + GAP) }));
    };
    const LA = coluna(A, 0), LB = coluna(B, W - BW);
    for (const c of LA) s += `<path class="dp-linha" d="M${c.x + BW},${c.y + BH / 2} C${c.x + BW + 30},${c.y + BH / 2} ${cx - 30},${cy + CH / 2} ${cx - 2},${cy + CH / 2}" marker-end="url(#dp-seta)"/>`;
    for (const c of LB) s += `<path class="dp-linha" d="M${cx + CW},${cy + CH / 2} C${cx + CW + 30},${cy + CH / 2} ${c.x - 30},${c.y + BH / 2} ${c.x - 2},${c.y + BH / 2}" marker-end="url(#dp-seta)"/>`;
    for (const c of LA) s += caixa(c.id, c.x, c.y, c.motivo, ordem[c.id]);
    for (const c of LB) s += caixa(c.id, c.x, c.y, c.motivo, ordem[c.id]);
    const ct = quebrar(it.curto, 20, 2);
    s += `<g class="dp-centro g-${grupo(it)}"><rect x="${cx}" y="${cy}" width="${CW}" height="${CH}" rx="12"/>
      <text class="dp-ctit" x="${cx + CW / 2}" y="${cy + (ct.length > 1 ? 36 : 44)}" text-anchor="middle">${tspans(ct, cx + CW / 2, 19)}</text>
      <text class="dp-csub" x="${cx + CW / 2}" y="${cy + CH - 14}" text-anchor="middle">${pos ? `Trilha ${esc(pos.t.modulo)} · etapa ${meu} de ${pos.total}` : "Fora da trilha"}</text></g>`;
    if (R.length) {
      s += `<line class="dp-sep" x1="0" x2="${W}" y1="${relY - 8}" y2="${relY - 8}"/><text class="dp-col" x="0" y="${relY + 10}">Temas relacionados (outro módulo ou fora da trilha)</text>`;
      R.forEach(([id, motivo], i) => { s += caixa(id, (i % 3) * ((W - BW) / 2), relY + 24 + Math.floor(i / 3) * (BH + GAP), motivo); });
    }
    return s + "</svg>";
  }

  /** Hierarquia da esquerda para a direita: cada nível numa coluna, folhas uma por linha. */
  function hierarquia(raiz) {
    // Quatro níveis cabem na largura de leitura sem reduzir o texto.
    const LW = 160, BW = 146, BH = 50, RH = 60;
    let folha = 0, prof = 0;
    const medir = (n, d) => {
      prof = Math.max(prof, d);
      const f = n.filhos || [];
      if (!f.length) { n._y = folha++ * RH; }
      else { f.forEach(c => medir(c, d + 1)); n._y = (f[0]._y + f[f.length - 1]._y) / 2; }
      n._x = d * LW;
    };
    medir(raiz, 0);
    const W = (prof + 1) * LW, H = folha * RH;
    let lin = "", nos = "";
    const desenhar = n => {
      for (const c of n.filhos || []) {
        const x1 = n._x + BW, y1 = n._y + BH / 2 + 5, x2 = c._x, y2 = c._y + BH / 2 + 5, mx = (x1 + x2) / 2;
        lin += `<path class="hq-linha" d="M${x1},${y1} H${mx} V${y2} H${x2}"/>`;
        desenhar(c);
      }
      const t = quebrar(n.nome, 20, n.sub ? 1 : 2), sub = n.sub ? quebrar(n.sub, 23, 1) : [];
      nos += `<g class="hq-no${n.filhos && n.filhos.length ? "" : " folha"}"><rect x="${n._x}" y="${n._y + 5}" width="${BW}" height="${BH}" rx="8"/>
        <text class="hq-tit" x="${n._x + 10}" y="${n._y + (sub.length ? 25 : (t.length > 1 ? 25 : 34))}">${tspans(t, n._x + 10, 15)}</text>
        ${sub.length ? `<text class="hq-sub" x="${n._x + 10}" y="${n._y + 43}">${tspans(sub, n._x + 10, 13)}</text>` : ""}</g>`;
    };
    desenhar(raiz);
    return `<svg class="diag hq" viewBox="0 -2 ${W} ${H + 12}" width="${W}" height="${H + 12}" role="img" aria-label="Hierarquia">${lin}${nos}</svg>`;
  }

  /** Seções de ilustração de um tema: diagramas próprios do conteúdo e, sempre, as dependências. */
  window.renderDiagramas = function (it, sec, ctx) {
    let h = "";
    for (const d of it.diagramas || []) {
      const svg = d.tipo === "hierarquia" ? hierarquia(d.raiz) : d.tipo === "fluxo" ? window.desenharRaias(d.passos) : "";
      if (!svg) continue;
      const dica = d.tipo === "fluxo" ? "Cada coluna é um responsável; as setas mostram a ordem." : "Da esquerda para a direita: do nível mais alto ao mais detalhado.";
      h += sec(esc(d.titulo), `${d.legenda ? `<p class="diag-leg">${esc(d.legenda)}</p>` : ""}<p class="hint">${dica}</p><div class="raias-box">${svg}</div>`);
    }
    return h;
  };
  window.renderDependencias = function (it, sec, ctx) {
    const svg = dependencias(it, ctx);
    return svg ? sec("Onde este tema se encaixa", `<p class="hint">Clique num tema para abri-lo. Números indicam a etapa na trilha; ✓ = já estudado.</p><div class="raias-box">${svg}</div>`) : "";
  };
})();
