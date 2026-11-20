/* Painel de administração do catálogo */
(function () {
  'use strict';

  const DM = window.DM;
  const { esc, formatPrice, parsePrice, normalizePhone, formatPhone, normalizeText, toast, PLACEHOLDER } = DM;
  const app = document.getElementById('app');
  const LOGO_DEFAULT = '../assets/img/logo.png';

  const S = {
    session: null,
    tab: 'products',
    settings: null,
    categories: [],
    products: [],
    q: '',
    cat: '',
    logo: null, // { blob, preview } | { remove: true }
  };

  /* ----------------------------------------------------------- ícones */
  const I = (d) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICON = {
    box: I('<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M12 12 4 7.5M12 12l8-4.5M12 12v9"/>'),
    tag: I('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>'),
    gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    edit: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
    trash: I('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>'),
    eye: I('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>'),
    eyeOff: I('<path d="M17.9 17.9A10.9 10.9 0 0 1 12 19C5 19 1 12 1 12a18.4 18.4 0 0 1 5.1-5.9M9.9 4.2A10.7 10.7 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.2 3.2M1 1l22 22"/><path d="M14.1 14.1a3 3 0 1 1-4.2-4.2"/>'),
    up: I('<path d="m6 15 6-6 6 6"/>'),
    down: I('<path d="m6 9 6 6 6-6"/>'),
    camera: I('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>'),
    trashFill: I('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  };

  /* ----------------------------------------------------------- helpers */
  const $ = (s, r) => (r || document).querySelector(s);
  const catName = (id) => (S.categories.find((c) => c.id === id) || {}).name || '';

  function humanize(err) {
    const m = String((err && (err.message || err.error_description)) || err || '');
    if (/invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/email not confirmed/i.test(m)) return 'E-mail ainda não confirmado. Confirme no Supabase (Authentication > Users).';
    if (/row-level security|permission denied|not allowed/i.test(m)) return 'Sem permissão para salvar. Seu e-mail está na tabela admin_emails?';
    if (/jwt|token.*expired|session/i.test(m)) return 'Sua sessão expirou. Entre novamente.';
    if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Sem conexão com a internet. Tente de novo.';
    if (/payload too large|too large|exceeded/i.test(m)) return 'A foto é grande demais. Tente outra.';
    if (/password.*(at least|should be)/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    return m || 'Algo deu errado. Tente de novo.';
  }

  /** Desativa o botão enquanto roda a ação */
  async function busy(btn, label, fn) {
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.textContent = label; }
    try { return await fn(); }
    finally { if (btn && btn.isConnected) { btn.disabled = false; btn.innerHTML = old; } }
  }

  async function loadAll() {
    const [settings, categories, products] = await Promise.all([
      DM.db.getSettings(), DM.db.listCategories(), DM.db.listProducts({ all: true }),
    ]);
    S.settings = settings; S.categories = categories; S.products = products;
  }
  async function refreshProducts() { S.products = await DM.db.listProducts({ all: true }); }
  async function refreshCategories() { S.categories = await DM.db.listCategories(); }

  /* ----------------------------------------------------------- login */
  function renderLogin(message) {
    app.innerHTML = `
      ${DM.demo ? '<div class="demo-banner" style="position:fixed;top:0;left:0;right:0;z-index:5">MODO DEMONSTRAÇÃO — digite qualquer e-mail e senha. Os dados ficam só neste navegador.</div>' : ''}
      <div class="login">
        <form class="login-card" id="login" novalidate>
          <img src="${LOGO_DEFAULT}" alt="DM Impressão 3D">
          <h1>Painel do catálogo</h1>
          <p class="sub">Acesso restrito</p>
          ${message ? `<p class="form-error" role="alert">${esc(message)}</p>` : ''}
          <label class="field"><span class="label">E-mail</span>
            <input class="input" id="l-email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" required></label>
          <label class="field"><span class="label">Senha</span>
            <input class="input" id="l-pass" type="password" autocomplete="current-password" required></label>
          <label style="display:flex;gap:8px;align-items:center;font-size:14px;color:var(--warm);margin:-4px 0 18px">
            <input type="checkbox" id="l-show"> Mostrar senha</label>
          <button class="btn btn-block" type="submit">Entrar</button>
        </form>
      </div>`;
    $('#l-show').addEventListener('change', (e) => { $('#l-pass').type = e.target.checked ? 'text' : 'password'; });
    $('#login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = $('#l-email').value.trim();
      const pass = $('#l-pass').value;
      if (!email || !pass) return renderLoginKeep('Preencha e-mail e senha.', email);
      try {
        await busy($('#login button[type=submit]'), 'Entrando…', async () => {
          S.session = await DM.db.auth.signIn(email, pass);
          await loadAll();
        });
        render();
      } catch (err) {
        S.session = null;
        renderLoginKeep(humanize(err), email);
      }
    });
  }
  function renderLoginKeep(msg, email) {
    renderLogin(msg);
    $('#l-email').value = email || '';
    (email ? $('#l-pass') : $('#l-email')).focus();
  }

  async function logout(message) {
    try { await DM.db.auth.signOut(); } catch (e) {}
    S.session = null;
    renderLogin(message);
  }

  /* ----------------------------------------------------------- estrutura */
  function render() {
    if (!S.session) return renderLogin();
    const logo = S.settings.logo_url || LOGO_DEFAULT;
    const tab = (id, label, icon) =>
      `<button type="button" role="tab" data-act="tab" data-tab="${id}" aria-selected="${S.tab === id}">${icon}<span>${label}</span></button>`;
    app.innerHTML = `
      ${DM.demo ? '<div class="demo-banner">MODO DEMONSTRAÇÃO — dados salvos só neste navegador. Configure o Supabase (README) para usar de verdade.</div>' : ''}
      <header class="a-top">
        <img src="${esc(logo)}" alt="">
        <div class="t"><strong>Painel</strong><small>${esc(S.settings.store_name || 'DM Impressão 3D')}</small></div>
        <a class="btn btn-ghost btn-sm" href="${esc(DM.productUrl())}" target="_blank" rel="noopener">Ver catálogo</a>
        <button class="btn btn-ghost btn-sm hide-s" type="button" data-act="logout">Sair</button>
      </header>
      <nav class="a-tabs" role="tablist" aria-label="Seções">
        ${tab('products', 'Produtos', ICON.box)}${tab('categories', 'Categorias', ICON.tag)}${tab('settings', 'Configurações', ICON.gear)}
      </nav>
      <main class="a-main" id="view"></main>`;
    renderTab();
  }

  function renderTab() {
    const v = $('#view');
    if (S.tab === 'products') v.innerHTML = productsView();
    else if (S.tab === 'categories') v.innerHTML = categoriesView();
    else v.innerHTML = settingsView();
    if (S.tab === 'settings') bindSettings();
  }

  /* ----------------------------------------------------------- produtos */
  function productsView() {
    const catOpts = S.categories.map((c) => `<option value="${esc(c.id)}"${S.cat === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
    return `
      <div class="a-head"><h2>Produtos <small id="count" style="font:600 14px var(--f-sub);color:var(--mid)"></small></h2>
        <button class="btn fab-add" type="button" data-act="new-product">${ICON.plus}<span>Novo produto</span></button></div>
      <div class="toolbar">
        <input class="input" id="p-search" type="search" placeholder="Buscar produto…" value="${esc(S.q)}" aria-label="Buscar produto">
        ${S.categories.length ? `<select class="select" id="p-cat" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option>${catOpts}</select>` : ''}
      </div>
      <div class="plist" id="plist">${plistHtml()}</div>`;
  }

  function filteredProducts() {
    const q = normalizeText(S.q.trim());
    return S.products.filter((p) => (!S.cat || p.category_id === S.cat) && (!q || normalizeText(p.name).includes(q)));
  }

  function plistHtml() {
    const list = filteredProducts();
    const total = S.products.length;
    queueMicrotask(() => { const c = $('#count'); if (c) c.textContent = total ? `(${list.length}${list.length !== total ? ' de ' + total : ''})` : ''; });
    if (!total) {
      return `<div class="empty"><h3>Nenhum produto ainda</h3><p>Cadastre o primeiro produto com até 3 fotos, valor e descrição.</p>
        <button class="btn" type="button" data-act="new-product">${ICON.plus}Cadastrar produto</button></div>`;
    }
    if (!list.length) return '<div class="empty"><h3>Nada encontrado</h3><p>Nenhum produto com esse filtro.</p></div>';
    return list.map(rowHtml).join('');
  }

  function rowHtml(p) {
    const img = (p.images && p.images[0]) || PLACEHOLDER;
    const cat = catName(p.category_id);
    const price = p.price == null ? '<span class="price" style="color:var(--warm)">Consulte</span>' : `<span class="price">${esc(formatPrice(p.price))}</span>`;
    const tags = [
      !p.active ? '<span class="tag dark">Oculto</span>' : '',
      p.sold_out ? '<span class="tag dark">Esgotado</span>' : '',
      p.featured ? '<span class="tag gold">Destaque</span>' : '',
      `<span class="tag">${(p.images || []).length}/3 fotos</span>`,
    ].join('');
    return `
      <div class="prow${p.active ? '' : ' is-hidden'}">
        <div class="thumb" data-act="edit-product" data-id="${esc(p.id)}"><img src="${esc(img)}" alt="" loading="lazy"></div>
        <div class="info" data-act="edit-product" data-id="${esc(p.id)}">
          <div class="name">${esc(p.name)}</div>
          <div class="meta">${price}${cat ? ' · ' + esc(cat) : ''}</div>
          <div class="tags">${tags}</div>
        </div>
        <div class="acts">
          <button class="icon-btn" type="button" data-act="toggle-active" data-id="${esc(p.id)}"
                  aria-label="${p.active ? 'Ocultar do catálogo' : 'Mostrar no catálogo'}" title="${p.active ? 'Ocultar do catálogo' : 'Mostrar no catálogo'}">${p.active ? ICON.eye : ICON.eyeOff}</button>
          <button class="icon-btn" type="button" data-act="edit-product" data-id="${esc(p.id)}" aria-label="Editar ${esc(p.name)}" title="Editar">${ICON.edit}</button>
        </div>
      </div>`;
  }

  function redrawList() { const l = $('#plist'); if (l) l.innerHTML = plistHtml(); }

  /* ----------------------------------------------------------- editor de produto */
  let ed = null;

  function openEditor(p) {
    ed = p
      ? {
          id: p.id, name: p.name, description: p.description || '',
          price: p.price == null ? '' : String(p.price).replace('.', ','),
          category_id: p.category_id || '', active: !!p.active, sold_out: !!p.sold_out, featured: !!p.featured,
          images: (p.images || []).map((url) => ({ url })), removed: [],
        }
      : { id: null, name: '', description: '', price: '', category_id: '', active: true, sold_out: false, featured: false, images: [], removed: [] };
    mountEditor();
  }

  function mountEditor() {
    closeEditorDom();
    const ov = document.createElement('div');
    ov.className = 'ov';
    ov.id = 'ov';
    const sw = (id, title, sub, on) => `
      <div class="toggle-row"><div><b>${title}</b><small>${sub}</small></div>
        <label class="switch"><input type="checkbox" id="${id}"${on ? ' checked' : ''} aria-label="${title}"><i></i></label></div>`;
    ov.innerHTML = `
      <form class="ed" id="edform" novalidate role="dialog" aria-modal="true" aria-label="${ed.id ? 'Editar produto' : 'Novo produto'}">
        <div class="ed-head"><h2>${ed.id ? 'Editar produto' : 'Novo produto'}</h2>
          <button class="icon-btn" type="button" data-act="ed-close" aria-label="Fechar" style="font-size:24px">&times;</button></div>
        <div class="ed-body">
          <div class="field"><span class="label">Fotos (até 3)</span>
            <div class="photos" id="photos"></div>
            <p class="hint">A 1ª foto é a capa que aparece na lista. Fotos de celular são reduzidas automaticamente.</p>
            <input type="file" id="ph-input" accept="image/*" multiple hidden></div>
          <label class="field"><span class="label">Nome do produto *</span>
            <input class="input" id="f-name" maxlength="120" autocomplete="off" value="${esc(ed.name)}" placeholder="Ex.: Vaso Facetado Low Poly"></label>
          <div class="row2">
            <label class="field"><span class="label">Valor (R$)</span>
              <input class="input" id="f-price" inputmode="decimal" autocomplete="off" value="${esc(ed.price)}" placeholder="Ex.: 59,90"></label>
            <label class="field"><span class="label">Categoria</span>
              <select class="select" id="f-cat"><option value="">Sem categoria</option>
                ${S.categories.map((c) => `<option value="${esc(c.id)}"${ed.category_id === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}
              </select></label>
          </div>
          <p class="hint" style="margin:-8px 0 16px">Deixe o valor em branco para mostrar “Consulte o valor”.</p>
          <label class="field"><span class="label">Descrição</span>
            <textarea class="textarea" id="f-desc" maxlength="2000" placeholder="Medidas, material, cores disponíveis, prazo…">${esc(ed.description)}</textarea></label>
          ${sw('f-active', 'Visível no catálogo', 'Desligue para esconder sem apagar', ed.active)}
          ${sw('f-out', 'Esgotado', 'Mostra a etiqueta “Esgotado” para o cliente', ed.sold_out)}
          ${sw('f-feat', 'Destaque', 'Aparece primeiro na lista', ed.featured)}
        </div>
        <div class="ed-foot">
          ${ed.id ? `<button class="btn btn-danger" type="button" data-act="ed-delete" aria-label="Apagar produto" title="Apagar produto">${ICON.trash}</button>` : ''}
          <button class="btn btn-ghost" type="button" data-act="ed-close">Cancelar</button>
          <button class="btn" type="submit" id="ed-save">Salvar</button>
        </div>
      </form>`;
    document.body.appendChild(ov);
    document.body.classList.add('lock');
    renderPhotos();

    ov.addEventListener('mousedown', (e) => { ov._down = e.target === ov; });
    ov.addEventListener('click', (e) => { if (e.target === ov && ov._down) requestCloseEditor(); });

    $('#f-name', ov).addEventListener('input', (e) => (ed.name = e.target.value));
    $('#f-price', ov).addEventListener('input', (e) => (ed.price = e.target.value));
    $('#f-cat', ov).addEventListener('change', (e) => (ed.category_id = e.target.value));
    $('#f-desc', ov).addEventListener('input', (e) => (ed.description = e.target.value));
    $('#f-active', ov).addEventListener('change', (e) => (ed.active = e.target.checked));
    $('#f-out', ov).addEventListener('change', (e) => (ed.sold_out = e.target.checked));
    $('#f-feat', ov).addEventListener('change', (e) => (ed.featured = e.target.checked));
    $('#ph-input', ov).addEventListener('change', onPhotosPicked);
    $('#edform', ov).addEventListener('submit', (e) => { e.preventDefault(); saveProduct(); });
    if (!ed.id) $('#f-name', ov).focus({ preventScroll: true });
  }

  function closeEditorDom() {
    const ov = $('#ov');
    if (ov) ov.remove();
    document.body.classList.remove('lock');
  }
  function closeEditor() {
    if (ed) ed.images.forEach((i) => i.preview && URL.revokeObjectURL(i.preview));
    ed = null;
    closeEditorDom();
  }
  function requestCloseEditor() {
    if (ed && isDirty() && !confirm('Descartar as alterações deste produto?')) return;
    closeEditor();
  }
  function isDirty() {
    if (!ed) return false;
    const orig = ed.id ? S.products.find((p) => p.id === ed.id) : null;
    if (!orig) return !!(ed.name || ed.description || ed.price || ed.images.length);
    return (
      ed.name !== orig.name || (ed.description || '') !== (orig.description || '') ||
      String(parsePrice(ed.price)) !== String(orig.price == null ? null : Number(orig.price)) ||
      (ed.category_id || '') !== (orig.category_id || '') || ed.active !== !!orig.active ||
      ed.sold_out !== !!orig.sold_out || ed.featured !== !!orig.featured ||
      ed.images.length !== (orig.images || []).length || ed.images.some((im, i) => im.url !== (orig.images || [])[i])
    );
  }

  function renderPhotos() {
    const box = $('#photos');
    if (!box || !ed) return;
    box.innerHTML = [0, 1, 2]
      .map((i) => {
        const im = ed.images[i];
        if (im) {
          return `<div class="ph${im.busy ? ' busy' : ''}">
            ${im.busy ? '' : `<img src="${esc(im.preview || im.url)}" alt="Foto ${i + 1}">`}
            <button type="button" class="x" data-act="ph-del" data-i="${i}" aria-label="Remover foto ${i + 1}">&times;</button>
            ${im.busy ? '' : i === 0 ? '<span class="cover is-cover">Capa</span>' : `<button type="button" class="cover" data-act="ph-cover" data-i="${i}">Tornar capa</button>`}
          </div>`;
        }
        if (i === ed.images.length) return `<button type="button" class="ph add" data-act="ph-add">${ICON.camera}<span>Adicionar foto</span></button>`;
        return '<div class="ph empty-slot" aria-hidden="true"></div>';
      })
      .join('');
  }

  async function onPhotosPicked(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!ed || !files.length) return;
    const room = 3 - ed.images.length;
    if (files.length > room) toast(room ? `Só cabem 3 fotos — usei as primeiras ${room}.` : 'Este produto já tem 3 fotos.', room ? '' : 'error');
    for (const f of files.slice(0, Math.max(room, 0))) {
      const slot = { busy: true };
      ed.images.push(slot);
      renderPhotos();
      try {
        const blob = await DM.compressImage(f, { maxDim: 1200, quality: 0.82 });
        if (!ed || ed.images.indexOf(slot) === -1) continue; // removida/fechada enquanto processava
        slot.blob = blob;
        slot.preview = URL.createObjectURL(blob);
        slot.busy = false;
      } catch (err) {
        if (ed) { const k = ed.images.indexOf(slot); if (k > -1) ed.images.splice(k, 1); }
        toast('Não consegui ler essa foto. Tente uma imagem JPG ou PNG.', 'error');
      }
      renderPhotos();
    }
  }

  async function saveProduct() {
    if (!ed) return;
    const name = ed.name.trim();
    if (!name) { toast('Digite o nome do produto.', 'error'); $('#f-name').focus(); return; }
    const price = parsePrice(ed.price);
    if (Number.isNaN(price)) { toast('Valor inválido. Exemplo: 59,90', 'error'); $('#f-price').focus(); return; }
    if (ed.images.some((i) => i.busy)) { toast('Aguarde as fotos terminarem de carregar.', 'error'); return; }

    const uploaded = [];
    try {
      await busy($('#ed-save'), 'Salvando…', async () => {
        const urls = [];
        for (const im of ed.images) {
          if (im.url) urls.push(im.url);
          else { const u = await DM.db.uploadImage(im.blob, 'p'); uploaded.push(u); urls.push(u); }
        }
        await DM.db.saveProduct({
          id: ed.id, name, description: ed.description.trim(), price, category_id: ed.category_id || null,
          images: urls, active: ed.active, sold_out: ed.sold_out, featured: ed.featured,
        });
        if (ed.removed.length) DM.db.removeImages(ed.removed);
        await refreshProducts();
      });
      closeEditor();
      if ($('#plist')) redrawList();
      toast('Produto salvo!', 'ok');
    } catch (err) {
      if (uploaded.length) DM.db.removeImages(uploaded);
      console.error(err);
      toast(humanize(err), 'error');
    }
  }

  async function deleteProduct() {
    if (!ed || !ed.id) return;
    if (!confirm(`Apagar “${ed.name}” de vez?\nIsso não pode ser desfeito. (Para só esconder, use “Visível no catálogo”.)`)) return;
    const p = S.products.find((x) => x.id === ed.id);
    try {
      await busy($('#ed-save'), 'Apagando…', async () => {
        await DM.db.deleteProduct(ed.id);
        if (p) DM.db.removeImages(p.images || []);
        await refreshProducts();
      });
      closeEditor();
      redrawList();
      toast('Produto apagado.');
    } catch (err) { toast(humanize(err), 'error'); }
  }

  /* ----------------------------------------------------------- categorias */
  function categoriesView() {
    const count = (id) => S.products.filter((p) => p.category_id === id).length;
    return `
      <div class="a-head"><h2>Categorias</h2></div>
      <div class="panel">
        <h3>Nova categoria</h3>
        <p>Ex.: Decoração, Vasos, Presentes, Personalizados…</p>
        <form class="addrow" id="cat-form">
          <input class="input" id="cat-name" maxlength="40" placeholder="Nome da categoria" autocomplete="off" aria-label="Nome da categoria">
          <button class="btn" type="submit">Adicionar</button>
        </form>
      </div>
      <div class="panel">
        ${S.categories.length
          ? S.categories.map((c, i) => `
            <div class="crow">
              <div class="n">${esc(c.name)}<small>${count(c.id)} produto${count(c.id) === 1 ? '' : 's'}</small></div>
              <button class="icon-btn" type="button" data-act="cat-up" data-id="${esc(c.id)}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button>
              <button class="icon-btn" type="button" data-act="cat-down" data-id="${esc(c.id)}" aria-label="Descer" ${i === S.categories.length - 1 ? 'disabled' : ''}>${ICON.down}</button>
              <button class="icon-btn" type="button" data-act="cat-rename" data-id="${esc(c.id)}" aria-label="Renomear ${esc(c.name)}">${ICON.edit}</button>
              <button class="icon-btn danger" type="button" data-act="cat-del" data-id="${esc(c.id)}" aria-label="Apagar ${esc(c.name)}">${ICON.trash}</button>
            </div>`).join('')
          : '<p style="margin:0;color:var(--warm)">Nenhuma categoria ainda. As categorias viram botões de filtro no catálogo.</p>'}
      </div>`;
  }

  async function addCategory(form) {
    const input = $('#cat-name', form);
    const name = input.value.trim();
    if (!name) { input.focus(); return; }
    if (S.categories.some((c) => normalizeText(c.name) === normalizeText(name))) { toast('Essa categoria já existe.', 'error'); return; }
    try {
      await busy($('button', form), 'Adicionando…', async () => {
        const max = S.categories.reduce((m, c) => Math.max(m, c.sort_order || 0), 0);
        await DM.db.createCategory(name, max + 1);
        await refreshCategories();
      });
      renderTab();
      $('#cat-name').focus();
    } catch (err) { toast(humanize(err), 'error'); }
  }

  async function moveCategory(id, dir) {
    const i = S.categories.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= S.categories.length) return;
    const list = S.categories.slice();
    [list[i], list[j]] = [list[j], list[i]];
    try {
      await Promise.all(list.map((c, k) => (c.sort_order !== k + 1 ? DM.db.updateCategory(c.id, { sort_order: k + 1 }) : null)).filter(Boolean));
      await refreshCategories();
      renderTab();
    } catch (err) { toast(humanize(err), 'error'); }
  }

  async function renameCategory(id) {
    const c = S.categories.find((x) => x.id === id);
    const name = (prompt('Novo nome da categoria:', c.name) || '').trim();
    if (!name || name === c.name) return;
    try { await DM.db.updateCategory(id, { name }); await refreshCategories(); renderTab(); }
    catch (err) { toast(humanize(err), 'error'); }
  }

  async function deleteCategory(id) {
    const c = S.categories.find((x) => x.id === id);
    const n = S.products.filter((p) => p.category_id === id).length;
    if (!confirm(`Apagar a categoria “${c.name}”?${n ? `\n${n} produto(s) ficarão sem categoria (não serão apagados).` : ''}`)) return;
    try { await DM.db.deleteCategory(id); await Promise.all([refreshCategories(), refreshProducts()]); renderTab(); toast('Categoria apagada.'); }
    catch (err) { toast(humanize(err), 'error'); }
  }

  /* ----------------------------------------------------------- configurações */
  function settingsView() {
    const s = S.settings;
    const logo = S.logo && S.logo.preview ? S.logo.preview : S.logo && S.logo.remove ? LOGO_DEFAULT : s.logo_url || LOGO_DEFAULT;
    return `
      <div class="a-head"><h2>Configurações</h2></div>

      <div class="panel">
        <h3>Link do catálogo para os clientes</h3>
        <p>Este é o link que você manda no grupo do WhatsApp. Quem abrir só consegue ver os produtos e chamar vocês no WhatsApp — não consegue editar nada.</p>
        <div class="linkbox">
          <input class="input" id="s-link" readonly value="${esc(DM.productUrl())}" aria-label="Link do catálogo" onfocus="this.select()">
          <button class="btn btn-dark" type="button" data-act="copy-link">Copiar</button>
        </div>
      </div>

      <form id="s-form" novalidate>
        <div class="panel">
          <h3>WhatsApp de vendas</h3>
          <p>O botão “Chamar no WhatsApp” abre uma conversa com este número, já com o nome e o valor do produto.</p>
          <label class="field"><span class="label">Número com DDD</span>
            <input class="input" id="s-wa" inputmode="tel" autocomplete="off" placeholder="(11) 99999-9999" value="${esc(s.whatsapp ? formatPhone(s.whatsapp) : '')}"></label>
          <label class="field" style="margin-bottom:0"><span class="label">Mensagem pronta</span>
            <textarea class="textarea" id="s-msg" style="min-height:96px">${esc(s.whatsapp_message || '')}</textarea>
            <span class="hint">Use <b>{produto}</b>, <b>{preco}</b> e <b>{link}</b> — eles são trocados pelos dados do produto.</span></label>
        </div>

        <div class="panel">
          <h3>Identidade da loja</h3>
          <p>Nome e frase que aparecem no topo do catálogo.</p>
          <label class="field"><span class="label">Nome da loja</span>
            <input class="input" id="s-name" maxlength="60" value="${esc(s.store_name || '')}"></label>
          <label class="field"><span class="label">Frase (slogan)</span>
            <input class="input" id="s-tag" maxlength="60" value="${esc(s.tagline || '')}"></label>
          <span class="label" style="display:block;margin-bottom:6px;font:600 13px var(--f-sub);color:var(--warm)">Logo</span>
          <div class="logo-row">
            <div class="lg"><img id="s-logo-img" src="${esc(logo)}" alt="Logo atual"></div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <button class="btn btn-ghost btn-sm" type="button" data-act="logo-pick">Trocar logo</button>
              <button class="btn btn-ghost btn-sm" type="button" data-act="logo-reset">Usar o logo padrão</button>
              <input type="file" id="s-logo-file" accept="image/png,image/webp,image/jpeg" hidden>
            </div>
          </div>
          <p class="hint">Dica: use PNG com fundo transparente, de pelo menos 400 × 400 px.</p>
        </div>

        <div class="save-bar"><button class="btn btn-block" type="submit" id="s-save">Salvar configurações</button></div>
      </form>

      <form class="panel" id="pw-form" novalidate>
        <h3>Trocar minha senha</h3>
        <p>Use pelo menos 8 caracteres.</p>
        <label class="field"><span class="label">Nova senha</span>
          <input class="input" id="pw-new" type="password" autocomplete="new-password" minlength="8"></label>
        <button class="btn btn-dark" type="submit">Trocar senha</button>
      </form>

      <div class="panel">
        <h3>Sessão</h3>
        <p style="margin-bottom:12px">Conectado como <b>${esc((S.session && S.session.email) || '')}</b></p>
        <button class="btn btn-ghost" type="button" data-act="logout">Sair do painel</button>
      </div>`;
  }

  function bindSettings() {
    $('#s-form').addEventListener('submit', (e) => { e.preventDefault(); saveSettings(); });
    $('#pw-form').addEventListener('submit', (e) => { e.preventDefault(); changePassword(); });
    $('#s-logo-file').addEventListener('change', async (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const blob = await DM.compressImage(f, { maxDim: 600, type: 'image/png' });
        if (S.logo && S.logo.preview) URL.revokeObjectURL(S.logo.preview);
        S.logo = { blob, preview: URL.createObjectURL(blob) };
        $('#s-logo-img').src = S.logo.preview;
        toast('Logo escolhido — toque em “Salvar configurações”.');
      } catch (err) { toast('Não consegui ler essa imagem.', 'error'); }
    });
  }

  async function saveSettings() {
    const waRaw = $('#s-wa').value.trim();
    const wa = normalizePhone(waRaw);
    if (waRaw && (wa.length < 12 || wa.length > 15)) {
      toast('WhatsApp inválido. Use DDD + número, ex.: (11) 99999-9999', 'error');
      $('#s-wa').focus();
      return;
    }
    const name = $('#s-name').value.trim() || 'DM Impressão 3D';
    const patch = {
      store_name: name,
      tagline: $('#s-tag').value.trim(),
      whatsapp: wa,
      whatsapp_message: $('#s-msg').value.trim() || 'Olá! Tenho interesse no produto *{produto}* ({preco}). Pode me ajudar? {link}',
    };
    let newLogo = null;
    try {
      await busy($('#s-save'), 'Salvando…', async () => {
        const oldLogo = S.settings.logo_url;
        if (S.logo && S.logo.blob) { newLogo = await DM.db.uploadImage(S.logo.blob, 'brand'); patch.logo_url = newLogo; }
        else if (S.logo && S.logo.remove) patch.logo_url = null;
        S.settings = Object.assign({}, S.settings, await DM.db.saveSettings(patch));
        if ((newLogo || (S.logo && S.logo.remove)) && oldLogo) DM.db.removeImages([oldLogo]);
      });
      S.logo = null;
      render();
      toast('Configurações salvas!', 'ok');
    } catch (err) {
      if (newLogo) DM.db.removeImages([newLogo]);
      toast(humanize(err), 'error');
    }
  }

  async function changePassword() {
    const input = $('#pw-new');
    if (input.value.length < 8) { toast('A senha precisa ter pelo menos 8 caracteres.', 'error'); input.focus(); return; }
    try {
      await busy($('#pw-form button'), 'Trocando…', () => DM.db.auth.updatePassword(input.value));
      input.value = '';
      toast('Senha trocada!', 'ok');
    } catch (err) { toast(humanize(err), 'error'); }
  }

  /* ----------------------------------------------------------- eventos */
  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const id = el.dataset.id;
    switch (act) {
      case 'tab': S.tab = el.dataset.tab; render(); window.scrollTo(0, 0); break;
      case 'logout': await logout(); break;
      case 'new-product': openEditor(null); break;
      case 'edit-product': openEditor(S.products.find((p) => p.id === id)); break;
      case 'toggle-active': {
        const p = S.products.find((x) => x.id === id);
        const next = !p.active;
        p.active = next; redrawList();
        try { await DM.db.setProductActive(id, next); toast(next ? 'Produto visível no catálogo.' : 'Produto oculto do catálogo.'); }
        catch (err) { p.active = !next; redrawList(); toast(humanize(err), 'error'); }
        break;
      }
      case 'ed-close': requestCloseEditor(); break;
      case 'ed-delete': await deleteProduct(); break;
      case 'ph-add': $('#ph-input').click(); break;
      case 'ph-del': {
        const i = Number(el.dataset.i);
        const [im] = ed.images.splice(i, 1);
        if (im.url) ed.removed.push(im.url);
        if (im.preview) URL.revokeObjectURL(im.preview);
        renderPhotos();
        break;
      }
      case 'ph-cover': {
        const i = Number(el.dataset.i);
        const [im] = ed.images.splice(i, 1);
        ed.images.unshift(im);
        renderPhotos();
        break;
      }
      case 'cat-up': await moveCategory(id, -1); break;
      case 'cat-down': await moveCategory(id, 1); break;
      case 'cat-rename': await renameCategory(id); break;
      case 'cat-del': await deleteCategory(id); break;
      case 'copy-link': toast((await DM.copyText($('#s-link').value)) ? 'Link copiado! Cole no grupo do WhatsApp.' : 'Não foi possível copiar. Selecione e copie manualmente.', 'ok'); break;
      case 'logo-pick': $('#s-logo-file').click(); break;
      case 'logo-reset':
        if (S.logo && S.logo.preview) URL.revokeObjectURL(S.logo.preview);
        S.logo = { remove: true };
        $('#s-logo-img').src = LOGO_DEFAULT;
        toast('Logo padrão selecionado — toque em “Salvar configurações”.');
        break;
    }
  });

  document.addEventListener('submit', (e) => {
    if (e.target.id === 'cat-form') { e.preventDefault(); addCategory(e.target); }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'p-search') { S.q = e.target.value; redrawList(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'p-cat') { S.cat = e.target.value; redrawList(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ed) requestCloseEditor();
  });

  /* ----------------------------------------------------------- início */
  (async function init() {
    try {
      await DM.ready();
      S.session = await DM.db.auth.getSession();
      if (S.session && !(await DM.db.auth.isAdmin())) {
        await DM.db.auth.signOut();
        S.session = null;
      }
      if (S.session) await loadAll();
    } catch (err) {
      console.error(err);
      S.session = null;
      renderLogin(humanize(err));
      return;
    }
    render();
  })();
})();
