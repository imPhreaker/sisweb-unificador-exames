// SPDX-License-Identifier: GPL-3.0-or-later
(() => {
  'use strict';

  // Esta parte roda somente na aba about:blank criada pelo SISWeb para EXAME.
  if (window.top !== window || window.location.href !== 'about:blank') return;

  function report(kind) {
    const frame = [...document.querySelectorAll('iframe')]
      .find((item) => /\.pdf(?:$|[?#])/i.test(item.src || item.getAttribute('src') || ''));
    if (!frame?.src) return;
    chrome.runtime.sendMessage({ type: 'sisweb-popup-pdf', kind, url: frame.src });
  }

  let timer;
  const changed = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => report('changed'), 30);
  };
  new MutationObserver(changed).observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['src']
  });
  window.setTimeout(() => report('initial'), 0);
})();
