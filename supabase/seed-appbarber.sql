-- Dados da barbearia copiados da página de agendamento (AppBarber) e do
-- perfil do Instagram. Rode no SQL Editor do Supabase (ele executa como dono
-- do banco, então não depende de estar na tabela admins). Seguro de rodar de
-- novo: os inserts usam on conflict ou apagam antes de recriar.
--
-- Fotos NÃO entram aqui: suba-as pelo /admin (Galeria e Profissionais), e elas
-- ganham a URL do bucket "gallery" sozinhas.

-- ===================== Serviços =====================
insert into services (id, name, description, price, duration_minutes, sort_order, active) values
  ('barba',                 'Barba',                          '', 35.00, 30,  1, true),
  ('corte',                 'Corte',                          '', 35.00, 45,  2, true),
  ('corte-barba',           'Corte+barba',                    '', 60.00, 60,  3, true),
  ('hidratacao',            'Hidratação (a partir)',          '', 40.00, 30,  4, true),
  ('penteado',              'Penteado',                       '', 25.00, 15,  5, true),
  ('pezinho',               'Pézinho',                        '', 15.00, 15,  6, true),
  ('pezinho-sobrancelha',   'Pézinhos+sobrancelha',           '', 20.00, 15,  7, true),
  ('realinhamento-capilar', 'Realinhamento capilar (a partir)','', 130.00, 105, 8, true),
  ('sobrancelha',           'Sobrancelha',                    '', 10.00, 15,  9, true)
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  duration_minutes = excluded.duration_minutes,
  sort_order = excluded.sort_order,
  active = excluded.active;

-- ===================== Profissional =====================
insert into professionals (id, name, bio, active, sort_order)
values ('143d2772-928d-4a16-85c1-757401ff7527', 'Vinicius', null, true, 1)
on conflict (id) do nothing;

-- Vinicius realiza todos os serviços (preço e duração padrão do serviço).
insert into professional_services (professional_id, service_id)
select '143d2772-928d-4a16-85c1-757401ff7527', id from services
on conflict (professional_id, service_id) do nothing;

-- Expediente: terça a sexta 09–12 e 14–19; sábado 09–12 e 14–18; domingo e segunda fechado.
insert into professional_hours (professional_id, weekday, starts_at, ends_at, break_starts_at, break_ends_at) values
  ('143d2772-928d-4a16-85c1-757401ff7527', 2, '09:00', '19:00', '12:00', '14:00'),
  ('143d2772-928d-4a16-85c1-757401ff7527', 3, '09:00', '19:00', '12:00', '14:00'),
  ('143d2772-928d-4a16-85c1-757401ff7527', 4, '09:00', '19:00', '12:00', '14:00'),
  ('143d2772-928d-4a16-85c1-757401ff7527', 5, '09:00', '19:00', '12:00', '14:00'),
  ('143d2772-928d-4a16-85c1-757401ff7527', 6, '09:00', '18:00', '12:00', '14:00')
on conflict (professional_id, weekday) do update set
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  break_starts_at = excluded.break_starts_at,
  break_ends_at = excluded.break_ends_at;

-- ===================== Horário de funcionamento (exibição no site) =====================
-- Linhas de texto livre (sem weekday): é o que o Contato mostra. A grade
-- estruturada não guarda o intervalo de almoço, por isso fica assim.
delete from opening_hours where weekday is null;
insert into opening_hours (days, hours, sort_order) values
  ('Terça a sexta', '09:00 às 12:00 e 14:00 às 19:00', 1),
  ('Sábado',        '09:00 às 12:00 e 14:00 às 18:00', 2),
  ('Domingo e segunda', 'Fechado',                     3);

-- ===================== Textos e contato =====================
update site_settings set
  about_body = 'Olá convido a todos para conhecer a mais nova barbearia da região, repleta de muito conforto, serviços de qualidade e uma experiencia incrivel, agende seu horario.'
where id = 1;

update contact_settings set
  whatsapp = '5585981652967',
  phone = '5585981652967',
  street = 'Rua Vidal de Negreiros, 371',
  neighborhood = 'Jardim Cearense',
  city = 'Fortaleza',
  state = 'CE',
  postal_code = '60712-108',
  country = 'BR',
  maps_url = 'https://www.google.com/maps/place/Vinicius+Queiroz+Barber/@-3.7998511,-38.5658428,483m/data=!3m1!1e3!4m6!3m5!1s0x7c74f007181d793:0x45456cebcaf74b33!8m2!3d-3.7999113!4d-38.564892!16s%2Fg%2F11yhyd35y2?entry=ttu'
where id = 1;

insert into social_links (platform, url, sort_order) values
  ('instagram', 'https://www.instagram.com/viniciusqueirozbarber', 1)
on conflict (platform, url) do nothing;
