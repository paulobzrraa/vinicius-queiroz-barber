-- Texto de "Sobre Nós" e foto de fundo do Hero só para a demonstração ao
-- cliente — NÃO são informações reais da Vinicius Queiroz Barber. O texto é genérico de
-- propósito (não inventa ano de fundação, número de anos de experiência,
-- nome de fundador etc.) — mesmo assim, troque pela voz real da barbearia
-- antes de qualquer cliente de verdade ver o site.
--
-- A foto é a mesma já usada na Galeria (Pexels, licença livre, sem
-- atribuição obrigatória, foto por Pavel Danilyuk) — funciona como fundo
-- porque não tem letreiro de outra barbearia nem cor que destoe da marca.
--
-- Rode no SQL Editor do Supabase. Inclui as colunas novas (about_body,
-- hero_image_url) via ALTER TABLE, então funciona mesmo que você ainda não
-- tenha rodado a versão mais recente de schema.sql.

alter table site_settings add column if not exists about_body text;
alter table site_settings add column if not exists hero_image_url text;

update site_settings set
  about_body = 'Na Vinicius Queiroz Barber, cada corte é tratado com a atenção de um ofício aprendido à mão. Unimos técnica apurada, ambiente acolhedor e atendimento próximo para que você saia com mais do que um corte novo — saia com confiança.',
  hero_image_url = 'https://images.pexels.com/photos/7518728/pexels-photo-7518728.jpeg?auto=compress&cs=tinysrgb&w=2400'
where id = 1;

-- ===================== reverter (rode isto para voltar ao estado sem foto/texto) =====================
-- update site_settings set about_body = null, hero_image_url = null where id = 1;
