# Integrações externas — manual de preenchimento dos `.env`

Este é o guia para sair do **modo de testes** (que roda inteiro na sua máquina, sem
nenhum serviço pago) e ligar os serviços reais, um por um.

Duas regras valem para tudo o que vem abaixo:

- **Nada é obrigatório de uma vez.** Cada integração tem um adaptador local e um real,
  escolhidos por variável de ambiente. Enquanto a variável não está preenchida, a loja
  funciona com o adaptador local — nada quebra.
- **Só o `backend/.env` guarda segredo.** O `frontend/.env.local` tem apenas uma chave
  publicável (que vai para o navegador de qualquer forma) e a URL interna da API.

Os dois arquivos nascem de `cp backend/.env.example backend/.env` e
`cp frontend/.env.example frontend/.env.local`.

---

## 1. Panorama: o que você precisa contratar

| # | Integração | Para quê | Precisa conta? | Custo | Sem ela, o que acontece |
| --- | --- | --- | --- | --- | --- |
| 2 | **Google OAuth** | login do cliente | Sim (grátis) | Grátis | botões de login de teste (`AUTH_DEV_LOGIN=true`) |
| 3 | **Stripe** | Pix e cartão | Sim | por transação | Pix/cartão simulados, com botão "Simular pagamento aprovado" |
| 4 | **Z-API** | WhatsApp (avisos + atendente) | Sim | mensal | mensagens só no terminal da API e no painel |
| 5 | **Resend** | e-mail de aviso para a administração | Sim | plano gratuito generoso | o e-mail aparece no terminal da API |
| 6 | **Anthropic (Claude)** | atendente IA do WhatsApp | Sim | por uso | atendente responde por regras simples |
| 7 | **Supabase** | banco Postgres (fase 2) | Sim | plano gratuito no início | SQLite local (`dev.db`) |
| 8 | ViaCEP, Nominatim, OSRM, OpenStreetMap | CEP, geocodificação, rota, mapa | **Não** | Grátis | endereço manual e link para o Google Maps |

A ordem da tabela é uma boa ordem de execução: login primeiro (sem ele não há cliente
de verdade), pagamento depois, e o resto conforme a necessidade.

---

## 2. Google OAuth — login

**O que a loja faz com isso:** fluxo de authorization code com `google-auth-library`,
escopos `openid email profile`, e o ID token é verificado antes de criar a sessão.
Nada além de nome, e-mail e foto é lido.

### Passo a passo

1. Abra o [Google Cloud Console](https://console.cloud.google.com) e crie um projeto
   (ex.: `acougue-do-vandinho`).
2. **APIs e serviços → Tela de permissão OAuth**: tipo **Externo**, preencha nome do app,
   e-mail de suporte e e-mail do desenvolvedor. Enquanto o app estiver em
   *Testing*, adicione em **Usuários de teste** todos os e-mails que vão entrar.
3. **Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
4. Em **URIs de redirecionamento autorizados**, cadastre exatamente:
   - desenvolvimento: `http://localhost:3000/api/auth/google/callback`
   - produção: `https://SEU_DOMINIO/api/auth/google/callback`
5. Copie o **ID do cliente** e a **Chave secreta do cliente**.

### `backend/.env`

```ini
GOOGLE_CLIENT_ID=123456789-xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
# Desligue em produção — são os botões "Entrar como cliente/entregador/admin".
AUTH_DEV_LOGIN=false
# Estes e-mails viram ADMIN no primeiro login com Google. Ponha o seu aqui
# antes de subir, senão ninguém administra a loja.
ADMIN_EMAILS=seu-email@gmail.com
```

> O `GOOGLE_REDIRECT_URI` tem de ser **idêntico** ao cadastrado no Console, caractere por
> caractere — barra final inclusive. É a causa de quase todo `redirect_uri_mismatch`.

### Como saber que funcionou

Abra `/entrar`: o botão "Entrar com Google" só aparece quando `GOOGLE_CLIENT_ID` e
`GOOGLE_CLIENT_SECRET` estão preenchidos.

---

## 3. Stripe — Pix e cartão

Esta integração tem um manual próprio e detalhado em **[STRIPE.md](STRIPE.md)**
(decisões de desenho, os seis eventos de webhook, cartões de teste, armadilhas
verificadas). Aqui fica só o essencial para preencher o `.env`.

**O que a loja faz com isso:** Checkout Sessions com `ui_mode: 'elements'`, renderizado
pelo Payment Element na sua própria página de pagamento. As formas de pagamento **não
estão fixas no código** — Pix e cartões são ligados no Dashboard. A confirmação do
pedido acontece **só pelo webhook**, nunca pelo retorno do navegador.

### Passo a passo

1. Crie um **sandbox** em [dashboard.stripe.com](https://dashboard.stripe.com)
   (ou `stripe sandboxes create` pela CLI).
2. **Settings → Payments → Payment methods**: ative **Pix** e **Cards**. Pix exige
   conta brasileira com os dados do negócio enviados (`charges_enabled: true`) — ligar o
   método no Dashboard não basta por si só.
3. **Developers → API keys**: pegue a **chave publicável** (`pk_test_...`) e crie uma
   **chave restrita** (`rk_test_...`) com permissão de escrita em Checkout Sessions,
   PaymentIntents e Refunds. Prefira a restrita à `sk_...`.
4. Webhook:
   - **local**: `stripe listen --forward-to localhost:3333/api/webhooks/stripe` — o
     comando imprime o `whsec_...` da sessão.
   - **produção**: **Developers → Webhooks → Add endpoint**,
     URL `https://SEU_DOMINIO/api/webhooks/stripe`, assinando os eventos
     `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `checkout.session.expired`,
     `refund.created`, `refund.updated`.

### `backend/.env`

```ini
PAYMENT_PROVIDER=stripe
STRIPE_SECRET_KEY=rk_test_xxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx
```

### `frontend/.env.local`

```ini
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxx
```

> As duas chaves precisam ser **da mesma conta**: a publicável do frontend e a secreta
> do backend. Chaves de contas diferentes só falham na hora de confirmar o pagamento.

> O `whsec_` do `stripe listen` **muda a cada execução** do comando. Se os pagamentos
> pararem de ser confirmados em desenvolvimento, é quase sempre isso.

---

## 4. Z-API — WhatsApp

**O que a loja faz com isso:** avisos de pedido para o telefone do dono do pedido
(`send-text`) e a localização da loja na retirada (`send-location`); e, na entrada, o
atendente IA responde as mensagens recebidas. A saída passa por uma **fila com ritmo
controlado** — uma rajada de mensagens é o que faz um número ser limitado ou bloqueado
pelo WhatsApp.

### Passo a passo

1. Crie a conta em [z-api.io](https://www.z-api.io) e uma **instância**.
2. Conecte o número lendo o QR code no painel da Z-API. Use um número dedicado à loja.
3. No painel, colete:
   - **ID da instância** → `ZAPI_INSTANCE_ID`
   - **Token da instância** → `ZAPI_TOKEN`
   - **Token de segurança da conta** (vai no header `Client-Token`) → `ZAPI_CLIENT_TOKEN`
4. Invente um segredo próprio para o webhook (`openssl rand -hex 24`) e configure o
   webhook **"Ao receber"** da instância para:
   `https://SEU_DOMINIO/api/webhooks/zapi?secret=O_MESMO_SEGREDO`
   A requisição sem esse `secret` é recusada com 403.

### `backend/.env`

```ini
WHATSAPP_PROVIDER=zapi
ZAPI_INSTANCE_ID=xxxxxxxxxxxxxxxx
ZAPI_TOKEN=xxxxxxxxxxxxxxxx
ZAPI_CLIENT_TOKEN=Fxxxxxxxxxxxxxxxx
ZAPI_BASE_URL=https://api.z-api.io
ZAPI_WEBHOOK_SECRET=um-segredo-longo-e-aleatorio-seu
```

As variáveis de ritmo (`WHATSAPP_MIN_INTERVAL_MS`, `WHATSAPP_PER_PHONE_INTERVAL_MS`,
`WHATSAPP_PER_MINUTE_LIMIT`, backoff) já vêm com valores conservadores de propósito.
**Só aumente** com uma instância paga e um número já "aquecido".

### Como testar sem a Z-API

Em **Admin › Atendente IA** há um simulador: você digita um telefone e uma mensagem, e o
atendente responde como se tivesse vindo do WhatsApp. É o caminho para desenvolver todo
o fluxo antes de pagar a instância. Para receber o webhook na sua máquina é preciso um
túnel público (`ngrok http 3333`), já que a Z-API chama de fora.

---

## 5. Resend — e-mail de aviso para a administração

**O que a loja faz com isso:** pedido pago, cancelado, entregue (ou retirado) e não
entregue geram e-mail para todo usuário **ADMIN** e para os endereços de `ADMIN_EMAILS`.
Cada aviso liga/desliga em **Admin › Atendente IA › Avisos automáticos**. Os
destinatários nunca vêm do evento — assim um aviso não pode ser desviado.

### Passo a passo

1. Crie a conta em [resend.com](https://resend.com).
2. **API Keys → Create API Key** (permissão de envio basta) → `RESEND_API_KEY`.
3. **Domains → Add Domain**: cadastre o domínio da loja e publique os registros
   **SPF/DKIM** no seu DNS. Espere a verificação ficar verde.
4. Só então use um remetente desse domínio em `EMAIL_FROM`.

### `backend/.env`

```ini
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
EMAIL_FROM=Açougue do Vandinho <avisos@acouguedovandinho.com.br>
```

> **Antes do domínio verificado**, o Resend só aceita `onboarding@resend.dev` como
> remetente — e entrega apenas para o e-mail da própria conta do Resend. É ótimo para um
> primeiro teste e enganoso depois: parece que o envio "não funciona" quando na verdade
> é o destinatário que está bloqueado.

---

## 6. Anthropic (Claude) — atendente IA

**O que a loja faz com isso:** o atendente do WhatsApp roda um laço de ferramentas
(consulta de pedidos, catálogo, atendentes humanos) com `claude-opus-5`, effort `low` e
fallback automático de modelo em caso de recusa. O atendente só consulta pedidos **do
número que está conversando**.

### Passo a passo

1. Crie a conta em [console.anthropic.com](https://console.anthropic.com).
2. Adicione crédito em **Billing** — sem saldo, a API recusa as chamadas.
3. **API Keys → Create Key** → `ANTHROPIC_API_KEY`.

### `backend/.env`

```ini
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
ANTHROPIC_MODEL=claude-opus-5
# low | medium | high — rota de chat raramente precisa de mais que low
ANTHROPIC_EFFORT=low
ASSISTANT_HISTORY_LIMIT=20
```

Sem a chave, o atendente usa o motor por regras — com **as mesmas ferramentas e as
mesmas regras de privacidade**. Vale deixar assim enquanto você ajusta o fluxo.

---

## 7. Supabase — banco Postgres (fase 2)

Hoje o banco é SQLite local (`DATABASE_URL="file:./dev.db"`), que não serve para
produção. A migração está descrita no README; o que toca o `.env` é:

1. Crie o projeto em [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string → URI**. Em ambiente serverless use
   a porta do **pooler** (6543); para rodar migrations, a conexão direta (5432).
3. `prisma/schema.prisma`: `provider = "postgresql"`.
4. `PrismaService`: trocar `PrismaBetterSqlite3` por `PrismaPg` (`@prisma/adapter-pg`).
5. `npx prisma migrate dev --name init` — o histórico de migrations do SQLite não é
   reaproveitado.

```ini
DATABASE_URL="postgresql://postgres.xxxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
```

Opcional: trocar o `LocalFileStorage` (imagens de produto em `UPLOAD_DIR`) por um
adaptador do Supabase Storage — a porta `FileStorage` já existe para isso. Enquanto não
trocar, garanta que `UPLOAD_DIR` aponte para um **volume persistente** no servidor, ou as
fotos desaparecem a cada deploy.

---

## 8. Serviços sem cadastro — limites reais e o que usar no lugar

Nenhum destes precisa de chave, e é por isso que a loja roda hoje sem conta em nada
disso. Mas "grátis" aqui significa **infraestrutura doada à comunidade**, com política de
uso e sem SLA. Falha em qualquer um é tratada como ausência de dado, não como erro: o
mapa cai para "abrir no Google Maps" com o endereço em texto.

| Serviço | Onde aparece | Limite oficial | Uso comercial? |
| --- | --- | --- | --- |
| **ViaCEP** | formulário de endereço do cliente | sem limite documentado; IP bloqueado por tempo indeterminado em uso massivo; sem SLA | tolerado |
| **Nominatim** (OSM) | geocodificação do endereço do cliente e da loja | **1 req/s absoluto**; 4 req/min em scripts longos; User-Agent identificável obrigatório; **resultado tem de ser cacheado**; autocomplete proibido | desaconselhado (política pode mudar sem aviso) |
| **OSRM demo** | rota do entregador até o cliente | **1 req/s**; servidor de demonstração, sem garantia de disponibilidade | **não permitido** — a política restringe a usos não comerciais |
| **Tiles do OSM** | mapa do entregador (Leaflet) | sem número publicado; proíbe pré-carregamento/offline; exige User-Agent e Referer válidos e cache conforme os headers | **a política manda usar outro provedor** em uso comercial ou de volume |

### Onde estamos hoje

- **Geocodificação: dentro da política.** O ponto é gravado em `latitude`/`longitude` do
  endereço no cadastro, então são ~1 requisição por endereço novo ou editado — não por
  visualização. O cache que o Nominatim exige, portanto, existe. O User-Agent identifica
  a aplicação e traz contato, como as políticas do OpenStreetMap pedem: ele é montado em
  `AppConfig` a partir de `FRONTEND_URL` e de `CONTACT_EMAIL` (que, se estiver vazio, cai
  para o primeiro endereço de `ADMIN_EMAILS`).
- **Rota: cacheada por par de coordenadas.** O `RoutePlanner` guarda a rota em memória
  por 7 dias (a rua entre a loja e o cliente não muda) e chamadas simultâneas para a
  mesma rota compartilham uma única requisição. Resultado: ~1 chamada ao OSRM por
  destino, não uma por abertura da tela do entregador. Quando o roteador falha, a linha
  reta vale só 1 minuto — o suficiente para não insistir durante a queda, pouco o
  bastante para a rota real aparecer assim que ele voltar.
- **Tiles: o único item fora da política**, independente de volume, porque a loja é
  comercial. É a troca mais urgente das quatro.

### O que eu recomendo

Para o porte de um açougue de bairro (digamos 30 pedidos/dia → ~900 rotas/mês e
~50 mil tiles/mês), tudo isto cabe no plano gratuito de serviços comerciais de verdade:

| Precisa trocar | Recomendação | Plano gratuito | Por quê esta |
| --- | --- | --- | --- |
| **Tiles do mapa** | **MapTiler Cloud** | 5 mil sessões de mapa + 100 mil requisições/mês; pago a partir de US$ 30/mês | troca de uma linha no `TileLayer`, estilo bonito e pronto para Leaflet; é a opção com menor atrito aqui |
| **Rota do entregador** | **openrouteservice** (HeiGIT) | 2 mil rotas/dia, 40/min | API de rota pura, cota generosa para o nosso volume, sem cartão |
| **Geocodificação** | **ficar no Nominatim** | — | o volume real é baixíssimo, já cacheado e o User-Agent já identifica a loja; trocar agora é otimização sem problema para resolver |

Alternativas que valem conhecer, se quiser um fornecedor só para as três coisas:

- **LocationIQ** — 5 mil req/dia e 2 req/s no gratuito, cobrindo geocodificação, rota
  **e** tiles numa única chave. Ótimo encaixe; o primeiro plano pago, porém, salta para
  US$ 100/mês.
- **Geoapify** — 3 mil créditos/dia, 5 req/s, também cobrindo os três. Pago a partir de
  US$ 59/mês.
- **Stadia Maps** — 200 mil créditos/mês, mas **uso comercial proibido no gratuito**; o
  plano comercial custa US$ 20/mês com 1 milhão de créditos, o mais barato da lista para
  quando a loja crescer.
- **Google Maps Platform** — desde março de 2025 não há mais o crédito de US$ 200: cada
  SKU tem 10 mil chamadas grátis/mês (100 mil para Map Tiles) e depois US$ 5/mil em
  geocodificação e rotas. Só vale se você quiser a qualidade de endereçamento do Google
  em CEP/rua do Brasil, que é de fato superior.
- **Auto-hospedar** Nominatim e OSRM com o extrato do Brasil (ou só do seu estado) via
  Docker — custo zero de API, mas é um contêiner com alguns GB de dados para manter.
  Faz sentido se o volume crescer muito; não faz sentido agora.

### CEP: vale um fallback, não uma troca

O ViaCEP não tem limite publicado nem SLA, e bloqueia por IP quem faz uso massivo —
risco pequeno no nosso padrão (uma consulta por endereço digitado). O padrão recomendado
é **duas fontes com fallback**: manter o ViaCEP e cair para a **BrasilAPI**
(`https://brasilapi.com.br/api/cep/v2/{cep}`, que já agrega Correios, ViaCEP e outros)
quando a primeira falhar. É barato de implementar e remove um ponto único de falha do
cadastro do cliente.

---

## 9. Checklist de produção

Variáveis que **não** são integração mas mudam ao sair do localhost:

```ini
NODE_ENV=production
PORT=3333
FRONTEND_URL=https://SEU_DOMINIO
# string longa e aleatória, nunca a do .env.example: openssl rand -base64 48
JWT_SECRET=...
SESSION_DAYS=7
# obrigatório com HTTPS — sem isso o cookie de sessão trafega sem a marca de seguro
COOKIE_SECURE=true
AUTH_DEV_LOGIN=false
UPLOAD_DIR=/var/lib/vandinho/uploads
```

E no `frontend/.env.local` (ou nas variáveis do host):

```ini
BACKEND_URL=http://localhost:3333   # URL *interna* da API, usada pelo rewrite /api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Antes de abrir a loja:

- [ ] `JWT_SECRET` novo e aleatório, `COOKIE_SECURE=true`, `AUTH_DEV_LOGIN=false`
- [ ] `ADMIN_EMAILS` com o seu e-mail — é o que garante um admin no primeiro login
- [ ] Redirect URI de produção cadastrado no Google Cloud **e** a tela de permissão OAuth
      publicada (fora do modo *Testing*)
- [ ] Stripe em live: chaves `live`, Pix e cartão ativos, webhook de produção criado e os
      seis eventos assinados (checklist completo em [STRIPE.md](STRIPE.md))
- [ ] Domínio verificado no Resend e `EMAIL_FROM` desse domínio
- [ ] Webhook "Ao receber" da Z-API apontando para o domínio público, com o `secret` certo
- [ ] Saldo na conta Anthropic
- [ ] `DATABASE_URL` do Postgres e migrations aplicadas
- [ ] `UPLOAD_DIR` em volume persistente (ou Supabase Storage)
- [ ] Nenhum segredo commitado: `backend/.env` e `frontend/.env.local` estão no `.gitignore`

---

## 10. Referência rápida — todas as variáveis

### `backend/.env`

| Variável | Integração | Obrigatória quando |
| --- | --- | --- |
| `PORT`, `FRONTEND_URL`, `NODE_ENV` | app | sempre |
| `JWT_SECRET`, `SESSION_DAYS`, `COOKIE_SECURE` | sessão | sempre (secret novo em produção) |
| `DATABASE_URL` | banco | sempre |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | Google | login real |
| `AUTH_DEV_LOGIN`, `ADMIN_EMAILS` | login | `ADMIN_EMAILS` sempre |
| `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe | `PAYMENT_PROVIDER=stripe` |
| `WHATSAPP_PROVIDER`, `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`, `ZAPI_BASE_URL`, `ZAPI_WEBHOOK_SECRET` | Z-API | `WHATSAPP_PROVIDER=zapi` |
| `WHATSAPP_*_MS`, `WHATSAPP_PER_MINUTE_LIMIT`, `WHATSAPP_MAX_ATTEMPTS` | fila do WhatsApp | nunca (tem padrão) |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | Resend | `EMAIL_PROVIDER=resend` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, `ASSISTANT_HISTORY_LIMIT` | Claude | atendente com IA |
| `UPLOAD_DIR` | arquivos | sempre |
| `GEOCODING_ENABLED` | Nominatim | nunca (padrão `true`) |
| `CONTACT_EMAIL` | Nominatim e OSRM (User-Agent) | nunca (cai para `ADMIN_EMAILS`) |

### `frontend/.env.local`

| Variável | Para quê |
| --- | --- |
| `BACKEND_URL` | URL interna da API NestJS (rewrite `/api` e páginas renderizadas no servidor) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Payment Element; só com `PAYMENT_PROVIDER=stripe` |

### Endpoints que serviços externos chamam

| Quem chama | URL |
| --- | --- |
| Stripe | `POST https://SEU_DOMINIO/api/webhooks/stripe` (header `stripe-signature`) |
| Z-API | `POST https://SEU_DOMINIO/api/webhooks/zapi?secret=ZAPI_WEBHOOK_SECRET` |
| Google (redirect do usuário) | `GET https://SEU_DOMINIO/api/auth/google/callback` |
