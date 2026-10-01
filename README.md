# MargemIQ

Painel de margem para operações de e-commerce. A pesquisa competitiva usa dados reais da API oficial do Mercado Livre e não gera concorrentes fictícios.

## Executar

1. Copie `.env.example` para `.env` e informe `ML_ACCESS_TOKEN` para desenvolvimento local.
2. Execute `npm start` (no PowerShell com política restrita, use `npm.cmd start`).
3. Abra `http://localhost:3000`.

Execute `npm.cmd install` antes de iniciar. A autenticação usa o cliente oficial do Supabase.

O `server.mjs` executa as mesmas funções de `api/` usadas na Vercel (incluindo as reescritas de `vercel.json`) e serve apenas `login.html`, `finalizar.html` e `assets/`. O `ML_ACCESS_TOKEN` só é usado fora da Vercel; em produção cada visitante conecta a própria conta via OAuth.

## Publicar na Vercel

O projeto inclui funções serverless em `api/` e configuração em `vercel.json`. Configure na Vercel `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `SESSION_SECRET`, `ML_REDIRECT_URI` e `ML_SITE_ID`, e então publique com `vercel deploy --prod`.

A URI de retorno (`ML_REDIRECT_URI`) deve ser exatamente a mesma cadastrada na aplicação do Mercado Livre: `https://SEU-PROJETO.vercel.app/integracao/mercadolivre/retorno`. Gere um `SESSION_SECRET` aleatório com pelo menos 32 bytes conforme a instrução em `.env.example`.

## Integrações

- Mercado Livre: OAuth com PKCE, renovação de token e pesquisa competitiva real em `GET /api/market/research`.
- Shopee: autorização da loja pela Open Platform v2 (host do Brasil), renovação automática do token (4 h; refresh de 30 dias) e anúncios ativos em `GET /api/shopee/listings`. Configure `SHOPEE_PARTNER_ID`, `SHOPEE_PARTNER_KEY` e `SHOPEE_REDIRECT_URI` (`https://SEU-PROJETO.vercel.app/integracao/shopee/retorno`); no console da Shopee, o domínio do projeto deve estar em "Live Redirect URL Domain". `SHOPEE_SANDBOX=1` usa o ambiente de testes.
- TikTok Shop: autorização da loja pelo link do Partner Center, renovação automática do token (7 dias) e produtos ativos em `GET /api/tiktok/listings` (a busca da API não informa vendas). Configure `TIKTOK_APP_KEY`, `TIKTOK_APP_SECRET` e `TIKTOK_SERVICE_ID`; no app do Partner Center, o Redirect URL deve ser `https://SEU-PROJETO.vercel.app/integracao/tiktok/retorno`.
- Foto do produto ("Vale a pena comprar?"): o Gemini (`gemini-3.8-flash`, camada gratuita do Google AI Studio, saída em JSON) identifica o produto e preenche a busca. A foto é reduzida no celular para até 1600 px, exige conta do Mercado Livre conectada e não é guardada pelo MargemIQ; na camada gratuita o Google pode usar as fotos para melhorar os produtos dele. Configure `GEMINI_API_KEY` e, para limitar o uso, `VISION_ALLOWED_ML_USERS`.
- Shopee, TikTok Shop e a foto com IA só aparecem no painel quando suas variáveis estão configuradas (`/api/health`).
- Amazon: aguarda credenciais e aprovação do aplicativo. A interface não apresenta dados fictícios desse canal.

## Radar de oportunidades (`#radar`)

- `GET /api/radar/trends?category=MLB…`: as 50 tendências semanais oficiais (`/trends/MLB`). A API entrega as 10 buscas que mais crescem, depois as 20 mais desejadas e depois as 20 mais populares.
- `GET /api/radar/categories`: categorias raiz para o filtro.
- `GET /api/radar/keyword?q=…&group=…`: categoria provável, quantidade de produtos no catálogo, preços das ofertas vencedoras, faixa de preço e nível de concorrência/oportunidade.
- A demanda vem do grupo oficial. Concorrência e oportunidade são uma classificação heurística do MargemIQ (`api/_radar.js`).
- Favoritos, monitoramento e cache de 24 h ficam no `localStorage` do navegador.

## Análise estratégica de anúncio (`#analysis/<link ou ID>`)

`POST /api/analysis/listing` com `{ ref, store: { cost, packaging, shipping, target, budget, commission } }`. Consulta o anúncio, o vendedor, a categoria e seus atributos, a tarifa oficial (`/sites/MLB/listing_prices`) e o catálogo concorrente. Devolve diagnóstico de título, preço, conteúdo, vendedor e vendas; preço mínimo sem prejuízo, preço para a margem-alvo e custo máximo; nível da oportunidade com os fatores; plano de ação; ideias de título; diferenciação; estoque inicial; e teste de mercado (`api/_listing.js`).

- Todo valor estimado (ritmo, faturamento, estoque, teste) vem com `estimated: true` e aparece como **Estimativa** na tela.
- Descrições e imagens de concorrentes não são lidas nem reproduzidas. As ideias de título usam só termos frequentes do segmento e campos como `[Sua Marca]`.
- Se `sold_quantity` não vier na API, ritmo e faturamento não são estimados.

O token nunca é exposto ao JavaScript do navegador. No OAuth ele fica em cookie `HttpOnly`, `Secure`, `SameSite=Lax` e criptografado com AES-256-GCM; `.env` está excluído do controle de versão.

## Verificação

Execute `npm.cmd run check` para validar a sintaxe e rodar os testes automatizados.

## Próximas etapas de produção

- Persistência dos dados do painel no banco de dados.
- Importação de catálogo, pedidos, taxas e estoque do vendedor.
- Conectores oficiais adicionais conforme as contas forem aprovadas.
- Histórico de preços para calcular tendências reais.
- Logs estruturados, rate limiting e monitoramento de produção.

## Contas e rotas protegidas

O Supabase Auth do projeto `e-commerce` gerencia cadastro e login por e-mail e senha. Configure `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SESSION_SECRET` (também na Vercel). Nunca use uma chave `service_role` ou secreta no lugar da chave publicável. As variáveis locais já estão em `.env`.

`/login` apresenta o formulário; `/app` e `/api/account?view=app` entregam o painel somente após validar o usuário com Supabase. Todas as APIs de operação e de OAuth exigem login; `/api/health` é público. O HTML do painel fica em `api/_app.js`, sem cópia estática pública. Cookies de sessão são criptografados, HttpOnly, SameSite=Lax e Secure em HTTPS, e renovados perto do vencimento. Requisições de alteração exigem Origin da própria aplicação.

Se o projeto exige confirmação de e-mail, o cadastro pede confirmação antes do primeiro login. No Supabase Dashboard → Authentication → URL Configuration, configure Site URL com o endereço publicado para os links de confirmação. O plugin disponível não permite alterar essa configuração. A tela de login recebe somente o resultado da operação; tokens não são devolvidos ao navegador.

Ao entrar ou sair, os cookies de conexão dos marketplaces são apagados. Cada usuário mantém dados locais do painel separados pelo ID da conta; dados antigos sem conta permanecem no navegador, mas não são atribuídos automaticamente. Esses dados ainda não sincronizam entre dispositivos. O Supabase cuida dos limites de autenticação; antes de disponibilizar amplamente, configure também limites na hospedagem.

Documentação usada: [autenticação por senha](https://supabase.com/docs/guides/auth/passwords) e [validação do usuário](https://supabase.com/docs/reference/javascript/auth-getuser).
