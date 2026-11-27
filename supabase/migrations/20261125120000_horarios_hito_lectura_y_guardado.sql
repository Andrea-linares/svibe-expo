-- Horarios de los hitos. PENDIENTE DE APLICAR (Supabase → SQL Editor).
-- No borra datos de otros hitos ni cambia las filas existentes.
--
-- 1) La única política SELECT de horarios_hito era solo para el rol "anon".
--    Cualquier usuario con sesión (rol "authenticated", incluido el admin)
--    recibía 0 filas: el detalle mostraba "Cerrado ahora · Cerrado hoy" y el
--    formulario del admin mostraba siempre 08:00 – 17:00.
-- 2) No había políticas de escritura: el formulario hacía delete/insert directo
--    sobre horarios_hito, RLS lo bloqueaba (0 filas borradas, insert rechazado)
--    y la app ignoraba el error. Ahora se guarda con una función solo para admin,
--    en una sola transacción (borra y vuelve a insertar las filas del hito).

begin;

-- 1) Lectura pública para invitados y usuarios con sesión
drop policy if exists "Lectura publica horarios_hito" on public.horarios_hito;
create policy "Lectura publica horarios_hito"
  on public.horarios_hito
  for select
  to anon, authenticated
  using (true);

-- 2) Guardado de horarios (solo administradores)
-- p_horarios: [{"dia_semana":0,"hora_apertura":"08:00","hora_cierre":"17:00"}, ...]
-- Un arreglo vacío deja el hito sin horario. Devuelve las filas insertadas.
create or replace function public.admin_guardar_horarios(
  p_hito_id uuid,
  p_horarios jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas integer;
begin
  if not es_admin() then
    raise exception 'No autorizado: solo administradores pueden guardar horarios';
  end if;

  if not exists (select 1 from hitos where id = p_hito_id) then
    raise exception 'El lugar no existe';
  end if;

  if p_horarios is null or jsonb_typeof(p_horarios) <> 'array' then
    raise exception 'Formato de horarios inválido';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_horarios) e
    where (e->>'dia_semana')::int not between 0 and 6
       or (e->>'hora_apertura')::time >= (e->>'hora_cierre')::time
  ) then
    raise exception 'Horario inválido: día fuera de 0-6 o apertura no es antes del cierre';
  end if;

  if (select count(*) from jsonb_array_elements(p_horarios))
     <> (select count(distinct (e->>'dia_semana')::int) from jsonb_array_elements(p_horarios) e) then
    raise exception 'Horario inválido: día repetido';
  end if;

  delete from horarios_hito where hito_id = p_hito_id;

  insert into horarios_hito (hito_id, dia_semana, hora_apertura, hora_cierre)
  select
    p_hito_id,
    (e->>'dia_semana')::int,
    (e->>'hora_apertura')::time,
    (e->>'hora_cierre')::time
  from jsonb_array_elements(p_horarios) e;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

revoke all on function public.admin_guardar_horarios(uuid, jsonb) from public, anon;
grant execute on function public.admin_guardar_horarios(uuid, jsonb) to authenticated;

commit;
