-- Búsqueda por lugar en el foro. PENDIENTE DE APLICAR (Supabase → SQL Editor).
-- No borra datos: solo recrea la función con un parámetro nuevo.
--
-- obtener_resenas_recientes devuelve como máximo 100 reseñas (la app pide 50),
-- así que el filtro por lugar del foro, que hoy es solo en el cliente, no ve
-- reseñas más antiguas. Con p_busqueda el servidor filtra por el nombre del
-- lugar (sin distinguir mayúsculas ni tildes) antes de aplicar el límite.
-- p_busqueda null o vacío = comportamiento de siempre.
-- (La extensión unaccent no está instalada: se usa translate para las tildes.)

begin;

-- Cambia la lista de parámetros: se elimina la versión anterior para no dejar
-- dos sobrecargas de la función
drop function if exists public.obtener_resenas_recientes(integer);

create function public.obtener_resenas_recientes(
  p_limite integer default 50,
  p_busqueda text default null
)
returns table (
  id uuid,
  hito_id uuid,
  hito_nombre text,
  contenido text,
  creado_en timestamptz,
  editado_en timestamptz,
  autor text,
  es_mia boolean,
  total_comentarios integer
)
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
  where coalesce(btrim(p_busqueda), '') = ''
     or translate(lower(h.nombre), 'áéíóúüñ', 'aeiouun')
        like '%' || translate(lower(btrim(p_busqueda)), 'áéíóúüñ', 'aeiouun') || '%'
  order by p.creado_en desc
  limit least(greatest(coalesce(p_limite, 50), 1), 100);
$$;

grant execute on function public.obtener_resenas_recientes(integer, text) to anon, authenticated;

commit;
