-- ═══════════════════════════════════════════════════════════════
-- 50 · LOS PRIMEROS PASOS
-- ═══════════════════════════════════════════════════════════════
--
-- Una tabla de cuatro columnas para una tarjeta que desaparece sola.
--
-- ─────────────────────────────────────────────────────────────
-- POR QUÉ HACE FALTA, SI CASI TODO SE PODÍA SABER YA
--
-- La tarjeta de «Primeros pasos» se tacha sola: cada paso se marca
-- cuando la persona lo hace de verdad, no cuando ve un vídeo. Y tres
-- de los cuatro pasos ya se pueden saber de lo que hay:
--
--     guardar un papel   ->  documentos.subido_por
--     apuntar en agenda  ->  recordatorios.creado_por
--     dejar una nota     ->  notas.escrita_por
--
-- El cuarto, HABLARLE, no deja rastro en ninguna parte. Una consulta
-- por voz no escribe nada, y un recordatorio dictado es idéntico a
-- uno escrito a mano.
--
-- Se podría haber cambiado el paso por otro que sí se supiera. Pero
-- hablar es la mitad de lo que HUBI promete —hablar, fotografiar,
-- consultar— y dejarlo fuera de los primeros pasos sería enseñar el
-- producto sin su mejor parte.
--
-- ─────────────────────────────────────────────────────────────
-- Y GENERAL, NO SOLO PARA LA VOZ
--
-- La tabla guarda «paso» como texto en vez de una columna por paso.
-- El día que los primeros pasos sean otros —o haya un segundo grupo
-- de pasos para quien ayuda en casa— no hace falta tocar el esquema.

create table if not exists pasos_dados (
  perfil_id uuid not null references perfiles(id) on delete cascade,
  paso      text not null,
  cuando    timestamptz not null default now(),
  primary key (perfil_id, paso)
);

alter table pasos_dados enable row level security;

-- Cada uno los suyos, y solo los suyos. Aquí no hay nada que
-- compartir: que Conchita haya hablado con HUBI no es asunto de nadie
-- más, y desde luego no del asesor.
drop policy if exists pasos_leer on pasos_dados;
create policy pasos_leer on pasos_dados
  for select to authenticated using (perfil_id = auth.uid());

drop policy if exists pasos_crear on pasos_dados;
create policy pasos_crear on pasos_dados
  for insert to authenticated with check (perfil_id = auth.uid());

drop policy if exists pasos_borrar on pasos_dados;
create policy pasos_borrar on pasos_dados
  for delete to authenticated using (perfil_id = auth.uid());

-- ── Comprobación ───────────────────────────────────────────
-- Debe salir la tabla con 0 filas y las tres políticas.
select 'pasos_dados' as tabla, count(*) as filas from pasos_dados;
select policyname from pg_policies where tablename = 'pasos_dados' order by policyname;
