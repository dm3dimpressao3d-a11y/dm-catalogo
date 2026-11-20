/*
 * Camada de dados.
 *  - Com o Supabase configurado (config.js): usa o banco, o login e o storage de verdade.
 *  - Sem configurar: roda em MODO DEMONSTRAÇÃO (tudo salvo no localStorage do navegador),
 *    útil para testar o visual antes de ligar o banco.
 *
 * O resto do site só conversa com `DM.db`, então não importa qual dos dois está ativo.
 */
(function () {
  'use strict';

  const DM = (window.DM = window.DM || {});
  const cfg = window.DM_CONFIG || {};

  const configured =
    /^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(String(cfg.SUPABASE_URL || '').trim()) &&
    String(cfg.SUPABASE_ANON_KEY || '').length > 30 &&
    !/COLE_AQUI/.test(String(cfg.SUPABASE_ANON_KEY));

  DM.demo = !configured;

  const DEFAULT_SETTINGS = {
    id: 1,
    store_name: 'DM Impressão 3D',
    tagline: 'Ideias ganham forma',
    whatsapp: '',
    whatsapp_message: 'Olá! Tenho interesse no produto *{produto}* ({preco}). Pode me ajudar? {link}',
    logo_url: null,
  };

  const uid = () =>
    (crypto.randomUUID && crypto.randomUUID()) ||
    'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

  /* =================================================================
   *  SUPABASE
   * ================================================================= */
  function makeSupabase() {
    const BUCKET = 'produtos';
    let sb = null;

    function client() {
      if (sb) return sb;
      if (!window.supabase || !window.supabase.createClient) {
        throw new Error('Não foi possível carregar o Supabase. Verifique sua conexão com a internet.');
      }
      sb = window.supabase.createClient(cfg.SUPABASE_URL.trim(), cfg.SUPABASE_ANON_KEY.trim(), {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
      return sb;
    }

    const ok = ({ data, error }) => {
      if (error) throw error;
      return data;
    };

    const pathFromUrl = (url) => {
      const marker = '/object/public/' + BUCKET + '/';
      const i = String(url || '').indexOf(marker);
      return i === -1 ? null : decodeURIComponent(String(url).slice(i + marker.length).split('?')[0]);
    };

    return {
      mode: 'supabase',

      async getSettings() {
        const row = ok(await client().from('settings').select('*').eq('id', 1).maybeSingle());
        return Object.assign({}, DEFAULT_SETTINGS, row || {});
      },
      async saveSettings(patch) {
        const row = Object.assign({}, patch, { id: 1, updated_at: new Date().toISOString() });
        return ok(await client().from('settings').upsert(row).select().single());
      },

      async listCategories() {
        return ok(
          await client().from('categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true })
        );
      },
      async createCategory(name, sort_order) {
        return ok(await client().from('categories').insert({ name, sort_order }).select().single());
      },
      async updateCategory(id, patch) {
        return ok(await client().from('categories').update(patch).eq('id', id).select().single());
      },
      async deleteCategory(id) {
        ok(await client().from('categories').delete().eq('id', id));
      },

      async listProducts(opts) {
        let q = client()
          .from('products')
          .select('*')
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false });
        if (!(opts && opts.all)) q = q.eq('active', true);
        return ok(await q);
      },
      async saveProduct(p) {
        const row = {
          name: p.name,
          description: p.description || null,
          price: p.price,
          category_id: p.category_id || null,
          images: p.images || [],
          active: !!p.active,
          sold_out: !!p.sold_out,
          featured: !!p.featured,
          updated_at: new Date().toISOString(),
        };
        if (p.id) return ok(await client().from('products').update(row).eq('id', p.id).select().single());
        return ok(await client().from('products').insert(row).select().single());
      },
      async setProductActive(id, active) {
        ok(await client().from('products').update({ active, updated_at: new Date().toISOString() }).eq('id', id));
      },
      async deleteProduct(id) {
        ok(await client().from('products').delete().eq('id', id));
      },

      async uploadImage(blob, folder) {
        const ext = DM.extFromType(blob.type);
        const path = `${folder || 'p'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const res = await client()
          .storage.from(BUCKET)
          .upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
        if (res.error) throw res.error;
        return client().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      },
      async removeImages(urls) {
        const paths = (urls || []).map(pathFromUrl).filter(Boolean);
        if (!paths.length) return;
        try { await client().storage.from(BUCKET).remove(paths); } catch (e) { /* melhor esforço */ }
      },

      auth: {
        async getSession() {
          const s = ok(await client().auth.getSession()).session;
          return s ? { email: s.user.email } : null;
        },
        async signIn(email, password) {
          const { data, error } = await client().auth.signInWithPassword({ email, password });
          if (error) throw error;
          const { data: isAdmin, error: e2 } = await client().rpc('is_admin');
          if (e2 || isAdmin !== true) {
            await client().auth.signOut();
            const err = new Error('Este e-mail não tem permissão para editar o catálogo.');
            err.code = 'not_admin';
            throw err;
          }
          return { email: data.user.email };
        },
        async signOut() {
          await client().auth.signOut();
        },
        async updatePassword(password) {
          const { error } = await client().auth.updateUser({ password });
          if (error) throw error;
        },
        async isAdmin() {
          const { data, error } = await client().rpc('is_admin');
          return !error && data === true;
        },
      },
    };
  }

  /* =================================================================
   *  MODO DEMONSTRAÇÃO (localStorage)
   * ================================================================= */
  function demoArt(kind, c) {
    // c = [claro, médio, escuro]
    const shade = (hex, f) => {
      const n = parseInt(hex.slice(1), 16);
      const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
      const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
      const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
      return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    };
    const bg =
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1eee9"/><stop offset="1" stop-color="#d9d4cc"/></linearGradient></defs>' +
      '<rect width="800" height="800" fill="url(#g)"/><ellipse cx="400" cy="660" rx="230" ry="26" fill="#000" opacity=".13"/>';
    let body = '';
    const rowsets = {
      vase: [[190, 70], [330, 92], [470, 165], [640, 95]],
      tall: [[140, 52], [400, 84], [640, 112]],
      pot: [[330, 175], [490, 160], [640, 120]],
      bowl: [[380, 235], [470, 205], [640, 105]],
    };
    if (rowsets[kind]) {
      const rows = rowsets[kind];
      for (let i = 0; i < rows.length - 1; i++) {
        const [y1, h1] = rows[i];
        const [y2, h2] = rows[i + 1];
        const f = 1 - i * 0.05;
        body += `<polygon points="${400 - h1},${y1} 400,${y1} 400,${y2} ${400 - h2},${y2}" fill="${shade(c[1], f)}"/>`;
        body += `<polygon points="400,${y1} ${400 + h1},${y1} ${400 + h2},${y2} 400,${y2}" fill="${shade(c[2], f)}"/>`;
        body += `<polygon points="${400 - h1},${y1} ${400 - h1 * 0.4},${y1} ${400 - h2 * 0.4},${y2} ${400 - h2},${y2}" fill="${shade(c[0], f)}" opacity=".55"/>`;
      }
      const [y0, h0] = rows[0];
      body += `<ellipse cx="400" cy="${y0}" rx="${h0}" ry="${Math.round(h0 * 0.22)}" fill="${shade(c[2], 0.55)}"/>`;
    } else if (kind === 'cube') {
      body =
        `<polygon points="400,230 590,330 400,430 210,330" fill="${c[0]}"/>` +
        `<polygon points="210,330 400,430 400,650 210,550" fill="${c[1]}"/>` +
        `<polygon points="590,330 400,430 400,650 590,550" fill="${c[2]}"/>` +
        '<g stroke="#fff" stroke-opacity=".25" stroke-width="3" fill="none"><path d="M300 280l190 100M305 380v200M495 380v200M210 440l190 100M590 440l-190 100"/></g>';
    } else if (kind === 'moon') {
      body =
        '<defs><radialGradient id="m" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff7e8"/><stop offset=".6" stop-color="' + c[0] + '"/><stop offset="1" stop-color="' + c[2] + '"/></radialGradient></defs>' +
        '<circle cx="400" cy="400" r="215" fill="url(#m)"/>' +
        '<g fill="#000" opacity=".07"><circle cx="330" cy="340" r="42"/><circle cx="470" cy="450" r="58"/><circle cx="360" cy="500" r="26"/></g>' +
        `<rect x="340" y="615" width="120" height="40" rx="8" fill="${c[2]}"/>`;
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">${bg}${body}</svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function demoSeed() {
    const cats = [
      { id: 'c-deco', name: 'Decoração', sort_order: 1 },
      { id: 'c-casa', name: 'Casa & Organização', sort_order: 2 },
      { id: 'c-luz', name: 'Iluminação', sort_order: 3 },
    ];
    const now = Date.now();
    const mk = (i, name, price, cat, desc, images, extra) =>
      Object.assign(
        {
          id: 'p-' + i,
          name,
          price,
          category_id: cat,
          description: desc,
          images,
          active: true,
          sold_out: false,
          featured: false,
          created_at: new Date(now - i * 3600e3).toISOString(),
        },
        extra || {}
      );
    const stone = ['#d8d2c6', '#b5ad9d', '#8d8576'];
    const night = ['#4a4744', '#2b2927', '#171514'];
    const gold = ['#e6bd80', '#c58b3c', '#8f5f21'];
    const sage = ['#c6cdbd', '#9ea791', '#6d7761'];
    const products = [
      mk(1, 'Vaso Facetado Low Poly', 59.9, 'c-deco',
        'Vaso decorativo impresso em 3D com acabamento facetado.\n\n• Altura: 18 cm\n• Material: PLA premium\n• Cores: preto fosco, areia ou dourado\n\nIdeal para flores secas, canetas ou como peça de destaque na estante.',
        [demoArt('vase', night), demoArt('vase', stone), demoArt('vase', gold)], { featured: true }),
      mk(2, 'Cachepô Minimal Torre', 44.9, 'c-deco',
        'Cachepô alto de linhas limpas, perfeito para suculentas e pequenas plantas. Furo de drenagem opcional.',
        [demoArt('tall', stone), demoArt('tall', sage)]),
      mk(3, 'Fruteira Low Poly', 79.0, 'c-casa',
        'Fruteira de mesa com visual escultural. Leve, resistente e fácil de limpar.',
        [demoArt('bowl', gold)]),
      mk(4, 'Organizador de Mesa Hexa', 36.5, 'c-casa',
        'Organizador geométrico para canetas, clipes e pequenos objetos. Combina com qualquer mesa de trabalho.',
        [demoArt('cube', sage), demoArt('cube', night)]),
      mk(5, 'Luminária Lua', 129.9, 'c-luz',
        'Luminária de mesa em formato de lua com textura de crateras. Acompanha base e cabo (lâmpada LED não inclusa).',
        [demoArt('moon', gold)], { sold_out: true }),
      mk(6, 'Cachepô Pote Escultural', null, 'c-deco',
        'Peça sob medida — tamanho e cor à sua escolha. Chame no WhatsApp para combinar o seu.',
        [demoArt('pot', night)]),
    ];
    return { settings: Object.assign({}, DEFAULT_SETTINGS, { whatsapp: '5511999999999' }), categories: cats, products };
  }

  function makeDemo() {
    const KEY = 'dm_demo_v1';
    const SKEY = 'dm_demo_session';

    function load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      const seed = demoSeed();
      save(seed);
      return seed;
    }
    function save(d) {
      try { localStorage.setItem(KEY, JSON.stringify(d)); }
      catch (e) { throw new Error('Sem espaço no navegador para salvar (modo demonstração). Use menos/menores fotos.'); }
    }
    const wait = () => new Promise((r) => setTimeout(r, 60));
    const sortProducts = (a, b) =>
      (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || String(b.created_at).localeCompare(String(a.created_at));

    return {
      mode: 'demo',

      async getSettings() { await wait(); return Object.assign({}, DEFAULT_SETTINGS, load().settings); },
      async saveSettings(patch) {
        const d = load();
        d.settings = Object.assign({}, d.settings, patch);
        save(d);
        return d.settings;
      },

      async listCategories() {
        await wait();
        return load().categories.slice().sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
      },
      async createCategory(name, sort_order) {
        const d = load();
        const c = { id: uid(), name, sort_order, created_at: new Date().toISOString() };
        d.categories.push(c);
        save(d);
        return c;
      },
      async updateCategory(id, patch) {
        const d = load();
        const c = d.categories.find((x) => x.id === id);
        Object.assign(c, patch);
        save(d);
        return c;
      },
      async deleteCategory(id) {
        const d = load();
        d.categories = d.categories.filter((x) => x.id !== id);
        d.products.forEach((p) => { if (p.category_id === id) p.category_id = null; });
        save(d);
      },

      async listProducts(opts) {
        await wait();
        let list = load().products;
        if (!(opts && opts.all)) list = list.filter((p) => p.active);
        return list.slice().sort(sortProducts);
      },
      async saveProduct(p) {
        const d = load();
        const row = {
          name: p.name,
          description: p.description || null,
          price: p.price,
          category_id: p.category_id || null,
          images: p.images || [],
          active: !!p.active,
          sold_out: !!p.sold_out,
          featured: !!p.featured,
          updated_at: new Date().toISOString(),
        };
        if (p.id) {
          const cur = d.products.find((x) => x.id === p.id);
          Object.assign(cur, row);
          save(d);
          return cur;
        }
        const created = Object.assign({ id: uid(), created_at: new Date().toISOString() }, row);
        d.products.push(created);
        save(d);
        return created;
      },
      async setProductActive(id, active) {
        const d = load();
        d.products.find((x) => x.id === id).active = active;
        save(d);
      },
      async deleteProduct(id) {
        const d = load();
        d.products = d.products.filter((x) => x.id !== id);
        save(d);
      },

      async uploadImage(blob) {
        return await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = () => reject(new Error('Falha ao ler a imagem'));
          fr.readAsDataURL(blob);
        });
      },
      async removeImages() {},

      auth: {
        async getSession() {
          return localStorage.getItem(SKEY) ? { email: localStorage.getItem(SKEY) } : null;
        },
        async signIn(email) {
          localStorage.setItem(SKEY, email || 'demo@dm3d');
          return { email: email || 'demo@dm3d' };
        },
        async signOut() { localStorage.removeItem(SKEY); },
        async updatePassword() {},
        async isAdmin() { return true; },
      },
    };
  }

  /* =================================================================
   *  Inicialização
   * ================================================================= */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Falha ao carregar ' + src));
      document.head.appendChild(s);
    });
  }

  /** Chame `await DM.ready()` antes de usar DM.db */
  let readyPromise;
  DM.ready = function () {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      if (DM.demo) {
        DM.db = makeDemo();
        return DM.db;
      }
      if (!(window.supabase && window.supabase.createClient)) {
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.min.js');
      }
      DM.db = makeSupabase();
      return DM.db;
    })();
    return readyPromise;
  };
})();
