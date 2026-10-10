-- Fotos de banco (Pexels, licença livre para uso comercial, sem atribuição
-- obrigatória) só para a demonstração ao cliente — NÃO são fotos da barbearia
-- Barber de verdade. Rode no SQL Editor do Supabase para preencher a
-- Galeria com imagens de exemplo antes da reunião.
--
-- IMPORTANTE: antes de o site ir ao ar para os clientes reais da barbearia,
-- troque cada foto pela real (pelo /admin, botão "Trocar foto") ou rode a
-- seção "reverter" no fim deste arquivo para voltar aos marcadores "em breve".
--
-- Créditos (Pexels License: uso livre, sem atribuição obrigatória, mas os
-- nomes ficam aqui para referência): Pavel Danilyuk, cottonbro studio,
-- Shkraba Anthony, Marcelo Verfe, RDNE Stock project, Th2city Santana,
-- Alexandre Saraiva Carniato.

update gallery_images set src = 'https://images.pexels.com/photos/7518728/pexels-photo-7518728.jpeg?auto=compress&cs=tinysrgb&w=1200' where id = 'ambiente-1';
update gallery_images set src = 'https://images.pexels.com/photos/3998397/pexels-photo-3998397.jpeg?auto=compress&cs=tinysrgb&w=1200' where id = 'corte-1';
update gallery_images set src = 'https://images.pexels.com/photos/4625615/pexels-photo-4625615.jpeg?auto=compress&cs=tinysrgb&w=1200' where id = 'barba-1';
update gallery_images set src = 'https://images.pexels.com/photos/18483774/pexels-photo-18483774.jpeg?auto=compress&cs=tinysrgb&w=1200' where id = 'detalhe-1';
update gallery_images set src = 'https://images.pexels.com/photos/7697364/pexels-photo-7697364.jpeg?auto=compress&cs=tinysrgb&w=1200' where id = 'corte-2';
update gallery_images set src = 'https://images.pexels.com/photos/2318055/pexels-photo-2318055.jpeg?auto=compress&cs=tinysrgb&w=1200' where id = 'ambiente-2';
update gallery_images set src = 'https://images.pexels.com/photos/6007400/pexels-photo-6007400.jpeg?auto=compress&cs=tinysrgb&w=1200' where id = 'barba-2';
update gallery_images set src = 'https://images.pexels.com/photos/7697208/pexels-photo-7697208.jpeg?auto=compress&cs=tinysrgb&w=1200' where id = 'detalhe-2';

-- ===================== reverter (rode isto para voltar ao "em breve") =====================
-- update gallery_images set src = null;
