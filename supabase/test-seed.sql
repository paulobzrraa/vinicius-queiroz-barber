-- Dados FICTÍCIOS para o projeto Supabase de TESTE. NÃO rode em produção.
--
-- Depois de rodar o schema.sql no projeto de teste, rode este arquivo para
-- ter o que o fluxo de agendamento precisa (serviços, barbeiros, horários).
-- Tudo aqui é inventado e marcado como "Teste"; nada vem da barbearia real.
-- É seguro rodar de novo (on conflict do nothing).

insert into services (id, name, description, price, duration_minutes, sort_order) values
  ('teste-corte', 'Corte (teste)', 'Serviço fictício para testes.', 40, 30, 0),
  ('teste-barba', 'Barba (teste)', 'Serviço fictício para testes.', 30, 30, 1),
  ('teste-combo', 'Corte + barba (teste)', 'Serviço fictício para testes.', 65, 60, 2)
on conflict (id) do nothing;

insert into professionals (id, name, bio, sort_order) values
  ('00000000-0000-4000-8000-000000000001', 'Barbeiro Teste 1', 'Profissional fictício.', 0),
  ('00000000-0000-4000-8000-000000000002', 'Barbeiro Teste 2', 'Profissional fictício.', 1)
on conflict (id) do nothing;

insert into professional_services (professional_id, service_id)
select p.id, s.id
from professionals p
cross join services s
where p.id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')
  and s.id like 'teste-%'
on conflict do nothing;

-- Segunda a sábado, 9h às 18h, almoço das 12h às 13h.
insert into professional_hours (professional_id, weekday, starts_at, ends_at, break_starts_at, break_ends_at)
select p.id, d, time '09:00', time '18:00', time '12:00', time '13:00'
from professionals p
cross join generate_series(1, 6) as d
where p.id in ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002')
on conflict (professional_id, weekday) do nothing;

insert into opening_hours (days, hours, sort_order, weekday, opens_at, closes_at)
select 'Dia ' || d, '09:00 às 18:00', d, d, time '09:00', time '18:00'
from generate_series(1, 6) as d
on conflict do nothing;

-- Limpar os agendamentos de teste quando quiser:
-- delete from appointments;
