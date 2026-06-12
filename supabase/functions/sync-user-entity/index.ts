import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing backend secrets');
    }

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { table, entityId, role, officeId, name, email } = body as {
      table: 'gates' | 'stores' | 'departments';
      entityId: string;
      role: 'gate' | 'store' | 'department';
      officeId: string;
      name?: string;
      email?: string;
    };

    if (!['gates', 'stores', 'departments'].includes(table) || !['gate', 'store', 'department'].includes(role)) {
      throw new Error('Invalid entity payload');
    }

    const { error: linkError } = await admin
      .from(table)
      .update({ user_id: authData.user.id })
      .eq('id', entityId)
      .eq('office_id', officeId);

    if (linkError) throw linkError;

    const { error: profileError } = await admin.from('profiles').upsert(
      {
        user_id: authData.user.id,
        name: name ?? null,
        email: email ?? null,
      },
      { onConflict: 'user_id' },
    );

    if (profileError) throw profileError;

    const roleInsert = await admin.from('user_roles').insert({
      user_id: authData.user.id,
      role,
    });

    if (roleInsert.error && roleInsert.error.code !== '23505') {
      throw roleInsert.error;
    }

    return new Response(JSON.stringify({ success: true, user_id: authData.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
