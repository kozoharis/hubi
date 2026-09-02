-- ───────────────────────────────────────────────────────────
--  UN TERCER USUARIO PARA MANTENIMIENTO
--
--  Haris entra en HUBI con su propio correo para poder comprobar que
--  todo funciona y arreglar lo que no, sin tener que pedirle prestada
--  la sesión a Juan Miguel.
--
--  ─────────────────────────────────────────────────────────
--  ANTES DE EJECUTAR ESTO HAY QUE CREAR EL USUARIO
--
--  Este archivo NO crea la cuenta: las cuentas se crean en
--  Authentication → Users → Add user. Aquí solo se le pone nombre,
--  color y se le mete en la casa.
--
--  Si no existe todavía, el script no rompe nada: avisa y no hace
--  nada. Se crea la cuenta y se vuelve a ejecutar.
--
--  ─────────────────────────────────────────────────────────
--  LO QUE ESTO SIGNIFICA DE VERDAD, DICHO CLARO
--
--  Ser miembro del hogar es ver TODO lo del hogar: las facturas, las
--  cuentas, la agenda — y los papeles de Salud de Juan Miguel y de
--  Conchita. HUBI no tiene permisos finos: o eres de la casa o no
--  eres. Esto no es un usuario "de solo lectura técnica", es un
--  tercer miembro con acceso completo.
--
--  Por eso se marca aparte con `es_tecnico`: para poder distinguirlo
--  el día que convenga que no aparezca como una persona más de la
--  familia en el calendario, en el tablón o al repartir tareas.
--
--  ─────────────────────────────────────────────────────────
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

-- ── 1 · Marca para distinguir a quien mantiene, de quien vive ──
/*
  Nace en false para todo el mundo, así que nada de lo que ya
  funcionaba cambia de comportamiento por añadirla. Ninguna consulta
  la exige todavía; existe para cuando haga falta.
*/
alter table perfiles
  add column if not exists es_tecnico boolean not null default false;


-- ── 2 · Ponerle nombre, color y meterlo en la casa ────────────
do $$
declare
  quien  uuid;
  casa   uuid;
begin
  select id into quien from auth.users
   where lower(email) = 'haris@weaversight.com'
   limit 1;

  if quien is null then
    raise notice '───────────────────────────────────────────────';
    raise notice 'FALTA CREAR LA CUENTA.';
    raise notice 'Authentication → Users → Add user';
    raise notice '   Email: haris@weaversight.com';
    raise notice '   Marcar "Auto Confirm User"';
    raise notice 'Y volver a ejecutar este archivo.';
    raise notice '───────────────────────────────────────────────';
    return;
  end if;

  /* El disparador de sql/01 ya le habrá hecho su perfil al crear la
     cuenta. Pero si por lo que sea no está, se crea aquí: mejor eso
     que fallar por una fila que se puede poner sola. */
  insert into perfiles (id, nombre, color, es_tecnico)
  values (quien, 'Haris', '#D97706', true)
  on conflict (id) do update
    set nombre     = 'Haris',
        color      = '#D97706',
        es_tecnico = true;

  /* A propósito NO se toca `es_propietario_drive`. El Drive y el
     calendario son de la cuenta de Juan Miguel, y poner a dos
     propietarios haría que la aplicación tuviera que elegir uno —y
     elegiría mal alguna vez. Mantener a un solo dueño del archivo es
     lo que hace que todo esto sea predecible. */

  -- La casa que ya existe. Sólo hay una.
  select id into casa from hogares order by creado_en limit 1;

  if casa is null then
    raise notice 'No hay ningún hogar. ¿Se ejecutó sql/17-hogares.sql?';
    return;
  end if;

  insert into miembros (hogar_id, perfil_id, papel)
  values (casa, quien, 'miembro')
  on conflict (hogar_id, perfil_id) do nothing;

  raise notice 'Listo: Haris ya es miembro de la casa.';
end $$;


-- ── 3 · Comprobación ──────────────────────────────────────────
/*
  Tienen que salir TRES filas, y las tres con su casa puesta. Si
  alguna sale sin hogar, esa persona no verá absolutamente nada al
  entrar — que es el fallo más desconcertante que puede dar HUBI.
*/
select
  p.nombre,
  u.email,
  p.color,
  p.es_tecnico          as mantenimiento,
  p.es_propietario_drive as dueno_del_drive,
  h.nombre              as casa,
  m.papel
from perfiles p
join auth.users u on u.id = p.id
left join miembros m on m.perfil_id = p.id
left join hogares  h on h.id = m.hogar_id
order by p.creado_en;
