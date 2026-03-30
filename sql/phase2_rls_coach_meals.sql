-- ============================================================
-- CalTrack — Phase 2 : Accès coach aux données de ses élèves
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

-- Permettre au coach de lire les repas de ses élèves
DROP POLICY IF EXISTS "Coach reads athlete meals" ON meals;
CREATE POLICY "Coach reads athlete meals" ON meals
  FOR SELECT USING (
    user_id IN (
      SELECT athlete_id FROM coach_athletes
      WHERE coach_id = auth.uid() AND active = true
    )
  );

-- Permettre au coach de lire les pesées de ses élèves
DROP POLICY IF EXISTS "Coach reads athlete weight logs" ON weight_logs;
CREATE POLICY "Coach reads athlete weight logs" ON weight_logs
  FOR SELECT USING (
    user_id IN (
      SELECT athlete_id FROM coach_athletes
      WHERE coach_id = auth.uid() AND active = true
    )
  );

-- Fonction : historique repas d'un élève (pour le coach)
CREATE OR REPLACE FUNCTION get_athlete_meals(p_athlete_id UUID)
RETURNS TABLE(
  id UUID, food_name TEXT, calories INTEGER,
  meal_type TEXT, quantity_g INTEGER,
  protein_g NUMERIC, carbs_g NUMERIC, fat_g NUMERIC,
  eaten_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Vérifier que l'appelant est le coach de cet athlète
  IF NOT EXISTS (
    SELECT 1 FROM coach_athletes
    WHERE coach_id = auth.uid() AND athlete_id = p_athlete_id AND active = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT m.id, m.food_name, m.calories, m.meal_type,
         m.quantity_g, m.protein_g, m.carbs_g, m.fat_g, m.eaten_at
  FROM meals m
  WHERE m.user_id = p_athlete_id
  ORDER BY m.eaten_at DESC
  LIMIT 200;
END;
$$;
