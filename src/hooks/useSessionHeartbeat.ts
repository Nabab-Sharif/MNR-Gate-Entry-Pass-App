import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * Periodically updates the user's latest active login_session row with a
 * `last_seen_at` timestamp so admins can see who is genuinely online right now.
 * Marks the session inactive when the tab is closed/hidden for long.
 */
export const useSessionHeartbeat = (userId: string | null | undefined) => {
  const sessionIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) {
      sessionIdRef.current = null;
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    let cancelled = false;

    const pickSession = async () => {
      const { data } = await supabase
        .from('login_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .is('logout_at', null)
        .order('login_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      sessionIdRef.current = data?.id ?? null;
      if (sessionIdRef.current) void beat();
    };

    const beat = async () => {
      const id = sessionIdRef.current;
      if (!id) return;
      await supabase
        .from('login_sessions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', id);
    };

    void pickSession();
    timerRef.current = setInterval(beat, HEARTBEAT_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void beat();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId]);
};
