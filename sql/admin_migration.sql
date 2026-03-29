-- ============================================================
-- CalTrack — Migration Admin
-- À exécuter dans Supabase Dashboard > SQL Editor
-- ============================================================

-- ── 1. Colonne is_admin sur profiles ─────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- ── 2. Pour définir le premier admin, exécutez :
-- UPDATE profiles SET is_admin = true WHERE id = '<votre-user-id>';
-- (Trouvez votre user id dans Supabase Dashboard > Authentication > Users)

-- ── 3. Fonction : lister tous les utilisateurs (admin seulement) ──
CREATE OR REPLACE FUNCTION get_all_profiles()
RETURNS TABLE(
  id          UUID,
  full_name   TEXT,
  email       TEXT,
  daily_calories INTEGER,
  is_admin    BOOLEAN,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    u.email::TEXT,
    p.daily_calories,
    p.is_admin,
    u.created_at
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY u.created_at DESC;
END;
$$;

-- ── 4. Fonction : stats repas par utilisateur (admin seulement) ──
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS TABLE(user_id UUID, meal_count BIGINT, last_meal TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  RETURN QUERY
  SELECT m.user_id, COUNT(m.id)::BIGINT, MAX(m.eaten_at)
  FROM meals m
  GROUP BY m.user_id;
END;
$$;

-- ── 5. Fonction : supprimer un défi (admin seulement) ────────
CREATE OR REPLACE FUNCTION admin_delete_challenge(p_challenge_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  DELETE FROM challenges WHERE id = p_challenge_id;
END;
$$;

-- ── 6. Fonction : toggle admin sur un utilisateur ────────────
CREATE OR REPLACE FUNCTION admin_toggle_admin(p_user_id UUID, p_value BOOLEAN)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true
  ) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  -- Empêcher de se retirer ses propres droits
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas modifier vos propres droits admin';
  END IF;

  UPDATE profiles SET is_admin = p_value WHERE id = p_user_id;
END;
$$;
