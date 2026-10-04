/**
 * Rascunhos das páginas legais em Markdown. São um ponto de partida para o lojista
 * editar no painel — a verificação do Google OAuth exige uma Política de Privacidade
 * e Termos de Serviço públicos descrevendo o uso dos dados da conta Google.
 */
export interface LegalTemplateStore {
  name: string;
  cnpj: string;
  addressLine: string;
  whatsapp: string;
}

const contact = (s: LegalTemplateStore) => {
  const lines = [`- **Loja:** ${s.name}`];
  if (s.cnpj) lines.push(`- **CNPJ:** ${s.cnpj}`);
  if (s.addressLine) lines.push(`- **Endereço:** ${s.addressLine}`);
  if (s.whatsapp)
    lines.push(`- **WhatsApp:** [${s.whatsapp}](https://wa.me/${s.whatsapp})`);
  return lines.join('\n');
};

export function privacyPolicyTemplate(s: LegalTemplateStore) {
  return `## Quem somos

Esta Política de Privacidade explica como o ${s.name} coleta, usa e protege os dados pessoais de quem utiliza nossa loja online, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).

${contact(s)}

## Dados que coletamos

- **Cadastro:** nome, e-mail, telefone e senha (armazenada de forma criptografada).
- **Login com o Google:** ao entrar com sua conta Google, recebemos apenas seu nome, endereço de e-mail e foto de perfil, a partir do seu consentimento na tela do Google. Não acessamos contatos, agenda, arquivos ou qualquer outro dado da sua conta.
- **Pedidos e entrega:** endereço de entrega, bairro, ponto de referência, itens do pedido e observações.
- **Pagamento:** processado pela Stripe. Não armazenamos números de cartão em nossos servidores.
- **Comunicação:** mensagens trocadas pelo WhatsApp sobre pedidos e atendimento.
- **Uso do site:** dados técnicos como endereço IP e tipo de dispositivo, usados para segurança e funcionamento.

## Para que usamos seus dados

- Criar e manter sua conta e autenticar seu acesso.
- Processar, entregar e acompanhar seus pedidos.
- Enviar avisos sobre o status do pedido por WhatsApp.
- Prevenir fraudes e garantir a segurança da loja.
- Cumprir obrigações legais e fiscais.

Não vendemos nem alugamos seus dados pessoais.

## Com quem compartilhamos

Compartilhamos apenas o necessário para o pedido acontecer:

- **Stripe** — processamento de pagamentos.
- **Provedor de WhatsApp** — envio das mensagens de acompanhamento do pedido.
- **Entregadores** — nome, telefone e endereço de entrega do pedido em questão.
- **Autoridades públicas** — quando exigido por lei.

## Por quanto tempo guardamos

Mantemos os dados da conta enquanto ela existir. Dados de pedidos e pagamentos são mantidos pelo prazo exigido pela legislação fiscal e de defesa do consumidor.

## Seus direitos

Você pode solicitar, a qualquer momento: confirmação de tratamento, acesso, correção, portabilidade, anonimização, revogação do consentimento e exclusão dos seus dados. Dados do login com o Google podem ser desvinculados a qualquer momento em [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

Para exercer esses direitos, fale com a gente pelos contatos acima.

## Cookies

Usamos cookies essenciais para manter você conectado e lembrar do seu carrinho. Eles são necessários para o funcionamento da loja.

## Segurança

Adotamos medidas técnicas e administrativas para proteger seus dados, como conexão criptografada (HTTPS), senhas com hash e acesso restrito à administração da loja.

## Alterações

Podemos atualizar esta política. A data da última atualização é exibida no topo desta página.
`;
}

export function termsTemplate(s: LegalTemplateStore) {
  return `## Sobre estes termos

Estes Termos de Serviço regulam o uso da loja online do ${s.name}. Ao criar uma conta ou fazer um pedido, você concorda com as condições abaixo.

${contact(s)}

## Conta de acesso

- É necessário ter 18 anos ou mais para comprar.
- Você pode criar a conta com e-mail e senha ou entrar com sua conta Google.
- As informações de cadastro devem ser verdadeiras e mantidas atualizadas.
- Você é responsável por manter a confidencialidade da sua senha e pelas ações feitas na sua conta.
- Podemos suspender contas que violem estes termos ou façam uso fraudulento da loja.

## Produtos, peso e preços

- Os produtos são vendidos por peso ou por unidade, conforme indicado em cada item.
- Cortes porcionados na hora podem ter pequena variação de peso; o valor cobrado considera o peso informado no pedido.
- Preços, ofertas e disponibilidade podem mudar a qualquer momento, sem afetar pedidos já pagos.
- Imagens dos produtos são ilustrativas.

## Pedidos e pagamento

- O pedido é confirmado após a aprovação do pagamento.
- Aceitamos Pix e cartão de crédito e débito, processados pela Stripe.
- O código Pix e a sessão de pagamento têm prazo de validade; expirado o prazo, o pedido é cancelado automaticamente.

## Entrega e retirada

- Entregamos nos bairros listados no site, com taxa e prazo informados antes da finalização do pedido.
- Os prazos são estimativas e podem variar conforme trânsito, clima e volume de pedidos.
- É necessário informar o código de entrega ao entregador para concluir o recebimento.
- Na retirada, o pedido fica disponível no balcão mediante apresentação do código.
- Se não houver quem receba no endereço informado, a entrega pode ser frustrada e novas tentativas podem gerar nova cobrança de taxa.

## Cancelamento, troca e devolução

- Pedidos podem ser cancelados enquanto não estiverem em preparo; o reembolso é feito pelo mesmo meio de pagamento.
- Por se tratar de alimento perecível, trocas e devoluções são aceitas em caso de produto com defeito, avaria ou divergência do pedido, mediante contato em até 24 horas do recebimento.
- Nas compras à distância, aplica-se o direito de arrependimento previsto no art. 49 do Código de Defesa do Consumidor, respeitada a natureza perecível dos produtos.

## Uso da loja

Você concorda em não utilizar a loja para fins ilícitos, não tentar burlar sistemas de pagamento ou segurança e não publicar avaliações falsas ou ofensivas.

## Avaliações

Avaliações devem refletir sua experiência real de compra. Podemos remover conteúdos ofensivos, falsos ou que violem direitos de terceiros.

## Responsabilidade

Nos esforçamos para manter a loja disponível e as informações corretas, mas não garantimos funcionamento ininterrupto. Nossa responsabilidade se limita ao valor do pedido envolvido.

## Privacidade

O tratamento dos seus dados pessoais está descrito na nossa [Política de Privacidade](/privacidade).

## Alterações e foro

Podemos atualizar estes termos; a data da última atualização aparece no topo desta página. Aplica-se a legislação brasileira, incluindo o Código de Defesa do Consumidor.
`;
}
