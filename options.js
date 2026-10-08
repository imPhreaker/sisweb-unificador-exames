// SPDX-License-Identifier: GPL-3.0-or-later
(() => {
  'use strict';

  const { parseSiteUrl, patternFor, loadSites } = SiswebSites;
  const form = document.getElementById('add-form');
  const input = document.getElementById('site-url');
  const list = document.getElementById('sites');
  const empty = document.getElementById('empty');
  const message = document.getElementById('message');

  function showMessage(text, kind = '') {
    message.className = kind;
    message.textContent = text;
  }

  async function saveSites(sites) {
    await chrome.storage.sync.set({ sites });
  }

  // chrome.permissions.request precisa ser chamado diretamente no clique.
  // O registro dos scripts é feito pelo service worker quando a permissão
  // é concedida, mesmo que este popup se feche durante a confirmação.
  function requestAccess(origin) {
    return chrome.permissions.request({ origins: [patternFor(origin)] });
  }

  async function render() {
    const sites = await loadSites();
    empty.hidden = sites.length > 0;
    const items = await Promise.all(sites.map(async ({ origin }) => {
      const granted = await chrome.permissions.contains({ origins: [patternFor(origin)] });
      const item = document.createElement('li');

      const label = document.createElement('span');
      label.className = 'origin';
      label.textContent = origin;

      const state = document.createElement('span');
      state.className = `state ${granted ? 'ok' : 'pending'}`;
      state.textContent = granted ? 'Ativo' : 'Acesso pendente';

      item.append(label, state);

      if (!granted) {
        const grant = document.createElement('button');
        grant.type = 'button';
        grant.textContent = 'Conceder acesso';
        grant.addEventListener('click', async () => {
          const ok = await requestAccess(origin);
          showMessage(ok ? 'Acesso concedido. Recarregue a página do SISWeb.' : 'Acesso não concedido.', ok ? 'success' : 'error');
          render();
        });
        item.append(grant);
      }

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'secondary';
      remove.textContent = 'Remover';
      remove.setAttribute('aria-label', `Remover ${origin}`);
      remove.addEventListener('click', async () => {
        const remaining = (await loadSites()).filter((site) => site.origin !== origin);
        await saveSites(remaining);
        await chrome.permissions.remove({ origins: [patternFor(origin)] }).catch(() => {});
        showMessage(`${origin} removido.`, 'success');
        render();
      });
      item.append(remove);
      return item;
    }));
    list.replaceChildren(...items);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    let origin;
    try {
      ({ origin } = parseSiteUrl(input.value));
    } catch (error) {
      showMessage(error.message, 'error');
      input.focus();
      return;
    }

    // Pede a permissão antes de qualquer espera, para manter o gesto do usuário.
    const access = requestAccess(origin);
    const sites = await loadSites();
    if (!sites.some((site) => site.origin === origin)) {
      await saveSites([...sites, { origin }]);
    }

    const granted = await access.catch(() => false);
    input.value = '';
    showMessage(
      granted
        ? `${origin} adicionado. Recarregue a página do SISWeb para ver o botão.`
        : `${origin} salvo, mas o acesso não foi concedido. Use "Conceder acesso" abaixo.`,
      granted ? 'success' : 'error'
    );
    render();
  });

  render();
})();
