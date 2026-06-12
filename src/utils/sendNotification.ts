import { supabase } from '@/integrations/supabase/client';

type EntityTable = 'departments' | 'stores' | 'gates';

interface NotificationParams {
  officeId: string;
  title: string;
  message: string;
  type?: string;
  relatedProductId?: string | null;
  relatedGatePassId?: string | null;
  targetEntityIds: { table: EntityTable; id: string }[];
}

/**
 * Send notifications to users linked to specified entities.
 * Resolves user_id from each entity row and inserts notification directly.
 */
export const sendNotificationsToEntities = async ({
  officeId,
  title,
  message,
  type = 'info',
  relatedProductId,
  relatedGatePassId,
  targetEntityIds,
}: NotificationParams) => {
  const targets = targetEntityIds.filter((t) => t.id);

  if (targets.length === 0) {
    console.warn('No notification targets provided');
    return null;
  }

  try {
    // Resolve user_ids from entity tables
    const userIds = new Set<string>();

    await Promise.all(
      targets.map(async (target) => {
        const { data, error } = await supabase
          .from(target.table)
          .select('user_id')
          .eq('id', target.id)
          .maybeSingle();

        if (error) {
          console.error(`Failed to resolve ${target.table} user:`, error);
          return;
        }
        if (data?.user_id) {
          userIds.add(data.user_id);
        }
      }),
    );

    if (userIds.size === 0) {
      console.warn('No linked users found for notification targets');
      return { success: true, inserted: 0 };
    }

    const rows = Array.from(userIds).map((uid) => ({
      office_id: officeId,
      user_id: uid,
      title,
      message,
      type,
      is_read: false,
      related_product_id: relatedProductId || null,
      related_gate_pass_id: relatedGatePassId || null,
    }));

    const { error } = await supabase.from('notifications').insert(rows);

    if (error) {
      console.error('Error inserting notifications:', error);
      return null;
    }

    console.log(`Notifications sent to ${rows.length} user(s)`);
    return { success: true, inserted: rows.length };
  } catch (err) {
    console.error('Notification error:', err);
    return null;
  }
};
