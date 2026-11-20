/* Catálogo do cliente (somente leitura) */
(function () {
  'use strict';

  const DM = window.DM;
  const { esc, formatPrice, whatsappUrl, normalizeText, toast, PLACEHOLDER } = DM;
  const $ = (s, r) => (r || document).querySelector(s);

  const state = { settings: null, categories: [], products: [], cat: 'all', q: '', open: null };
  const els = {
    grid: $('#grid'), chips: $('#chips'), info: $('#info'), state: $('#state'),
    q: $('#q'), qClear: $('#q-clear'), fab: $('#fab'),
  };

  const WA_ICON =
    '<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16.04 3C9.4 3 4 8.4 4 15.04c0 2.12.55 4.18 1.6 6L4 28l7.1-1.86a12 12 0 0 0 4.94 1.06C22.7 27.2 28 21.8 28 15.04 28 8.4 22.68 3 16.04 3zm5.46 14.64c-.3-.15-1.78-.88-2.06-.98-.28-.1-.48-.15-.68.15s-.78.98-.96 1.18c-.18.2-.35.22-.65.08-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.64-.93-2.25-.24-.58-.49-.5-.68-.5h-.58c-.2 0-.53.08-.8.38s-1.05 1.03-1.05 2.5 1.08 2.9 1.23 3.1c.15.2 2.12 3.23 5.12 4.53.72.3 1.28.5 1.7.63.72.23 1.37.2 1.88.12.58-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.12-.28-.2-.58-.35z"/></svg>';
  const SHARE_ICON =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>';

  /* ----------------------------------------------------------- marca */
  function applyBrand() {
    const s = state.settings;
    $('#brand-name').textContent = s.store_name || 'DM Impressão 3D';
    $('#foot-name').textContent = s.store_name || 'DM Impressão 3D';
    $('#brand-tag').textContent = s.tagline || '';
    $('#brand-tag').hidden = !s.tagline;
    document.title = (s.store_name || 'DM Impressão 3D') + ' — Catálogo';
    if (s.logo_url) {
      $('#brand-logo').src = s.logo_url;
      const ic = document.querySelector('link[rel="icon"]');
      if (ic) ic.href = s.logo_url;
    }
    const wa = whatsappUrl(s, null);
    if (wa) {
      els.fab.href = wa;
      els.fab.classList.remove('hide');
    }
  }

  /* ----------------------------------------------------------- lista */
  const catName = (id) => (state.categories.find((c) => c.id === id) || {}).name || '';

  function filtered() {
    const q = normalizeText(state.q.trim());
    return state.products.filter((p) => {
      if (state.cat !== 'all' && p.category_id !== state.cat) return false;
      if (!q) return true;
      return normalizeText(p.name + ' ' + (p.description || '') + ' ' + catName(p.category_id)).includes(q);
    });
  }

  function renderChips() {
    const used = new Set(state.products.map((p) => p.category_id));
    const cats = state.categories.filter((c) => used.has(c.id));
    if (!cats.length) { els.chips.parentElement.hidden = true; return; }
    els.chips.parentElement.hidden = false;
    const chip = (id, label) =>
      `<button class="chip" type="button" data-cat="${esc(id)}" aria-pressed="${state.cat === id}">${esc(label)}</button>`;
    els.chips.innerHTML = chip('all', 'Todos') + cats.map((c) => chip(c.id, c.name)).join('');
  }

  function cardHtml(p, i) {
    const img = p.images && p.images[0] ? p.images[0] : PLACEHOLDER;
    const price = p.price == null ? '<div class="card-price ask">Consulte o valor</div>' : `<div class="card-price">${esc(formatPrice(p.price))}</div>`;
    const cat = catName(p.category_id);
    const n = (p.images || []).length;
    return `
      <article class="card${p.sold_out ? ' is-out' : ''}" data-id="${esc(p.id)}" tabindex="0" role="button"
               aria-label="${esc(p.name)} — ver detalhes" style="animation-delay:${Math.min(i, 12) * 40}ms">
        <div class="card-media">
          <img src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" decoding="async">
          <div class="badges">
            ${p.featured ? '<span class="badge">Destaque</span>' : ''}
            ${p.sold_out ? '<span class="badge out">Esgotado</span>' : ''}
          </div>
          ${n > 1 ? `<span class="card-photos">${n} fotos</span>` : ''}
        </div>
        <div class="card-body">
          ${cat ? `<span class="card-cat">${esc(cat)}</span>` : ''}
          <h3 class="card-name">${esc(p.name)}</h3>
          ${price}
        </div>
      </article>`;
  }

  function renderGrid() {
    const list = filtered();
    els.state.innerHTML = '';
    els.grid.hidden = !list.length;
    els.grid.innerHTML = list.map(cardHtml).join('');
    if (!state.products.length) {
      els.info.textContent = '';
      els.state.innerHTML = stateBlock('Em breve por aqui', 'Estamos preparando o catálogo. Volte daqui a pouco ou fale com a gente pelo WhatsApp.');
    } else if (!list.length) {
      els.info.textContent = '';
      els.state.innerHTML = stateBlock('Nada encontrado', 'Tente outra palavra ou veja todas as categorias.', '<button class="btn btn-dark" type="button" data-reset>Ver todos os produtos</button>');
    } else {
      els.info.textContent = list.length + (list.length === 1 ? ' produto' : ' produtos');
    }
  }

  function stateBlock(title, text, extra) {
    return `<div class="state">
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" aria-hidden="true"><path d="M32 8l20 11.5v23L32 54 12 42.5v-23z"/><path d="M32 31l20-11.5M32 31 12 19.5M32 31v23"/></svg>
      <h2>${esc(title)}</h2><p>${esc(text)}</p>${extra || ''}</div>`;
  }

  function showSkeleton() {
    els.grid.innerHTML = Array.from({ length: 6 }, () => '<div class="skel" aria-hidden="true"><i></i><i></i><i></i></div>').join('');
  }

  /* ----------------------------------------------------------- detalhe */
  let sheet, backdrop, lastFocus;

  function openProduct(id, opts) {
    const p = state.products.find((x) => x.id === id);
    if (!p) return false;
    opts = opts || {};
    if (state.open) closeSheetDom(true);
    state.open = p;
    lastFocus = document.activeElement;

    const imgs = p.images && p.images.length ? p.images : [PLACEHOLDER];
    const wa = whatsappUrl(state.settings, p);
    const cat = catName(p.category_id);
    const priceHtml =
      p.price == null
        ? '<div class="detail-price ask">Consulte o valor</div>'
        : `<div class="detail-price">${esc(formatPrice(p.price))}</div>`;
    const buyLabel = p.sold_out ? 'Perguntar disponibilidade' : 'Chamar no WhatsApp';
    const buyBtn = wa
      ? `<a class="btn btn-wa" href="${esc(wa)}" target="_blank" rel="noopener" data-buy>${WA_ICON}${buyLabel}</a>`
      : '<span class="btn is-disabled">Em breve</span>';
    const shareBtn = (cls, label) =>
      `<button type="button" class="btn btn-ghost ${cls}" data-share aria-label="Compartilhar produto">${SHARE_ICON}${label}</button>`;

    backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    backdrop.addEventListener('click', () => closeProduct());

    sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-label', p.name);
    sheet.innerHTML = `
      <button class="sheet-close" type="button" aria-label="Fechar" data-close>&times;</button>
      <div class="sheet-scroll">
        <div class="gallery">
          <div class="slides" id="slides">
            ${imgs.map((u, i) => `<div class="slide" data-zoom="${i}"><img src="${esc(u)}" alt="${esc(p.name)} — foto ${i + 1}" ${i ? 'loading="lazy"' : ''} decoding="async"></div>`).join('')}
          </div>
          ${imgs.length > 1 ? `
            <button class="arrow prev" type="button" aria-label="Foto anterior" data-nav="-1">&#8249;</button>
            <button class="arrow next" type="button" aria-label="Próxima foto" data-nav="1">&#8250;</button>
            <div class="dots" id="dots">${imgs.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>
            <div class="thumbs" id="thumbs">${imgs.map((u, i) => `<button type="button" class="${i ? '' : 'on'}" data-thumb="${i}" aria-label="Ver foto ${i + 1}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>
          ` : ''}
        </div>
        <div class="detail">
          ${cat ? `<div class="detail-cat">${esc(cat)}</div>` : ''}
          <h2>${esc(p.name)}</h2>
          <div>${priceHtml.replace('<div', '<span').replace('</div>', '</span>')}${p.sold_out ? '<span class="badge out detail-status">Esgotado</span>' : ''}</div>
          ${p.description ? `<p class="detail-desc">${esc(p.description)}</p>` : ''}
          <div class="detail-actions">${buyBtn}${shareBtn('', 'Compartilhar')}</div>
        </div>
      </div>
      <div class="buybar">${buyBtn}${shareBtn('btn-share', '')}</div>`;

    document.body.append(backdrop, sheet);
    document.body.classList.add('lock');
    els.fab.classList.add('hide');
    requestAnimationFrame(() => { backdrop.classList.add('show'); sheet.classList.add('show'); });
    sheet.tabIndex = -1;
    sheet.focus({ preventScroll: true });

    // galeria: pontinhos e miniaturas acompanham o deslize
    const slides = $('#slides', sheet);
    if (imgs.length > 1) {
      let raf;
      slides.addEventListener('scroll', () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => setSlide(Math.round(slides.scrollLeft / slides.clientWidth)));
      }, { passive: true });
    }

    if (opts.push !== false) {
      history.pushState({ p: id }, '', '?p=' + encodeURIComponent(id));
    }
    return true;
  }

  function setSlide(i) {
    if (!sheet) return;
    sheet.querySelectorAll('#dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    sheet.querySelectorAll('#thumbs button').forEach((d, k) => d.classList.toggle('on', k === i));
  }

  function goSlide(i) {
    const slides = $('#slides', sheet);
    if (!slides) return;
    const n = slides.children.length;
    i = (i + n) % n;
    slides.scrollTo({ left: i * slides.clientWidth, behavior: 'smooth' });
    setSlide(i);
  }
  function currentSlide() {
    const s = $('#slides', sheet);
    return s ? Math.round(s.scrollLeft / s.clientWidth) : 0;
  }

  function closeSheetDom(immediate) {
    const s = sheet, b = backdrop;
    sheet = backdrop = null;
    state.open = null;
    if (!s) return;
    document.body.classList.remove('lock');
    if (state.settings && whatsappUrl(state.settings, null)) els.fab.classList.remove('hide');
    if (immediate) { s.remove(); b.remove(); return; }
    s.classList.remove('show');
    b.classList.remove('show');
    setTimeout(() => { s.remove(); b.remove(); }, 320);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) {} }
  }

  function closeProduct() {
    if (!state.open) return;
    if (history.state && history.state.p) history.back(); // popstate fecha
    else {
      closeSheetDom();
      history.replaceState(null, '', location.pathname);
    }
  }

  async function shareProduct() {
    const p = state.open;
    if (!p) return;
    const url = DM.productUrl(p.id);
    const data = { title: p.name, text: `${p.name} — ${formatPrice(p.price, 'consulte o valor')}`, url };
    if (navigator.share) {
      try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    toast((await DM.copyText(url)) ? 'Link do produto copiado!' : 'Não foi possível copiar o link');
  }

  function openLightbox(i) {
    const p = state.open;
    if (!p) return;
    const url = (p.images && p.images[i]) || PLACEHOLDER;
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `<img src="${esc(url)}" alt="${esc(p.name)}"><button type="button" aria-label="Fechar zoom">&times;</button>`;
    const close = () => { lb.classList.remove('show'); setTimeout(() => lb.remove(), 200); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    lb.addEventListener('click', close);
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(lb);
    requestAnimationFrame(() => lb.classList.add('show'));
  }

  /* ----------------------------------------------------------- eventos */
  document.addEventListener('click', (e) => {
    const t = e.target;
    const chip = t.closest('.chip');
    if (chip) {
      state.cat = chip.dataset.cat;
      renderChips(); renderGrid();
      return;
    }
    if (t.closest('[data-reset]')) {
      state.cat = 'all'; state.q = ''; els.q.value = ''; els.qClear.hidden = true;
      renderChips(); renderGrid();
      return;
    }
    const card = t.closest('.card');
    if (card) { openProduct(card.dataset.id); return; }
    if (!sheet) return;
    if (t.closest('[data-close]')) closeProduct();
    else if (t.closest('[data-share]')) shareProduct();
    else if (t.closest('[data-nav]')) goSlide(currentSlide() + Number(t.closest('[data-nav]').dataset.nav));
    else if (t.closest('[data-thumb]')) goSlide(Number(t.closest('[data-thumb]').dataset.thumb));
    else if (t.closest('[data-zoom]')) openLightbox(Number(t.closest('[data-zoom]').dataset.zoom));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet) { closeProduct(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('card')) {
      e.preventDefault();
      openProduct(e.target.dataset.id);
    }
    if (sheet && e.key === 'ArrowRight') goSlide(currentSlide() + 1);
    if (sheet && e.key === 'ArrowLeft') goSlide(currentSlide() - 1);
  });

  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(location.search).get('p');
    if (id) openProduct(id, { push: false });
    else closeSheetDom();
  });

  els.q.addEventListener('input', DM.debounce(() => {
    state.q = els.q.value;
    els.qClear.hidden = !state.q;
    renderGrid();
  }, 120));
  els.qClear.addEventListener('click', () => {
    els.q.value = ''; state.q = ''; els.qClear.hidden = true; renderGrid(); els.q.focus();
  });

  /* ----------------------------------------------------------- início */
  (async function init() {
    if (DM.demo) $('#demo-banner').hidden = false;
    showSkeleton();
    try {
      await DM.ready();
      const [settings, categories, products] = await Promise.all([
        DM.db.getSettings(), DM.db.listCategories(), DM.db.listProducts(),
      ]);
      state.settings = settings;
      state.categories = categories;
      state.products = products;
    } catch (err) {
      console.error(err);
      els.grid.innerHTML = '';
      els.grid.hidden = true;
      els.state.innerHTML = stateBlock('Não conseguimos carregar o catálogo', 'Verifique sua internet e tente de novo.', '<button class="btn btn-dark" type="button" onclick="location.reload()">Tentar novamente</button>');
      return;
    }
    applyBrand();
    renderChips();
    renderGrid();

    // link direto para um produto (?p=ID)
    const id = new URLSearchParams(location.search).get('p');
    if (id) {
      if (!openProduct(id, { push: false })) history.replaceState(null, '', location.pathname);
    }
  })();
})();
