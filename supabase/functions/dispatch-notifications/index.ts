import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const jsonResponse = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return 'Unexpected error';
};

const getErrorDetails = (error: unknown) => {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }

  try {
    return JSON.parse(JSON.stringify(error));
  } catch {
    return { value: String(error) };
  }
};

type EntityTable = 'departments' | 'stores' | 'gates';

interface NotificationTarget {
  table: EntityTable;
  id: string;
}

const sanitizeLoginId = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const buildSyntheticEmail = (role: 'department' | 'store' | 'gate', code: string) => `${role}_${sanitizeLoginId(code)}@mnrgroup.com`;

const tableConfig: Record<EntityTable, { role: 'department' | 'store' | 'gate'; codeColumn: string }> = {
  departments: { role: 'department', codeColumn: 'department_code' },
  stores: { role: 'store', codeColumn: 'store_code' },
  gates: { role: 'gate', codeColumn: 'gate_code' },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing backend secrets');
    }

    if (!authHeader) {
      return jsonResponse({ error: 'Missing authorization header', fallback: true }, 401);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: authData, error: authError } = await admin.auth.getUser(token);

    if (authError || !authData.user) {
      return jsonResponse({ error: 'Unauthorized', fallback: true }, 401);
    }

    const body = await req.json();
    const {
      officeId,
      title,
      message,
      type = 'info',
      relatedProductId = null,
      relatedGatePassId = null,
      targetEntityIds,
    } = body as {
      officeId: string;
      title: string;
      message: string;
      type?: string;
      relatedProductId?: string | null;
      relatedGatePassId?: string | null;
      targetEntityIds: NotificationTarget[];
    };

    console.log('dispatch-notifications payload received', {
      officeId,
      type,
      targetCount: Array.isArray(targetEntityIds) ? targetEntityIds.length : 0,
      relatedProductId,
      relatedGatePassId,
      senderUserId: authData.user.id,
    });

    if (!officeId || !title || !message || !Array.isArray(targetEntityIds)) {
      return jsonResponse({ error: 'Invalid payload', fallback: true }, 400);
    }

    const { data: userListData, error: userListError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (userListError) throw userListError;

    const usersByEmail = new Map(
      (userListData.users || [])
        .filter((user) => user.email)
        .map((user) => [user.email!.toLowerCase(), user.id]),
    );

    const userIds = new Set<string>();
    const unresolvedTargets: NotificationTarget[] = [];

    const ensureEntityRecipient = async (
      target: NotificationTarget,
      entity: Record<string, any>,
      role: 'department' | 'store' | 'gate',
      codeColumn: string,
    ) => {
      const rawCode = entity[codeColumn] ? String(entity[codeColumn]) : '';
      if (!rawCode) {
        return entity.user_id ?? null;
      }

      const expectedEmail = buildSyntheticEmail(role, rawCode);
      let resolvedUserId = entity.user_id ?? usersByEmail.get(expectedEmail) ?? null;

      if (!resolvedUserId) {
        const { data: createdUserData, error: createUserError } = await admin.auth.admin.createUser({
          email: expectedEmail,
          password: rawCode,
          email_confirm: true,
          user_metadata: {
            name: entity.name ?? null,
            role,
            office_id: entity.office_id,
            entity_id: entity.id,
          },
        });

        if (createUserError) {
          console.error('Failed to create notification recipient user', {
            target,
            expectedEmail,
            error: createUserError.message,
          });
          return null;
        }

        resolvedUserId = createdUserData.user?.id ?? null;
        if (resolvedUserId) {
          usersByEmail.set(expectedEmail, resolvedUserId);
        }
      }

      if (!resolvedUserId) {
        return null;
      }

      if (entity.user_id !== resolvedUserId) {
        const { error: linkError } = await admin.from(target.table).update({ user_id: resolvedUserId }).eq('id', entity.id);
        if (linkError) throw linkError;
      }

      const { error: profileError } = await admin.from('profiles').upsert(
        {
          user_id: resolvedUserId,
          name: entity.name ?? null,
          email: expectedEmail,
        },
        { onConflict: 'user_id' },
      );

      if (profileError) throw profileError;

      const { error: roleError } = await admin.from('user_roles').insert({
        user_id: resolvedUserId,
        role,
      });

      if (roleError && roleError.code !== '23505') throw roleError;

      return resolvedUserId;
    };

    for (const target of targetEntityIds) {
      if (!target?.id || !tableConfig[target.table]) continue;

      const { role, codeColumn } = tableConfig[target.table];
      const selectColumns = `id, name, office_id, user_id, ${codeColumn}`;

      const { data: entity, error: entityError } = await admin
        .from(target.table)
        .select(selectColumns)
        .eq('id', target.id)
        .eq('office_id', officeId)
        .maybeSingle();

      if (entityError) throw entityError;
      if (!entity) continue;

      try {
        const resolvedUserId = await ensureEntityRecipient(target, entity, role, codeColumn);

        if (resolvedUserId && resolvedUserId !== authData.user.id) {
          userIds.add(resolvedUserId);
          continue;
        }

        unresolvedTargets.push(target);
      } catch (targetError) {
        console.error('Failed to resolve target recipient', {
          target,
          error: getErrorDetails(targetError),
        });
        unresolvedTargets.push(target);
      }
    }

    console.log('dispatch-notifications target resolution', {
      resolvedUserIds: Array.from(userIds),
      unresolvedTargets,
    });

    if (userIds.size === 0) {
      return jsonResponse({ success: true, inserted: 0, unresolvedTargets });
    }

    const notifications = Array.from(userIds).map((userId) => ({
      office_id: officeId,
      user_id: userId,
      title,
      message,
      type,
      is_read: false,
      related_product_id: relatedProductId,
      related_gate_pass_id: relatedGatePassId,
    }));

    const { error: insertError } = await admin.from('notifications').insert(notifications);
    if (insertError) {
      console.error('Failed to insert notifications', {
        notifications,
        error: getErrorDetails(insertError),
      });

      return jsonResponse({
        success: false,
        fallback: true,
        inserted: 0,
        unresolvedTargets,
        error: getErrorMessage(insertError),
      });
    }

    console.log('dispatch-notifications inserted notifications', {
      inserted: notifications.length,
    });

    return jsonResponse({ success: true, inserted: notifications.length, unresolvedTargets });
  } catch (error) {
    console.error('dispatch-notifications unexpected error', getErrorDetails(error));

    return jsonResponse({
      success: false,
      fallback: true,
      inserted: 0,
      unresolvedTargets: [],
      error: getErrorMessage(error),
    });
  }
});