-- ============================================================
-- CalTrack — Fonctions supplémentaires Phase 1
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

-- Fonction : liste des élèves d'un coach avec stats
CREATE OR REPLACE FUNCTION get_coach_athletes()
RETURNS TABLE(
  id          UUID,
  full_name   TEXT,
  email       TEXT,
  daily_calories INTEGER,
  joined_at   TIMESTAMPTZ,
  workout_count BIGINT,
  last_workout  DATE
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    u.email::TEXT,
    p.daily_calories,
    ca.joined_at,
    COUNT(DISTINCT wl.id),
    MAX(wl.date)
  FROM coach_athletes ca
  JOIN profiles p ON p.id = ca.athlete_id
  JOIN auth.users u ON u.id = ca.athlete_id
  LEFT JOIN workout_logs wl ON wl.athlete_id = ca.athlete_id
  WHERE ca.coach_id = auth.uid() AND ca.active = true
  GROUP BY p.id, p.full_name, u.email, p.daily_calories, ca.joined_at
  ORDER BY ca.joined_at DESC;
END;
$$;
