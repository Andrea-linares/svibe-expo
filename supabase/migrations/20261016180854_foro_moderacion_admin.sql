-- HU-039 Administrar foro: el administrador puede leer y eliminar reseñas y comentarios.
-- YA APLICADA en el proyecto gdrrajvafwzgnbvjmqtw (se guarda aquí como registro).
-- No se agrega lectura pública: invitados y usuarios mantienen las reglas actuales.
create policy foro_posts_select_admin on public.foro_posts
  for select to authenticated using (es_admin());
create policy foro_posts_delete_admin on public.foro_posts
  for delete to authenticated using (es_admin());
create policy foro_comentarios_select_admin on public.foro_comentarios
  for select to authenticated using (es_admin());
create policy foro_comentarios_delete_admin on public.foro_comentarios
  for delete to authenticated using (es_admin());
