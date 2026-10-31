// Mapa de conexões interativo: layout por forças, zoom/arraste, seleção com painel e sequência da trilha.
(function () {
  const esc = window.escapeHtml;
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  // Cada grupo tem uma região no plano: MM à esquerda, SD à direita, base no centro, atualidades embaixo.
  const ANCORA = { MM: [-520, 40], SD: [520, 40], base: [0, -260], semanal: [0, 420], outro: [0, 320] };
  const NOME_GRUPO = { MM: "MM", SD: "SD", base: "Fundamentos", semanal: "Edições semanais" };
  const grupoDe = it => it.tipo === "fundamentos" ? "base" : it.tipo === "semanal" ? "semanal" : (it.modulo === "MM" || it.modulo === "SD") ? it.modulo : "outro";

  let ctx = null;            // dados vindos do app (itens, estudado, abrir, posicao...)
  let nos = [], arestas = [], porId = {}, vizinhos = {};
  let assinatura = "";       // muda quando o conjunto de itens/links muda → refaz o layout
  let vista = { k: 1, x: 0, y: 0 };
  let selecionado = null, emFoco = null;
  const filtros = { MM: true, SD: true, base: true, semanal: true, outro: true };
  let mostrarSequencia = false;
  let dom = null;

  /* ---------- layout ---------- */
  function construirGrafo() {
    const itens = ctx.itens;
    const assin = itens.map(i => i.id + ":" + (i.links || []).map(l => l.id).join(",")).join("|");
    const anterior = porId;
    porId = {}; vizinhos = {};
    nos = itens.map((it, i) => {
      const g = grupoDe(it), [ax, ay] = ANCORA[g];
      const antigo = anterior[it.id];
      // Posição inicial determinística (espiral em volta da âncora) para o layout sair sempre igual.
      const ang = i * 2.399, raio = 30 + 9 * Math.sqrt(i);
      const n = { id: it.id, it, g, x: antigo ? antigo.x : ax + Math.cos(ang) * raio, y: antigo ? antigo.y : ay + Math.sin(ang) * raio, vx: 0, vy: 0, fixo: antigo ? antigo.fixo : false };
      porId[it.id] = n; vizinhos[it.id] = new Map();
      return n;
    });
    const vistos = new Set();
    arestas = [];
    for (const it of itens) for (const l of it.links || []) {
      if (!porId[l.id] || l.id === it.id) continue;
      vizinhos[it.id].set(l.id, { motivo: l.motivo, sentido: "cita" });
      if (!vizinhos[l.id].has(it.id)) vizinhos[l.id].set(it.id, { motivo: l.motivo, sentido: "citado" });
      const k = [it.id, l.id].sort().join("|");
      if (vistos.has(k)) continue;
      vistos.add(k);
      arestas.push({ a: porId[it.id], b: porId[l.id] });
    }
    for (const n of nos) {
      n.r = (n.g === "base" ? 11 : 7) + Math.min(vizinhos[n.id].size, 10) * 0.7;
      // Caixa ocupada pelo círculo + rótulo, usada para o layout não sobrepor textos.
      n.w = Math.max(2 * n.r, n.it.curto.length * 6.4) + 14;
      n.h = n.r * 2 + 22;
    }
    if (assin !== assinatura) { assinatura = assin; simular(450, 1); }
  }

  // Simulação simples: repulsão entre todos, molas nas conexões, atração para a região do grupo.
  function simular(passos, alfa0) {
    let alfa = alfa0;
    for (let t = 0; t < passos; t++) {
      for (let i = 0; i < nos.length; i++) for (let j = i + 1; j < nos.length; j++) {
        const a = nos[i], b = nos[j];
        let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy || 0.01;
        const f = (5200 / d2) * alfa;
        const d = Math.sqrt(d2); dx /= d; dy /= d;
        a.vx -= dx * f; a.vy -= dy * f; b.vx += dx * f; b.vy += dy * f;
      }
      for (const { a, b } of arestas) {
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - 150) * 0.02 * alfa;
        a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
      }
      for (const n of nos) {
        const [ax, ay] = ANCORA[n.g];
        n.vx += (ax - n.x) * 0.014 * alfa; n.vy += (ay - n.y) * 0.014 * alfa;
        if (n.fixo) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.6; n.vy *= 0.6;
        n.x += Math.max(-30, Math.min(30, n.vx)); n.y += Math.max(-30, Math.min(30, n.vy));
      }
      separarCaixas();
      alfa *= 0.995;
    }
  }

  // Empurra para longe temas cujas caixas (círculo + rótulo) se sobrepõem, pelo eixo de menor sobreposição.
  function separarCaixas() {
    for (let i = 0; i < nos.length; i++) for (let j = i + 1; j < nos.length; j++) {
      const a = nos[i], b = nos[j];
      const ox = (a.w + b.w) / 2 - Math.abs(b.x - a.x), oy = (a.h + b.h) / 2 - Math.abs(b.y - a.y);
      if (ox <= 0 || oy <= 0) continue;
      const pa = a.fixo ? 0 : b.fixo ? 1 : 0.5, pb = 1 - pa;
      if (ox < oy) { const s = Math.sign(b.x - a.x) || 1; a.x -= s * ox * pa; b.x += s * ox * pb; }
      else { const s = Math.sign(b.y - a.y) || 1; a.y -= s * oy * pa; b.y += s * oy * pb; }
    }
  }

  /* ---------- desenho ---------- */
  function montar() {
    const svg = document.getElementById("mapsvg");
    svg.replaceChildren();
    const defs = el("defs");
    const m = el("marker", { id: "mapa-seta", viewBox: "0 0 10 10", refX: "10", refY: "5", markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse" });
    m.append(el("path", { d: "M0,0 L10,5 L0,10 z", class: "seq-ponta" }));
    defs.append(m);
    const viewport = el("g", { id: "mapa-viewport" });
    const gAr = el("g", { class: "m-arestas" }), gSeq = el("g", { class: "m-seq" }), gNos = el("g", { class: "m-nos" });
    viewport.append(gAr, gSeq, gNos);
    svg.append(defs, viewport);
    dom = { svg, viewport, gAr, gSeq, gNos, arestas: [], nos: {} };
    for (const ar of arestas) { const l = el("line", { class: "m-aresta" }); ar.el = l; gAr.append(l); }
    for (const n of nos) {
      const g = el("g", { class: `m-no g-${n.g}`, tabindex: "0", role: "button", "aria-label": n.it.titulo, "data-id": n.id });
      const c = el("circle", { r: n.r });
      const num = el("text", { class: "m-num", "text-anchor": "middle", dy: "4" });
      const novo = el("circle", { class: "m-novo", r: 4.5, cx: n.r * 0.72, cy: -n.r * 0.72 });
      const t = el("text", { class: "m-rot", "text-anchor": "middle", dy: n.r + 14 });
      t.textContent = n.it.curto;
      g.append(c, num, t, novo);
      gNos.append(g);
      n.el = g; n.num = num;
    }
    ligarEventos();
  }

  function posicionar() {
    for (const n of nos) n.el.setAttribute("transform", `translate(${n.x.toFixed(1)},${n.y.toFixed(1)})`);
    for (const ar of arestas) {
      ar.el.setAttribute("x1", ar.a.x.toFixed(1)); ar.el.setAttribute("y1", ar.a.y.toFixed(1));
      ar.el.setAttribute("x2", ar.b.x.toFixed(1)); ar.el.setAttribute("y2", ar.b.y.toFixed(1));
    }
    desenharSequencia();
  }

  // Setas numeradas na ordem da trilha ativa (só etapas já publicadas e visíveis).
  function sequenciaAtiva() {
    const t = ctx.trilhaAtiva && ctx.trilhaAtiva();
    if (!t) return [];
    let n = 0;
    return t.niveis.flatMap(nv => nv.etapas.map(e => ({ id: e.item, n: ++n }))).filter(e => porId[e.id] && visivel(porId[e.id]));
  }
  function desenharSequencia() {
    dom.gSeq.replaceChildren();
    for (const n of nos) n.num.textContent = "";
    if (!mostrarSequencia) return;
    const seq = sequenciaAtiva();
    seq.forEach(e => { porId[e.id].num.textContent = e.n; });
    for (let i = 0; i < seq.length - 1; i++) {
      const a = porId[seq[i].id], b = porId[seq[i + 1].id];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const x1 = a.x + dx / d * (a.r + 3), y1 = a.y + dy / d * (a.r + 3), x2 = b.x - dx / d * (b.r + 5), y2 = b.y - dy / d * (b.r + 5);
      // Curva leve para não sobrepor as linhas de conexão retas.
      const cx = (x1 + x2) / 2 - dy / d * 22, cy = (y1 + y2) / 2 + dx / d * 22;
      dom.gSeq.append(el("path", { class: "m-seq-linha", d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, "marker-end": "url(#mapa-seta)" }));
    }
  }

  const visivel = n => filtros[n.g] !== false;

  // Estado visual: filtros, estudado/novo, foco (selecionado ou hover) com vizinhos destacados, busca.
  function estilizar() {
    const foco = selecionado || emFoco;
    const viz = foco ? vizinhos[foco] : null;
    const q = (document.getElementById("mapa-busca").value || "").trim().toLowerCase();
    for (const n of nos) {
      const cl = n.el.classList;
      cl.toggle("oculto", !visivel(n));
      cl.toggle("estudado", ctx.estudado(n.id));
      cl.toggle("novo", ctx.naoVistos.has(n.id));
      cl.toggle("sel", n.id === selecionado);
      cl.toggle("apagado", !!foco && n.id !== foco && !viz.has(n.id));
      cl.toggle("achado", !!q && (n.it.titulo + " " + n.it.curto).toLowerCase().includes(q));
      cl.toggle("sem-rotulo", vista.k < 0.55 && !(foco && (n.id === foco || viz.has(n.id))));
    }
    for (const ar of arestas) {
      const vis = visivel(ar.a) && visivel(ar.b);
      ar.el.classList.toggle("oculto", !vis);
      const quente = !!foco && (ar.a.id === foco || ar.b.id === foco);
      ar.el.classList.toggle("quente", quente);
      ar.el.classList.toggle("apagado", !!foco && !quente);
    }
  }

  function aplicarVista() { dom.viewport.setAttribute("transform", `translate(${vista.x},${vista.y}) scale(${vista.k})`); }

  function enquadrar(ids) {
    const alvo = (ids || nos.filter(visivel).map(n => n.id)).map(id => porId[id]).filter(Boolean);
    if (!alvo.length) return;
    const r = dom.svg.getBoundingClientRect();
    const xs = alvo.map(n => n.x), ys = alvo.map(n => n.y);
    const x0 = Math.min(...xs) - 90, x1 = Math.max(...xs) + 90, y0 = Math.min(...ys) - 50, y1 = Math.max(...ys) + 60;
    const k = Math.max(0.25, Math.min(2.2, Math.min(r.width / (x1 - x0), r.height / (y1 - y0))));
    vista = { k, x: r.width / 2 - k * (x0 + x1) / 2, y: r.height / 2 - k * (y0 + y1) / 2 };
    aplicarVista(); estilizar();
  }
  function zoom(fator, px, py) {
    const r = dom.svg.getBoundingClientRect();
    if (px === undefined) { px = r.width / 2; py = r.height / 2; }
    const k = Math.max(0.2, Math.min(3, vista.k * fator));
    vista.x = px - (px - vista.x) * (k / vista.k);
    vista.y = py - (py - vista.y) * (k / vista.k);
    vista.k = k;
    aplicarVista(); estilizar();
  }

  /* ---------- painel ---------- */
  function painel() {
    const p = document.getElementById("mapa-painel");
    if (!selecionado) {
      p.innerHTML = `<h3>Como usar</h3>
        <ul class="plain">
          <li>Arraste o fundo para mover; use a roda do mouse ou os botões para zoom.</li>
          <li>Clique num tema para ver as conexões; duplo clique abre o tema.</li>
          <li>Arraste um tema para reorganizar o mapa.</li>
          <li>"Sequência da trilha" mostra a ordem de estudo do módulo escolhido na tela Trilha.</li>
        </ul>
        <h3>Legenda</h3>
        <div class="m-leg"><span class="lg g-MM"></span>MM <span class="lg g-SD"></span>SD <span class="lg g-base"></span>Fundamentos <span class="lg g-semanal"></span>Edições</div>
        <div class="m-leg"><span class="lg estudado"></span>Estudado <span class="lg novo"></span>Novo</div>`;
      return;
    }
    const n = porId[selecionado], it = n.it;
    const pos = ctx.posicao(it.id);
    const status = ctx.estudado(it.id) ? "Estudado" : ctx.naoVistos.has(it.id) ? "Novo, ainda não visto" : "Ainda não estudado";
    const conex = [...vizinhos[it.id].entries()].filter(([id]) => visivel(porId[id]));
    p.innerHTML = `
      <p class="m-tipo"><span class="lg g-${n.g}"></span>${esc(ctx.rotuloTipo(it))}${it.modulo ? " · " + esc(it.modulo) : ""} · ${esc(it.nivel || "")}</p>
      <h3>${esc(it.titulo)}</h3>
      <p class="m-status">${status}</p>
      ${pos ? `<p class="m-pos">Trilha ${esc(pos.t.modulo)} · etapa ${pos.etapa.n} de ${pos.total} · ${esc(pos.etapa.nivel.nome)}</p>` : ""}
      <p class="m-res">${esc((it.resumo || "").slice(0, 240))}${(it.resumo || "").length > 240 ? "…" : ""}</p>
      <button class="tr-go" data-abrir="${esc(it.id)}">Abrir tema →</button>
      <h4>Conexões (${conex.length})</h4>
      <ul class="m-conex">${conex.map(([id, c]) => `<li><button data-mapa-sel="${esc(id)}"><b>${c.sentido === "cita" ? "→" : "←"} ${esc(porId[id].it.curto)}</b><span>${esc(c.motivo || "")}</span></button></li>`).join("") || '<li class="empty">Sem conexões visíveis.</li>'}</ul>`;
  }

  function selecionar(id, centralizar) {
    selecionado = id;
    estilizar(); painel();
    if (id && centralizar) {
      const n = porId[id], r = dom.svg.getBoundingClientRect();
      vista.x = r.width / 2 - n.x * vista.k; vista.y = r.height / 2 - n.y * vista.k;
      aplicarVista();
    }
  }

  /* ---------- eventos ---------- */
  function ligarEventos() {
    const svg = dom.svg;
    let arraste = null, ultimoClique = {};
    const pt = e => { const r = svg.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

    svg.onpointerdown = e => {
      const g = e.target.closest(".m-no");
      const [px, py] = pt(e);
      arraste = g ? { tipo: "no", n: porId[g.dataset.id], px, py, movido: false } : { tipo: "fundo", px, py, vx: vista.x, vy: vista.y, movido: false };
      svg.setPointerCapture(e.pointerId);
    };
    svg.onpointermove = e => {
      const [px, py] = pt(e);
      if (!arraste) {
        const g = e.target.closest(".m-no");
        const id = g ? g.dataset.id : null;
        if (id !== emFoco) { emFoco = id; estilizar(); }
        return;
      }
      const dx = px - arraste.px, dy = py - arraste.py;
      if (Math.abs(dx) + Math.abs(dy) > 3) arraste.movido = true;
      if (!arraste.movido) return;
      if (arraste.tipo === "fundo") { vista.x = arraste.vx + dx; vista.y = arraste.vy + dy; aplicarVista(); }
      else {
        const n = arraste.n;
        n.x = (px - vista.x) / vista.k; n.y = (py - vista.y) / vista.k; n.fixo = true;
        simular(2, 0.25); posicionar();
      }
    };
    svg.onpointerup = e => {
      if (arraste && !arraste.movido) {
        if (arraste.tipo === "no") {
          // Duplo clique detectado aqui: com a captura do ponteiro, o evento dblclick não chega ao tema.
          const agora = Date.now(), id = arraste.n.id;
          if (ultimoClique.id === id && agora - ultimoClique.t < 400) { ultimoClique = {}; ctx.abrir(id); }
          else { ultimoClique = { id, t: agora }; selecionar(id); }
        } else selecionar(null);
      }
      arraste = null;
      try { svg.releasePointerCapture(e.pointerId); } catch { /* já liberado */ }
    };
    svg.onpointerleave = () => { if (!arraste && emFoco) { emFoco = null; estilizar(); } };
    svg.onwheel = e => { e.preventDefault(); const [px, py] = pt(e); zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, px, py); };
    svg.onkeydown = e => {
      const g = e.target.closest && e.target.closest(".m-no");
      if (e.key === "Escape") selecionar(null);
      if (g && e.key === "Enter") ctx.abrir(g.dataset.id);
      if (g && e.key === " ") { e.preventDefault(); selecionar(g.dataset.id); }
    };
    svg.addEventListener("focusin", e => { const g = e.target.closest(".m-no"); if (g) { emFoco = g.dataset.id; estilizar(); } });
  }

  // Controles da barra (ligados uma vez).
  let controlesProntos = false;
  function controles() {
    if (controlesProntos) return;
    controlesProntos = true;
    document.querySelectorAll("[data-mapa-filtro]").forEach(b => (b.onclick = () => {
      const g = b.dataset.mapaFiltro;
      filtros[g] = !filtros[g];
      b.setAttribute("aria-pressed", filtros[g]);
      if (selecionado && !visivel(porId[selecionado])) selecionado = null;
      estilizar(); desenharSequencia(); painel();
    }));
    document.getElementById("mapa-seq").onchange = e => { mostrarSequencia = e.target.checked; desenharSequencia(); };
    document.getElementById("mapa-mais").onclick = () => zoom(1.25);
    document.getElementById("mapa-menos").onclick = () => zoom(1 / 1.25);
    document.getElementById("mapa-ajustar").onclick = () => enquadrar();
    document.getElementById("mapa-reorganizar").onclick = () => { for (const n of nos) n.fixo = false; simular(300, 1); posicionar(); enquadrar(); };
    const busca = document.getElementById("mapa-busca");
    busca.oninput = () => estilizar();
    busca.onkeydown = e => {
      if (e.key !== "Enter") return;
      const q = busca.value.trim().toLowerCase();
      const n = nos.find(x => visivel(x) && (x.it.titulo + " " + x.it.curto).toLowerCase().includes(q));
      if (n) selecionar(n.id, true);
    };
    document.getElementById("mapa-painel").addEventListener("click", e => {
      const b = e.target.closest("[data-mapa-sel]");
      if (b) selecionar(b.dataset.mapaSel, true);
    });
  }

  window.Mapa = {
    // Chamado ao abrir a tela ou quando o conteúdo muda; mantém posições, zoom e seleção.
    render(dados) {
      ctx = dados;
      const primeira = !dom;
      const antes = assinatura;
      construirGrafo();
      controles();
      montar();
      posicionar();
      if (selecionado && !porId[selecionado]) selecionado = null;
      if (primeira || antes !== assinatura) requestAnimationFrame(() => enquadrar());
      else aplicarVista();
      estilizar(); painel();
    },
  };
})();
