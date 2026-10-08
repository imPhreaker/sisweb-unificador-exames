// SPDX-License-Identifier: GPL-3.0-or-later
(() => {
  'use strict';

  const BUTTON_ID = 'sisweb-unificar-exames';
  const STATUS_ID = 'sisweb-unificar-status';
  const EXAM_CALL = /FREXAMES[\s\S]*?exame=(\d+)/i;
  const REQUEST_CALL = /FREXAMES[\s\S]*?requi=(\d+)/i;
  const DATE_TEXT = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
  // Eventos trocados com page-bridge.js, que roda no contexto da página.
  const ARM = 'sisweb-unificador:arm';
  const RELEASE = 'sisweb-unificador:release';
  const PDF_READY = 'sisweb-unificador:pdf';
  const BRIDGE_ATTRIBUTE = 'data-sisweb-unificador-bridge';
  let busy = false;
  let nextCaptureId = 1;
  let resultUrls = [];

  function visible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none' &&
      rect.width > 0 && rect.height > 0;
  }

  function zIndex(element) {
    return Number.parseInt(window.getComputedStyle(element).zIndex, 10) || 0;
  }

  // Cada ficha aberta é uma janela Ext (.x-window) e fichas anteriores podem
  // continuar no DOM por baixo da atual. Usar só a janela do topo evita
  // misturar exames de pacientes diferentes no mesmo PDF.
  function activeScope() {
    const windows = [...document.querySelectorAll('.x-window')].filter((win) =>
      !win.classList.contains('x-message-box') && visible(win) && win.querySelector('img[onclick*="FREXAMES"]'));
    if (!windows.length) return document;
    return windows.reduce((top, win) => (zIndex(win) > zIndex(top) ? win : top));
  }

  function examEntries() {
    const seen = new Set();
    return [...activeScope().querySelectorAll('img[onclick*="FREXAMES"]')]
      .filter(visible)
      .filter((element) => {
        const row = element.closest('tr');
        const isDisabled = element.matches('[disabled], [aria-disabled="true"]') ||
          Boolean(element.closest('[disabled], [aria-disabled="true"], .disabled, .x-item-disabled'));

        // Na janela "Exames solicitados", só considere itens que o SISWeb
        // liberou para consulta (a coluna de situação exibe "OK"). Fora da
        // tabela, como no painel lateral antigo, não há essa coluna.
        return !isDisabled && (!row || /\bOK\b/i.test(row.innerText || ''));
      })
      .map((element) => {
        const onclick = element.getAttribute('onclick') || '';
        const examId = onclick.match(EXAM_CALL)?.[1];
        // O mesmo exame aparece em várias requisições (datas diferentes), e
        // cada par requisição + exame gera um PDF próprio.
        const requestId = onclick.match(REQUEST_CALL)?.[1];
        const text = element.parentElement?.innerText?.replace(/\s+/g, ' ').trim() || '';
        const date = text.match(DATE_TEXT);
        return {
          element,
          id: examId && `${requestId || ''}:${examId}`,
          label: text || `Exame ${examId || ''}`,
          // Ex.: "01/10/2026" → chave "2026-10-01", usada para ordenar.
          dateKey: date ? `${date[3]}-${date[2]}-${date[1]}` : '',
          dateLabel: date ? date[0] : 'Sem data'
        };
      })
      .filter((entry) => entry.id && !seen.has(entry.id) && seen.add(entry.id));
  }

  // Agrupa por data, da mais recente para a mais antiga, mantendo dentro de
  // cada data a ordem exibida pelo SISWeb.
  // Número da ficha exibido no rodapé da ficha ativa (ex.: ".. Ficha :16277").
  function patientRecord() {
    for (const element of activeScope().querySelectorAll('.x-toolbar-text')) {
      const match = (element.textContent || '').match(/\bFicha\s*:\s*(\d+)/i);
      if (match && visible(element)) return match[1];
    }
    return '';
  }

  function groupByDate(entries) {
    const groups = new Map();
    for (const entry of entries) {
      if (!groups.has(entry.dateKey)) {
        groups.set(entry.dateKey, { dateKey: entry.dateKey, dateLabel: entry.dateLabel, entries: [] });
      }
      groups.get(entry.dateKey).entries.push(entry);
    }
    return [...groups.values()].sort((a, b) => b.dateKey.localeCompare(a.dateKey));
  }

  function readyText(entries) {
    const dates = groupByDate(entries).length;
    return `Pronto para reunir ${entries.length} exames de ${dates} ${dates === 1 ? 'data' : 'datas'}.`;
  }

  function setStatus(message, kind = 'info') {
    const status = document.getElementById(STATUS_ID);
    if (!status) return;
    status.dataset.ready = 'false';
    status.className = `sisweb-unificar-status ${kind}`;
    status.replaceChildren(document.createTextNode(message));
  }

  function styleControls(button, status, compact = false) {
    Object.assign(button.style, {
      margin: compact ? '0 34px 0 12px' : '8px 10px', padding: compact ? '5px 10px' : '8px 10px',
      width: compact ? 'auto' : 'calc(100% - 20px)', border: '0', borderRadius: '6px',
      background: '#0b7a72', color: '#fff', cursor: 'pointer',
      fontWeight: '700', fontSize: '13px', lineHeight: '1.25', boxShadow: '0 1px 3px rgba(0,0,0,.25)'
    });
    Object.assign(status.style, {
      display: 'block', margin: compact ? '4px 12px 6px' : '0 10px 10px',
      fontSize: '12px', lineHeight: '1.35', color: compact ? '#fff' : '#234'
    });
  }

  function visibleMessageBox() {
    return [...document.querySelectorAll('.x-message-box')].find(visible);
  }

  // Quando não consegue gerar o exame, o SISWeb mostra uma caixa de mensagem
  // (Ext.Msg) em vez da página EXAME. Lemos o motivo e a fechamos para
  // seguir com os próximos exames.
  function dismissMessageBox(box) {
    const body = box.querySelector('.x-window-body .x-container, .x-window-text') || box;
    const text = (body.innerText || body.textContent || '')
      .replace(/\s+/g, ' ').trim().slice(0, 200);
    [...box.querySelectorAll('.x-btn')].find(visible)?.click();
    return text || 'erro sem descrição';
  }

  function sendToBridge(type, id) {
    document.dispatchEvent(new CustomEvent(type, { detail: JSON.stringify({ id }) }));
  }

  // Prepara a ponte para a próxima abertura de exame. Precisa ser chamado
  // imediatamente antes do clique: a ponte intercepta só uma abertura.
  function startCapture() {
    const id = `${Date.now()}-${nextCaptureId++}`;
    const boxBefore = visibleMessageBox();
    let timer;
    let poll;
    let onPdf;
    const promise = new Promise((resolve, reject) => {
      const finish = (error, url) => {
        window.clearTimeout(timer);
        window.clearInterval(poll);
        document.removeEventListener(PDF_READY, onPdf);
        if (!error) return resolve({ id, url });
        sendToBridge(RELEASE, id);
        reject(error);
      };
      onPdf = (event) => {
        let data;
        try {
          data = JSON.parse(event.detail);
        } catch {
          return;
        }
        if (data?.id !== id || typeof data.url !== 'string') return;
        // Só aceita PDFs servidos pelo próprio SISWeb.
        const url = new URL(data.url, window.location.href);
        if (url.origin !== window.location.origin) {
          return finish(new Error('o PDF veio de um endereço diferente do SISWeb.'));
        }
        finish(null, url.href);
      };
      document.addEventListener(PDF_READY, onPdf);
      timer = window.setTimeout(() => {
        finish(new Error('O SISWeb não terminou de gerar o PDF dentro do tempo esperado.'));
      }, 20000);
      poll = window.setInterval(() => {
        const box = visibleMessageBox();
        if (box && box !== boxBefore) finish(new Error(`O SISWeb informou: ${dismissMessageBox(box)}`));
      }, 250);
    });
    sendToBridge(ARM, id);
    return promise;
  }

  async function getPdf(entry) {
    const capture = startCapture();
    entry.element.click();
    const { id, url } = await capture;
    try {
      const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error(`Falha ao obter o PDF (${response.status}).`);
      const bytes = await response.arrayBuffer();
      if (!bytes.byteLength) throw new Error('O PDF retornou vazio.');
      return bytes;
    } finally {
      sendToBridge(RELEASE, id);
    }
  }

  async function buildPdf(sources) {
    const merged = await window.PDFLib.PDFDocument.create();
    for (const source of sources) {
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }
    return merged.save();
  }

  function releaseResults() {
    resultUrls.forEach((url) => URL.revokeObjectURL(url));
    resultUrls = [];
  }

  function resultLine(title, count, bytes, fileName, emphasis = false) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    resultUrls.push(url);
    const line = document.createElement('div');
    Object.assign(line.style, { marginTop: '6px' });
    const label = document.createElement('span');
    label.textContent = `${title} (${count} ${count === 1 ? 'exame' : 'exames'}): `;
    if (emphasis) label.style.fontWeight = '700';
    const open = document.createElement('a');
    open.href = url;
    open.target = '_blank';
    open.rel = 'noopener';
    open.textContent = 'Abrir';
    const download = document.createElement('a');
    download.href = url;
    download.download = fileName;
    download.textContent = 'Baixar';
    for (const link of [open, download]) {
      Object.assign(link.style, { color: '#00695c', fontWeight: '700', marginRight: '10px' });
    }
    line.append(label, open, download);
    return line;
  }

  function showResult(all, groups, failures, record) {
    const status = document.getElementById(STATUS_ID);
    if (!status) return;
    const today = new Date().toISOString().slice(0, 10);
    const prefix = record ? `SISWeb-ficha-${record}` : 'SISWeb';
    const lines = [resultLine('Todos os exames', all.count, all.bytes, `${prefix}-exames-todos-${today}.pdf`, true)];
    if (groups.length > 1) {
      for (const group of groups) {
        const suffix = group.dateKey || 'sem-data';
        lines.push(resultLine(group.dateLabel, group.count, group.bytes, `${prefix}-exames-${suffix}.pdf`));
      }
    }
    const forRecord = record ? ` da ficha ${record}` : '';
    const nodes = [document.createTextNode(groups.length > 1
      ? `PDFs${forRecord} prontos: um com todos e um por data (${groups.length} datas).`
      : `PDF unificado${forRecord} pronto.`)];
    if (failures.length) {
      const warning = document.createElement('div');
      Object.assign(warning.style, { marginTop: '6px', color: '#b3261e', fontWeight: '700' });
      warning.textContent = `Atenção: ${failures.length} ${failures.length === 1 ? 'exame não foi incluído' : 'exames não foram incluídos'}: ` +
        failures.map((failure) => failure.label).join('; ') +
        `. Motivo: ${[...new Set(failures.map((failure) => failure.error?.message))].join(' | ')}`;
      nodes.push(warning);
    }
    status.className = `sisweb-unificar-status ${failures.length ? 'error' : 'success'}`;
    status.replaceChildren(...nodes, ...lines);
  }

  async function mergeExams() {
    if (busy) return;
    const entries = examEntries();
    // Lida no início: a ficha não muda durante a coleta, mesmo que o
    // usuário mude de tela.
    const record = patientRecord();
    const button = document.getElementById(BUTTON_ID);
    if (entries.length < 2) return setStatus('Não encontrei dois ou mais exames nesta lista.', 'error');
    if (!window.PDFLib?.PDFDocument) return setStatus('A biblioteca de PDF não foi carregada.', 'error');
    if (!document.documentElement.hasAttribute(BRIDGE_ATTRIBUTE)) {
      return setStatus('A extensão ainda não está ativa nesta página. Recarregue a página do SISWeb.', 'error');
    }
    busy = true;
    button.disabled = true;
    button.style.opacity = '.65';
    releaseResults();
    try {
      // Cada exame é obtido uma única vez e reaproveitado no PDF geral e no
      // PDF da sua data.
      const sources = new Map();
      const failures = [];
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        setStatus(`Obtendo ${index + 1} de ${entries.length}: ${entry.label}`, 'info');
        try {
          sources.set(entry, await window.PDFLib.PDFDocument.load(await getPdf(entry), { ignoreEncryption: true }));
        } catch (error) {
          console.error('[SISWeb Unificar Exames]', entry.label, error);
          failures.push({ label: entry.label, error });
        }
      }
      if (!sources.size) throw new Error(failures[0]?.error?.message || 'nenhum exame foi obtido.');

      setStatus('Montando os arquivos…', 'info');
      const groups = [];
      for (const group of groupByDate(entries)) {
        const groupSources = group.entries.filter((entry) => sources.has(entry)).map((entry) => sources.get(entry));
        if (!groupSources.length) continue;
        groups.push({ ...group, count: groupSources.length, bytes: await buildPdf(groupSources) });
      }
      // O PDF geral segue a mesma ordem dos grupos: datas mais recentes primeiro.
      const ordered = groups.flatMap((group) => group.entries.filter((entry) => sources.has(entry)));
      const all = { count: ordered.length, bytes: await buildPdf(ordered.map((entry) => sources.get(entry))) };
      showResult(all, groups, failures, record);
    } catch (error) {
      console.error('[SISWeb Unificar Exames]', error);
      setStatus(`Não foi possível unificar: ${error.message}`, 'error');
    } finally {
      busy = false;
      button.disabled = false;
      button.style.opacity = '1';
    }
  }

  function dialogTitle() {
    const normalize = (value) => value.replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
    return [...activeScope().querySelectorAll('div, span, td')]
      .find((element) => visible(element) && normalize(element.textContent || '') === 'exames solicitados');
  }

  function removeControls() {
    for (const id of [BUTTON_ID, STATUS_ID, 'sisweb-unificar-actions']) document.getElementById(id)?.remove();
  }

  function addControls() {
    const existing = document.getElementById(BUTTON_ID);
    // Outra ficha passou para a frente: o botão acompanha a ficha ativa.
    if (existing && !busy && !activeScope().contains(existing)) removeControls();
    if (document.getElementById(BUTTON_ID)) {
      // Mantém a contagem atualizada enquanto nenhum resultado é exibido.
      const status = document.getElementById(STATUS_ID);
      if (!busy && status?.dataset.ready === 'true') {
        const text = readyText(examEntries());
        if (status.textContent !== text) status.textContent = text;
      }
      return;
    }
    const entries = examEntries();
    if (entries.length < 2) return;
    const title = dialogTitle();
    const fallbackHost = entries[0].element.closest('div') || entries[0].element.parentElement?.parentElement;
    const header = title?.closest('[class*="header"], [class*="Header"]') || title?.parentElement;
    const host = header || fallbackHost?.parentElement;
    if (!host) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.textContent = 'Baixar todos (PDF)';
    button.title = 'Gera localmente um PDF com todos os exames e um por data, sem enviar dados para fora do SISWeb';
    const status = document.createElement('small');
    status.id = STATUS_ID;
    status.setAttribute('role', 'status');
    status.dataset.ready = 'true';
    status.textContent = readyText(entries);
    const compact = Boolean(header);
    styleControls(button, status, compact);
    button.addEventListener('click', mergeExams);
    if (header) {
      const actions = document.createElement('span');
      actions.id = 'sisweb-unificar-actions';
      Object.assign(actions.style, { float: 'right', display: 'inline-flex', alignItems: 'center' });
      actions.append(button);
      header.append(actions);
      host.insertAdjacentElement('afterend', status);
    } else {
      host.insertBefore(button, host.firstChild);
      host.insertBefore(status, button.nextSibling);
    }
  }

  addControls();
  let pending;
  new MutationObserver(() => {
    window.clearTimeout(pending);
    pending = window.setTimeout(addControls, 200);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
