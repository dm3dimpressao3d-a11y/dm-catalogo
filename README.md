# Catálogo — DM Impressão 3D

Catálogo online para mandar no grupo do WhatsApp.

- **Link do cliente** (`seu-site.vercel.app`): só visualização. O cliente vê os produtos, abre as fotos e clica em **Comprar agora**, que abre o WhatsApp da DM com o nome e o valor do produto já escritos.
- **Painel** (`seu-site.vercel.app/admin`): protegido por e-mail e senha. Funciona no celular e no computador. Dá para cadastrar produtos (até 3 fotos, valor, descrição, categoria), ocultar, marcar como esgotado ou destaque, e configurar o número de WhatsApp.

**Como funciona:** o site é feito só de arquivos simples (HTML, CSS e JavaScript), sem etapa de build. O **GitHub** guarda os arquivos, a **Vercel** publica o site e o **Supabase** guarda os produtos, as fotos e a senha de quem edita.

```
index.html          → catálogo do cliente
admin/index.html    → painel de edição
assets/js/config.js → ÚNICO arquivo que você edita (URL e chave do Supabase)
supabase/schema.sql → cria as tabelas, as regras de segurança e a pasta de fotos
```

---

## Testar no seu computador (sem configurar nada)

Enquanto o `config.js` estiver com os textos `COLE_AQUI`, o site roda em **modo demonstração**: aparecem produtos de exemplo e o painel aceita qualquer e-mail/senha. Tudo fica salvo só no navegador. Serve para ver o visual e testar.

```powershell
npm run dev
```

Abra `http://localhost:5173/` (catálogo) e `http://localhost:5173/admin/` (painel).

---

## Colocar no ar (faça nesta ordem)

### 1) Supabase (banco, fotos e senha)

1. Entre em [supabase.com](https://supabase.com), clique em **New project**, dê o nome `dm-catalogo`, escolha uma senha do banco (guarde) e a região **South America (São Paulo)**.
2. Quando o projeto terminar de criar, abra **SQL Editor → New query**.
3. Abra o arquivo `supabase/schema.sql`, **troque `seu-email@exemplo.com` pelo e-mail que vai usar no painel** (linha 17) e cole tudo no editor. Clique em **Run**. Deve aparecer "Success".
   - Para dar acesso a mais pessoas, adicione mais e-mails na lista `admin_emails`. Dá para fazer depois em **Table Editor → admin_emails**.
4. Crie o login: **Authentication → Users → Add user → Create new user**. Use o mesmo e-mail do passo 3, defina a senha e marque **Auto Confirm User**.
5. **Bloqueie cadastros de estranhos**: **Authentication → Sign In / Providers** (ou *Providers → Email*) e desligue **Allow new users to sign up**.
   - Mesmo que isso fique ligado, só os e-mails da lista `admin_emails` conseguem editar. Mas desligue mesmo assim.
6. Copie 2 valores em **Project Settings → API**:
   - **Project URL**
   - **Publishable key** (`sb_publishable_...`, na tela **API Keys**; nas versões antigas chamava "anon public"). Pode ficar no site, foi feita para isso. **Nunca** use a Secret key (`sb_secret_...`) nem a `service_role`.

### 2) Colocar a URL e a chave no site

Abra `assets/js/config.js` e substitua os dois textos:

```js
window.DM_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi...",
};
```

Teste de novo com `npm run dev`. O aviso amarelo de demonstração deve sumir. Entre em `/admin/` com o e-mail e a senha do passo 1.

### 3) GitHub (guardar os arquivos)

1. Crie um repositório novo em [github.com/new](https://github.com/new), por exemplo `dm-catalogo`. Pode ser **privado**.
2. Na pasta do projeto, rode:

```powershell
git init
git add .
git commit -m "Catálogo DM Impressão 3D"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/dm-catalogo.git
git push -u origin main
```

### 4) Vercel (publicar)

1. Entre em [vercel.com](https://vercel.com) com sua conta do GitHub, clique em **Add New → Project** e escolha o repositório `dm-catalogo`.
2. Em **Framework Preset** deixe **Other**. Não precisa preencher nada em *Build Command* nem *Output Directory*. Clique em **Deploy**.
3. Em 1 minuto você recebe o endereço, tipo `dm-catalogo.vercel.app`.
   - Catálogo: `https://dm-catalogo.vercel.app/`
   - Painel: `https://dm-catalogo.vercel.app/admin/`
4. (Opcional) Em **Settings → Domains** dá para usar um endereço próprio.

A partir daí, toda vez que você mudar um arquivo e fizer `git push`, a Vercel republica sozinha. **Produtos e fotos não passam por aqui**: eles vão direto para o Supabase pelo painel, sem precisar de deploy.

### 5) Imagem de prévia no WhatsApp

Em `index.html`, troque `https://SEU-DOMINIO.vercel.app/...` na linha `og:image` pelo endereço real do site e faça `git push`. É a imagem que aparece quando você cola o link no grupo.

---

## Usando no dia a dia

**Cadastrar produto:** `/admin/` → **Novo produto** → toque em **Adicionar foto** (no celular dá para tirar a foto na hora ou escolher da galeria) → nome, valor, descrição → **Salvar**.

- A 1ª foto é a capa. Use **Tornar capa** para trocar.
- As fotos são reduzidas automaticamente antes de subir, então o catálogo abre rápido no celular do cliente.
- **Valor em branco** mostra "Consulte o valor".
- **Visível no catálogo** desligado esconde o produto sem apagar.
- **Esgotado** mostra a etiqueta e o botão vira "Perguntar disponibilidade".
- **Destaque** coloca o produto no começo da lista.

**WhatsApp:** `/admin/` → **Configurações** → número com DDD. A mensagem pronta usa `{produto}`, `{preco}` e `{link}`.

**Link para o grupo:** em **Configurações** tem o link do catálogo com botão **Copiar**. Cada produto também tem link próprio: no catálogo, abra o produto e toque em **Compartilhar**.

**Trocar a senha:** **Configurações → Trocar minha senha**.

---

## Segurança

| Quem | O que consegue |
|---|---|
| Cliente (qualquer pessoa com o link) | Só **ler** produtos visíveis, categorias e o WhatsApp. |
| Quem está logado **e** na lista `admin_emails` | Criar, editar e apagar produtos, categorias, fotos e configurações. |
| Qualquer outra pessoa | Nada. Essas regras ficam no banco do Supabase (RLS), não só na tela. |

- O endereço `/admin/` não é secreto, mas sem e-mail e senha ele não deixa fazer nada. Ele também não aparece no Google (`noindex`).
- A chave publishable (ou `anon`) no `config.js` é pública por natureza. Não coloque nenhuma outra chave nos arquivos.

---

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Continua aparecendo "MODO DEMONSTRAÇÃO" | O `config.js` ainda tem `COLE_AQUI`, ou a URL não termina em `.supabase.co`. Confira se salvou e fez `git push`. |
| "E-mail ou senha incorretos" | Confira o usuário em **Authentication → Users** e se está confirmado (*Auto Confirm User*). |
| "Este e-mail não tem permissão" | O e-mail não está em `admin_emails`. Adicione em **Table Editor → admin_emails**. |
| "Sem permissão para salvar" | Rode o `schema.sql` de novo, depois saia e entre no painel. |
| Catálogo vazio para o cliente | Os produtos estão com **Visível no catálogo** desligado, ou o `schema.sql` não rodou. |
| Foto não sobe | Use JPG, PNG ou WebP. O limite é 5 MB depois da redução automática. |
| Site parou de responder depois de semanas | No plano grátis o Supabase **pausa projetos sem uso por cerca de 7 dias**. Entre no painel do Supabase e clique em **Restore project**. |

---

## Ideias para depois

- **Prévia de cada produto no WhatsApp:** hoje o link de um produto mostra a prévia geral do catálogo. Para mostrar a foto e o nome do produto na prévia, seria preciso gerar a página no servidor (função da Vercel).
- **Carrinho com vários produtos** numa só mensagem.
- **Logo em alta resolução:** o logo do Guia de Marca tem 200 × 200 px. Dá para trocar em **Configurações → Trocar logo** por um PNG transparente maior.
