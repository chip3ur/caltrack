-- ============================================================
-- CalTrack — Phase 1 : Système Coach / Élève
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. RÔLES SUR PROFILES ────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'athlete' CHECK (role IN ('coach', 'athlete'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ── 2. INVITATIONS COACH → ÉLÈVE ─────────────────────────────
-- Un coach génère un code unique, l'élève s'inscrit avec ce code
CREATE TABLE IF NOT EXISTS coach_invites (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  code        TEXT        NOT NULL UNIQUE,
  email       TEXT,                          -- optionnel : invitation ciblée
  used        BOOLEAN     DEFAULT false,
  used_by     UUID        REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);
ALTER TABLE coach_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coach manages invites" ON coach_invites;
CREATE POLICY "Coach manages invites" ON coach_invites
  FOR ALL USING (auth.uid() = coach_id);
DROP POLICY IF EXISTS "Anyone reads invite by code" ON coach_invites;
CREATE POLICY "Anyone reads invite by code" ON coach_invites
  FOR SELECT USING (true);

-- ── 3. LIAISON COACH ↔ ÉLÈVE ─────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_athletes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  athlete_id  UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  active      BOOLEAN     DEFAULT true,
  UNIQUE(coach_id, athlete_id)
);
ALTER TABLE coach_athletes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coach sees their athletes" ON coach_athletes;
CREATE POLICY "Coach sees their athletes" ON coach_athletes
  FOR ALL USING (auth.uid() = coach_id);
DROP POLICY IF EXISTS "Athlete sees their coach" ON coach_athletes;
CREATE POLICY "Athlete sees their coach" ON coach_athletes
  FOR SELECT USING (auth.uid() = athlete_id);

-- ── 4. BIBLIOTHÈQUE D'EXERCICES ──────────────────────────────
CREATE TABLE IF NOT EXISTS exercises (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  name          TEXT        NOT NULL,
  description   TEXT,
  instructions  TEXT,
  video_url     TEXT,
  muscles       TEXT[],     -- ex: ['quadriceps', 'glutes']
  category      TEXT        DEFAULT 'strength' CHECK (category IN ('strength', 'cardio', 'mobility', 'sport')),
  is_public     BOOLEAN     DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public exercises readable by all" ON exercises;
CREATE POLICY "Public exercises readable by all" ON exercises
  FOR SELECT USING (is_public = true OR auth.uid() = created_by);
DROP POLICY IF EXISTS "Coach creates exercises" ON exercises;
CREATE POLICY "Coach creates exercises" ON exercises
  FOR INSERT WITH CHECK (auth.uid() = created_by);
DROP POLICY IF EXISTS "Creator updates exercises" ON exercises;
CREATE POLICY "Creator updates exercises" ON exercises
  FOR UPDATE USING (auth.uid() = created_by);
DROP POLICY IF EXISTS "Creator deletes exercises" ON exercises;
CREATE POLICY "Creator deletes exercises" ON exercises
  FOR DELETE USING (auth.uid() = created_by);

-- ── 5. PROGRAMMES D'ENTRAÎNEMENT ─────────────────────────────
CREATE TABLE IF NOT EXISTS programs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  is_template BOOLEAN     DEFAULT false,   -- programme réutilisable
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coach manages programs" ON programs;
CREATE POLICY "Coach manages programs" ON programs
  FOR ALL USING (auth.uid() = coach_id);
-- NOTE: "Athlete reads assigned programs" est ajoutée après la création de program_assignments (section 7)

-- ── 6. EXERCICES DANS UN PROGRAMME ───────────────────────────
CREATE TABLE IF NOT EXISTS program_exercises (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id   UUID        REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  exercise_id  UUID        REFERENCES exercises(id) ON DELETE CASCADE NOT NULL,
  day_number   INTEGER     NOT NULL DEFAULT 1,  -- jour du programme
  sets         INTEGER     DEFAULT 3,
  reps         TEXT        DEFAULT '8-12',       -- ex: '8-12' ou '10'
  rest_seconds INTEGER     DEFAULT 90,
  notes        TEXT,
  order_index  INTEGER     DEFAULT 0,
  UNIQUE(program_id, exercise_id, day_number)
);
ALTER TABLE program_exercises ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coach manages program exercises" ON program_exercises;
CREATE POLICY "Coach manages program exercises" ON program_exercises
  FOR ALL USING (
    program_id IN (SELECT id FROM programs WHERE coach_id = auth.uid())
  );
-- NOTE: "Athlete reads program exercises" est ajoutée après la création de program_assignments (section 7)

-- ── 7. ASSIGNATION PROGRAMME → ÉLÈVE ─────────────────────────
CREATE TABLE IF NOT EXISTS program_assignments (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id   UUID        REFERENCES programs(id) ON DELETE CASCADE NOT NULL,
  athlete_id   UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  coach_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  start_date   DATE        DEFAULT CURRENT_DATE,
  end_date     DATE,
  active       BOOLEAN     DEFAULT true,
  assigned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, athlete_id)
);
ALTER TABLE program_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coach manages assignments" ON program_assignments;
CREATE POLICY "Coach manages assignments" ON program_assignments
  FOR ALL USING (auth.uid() = coach_id);
DROP POLICY IF EXISTS "Athlete reads own assignments" ON program_assignments;
CREATE POLICY "Athlete reads own assignments" ON program_assignments
  FOR SELECT USING (auth.uid() = athlete_id);

-- Politiques dépendant de program_assignments (ajoutées ici)
DROP POLICY IF EXISTS "Athlete reads program exercises" ON program_exercises;
CREATE POLICY "Athlete reads program exercises" ON program_exercises
  FOR SELECT USING (
    program_id IN (
      SELECT program_id FROM program_assignments WHERE athlete_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Athlete reads assigned programs" ON programs;
CREATE POLICY "Athlete reads assigned programs" ON programs
  FOR SELECT USING (
    id IN (
      SELECT program_id FROM program_assignments WHERE athlete_id = auth.uid()
    )
  );

-- ── 8. SÉANCES (WORKOUT LOGS) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS workout_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id   UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_id   UUID        REFERENCES programs(id) ON DELETE SET NULL,
  day_number   INTEGER,
  date         DATE        DEFAULT CURRENT_DATE,
  duration_min INTEGER,
  rpe          INTEGER     CHECK (rpe BETWEEN 1 AND 10),  -- difficulté globale
  notes        TEXT,
  completed    BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Athlete manages own logs" ON workout_logs;
CREATE POLICY "Athlete manages own logs" ON workout_logs
  FOR ALL USING (auth.uid() = athlete_id);
DROP POLICY IF EXISTS "Coach reads athlete logs" ON workout_logs;
CREATE POLICY "Coach reads athlete logs" ON workout_logs
  FOR SELECT USING (
    athlete_id IN (
      SELECT athlete_id FROM coach_athletes WHERE coach_id = auth.uid() AND active = true
    )
  );

-- ── 9. SETS PAR EXERCICE (CHARGES / REPS) ────────────────────
CREATE TABLE IF NOT EXISTS workout_sets (
  id           UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  log_id       UUID           REFERENCES workout_logs(id) ON DELETE CASCADE NOT NULL,
  exercise_id  UUID           REFERENCES exercises(id) ON DELETE CASCADE NOT NULL,
  set_number   INTEGER        NOT NULL,
  reps         INTEGER,
  weight_kg    NUMERIC(6,2),  -- charge en kg
  duration_sec INTEGER,       -- pour cardio/gainage
  rpe          INTEGER        CHECK (rpe BETWEEN 1 AND 10),
  is_pr        BOOLEAN        DEFAULT false,  -- record personnel auto-détecté
  created_at   TIMESTAMPTZ    DEFAULT NOW()
);
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Athlete manages own sets" ON workout_sets;
CREATE POLICY "Athlete manages own sets" ON workout_sets
  FOR ALL USING (
    log_id IN (SELECT id FROM workout_logs WHERE athlete_id = auth.uid())
  );
DROP POLICY IF EXISTS "Coach reads athlete sets" ON workout_sets;
CREATE POLICY "Coach reads athlete sets" ON workout_sets
  FOR SELECT USING (
    log_id IN (
      SELECT wl.id FROM workout_logs wl
      JOIN coach_athletes ca ON ca.athlete_id = wl.athlete_id
      WHERE ca.coach_id = auth.uid() AND ca.active = true
    )
  );

-- ── 10. MESSAGERIE COACH ↔ ÉLÈVE ─────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id  UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content      TEXT        NOT NULL,
  read         BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their messages" ON messages;
CREATE POLICY "Users manage their messages" ON messages
  FOR ALL USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ── 11. FONCTION : ACCEPTER UNE INVITATION ───────────────────
CREATE OR REPLACE FUNCTION accept_coach_invite(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invite  coach_invites%ROWTYPE;
  v_athlete UUID := auth.uid();
BEGIN
  SELECT * INTO v_invite FROM coach_invites
  WHERE code = p_code AND used = false AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Code invalide ou expiré');
  END IF;

  -- Marquer l'invite comme utilisée
  UPDATE coach_invites SET used = true, used_by = v_athlete WHERE id = v_invite.id;

  -- Créer la liaison coach-élève
  INSERT INTO coach_athletes (coach_id, athlete_id)
  VALUES (v_invite.coach_id, v_athlete)
  ON CONFLICT (coach_id, athlete_id) DO UPDATE SET active = true;

  RETURN jsonb_build_object('success', true, 'coach_id', v_invite.coach_id);
END;
$$;

-- ── 12. FONCTION : RECORDS PERSONNELS PAR EXERCICE ───────────
CREATE OR REPLACE FUNCTION get_exercise_prs(p_athlete_id UUID)
RETURNS TABLE(exercise_id UUID, exercise_name TEXT, max_weight NUMERIC, best_reps INTEGER, achieved_at DATE)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Vérifier que l'appelant est l'athlète ou son coach
  IF p_athlete_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM coach_athletes
    WHERE coach_id = auth.uid() AND athlete_id = p_athlete_id AND active = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT
    ws.exercise_id,
    e.name,
    MAX(ws.weight_kg),
    (array_agg(ws.reps ORDER BY ws.weight_kg DESC NULLS LAST))[1],
    MAX(wl.date)
  FROM workout_sets ws
  JOIN workout_logs wl ON wl.id = ws.log_id
  JOIN exercises e ON e.id = ws.exercise_id
  WHERE wl.athlete_id = p_athlete_id AND ws.weight_kg IS NOT NULL
  GROUP BY ws.exercise_id, e.name
  ORDER BY e.name;
END;
$$;

-- ── 13. FONCTION : PROGRESSION PAR EXERCICE (GRAPHIQUE) ──────
CREATE OR REPLACE FUNCTION get_exercise_progression(p_athlete_id UUID, p_exercise_id UUID)
RETURNS TABLE(session_date DATE, max_weight NUMERIC, total_volume NUMERIC, avg_rpe NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_athlete_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM coach_athletes
    WHERE coach_id = auth.uid() AND athlete_id = p_athlete_id AND active = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT
    wl.date,
    MAX(ws.weight_kg),
    SUM(ws.weight_kg * ws.reps),  -- volume total
    ROUND(AVG(ws.rpe::NUMERIC), 1)
  FROM workout_sets ws
  JOIN workout_logs wl ON wl.id = ws.log_id
  WHERE wl.athlete_id = p_athlete_id AND ws.exercise_id = p_exercise_id
  GROUP BY wl.date
  ORDER BY wl.date ASC;
END;
$$;

-- ── 14. EXERCICES DE BASE (SEED) ─────────────────────────────
INSERT INTO exercises (name, category, muscles, instructions, is_public, created_by) VALUES
  ('Squat', 'strength', ARRAY['quadriceps','glutes','hamstrings'], 'Pieds écartés à la largeur des épaules, descendre jusqu''à ce que les cuisses soient parallèles au sol.', true, NULL),
  ('Développé couché', 'strength', ARRAY['pectoraux','triceps','deltoïdes'], 'Allongé sur le banc, descendre la barre jusqu''à la poitrine puis pousser.', true, NULL),
  ('Soulevé de terre', 'strength', ARRAY['ischio-jambiers','dos','glutes'], 'Dos droit, attraper la barre et se relever en poussant avec les jambes.', true, NULL),
  ('Tractions', 'strength', ARRAY['dorsaux','biceps'], 'Barre au-dessus, tirer jusqu''au menton en gardant les épaules basses.', true, NULL),
  ('Développé militaire', 'strength', ARRAY['deltoïdes','triceps'], 'Debout ou assis, pousser la barre au-dessus de la tête.', true, NULL),
  ('Fentes', 'strength', ARRAY['quadriceps','glutes'], 'Un pied en avant, descendre le genou arrière vers le sol.', true, NULL),
  ('Gainage', 'strength', ARRAY['abdominaux','lombaires'], 'En appui sur les avant-bras et les orteils, corps aligné, tenir la position.', true, NULL),
  ('Burpees', 'cardio', ARRAY['full body'], 'Enchaîner flexion, planche, pompe, saut.', true, NULL),
  ('Course', 'cardio', ARRAY['cardio'], 'Footing ou sprint selon intensité voulue.', true, NULL),
  ('Rowing barre', 'strength', ARRAY['dorsaux','biceps','rhomboïdes'], 'Dos incliné, tirer la barre vers le ventre en serrant les omoplates.', true, NULL)
ON CONFLICT DO NOTHING;
