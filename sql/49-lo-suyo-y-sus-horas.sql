-- ═══════════════════════════════════════════════════════════════
-- 49 · LO QUE ELLA VE DE LAS CUENTAS, Y SUS HORAS DE MÁS
-- ═══════════════════════════════════════════════════════════════
--
-- Dos cosas para quien ayuda en casa, y las dos van de lo mismo: que
-- vea LO SUYO, entero y sin nada más.
--
-- ─────────────────────────────────────────────────────────────
-- 1 · LAS CUENTAS DE LA CASA
--
-- El SQL 37 dejó una regla y la dejó a medias. Decía: quien tiene el
-- rol «ayuda» ve lo suyo. Y lo aplicó a la agenda y al corcho, que era
-- donde estaba el agujero gordo — el médico del martes, las notas
-- entre ellos.
--
-- Pero los MOVIMIENTOS se quedaron fuera, y ahí hay tanto o más: lo que
-- cobra el jardinero, lo que costó la reforma, los ingresos de los
-- apartamentos. Hasta hoy los protegía `permisos_carpeta` —solo ve el
-- dinero de las carpetas que le hayan dado—, y eso está bien pero no
-- alcanza: dentro de la carpeta de la compra ve también lo que
-- compraron los demás.
--
-- Lo que se quiere es exacto: cuando ella entra en las cuentas de la
-- casa, ve LO QUE HA GASTADO ELLA. Sus compras, sus tiques, sus
-- importes. Ni más ni menos, y eso es además lo más útil para ella —
-- «cuánto llevo gastado este mes» es su pregunta, no el balance de la
-- familia.
--
-- Se arregla donde tiene que arreglarse: en la base de datos, no
-- escondiendo botones. Un permiso que promete una cosa y hace otra es
-- peor que no tener permisos.
--
-- ─────────────────────────────────────────────────────────────
-- 2 · Y LAS HORAS DE MÁS, CON SU HISTORIAL
--
-- Apuntarlas ya se podía desde el SQL 41. Lo que faltaba era poder
-- MIRARLAS: hoy solo se ve el total del mes y cuántos días. Eso vale
-- para saber que hay algo que pagar y no vale para cuadrarlo — «tres
-- horas en septiembre» no dice qué días fueron, y a fin de mes eso es
-- justo lo que hay que repasar juntos.
--
-- No hace falta ninguna tabla nueva: los datos están. Falta un índice
-- para poder pedirlos por mes sin recorrerlo todo, y la certeza de que
-- ella puede leer los suyos.
--
-- Se puede ejecutar más de una vez sin estropear nada.
-- ═══════════════════════════════════════════════════════════════


-- ── 1 · El dinero: quien ayuda ve el suyo ──────────────────
/*
  Se conserva TODO lo que ya había —el hogar y `puedo_ver_carpeta`— y
  se añade la condición del rol. Quitar cualquiera de las dos primeras
  para «simplificar» abriría una puerta que llevaba meses cerrada.

  `coalesce(mi_rol(), 'familia')` porque quien no tenga rol puesto
  todavía es de la familia: un permiso que se endurece solo porque
  falta un dato es un permiso que rompe cosas al azar.
*/
drop policy if exists movimientos_leer on movimientos;
create policy movimientos_leer on movimientos
  for select to authenticated using (
    hogar_id = mi_hogar()
    and puedo_ver_carpeta(categoria_id)
    and (
      coalesce(mi_rol(), 'familia') <> 'ayuda'
      or creado_por = auth.uid()
    )
  );

/*
  Y LO MISMO AL ESCRIBIR, QUE ES LA MITAD QUE SIEMPRE SE OLVIDA.

  Sin esto podría apuntar un gasto a nombre de otra persona — y luego
  no verlo, porque la política de arriba se lo escondería. Un apunte
  que existe, cuenta en el balance y su autora no puede ver es la peor
  clase de fallo: nadie lo encuentra hasta que las cuentas no cuadran.
*/
drop policy if exists movimientos_crear on movimientos;
create policy movimientos_crear on movimientos
  for insert to authenticated with check (
    hogar_id = mi_hogar()
    and puedo_escribir()
    and puedo_ver_carpeta(categoria_id)
    and (
      coalesce(mi_rol(), 'familia') <> 'ayuda'
      or creado_por = auth.uid()
    )
  );


-- ── 2 · Las horas de más, listas para mirar ────────────────
/*
  El índice es por casa y fecha descendente porque así se piden: «lo de
  este mes», «lo del mes pasado». Sin él, cada vez que se abra el
  historial se recorre la tabla entera — hoy son cuatro filas y dentro
  de dos años son mil.

  Solo las filas que tienen horas: los días normales no se apuntan (esa
  fue la decisión del SQL 41) pero puede haber filas con solo una nota,
  y ésas no interesan aquí.
*/
create index if not exists idx_dias_con_extra
  on dias_en_casa (hogar_id, fecha desc)
  where horas_extra is not null;

/*
  Que cada uno pueda leer los suyos.

  `dias_en_casa` puede tener ya sus políticas del SQL 40; se rehacen
  para dejar la regla explícita y en un solo sitio:

    · la familia ve los de toda la casa —hay que poder cuadrar el mes—
    · quien ayuda ve los suyos
    · y cada uno apunta los suyos, nunca los de otro
*/
alter table dias_en_casa enable row level security;

drop policy if exists dias_leer on dias_en_casa;
create policy dias_leer on dias_en_casa
  for select to authenticated using (
    hogar_id = mi_hogar()
    and (
      coalesce(mi_rol(), 'familia') <> 'ayuda'
      or quien = auth.uid()
    )
  );

/*
  Escribir: solo lo propio. Ni la familia apunta horas por ella ni ella
  por nadie. Las horas de alguien las cuenta ese alguien — si hay
  desacuerdo se habla, no se corrige por detrás.
*/
drop policy if exists dias_crear on dias_en_casa;
create policy dias_crear on dias_en_casa
  for insert to authenticated with check (
    hogar_id = mi_hogar() and quien = auth.uid()
  );

drop policy if exists dias_cambiar on dias_en_casa;
create policy dias_cambiar on dias_en_casa
  for update to authenticated
  using (hogar_id = mi_hogar() and quien = auth.uid())
  with check (hogar_id = mi_hogar() and quien = auth.uid());

drop policy if exists dias_borrar on dias_en_casa;
create policy dias_borrar on dias_en_casa
  for delete to authenticated using (
    hogar_id = mi_hogar() and quien = auth.uid()
  );


-- ── 3 · Comprobación ───────────────────────────────────────
/*
  `movimientos` tiene que salir con su política de leer nombrando
  `mi_rol`, y `dias_en_casa` con rls = true y 4 políticas.
*/
select
  cl.relname       as tabla,
  p.polname        as politica,
  case p.polcmd
    when 'r' then 'leer' when 'a' then 'crear'
    when 'w' then 'cambiar' when 'd' then 'borrar' else p.polcmd::text
  end              as para,
  position('mi_rol' in coalesce(pg_get_expr(p.polqual, p.polrelid), '')) > 0 as mira_el_rol
from pg_policy p
join pg_class cl on cl.oid = p.polrelid
where cl.relname in ('movimientos', 'dias_en_casa')
order by cl.relname, p.polcmd, p.polname;
