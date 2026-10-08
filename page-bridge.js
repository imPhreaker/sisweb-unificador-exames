// SPDX-License-Identifier: GPL-3.0-or-later
// Roda no contexto da própria página (MAIN world), porque só ali é possível
// interceptar o window.open usado pelo SISWeb.
//
// Ao abrir um exame, o SISWeb chama window.open('', '_blank') e escreve na
// nova janela uma página "EXAME" com um iframe apontando para o PDF. Quando a
// extensão aciona vários exames seguidos, o navegador bloqueia essas janelas
// como popups. Por isso, apenas durante a coleta, a próxima chamada a
// window.open recebe um quadro oculto nesta página; o content script lê dali
// o endereço do PDF e o quadro é removido em seguida.
(() => {
  'use strict';

  if (window.__siswebUnificadorBridge) return;
  window.__siswebUnificadorBridge = true;
  // Sinaliza ao content script (que roda em outro contexto) que a ponte existe.
  document.documentElement.setAttribute('data-sisweb-unificador-bridge', '');

  const ARM = 'sisweb-unificador:arm';
  const RELEASE = 'sisweb-unificador:release';
  const PDF_READY = 'sisweb-unificador:pdf';
  const TIMEOUT_MS = 20000;
  const frames = new Map();

  function send(id, url) {
    document.dispatchEvent(new CustomEvent(PDF_READY, { detail: JSON.stringify({ id, url }) }));
  }

  function watchFrame(id, frame) {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const pdf = frame.contentDocument?.querySelector('iframe[src], embed[src], object[data]');
      const url = pdf && (pdf.src || pdf.data || '');
      if (/\.pdf(?:$|[?#])/i.test(url)) {
        window.clearInterval(timer);
        send(id, url);
      } else if (Date.now() - startedAt > TIMEOUT_MS) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  document.addEventListener(ARM, (event) => {
    const { id } = JSON.parse(event.detail || '{}');
    if (!id) return;
    const original = window.open;
    const restore = () => {
      if (window.open === capture) window.open = original;
    };
    // Intercepta somente a próxima abertura de janela em branco.
    const capture = function (url, ...rest) {
      restore();
      if (url && String(url) !== 'about:blank') return original.call(this, url, ...rest);
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.tabIndex = -1;
      frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0;visibility:hidden';
      document.body.append(frame);
      frames.set(id, frame);
      watchFrame(id, frame);
      return frame.contentWindow;
    };
    window.open = capture;
    window.setTimeout(restore, TIMEOUT_MS);
  });

  document.addEventListener(RELEASE, (event) => {
    const { id } = JSON.parse(event.detail || '{}');
    frames.get(id)?.remove();
    frames.delete(id);
  });
})();
