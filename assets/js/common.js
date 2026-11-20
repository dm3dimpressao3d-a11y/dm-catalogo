/* Funções utilitárias usadas pelo catálogo e pelo painel */
(function () {
  'use strict';

  const DM = (window.DM = window.DM || {});

  DM.esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  DM.formatPrice = function (value, fallback) {
    if (value === null || value === undefined || value === '' || isNaN(Number(value))) {
      return fallback === undefined ? 'Consulte o valor' : fallback;
    }
    return brl.format(Number(value));
  };

  /** "1.234,50" | "49,9" | "49.90" | "R$ 49" -> 1234.5 | 49.9 | 49.9 | 49  (null se vazio, NaN se inválido) */
  DM.parsePrice = function (text) {
    let t = String(text == null ? '' : text).replace(/[^\d.,]/g, '');
    if (!t) return null;
    if (t.includes(',')) {
      t = t.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
      t = t.replace(/\./g, '');
    }
    const n = Number(t);
    if (!isFinite(n) || n < 0 || n > 99999999) return NaN;
    return Math.round(n * 100) / 100;
  };

  /** Deixa só dígitos e acrescenta 55 (Brasil) quando o número vier sem DDI. */
  DM.normalizePhone = function (text) {
    let d = String(text || '').replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (d.length === 10 || d.length === 11) d = '55' + d;
    return d;
  };

  DM.formatPhone = function (digits) {
    const d = String(digits || '');
    const m = d.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : d;
  };

  DM.normalizeText = function (s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  };

  DM.productUrl = function (id) {
    const base = new URL(location.href);
    base.search = '';
    base.hash = '';
    // se estivermos no /admin/, o link do cliente fica na pasta de cima
    if (/\/admin\/?(index\.html)?$/.test(base.pathname)) base.pathname = base.pathname.replace(/admin\/?(index\.html)?$/, '');
    base.pathname = base.pathname.replace(/index\.html$/, '');
    return id ? base.href + '?p=' + encodeURIComponent(id) : base.href;
  };

  /** Monta o link do WhatsApp com a mensagem pronta. */
  DM.whatsappUrl = function (settings, product) {
    const number = DM.normalizePhone(settings && settings.whatsapp);
    if (!number) return '';
    let text;
    if (product) {
      const tpl =
        (settings && settings.whatsapp_message) ||
        'Olá! Tenho interesse no produto *{produto}* ({preco}). Pode me ajudar? {link}';
      text = tpl
        .replace(/\{produto\}/g, product.name)
        .replace(/\{preco\}/g, DM.formatPrice(product.price, 'valor a consultar'))
        .replace(/\{link\}/g, DM.productUrl(product.id));
    } else {
      text = 'Olá! Vim pelo catálogo da ' + ((settings && settings.store_name) || 'DM Impressão 3D') + ' e gostaria de ajuda.';
    }
    return 'https://wa.me/' + number + '?text=' + encodeURIComponent(text.trim());
  };

  /* ------------------------------------------------------------ toast */
  let toastTimer;
  DM.toast = function (message, kind) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.className = 'toast ' + (kind || '');
    el.textContent = message;
    // força reflow para reiniciar a animação
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), kind === 'error' ? 5200 : 2800);
  };

  DM.copyText = async function (text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove();
      return ok;
    }
  };

  DM.debounce = function (fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  };

  /**
   * Reduz a foto antes de enviar (fotos de celular têm 4-10 MB).
   * Resultado: no máximo `maxDim` px no maior lado, em WebP (ou JPEG se o navegador não gerar WebP).
   * Para logo/PNG com transparência use { type: 'image/png' }.
   */
  DM.compressImage = async function (file, opts) {
    opts = opts || {};
    const maxDim = opts.maxDim || 1200;
    const quality = opts.quality || 0.82;

    let bitmap;
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
      bitmap = await new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Imagem inválida')); };
        img.src = url;
      });
    }
    const w0 = bitmap.width || bitmap.naturalWidth;
    const h0 = bitmap.height || bitmap.naturalHeight;
    if (!w0 || !h0) throw new Error('Imagem inválida');
    const scale = Math.min(1, maxDim / Math.max(w0, h0));
    const w = Math.round(w0 * scale);
    const h = Math.round(h0 * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const wantType = opts.type || 'image/webp';
    if (wantType === 'image/jpeg') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    if (bitmap.close) bitmap.close();

    const toBlob = (type, q) => new Promise((res) => canvas.toBlob(res, type, q));
    let blob = await toBlob(wantType, quality);
    if (!blob || blob.type !== wantType) {
      // navegador não sabe gerar o formato pedido (ex.: WebP no Safari antigo)
      const fb = wantType === 'image/png' ? 'image/png' : 'image/jpeg';
      if (fb === 'image/jpeg') {
        const c2 = document.createElement('canvas');
        c2.width = w; c2.height = h;
        const x2 = c2.getContext('2d');
        x2.fillStyle = '#fff';
        x2.fillRect(0, 0, w, h);
        x2.drawImage(canvas, 0, 0);
        blob = await new Promise((res) => c2.toBlob(res, 'image/jpeg', 0.86));
      } else {
        blob = await toBlob('image/png');
      }
    }
    if (!blob) throw new Error('Não foi possível processar a imagem');
    return blob;
  };

  DM.extFromType = function (type) {
    return type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  };

  /** Imagem "sem foto" (SVG embutido) */
  DM.PLACEHOLDER =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#efece7"/>' +
        '<g fill="none" stroke="#b9b5b3" stroke-width="6" stroke-linejoin="round"><path d="M200 120l80 46v92l-80 46-80-46v-92z"/><path d="M200 212l80-46M200 212l-80-46M200 212v92"/></g></svg>'
    );
})();
