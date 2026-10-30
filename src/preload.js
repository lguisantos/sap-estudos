// Ponte segura entre a interface e o processo principal.
const { contextBridge, ipcRenderer } = require("electron");

const ouvir = canal => fn => {
  const h = (_e, payload) => fn(payload);
  ipcRenderer.on(canal, h);
  return () => ipcRenderer.removeListener(canal, h);
};

contextBridge.exposeInMainWorld("sap", {
  inicial: () => ipcRenderer.invoke("estado:inicial"),
  sincronizar: () => ipcRenderer.invoke("sync:agora"),
  marcarVisto: id => ipcRenderer.invoke("item:visto", id),
  marcarTodosVistos: () => ipcRenderer.invoke("itens:marcarTodosVistos"),
  salvarNota: (id, nota) => ipcRenderer.invoke("nota:salvar", id, nota),
  salvarConfig: cfg => ipcRenderer.invoke("config:salvar", cfg),
  versaoClaude: () => ipcRenderer.invoke("claude:versao"),
  enviarChat: msg => ipcRenderer.invoke("chat:enviar", msg),
  pararChat: () => ipcRenderer.invoke("chat:parar"),
  novaConversa: () => ipcRenderer.invoke("chat:nova"),
  definirSelo: (dataUrl, n) => ipcRenderer.invoke("selo", dataUrl, n),
  abrirExterno: url => ipcRenderer.invoke("abrir:externo", url),
  abrirPastaConteudo: () => ipcRenderer.invoke("abrir:pastaConteudo"),
  aoBiblioteca: ouvir("biblioteca"),
  aoSync: ouvir("sync:status"),
  aoAbrir: ouvir("abrir"),
  aoChat: ouvir("chat:evento"),
});
