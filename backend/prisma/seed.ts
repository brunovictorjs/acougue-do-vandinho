/**
 * Sample data for local testing. Every value here (prices, names, phones,
 * address, hours) is an example — edit it in the admin panel.
 *
 *   npm run db:reset   → recreate the database and run this seed
 */
import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { generateDeliveryCode } from '../src/modules/delivery/domain/delivery.js';

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./dev.db' }) });

const days = (n: number) => new Date(Date.now() + n * 86_400_000);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const STORE = { lat: -23.5475, lng: -46.6361 };

const PICANHA_MD = `## Sobre o corte
A picanha é a peça mais pedida do balcão: macia, com a capa de gordura que derrete na brasa e dá sabor à carne.

- **Peso médio da peça:** 1,2 kg
- **Ideal para:** churrasco, grelha e forno

## Como preparar
1. Tempere só com sal grosso na hora de ir para a brasa.
2. Comece com a gordura virada para cima.
3. Sirva ao ponto, fatiada contra a fibra.`;

const generic = (name: string, uso: string) => `## Sobre o corte
${name} selecionado(a) e porcionado(a) no balcão, na hora do seu pedido.

- **Ideal para:** ${uso}
- **Conservação:** até 3 dias na geladeira ou 3 meses no freezer.`;

async function main() {
  await prisma.$transaction([
    prisma.whatsAppMessage.deleteMany(),
    prisma.review.deleteMany(),
    prisma.favorite.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.delivery.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.offerProduct.deleteMany(),
    prisma.offer.deleteMany(),
    prisma.productMedia.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.address.deleteMany(),
    prisma.phoneVerification.deleteMany(),
    prisma.user.deleteMany(),
    prisma.deliveryZone.deleteMany(),
    prisma.attendant.deleteMany(),
    prisma.sequence.deleteMany(),
    prisma.storeSettings.deleteMany(),
  ]);

  await prisma.storeSettings.create({
    data: {
      id: 1,
      name: 'Açougue do Vandinho',
      cnpj: '00.000.000/0001-00',
      whatsapp: '5511900000000',
      addressLine: 'Rua Exemplo, 100 — Centro, São Paulo/SP',
      latitude: STORE.lat,
      longitude: STORE.lng,
      hours: JSON.stringify([
        { label: 'Seg a sex', value: '08:00 às 19:00' },
        { label: 'Sábado', value: '08:00 às 17:00' },
        { label: 'Domingo', value: '08:00 às 12:00' },
      ]),
      about:
        'Açougue de bairro com cortes selecionados, porcionados na hora do jeito que você pede. Entregamos na região ou você retira no balcão.',
    },
  });

  const zones = [
    ['Centro', 800, 45],
    ['Sé', 800, 45],
    ['República', 1000, 60],
    ['Bela Vista', 1000, 60],
    ['Consolação', 1200, 75],
    ['Liberdade', 1200, 75],
  ] as const;
  for (const [neighborhood, feeCents, etaMinutes] of zones) {
    await prisma.deliveryZone.create({ data: { neighborhood, normalizedName: norm(neighborhood), feeCents, etaMinutes } });
  }

  const attendants = [
    ['João Pereira', '5511991112233'],
    ['Ana Lima', '5511992223344'],
    ['Rafael Costa', '5511993334455'],
  ];
  for (const [i, [fullName, phone]] of attendants.entries()) {
    await prisma.attendant.create({ data: { fullName, phone, position: i } });
  }

  // ------------------------------------------------ users (same emails as the dev login)
  const admin = await prisma.user.create({ data: { email: 'admin@vandinho.dev', firstName: 'Vandinho', lastName: '', role: 'ADMIN', phone: '5511900000001', phoneVerifiedAt: new Date() } });
  const carlos = await prisma.user.create({ data: { email: 'entregador@vandinho.dev', firstName: 'Carlos', lastName: 'Silva', role: 'COURIER', phone: '5511965432211', phoneVerifiedAt: new Date() } });
  await prisma.user.create({ data: { email: 'funcionario@vandinho.dev', firstName: 'Joana', lastName: 'Lima', role: 'EMPLOYEE', phone: '5511943218765', phoneVerifiedAt: new Date() } });
  const diego = await prisma.user.create({ data: { email: 'diego.entregas@vandinho.dev', firstName: 'Diego', lastName: 'Rocha', role: 'COURIER', phone: '5511954327788', phoneVerifiedAt: new Date() } });
  const mariana = await prisma.user.create({ data: { email: 'cliente@vandinho.dev', firstName: 'Mariana', lastName: 'Souza', role: 'CUSTOMER', phone: '5511987654321', phoneVerifiedAt: new Date() } });
  const others = await Promise.all(
    [
      ['Renata', 'Lopes', '5511912340001'],
      ['Marcos', 'Santos', '5511912340002'],
      ['Júlia', 'Prado', '5511912340003'],
      ['Pedro', 'Alves', '5511912340004'],
      ['Beatriz', 'Rocha', '5511912340005'],
    ].map(([firstName, lastName, phone], i) =>
      prisma.user.create({ data: { email: `cliente${i + 2}@vandinho.dev`, firstName, lastName, phone, phoneVerifiedAt: new Date() } }),
    ),
  );
  void admin;

  const addressOf = async (userId: string, street: string, number: string, neighborhood: string, lat: number, lng: number, label = 'Casa') =>
    prisma.address.create({
      data: { userId, label, zipCode: '01010-000', street, number, neighborhood, city: 'São Paulo', state: 'SP', latitude: lat, longitude: lng, isDefault: label === 'Casa' },
    });
  const marianaHome = await addressOf(mariana.id, 'Rua Líbero Badaró', '120', 'Centro', -23.5465, -46.6358);
  await addressOf(mariana.id, 'Avenida Paulista', '1500', 'Bela Vista', -23.5614, -46.6559, 'Trabalho');
  const otherAddresses = await Promise.all(
    others.map((u, i) => addressOf(u.id, ['Rua Augusta', 'Rua da Consolação', 'Rua Galvão Bueno', 'Rua Treze de Maio', 'Rua 25 de Março'][i], String(100 + i * 37), ['Consolação', 'Consolação', 'Liberdade', 'Bela Vista', 'Centro'][i], -23.55 - i * 0.004, -46.64 - i * 0.003)),
  );

  // ------------------------------------------------ catalog
  const catNames = ['Bovinos', 'Suínos', 'Aves', 'Linguiças', 'Kits churrasco', 'Acompanhamentos'];
  const cats: Record<string, string> = {};
  for (const [position, name] of catNames.entries()) {
    const c = await prisma.category.create({ data: { name, slug: norm(name).replace(/\s+/g, '-'), position } });
    cats[name] = c.id;
  }

  type Seed = { name: string; cat: string; unit: 'KG' | 'UNIT' | 'PACK'; price: number; short: string; md: string; isNew?: boolean; cuts?: string[]; sold: number; available?: boolean };
  const products: Seed[] = [
    { name: 'Picanha bovina', cat: 'Bovinos', unit: 'KG', price: 10490, short: 'Macia, com capa de gordura. A estrela do churrasco.', md: PICANHA_MD, cuts: ['Peça inteira', 'Em bifes', 'Em cubos'], sold: 96.5 },
    { name: 'Fraldinha', cat: 'Bovinos', unit: 'KG', price: 5290, short: 'Suculenta e cheia de sabor, ótima na grelha.', md: generic('Fraldinha', 'churrasco e grelha'), cuts: ['Peça inteira', 'Em bifes'], sold: 61 },
    { name: 'Costela janela', cat: 'Bovinos', unit: 'KG', price: 4290, short: 'Para fogo de chão ou forno bem lento.', md: generic('Costela', 'fogo de chão, forno e panela de pressão'), cuts: ['Peça inteira', 'Em ripas'], sold: 74.5 },
    { name: 'Bife ancho', cat: 'Bovinos', unit: 'KG', price: 7990, short: 'Marmoreio intenso, macio e saboroso.', md: generic('Bife ancho', 'grelha e frigideira'), cuts: ['Em bifes', 'Peça inteira'], isNew: true, sold: 12 },
    { name: 'Cupim maturado', cat: 'Bovinos', unit: 'KG', price: 4990, short: 'Maturado na casa, desmancha no forno.', md: generic('Cupim', 'forno e fogo de chão'), isNew: true, sold: 4, available: false },
    { name: 'Carne moída de patinho', cat: 'Bovinos', unit: 'KG', price: 4490, short: 'Moída na hora, pouca gordura.', md: generic('Patinho moído', 'molhos, recheios e hambúrguer'), sold: 40 },
    { name: 'Panceta suína', cat: 'Suínos', unit: 'KG', price: 3490, short: 'Pururuca garantida na brasa ou no forno.', md: generic('Panceta', 'churrasco e forno'), cuts: ['Peça inteira', 'Em tiras'], isNew: true, sold: 9 },
    { name: 'Lombo suíno', cat: 'Suínos', unit: 'KG', price: 2990, short: 'Magro e versátil.', md: generic('Lombo', 'assados e bifes'), cuts: ['Peça inteira', 'Em bifes'], sold: 22 },
    { name: 'Coxa e sobrecoxa', cat: 'Aves', unit: 'KG', price: 1890, short: 'Frango fresco, sem tempero.', md: generic('Coxa e sobrecoxa', 'forno, grelha e ensopados'), sold: 35 },
    { name: 'Coração de frango', cat: 'Aves', unit: 'KG', price: 3290, short: 'Limpo e pronto para o espeto.', md: generic('Coração de frango', 'churrasco'), sold: 28 },
    { name: 'Linguiça toscana da casa', cat: 'Linguiças', unit: 'KG', price: 2990, short: 'Receita da casa, tempero na medida.', md: generic('Linguiça toscana', 'churrasco e frigideira'), sold: 142 },
    { name: 'Linguiça de frango com queijo', cat: 'Linguiças', unit: 'KG', price: 3190, short: 'Leve e cremosa por dentro.', md: generic('Linguiça de frango', 'churrasco e air fryer'), sold: 30 },
    { name: 'Kit churrasco 10 pessoas', cat: 'Kits churrasco', unit: 'UNIT', price: 36900, short: 'Picanha, fraldinha, linguiça, coração e pão de alho.', md: `## O que vem no kit\n- 1,2 kg de picanha\n- 1,5 kg de fraldinha\n- 1 kg de linguiça toscana\n- 500 g de coração de frango\n- 2 pacotes de pão de alho\n\nServe bem 10 pessoas.`, sold: 11 },
    { name: 'Pão de alho da casa', cat: 'Acompanhamentos', unit: 'PACK', price: 1490, short: 'Pacote com 5 unidades.', md: generic('Pão de alho', 'churrasco e forno'), sold: 77 },
    { name: 'Carvão vegetal 5 kg', cat: 'Acompanhamentos', unit: 'UNIT', price: 3200, short: 'Saco de 5 kg, pega fogo rápido.', md: 'Carvão de eucalipto de reflorestamento. Saco de 5 kg.', sold: 20 },
  ];
  const ids: Record<string, string> = {};
  for (const [i, p] of products.entries()) {
    const kg = p.unit === 'KG';
    const created = await prisma.product.create({
      data: {
        name: p.name,
        slug: norm(p.name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        categoryId: cats[p.cat],
        unit: p.unit,
        priceCents: p.price,
        shortDescription: p.short,
        description: p.md,
        isNew: !!p.isNew,
        newUntil: p.isNew ? days(20) : null,
        available: p.available ?? true,
        cutOptions: JSON.stringify(p.cuts ?? []),
        minQuantity: kg ? 0.5 : 1,
        quantityStep: kg ? 0.5 : 1,
        soldCount: p.sold,
        createdAt: days(p.isNew ? -2 - i * 0.1 : -60 + i),
      },
    });
    ids[p.name] = created.id;
  }

  const weekly = await prisma.offer.create({
    data: { name: 'Ofertas da semana', discountType: 'FIXED_PRICE', value: 8990, startsAt: days(-1), endsAt: days(6), featured: true },
  });
  await prisma.offerProduct.create({ data: { offerId: weekly.id, productId: ids['Picanha bovina'] } });
  const costela = await prisma.offer.create({ data: { name: 'Ofertas da semana — costela', discountType: 'PERCENT', value: 14, startsAt: days(-1), endsAt: days(6), featured: true } });
  await prisma.offerProduct.create({ data: { offerId: costela.id, productId: ids['Costela janela'] } });
  const kit = await prisma.offer.create({ data: { name: 'Kit churrasco do mês', discountType: 'FIXED_PRICE', value: 32900, startsAt: days(-5), endsAt: days(25), featured: true } });
  await prisma.offerProduct.create({ data: { offerId: kit.id, productId: ids['Kit churrasco 10 pessoas'] } });
  const sexta = await prisma.offer.create({ data: { name: 'Sexta da linguiça', discountType: 'PERCENT', value: 10, startsAt: days(3), endsAt: days(4), featured: false } });
  await prisma.offerProduct.create({ data: { offerId: sexta.id, productId: ids['Linguiça toscana da casa'] } });

  // ------------------------------------------------ order history (paid, delivered) for the dashboard
  let seq = 1001;
  const customers = [mariana, ...others];
  const addrOf = (userId: string) => (userId === mariana.id ? marianaHome : otherAddresses[others.findIndex((o) => o.id === userId)]);
  const menu = [
    ['Picanha bovina', 8990, 10490, 'KG', 1.5],
    ['Fraldinha', 5290, 5290, 'KG', 1],
    ['Linguiça toscana da casa', 2990, 2990, 'KG', 1],
    ['Pão de alho da casa', 1490, 1490, 'PACK', 2],
    ['Costela janela', 3689, 4290, 'KG', 2],
    ['Coxa e sobrecoxa', 1890, 1890, 'KG', 1.5],
    ['Kit churrasco 10 pessoas', 32900, 36900, 'UNIT', 1],
  ] as const;
  const methods = ['PIX', 'PIX', 'PIX', 'CREDIT_CARD', 'CREDIT_CARD', 'DEBIT_CARD'] as const;

  async function createOrder(opts: { user: (typeof customers)[number]; daysAgo: number; pick: number[]; pickup?: boolean; delivery?: 'DELIVERED' | 'AWAITING' | 'CANCELLED'; cancelled?: boolean; courierId?: string }) {
    const code = `VND-${seq++}`;
    const at = days(-opts.daysAgo);
    const items = opts.pick.map((k) => {
      const [name, price, list, unit, qty] = menu[k];
      return { productId: ids[name], productName: name, unit, quantity: qty, unitPriceCents: price, listPriceCents: list, totalCents: Math.round(price * qty) };
    });
    const subtotal = items.reduce((s, i) => s + i.totalCents, 0);
    const savings = items.reduce((s, i) => s + Math.round(i.listPriceCents * i.quantity) - i.totalCents, 0);
    const address = addrOf(opts.user.id);
    const fee = opts.pickup ? 0 : 800;
    const method = methods[seq % methods.length];
    const snapshot = JSON.stringify({ label: address.label, zipCode: address.zipCode, street: address.street, number: address.number, complement: null, neighborhood: address.neighborhood, city: address.city, state: address.state, reference: null, latitude: address.latitude, longitude: address.longitude });
    const order = await prisma.order.create({
      data: {
        code,
        userId: opts.user.id,
        status: opts.cancelled ? 'CANCELLED' : 'PAID',
        fulfillment: opts.pickup ? 'PICKUP' : 'DELIVERY',
        addressId: opts.pickup ? null : address.id,
        addressSnapshot: opts.pickup ? null : snapshot,
        paymentMethod: method,
        subtotalCents: subtotal,
        savingsCents: savings,
        deliveryFeeCents: fee,
        totalCents: subtotal + fee,
        createdAt: at,
        checkoutAt: at,
        paidAt: new Date(at.getTime() + 120_000),
        cancelledAt: opts.cancelled ? new Date(at.getTime() + 900_000) : null,
        cancelReason: opts.cancelled ? 'Pedi errado' : null,
        // Past pickups were collected; today's are still waiting at the counter.
        pickedUpAt: opts.pickup && !opts.cancelled && opts.daysAgo >= 1 ? new Date(at.getTime() + 3_600_000) : null,
        pickedUpById: opts.pickup && !opts.cancelled && opts.daysAgo >= 1 ? admin.id : null,
        items: { create: items },
      },
    });
    const payment = await prisma.payment.create({
      data: { orderId: order.id, provider: 'fake', providerPaymentId: `fake_seed_${code}`, method, status: 'SUCCEEDED', amountCents: subtotal + fee, succeededAt: order.paidAt },
    });
    if (opts.cancelled) {
      await prisma.refund.create({ data: { paymentId: payment.id, orderId: order.id, amountCents: subtotal + fee, status: 'SUCCEEDED', providerRefundId: `fake_re_${code}`, completedAt: order.cancelledAt } });
    }
    if (!opts.pickup) {
      const status = opts.delivery ?? 'DELIVERED';
      await prisma.delivery.create({
        data: {
          orderId: order.id,
          orderCode: code,
          status,
          courierId: status === 'DELIVERED' ? (opts.courierId ?? carlos.id) : null,
          feeCents: fee,
          customerName: `${opts.user.firstName} ${opts.user.lastName}`,
          customerPhone: opts.user.phone,
          addressSnapshot: snapshot,
          latitude: address.latitude,
          longitude: address.longitude,
          itemsSummary: JSON.stringify(items.map((i) => ({ name: i.productName, quantity: i.quantity, unit: i.unit }))),
          deliveryCode: generateDeliveryCode(),
          startedAt: status === 'DELIVERED' ? new Date(at.getTime() + 1_800_000) : null,
          deliveredAt: status === 'DELIVERED' ? new Date(at.getTime() + 3_600_000) : null,
          cancelledAt: status === 'CANCELLED' ? order.cancelledAt : null,
          createdAt: order.paidAt!,
        },
      });
    }
    return order;
  }

  for (let d = 28; d >= 1; d--) {
    const perDay = 1 + ((d * 7) % 3);
    for (let k = 0; k < perDay; k++) {
      const user = customers[(d + k) % customers.length];
      const pick = [(d + k) % menu.length, (d + 2 * k + 3) % menu.length].filter((v, i, a) => a.indexOf(v) === i);
      await createOrder({ user, daysAgo: d + k * 0.1, pick, pickup: (d + k) % 5 === 0, courierId: (d + k) % 2 ? carlos.id : diego.id });
    }
  }
  await createOrder({ user: others[1], daysAgo: 6, pick: [2], cancelled: true, delivery: 'CANCELLED' });
  // Work waiting for the courier right now.
  await createOrder({ user: others[3], daysAgo: 0.05, pick: [1, 3], delivery: 'AWAITING' });
  await createOrder({ user: others[4], daysAgo: 0.03, pick: [0, 2], delivery: 'AWAITING' });
  await createOrder({ user: others[2], daysAgo: 0.02, pick: [4, 5], pickup: true }); // waiting at the counter
  await prisma.sequence.create({ data: { name: 'order_code', value: seq - 1 } });

  // ------------------------------------------------ reviews (only from customers who received the product)
  const reviews: Array<[number, string, number, string, string[]]> = [
    [0, 'Picanha bovina', 5, 'Veio exatamente no ponto que pedi, bifes grossos e bem embalados. Chegou gelada.', ['Corte certo', 'Chegou gelada']],
    [1, 'Picanha bovina', 5, 'Melhor picanha do bairro. A capa de gordura é certinha.', ['Macia']],
    [2, 'Picanha bovina', 4, 'Muito boa, só achei a peça um pouco menor do que esperava.', []],
    [3, 'Linguiça toscana da casa', 5, 'Tempero na medida, a família toda aprovou.', ['Bom tempero']],
    [4, 'Fraldinha', 4, 'Macia e saborosa. Entrega rápida.', ['Macia']],
    [0, 'Coxa e sobrecoxa', 3, 'Boa, mas veio com um pouco mais de gordura do que eu gosto.', []],
  ];
  for (const [who, product, rating, comment, tags] of reviews) {
    await prisma.review.create({ data: { userId: others[who].id, productId: ids[product], rating, comment, tags: JSON.stringify(tags), createdAt: days(-who - 2) } });
  }
  for (const name of Object.keys(ids)) {
    const agg = await prisma.review.aggregate({ where: { productId: ids[name], status: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } });
    await prisma.product.update({ where: { id: ids[name] }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
  }
  await prisma.favorite.createMany({ data: [ids['Fraldinha'], ids['Kit churrasco 10 pessoas'], ids['Cupim maturado']].map((productId) => ({ userId: mariana.id, productId })) });

  console.log('Seed concluído: loja, 6 bairros, 3 atendentes, 15 produtos, ofertas, pedidos e avaliações de exemplo.');
  console.log('Logins de teste (tela /entrar → "Entrar como"): cliente@, entregador@, funcionario@, admin@vandinho.dev');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
