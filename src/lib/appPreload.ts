import { supabase } from '@/integrations/supabase/client';
import { setCached } from '@/lib/indexedDBCache';
import type { User } from '@supabase/supabase-js';

type UserRole = 'admin' | 'sub_admin' | 'gate' | 'store' | 'department';

const db = supabase as any;

const PRODUCT_SELECT = '*, departments(name, whatsapp_number), gates(name, whatsapp_number), stores(name, whatsapp_number), product_items(id, name, quantity)';
const GATE_PASS_SELECT = '*, departments(name, whatsapp_number, user_id), stores(name, whatsapp_number, user_id), gates(name, whatsapp_number), gate_pass_items(id, name, quantity)';

const cacheRows = (store: 'products' | 'gate_passes' | 'offices' | 'gates' | 'stores' | 'departments', data: any[] | null, scopeKey?: string, scopeValue?: string) => {
  if (!data) return Promise.resolve();
  return setCached(store, data, scopeKey, scopeValue);
};

const getEntity = async (table: 'gates' | 'stores' | 'departments', user: User) => {
  const entityId = user.user_metadata?.entity_id;
  const byUser = await db.from(table).select('*, offices(name)').eq('user_id', user.id).maybeSingle();
  if (byUser.data) return byUser.data;
  if (!entityId) return null;
  const byEntity = await db.from(table).select('*, offices(name)').eq('id', entityId).maybeSingle();
  return byEntity.data || null;
};

export const preloadRoleData = async (user: User | null | undefined, role?: UserRole | null) => {
  if (!user || !role) return;

  try {
    if (role === 'admin') {
      const [officesRes, gatesRes, storesRes, departmentsRes] = await Promise.all([
        db.from('offices').select('*').order('created_at', { ascending: false }),
        db.from('gates').select('*, offices(name)').order('created_at', { ascending: false }),
        db.from('stores').select('*, offices(name)').order('created_at', { ascending: false }),
        db.from('departments').select('*, offices(name)').order('created_at', { ascending: false }),
      ]);
      await Promise.all([
        cacheRows('offices', officesRes.data),
        cacheRows('gates', gatesRes.data),
        cacheRows('stores', storesRes.data),
        cacheRows('departments', departmentsRes.data),
      ]);
      return;
    }

    if (role === 'sub_admin') {
      const [officesRes, productsRes, passesRes] = await Promise.all([
        db.from('offices').select('*').eq('status', 'active').order('name'),
        db.from('products').select('id, name, status, created_at, office_id').order('created_at', { ascending: false }).limit(100),
        db.from('gate_passes').select('id, product_name, status, created_at, office_id').order('created_at', { ascending: false }).limit(100),
      ]);
      await Promise.all([
        cacheRows('offices', officesRes.data),
        cacheRows('products', productsRes.data),
        cacheRows('gate_passes', passesRes.data),
      ]);
      return;
    }

    if (role === 'gate') {
      const gate = await getEntity('gates', user);
      if (!gate?.id) return;
      const [productsRes, passesRes, deptsRes, storesRes] = await Promise.all([
        db.from('products').select(PRODUCT_SELECT).eq('gate_id', gate.id).order('created_at', { ascending: false }),
        db.from('gate_passes').select(GATE_PASS_SELECT).eq('gate_id', gate.id).order('created_at', { ascending: false }),
        db.from('departments').select('id, name, whatsapp_number').eq('office_id', gate.office_id).eq('status', 'active'),
        db.from('stores').select('id, name, whatsapp_number').eq('office_id', gate.office_id).eq('status', 'active'),
      ]);
      await Promise.all([
        cacheRows('gates', [{ ...gate, user_id: user.id }], 'user_id', user.id),
        cacheRows('departments', deptsRes.data, 'office_id', gate.office_id),
        cacheRows('stores', storesRes.data, 'office_id', gate.office_id),
        cacheRows('products', productsRes.data, 'gate_id', gate.id),
        cacheRows('gate_passes', passesRes.data, 'gate_id', gate.id),
      ]);
      return;
    }

    if (role === 'store') {
      const store = await getEntity('stores', user);
      if (!store?.id) return;
      const [productsRes, passesRes, deptsRes, gatesRes] = await Promise.all([
        db.from('products').select(PRODUCT_SELECT).eq('store_id', store.id).order('created_at', { ascending: false }),
        db.from('gate_passes').select(GATE_PASS_SELECT).eq('store_id', store.id).order('created_at', { ascending: false }),
        db.from('departments').select('id, name, whatsapp_number').eq('office_id', store.office_id).eq('status', 'active'),
        db.from('gates').select('id, name, whatsapp_number').eq('office_id', store.office_id).eq('status', 'active'),
      ]);
      await Promise.all([
        cacheRows('stores', [{ ...store, user_id: user.id }], 'user_id', user.id),
        cacheRows('departments', deptsRes.data, 'office_id', store.office_id),
        cacheRows('gates', gatesRes.data, 'office_id', store.office_id),
        cacheRows('products', productsRes.data, 'store_id', store.id),
        cacheRows('gate_passes', passesRes.data, 'store_id', store.id),
      ]);
      return;
    }

    const dept = await getEntity('departments', user);
    if (!dept?.id) return;
    const [productsRes, passesRes, storesRes, gatesRes] = await Promise.all([
      db.from('products').select(PRODUCT_SELECT).eq('department_id', dept.id).order('created_at', { ascending: false }),
      db.from('gate_passes').select(GATE_PASS_SELECT).eq('department_id', dept.id).order('created_at', { ascending: false }),
      db.from('stores').select('id, name, whatsapp_number').eq('office_id', dept.office_id).eq('status', 'active'),
      db.from('gates').select('id, name, whatsapp_number').eq('office_id', dept.office_id).eq('status', 'active'),
    ]);
    await Promise.all([
      cacheRows('departments', [{ ...dept, user_id: user.id }], 'user_id', user.id),
      cacheRows('stores', storesRes.data, 'office_id', dept.office_id),
      cacheRows('gates', gatesRes.data, 'office_id', dept.office_id),
      cacheRows('products', productsRes.data, 'department_id', dept.id),
      cacheRows('gate_passes', passesRes.data, 'department_id', dept.id),
    ]);
  } catch (error) {
    console.warn('Background preload skipped:', error);
  }
};