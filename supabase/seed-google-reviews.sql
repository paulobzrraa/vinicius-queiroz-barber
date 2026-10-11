-- Avaliações do Google Maps (perfil "Vinicius Queiroz Barber") na seção de
-- Depoimentos. Rode no SQL Editor do Supabase. Seguro de rodar de novo: só
-- insere os que ainda não existem (mesmo nome e mesmo texto).
--
-- Texto copiado como aparece no Google. O da primeira avaliação vem cortado
-- ("…") no Maps; complete no /admin se quiser o texto inteiro.

insert into testimonials (client_name, rating, quote, sort_order)
select v.client_name, v.rating, v.quote, v.sort_order
from (values
  ('Lucas Squad', 5::smallint,
   'Ótimo, agora sempre estou cortando nessa barbearia, muito bom os corte ele se esforçar muito, recomendo muito 😁',
   1),
  ('Rodrigo Rocha', 5::smallint,
   'Ambiente extremamente confortável e atendimento sensacional!',
   2)
) as v(client_name, rating, quote, sort_order)
where not exists (
  select 1 from testimonials t
  where t.client_name = v.client_name and t.quote = v.quote
);
