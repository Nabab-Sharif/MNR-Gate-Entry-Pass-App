ALTER TABLE public.login_sessions
  ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_login_sessions_last_seen ON public.login_sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_sessions_user_active ON public.login_sessions(user_id, is_active);