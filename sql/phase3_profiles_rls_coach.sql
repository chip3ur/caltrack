-- ============================================================
-- CalTrack — Phase 3 : Accès coach au profil de ses élèves
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

-- Permettre au coach de lire le profil de ses élèves
-- (sans ça, supabase.from('profiles').select(...).eq('id', athleteId)
--  retourne null quand c'est un coach qui fait la requête)
DROP POLICY IF EXISTS "Coach reads athlete profiles" ON profiles;
CREATE POLICY "Coach reads athlete profiles" ON profiles
  FOR SELECT USING (
    id IN (
      SELECT athlete_id FROM coach_athletes
      WHERE coach_id = auth.uid() AND active = true
    )
  );
