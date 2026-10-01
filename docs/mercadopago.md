# Mercado Pago — Checkout Pro · Brasil · Preferences · Node.js

## 1. Install

Instalado com autorização do usuário: `npm install --save-exact mercadopago@3.6.1`. O servidor usa `@vercel/functions@3.9.9` para concluir as notificações após responder. Não há SDK de cartão no navegador.

## 2. Credentials

Configure em Vercel → projeto e-commerce → Settings → Environment Variables → Production:

```
MP_ACCESS_TOKEN=<Access Token do aplicativo Mercado Pago>
MP_WEBHOOK_SECRET=<segredo de assinatura das notificações>
SUPABASE_SECRET_KEY=<chave secreta do projeto Supabase>
APP_URL=https://e-commerce-gold-three-68.vercel.app
MP_PAYMENTS_ENABLED=0
```

As chaves são usadas somente pelo servidor. `.env` é ignorado pelo Git e pelo deploy; `.env.example` contém apenas nomes e valores públicos. As credenciais de produção processam pagamentos reais. Não informe as chaves no chat.

As variáveis `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e `SESSION_SECRET` da autenticação continuam obrigatórias. Obtenha as credenciais no [painel de aplicativos do Mercado Pago](https://www.mercadopago.com.br/developers/panel/app) e a chave secreta em Project Settings → API Keys do projeto Supabase.

## 3. Server code

`api/payments.js` expõe configuração, histórico, status, criação de preferência e receptor de notificações. `api/_billing.js` implementa o SDK oficial:

```js
await paymentClients().preference.create({
  body: preferenceBody(order, account),
  requestOptions: { idempotencyKey: order.id }
});
```

O servidor fixa BRL, quantidade 1 e preço R$ 1. `external_reference`, `metadata` e uma chave persistente vinculam pagamento, conta e anúncio. O relatório é calculado antes do checkout, armazenado no Supabase e retido até aprovação. Repetir a mesma solicitação reaproveita o checkout salvo. Uma falha incerta na criação não dispara outra preferência automaticamente.

O retorno usa exclusivamente `init_point` validado como HTTPS do Mercado Pago. `auto_return: 'approved'` e a URL de notificação só são definidos com APP_URL HTTPS público; localhost não usa retorno automático. A confirmação nunca vem apenas da URL do navegador: o servidor consulta `Payment.get`, verifica valor, moeda, recebedor, conta e pedido. Reembolsos e contestações bloqueiam acesso. Eventos antigos não substituem estados mais recentes.

## 4. Client code

**Total: R$ 1 por análise**, exibido antes da decisão de pagar, sem assinatura. O botão está abaixo da prévia gratuita em `diagnostico.html`; `assets/funnel.js` trata preparação, checkout, aprovação, pagamento pendente, recusa e configuração indisponível. A página inicial salva o link antes de solicitar cadastro. A prévia não inclui o relatório pago.

Não há formulário de cartão próprio: o usuário paga na página do Mercado Pago. O histórico reabre consultas já compradas. Uma nova consulta deve usar um novo pedido; reabrir uma consulta preserva os dados e custos da data da compra.

## 5. Webhook receiver

No aplicativo Mercado Pago, configure o tópico **Payments** com:

```
https://e-commerce-gold-three-68.vercel.app/api/payments?view=webhook
```

O receptor valida a assinatura HMAC-SHA256 pelo `WebhookSignatureValidator` oficial, incluindo `x-request-id`, `data.id` da query e tolerância de 300 segundos. O ID deve corresponder ao corpo. A notificação é salva numa caixa de entrada no Supabase antes da confirmação HTTP, e `waitUntil` mantém o processamento na Vercel. Se a confirmação externa falhar, a consulta de status do usuário reconcilia novamente o pagamento. Não há trabalhador automático de repetição neste lançamento; monitore eventos sem `processed_at` e erros de reconciliação.

As três migrações em `supabase/migrations/` já foram aplicadas ao projeto `mjvwqmzmjkbigghtteqp`. RLS restringe os pedidos à conta; tabelas de eventos são somente do servidor. A coluna `report` não tem permissão SELECT para `anon` nem `authenticated`, inclusive quando aprovado. Apenas o servidor pode lê-la e deve revalidar o pagamento a cada abertura.

## 6. Test

Verificação local: `npm run check`, testes específicos de assinatura, prévia, propriedade da conta, valor, reembolso e eventos atrasados; validador oficial `validate-checkout-pro-server.mjs api/_billing.js`; inspeção visual em desktop e celular. As consultas reais de cobrança ainda não foram executadas, por falta das credenciais configuradas.

Antes de ativar: use a skill `mp-test-setup` para contas de teste, configure credenciais de teste em ambiente separado e complete os cenários aprovado, pendente, recusado, assinatura adulterada, cobrança repetida, conta diferente e reembolso. Confirme que uma análise sem pagamento retorna 402 e que a mesma consulta aprovada pode ser reaberta. A Vercel de produção rejeita pagamentos em modo de teste. Depois da validação, configure credenciais de produção, altere `MP_PAYMENTS_ENABLED=1` e faça novo deploy.

## 7. Documentation

- [Checkout Pro — documentação oficial](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/overview).
- [Notificações de pagamento](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications).
- [Vercel waitUntil](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package).
- Guias oficiais empacotados com as skills `mp-integrate`, `mp-webhooks` e `mp-review`.

## 8. Gotchas

O pagamento desativado permite prévia, mas bloqueia o relatório completo. O usuário precisa confirmar o e-mail no Supabase e conectar sua própria conta Mercado Livre. A nota da prévia avalia critérios do título, não conversão. Dados indisponíveis são identificados; lucro e preço com margem exigem custos informados. Uma falha incerta ao criar preferência mantém o pedido reservado para evitar checkout duplicado; consulte os logs e reconcilie o pedido antes de iniciar outra cobrança.

## 9. Next steps

Configure as chaves na Vercel, valide as notificações (`mp-webhooks`), execute o roteiro com contas de teste (`mp-test-setup`) e repita a revisão (`mp-review`) antes de ativar cobrança. Avaliação oficial de qualidade e formulário de homologação não foram executados; o MCP Mercado Pago não estava disponível nesta sessão. Nenhum pagamento real foi iniciado pelo assistente.

## Mercado Pago Integration Review

**Scope**: security
**API detected**: Preferences + Payments API (consulta)
**Products detected**: Checkout Pro
**Files analyzed**: api/_billing.js, api/payments.js, api/analysis/listing.js, assets/funnel.js, .gitignore, .vercelignore, supabase/migrations.

### CRITICAL
- Ativação bloqueada até configuração das credenciais e validação integrada do checkout/notificação.

### WARNINGS
- Eventos cuja consulta falha dependem de nova notificação ou consulta de status; falta trabalhador automático de repetição.
- Preferência com erro incerto precisa de reconciliação operacional, sem recriação cega.

### PASS
- SDK oficial, segredo no servidor, RLS e relatório inacessível por REST.
- Valor fixo, referência do pedido, chave de idempotência, validação de assinatura e consulta ao provedor.

### Quality Standards

Not requested for this scope. Required fields e best practices oficiais não avaliados; nenhum escore oficial atribuído.

### Security checklist (cross-cutting)

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| 1 | Token somente no servidor | Pass | api/_billing.js: paymentClients |
| 2 | .env ignorado, exemplo rastreável | Pass | .gitignore; .vercelignore |
| 3 | HMAC e ID da notificação | Pass | api/_billing.js: verifyWebhook; test/billing.test.js |
| 4 | URLs públicas HTTPS | Pass | publicAppUrl e paymentConfigured; localhost sem auto_return |
| 5 | Consulta ao provedor após retorno | Pass | reconcilePayment; paidOrder |
| 6 | Idempotência persistente | Pass | api/payments.js: request_key + requestOptions |
| 7 | Referência em todas as preferências | Pass | api/_billing.js: preferenceBody |
| 8 | Credenciais de teste ausentes do deploy | Pass | .env excluído; exemplos sem segredo |
| 9 | Apenas URL oficial init_point | Pass | checkoutRedirect; assets/funnel.js |

### Recommendations

Configure credenciais, valide o checkout e as notificações com contas de teste e só então habilite cobranças. Automatize a repetição dos eventos pendentes após observar o fluxo operacional.

**Summary**: Official quality: not requested. 9/9 security checks pass por inspeção e testes locais; validação real ainda pendente.

## Implementation Report

### Verified
- [x] SDK oficial instalado com autorização; R$ 1 fixo, sem assinatura.
- [x] Prévia exclui estratégia e dados do relatório completo.
- [x] Assinatura, conta, recebedor, moeda e valor conferidos no servidor.
- [x] Idempotência e caixa de entrada persistentes; relatório privado no Supabase.
- [x] Testes locais de aprovação, pendência, reembolso e acesso de outra conta.

### Needs attention
- [ ] Validar compra e notificações com aplicativo Mercado Pago e contas de teste.
- [ ] Avaliação oficial de qualidade e formulário de homologação não executados; concluir antes de ativação.
- [ ] Monitorar/reprocessar eventos de pagamento pendentes.

### Blockers (must fix before production)
- [ ] Configurar MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET e SUPABASE_SECRET_KEY na Vercel.
- [ ] Validar ponta a ponta antes de MP_PAYMENTS_ENABLED=1.

### Next steps
1. Configurar as credenciais pelo painel, sem compartilhá-las no chat.
2. Testar checkout, notificações, reabertura e reembolso.
3. Re-run the mp-review skill after fixes to confirm the report.

### Resources used
- Local: codebase inspection + cross-cutting security floor.
- Skill: mp-review v1.0.0; mp-integrate; mp-webhooks.

**Scores**: official quality: N/A, 9/9 security. **Verdict**: Blocked for payment activation; public funnel may be published with payments disabled.
