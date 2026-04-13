-- Script para limpiar toda la base de datos de contenido narrativo y sesiones
-- Actualizado sin las tablas opcionales eliminadas en la migración 008

BEGIN;

-- TRUNCATE limpiará estas tablas. 
-- CASCADE asegurará que cualquier tabla que dependa de estas también sea limpiada.
TRUNCATE TABLE 
    user_metrics_aggregated,
    risk_events,
    clinical_mappings,
    session_scores,
    decision_ratings,
    decision_audit,
    decisions,
    sessions,
    options,
    scenes,
    chapters,
    narrative_cache_events,
    narrative_path_cache,
    arc_transitions,
    arc_days,
    arc_weeks
CASCADE;

COMMIT;
