-- Realidad aumentada: permisos del bucket hitos-imagenes y valor inicial de ar_activo.
-- PENDIENTE DE APLICAR. Ejecutar en Supabase → SQL Editor.
--
-- 1) Bucket hitos-imagenes: hoy cualquier usuario autenticado puede subir y
--    nadie puede borrar ni reemplazar (no hay políticas DELETE/UPDATE), así que
--    el editor de RA no podría eliminar las fotos reemplazadas.
--    Queda así:
--      - Lectura pública: sin cambios.
--      - Administradores (es_admin()): subir, reemplazar y borrar cualquier archivo.
--      - Usuarios: solo su foto de perfil, que editar-perfil.tsx sube como
--        "perfiles/<id del usuario>-<fecha>.<ext>" (con upsert, por eso también UPDATE).
-- 2) ar_activo pasa a false por defecto (los hitos nuevos no aparecen en la RA
--    hasta que un admin los active).
-- 3) Solo quedan con RA activa los hitos que tienen alguna imagen con
--    es_marcador_ar = true. Hoy son 0, así que todos quedarán desactivados.

begin;

-- 1) Políticas de Storage --------------------------------------------------

drop policy if exists "Usuarios autenticados pueden subir a hitos-imagenes" on storage.objects;

create policy "hitos_imagenes_admin_insertar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'hitos-imagenes' and public.es_admin());

create policy "hitos_imagenes_admin_actualizar"
  on storage.objects for update to authenticated
  using (bucket_id = 'hitos-imagenes' and public.es_admin())
  with check (bucket_id = 'hitos-imagenes' and public.es_admin());

create policy "hitos_imagenes_admin_borrar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'hitos-imagenes' and public.es_admin());

create policy "hitos_imagenes_usuario_foto_perfil_insertar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'hitos-imagenes'
    and name like 'perfiles/' || auth.uid()::text || '-%'
  );

create policy "hitos_imagenes_usuario_foto_perfil_actualizar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'hitos-imagenes'
    and name like 'perfiles/' || auth.uid()::text || '-%'
  )
  with check (
    bucket_id = 'hitos-imagenes'
    and name like 'perfiles/' || auth.uid()::text || '-%'
  );

-- 2) Valor por defecto de ar_activo ------------------------------------------

alter table public.hitos alter column ar_activo set default false;

-- 3) RA activa solo en hitos con marcador ----------------------------------

update public.hitos h
set ar_activo = exists (
  select 1 from public.hito_imagenes i
  where i.hito_id = h.id and i.es_marcador_ar = true
);

commit;
