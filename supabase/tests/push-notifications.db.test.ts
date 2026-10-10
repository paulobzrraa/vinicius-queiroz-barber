// Testa o SQL de verdade (supabase/schema.sql) num Postgres em WASM (PGlite),
// sem precisar de projeto Supabase. O que o Supabase traz e o PGlite não traz
// (auth.uid(), pg_net, roles anon/authenticated, storage) entra como stub
// mínimo abaixo. pg_net é trocado por uma função que só grava a chamada em
// harness.net_calls, então dá para afirmar quantas notificações saíram e
// quantos serviços o agendamento já tinha quando o envio foi disparado.
import { readFileSync } from 'node:fs'

import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { beforeAll, describe, expect, it } from 'vitest'

const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8').replace(
  'create extension if not exists "pg_net";',
  '',
)

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    email_confirmed_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema harness;
  create table harness.net_calls (
    id serial primary key,
    url text not null,
    body jsonb,
    services_at_dispatch integer
  );

  create schema net;
  create function net.http_post(
    url text,
    headers jsonb default '{}'::jsonb,
    body jsonb default '{}'::jsonb,
    timeout_milliseconds integer default 5000
  )
  returns bigint
  language plpgsql
  as $$
  declare
    v_services integer := 0;
  begin
    if url like '%web-push-notify%' and current_setting('harness.fail_push', true) = 'on' then
      raise exception 'push fora do ar';
    end if;
    if url like '%telegram-notify%' and current_setting('harness.fail_telegram', true) = 'on' then
      raise exception 'telegram fora do ar';
    end if;
    if url like '%web-push-notify%' then
      select count(*) into v_services
      from public.appointment_services aps
      join public.push_notifications pn on pn.appointment_id = aps.appointment_id
      where pn.id = (body->>'notification_id')::uuid;
    end if;
    insert into harness.net_calls (url, body, services_at_dispatch) values (url, body, v_services);
    return 1;
  end;
  $$;

  create schema storage;
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);

  create publication supabase_realtime;
`

const GRANTS = `
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
  grant usage, select on all sequences in schema public to anon, authenticated;
`

const ADMIN = '00000000-0000-0000-0000-00000000aaaa'
const OTHER = '00000000-0000-0000-0000-00000000bbbb'
const PRO = '00000000-0000-0000-0000-00000000cccc'
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/device-1'
const P256DH = 'B'.repeat(87)
const AUTH = 'A'.repeat(22)

type Db = PGlite
let base: PGlite

beforeAll(async () => {
  base = await PGlite.create({ extensions: { pgcrypto, btree_gist } })
  await base.exec(STUBS)
  await base.exec(schemaSql)
  await base.exec(GRANTS)

  // Seed mínimo para agendar: um serviço de corte e de barba, uma profissional
  // que atende os dois, de seg a dom das 08h às 18h. Valores fictícios: só
  // existem dentro do banco de teste.
  await base.exec(`
    insert into auth.users (id, email, email_confirmed_at) values
      ('${ADMIN}', 'admin@example.test', now()),
      ('${OTHER}', 'cliente@example.test', now());
    insert into admins (user_id) values ('${ADMIN}');

    insert into services (id, name, description, price, duration_minutes, sort_order) values
      ('corte', 'Corte', 'Corte', 40, 30, 0),
      ('barba', 'Barba', 'Barba', 25, 20, 1);
    insert into professionals (id, name) values ('${PRO}', 'Profissional de teste');
    insert into professional_services (professional_id, service_id) values
      ('${PRO}', 'corte'), ('${PRO}', 'barba');
    insert into professional_hours (professional_id, weekday, starts_at, ends_at)
      select '${PRO}', d, '08:00', '18:00' from generate_series(0, 6) as d;
  `)
})

async function freshDb(): Promise<Db> {
  return base.clone()
}

/** Executa como um usuário do Supabase: role authenticated/anon + auth.uid(). */
async function as<T>(db: Db, userId: string | null, run: () => Promise<T>): Promise<T> {
  await db.query(`set role ${userId ? 'authenticated' : 'anon'}`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ''])
  try {
    return await run()
  } finally {
    await db.query('reset role')
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
  }
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code })
}

async function enableWebPush(db: Db) {
  await db.query(`
    update notification_settings
    set push_function_url = 'https://project.test/functions/v1/web-push-notify',
        push_function_secret = 'segredo-push'
    where id = 1
  `)
}

async function enableTelegram(db: Db) {
  await db.query(`
    update notification_settings
    set telegram_function_url = 'https://project.test/functions/v1/telegram-notify',
        telegram_function_secret = 'segredo-telegram'
    where id = 1
  `)
}

async function subscribeAdmin(db: Db, endpoint = ENDPOINT) {
  await as(db, ADMIN, () =>
    db.query('select register_push_subscription($1, $2, $3, $4)', [
      endpoint,
      P256DH,
      AUTH,
      'teste',
    ]),
  )
}

async function pushRows(db: Db) {
  const { rows } = await db.query<{ kind: string; status: string; appointment_id: string }>(
    'select kind, status, appointment_id from push_notifications order by created_at, id',
  )
  return rows
}

async function pushCalls(db: Db) {
  const { rows } = await db.query<{ services_at_dispatch: number }>(
    `select services_at_dispatch from harness.net_calls where url like '%web-push-notify%' order by id`,
  )
  return rows
}

async function telegramCalls(db: Db) {
  const { rows } = await db.query(
    `select count(*)::int as n from harness.net_calls where url like '%telegram-notify%'`,
  )
  return (rows[0] as { n: number }).n
}

/** Agenda pelo site (create_appointment), no primeiro horário livre de daqui a 3 dias. */
async function siteBooking(db: Db, clientName = 'Cliente Teste') {
  const { rows } = await db.query<{ starts_at: string }>(
    `select starts_at from get_available_slots(array['corte'], current_date + 3, null)
     order by starts_at limit 1`,
  )
  const startsAt = rows[0].starts_at
  const { rows: created } = await db.query<{ id: string }>(
    `select id from create_appointment($1::text, $2::text, array['corte']::text[], $3::timestamptz,
       null::uuid, null::text, null::text)`,
    [clientName, '88999990000', startsAt],
  )
  return { id: created[0].id, startsAt }
}

/** Horário fixo (fora do cálculo de disponibilidade) para o painel do admin. */
const ADMIN_SLOT = `(current_date + 10)::timestamptz + interval '14 hours'`

/** Move pelo painel (admin_move_appointment), com o horário dado como expressão SQL. */
async function adminMove(db: Db, id: string, startsAtSql: string, serviceIds: string[]) {
  await as(db, ADMIN, () =>
    db.query(`select admin_move_appointment($1, $2, ${startsAtSql}, $3::text[])`, [
      id,
      PRO,
      serviceIds,
    ]),
  )
}

/** Cria pelo painel, como o admin logado (lança o erro do Postgres se falhar). */
async function adminCreate(db: Db, serviceIds = ['corte']) {
  const { rows } = await as(db, ADMIN, () =>
    db.query<{ id: string }>(
      `select admin_create_appointment($1, $2, $3, $4::text[], ${ADMIN_SLOT}) as id`,
      ['Cliente do painel', '88999991111', PRO, serviceIds],
    ),
  )
  return rows[0].id
}

describe('chave pública VAPID (get_push_public_key)', () => {
  it('qualquer visitante lê a chave pública, mas não as outras colunas de configuração', async () => {
    const db = await freshDb()
    await db.query(
      `update notification_settings set push_public_key = 'BPUBLICA', push_function_secret = 'segredo' where id = 1`,
    )

    const anon = await as(db, null, () =>
      db.query<{ k: string }>('select get_push_public_key() as k'),
    )
    expect(anon.rows[0].k).toBe('BPUBLICA')
    // Leitura direta da linha (com o segredo do webhook) é filtrada pelo RLS: anon vê zero linhas.
    const direct = await as(db, null, () =>
      db.query('select push_function_secret from notification_settings'),
    )
    expect(direct.rows).toHaveLength(0)
  })
})

describe('cadastro de aparelhos (register/unregister_push_subscription)', () => {
  it('aparelho desativado pelo push volta a ativo quando o admin reenvia a assinatura', async () => {
    const db = await freshDb()
    await subscribeAdmin(db)
    await db.query(
      `update push_subscriptions set active = false, last_error = 'assinatura expirou (410)'`,
    )

    await subscribeAdmin(db)

    const { rows } = await db.query<{ active: boolean; last_error: string | null }>(
      'select active, last_error from push_subscriptions',
    )
    expect(rows).toEqual([{ active: true, last_error: null }])
  })

  it('admin registra um aparelho e ele fica ativo, vinculado ao próprio usuário', async () => {
    const db = await freshDb()
    await subscribeAdmin(db)

    const { rows } = await db.query<{ user_id: string; active: boolean }>(
      'select user_id, active from push_subscriptions',
    )
    expect(rows).toEqual([{ user_id: ADMIN, active: true }])
  })

  it('o mesmo aparelho registrado de novo não duplica a assinatura', async () => {
    const db = await freshDb()
    await subscribeAdmin(db)
    await subscribeAdmin(db)

    const { rows } = await db.query('select id from push_subscriptions')
    expect(rows).toHaveLength(1)
  })

  it('admin pode ter vários aparelhos ao mesmo tempo', async () => {
    const db = await freshDb()
    await subscribeAdmin(db, 'https://fcm.googleapis.com/fcm/send/celular')
    await subscribeAdmin(db, 'https://web.push.apple.com/tablet')

    const { rows } = await db.query('select id from push_subscriptions')
    expect(rows).toHaveLength(2)
  })

  it('usuário logado que não é admin (cliente com Google) não registra aparelho', async () => {
    const db = await freshDb()
    await expectCode(
      as(db, OTHER, () =>
        db.query('select register_push_subscription($1, $2, $3, null)', [ENDPOINT, P256DH, AUTH]),
      ),
      '42501',
    )
    const { rows } = await db.query('select id from push_subscriptions')
    expect(rows).toHaveLength(0)
  })

  it('usuário não autenticado (anon) não registra aparelho', async () => {
    const db = await freshDb()
    await expectCode(
      as(db, null, () =>
        db.query('select register_push_subscription($1, $2, $3, null)', [ENDPOINT, P256DH, AUTH]),
      ),
      '42501',
    )
  })

  it('anon e usuário comum não leem as assinaturas nem a fila de envio', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)
    await siteBooking(db)

    const anon = await as(db, null, () => db.query('select id from push_subscriptions'))
    const other = await as(db, OTHER, () => db.query('select id from push_subscriptions'))
    const otherQueue = await as(db, OTHER, () => db.query('select id from push_notifications'))
    expect(anon.rows).toHaveLength(0)
    expect(other.rows).toHaveLength(0)
    expect(otherQueue.rows).toHaveLength(0)
  })

  it('admin não grava assinatura direto na tabela (só pelas funções)', async () => {
    const db = await freshDb()
    await expectCode(
      as(db, ADMIN, () =>
        db.query(
          `insert into push_subscriptions (user_id, endpoint, p256dh, auth_secret)
           values ($1, $2, $3, $4)`,
          [ADMIN, ENDPOINT, P256DH, AUTH],
        ),
      ),
      '42501',
    )
  })

  it('admin só lê as próprias assinaturas', async () => {
    const db = await freshDb()
    await subscribeAdmin(db)
    await db.query(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth_secret)
       values ($1, 'https://fcm.googleapis.com/fcm/send/outro', $2, $3)`,
      [OTHER, P256DH, AUTH],
    )

    const { rows } = await as(db, ADMIN, () =>
      db.query<{ user_id: string }>('select user_id from push_subscriptions'),
    )
    expect(rows.map((row) => row.user_id)).toEqual([ADMIN])
  })

  it('endpoint que não é https é recusado', async () => {
    const db = await freshDb()
    await expectCode(
      as(db, ADMIN, () =>
        db.query('select register_push_subscription($1, $2, $3, null)', [
          'http://insegura.test/x',
          P256DH,
          AUTH,
        ]),
      ),
      '23514',
    )
  })

  it('chaves com formato inválido são recusadas', async () => {
    const db = await freshDb()
    await expectCode(
      as(db, ADMIN, () =>
        db.query('select register_push_subscription($1, $2, $3, null)', [
          ENDPOINT,
          'não é base64url!',
          AUTH,
        ]),
      ),
      '23514',
    )
  })

  it('não deixa passar de 10 aparelhos ativos por admin', async () => {
    const db = await freshDb()
    for (let i = 0; i < 10; i++)
      await subscribeAdmin(db, `https://fcm.googleapis.com/fcm/send/${i}`)

    await expectCode(subscribeAdmin(db, 'https://fcm.googleapis.com/fcm/send/11'), 'P0005')
    // Reenviar um aparelho que já está na lista continua permitido.
    await subscribeAdmin(db, 'https://fcm.googleapis.com/fcm/send/3')
  })

  it('desativar remove só o aparelho do próprio admin', async () => {
    const db = await freshDb()
    await subscribeAdmin(db)
    await db.query(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth_secret)
       values ($1, 'https://fcm.googleapis.com/fcm/send/outro', $2, $3)`,
      [OTHER, P256DH, AUTH],
    )

    const removed = await as(db, ADMIN, () =>
      db.query<{ r: boolean }>('select unregister_push_subscription($1) as r', [ENDPOINT]),
    )
    expect(removed.rows[0].r).toBe(true)

    const { rows } = await db.query<{ user_id: string }>('select user_id from push_subscriptions')
    expect(rows).toEqual([{ user_id: OTHER }])
  })
})

describe('notificações de agendamento', () => {
  it('sem aparelho ativo, nenhum agendamento gera fila nem chamada', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await siteBooking(db)

    expect(await pushRows(db)).toEqual([])
    expect(await pushCalls(db)).toEqual([])
  })

  it('novo agendamento pelo site gera exatamente uma notificação "created"', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)

    await siteBooking(db)

    const rows = await pushRows(db)
    expect(rows.map((row) => row.kind)).toEqual(['created'])
    expect(await pushCalls(db)).toHaveLength(1)
  })

  it('agendamento criado pelo admin gera "created" e o envio já vê os serviços gravados', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)

    await adminCreate(db, ['corte', 'barba'])

    expect((await pushRows(db)).map((row) => row.kind)).toEqual(['created'])
    const calls = await pushCalls(db)
    expect(calls).toHaveLength(1)
    expect(calls[0].services_at_dispatch).toBe(2)
  })

  it('cancelamento pelo link do cliente (cancel_appointment) gera uma notificação "canceled"', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)
    const { id } = await siteBooking(db)
    const { rows: token } = await db.query<{ access_token: string }>(
      'select access_token from appointments where id = $1',
      [id],
    )

    await db.query('select cancel_appointment($1)', [token[0].access_token])
    // Cancelar de novo não é transição: não gera outra notificação.
    await db.query('select cancel_appointment($1)', [token[0].access_token])

    expect((await pushRows(db)).map((row) => row.kind)).toEqual(['created', 'canceled'])
  })

  it('cancelamento pelo painel (mudança de status) também notifica, uma vez', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)
    const id = await adminCreate(db)

    await as(db, ADMIN, () =>
      db.query(`update appointments set status = 'canceled' where id = $1`, [id]),
    )

    expect((await pushRows(db)).map((row) => row.kind)).toEqual(['created', 'canceled'])
  })

  it('reagendamento pelo cliente (reschedule_appointment) gera uma notificação "updated"', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)
    const { id, startsAt } = await siteBooking(db)
    const { rows: token } = await db.query<{ access_token: string }>(
      'select access_token from appointments where id = $1',
      [id],
    )
    const newStart = new Date(new Date(startsAt).getTime() + 60 * 60_000).toISOString()

    await db.query('select reschedule_appointment($1, $2)', [token[0].access_token, newStart])

    expect((await pushRows(db)).map((row) => row.kind)).toEqual(['created', 'updated'])
  })

  it('mover horário pelo painel gera uma única "updated" (não duplica com o caminho de serviços)', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)
    const id = await adminCreate(db)

    await adminMove(db, id, "(current_date + 11)::timestamptz + interval '10 hours'", ['corte'])

    expect((await pushRows(db)).map((row) => row.kind)).toEqual(['created', 'updated'])
  })

  it('trocar só o serviço, mantendo horário e profissional, gera uma "updated"', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)
    const id = await adminCreate(db, ['corte'])

    await adminMove(db, id, ADMIN_SLOT, ['corte', 'barba'])

    expect((await pushRows(db)).map((row) => row.kind)).toEqual(['created', 'updated'])
  })

  it('salvar a edição sem nenhuma mudança real não gera notificação', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)
    const id = await adminCreate(db, ['corte'])

    await adminMove(db, id, ADMIN_SLOT, ['corte'])

    expect((await pushRows(db)).map((row) => row.kind)).toEqual(['created'])
  })

  it('mudanças internas de status (concluir, não compareceu, pagamento) não notificam', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)
    const id = await adminCreate(db)

    await as(db, ADMIN, async () => {
      await db.query(`update appointments set status = 'confirmed' where id = $1`, [id])
      await db.query(
        `update appointments set status = 'completed', payment_method = 'pix' where id = $1`,
        [id],
      )
    })

    expect((await pushRows(db)).map((row) => row.kind)).toEqual(['created'])
  })

  it('operação que falha não gera notificação (conflito de horário no painel)', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)
    await adminCreate(db)

    await expect(adminCreate(db)).rejects.toMatchObject({ code: '23P01' })

    expect((await pushRows(db)).map((row) => row.kind)).toEqual(['created'])
    const { rows } = await db.query('select id from appointments')
    expect(rows).toHaveLength(1)
  })

  it('serviço inexistente no painel é recusado sem gerar notificação', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)

    await expect(adminCreate(db, ['servico-que-nao-existe'])).rejects.toMatchObject({
      code: 'P0008',
    })

    expect(await pushRows(db)).toEqual([])
    const { rows } = await db.query('select id from appointments')
    expect(rows).toHaveLength(0)
  })

  it('transação revertida não notifica (ROLLBACK depois do agendamento)', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)

    await db.exec('begin')
    await siteBooking(db)
    await db.exec('rollback')

    expect(await pushRows(db)).toEqual([])
    expect(await pushCalls(db)).toEqual([])
  })

  it('usuário sem permissão não consegue criar agendamento pelo painel (forbidden)', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await subscribeAdmin(db)

    await expect(
      as(db, OTHER, () =>
        db.query(`select admin_create_appointment($1, $2, $3, $4::text[], ${ADMIN_SLOT})`, [
          'Cliente',
          '88999991111',
          PRO,
          ['corte'],
        ]),
      ),
    ).rejects.toMatchObject({ code: '42501' })
    expect(await pushRows(db)).toEqual([])
  })

  it('falha do push não desfaz o agendamento nem o registro do Telegram', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await enableTelegram(db)
    await subscribeAdmin(db)
    await db.query(`select set_config('harness.fail_push', 'on', false)`)

    const { id } = await siteBooking(db)

    const { rows: appointments } = await db.query('select id from appointments where id = $1', [id])
    expect(appointments).toHaveLength(1)
    const { rows: pushStatus } = await db.query<{ status: string; last_error: string }>(
      `select status, last_error from push_notifications where kind = 'created'`,
    )
    expect(pushStatus).toEqual([
      { status: 'failed', last_error: 'falha ao disparar a função de push' },
    ])
    // Telegram continua sendo enfileirado e disparado normalmente.
    expect(await telegramCalls(db)).toBe(1)
    const { rows: telegram } = await db.query('select status from telegram_notifications')
    expect(telegram).toEqual([{ status: 'pending' }])
  })

  it('Telegram e Push convivem: cada agendamento do site dispara os dois, uma vez cada', async () => {
    const db = await freshDb()
    await enableWebPush(db)
    await enableTelegram(db)
    await subscribeAdmin(db)

    await siteBooking(db)

    expect(await telegramCalls(db)).toBe(1)
    expect(await pushCalls(db)).toHaveLength(1)
  })
})
