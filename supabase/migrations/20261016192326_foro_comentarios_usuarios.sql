-- HU-018 Foro: comentarios de usuarios y foro reciente.
-- YA APLICADA en el proyecto gdrrajvafwzgnbvjmqtw (se guarda aquí como registro).
-- Solo aditiva e idempotente: no borra ni modifica nada existente.
-- Pendiente aparte: 20261016200000_foro_cascada_y_editado.sql

alter table public.foro_posts add column if not exists editado_en timestamptz;
alter table public.foro_comentarios add column if not exists editado_en timestamptz;

-- Marca de edición: la rellena el servidor solo cuando cambia el texto
create or replace function public.marcar_editado_foro()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.contenido is distinct from old.contenido then
    new.editado_en := now();
  end if;
  return new;
end;
$$;

create or replace trigger foro_posts_marcar_editado
  before update on public.foro_posts
  for each row execute function public.marcar_editado_foro();

create or replace trigger foro_comentarios_marcar_editado
  before update on public.foro_comentarios
  for each row execute function public.marcar_editado_foro();

-- Comentarios: misma regla de longitud y permisos por autor que las reseñas
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'foro_comentarios_contenido_longitud') then
    alter table public.foro_comentarios
      add constraint foro_comentarios_contenido_longitud
      check (char_length(btrim(contenido, E' \t\r\n')) between 10 and 500) not valid;
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'foro_comentarios' and policyname = 'foro_comentarios_select_propios') then
    create policy foro_comentarios_select_propios on public.foro_comentarios
      for select to authenticated using (usuario_id = (select auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'foro_comentarios' and policyname = 'foro_comentarios_insert_propios') then
    create policy foro_comentarios_insert_propios on public.foro_comentarios
      for insert to authenticated with check (usuario_id = (select auth.uid()) and post_id is not null);
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'foro_comentarios' and policyname = 'foro_comentarios_update_propios') then
    create policy foro_comentarios_update_propios on public.foro_comentarios
      for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
  end if;

  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'foro_comentarios' and policyname = 'foro_comentarios_delete_propios') then
    create policy foro_comentarios_delete_propios on public.foro_comentarios
      for delete to authenticated using (usuario_id = (select auth.uid()));
  end if;
end;
$$;

-- Al editar solo se puede cambiar el texto
revoke update on public.foro_comentarios from anon, authenticated;
grant update (contenido) on public.foro_comentarios to authenticated;

-- Lectura pública con el nombre del autor ("Nombre A."), sin exponer el resto del perfil
create or replace function public.nombre_publico_foro(p_nombre text, p_apellido text)
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    nullif(concat_ws(' ', nullif(btrim(p_nombre), ''), left(nullif(btrim(p_apellido), ''), 1) || '.'), ''),
    'Usuario'
  );
$$;

create or replace function public.obtener_comentarios_hito(p_hito_id uuid)
returns table (id uuid, post_id uuid, contenido text, creado_en timestamptz, editado_en timestamptz, autor text, es_mio boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.post_id, c.contenido, c.creado_en, c.editado_en,
         nombre_publico_foro(pf.nombre, pf.apellido),
         coalesce(c.usuario_id = auth.uid(), false)
  from foro_comentarios c
  join foro_posts p on p.id = c.post_id
  left join perfiles pf on pf.id = c.usuario_id
  where p.hito_id = p_hito_id
  order by c.creado_en asc;
$$;

create or replace function public.obtener_resenas_recientes(p_limite integer default 50)
returns table (id uuid, hito_id uuid, hito_nombre text, contenido text, creado_en timestamptz, editado_en timestamptz, autor text, es_mia boolean, total_comentarios integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.hito_id, h.nombre, p.contenido, p.creado_en, p.editado_en,
         nombre_publico_foro(pf.nombre, pf.apellido),
         coalesce(p.usuario_id = auth.uid(), false),
         (select count(*)::integer from foro_comentarios c where c.post_id = p.id)
  from foro_posts p
  join hitos h on h.id = p.hito_id
  left join perfiles pf on pf.id = p.usuario_id
  order by p.creado_en desc
  limit least(greatest(coalesce(p_limite, 50), 1), 100);
$$;

grant execute on function public.obtener_resenas_hito(uuid) to anon, authenticated;
grant execute on function public.obtener_comentarios_hito(uuid) to anon, authenticated;
grant execute on function public.obtener_resenas_recientes(integer) to anon, authenticated;

notify pgrst, 'reload schema';
