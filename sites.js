// SPDX-License-Identifier: GPL-3.0-or-later
// Funções compartilhadas entre o service worker e a tela de configuração
// para tratar os endereços do SISWeb cadastrados pelo usuário.
(() => {
  'use strict';

  // Aceita "http://host[:porta]/caminho" ou "https://...". O caminho é
  // ignorado: a extensão atua em toda a origem, porque o SISWeb abre
  // janelas e quadros em caminhos diferentes do endereço de entrada.
  function parseSiteUrl(input) {
    const text = String(input || '').trim();
    if (!text) throw new Error('Informe o endereço do SISWeb.');
    if (!/^https?:\/\//i.test(text)) {
      throw new Error('O endereço deve começar com http:// ou https://.');
    }
    let url;
    try {
      url = new URL(text);
    } catch {
      throw new Error('Endereço inválido. Exemplo: https://sisweb.municipio.gov.br/sis/');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Somente endereços http:// ou https:// são aceitos.');
    }
    if (!url.hostname) throw new Error('O endereço não tem um domínio válido.');
    return { origin: url.origin };
  }

  function patternFor(origin) {
    return `${origin}/*`;
  }

  async function loadSites() {
    const { sites } = await chrome.storage.sync.get('sites');
    return Array.isArray(sites) ? sites.filter((site) => typeof site?.origin === 'string') : [];
  }

  globalThis.SiswebSites = { parseSiteUrl, patternFor, loadSites };
})();
