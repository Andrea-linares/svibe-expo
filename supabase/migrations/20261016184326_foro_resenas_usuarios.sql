-- HU-018 Foro: los usuarios publican, editan y eliminan sus propias reseñas (foro_posts).
-- YA APLICADA en el proyecto gdrrajvafwzgnbvjmqtw (se guarda aquí como registro).
-- La función obtener_resenas_hito se recrea en 20261016200000_foro_cascada_y_editado.sql.

-- Validación en el servidor: entre 10 y 500 caracteres sin contar espacios al inicio/fin
alter table public.foro_posts
  add constraint foro_posts_contenido_longitud
  check (char_length(btrim(contenido, E' \t\r\n')) between 10 and 500);

-- Cada usuario gestiona solo sus reseñas (las políticas de admin se mantienen)
create policy foro_posts_select_propias on public.foro_posts
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy foro_posts_insert_propias on public.foro_posts
  for insert to authenticated with check (usuario_id = (select auth.uid()) and hito_id is not null);
create policy foro_posts_update_propias on public.foro_posts
  for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
create policy foro_posts_delete_propias on public.foro_posts
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- Al editar solo se puede cambiar el texto (no el autor, el hito ni la fecha)
revoke update on public.foro_posts from anon, authenticated;
grant update (contenido) on public.foro_posts to authenticated;

-- Reseñas públicas de un hito con el nombre del autor ("Nombre A."), sin exponer el resto del perfil
create or replace function public.obtener_resenas_hito(p_hito_id uuid)
returns table (id uuid, contenido text, creado_en timestamptz, autor text, es_mia boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.contenido,
    p.creado_en,
    coalesce(
      nullif(concat_ws(' ',
        nullif(btrim(pf.nombre), ''),
        left(nullif(btrim(pf.apellido), ''), 1) || '.'
      ), ''),
      'Usuario'
    ) as autor,
    coalesce(p.usuario_id = auth.uid(), false) as es_mia
  from foro_posts p
  left join perfiles pf on pf.id = p.usuario_id
  where p.hito_id = p_hito_id
  order by p.creado_en desc;
$$;

grant execute on function public.obtener_resenas_hito(uuid) to anon, authenticated;
