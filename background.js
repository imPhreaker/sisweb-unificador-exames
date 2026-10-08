// SPDX-License-Identifier: GPL-3.0-or-later
importScripts('sites.js');

let syncQueue = Promise.resolve();

// Os scripts só são registrados para os endereços que o usuário cadastrou
// e cuja permissão de acesso ele concedeu.
async function syncContentScripts() {
  const matches = [];
  for (const site of await SiswebSites.loadSites()) {
    const pattern = SiswebSites.patternFor(site.origin);
    if (await chrome.permissions.contains({ origins: [pattern] })) matches.push(pattern);
  }

  // Remove também registros de versões anteriores (ex.: sisweb-popup-bridge).
  const registered = await chrome.scripting.getRegisteredContentScripts();
  const ours = registered.map((script) => script.id).filter((id) => id.startsWith('sisweb-'));
  if (ours.length) await chrome.scripting.unregisterContentScripts({ ids: ours });
  if (!matches.length) return;

  await chrome.scripting.registerContentScripts([
    {
      // Precisa rodar no contexto da página para interceptar o window.open
      // do SISWeb; veja page-bridge.js.
      id: 'sisweb-page-bridge', matches, js: ['page-bridge.js'],
      allFrames: true, runAt: 'document_start', world: 'MAIN'
    },
    {
      id: 'sisweb-content', matches, js: ['pdf-lib.min.js', 'content.js'],
      allFrames: true, runAt: 'document_idle'
    }
  ]);
}

function scheduleSync() {
  syncQueue = syncQueue
    .then(syncContentScripts)
    .catch((error) => console.error('[SISWeb Unificador de Exames] Falha ao registrar scripts', error));
  return syncQueue;
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await scheduleSync();
  const sites = await SiswebSites.loadSites();
  if (reason === 'install' || (reason === 'update' && !sites.length)) {
    chrome.runtime.openOptionsPage();
  }
});
chrome.runtime.onStartup.addListener(scheduleSync);
chrome.permissions.onAdded.addListener(scheduleSync);
chrome.permissions.onRemoved.addListener(scheduleSync);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.sites) scheduleSync();
});
