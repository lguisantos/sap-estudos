// Markdown mínimo e seguro para as respostas do Claude: tudo é escapado antes de formatar.
(function () {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function inline(t, wiki) {
    const codes = [];
    t = t.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    t = esc(t)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, txt, url) => `<button class="ext" data-url="${url}">${txt}</button>`)
      .replace(/\[\[([^\]]+)\]\]/g, (m, nome) => wiki(nome) || m);
    return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[i])}</code>`);
  }

  window.renderMarkdown = function (src, wiki = () => "") {
    const linhas = String(src).replace(/\r/g, "").split("\n");
    const out = [];
    let i = 0;
    while (i < linhas.length) {
      const l = linhas[i];
      if (/^```/.test(l)) {
        const buf = [];
        i++;
        while (i < linhas.length && !/^```/.test(linhas[i])) buf.push(linhas[i++]);
        i++;
        out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`);
      } else if (/^#{1,6}\s/.test(l)) {
        out.push(`<h4>${inline(l.replace(/^#+\s*/, ""), wiki)}</h4>`);
        i++;
      } else if (/^\s*[-*]\s+/.test(l)) {
        const itens = [];
        while (i < linhas.length && /^\s*[-*]\s+/.test(linhas[i])) itens.push(`<li>${inline(linhas[i++].replace(/^\s*[-*]\s+/, ""), wiki)}</li>`);
        out.push(`<ul>${itens.join("")}</ul>`);
      } else if (/^\s*\d+[.)]\s+/.test(l)) {
        const itens = [];
        while (i < linhas.length && /^\s*\d+[.)]\s+/.test(linhas[i])) itens.push(`<li>${inline(linhas[i++].replace(/^\s*\d+[.)]\s+/, ""), wiki)}</li>`);
        out.push(`<ol>${itens.join("")}</ol>`);
      } else if (!l.trim()) {
        i++;
      } else {
        const buf = [];
        while (i < linhas.length && linhas[i].trim() && !/^(```|#{1,6}\s|\s*[-*]\s+|\s*\d+[.)]\s+)/.test(linhas[i])) buf.push(linhas[i++]);
        out.push(`<p>${inline(buf.join("\n"), wiki).replace(/\n/g, "<br>")}</p>`);
      }
    }
    return out.join("");
  };
  window.escapeHtml = esc;
})();
