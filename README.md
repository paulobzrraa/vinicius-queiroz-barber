# Vinicius Queiroz Barber

Site institucional da Vinicius Queiroz Barber, barbearia.

O backlog do projeto está em [backlog.docx](backlog.docx) (itens BL-001 a BL-049). O script [scripts/backlog-para-github.py](scripts/backlog-para-github.py) importa esse backlog para issues e um GitHub Project; as instruções estão no início do arquivo.

## Stack

- [Vite](https://vite.dev) + [React](https://react.dev) + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com), com o design system definido em CSS
- [Motion](https://motion.dev) (antigo Framer Motion) para animações
- [Lucide](https://lucide.dev) para ícones
- Tipografia: SF Pro nos aparelhos Apple (fonte do sistema) e Inter nos demais, auto-hospedada via Fontsource
- [Supabase](https://supabase.com) (Postgres + Storage + Auth) guarda o conteúdo do site e autentica o admin
- [React Router](https://reactrouter.com) para a rota `/admin`, separada da landing page
- [TanStack Query](https://tanstack.com/query) para buscar/cachear os dados do Supabase
- [oxlint](https://oxc.rs) para lint e [Prettier](https://prettier.io) para formatação

## Requisitos

- Node.js 20.19+ ou 22.12+
- npm
- Um projeto Supabase (ver [Admin e Supabase](#admin-e-supabase))

## Scripts

| Comando                           | O que faz                                            |
| --------------------------------- | ---------------------------------------------------- |
| `npm run dev`                     | Servidor de desenvolvimento em http://localhost:5173 |
| `npm run build`                   | Checagem de tipos e build de produção em `dist/`     |
| `npm run preview`                 | Serve o build de produção em http://localhost:4173   |
| `npm run typecheck`               | Só a checagem de tipos                               |
| `npm run lint` / `lint:fix`       | Lint com oxlint                                      |
| `npm run format` / `format:check` | Formatação com Prettier                              |

## Estrutura

```
src/
├── admin/        Painel /admin: login, RequireAuth e um editor por tipo de conteúdo
├── animations/   Tokens de movimento e variants reutilizáveis do Motion
├── assets/       Imagens importadas pelo código (brand/ tem a logo)
├── components/
│   ├── layout/   Header, menu mobile e Footer
│   ├── ui/       Componentes do design system (Button, Card, Heading...)
│   └── ...       Logo e BookingButton, usados em várias seções
├── data/         Dados estáticos que não são editáveis (hoje só o menu)
├── hooks/        Hooks de UI (header rolado, seção atual)
├── lib/          Cliente do Supabase e os tipos das tabelas
├── preview/      Página de prévia do design system (só em desenvolvimento)
├── queries/      Hooks de dados (TanStack Query) por tabela: leitura e mutações
├── sections/     Seções da landing page, uma por arquivo
├── styles/       Design system: tokens, utilitários e estilos base
├── types/        Tipos compartilhados que não vêm do banco
├── utils/        Funções utilitárias (cn, formatação, destino do agendamento)
├── App.tsx       Composição da landing page
├── AppRoutes.tsx Rotas: landing page em `/`, admin em `/admin` (code-split)
└── main.tsx      Ponto de entrada
```

Imports usam o alias `@/` para `src/` (ex.: `import { useServices } from '@/queries/services'`).

Arquivos que precisam de URL fixa (favicon, `robots.txt`, `sitemap.xml`, imagem de Open Graph) vão em `public/`, a ser criado junto com o SEO (BL-043).

## Conteúdo do site

Todo o conteúdo editável (dados do site, contato, horários, redes sociais, agendamento, serviços e galeria) vive no Supabase, não mais no código — é editado em `/admin`. Nenhum componente deve ter nome, contato, endereço, horário ou preço escrito direto no código; cada seção lê pelos hooks em `src/queries/`.

Campos ainda sem informação real ficam `null` (ou lista vazia) no banco. Os componentes devem omitir o que estiver vazio em vez de mostrar dados fictícios — é o mesmo princípio de antes, só que a fonte mudou de arquivo estático para tabela.

**Pendentes (template):** nome, cidade, endereço, telefone, Instagram, link de agendamento, logo e fotos. Ao criar o site de outra barbearia, comece por aqui.

**Pendentes:** slogan, descrição, domínio, se o telefone atende no WhatsApp, e-mail, endereço completo, horários (só existem nos stories) e serviços com preços. Preencha pelo `/admin` assim que a barbearia confirmar.

## Admin e Supabase

A rota `/admin` (separada da landing page, sem link nela) permite editar todo o conteúdo acima. Leitura é pública (a landing page não precisa de login); gravação exige estar autenticado — um único usuário, criado à mão no painel do Supabase (não há cadastro público).

**Configurar um projeto do zero:**

1. Crie um projeto em [supabase.com](https://supabase.com) (recomendado: região South America / São Paulo).
2. **Storage** → New bucket → nome `gallery`, marcado como **Public**.
3. **SQL Editor** → cole e rode [supabase/schema.sql](supabase/schema.sql) inteiro. Cria as tabelas, as políticas de segurança (leitura pública, escrita só autenticado) e semeia os dados reais já confirmados hoje.
4. **Authentication → Users** → Add user (com "Auto Confirm User" marcado) — é o login do admin.
5. **Authentication → Providers → Email** → deixe **"Confirm email" ligado**. O cadastro público precisa ficar ligado (o login com Google cria usuários), e isso é seguro porque **admin é só quem está na tabela `admins`**: o `schema.sql` coloca nela, na primeira execução, os usuários que já existem (o admin que você criou no passo 4). Para promover outro admin depois: `insert into admins (user_id) select id from auth.users where email = '...';`.
6. Copie `.env.example` para `.env.local` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (Project Settings → API Keys no painel — é a chave pública/"publishable", nunca a "secret"/"service_role").

`supabase/schema.sql` é seguro de rodar de novo (idempotente); ao alterar o schema, atualize-o junto com `src/lib/database.types.ts` (escrito à mão, sem CLI disponível para gerar automaticamente).

## Notificações por Telegram

Quando um cliente **agenda, cancela ou altera o horário** de um agendamento **pelo site**, o dono recebe uma mensagem no Telegram, com título e texto próprios de cada caso (nome, serviço, profissional, data, horário — na alteração, "antes" e "agora" —, valor e telefone; só o que existir). Ações feitas por você no admin não notificam. Funciona com o app fechado e sem nenhum computador ligado, e não custa nada (Edge Functions e `pg_cron` do plano gratuito do Supabase).

**Como funciona:** o site não conhece o token. A operação é gravada por `create_appointment`, `cancel_appointment` ou `reschedule_appointment`; ao concluir a transação, o banco enfileira a notificação (`telegram_notifications`) e chama a Edge Function [supabase/functions/telegram-notify](supabase/functions/telegram-notify), que lê `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` dos secrets do Supabase e chama a Bot API. Agendamento inválido ou que falha ao gravar nunca chega a notificar. Se o Telegram falhar, o agendamento permanece intacto, o cliente não vê nada e o `pg_cron` tenta de novo a cada minuto (até 5 tentativas no total).

### Configurar

1. **Criar o bot:** no Telegram, converse com [@BotFather](https://t.me/BotFather) → `/newbot` → escolha nome e username. Ele devolve o **token** (`123456:ABC...`). Trate como senha; se vazar, use `/revoke` no BotFather.
2. **Iniciar a conversa:** abra o bot recém-criado e envie `/start` (o bot só pode escrever para quem falou com ele primeiro).
3. **Descobrir o chat_id:** com a conversa iniciada, abra no navegador `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates` e copie `result[0].message.chat.id` (um número). Se `result` vier vazio, mande outra mensagem ao bot e recarregue. Não compartilhe essa URL: ela contém o token.
4. **Gerar um segredo para a função:** `openssl rand -hex 32`. É o `TELEGRAM_WEBHOOK_SECRET`, que impede qualquer pessoa de chamar a função.
5. **Cadastrar os secrets no Supabase** (valores só no servidor, nunca em `VITE_*` nem na Vercel):
   ```
   npx supabase login
   npx supabase link --project-ref <ref do projeto>
   npx supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... TELEGRAM_WEBHOOK_SECRET=...
   ```
   (Alternativa sem CLI: Project Settings → Edge Functions → Secrets.)
6. **Publicar a função** (`--no-verify-jwt` porque quem chama é o banco, que se autentica pelo segredo acima):
   ```
   npx supabase functions deploy telegram-notify --no-verify-jwt
   ```
7. **Rodar de novo o [supabase/schema.sql](supabase/schema.sql)** no SQL Editor (é idempotente) e habilitar **Database → Extensions → pg_cron** se ainda não estiver (sem ele há o aviso inicial, mas não o reenvio).
8. **Apontar o banco para a função** (SQL Editor; a URL está em Edge Functions → telegram-notify):
   ```sql
   update notification_settings
   set telegram_function_url = 'https://<ref>.supabase.co/functions/v1/telegram-notify',
       telegram_function_secret = '<o mesmo TELEGRAM_WEBHOOK_SECRET>'
   where id = 1;
   ```
   Deixar os dois campos `null` desliga a notificação. Faça o passo 8 por último, depois da função publicada.

Em produção o fluxo é o mesmo acima, apontando para o projeto Supabase de produção. A Vercel não participa: não há variável a configurar lá. Para o ambiente de teste, repita 5–8 no projeto de teste (pode usar o mesmo bot e chat).

### Testar

- **Fim a fim:** no ambiente de teste, faça um agendamento, depois altere o horário e cancele pelo link do agendamento; cada passo deve gerar uma mensagem no Telegram em até alguns segundos.
- **Só a função, sem agendar** (a função só aceita ids de `telegram_notifications`, então prefira o teste acima). Para ver o estado: `select appointment_id, kind, status, attempts, last_error from telegram_notifications order by created_at desc limit 10;` — `sent` = entregue, `pending` = aguardando reenvio, `failed` = esgotou as 5 tentativas.
- **Testes automatizados** (sem rede, sem credenciais reais): `npm test`.

### Quando falhar

- `last_error` em `telegram_notifications` mostra o motivo (`401 Unauthorized` = token errado; `400 chat not found` = chat_id errado ou `/start` não enviado; `... não configurado` = falta secret).
- Logs da função: painel Supabase → Edge Functions → telegram-notify → Logs (ou `npx supabase functions logs telegram-notify`). Eles trazem só o id do agendamento e o motivo; nunca nome, telefone ou token.
- Se a função nem chegou a ser chamada, veja `select * from net._http_response order by created desc limit 10;` (status 401 = segredo do banco diferente do secret da função).
- Depois de corrigir a causa, reenfileire: `update telegram_notifications set status = 'pending', attempts = 1, last_attempt_at = now() - interval '3 minutes' where status = 'failed';`.

### Limitações

- Entrega "pelo menos uma vez": se o Telegram aceitar a mensagem mas a resposta se perder, o reenvio pode duplicar o aviso. Não há garantia de "exatamente uma vez".
- O reenvio depende do `pg_cron`; as 5 tentativas cobrem indisponibilidades de alguns minutos, não de horas.
- Só o cliente pelo site gera aviso; cancelar, editar ou criar pelo admin não notifica. A única "edição" que o cliente tem é trocar data/horário.
- O código da função (Deno) não é checado pelo `npm run typecheck`; sua lógica é coberta pelos testes em `supabase/functions/telegram-notify/*.test.ts`, mas o trigger/SQL só pode ser validado rodando em um projeto Supabase de teste.

## Notificações push para o admin

Quando um agendamento é **criado, cancelado ou alterado** (horário, profissional, duração ou serviços), os aparelhos dos administradores recebem um aviso do navegador (Web Push). Vale para qualquer origem: pelo site, pelo painel e pelo link do cliente. Só quem está logado como admin ativa e recebe; o site público nunca pede permissão. Não substitui o Telegram, que continua igual.

**Como funciona:** o gatilho é a própria tabela `appointments`. Ao concluir a transação, o banco enfileira o evento em `push_notifications` e chama a Edge Function [supabase/functions/web-push-notify](supabase/functions/web-push-notify) via `pg_net`. A função lê as assinaturas ativas (só de admins), criptografa o aviso e envia com as chaves VAPID, que ficam **só nos secrets da função**. Operação revertida nunca notifica; falha no push nunca desfaz o agendamento.

### Configurar

1. **Gerar as chaves VAPID** (uma vez por projeto): `node scripts/generate-vapid-keys.mjs`. A chave **pública** vai para o banco (passo 5) e para o secret `VAPID_PUBLIC_KEY`; ela não é segredo, e o site a lê pelo banco, então não precisa de variável na Vercel. A **privada** (`VAPID_PRIVATE_KEY`) nunca vai para o site nem para o Git.
2. **Rodar o `supabase/schema.sql`** de novo no SQL Editor do projeto (é idempotente).
3. **Publicar a função** (mesmo jeito do Telegram):
   `npx supabase functions deploy web-push-notify --no-verify-jwt`
4. **Secrets da função** (Edge Functions → Secrets, ou `npx supabase secrets set`):
   - `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` (do passo 1)
   - `VAPID_SUBJECT`: `mailto:seu-email@exemplo.com` (contato exigido pelo serviço de push)
   - `WEB_PUSH_WEBHOOK_SECRET`: uma string aleatória longa (é o que impede outros de chamarem a função)
5. **Apontar o banco para a função e guardar a chave pública** (SQL Editor; a URL está em Edge Functions → web-push-notify):
   ```sql
   update notification_settings
   set push_function_url = 'https://<ref>.supabase.co/functions/v1/web-push-notify',
       push_function_secret = '<o mesmo WEB_PUSH_WEBHOOK_SECRET>',
       push_public_key = '<a chave pública do passo 1>'
   where id = 1;
   ```
6. **Sem deploy de site para ativar:** o site lê a chave pela função `get_push_public_key()`. Enquanto `push_public_key` estiver vazio, o botão mostra "ainda não configuradas".

**HTTPS:** o Web Push exige HTTPS (o site na Vercel já é). Em `localhost` também funciona, para testes.

**iPhone/iPad:** o Safari só oferece notificações para sites **adicionados à Tela de Início** (iOS 16.4 ou superior). Abra o site no Safari → Compartilhar → Adicionar à Tela de Início, depois abra pelo ícone e toque em "Ativar notificações" no painel. O `manifest.webmanifest` existe para isso. No Android e no computador, basta o navegador (Chrome, Edge, Firefox ou Safari no Mac).

### Usar

No painel, abra **Agenda** e toque em **Ativar notificações**. O navegador pede permissão (só nesse clique). A tela mostra o estado deste aparelho: ativado, desativado, bloqueado ou sem suporte. Cada admin pode ter até 10 aparelhos. "Desativar notificações" remove a assinatura deste aparelho no banco e no navegador.

Ao tocar no aviso, o app abre a **Agenda**; se a sessão expirou, o login volta para a Agenda.

### Testar cada evento

No ambiente de teste (ou em produção, com cuidado: são agendamentos de verdade):

- **Novo agendamento:** agende pelo link do site, ou crie um pelo painel (botão de novo agendamento). O aviso sai em alguns segundos.
- **Edição:** altere o horário ou o serviço de um agendamento pelo painel, ou reagende pelo link do cliente. Mudar só o status (concluir, não compareceu, forma de pagamento) não notifica de propósito.
- **Cancelamento:** cancele pelo link do cliente ou troque o status para cancelado no painel.

Para acompanhar: `select kind, status, devices, last_error, created_at from push_notifications order by created_at desc limit 10;` (`sent` = entregue a pelo menos um aparelho, `failed` = nenhum recebeu, `skipped` = sem aparelho ativo). Os logs da função trazem só ids e o motivo.

### Limitações

- **Sem reenvio automático:** push é "melhor esforço". Se o serviço de push do navegador falhar, a linha fica `failed` e o aviso não é tentado de novo (o Telegram tem reenvio pelo `pg_cron`).
- **Tela bloqueada:** o aviso mostra o nome do cliente, o serviço e o horário, como pedido. Quem tiver o celular desbloqueado à vista vê isso. Se preferir, troque o nome pelo primeiro nome em `supabase/functions/web-push-notify/message.ts`.
- **Exclusão** de agendamento pelo painel **não** notifica (não está entre os eventos pedidos).
- **Um aparelho que expira** (desinstalou o app, limpou os dados do navegador) é marcado `active = false` na primeira tentativa que o serviço de push recusa com 404/410, e para de receber.
- **Dispositivos de quem deixou de ser admin** deixam de receber na hora (a função confere a tabela `admins`).
- **O endpoint de cada aparelho é uma credencial**: fica só na tabela `push_subscriptions`, legível apenas pelo próprio admin, e nunca vai para logs.
- **Não testado num aparelho real pelo agente:** a criptografia tem testes automatizados (RFC 5869 e decifragem independente), mas a entrega de fato depende de FCM/Apple/Mozilla e só se confirma no seu celular.

### Testes

- `npm test`: inclui `supabase/tests/push-notifications.db.test.ts`, que roda o `schema.sql` de verdade num Postgres em WASM ([PGlite](https://pglite.dev)). Cobre triggers, RPCs, RLS, deduplicação, falha sem derrubar agendamento e convivência com o Telegram. Stubs mínimos só para o que é do Supabase (`auth.uid()`, `pg_net`).
- `supabase/functions/web-push-notify/*.test.ts`: criptografia, JWT VAPID, formato das mensagens e o handler (410/404, aparelhos, falhas).

## Ambiente de teste

O `.env.local` aponta para o banco real: com ele, o `npm run dev` grava agendamentos de verdade. Para testar sem risco, use um segundo projeto Supabase (o plano gratuito permite dois):

1. Crie o projeto de teste e repita os passos 1 a 5 de "Configurar um projeto do zero" (bucket `gallery`, `schema.sql`, usuário admin, cadastro público desligado).
2. No SQL Editor do projeto de teste, rode também [supabase/test-seed.sql](supabase/test-seed.sql): serviços, barbeiros e horários fictícios, para o fluxo de agendamento ter o que mostrar. **Nunca rode esse arquivo em produção.**
3. Crie `.env.development.local` (copie o bloco "Ambiente de teste" do `.env.example`) com a URL e a publishable key do projeto de teste e `VITE_APP_ENV=test`.
4. Rode `npm run dev`. O Vite lê `.env.development.local` por cima do `.env.local`, e uma faixa no canto da tela mostra "Ambiente de teste". Se a faixa estiver vermelha ("Banco de PRODUÇÃO"), o localhost está gravando no banco real.

O build de produção e a Vercel não leem `.env.development.local`, então nada muda lá. Os scripts de `scripts/qa` só rodam com `VITE_APP_ENV=test`: `node --env-file=.env.development.local scripts/qa/e2e-flow.mjs`.

## Design system

Moderno, premium e urbano, com tipografia pesada no estilo da Apple, bastante respiro e microinterações sutis.

**A paleta vem da logo oficial**: cromo teal sobre preto, como nas fotos do Instagram. O fundo é azul-marinho bem escuro, os textos são prata e o destaque é um teal de brilho (`--teal-300`). No tom claro, o destaque vira um teal mais fundo (`--teal-700`), para manter o contraste. A logo é o emblema colorido (`src/assets/brand/logo-color.png`), recortado de um post do Instagram com fundo transparente. Para ficar nítido em tamanhos grandes, substitua por um PNG ou SVG em alta resolução, mantendo o nome do arquivo.

Com `npm run dev`, a prévia completa fica em http://localhost:5173/design-system.html (tokens e componentes nos dois tons, com os valores medidos no navegador). Ela não entra no build de produção.

### Onde fica cada coisa

| Arquivo                    | Conteúdo                                                 |
| -------------------------- | -------------------------------------------------------- |
| `src/styles/tokens.css`    | Paleta, tokens do tema e o tom claro                     |
| `src/styles/utilities.css` | Transição dos controles, links e gradientes              |
| `src/styles/base.css`      | Estilos globais: corpo de texto, foco, seleção           |
| `src/animations/tokens.ts` | Curvas, durações e molas para o Motion (espelham o CSS)  |
| `src/components/ui/`       | Button, Card, Container, Eyebrow, Heading, Section, Text |

### Regras

- **Cores:** use só os tokens semânticos (`bg-surface`, `text-muted`, `border-border`, `bg-accent`...), nunca hex nem a paleta base (`--ink-*`, `--steel-*`, `--teal-*`). O fundo escuro é `#03070c`, as superfícies são `#071019` e o texto é `#eef5f8`. O destaque é `--teal-300`.
- **Tom claro:** `<Section tone="light">` troca para o fundo `#f1f6f8` e o destaque para o teal escuro (`#0f5561`), mantendo bordas, botões e sombras.
- **Logo:** `<Logo className="h-10" />` (tamanho pela altura). É a imagem colorida, usada igual nos dois tons.
- **Tipografia:** títulos com `<Heading>` (a tag define a hierarquia e `size` o tamanho: `display`, `title-1` a `title-4`); texto com `<Text>` (`lead`, `body`, `small`, `caption`); rótulos com `<Eyebrow>`. Cada tamanho já traz peso, entrelinha e tracking.
- **Fonte:** SF Pro nos aparelhos Apple, pela fonte do sistema (a licença da Apple não permite embutir o SF Pro num site), e Inter nos demais, com tamanhos ópticos. Para ver a versão Inter no Mac, abra a prévia com `?fonte=inter`.
- **Espaços:** `px-gutter` (lateral da página), `py-section` (entre seções), `mt-block` (título até o conteúdo), `p-card` (cards). Dentro dos componentes, a escala de 4px do Tailwind.
- **Larguras:** `<Container size>` com `text` (~70 caracteres), `narrow`, `content` (padrão) e `wide`.
- **Breakpoints:** padrões do Tailwind mais `xs` (375px) e `3xl` (1920px).
- **Interação:** hover só com mouse; botões encolhem para 97% ao pressionar; foco com contorno de 2px na cor de destaque (branco no escuro, preto no claro), só no teclado. Movimento com `motion-safe:`, para respeitar quem prefere menos movimento. Transições com `transition-control`, nunca `transition-all`.
- **Movimento:** as curvas `ease-out`, `ease-in-out` e `ease-drawer` existem no CSS e em `src/animations/tokens.ts`, e devem mudar juntas.

## Header

Fixo no topo e sempre ao alcance, porque o botão de agendar precisa estar visível o tempo todo (por isso não esconde ao rolar).

- **Sobre o Hero:** transparente, com um degradê de topo (`bg-gradient-scrim-top`) que garante a leitura até sobre fotos claras, como as da barbearia. Ao rolar, vira um vidro translúcido com desfoque e um filete de luz embaixo. O Hero deve reservar `pt-header` no topo.
- **Menu:** Galeria, Agendamento, Contato e Sobre Nós, em `src/data/navigation.ts`. A seção atual fica sublinhada (`aria-current`). Abaixo de 1024px vira um painel em tela cheia sobre o `<dialog>` nativo, que já traz foco preso, Esc e devolução do foco.
- **Rolagem:** suave via CSS, com as âncoras parando abaixo do header (`scroll-padding-top`). Desligada para quem prefere menos movimento.
- **Agendar:** o botão leva ao destino configurado na aba Agendamento do `/admin` (tabela `booking_settings`; hoje, o agendamento online oficial, em nova aba). Para usar o WhatsApp, troque o provedor para WhatsApp e preencha o WhatsApp em Contato.
- **Acessibilidade:** link "Pular para o conteúdo", alvos de toque de 44px, `aria-expanded` no botão de menu, e superfícies opacas para quem pede menos transparência.

## Hero

Ocupa a tela inteira (`min-h-dvh`) e comunica só o que é certo, sem slogan, endereço, telefone ou preço inventados. Visualmente, sobram a logo, os CTAs e o fundo gráfico; o nome da marca (`site_settings`, editável em `/admin`) fica só num `h1` `sr-only`, para leitores de tela.

- **Logo:** o emblema redondo (`src/assets/brand/logo-color.png`) no centro, com um halo teal fixo e uma sombra de contato no chão, a única sombra da logo: ela afina de lado e desliza para o lado oposto ao giro, sem filtro fixo na imagem. O ponteiro percorre o Hero inteiro e controla o giro: a posição horizontal gira a logo em torno do eixo vertical e a vertical em torno do horizontal, ambas de −180° a 180°. Uma mola (`LOGO_FOLLOW`) leva a logo até o alvo com um pequeno atraso. Ao sair do Hero, ou soltar o dedo, ela volta à posição de repouso. Com `prefers-reduced-motion`, não gira. A lógica fica em `src/sections/Hero.tsx` (`turnLogo` e `releaseLogo`).
- **Fundo:** por padrão, o tratamento gráfico (`bg-hero-glow` com grão, em `src/sections/Hero.tsx`). Não há mais foto de fundo no código. Se `hero_image_url` tiver uma foto (enviada em `/admin` → Site → Hero), ela entra no lugar, escurecida, com o parallax.
- **Enquadramento:** só aparece no `/admin` quando há uma foto de fundo. A prévia mostra a foto em desktop e em mobile. Arraste a foto (ou use as setas do teclado) e ajuste o zoom; cada tamanho tem o seu (`hero_focus_desktop` e `hero_focus_mobile` em `site_settings`, lidos por `src/utils/heroPhoto.ts`). Para salvar o enquadramento, rode `supabase/schema.sql` de novo: ele cria essas colunas.
- **CTAs:** `Reservar horário` (primário, leva a Agendamento) e `Sobre nós` (contorno, leva a Sobre Nós), centralizados logo abaixo da logo, no meio do Hero. Sempre um abaixo do outro, com 288px de largura (`w-72`), em qualquer tela.
- **Indicador de rolagem:** seta discreta no rodapé da seção, com rótulo acessível; também é um link para Sobre Nós.
- **Animação de entrada:** a logo, os CTAs e a seta entram em sequência (`src/animations/variants.ts` + `motion/react`). O `<MotionConfig reducedMotion="user">` em `main.tsx` faz toda animação do Motion no site respeitar `prefers-reduced-motion` automaticamente (BL-036), não só aqui.

### Meus agendamentos (e-mail + senha)

O cliente que informa e-mail e senha ao agendar passa a ter uma conta simples: a primeira vez cria a conta, as seguintes conferem a senha. Ele entra em `/meus-agendamentos` com e-mail + senha e vê os próximos horários (cada um leva ao link para ver, reagendar ou cancelar). Rode o `supabase/schema.sql` de novo (é idempotente): ele cria a conta, as funções e remove o antigo código por e-mail (incluindo a chave do Resend).

- **Não usa o Supabase Auth**, porque aqui qualquer usuário autenticado é admin: um cliente logado por lá teria acesso ao painel. A conta é uma tabela própria (`client_accounts`), com a senha em hash bcrypt, e o cliente continua anônimo para o banco.
- **Segurança sem verificação de e-mail:** o agendamento só é vinculado à conta quando a senha é provada na hora de agendar. Senha errada não barra o agendamento, mas ele não aparece na conta. Cinco erros seguidos bloqueiam a conta por 15 minutos.
- **Alterar senha:** quem entrou com e-mail + senha vê "Alterar senha" em Meus agendamentos. A tela pede a senha atual, a nova e a confirmação. A senha atual é conferida no banco a cada troca, com a mesma contagem de erros e bloqueio do login (5 erros = 15 minutos), e a nova precisa ser diferente. Depois da troca, a sessão é encerrada e o cliente entra de novo.
- **Regra de senha nova** (criar conta, trocar, redefinir pelo admin): de 8 a 72 caracteres, sem repetir o mesmo caractere e sem senhas óbvias (`12345678`, `password`...). Contas antigas com senha menor continuam entrando.
- **Esqueci a senha:** não há envio de e-mail. O admin define uma senha nova em `/admin` → Agendamento → "Senha de cliente" e passa para o cliente.

### Login com Google (grátis)

Em `/meus-agendamentos` e no passo "Seus dados" aparece "Continuar com Google". Quem entra assim não precisa de senha: o Google confirma o e-mail, e o agendamento feito com esse e-mail aparece em Meus agendamentos. O Apple não está ligado (exige o Apple Developer Program, US$ 99/ano, e um domínio com HTTPS).

Configuração, uma vez por projeto Supabase (teste e produção):

1. [Google Cloud Console](https://console.cloud.google.com) → crie um projeto → **APIs e serviços → Tela de permissão OAuth**: tipo "Externo", nome do app, e-mail de suporte. Escopos: só os básicos (e-mail e perfil), sem verificação do Google.
2. **Credenciais → Criar credenciais → ID do cliente OAuth** → tipo "Aplicativo da Web". Em **URIs de redirecionamento autorizados** coloque `https://<ref-do-projeto>.supabase.co/auth/v1/callback` (aparece no painel do Supabase, em Authentication → Providers → Google). Copie o Client ID e o Client Secret.
3. Supabase → **Authentication → Providers → Google** → ligue e cole o Client ID e o Client Secret.
4. Supabase → **Authentication → URL Configuration**: em "Site URL" o endereço de produção, e em "Redirect URLs" `http://localhost:5173/**` e `https://<seu-dominio>/**`.

A sessão do Google fica numa chave separada (`vinicius-queiroz-barber-client-auth`) da sessão do admin, e nenhuma delas dá acesso ao painel sem estar em `admins`.
