# Açougue do Vandinho — loja online

E-commerce mobile-first do Açougue do Vandinho: catálogo, carrinho, pagamento (Pix/cartão via Stripe), entregas com rota para o entregador, painel administrativo e atendente virtual no WhatsApp.

```
backend/   NestJS (monólito modular, DDD + clean architecture), Prisma, SQLite (fase 1)
frontend/  Next.js 16 + TypeScript, shadcn/ui (Base UI), Tailwind 4, GSAP
docs/      design system da marca e logo
```

## Rodando localmente

Pré-requisito: Node 24.

```bash
# API — http://localhost:3333/api
cd backend
npm install
cp .env.example .env        # já funciona sem nenhuma chave
npm run db:reset            # cria o SQLite, aplica migrations e popula dados de exemplo
npm run start:dev

# Loja + painel — http://localhost:3000
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Na tela **/entrar** há botões "Entrar como cliente / entregador / admin" (só com `AUTH_DEV_LOGIN=true`).

| Conta de teste | Onde cai |
| --- | --- |
| cliente@vandinho.dev (Mariana) | Loja — já tem telefone, 2 endereços e pedidos |
| entregador@vandinho.dev (Carlos) | /entregador |
| funcionario@vandinho.dev (Joana) | /admin/pedidos — só pedidos (ver e entregar retiradas) e catálogo |
| admin@vandinho.dev | /admin |

Os dados do seed (preços, endereço da loja, bairros, atendentes, pedidos) são **exemplos** — troque em Admin › Configurações, Produtos e Atendentes.

## Modo de testes (padrão) × serviços reais

Tudo roda sem serviços pagos. Cada integração tem um adaptador local e um real, trocado só por variável de ambiente (`backend/.env`):

| Integração | Teste (padrão) | Real |
| --- | --- | --- |
| Pagamento | `PAYMENT_PROVIDER=fake` — Pix com QR simulado e botão "Simular pagamento" | `PAYMENT_PROVIDER=stripe` + `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` no frontend |
| WhatsApp | `WHATSAPP_PROVIDER=log` — mensagens aparecem no terminal da API e em Admin › Atendente IA | `WHATSAPP_PROVIDER=zapi` + `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`, `ZAPI_WEBHOOK_SECRET` |
| E-mail (avisos do admin) | `EMAIL_PROVIDER=log` — o e-mail aparece no terminal da API | `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` e `EMAIL_FROM` de domínio verificado |
| Atendente IA | sem `ANTHROPIC_API_KEY`: respostas por regras (mesmas ferramentas e regras de privacidade) | `ANTHROPIC_API_KEY` — Claude (`claude-opus-5-5`, effort `low`, fallback automático em recusas) |
| Login | botões de login de teste | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (redirect: `http://localhost:3000/api/auth/google/callback`) |

**Stripe:** usa Checkout Sessions com o Payment Element (`ui_mode: "elements"`). Ative Pix e cartões no Dashboard do Stripe (as formas não ficam fixas no código). A confirmação do pedido vem **só pelo webhook**:
`stripe listen --forward-to localhost:3333/api/webhooks/stripe`. Use um sandbox e, de preferência, uma chave restrita (`rk_...`).

**Z-API:** aponte o webhook "Ao receber" da instância para `https://SEU_DOMINIO/api/webhooks/zapi?secret=ZAPI_WEBHOOK_SECRET`. Enquanto isso, teste o atendente pelo simulador em Admin › Atendente IA.

## Regras de negócio implementadas

- **Pedido:** `No carrinho → Pago → Cancelado`. O carrinho é um pedido em status CART. Cancelar dispara o reembolso no gateway.
- **Entrega:** `Aguardando entrega → Entregando → Entregue | Não entregue`; `Cancelado` quando o pedido é cancelado antes de sair. O entregador não vê entregues/canceladas. O cliente só cancela enquanto a entrega está aguardando (retirada: até retirar); o admin também pode cancelar uma entrega que falhou.
- **Taxa de entrega** por bairro (Admin › Configurações › Entrega), somada ao total. Bairro fora da lista = só retirada.
- **Cadastro obrigatório** após o Google: WhatsApp confirmado por código + pelo menos um endereço.
- **Avaliações** só de quem recebeu o produto (uma por produto, editável).
- **E-mail para a administração:** pedido pago, cancelado, entregue (ou retirado) e não entregue avisam por e-mail todo usuário ADMIN e os endereços de `ADMIN_EMAILS`, com link para o painel. Cada aviso liga/desliga em Admin › Atendente IA › Avisos automáticos.
- **WhatsApp:** avisos só para o telefone do dono do pedido; retirada envia itens, total, código e a localização da loja. O atendente só consulta pedidos do número que está conversando e envia a lista de atendentes humanos quando pedem.

## Arquitetura do backend

Cada contexto em `backend/src/modules/<contexto>` com `domain / application / infrastructure / presentation`:
`identity`, `customers`, `store`, `support`, `catalog`, `favorites`, `reviews`, `ordering`, `payments`, `delivery`, `messaging`, `assistant`, `finance`.
Contextos conversam por serviços de aplicação exportados e por **eventos de integração** (`src/shared/application/integration-events.ts`) — ex.: `payment.succeeded → ordering` marca o pedido pago, que emite `order.paid → delivery` (cria a entrega) e `→ messaging` (avisa o cliente no WhatsApp e a administração por e-mail).

```bash
cd backend && npm test        # testes de domínio (pedido, entrega, preços)
```

## Migrando para o Supabase (fase 2)

1. `prisma/schema.prisma`: `provider = "postgresql"`.
2. `PrismaService`: trocar `PrismaBetterSqlite3` por `PrismaPg` (`@prisma/adapter-pg`) e `DATABASE_URL` pela string do Supabase.
3. Gerar uma nova migration inicial (`npx prisma migrate dev --name init`) — o histórico do SQLite não é reaproveitado.
4. Opcional: trocar `LocalFileStorage` por um adaptador do Supabase Storage (porta `FileStorage`).
