// SPDX-License-Identifier: GPL-3.0-or-later
importScripts('sites.js');

const popupTabs = new Map();
const pendingCaptures = new Map();
let nextCaptureId = 1;

const SCRIPT_IDS = ['sisweb-content', 'sisweb-popup-bridge'];
let syncQueue = Promise.resolve();

// Os scripts só são registrados para os endereços que o usuário cadastrou
// e cuja permissão de acesso ele concedeu.
async function syncContentScripts() {
  const matches = [];
  for (const site of await SiswebSites.loadSites()) {
    const pattern = SiswebSites.patternFor(site.origin);
    if (await chrome.permissions.contains({ origins: [pattern] })) matches.push(pattern);
  }

  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: SCRIPT_IDS });
  if (registered.length) {
    await chrome.scripting.unregisterContentScripts({ ids: registered.map((script) => script.id) });
  }
  if (!matches.length) return;

  await chrome.scripting.registerContentScripts([
    {
      id: 'sisweb-content', matches, js: ['pdf-lib.min.js', 'content.js'],
      allFrames: true, matchOriginAsFallback: true, runAt: 'document_idle'
    },
    {
      // Também precisa rodar na aba about:blank "EXAME" aberta pelo SISWeb.
      id: 'sisweb-popup-bridge', matches, js: ['popup-bridge.js'],
      allFrames: true, matchOriginAsFallback: true, runAt: 'document_start'
    }
  ]);
}

function scheduleSync() {
  syncQueue = syncQueue
    .then(syncContentScripts)
    .catch((error) => console.error('[SISWeb Unificar Exames] Falha ao registrar scripts', error));
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

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId !== undefined) {
    popupTabs.set(tab.id, { openerTabId: tab.openerTabId, createdAt: Date.now() });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  popupTabs.delete(tabId);
  pendingCaptures.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'sisweb-await-pdf') {
    const tabId = sender.tab?.id;
    if (tabId === undefined) {
      sendResponse({ ok: false, error: 'A aba do prontuário não foi identificada.' });
      return;
    }
    const capture = {
      id: nextCaptureId++, frameId: sender.frameId, startedAt: Date.now()
    };
    pendingCaptures.set(tabId, capture);
    sendResponse({ ok: true, captureId: capture.id });
    return;
  }

  if (message?.type === 'sisweb-cancel-pdf') {
    const tabId = sender.tab?.id;
    const capture = pendingCaptures.get(tabId);
    if (capture?.id === message.captureId) pendingCaptures.delete(tabId);
    return;
  }

  if (message?.type === 'sisweb-close-popup') {
    const tabId = Number(message.popupTabId);
    const popup = popupTabs.get(tabId);
    if (popup && popup.openerTabId === sender.tab?.id) {
      chrome.tabs.remove(tabId)
        .catch(() => {})
        .finally(() => {
          popupTabs.delete(tabId);
          sendResponse({ closed: true });
        });
      return true;
    }
    sendResponse({ closed: false });
    return;
  }

  if (message?.type !== 'sisweb-popup-pdf') return;
  const popupTabId = sender.tab?.id;
  const popup = popupTabs.get(popupTabId) || (sender.tab?.openerTabId !== undefined
    ? { openerTabId: sender.tab.openerTabId, createdAt: 0 }
    : undefined);
  if (!popup) return;

  const capture = pendingCaptures.get(popup.openerTabId);
  if (!capture) return;
  // Uma aba reutilizada só pode satisfazer a captura quando seu iframe mudou;
  // uma aba recém-criada pode reportar o PDF já no carregamento inicial.
  const canUse = message.kind === 'changed' || popup.createdAt >= capture.startedAt;
  if (!canUse || typeof message.url !== 'string') return;

  pendingCaptures.delete(popup.openerTabId);
  chrome.tabs.sendMessage(popup.openerTabId, {
    type: 'sisweb-pdf-ready',
    captureId: capture.id,
    url: message.url,
    popupTabId,
    // Só fechamos uma aba criada durante esta coleta, nunca uma aba antiga
    // que o profissional já tenha aberto manualmente.
    closeable: popup.createdAt >= capture.startedAt
  }, { frameId: capture.frameId }).catch(() => {
    // O usuário pode ter fechado ou recarregado o prontuário durante a ação.
  });
});
