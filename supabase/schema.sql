-- Schema do admin da Vinicius Queiroz Barber.
--
-- Rode este script inteiro uma vez no SQL Editor do projeto Supabase (depois
-- de criar o bucket "gallery" no painel — ver README de setup). É seguro
-- rodar de novo: tabelas e políticas são recriadas, e o seed usa
-- ON CONFLICT DO NOTHING, então não duplica os dados na segunda vez.

create extension if not exists "pgcrypto";
-- Permite o índice/constraint de exclusão usado em "appointments" (BL-060)
-- para impedir dois agendamentos sobrepostos do mesmo profissional.
create extension if not exists "btree_gist";
-- Permite chamar uma URL http de dentro do banco (notificações por Telegram,
-- mais abaixo) — já vem habilitada por padrão nos projetos Supabase.
create extension if not exists "pg_net";

-- ===================== Configurações (uma linha só) =====================

create table if not exists site_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null,
  tagline text,
  description text,
  url text,
  locale text not null default 'pt-BR',
  -- Texto da seção "Sobre Nós" e foto de fundo do Hero. Ambos null até a
  -- barbearia confirmar o texto e existir uma foto real em alta resolução
  -- (ver comentários em src/sections/About.tsx e Hero.tsx).
  about_body text,
  hero_image_url text
);

-- Colunas adicionadas depois da criação inicial da tabela (ALTER, para quem já rodou este script antes).
alter table site_settings add column if not exists about_body text;
alter table site_settings add column if not exists hero_image_url text;
-- GIF opcional ao lado do texto de "Sobre Nós" (src/sections/About.tsx). Sem
-- altura fixa: a seção respeita a altura natural do arquivo enviado.
alter table site_settings add column if not exists about_gif_url text;

create table if not exists contact_settings (
  id smallint primary key default 1 check (id = 1),
  whatsapp text,
  phone text,
  email text,
  street text,
  neighborhood text,
  city text not null,
  state text not null,
  postal_code text,
  country text not null default 'BR',
  maps_url text
);

create table if not exists booking_settings (
  id smallint primary key default 1 check (id = 1),
  provider text not null default 'external' check (provider in ('whatsapp', 'external')),
  external_url text,
  whatsapp_message text not null default ''
);

-- BL-062: antecedência mínima (não deixar agendar em cima da hora) e máxima
-- (não deixar agendar com meses de antecedência) do módulo de agendamento
-- próprio. Configurável no admin (BL-097). Defaults razoáveis.
alter table booking_settings add column if not exists min_advance_minutes integer not null default 60;
alter table booking_settings add column if not exists max_advance_days integer not null default 60;

-- BL-079/BL-097: prazo mínimo antes do horário marcado para o cliente ainda
-- poder cancelar ou reagendar pelo link único (cancel_appointment/
-- reschedule_appointment, mais abaixo).
alter table booking_settings add column if not exists min_cancel_notice_minutes integer not null default 120;

-- BL-100: além de external/whatsapp, o módulo de agendamento próprio agora é
-- uma opção de destino dos CTAs (ver src/utils/booking.ts, que hoje aponta
-- direto para /agendar independente deste campo — o critério de quando essa
-- troca deve ser dirigida por este campo é o BL-101).
alter table booking_settings drop constraint if exists booking_settings_provider_check;
alter table booking_settings add constraint booking_settings_provider_check
  check (provider in ('whatsapp', 'external', 'native'));

-- ===================== Listas =====================

create table if not exists opening_hours (
  id uuid primary key default gen_random_uuid(),
  days text not null,
  hours text not null,
  sort_order integer not null default 0
);

-- BL-057: linhas estruturadas por dia da semana, para o motor de
-- disponibilidade (BL-059) calcular sem precisar interpretar texto livre.
-- days/hours continuam existindo como fallback de exibição: o admin (BL-093)
-- hoje só gera linhas estruturadas, mas a seção de Contato ainda sabe exibir
-- linhas antigas (sem weekday, só texto livre) se alguma existir. weekday
-- segue a mesma convenção de Date.getDay() no JS: 0 = domingo … 6 = sábado.
-- Uma linha com weekday preenchido e opens_at/closes_at nulos representa
-- "fechado" nesse dia.
alter table opening_hours add column if not exists weekday smallint;
alter table opening_hours add column if not exists opens_at time;
alter table opening_hours add column if not exists closes_at time;

alter table opening_hours drop constraint if exists opening_hours_weekday_check;
alter table opening_hours add constraint opening_hours_weekday_check
  check (weekday is null or weekday between 0 and 6);

alter table opening_hours drop constraint if exists opening_hours_hours_range_check;
alter table opening_hours add constraint opening_hours_hours_range_check
  check ((opens_at is null) = (closes_at is null));

drop index if exists opening_hours_weekday_key;
create unique index opening_hours_weekday_key on opening_hours (weekday) where weekday is not null;

create table if not exists social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram', 'facebook', 'tiktok', 'youtube')),
  url text not null,
  sort_order integer not null default 0,
  unique (platform, url)
);

create table if not exists services (
  id text primary key,
  name text not null,
  description text not null,
  price text,
  duration_minutes integer,
  sort_order integer not null default 0
);

-- BL-096: pausar um serviço (some da seleção do cliente) sem apagar o
-- cadastro nem o histórico de agendamentos que já usam esse id.
alter table services add column if not exists active boolean not null default true;

-- BL-095: duração passa a ser obrigatória — o motor de disponibilidade
-- (BL-059) depende dela para calcular o fim do horário. Se algum serviço já
-- foi cadastrado pelo admin sem duração (era opcional até agora), preenche
-- com 30 min antes de travar a coluna — edite pelo admin para o valor real.
update services set duration_minutes = 30 where duration_minutes is null;
alter table services alter column duration_minutes set not null;

create table if not exists gallery_images (
  id text primary key,
  alt text not null,
  category text not null check (category in ('ambiente', 'corte', 'barba', 'detalhe')),
  aspect text not null check (aspect in ('square', 'portrait', 'landscape')),
  src text,
  sort_order integer not null default 0
);

-- BL-023: avaliações de clientes reais — a seção some da página até existir
-- pelo menos um depoimento cadastrado (mesmo princípio de services/gallery
-- vazios, ver comentário no fim do arquivo).
create table if not exists testimonials (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  rating smallint not null check (rating between 1 and 5),
  quote text not null,
  sort_order integer not null default 0
);

-- ===================== Agendamento: Profissionais =====================
--
-- Primeira tabela do módulo de agendamento próprio (backlog BL-050 em
-- diante). Suporta múltiplos barbeiros: BL-051 (serviços por profissional),
-- BL-052 (horário de trabalho) e BL-054 (agendamentos) referenciam esta
-- tabela nas próximas US.

create table if not exists professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  bio text,
  active boolean not null default true,
  sort_order integer not null default 0
);

-- Quais serviços cada profissional realiza (BL-091 edita isso no admin). Um
-- profissional sem linha aqui para um serviço não o realiza. price/duration_minutes
-- nulos usam o valor padrão do serviço; preenchidos, sobrescrevem só para esse
-- profissional (ex.: um barbeiro mais experiente cobra mais pelo mesmo corte).
create table if not exists professional_services (
  professional_id uuid not null references professionals (id) on delete cascade,
  service_id text not null references services (id) on delete cascade,
  price text,
  duration_minutes integer,
  primary key (professional_id, service_id)
);

-- BL-052: horário de trabalho semanal de cada profissional, com intervalo de
-- almoço opcional. weekday na mesma convenção de opening_hours (0 = domingo
-- … 6 = sábado). Uma linha por dia por profissional; dia sem linha aqui =
-- profissional não atende nesse dia.
create table if not exists professional_hours (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references professionals (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  break_starts_at time,
  break_ends_at time,
  unique (professional_id, weekday),
  check (ends_at > starts_at),
  check ((break_starts_at is null) = (break_ends_at is null)),
  check (
    break_starts_at is null
    or (break_starts_at >= starts_at and break_ends_at <= ends_at and break_ends_at > break_starts_at)
  )
);

-- BL-053: folgas, férias e bloqueios pontuais. professional_id nulo = vale
-- para a barbearia inteira (feriado, fechamento geral); preenchido = só
-- aquele profissional. starts_at/ends_at cobrem tanto um dia cheio (férias)
-- quanto um intervalo pontual dentro do dia (ex.: compromisso das 14h às
-- 16h), sem precisar de uma modelagem separada para cada caso.
create table if not exists schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid references professionals (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);

-- BL-056: tempo de preparo/limpeza após um atendimento, configurável por
-- serviço ou por profissional. Quando os dois estão preenchidos, o cálculo
-- de disponibilidade (BL-059, função service_minutes_for_professional mais
-- abaixo) usa o maior dos dois valores.
alter table services add column if not exists buffer_minutes integer;
alter table professionals add column if not exists buffer_minutes integer;

-- BL-054/BL-055: agendamentos. status e o histórico de transições usam os
-- mesmos 5 estados: pending (pendente), confirmed (confirmado), completed
-- (concluído), canceled (cancelado), no_show (não compareceu). access_token
-- é o link único do cliente (BL-058/BL-077) para ver, cancelar ou reagendar
-- sem login. professional_id nunca é nulo: mesmo "sem preferência" (BL-061),
-- um profissional específico já foi atribuído no momento da criação.
create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  access_token uuid not null default gen_random_uuid() unique,
  client_name text not null,
  client_phone text not null,
  professional_id uuid not null references professionals (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'completed', 'canceled', 'no_show')),
  source text not null default 'site' check (source in ('site', 'admin')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

-- BL-060: garantia no próprio banco (não só na aplicação) de que o mesmo
-- profissional nunca tem dois agendamentos com horários que se cruzam.
-- Cobre a corrida entre dois clientes tentando o mesmo horário ao mesmo
-- tempo (BL-110): mesmo que os dois passem pela revalidação (BL-073), só um
-- INSERT vence — o outro recebe um erro de exclusão (23P01) do Postgres.
-- Agendamentos cancelados não contam (por isso o "where"): o horário libera
-- de novo assim que o status muda para canceled.
alter table appointments drop constraint if exists appointments_no_overlap;
alter table appointments add constraint appointments_no_overlap
  exclude using gist (professional_id with =, tstzrange(starts_at, ends_at) with &&)
  where (status <> 'canceled');

-- E-mail opcional do cliente (só como contato; o login usa client_accounts,
-- logo abaixo). Sempre gravado em minúsculas; null = cliente não informou.
alter table appointments add column if not exists client_email text;
alter table appointments drop constraint if exists appointments_client_email_format;
alter table appointments add constraint appointments_client_email_format
  check (client_email is null or (length(client_email) <= 254 and client_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'));
create index if not exists appointments_client_email_idx on appointments (client_email)
  where client_email is not null;

-- Conta simples do cliente (e-mail + senha) para "Meus agendamentos". NÃO usa
-- o Supabase Auth, para não depender dele (o login com Google, que usa o
-- Auth, convive com esta conta; nenhum dos dois dá acesso ao painel — admin é
-- quem está em `admins`). A senha fica só como hash bcrypt. RLS ligado e sem
-- policy: só as funções security definer (claim_client_account,
-- client_login, reset_client_password) enxergam esta tabela.
create table if not exists client_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) <= 254),
  password_hash text not null,
  failed_attempts smallint not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
alter table client_accounts enable row level security;

-- Agendamento vinculado à conta: só é preenchido quando a senha foi provada
-- na hora de agendar (ver claim_client_account). É por aqui que "Meus
-- agendamentos" lista; o e-mail sozinho nunca dá acesso a nada.
alter table appointments add column if not exists client_account_id uuid
  references client_accounts (id) on delete set null;
create index if not exists appointments_client_account_idx on appointments (client_account_id)
  where client_account_id is not null;

-- Serviços de um agendamento (BL-066 permite mais de um). price/duration_minutes
-- gravam o valor no momento da reserva, para o histórico não mudar se o
-- preço do serviço for reajustado depois.
create table if not exists appointment_services (
  appointment_id uuid not null references appointments (id) on delete cascade,
  service_id text not null references services (id) on delete restrict,
  price text,
  duration_minutes integer,
  primary key (appointment_id, service_id)
);

create table if not exists appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  status text not null check (status in ('pending', 'confirmed', 'completed', 'canceled', 'no_show')),
  changed_by text not null check (changed_by in ('client', 'admin', 'system')),
  changed_at timestamptz not null default now()
);

-- ===================== Módulo financeiro =====================
--
-- BL-098: preço vira numeric em vez de texto livre ("R$ 40", "a combinar")
-- nas três tabelas que o guardam — só assim dá para somar ganho diário/
-- semanal automaticamente. services/professionals/appointments ainda não
-- têm dado real cadastrado (ver nota no final do arquivo), então não há
-- valor de verdade a perder; o "if" só deixa o script seguro para rodar de
-- novo caso alguém já tenha preenchido algo em teste.
do $$
begin
  if (select data_type from information_schema.columns
      where table_name = 'services' and column_name = 'price') = 'text' then
    alter table services
      alter column price type numeric(10,2)
      using nullif(regexp_replace(replace(price, ',', '.'), '[^0-9.]', '', 'g'), '')::numeric(10,2);
  end if;

  if (select data_type from information_schema.columns
      where table_name = 'professional_services' and column_name = 'price') = 'text' then
    alter table professional_services
      alter column price type numeric(10,2)
      using nullif(regexp_replace(replace(price, ',', '.'), '[^0-9.]', '', 'g'), '')::numeric(10,2);
  end if;

  if (select data_type from information_schema.columns
      where table_name = 'appointment_services' and column_name = 'price') = 'text' then
    alter table appointment_services
      alter column price type numeric(10,2)
      using nullif(regexp_replace(replace(price, ',', '.'), '[^0-9.]', '', 'g'), '')::numeric(10,2);
  end if;
end $$;

-- Forma de pagamento do agendamento concluído (BL-098) — preenchida pelo
-- admin ao marcar "Concluído" (ver AppointmentRow). Fica null para
-- agendamentos ainda não concluídos ou concluídos antes dessa coluna existir.
alter table appointments add column if not exists payment_method text;
alter table appointments drop constraint if exists appointments_payment_method_check;
alter table appointments add constraint appointments_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'debit_card', 'credit_card', 'pix'));

-- Percentual de comissão de cada profissional sobre o que ele atende (BL-098)
-- — null até o admin configurar, para não presumir um valor que pode estar
-- errado para a barbearia.
alter table professionals add column if not exists commission_percent numeric(5,2);
alter table professionals drop constraint if exists professionals_commission_percent_check;
alter table professionals add constraint professionals_commission_percent_check
  check (commission_percent is null or (commission_percent >= 0 and commission_percent <= 100));

-- Despesas do negócio (BL-098: aluguel, produtos, contas, manutenção,
-- marketing, comissões pagas, outros) — a outra metade do resumo financeiro,
-- ao lado do ganho calculado a partir de appointments/appointment_services.
create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  category text not null check (category in (
    'rent', 'supplies', 'utilities', 'maintenance', 'marketing', 'commission', 'other'
  )),
  expense_date date not null default current_date,
  -- Despesa fixa (ex.: aluguel) só para o admin saber que se repete todo mês
  -- ao olhar a lista — nenhuma rotina recria a linha automaticamente.
  recurring boolean not null default false,
  created_at timestamptz not null default now()
);

-- ===================== Quem é admin =====================
--
-- "Admin" NÃO é mais "qualquer usuário authenticated": o login social (Google)
-- dos clientes também cria usuários authenticated no Supabase Auth, e eles não
-- podem tocar no painel. Admin é quem está nesta lista. Para promover alguém:
--   insert into admins (user_id) select id from auth.users where email = '...';
-- A tabela tem RLS ligado e nenhuma policy: só is_admin() (security definer)
-- enxerga, ou seja, nem um admin edita a lista pelo site — só pelo SQL Editor.
create table if not exists admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table admins enable row level security;

-- Migração única: na PRIMEIRA vez que este script roda (lista vazia), quem já
-- existe em auth.users é o(s) admin(s) criado(s) à mão no painel — todos entram
-- na lista. Depois disso a lista nunca mais é preenchida sozinha, para um
-- cliente que entrou com Google não virar admin numa nova execução.
insert into admins (user_id)
select id from auth.users
where not exists (select 1 from admins);

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid())
$$;

revoke all on function is_admin() from public;
grant execute on function is_admin() to anon, authenticated;

-- E-mail do usuário logado no Auth, só se estiver confirmado (o Google já
-- confirma). Interna: usada pelas funções de "Meus agendamentos".
create or replace function verified_auth_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(email) from auth.users
  where id = auth.uid() and email_confirmed_at is not null
$$;

revoke all on function verified_auth_email() from public;

-- ===================== Segurança: leitura pública, escrita só logado =====================
--
-- A landing page lê sem estar autenticada (chave anon, pública no bundle).
-- Só quem está na lista `admins` (ver acima) consegue gravar.

alter table site_settings enable row level security;
alter table contact_settings enable row level security;
alter table booking_settings enable row level security;
alter table opening_hours enable row level security;
alter table social_links enable row level security;
alter table services enable row level security;
alter table gallery_images enable row level security;
alter table testimonials enable row level security;
alter table professionals enable row level security;
alter table professional_services enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'site_settings', 'contact_settings', 'booking_settings',
    'opening_hours', 'social_links', 'services', 'gallery_images',
    'testimonials', 'professionals', 'professional_services'
  ])
  loop
    execute format('drop policy if exists "public read" on %I', t);
    execute format('create policy "public read" on %I for select using (true)', t);

    execute format('drop policy if exists "admin write" on %I', t);
    execute format(
      'create policy "admin write" on %I for all using ((select is_admin())) with check ((select is_admin()))',
      t
    );
  end loop;
end $$;

-- ===================== Segurança: só admin (BL-103) =====================
--
-- appointments/appointment_services/appointment_status_history guardam nome
-- e telefone de clientes; professional_hours e schedule_exceptions não têm
-- dado pessoal de cliente, mas schedule_exceptions.reason é texto livre (pode
-- ter motivo de saúde/pessoal de um profissional) e nenhuma tela pública lê
-- as duas direto — o cálculo de disponibilidade usa get_available_slots/
-- get_available_dates, que são security definer e ignoram RLS. expenses
-- (BL-098) entra no mesmo grupo por outro motivo: é dado financeiro do
-- negócio, não há razão para expor isso à leitura anônima. Por isso as seis
-- NÃO entram no loop de "public read" acima: sem essa policy, a leitura
-- anônima fica bloqueada por padrão (RLS nega o que não casa com nenhuma
-- policy). Só o admin autenticado tem acesso total; o cliente sem login só
-- chega ao próprio agendamento pela função get_appointment_by_token abaixo,
-- que roda como security definer e devolve só a linha cujo token combina com
-- o link único que ele recebeu (BL-077).

alter table appointments enable row level security;
alter table appointment_services enable row level security;
alter table appointment_status_history enable row level security;
alter table professional_hours enable row level security;
alter table schedule_exceptions enable row level security;
alter table expenses enable row level security;

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'appointments', 'appointment_services', 'appointment_status_history',
    'professional_hours', 'schedule_exceptions', 'expenses'
  ])
  loop
    -- drop da policy antiga (leitura pública) de quem já rodou a versão anterior deste script
    execute format('drop policy if exists "public read" on %I', t);
    execute format('drop policy if exists "admin write" on %I', t);

    execute format('drop policy if exists "admin full access" on %I', t);
    execute format(
      'create policy "admin full access" on %I for all using ((select is_admin())) with check ((select is_admin()))',
      t
    );
  end loop;
end $$;

drop function if exists get_appointment_by_token(uuid);
create function get_appointment_by_token(token uuid)
returns setof appointments
language sql
security definer
set search_path = public
as $$
  select * from appointments where access_token = token;
$$;

revoke all on function get_appointment_by_token(uuid) from public;
grant execute on function get_appointment_by_token(uuid) to anon, authenticated;

-- ===================== Agendamento: Disponibilidade (BL-059 a BL-063) =====================

-- BL-063: fuso único usado em todo o cálculo de disponibilidade, para
-- converter os horários "de parede" (professional_hours, em `time`) para
-- instantes absolutos (`timestamptz`) sem depender do timezone da sessão.
create or replace function app_timezone()
returns text
language sql
immutable
as $$
  select 'America/Fortaleza'
$$;

-- Janelas de trabalho de cada profissional num dia: uma linha do início do
-- expediente até o almoço (ou até o fim do expediente, sem almoço), e —só
-- quando há almoço— uma segunda linha do fim do almoço até o fim do
-- expediente. weekday na mesma convenção de professional_hours/opening_hours
-- (extract(dow from date) já devolve 0 = domingo … 6 = sábado).
create or replace function professional_work_windows(p_date date)
returns table (professional_id uuid, from_ts timestamptz, to_ts timestamptz)
language sql
stable
as $$
  select p.id,
         (p_date::timestamp + ph.starts_at) at time zone app_timezone(),
         coalesce(
           (p_date::timestamp + ph.break_starts_at) at time zone app_timezone(),
           (p_date::timestamp + ph.ends_at) at time zone app_timezone()
         )
  from professionals p
  join professional_hours ph on ph.professional_id = p.id
  where p.active and ph.weekday = extract(dow from p_date)::smallint

  union all

  select p.id,
         (p_date::timestamp + ph.break_ends_at) at time zone app_timezone(),
         (p_date::timestamp + ph.ends_at) at time zone app_timezone()
  from professionals p
  join professional_hours ph on ph.professional_id = p.id
  where p.active
    and ph.weekday = extract(dow from p_date)::smallint
    and ph.break_starts_at is not null
$$;

-- Duração total e buffer efetivo de um profissional para uma combinação de
-- serviços (BL-066: mais de um serviço por agendamento). duration_minutes
-- sai null (não pode ser agendado) quando o profissional não faz um dos
-- serviços pedidos (BL-051: sem linha em professional_services) ou quando a
-- duração não está cadastrada em nenhum dos dois níveis (BL-095 ainda não
-- torna isso obrigatório). buffer_minutes usa o maior valor entre o buffer
-- de cada serviço e o do profissional (BL-056).
create or replace function service_minutes_for_professional(
  p_professional_id uuid,
  p_service_ids text[]
)
returns table (duration_minutes integer, buffer_minutes integer)
language sql
stable
as $$
  with resolved as (
    select
      coalesce(ps.duration_minutes, s.duration_minutes) as duration,
      coalesce(s.buffer_minutes, 0) as service_buffer
    from services s
    join professional_services ps
      on ps.service_id = s.id and ps.professional_id = p_professional_id
    where s.id = any (p_service_ids)
  )
  select
    case
      when count(*) < coalesce(array_length(p_service_ids, 1), 0) then null
      when count(*) filter (where duration is null) > 0 then null
      else sum(duration)::integer
    end,
    greatest(
      coalesce(max(service_buffer), 0),
      coalesce((select buffer_minutes from professionals where id = p_professional_id), 0)
    )
  from resolved
$$;

-- BL-059: horários livres de um dia, cruzando expediente (professional_hours
-- via professional_work_windows), exceções (BL-053), agendamentos existentes
-- com o buffer entre atendimentos (BL-056) e a antecedência mínima/máxima
-- (BL-062). Sem p_professional_id, devolve os horários de todos os
-- profissionais qualificados — é o que sustenta o "sem preferência de
-- profissional" (BL-061): o cliente escolhe um horário, não um profissional,
-- e create_appointment (abaixo) decide quem atende. Slots a cada 15 minutos.
create or replace function get_available_slots(
  p_service_ids text[],
  p_date date,
  p_professional_id uuid default null
)
returns table (professional_id uuid, starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with settings as (
    select coalesce(min_advance_minutes, 0) as min_advance_minutes,
           coalesce(max_advance_days, 60) as max_advance_days
    from booking_settings
    where id = 1
  ),
  eligible as (
    select w.professional_id, w.from_ts, w.to_ts, m.duration_minutes, m.buffer_minutes
    from professional_work_windows(p_date) w
    cross join lateral service_minutes_for_professional(w.professional_id, p_service_ids) m
    where m.duration_minutes is not null
      and (p_professional_id is null or w.professional_id = p_professional_id)
  ),
  candidates as (
    select e.professional_id, e.buffer_minutes,
           slot as starts_at,
           slot + make_interval(mins => e.duration_minutes) as ends_at
    from eligible e
    cross join lateral generate_series(
      e.from_ts,
      e.to_ts - make_interval(mins => e.duration_minutes),
      interval '15 minutes'
    ) as slot
  )
  select c.professional_id, c.starts_at, c.ends_at
  from candidates c, settings s
  where c.starts_at >= now() + make_interval(mins => s.min_advance_minutes)
    and c.starts_at <= now() + make_interval(days => s.max_advance_days)
    and not exists (
      select 1 from schedule_exceptions se
      where (se.professional_id is null or se.professional_id = c.professional_id)
        and se.starts_at < c.ends_at + make_interval(mins => c.buffer_minutes)
        and se.ends_at > c.starts_at
    )
    and not exists (
      select 1 from appointments a
      where a.professional_id = c.professional_id
        and a.status <> 'canceled'
        and a.starts_at < c.ends_at + make_interval(mins => c.buffer_minutes)
        and a.ends_at + make_interval(mins => c.buffer_minutes) > c.starts_at
    )
  order by c.starts_at, c.professional_id
$$;

revoke all on function get_available_slots(text[], date, uuid) from public;
grant execute on function get_available_slots(text[], date, uuid) to anon, authenticated;

-- BL-068: quais dias, num intervalo, têm pelo menos um horário livre — usado
-- pelo calendário para não deixar o cliente escolher um dia sem vaga.
create or replace function get_available_dates(
  p_service_ids text[],
  p_start_date date,
  p_end_date date,
  p_professional_id uuid default null
)
returns table (available_date date)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d date := p_start_date;
begin
  while d <= p_end_date loop
    if exists (select 1 from get_available_slots(p_service_ids, d, p_professional_id)) then
      available_date := d;
      return next;
    end if;
    d := d + 1;
  end loop;
end;
$$;

revoke all on function get_available_dates(text[], date, date, uuid) from public;
grant execute on function get_available_dates(text[], date, date, uuid) to anon, authenticated;

-- ===================== Conta do cliente (e-mail + senha) =====================

-- Regra de senha NOVA (criar conta, trocar, redefinir pelo admin): de 8 a 72
-- caracteres (72 é o limite do bcrypt), nem um caractere repetido, nem uma
-- senha óbvia. Contas antigas com senha menor continuam entrando normalmente:
-- a regra só vale ao definir uma senha nova.
create or replace function password_is_weak(p_password text)
returns boolean
language sql
immutable
as $$
  select p_password is null
    or length(p_password) not between 8 and 72
    or p_password ~ '^(.)\1*$'
    or lower(p_password) = any (array[
      '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000',
      'password', 'password1', 'senha123', 'senha1234', 'qwertyui', 'qwerty123',
      'abcd1234', 'abc12345', 'iloveyou', 'viniciusqueiroz', 'barbearia'
    ])
$$;

-- Confere a senha de uma conta existente e devolve o id (ou null). Erro conta
-- tentativa; 5 erros seguidos bloqueiam a conta por 15 minutos. Interna: não
-- é exposta para anon/authenticated.
create or replace function verify_client_password(p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_account client_accounts;
begin
  select * into v_account from client_accounts where email = p_email for update;
  if v_account.id is null then
    return null;
  end if;

  if v_account.locked_until is not null and v_account.locked_until > now() then
    return null;
  end if;

  if v_account.password_hash = crypt(p_password, v_account.password_hash) then
    update client_accounts set failed_attempts = 0, locked_until = null where id = v_account.id;
    return v_account.id;
  end if;

  update client_accounts
  set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
  where id = v_account.id;
  return null;
end;
$$;

revoke all on function verify_client_password(text, text) from public;

-- Cria a conta (primeiro agendamento com esse e-mail) ou confere a senha da
-- que já existe. Devolve o id da conta, ou null se a senha não confere / a
-- conta está bloqueada. Interna: só create_appointment chama.
create or replace function claim_client_account(p_email text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  -- Conta nova: a senha precisa passar na regra. Conta existente: só confere.
  if not exists (select 1 from client_accounts where email = p_email)
    and password_is_weak(p_password) then
    raise exception 'weak_password' using errcode = 'P0007';
  end if;

  insert into client_accounts (email, password_hash)
  values (p_email, crypt(p_password, gen_salt('bf', 10)))
  on conflict (email) do nothing
  returning id into v_id;

  if v_id is not null then
    return v_id;
  end if;

  return verify_client_password(p_email, p_password);
end;
$$;

revoke all on function claim_client_account(text, text) from public;

-- Próximos agendamentos (pendentes/confirmados) de uma conta (senha) e/ou de um
-- e-mail verificado (login social), no formato que a tela consome. Interna.
create or replace function list_client_appointments(p_account_id uuid, p_email text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'access_token', a.access_token,
      'starts_at', a.starts_at,
      'status', a.status,
      'professional_name', p.name,
      'services', (
        select coalesce(jsonb_agg(s.name order by s.name), '[]'::jsonb)
        from appointment_services aps
        join services s on s.id = aps.service_id
        where aps.appointment_id = a.id
      )
    ) order by a.starts_at
  ), '[]'::jsonb)
  from appointments a
  join professionals p on p.id = a.professional_id
  where a.status in ('pending', 'confirmed')
    and a.ends_at > now()
    and (
      (p_account_id is not null and a.client_account_id = p_account_id)
      or (p_email is not null and a.client_email = p_email)
    )
$$;

revoke all on function list_client_appointments(uuid, text) from public;

-- Login de "Meus agendamentos". Devolve jsonb (nunca levanta erro, para a
-- contagem de tentativas valer):
--   {"ok": false}                                       e-mail ou senha incorretos
--   {"ok": false, "locked": true, "retry_after_seconds": n}   conta bloqueada
--   {"ok": true, "appointments": [...]}                 próximos agendamentos da conta
create or replace function client_login(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_locked_until timestamptz;
  v_account_id uuid;
  v_appointments jsonb;
begin
  select locked_until into v_locked_until from client_accounts where email = v_email;
  if v_locked_until is not null and v_locked_until > now() then
    return jsonb_build_object(
      'ok', false,
      'locked', true,
      'retry_after_seconds', ceil(extract(epoch from (v_locked_until - now())))::integer
    );
  end if;

  v_account_id := verify_client_password(v_email, coalesce(p_password, ''));
  if v_account_id is null then
    return jsonb_build_object('ok', false);
  end if;

  v_appointments := list_client_appointments(v_account_id, null);

  return jsonb_build_object('ok', true, 'appointments', v_appointments);
end;
$$;

revoke all on function client_login(text, text) from public;
grant execute on function client_login(text, text) to anon, authenticated;

-- "Meus agendamentos" para quem entrou com Google (sessão do Supabase Auth):
-- lista pelo e-mail CONFIRMADO do usuário. Como o e-mail é provado pelo
-- provedor, não precisa de senha. Mesmo formato de client_login.
create or replace function my_appointments()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := verified_auth_email();
begin
  if v_email is null then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object('ok', true, 'appointments', list_client_appointments(null, v_email));
end;
$$;

revoke all on function my_appointments() from public, anon;
grant execute on function my_appointments() to authenticated;

-- O e-mail já tem conta? O formulário de agendamento usa isto para só pedir a
-- senha de quem ainda NÃO tem conta (que a cria). Revela se um e-mail está
-- cadastrado, como check_client_credentials já faz.
create or replace function client_account_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from client_accounts where email = lower(trim(coalesce(p_email, '')))
  )
$$;

revoke all on function client_account_exists(text) from public;
grant execute on function client_account_exists(text) to anon, authenticated;

-- Confere e-mail + senha ANTES de agendar, para o formulário avisar na hora
-- (em vez de o agendamento sair sem vínculo com a conta). Devolve jsonb, nunca
-- levanta erro (a contagem de tentativas erradas precisa persistir):
--   {"status": "new"}      e-mail sem conta: o agendamento vai criar a conta
--   {"status": "weak"}     e-mail sem conta, mas a senha não passa na regra de senha nova
--   {"status": "valid"}    conta existe e a senha confere
--   {"status": "invalid"}  conta existe e a senha NÃO confere (conta tentativa)
--   {"status": "locked", "retry_after_seconds": n}   conta bloqueada
-- Revela se um e-mail tem conta; é o que o formulário precisa mostrar. O
-- bloqueio de 5 erros/15 min limita o chute de senhas.
create or replace function check_client_credentials(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_account client_accounts;
begin
  select * into v_account from client_accounts where email = v_email;
  if v_account.id is null then
    -- Conta nova: já avisa se a senha não passa na regra, antes de agendar.
    if password_is_weak(p_password) then
      return jsonb_build_object('status', 'weak');
    end if;
    return jsonb_build_object('status', 'new');
  end if;

  if v_account.locked_until is not null and v_account.locked_until > now() then
    return jsonb_build_object(
      'status', 'locked',
      'retry_after_seconds', ceil(extract(epoch from (v_account.locked_until - now())))::integer
    );
  end if;

  if verify_client_password(v_email, coalesce(p_password, '')) is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  return jsonb_build_object('status', 'valid');
end;
$$;

revoke all on function check_client_credentials(text, text) from public;
grant execute on function check_client_credentials(text, text) to anon, authenticated;

-- Troca de senha de quem JÁ está com a conta: exige a senha atual a cada
-- chamada (não confia em sessão do navegador), conta tentativas erradas e
-- bloqueia como o login (5 erros = 15 minutos). Devolve jsonb, nunca levanta
-- erro (para a contagem persistir):
--   {"status": "ok"}       senha trocada
--   {"status": "invalid"}  e-mail sem conta ou senha atual errada (mesma resposta)
--   {"status": "locked", "retry_after_seconds": n}
--   {"status": "weak"}     a senha nova não passa na regra (password_is_weak)
--   {"status": "same"}     a senha nova é igual à atual
-- Quem entra de novo depois da troca usa a senha nova; as listas guardadas no
-- navegador (sessionStorage) são apagadas pela tela.
create or replace function change_client_password(p_email text, p_current_password text, p_new_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_locked_until timestamptz;
  v_account_id uuid;
begin
  select locked_until into v_locked_until from client_accounts where email = v_email;
  if v_locked_until is not null and v_locked_until > now() then
    return jsonb_build_object(
      'status', 'locked',
      'retry_after_seconds', ceil(extract(epoch from (v_locked_until - now())))::integer
    );
  end if;

  v_account_id := verify_client_password(v_email, coalesce(p_current_password, ''));
  if v_account_id is null then
    return jsonb_build_object('status', 'invalid');
  end if;

  if p_new_password = p_current_password then
    return jsonb_build_object('status', 'same');
  end if;

  if password_is_weak(p_new_password) or lower(p_new_password) = v_email then
    return jsonb_build_object('status', 'weak');
  end if;

  update client_accounts
  set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
      failed_attempts = 0,
      locked_until = null
  where id = v_account_id;

  return jsonb_build_object('status', 'ok');
end;
$$;

revoke all on function change_client_password(text, text, text) from public;
grant execute on function change_client_password(text, text, text) to anon, authenticated;

-- Esqueci a senha: não há envio de e-mail, então o admin define uma senha
-- nova pelo painel e passa para o cliente (por WhatsApp, por exemplo). Só o
-- admin autenticado executa. Devolve quantas contas foram alteradas (0 ou 1).
create or replace function reset_client_password(p_email text, p_new_password text)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if password_is_weak(p_new_password) then
    raise exception 'weak_password' using errcode = 'P0007';
  end if;

  update client_accounts
  set password_hash = crypt(p_new_password, gen_salt('bf', 10)),
      failed_attempts = 0,
      locked_until = null
  where email = lower(trim(p_email));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function reset_client_password(text, text) from public, anon;
grant execute on function reset_client_password(text, text) to authenticated;

-- Limpeza da versão anterior (código de uso único por e-mail, descontinuada).
drop function if exists request_appointments_code(text);
drop function if exists verify_appointments_code(text, text);
drop table if exists appointment_access_codes;
drop table if exists email_settings;

-- BL-073: grava o agendamento revalidando a disponibilidade na hora do
-- INSERT (não confia na lista de horários que o cliente pode ter carregado
-- há alguns segundos). Quando p_professional_id é nulo (sem preferência,
-- BL-061), pega o primeiro profissional qualificado livre exatamente
-- naquele horário. Mesmo passando por aqui, a constraint de exclusão
-- (BL-060) ainda é quem garante a corrida entre dois clientes: se perder
-- essa corrida, o INSERT falha com "exclusion_violation" (23P01) — a
-- aplicação trata isso como "esse horário acabou de ser ocupado".
drop function if exists create_appointment(text, text, text[], timestamptz, uuid);
drop function if exists create_appointment(text, text, text[], timestamptz, uuid, text);
create or replace function create_appointment(
  p_client_name text,
  p_client_phone text,
  p_service_ids text[],
  p_starts_at timestamptz,
  p_professional_id uuid default null,
  p_client_email text default null,
  p_client_password text default null
)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_professional_id uuid;
  v_ends_at timestamptz;
  v_appointment appointments;
  v_service_id text;
  v_price numeric(10,2);
  v_duration integer;
  v_email text := nullif(lower(trim(coalesce(p_client_email, ''))), '');
  v_account_id uuid;
begin
  -- Sem limite de agendamentos por telefone: o cliente pode marcar quantos
  -- horários quiser. O anti-spam que sobra é o campo isca do formulário (BL-104).

  select gas.professional_id, gas.ends_at
  into v_professional_id, v_ends_at
  from get_available_slots(p_service_ids, p_starts_at::date, p_professional_id) gas
  join professionals p on p.id = gas.professional_id
  where gas.starts_at = p_starts_at
  order by p.sort_order, p.id
  limit 1;

  if v_professional_id is null then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  -- Com e-mail, a senha é obrigatória: cria a conta (primeiro agendamento) ou
  -- confere a senha da conta existente. Senha errada ou conta bloqueada NÃO
  -- barra o agendamento — ele só não é vinculado à conta (client_account_id
  -- fica null) e a tela avisa. Não pode ser uma exceção: ela desfaria a
  -- contagem de tentativas erradas.
  -- Quem está logado com Google e agenda com o PRÓPRIO e-mail confirmado não
  -- precisa de senha: o e-mail já foi provado (my_appointments lista por ele).
  if v_email is not null and v_email is distinct from verified_auth_email() then
    if p_client_password is null or length(p_client_password) = 0 then
      -- Sem senha: só vale para e-mail que JÁ tem conta (o agendamento entra na lista dela).
      -- Quem digita o e-mail de outra pessoa só consegue acrescentar um agendamento à lista
      -- dela, sem ver nada; criar conta nova continua exigindo senha.
      select id into v_account_id from client_accounts where email = v_email;
      if v_account_id is null then
        raise exception 'weak_password' using errcode = 'P0007';
      end if;
    else
      if length(p_client_password) > 72 then
        raise exception 'weak_password' using errcode = 'P0007';
      end if;
      v_account_id := claim_client_account(v_email, p_client_password);
    end if;
  end if;

  insert into appointments (
    client_name, client_phone, client_email, client_account_id,
    professional_id, starts_at, ends_at, source
  )
  values (
    p_client_name, p_client_phone, v_email, v_account_id,
    v_professional_id, p_starts_at, v_ends_at, 'site'
  )
  returning * into v_appointment;

  foreach v_service_id in array p_service_ids loop
    select coalesce(ps.price, s.price), coalesce(ps.duration_minutes, s.duration_minutes)
    into v_price, v_duration
    from services s
    left join professional_services ps
      on ps.service_id = s.id and ps.professional_id = v_professional_id
    where s.id = v_service_id;

    insert into appointment_services (appointment_id, service_id, price, duration_minutes)
    values (v_appointment.id, v_service_id, v_price, v_duration);
  end loop;

  insert into appointment_status_history (appointment_id, status, changed_by)
  values (v_appointment.id, 'pending', 'client');

  return v_appointment;
end;
$$;

revoke all on function create_appointment(text, text, text[], timestamptz, uuid, text, text) from public;
grant execute on function create_appointment(text, text, text[], timestamptz, uuid, text, text) to anon, authenticated;

-- BL-079: cancela pelo link único, sem login. Erros: not_found (P0002, token
-- inválido) e too_late (P0003, dentro do prazo mínimo configurado em
-- booking_settings.min_cancel_notice_minutes — BL-097).
create or replace function cancel_appointment(p_token uuid)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment appointments;
  v_min_notice interval;
begin
  select * into v_appointment from appointments where access_token = p_token;
  if v_appointment.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_appointment.status = 'canceled' then
    return v_appointment;
  end if;

  select make_interval(mins => coalesce(min_cancel_notice_minutes, 0)) into v_min_notice
  from booking_settings where id = 1;

  if v_appointment.starts_at < now() + v_min_notice then
    raise exception 'too_late' using errcode = 'P0003';
  end if;

  update appointments set status = 'canceled' where id = v_appointment.id
  returning * into v_appointment;

  insert into appointment_status_history (appointment_id, status, changed_by)
  values (v_appointment.id, 'canceled', 'client');

  perform enqueue_telegram_notification(v_appointment.id, 'canceled');

  return v_appointment;
end;
$$;

revoke all on function cancel_appointment(uuid) from public;
grant execute on function cancel_appointment(uuid) to anon, authenticated;

-- BL-078: troca só data/horário pelo link único, mantendo o mesmo
-- profissional e os mesmos serviços — reusa get_available_slots (BL-059)
-- filtrado nesse profissional para revalidar o novo horário (mesma lógica de
-- BL-073). Mesmos erros de cancel_appointment, mais slot_unavailable
-- (P0001, o novo horário não está livre para esse profissional).
create or replace function reschedule_appointment(p_token uuid, p_starts_at timestamptz)
returns appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_appointment appointments;
  v_service_ids text[];
  v_new_professional_id uuid;
  v_new_ends_at timestamptz;
  v_min_notice interval;
  v_previous_starts_at timestamptz;
begin
  select * into v_appointment from appointments where access_token = p_token;
  if v_appointment.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if v_appointment.status = 'canceled' then
    raise exception 'already_canceled' using errcode = 'P0004';
  end if;

  select make_interval(mins => coalesce(min_cancel_notice_minutes, 0)) into v_min_notice
  from booking_settings where id = 1;

  if v_appointment.starts_at < now() + v_min_notice then
    raise exception 'too_late' using errcode = 'P0003';
  end if;

  select array_agg(service_id) into v_service_ids
  from appointment_services where appointment_id = v_appointment.id;

  select gas.professional_id, gas.ends_at
  into v_new_professional_id, v_new_ends_at
  from get_available_slots(v_service_ids, p_starts_at::date, v_appointment.professional_id) gas
  where gas.starts_at = p_starts_at
  limit 1;

  if v_new_professional_id is null then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  v_previous_starts_at := v_appointment.starts_at;

  update appointments
  set starts_at = p_starts_at, ends_at = v_new_ends_at
  where id = v_appointment.id
  returning * into v_appointment;

  insert into appointment_status_history (appointment_id, status, changed_by)
  values (v_appointment.id, v_appointment.status, 'client');

  perform enqueue_telegram_notification(v_appointment.id, 'rescheduled', v_previous_starts_at);

  return v_appointment;
end;
$$;

revoke all on function reschedule_appointment(uuid, timestamptz) from public;
grant execute on function reschedule_appointment(uuid, timestamptz) to anon, authenticated;

-- ===================== Agendamento pelo admin (transacional) =====================
--
-- Criar e mover agendamento no painel eram várias chamadas separadas do
-- supabase-js (agendamento, depois serviços), cada uma numa transação própria:
-- se a segunda falhava, sobrava agendamento sem serviço, e a notificação push
-- (seção abaixo) podia sair antes dos serviços existirem. Agora cada operação
-- é uma função só. Preço e duração seguem a mesma regra do cliente
-- (professional_services sobrepõe services). Só o admin executa.

create or replace function admin_service_lines(p_professional_id uuid, p_service_ids text[])
returns table (service_id text, price numeric(10,2), duration_minutes integer)
language sql
stable
as $$
  select s.id,
         coalesce(ps.price, s.price),
         coalesce(ps.duration_minutes, s.duration_minutes)
  from services s
  left join professional_services ps
    on ps.service_id = s.id and ps.professional_id = p_professional_id
  where s.id = any (p_service_ids)
$$;

revoke all on function admin_service_lines(uuid, text[]) from public, anon, authenticated;

create or replace function admin_create_appointment(
  p_client_name text,
  p_client_phone text,
  p_professional_id uuid,
  p_service_ids text[],
  p_starts_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_found integer;
  v_with_duration integer;
  v_minutes integer;
  v_appointment_id uuid;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception 'no_services' using errcode = 'P0006';
  end if;

  select count(*), count(duration_minutes), coalesce(sum(duration_minutes), 0)
  into v_found, v_with_duration, v_minutes
  from admin_service_lines(p_professional_id, p_service_ids);

  if v_found <> (select count(distinct s) from unnest(p_service_ids) as s)
    or v_with_duration <> v_found then
    raise exception 'invalid_services' using errcode = 'P0008';
  end if;

  insert into appointments (client_name, client_phone, professional_id, starts_at, ends_at, status, source)
  values (
    p_client_name, p_client_phone, p_professional_id, p_starts_at,
    p_starts_at + make_interval(mins => v_minutes), 'confirmed', 'admin'
  )
  returning id into v_appointment_id;

  insert into appointment_services (appointment_id, service_id, price, duration_minutes)
  select v_appointment_id, service_id, price, duration_minutes
  from admin_service_lines(p_professional_id, p_service_ids);

  insert into appointment_status_history (appointment_id, status, changed_by)
  values (v_appointment_id, 'confirmed', 'admin');

  return v_appointment_id;
end;
$$;

revoke all on function admin_create_appointment(text, text, uuid, text[], timestamptz) from public, anon;
grant execute on function admin_create_appointment(text, text, uuid, text[], timestamptz) to authenticated;

create or replace function admin_move_appointment(
  p_appointment_id uuid,
  p_professional_id uuid,
  p_starts_at timestamptz,
  p_service_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current appointments;
  v_found integer;
  v_with_duration integer;
  v_minutes integer;
  v_ends_at timestamptz;
  v_services_changed boolean;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_current from appointments where id = p_appointment_id for update;
  if v_current.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception 'no_services' using errcode = 'P0006';
  end if;

  select count(*), count(duration_minutes), coalesce(sum(duration_minutes), 0)
  into v_found, v_with_duration, v_minutes
  from admin_service_lines(p_professional_id, p_service_ids);

  if v_found <> (select count(distinct s) from unnest(p_service_ids) as s)
    or v_with_duration <> v_found then
    raise exception 'invalid_services' using errcode = 'P0008';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => v_minutes);

  v_services_changed := (
    select array_agg(distinct service_id order by service_id)
    from appointment_services where appointment_id = p_appointment_id
  ) is distinct from (
    select array_agg(distinct s order by s) from unnest(p_service_ids) as s
  );

  update appointments
  set professional_id = p_professional_id, starts_at = p_starts_at, ends_at = v_ends_at
  where id = p_appointment_id;

  delete from appointment_services where appointment_id = p_appointment_id;

  insert into appointment_services (appointment_id, service_id, price, duration_minutes)
  select p_appointment_id, service_id, price, duration_minutes
  from admin_service_lines(p_professional_id, p_service_ids);

  -- Horário, profissional ou duração mudou: o trigger de appointments (seção
  -- Web Push) já enfileira "updated" no COMMIT. Só troca de serviço deixa a
  -- linha de appointments igual, então avisa aqui — sem duplicar o caso acima.
  if v_services_changed
    and v_current.status <> 'canceled'
    and v_current.starts_at = p_starts_at
    and v_current.ends_at = v_ends_at
    and v_current.professional_id = p_professional_id then
    perform enqueue_push_notification(p_appointment_id, 'updated');
  end if;
end;
$$;

revoke all on function admin_move_appointment(uuid, uuid, timestamptz, text[]) from public, anon;
grant execute on function admin_move_appointment(uuid, uuid, timestamptz, text[]) to authenticated;

-- ===================== Configuração das notificações =====================
--
-- Linha única com a configuração das notificações (hoje só as colunas do
-- Telegram, adicionadas na seção seguinte). Guarda um segredo, então não
-- entra no grupo de "public read" (mesmo motivo de appointments/expenses, ver
-- comentário mais acima).

create table if not exists notification_settings (
  id smallint primary key default 1 check (id = 1)
);

insert into notification_settings (id) values (1)
on conflict (id) do nothing;

-- Limpeza da antiga notificação por WhatsApp (Green API / CallMeBot), removida.
drop trigger if exists appointments_notify_new on appointments;
drop function if exists notify_new_appointment();
alter table notification_settings
  drop column if exists callmebot_apikey,
  drop column if exists whatsapp_phone,
  drop column if exists green_api_url,
  drop column if exists green_api_id_instance,
  drop column if exists green_api_token_instance,
  drop column if exists enabled;

alter table notification_settings enable row level security;

drop policy if exists "admin full access" on notification_settings;
create policy "admin full access" on notification_settings
  for all using ((select is_admin())) with check ((select is_admin()));

drop function if exists url_encode(text);

-- ===================== Notificações por Telegram =====================
--
-- Avisa o dono pelo Telegram quando um cliente, PELO SITE: agenda (source =
-- 'site'; agendamentos criados no admin não notificam), cancela ou altera o
-- horário (cancel_appointment / reschedule_appointment, que são os únicos
-- caminhos do cliente). O token do bot NÃO fica no banco nem no front-end:
-- vive como secret da Edge Function supabase/functions/telegram-notify
-- (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID). O banco só sabe a URL da função e
-- um segredo compartilhado (notification_settings.telegram_function_url /
-- telegram_function_secret, legíveis só pelo admin), que impede qualquer
-- pessoa de chamá-la.
--
-- Fluxo: a operação grava no banco → enqueue_telegram_notification insere uma
-- linha em telegram_notifications e chama a função via pg_net. O pg_net só
-- envia o POST depois do COMMIT, então agendamento inválido ou que falhou ao
-- gravar (rollback) nunca notifica. Para "criado", o trigger é DEFERRED para
-- rodar no commit, quando appointment_services já existe.
--
-- Reenvio: se o Telegram falhar, a linha fica 'pending' e o pg_cron
-- (retry_pending_telegram_notifications, a cada minuto) tenta de novo, no
-- máximo 5 tentativas no total, depois marca 'failed'. É entrega "pelo menos
-- uma vez": se o Telegram aceitar a mensagem mas a resposta se perder, o
-- reenvio pode duplicar o aviso. O agendamento nunca é afetado.

alter table notification_settings add column if not exists telegram_function_url text;
alter table notification_settings add column if not exists telegram_function_secret text;

create table if not exists telegram_notifications (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  kind text not null check (kind in ('created', 'canceled', 'rescheduled')),
  -- Horário anterior, só para kind = 'rescheduled'.
  previous_starts_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- No máximo um aviso de "criado" por agendamento.
create unique index if not exists telegram_notifications_created_once
  on telegram_notifications (appointment_id) where kind = 'created';

-- Só o admin lê (last_error é diagnóstico); a Edge Function usa a service role
-- e as funções abaixo são security definer.
alter table telegram_notifications enable row level security;

drop policy if exists "admin read" on telegram_notifications;
create policy "admin read" on telegram_notifications
  for select using ((select is_admin()));

create or replace function dispatch_telegram_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings notification_settings;
begin
  select * into v_settings from notification_settings where id = 1;

  if v_settings.telegram_function_url is null or v_settings.telegram_function_secret is null then
    return;
  end if;

  -- Falha ao agendar o POST nunca derruba a operação do cliente; o cron tenta de novo.
  begin
    perform net.http_post(
      url := v_settings.telegram_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_settings.telegram_function_secret
      ),
      body := jsonb_build_object('notification_id', p_notification_id),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'telegram: falha ao disparar a notificação %', p_notification_id;
  end;
end;
$$;

revoke all on function dispatch_telegram_notification(uuid) from public, anon, authenticated;

create or replace function enqueue_telegram_notification(
  p_appointment_id uuid,
  p_kind text,
  p_previous_starts_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from notification_settings
    where id = 1
      and telegram_function_url is not null
      and telegram_function_secret is not null
  ) then
    return;
  end if;

  insert into telegram_notifications (appointment_id, kind, previous_starts_at, attempts, last_attempt_at)
  values (p_appointment_id, p_kind, p_previous_starts_at, 1, now())
  on conflict do nothing
  returning id into v_id;

  if v_id is not null then
    perform dispatch_telegram_notification(v_id);
  end if;
end;
$$;

revoke all on function enqueue_telegram_notification(uuid, text, timestamptz) from public, anon, authenticated;

create or replace function queue_telegram_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.source = 'site' then
    perform enqueue_telegram_notification(new.id, 'created');
  end if;
  return null;
end;
$$;

revoke all on function queue_telegram_notification() from public, anon, authenticated;

drop trigger if exists appointments_notify_telegram on appointments;
create constraint trigger appointments_notify_telegram
  after insert on appointments
  deferrable initially deferred
  for each row
  execute function queue_telegram_notification();

create or replace function retry_pending_telegram_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_count integer := 0;
begin
  -- Esgotou as tentativas (e a última já teve 2 min para responder).
  update telegram_notifications
  set status = 'failed'
  where status = 'pending'
    and attempts >= 5
    and coalesce(last_attempt_at, created_at) < now() - interval '2 minutes';

  for v_id in
    update telegram_notifications
    set attempts = attempts + 1, last_attempt_at = now()
    where status = 'pending'
      and attempts < 5
      and coalesce(last_attempt_at, created_at) < now() - interval '2 minutes'
    returning id
  loop
    perform dispatch_telegram_notification(v_id);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function retry_pending_telegram_notifications() from public, anon, authenticated;

-- Agenda o reenvio a cada minuto. pg_cron precisa estar habilitado no projeto
-- (Database → Extensions); sem ele o aviso inicial funciona, só não há reenvio.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'telegram-notify-retry';
  perform cron.schedule(
    'telegram-notify-retry', '* * * * *', 'select public.retry_pending_telegram_notifications()'
  );
exception when others then
  raise notice 'pg_cron indisponível (%): habilite em Database → Extensions para ter reenvio', sqlerrm;
end $$;

-- ===================== Notificações push para o admin (Web Push) =====================
--
-- Avisa os administradores no celular/navegador quando um agendamento é criado,
-- cancelado ou alterado (horário, profissional, duração ou serviços). Diferente
-- do Telegram (só ações do cliente pelo site), o gatilho aqui é a própria tabela
-- appointments: vale para qualquer origem (site, painel, link do cliente).
--
-- Fluxo igual ao do Telegram: a operação grava → o trigger (deferred, roda no
-- COMMIT, com os serviços já gravados) enfileira em push_notifications →
-- pg_net chama a Edge Function web-push-notify depois do COMMIT. Operação
-- revertida nunca notifica. As chaves VAPID ficam só nos secrets da função; o
-- banco guarda apenas a URL e o segredo do webhook. Sem reenvio automático: push
-- é melhor esforço (ver README, "Notificações push").
--
-- Privacidade: assinaturas (endpoint e chaves) só o próprio admin lê. A fila
-- guarda só o id do agendamento e o tipo do evento, nunca nome ou telefone.

alter table notification_settings add column if not exists push_function_url text;
alter table notification_settings add column if not exists push_function_secret text;
-- Chave PÚBLICA VAPID (não é segredo: o navegador precisa dela para assinar).
-- Fica aqui, e não no build, para trocar a chave sem redeploy do site. Lida pelo
-- navegador com get_push_public_key(), que é a única leitura pública desta linha.
alter table notification_settings add column if not exists push_public_key text;

create or replace function get_push_public_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select push_public_key from notification_settings where id = 1
$$;

revoke all on function get_push_public_key() from public;
grant execute on function get_push_public_key() to anon, authenticated;

-- Um registro por aparelho de admin (um admin pode ter vários celulares/navegadores).
-- active = false quando o serviço de push diz que a assinatura expirou (404/410):
-- ela para de receber envios, mas fica registrada com o motivo em last_error.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (
    length(endpoint) between 8 and 2048 and endpoint like 'https://%'
  ),
  p256dh text not null check (length(p256dh) between 80 and 100 and p256dh ~ '^[A-Za-z0-9_-]+$'),
  auth_secret text not null check (length(auth_secret) between 20 and 30 and auth_secret ~ '^[A-Za-z0-9_-]+$'),
  user_agent text check (user_agent is null or length(user_agent) <= 300),
  active boolean not null default true,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on push_subscriptions (user_id) where active;

alter table push_subscriptions enable row level security;

drop policy if exists "admin reads own subscriptions" on push_subscriptions;
create policy "admin reads own subscriptions" on push_subscriptions
  for select using ((select is_admin()) and user_id = (select auth.uid()));
-- Sem policy de insert/update/delete: só as funções abaixo (security definer) gravam.

-- Fila de envio: um registro por evento. created/canceled são únicos por
-- agendamento (o trigger já só dispara na transição, e isto garante que um
-- evento não gera duplicidade mesmo se algo for reenfileirado).
create table if not exists push_notifications (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  kind text not null check (kind in ('created', 'canceled', 'updated')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  devices integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index if not exists push_notifications_once
  on push_notifications (appointment_id, kind) where kind in ('created', 'canceled');

alter table push_notifications enable row level security;

drop policy if exists "admin read" on push_notifications;
create policy "admin read" on push_notifications
  for select using ((select is_admin()));

-- Registra (ou reativa) o aparelho do admin logado. Chamada pelo navegador com o
-- JWT do admin: não usa cookie, então não há superfície de CSRF. Qualquer outro
-- usuário (inclusive anon) recebe 42501. Limite de 10 aparelhos ativos por admin.
create or replace function register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth_secret text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if (
    select count(*) from push_subscriptions
    where user_id = auth.uid() and active and endpoint <> p_endpoint
  ) >= 10 then
    raise exception 'too_many_devices' using errcode = 'P0005';
  end if;

  insert into push_subscriptions (user_id, endpoint, p256dh, auth_secret, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth_secret, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth_secret = excluded.auth_secret,
        user_agent = excluded.user_agent,
        active = true,
        last_error = null
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function register_push_subscription(text, text, text, text) from public, anon;
grant execute on function register_push_subscription(text, text, text, text) to authenticated;

-- Remove o aparelho do admin logado (botão "Desativar"). Só afeta a linha do
-- próprio usuário; devolve false se não havia assinatura.
create or replace function unregister_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from push_subscriptions
  where endpoint = p_endpoint and user_id = auth.uid();

  return found;
end;
$$;

revoke all on function unregister_push_subscription(text) from public, anon;
grant execute on function unregister_push_subscription(text) to authenticated;

create or replace function dispatch_push_notification(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings notification_settings;
begin
  select * into v_settings from notification_settings where id = 1;

  if v_settings.push_function_url is null or v_settings.push_function_secret is null then
    return;
  end if;

  -- Falha ao agendar o POST nunca derruba a operação do cliente/admin; a linha
  -- fica "failed" para o admin ver, e não há reenvio automático.
  begin
    perform net.http_post(
      url := v_settings.push_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_settings.push_function_secret
      ),
      body := jsonb_build_object('notification_id', p_notification_id),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise warning 'web push: falha ao disparar a notificação %', p_notification_id;
    update push_notifications
    set status = 'failed', last_error = 'falha ao disparar a função de push'
    where id = p_notification_id;
  end;
end;
$$;

revoke all on function dispatch_push_notification(uuid) from public, anon, authenticated;

create or replace function enqueue_push_notification(p_appointment_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  -- Sem webhook configurado, ou sem nenhum aparelho ativo, não há o que enviar.
  if not exists (
    select 1 from notification_settings
    where id = 1
      and push_function_url is not null
      and push_function_secret is not null
  ) or not exists (select 1 from push_subscriptions where active) then
    return;
  end if;

  insert into push_notifications (appointment_id, kind)
  values (p_appointment_id, p_kind)
  on conflict do nothing
  returning id into v_id;

  if v_id is not null then
    perform dispatch_push_notification(v_id);
  end if;
end;
$$;

revoke all on function enqueue_push_notification(uuid, text) from public, anon, authenticated;

create or replace function queue_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'canceled' then
      perform enqueue_push_notification(new.id, 'created');
    end if;
  elsif new.status = 'canceled' then
    if old.status <> 'canceled' then
      perform enqueue_push_notification(new.id, 'canceled');
    end if;
  elsif new.starts_at is distinct from old.starts_at
    or new.ends_at is distinct from old.ends_at
    or new.professional_id is distinct from old.professional_id then
    perform enqueue_push_notification(new.id, 'updated');
  end if;
  return null;
end;
$$;

revoke all on function queue_push_notification() from public, anon, authenticated;

-- Deferred: dispara no COMMIT. Um UPDATE que não muda horário, profissional
-- ou status (ex.: marcar "concluído", forma de pagamento) não enfileira nada.
drop trigger if exists appointments_notify_push on appointments;
create constraint trigger appointments_notify_push
  after insert or update on appointments
  deferrable initially deferred
  for each row
  execute function queue_push_notification();

-- BL-105: retenção de dados (LGPD). Não deleta a linha (perderia a métrica de
-- quantos agendamentos existiram) — troca nome/telefone por um valor neutro,
-- então o histórico de horários continua útil, mas sem dado pessoal. Prazo
-- proposto de 24 meses após o atendimento: é uma decisão da barbearia (com
-- orientação jurídica, se possível), não travada em código — quem chama esta
-- função escolhe o prazo real. Sem pg_cron configurado, não roda sozinha:
-- o admin aciona pelo painel (ou agenda externamente quem tiver acesso ao
-- projeto Supabase).
create or replace function anonymize_old_appointments(p_older_than interval default interval '24 months')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update appointments
  set client_name = 'Cliente removido', client_phone = '00000000000',
      client_email = null, client_account_id = null
  where starts_at < now() - p_older_than
    and client_name <> 'Cliente removido';
  get diagnostics v_count = row_count;

  delete from client_accounts a
  where not exists (select 1 from appointments where client_account_id = a.id);

  return v_count;
end;
$$;

revoke all on function anonymize_old_appointments(interval) from public;
grant execute on function anonymize_old_appointments(interval) to authenticated;

-- BL-105: exclusão sob pedido. O admin aciona manualmente para um telefone
-- específico quando um cliente pede a remoção dos próprios dados.
create or replace function erase_client_data(p_client_phone text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update appointments
  set client_name = 'Cliente removido', client_phone = '00000000000',
      client_email = null, client_account_id = null
  where client_phone = p_client_phone
    and client_name <> 'Cliente removido';
  get diagnostics v_count = row_count;

  delete from client_accounts a
  where not exists (select 1 from appointments where client_account_id = a.id);

  return v_count;
end;
$$;

revoke all on function erase_client_data(text) from public;
grant execute on function erase_client_data(text) to authenticated;

-- BL-080: o painel do admin (Agenda) escuta esta tabela via Supabase Realtime
-- para mostrar novos agendamentos/cancelamentos sem precisar recarregar a
-- página (useAppointmentsRealtime, em src/queries/adminAppointments.ts —
-- só assina "appointments", por isso é a única tabela aqui). RLS ainda vale
-- para quem recebe o evento: só o admin autenticado (BL-103). O aviso por
-- WhatsApp para a barbearia (a outra parte do BL-080) depende de escolher um
-- provedor de WhatsApp Business API — ainda não decidido, ver BL-075/BL-076.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'appointments'
  ) then
    alter publication supabase_realtime add table appointments;
  end if;
end $$;

-- Bucket "gallery": crie pelo painel (Storage -> New bucket -> "gallery",
-- marcado como Public) antes desta parte. As políticas abaixo valem só para
-- esse bucket especificamente.

drop policy if exists "public read gallery" on storage.objects;
create policy "public read gallery" on storage.objects
  for select using (bucket_id = 'gallery');

drop policy if exists "admin write gallery" on storage.objects;
create policy "admin write gallery" on storage.objects
  for all using (bucket_id = 'gallery' and (select is_admin()))
  with check (bucket_id = 'gallery' and (select is_admin()));

-- ===================== Dados iniciais (template: preencher pelo /admin) =====================
--
-- Os mesmos valores que já estão em src/data hoje (nada inventado). O que
-- ainda não foi confirmado com a barbearia continua null, como no código.

insert into site_settings (id, name, tagline, description, url, locale) values
  (1, 'Vinicius Queiroz Barber', null, null, null, 'pt-BR')
on conflict (id) do nothing;

insert into contact_settings
  (id, whatsapp, phone, email, street, neighborhood, city, state, postal_code, country, maps_url)
values
  (1, null, null, null, null, null, 'A definir', 'A definir', null, 'BR', null)
on conflict (id) do nothing;

insert into booking_settings (id, provider, external_url, whatsapp_message) values
  (1, 'external', null,
   'Olá! Gostaria de agendar um horário na Vinicius Queiroz Barber.')
on conflict (id) do nothing;

insert into gallery_images (id, alt, category, aspect, src, sort_order) values
  ('ambiente-1', 'Ambiente da barbearia', 'ambiente', 'landscape', null, 0),
  ('corte-1', 'Corte de cabelo', 'corte', 'portrait', null, 1),
  ('barba-1', 'Barba feita na barbearia', 'barba', 'square', null, 2),
  ('detalhe-1', 'Detalhe da barbearia', 'detalhe', 'square', null, 3),
  ('corte-2', 'Corte de cabelo', 'corte', 'square', null, 4),
  ('ambiente-2', 'Ambiente da barbearia', 'ambiente', 'landscape', null, 5),
  ('barba-2', 'Barba feita na barbearia', 'barba', 'portrait', null, 6),
  ('detalhe-2', 'Detalhe da barbearia', 'detalhe', 'square', null, 7)
on conflict (id) do nothing;

-- opening_hours, services, professionals e professional_hours ficam vazios
-- de propósito: a barbearia ainda não confirmou horários, serviços/preços
-- nem a lista de profissionais reais (ver BL-099, mesmo estado do código
-- hoje). schedule_exceptions e as tabelas de agendamento (appointments,
-- appointment_services, appointment_status_history) começam vazias porque
-- são dados transacionais, não conteúdo do site — não fazem sentido seedar.
