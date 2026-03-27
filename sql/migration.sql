-- ============================================================
-- CalTrack — Migration nouvelles fonctionnalités
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. EAU ──────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS water_goal_ml INTEGER DEFAULT 2000;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notif_noon BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS water_logs (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount_ml  INTEGER     NOT NULL,
  logged_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their water logs" ON water_logs;
CREATE POLICY "Users manage their water logs" ON water_logs
  FOR ALL USING (auth.uid() = user_id);

-- ── 2. REPAS FAVORIS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorite_meals (
  id          UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID           REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  food_name   TEXT           NOT NULL,
  calories    INTEGER        NOT NULL,
  protein_g   NUMERIC(5,1)   DEFAULT 0,
  carbs_g     NUMERIC(5,1)   DEFAULT 0,
  fat_g       NUMERIC(5,1)   DEFAULT 0,
  quantity_g  INTEGER        DEFAULT 100,
  meal_type   TEXT           DEFAULT 'dejeuner',
  created_at  TIMESTAMPTZ    DEFAULT NOW()
);
ALTER TABLE favorite_meals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their favorites" ON favorite_meals;
CREATE POLICY "Users manage their favorites" ON favorite_meals
  FOR ALL USING (auth.uid() = user_id);

-- ── 3. PLANS DE REPAS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_plans (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their meal plans" ON meal_plans;
CREATE POLICY "Users manage their meal plans" ON meal_plans
  FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS meal_plan_items (
  id          UUID           DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id     UUID           REFERENCES meal_plans(id) ON DELETE CASCADE NOT NULL,
  food_name   TEXT           NOT NULL,
  quantity_g  INTEGER        DEFAULT 100,
  calories    INTEGER        NOT NULL,
  protein_g   NUMERIC(5,1)   DEFAULT 0,
  carbs_g     NUMERIC(5,1)   DEFAULT 0,
  fat_g       NUMERIC(5,1)   DEFAULT 0,
  meal_type   TEXT           DEFAULT 'dejeuner'
);
ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage their plan items" ON meal_plan_items;
CREATE POLICY "Users manage their plan items" ON meal_plan_items
  FOR ALL USING (
    plan_id IN (SELECT id FROM meal_plans WHERE user_id = auth.uid())
  );

-- ── 4. PHOTO SUR LES REPAS ──────────────────────────────────
ALTER TABLE meals ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ── 5. DÉFIS / CHALLENGES ───────────────────────────────────
CREATE TABLE IF NOT EXISTS challenges (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id  UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       TEXT        NOT NULL,
  goal_type   TEXT        NOT NULL DEFAULT 'streak', -- 'streak' | 'calories'
  target_days INTEGER     DEFAULT 7,
  start_date  DATE        DEFAULT CURRENT_DATE,
  end_date    DATE        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read challenges" ON challenges;
DROP POLICY IF EXISTS "Users create challenges" ON challenges;
DROP POLICY IF EXISTS "Creators update challenges" ON challenges;
CREATE POLICY "Anyone can read challenges"   ON challenges FOR SELECT USING (true);
CREATE POLICY "Users create challenges"      ON challenges FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Creators update challenges"   ON challenges FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Creators delete challenges"   ON challenges FOR DELETE USING (auth.uid() = creator_id);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id  UUID        REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name  TEXT        NOT NULL DEFAULT 'Anonyme',
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, user_id)
);
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage participations" ON challenge_participants;
DROP POLICY IF EXISTS "Anyone reads participants" ON challenge_participants;
CREATE POLICY "Users manage participations" ON challenge_participants
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Anyone reads participants"   ON challenge_participants FOR SELECT USING (true);

-- ── 6. FONCTION LEADERBOARD (SECURITY DEFINER) ──────────────
CREATE OR REPLACE FUNCTION get_challenge_progress(p_challenge_id UUID)
RETURNS TABLE(display_name TEXT, days_logged BIGINT)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_start DATE;
  v_end   DATE;
BEGIN
  SELECT start_date, end_date INTO v_start, v_end
  FROM challenges WHERE id = p_challenge_id;

  RETURN QUERY
  SELECT
    cp.display_name,
    COUNT(DISTINCT (m.eaten_at AT TIME ZONE 'UTC')::DATE)
  FROM challenge_participants cp
  LEFT JOIN meals m
    ON m.user_id = cp.user_id
    AND (m.eaten_at AT TIME ZONE 'UTC')::DATE BETWEEN v_start AND v_end
  WHERE cp.challenge_id = p_challenge_id
  GROUP BY cp.display_name, cp.user_id
  ORDER BY COUNT(DISTINCT (m.eaten_at AT TIME ZONE 'UTC')::DATE) DESC;
END;
$$;

-- ── 7. STOCKAGE PHOTOS ──────────────────────────────────────
-- À faire manuellement dans Supabase Dashboard > Storage :
--   1. Cliquer "New bucket"
--   2. Nom : meal-photos
--   3. Cocher "Public bucket"
--   4. Sauvegarder
