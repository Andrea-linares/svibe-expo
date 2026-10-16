-- Mejoras opcionales del foro. PENDIENTE DE APLICAR (no impide que el foro funcione).
-- Ejecutar en Supabase → SQL Editor. No borra datos: los DROP solo recrean
-- una clave foránea y una función con su nueva definición.
--
-- 1) Permite eliminar un hito que tenga reseñas (hoy falla por la clave foránea),
--    igual que el resto de tablas relacionadas con hitos (ON DELETE CASCADE).
-- 2) obtener_resenas_hito devuelve también editado_en, para mostrar "· editado"
--    en las reseñas del detalle del hito (la app ya lo soporta).

begin;

alter table public.foro_posts drop constraint if exists foro_posts_hito_id_fkey;
alter table public.foro_posts
  add constraint foro_posts_hito_id_fkey
  foreign key (hito_id) references public.hitos(id) on delete cascade;

-- Cambia el tipo de retorno, por eso se recrea (create or replace no lo permite)
drop function if exists public.obtener_resenas_hito(uuid);
create function public.obtener_resenas_hito(p_hito_id uuid)
returns table (id uuid, contenido text, creado_en timestamptz, editado_en timestamptz, autor text, es_mia boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.contenido, p.creado_en, p.editado_en,
         nombre_publico_foro(pf.nombre, pf.apellido),
         coalesce(p.usuario_id = auth.uid(), false)
  from foro_posts p
  left join perfiles pf on pf.id = p.usuario_id
  where p.hito_id = p_hito_id
  order by p.creado_en desc;
$$;

grant execute on function public.obtener_resenas_hito(uuid) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
