-- ───────────────────────────────────────────────────────────
--  LA LISTA DE LA COMPRA
--
--  Es la nota de la nevera. Conchita apunta "leche" desde la cocina y
--  Juan Miguel lo ve en el súper. Nada más — y por eso es lo que más
--  se va a usar de todo HUBI: un papel se guarda una vez por semana,
--  la compra es todos los días.
--
--  TABLA PROPIA, Y ESTO ES LO IMPORTANTE.
--
--  Lo natural habría sido meter cada artículo en `recordatorios`: ya
--  existe, ya tiene "hecho", ya se sincroniza. Y habría sido un error
--  de los que no se ven hasta que es tarde:
--
--  - Veinte líneas de "leche", "pan" y "huevos" en la Agenda ENTIERRAN
--    la cita del médico. Se rompe la pantalla que hoy funciona para
--    ganar una que aún no existe.
--  - Los avisos sonarían una vez por artículo, hasta que los silencien
--    — y con ellos, los que sí importan.
--  - Y "hecho" sobre la leche no significa lo mismo que "hecho" sobre
--    llevar los papeles a Silvia. Una lista se tacha; una tarea se
--    cumple.
--
--  Aquí no hay fecha, ni a quién le toca, ni aviso previo. Un artículo
--  de la compra no tiene nada de eso, y ponerlo sería pedir cuatro
--  decisiones para apuntar "pan".
--
--  NO SE BORRA AL COMPRARLO. Se marca. Así se puede destachar lo que
--  se tachó sin querer —que con el móvil en una mano y el carro en la
--  otra pasa— y así HUBI sabe qué compráis a menudo para ofrecerlo
--  luego sin que nadie lo escriba.
--
--  Se puede ejecutar más de una vez sin estropear nada.
-- ───────────────────────────────────────────────────────────

create table if not exists compra (
  id           uuid primary key default gen_random_uuid(),

  -- Lo que hay que comprar, tal y como se dijo: "leche", "pan de
  -- molde", "algo para la cena del domingo".
  que          text not null check (length(trim(que)) > 0),

  -- "2 kg", "una docena", "el grande". Texto libre y opcional: en
  -- una lista de la compra la cantidad se dice como se dice.
  cantidad     text,

  comprado     boolean not null default false,
  comprado_en  timestamptz,
  comprado_por uuid references perfiles(id),

  anadido_por  uuid not null references perfiles(id),
  creado_en    timestamptz not null default now(),

  /* Cuando se pulsa "Ya he comprado", lo tachado no se borra: se
     archiva. Deja de verse en la lista y sigue contando para saber
     qué compráis a menudo. */
  archivado_en timestamptz
);

create index if not exists idx_compra_pendiente
  on compra (creado_en) where archivado_en is null;

create index if not exists idx_compra_que
  on compra (lower(que));

alter table compra enable row level security;

/*
  LAS CUATRO POLÍTICAS, Y LA DE BORRAR TAMBIÉN.

  En este proyecto ya pasó una vez: las tablas se crearon con leer,
  crear y editar, y sin la de borrar. Y un borrado sin política NO DA
  ERROR — borra cero filas y dice que todo ha ido bien. Costó una
  tarde entera encontrarlo.

  La compra es de los dos, entera: cualquiera apunta, cualquiera tacha,
  cualquiera quita. Si Conchita apunta "pan" y ya lo hay en casa, Juan
  Miguel tiene que poder quitarlo sin pedir permiso.
*/
drop policy if exists compra_leer on compra;
create policy compra_leer on compra
  for select to authenticated using (true);

drop policy if exists compra_crear on compra;
create policy compra_crear on compra
  for insert to authenticated with check (anadido_por = auth.uid());

drop policy if exists compra_editar on compra;
create policy compra_editar on compra
  for update to authenticated using (true);

drop policy if exists compra_borrar on compra;
create policy compra_borrar on compra
  for delete to authenticated using (true);
