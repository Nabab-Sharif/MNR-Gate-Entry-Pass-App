import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Gate {
  id: string;
  name: string;
  gateId: string;
  officeId: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Store {
  id: string;
  name: string;
  storeId: string;
  officeId: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  departmentId: string;
  officeId: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Office {
  id: string;
  name: string;
  location?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  gates: Gate[];
  stores: Store[];
  departments: Department[];
}

interface OfficeStore {
  offices: Office[];
  addOffice: (office: Omit<Office, 'id' | 'createdAt' | 'gates' | 'stores' | 'departments'>) => void;
  updateOffice: (id: string, updates: Partial<Office>) => void;
  deleteOffice: (id: string) => void;
  addGate: (officeId: string, gate: Omit<Gate, 'id' | 'createdAt' | 'officeId'>) => void;
  updateGate: (officeId: string, gateId: string, updates: Partial<Gate>) => void;
  deleteGate: (officeId: string, gateId: string) => void;
  addStore: (officeId: string, store: Omit<Store, 'id' | 'createdAt' | 'officeId'>) => void;
  updateStore: (officeId: string, storeId: string, updates: Partial<Store>) => void;
  deleteStore: (officeId: string, storeId: string) => void;
  addDepartment: (officeId: string, department: Omit<Department, 'id' | 'createdAt' | 'officeId'>) => void;
  updateDepartment: (officeId: string, departmentId: string, updates: Partial<Department>) => void;
  deleteDepartment: (officeId: string, departmentId: string) => void;
  getOfficeById: (id: string) => Office | undefined;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useOfficeStore = create<OfficeStore>()(
  persist(
    (set, get) => ({
      offices: [],
      
      addOffice: (office) => set((state) => ({
        offices: [...state.offices, {
          ...office,
          id: generateId(),
          createdAt: new Date().toISOString(),
          gates: [],
          stores: [],
          departments: [],
        }]
      })),

      updateOffice: (id, updates) => set((state) => ({
        offices: state.offices.map(o => o.id === id ? { ...o, ...updates } : o)
      })),

      deleteOffice: (id) => set((state) => ({
        offices: state.offices.filter(o => o.id !== id)
      })),

      addGate: (officeId, gate) => set((state) => ({
        offices: state.offices.map(o => o.id === officeId ? {
          ...o,
          gates: [...o.gates, {
            ...gate,
            id: generateId(),
            officeId,
            createdAt: new Date().toISOString(),
          }]
        } : o)
      })),

      updateGate: (officeId, gateId, updates) => set((state) => ({
        offices: state.offices.map(o => o.id === officeId ? {
          ...o,
          gates: o.gates.map(g => g.id === gateId ? { ...g, ...updates } : g)
        } : o)
      })),

      deleteGate: (officeId, gateId) => set((state) => ({
        offices: state.offices.map(o => o.id === officeId ? {
          ...o,
          gates: o.gates.filter(g => g.id !== gateId)
        } : o)
      })),

      addStore: (officeId, store) => set((state) => ({
        offices: state.offices.map(o => o.id === officeId ? {
          ...o,
          stores: [...o.stores, {
            ...store,
            id: generateId(),
            officeId,
            createdAt: new Date().toISOString(),
          }]
        } : o)
      })),

      updateStore: (officeId, storeId, updates) => set((state) => ({
        offices: state.offices.map(o => o.id === officeId ? {
          ...o,
          stores: o.stores.map(s => s.id === storeId ? { ...s, ...updates } : s)
        } : o)
      })),

      deleteStore: (officeId, storeId) => set((state) => ({
        offices: state.offices.map(o => o.id === officeId ? {
          ...o,
          stores: o.stores.filter(s => s.id !== storeId)
        } : o)
      })),

      addDepartment: (officeId, department) => set((state) => ({
        offices: state.offices.map(o => o.id === officeId ? {
          ...o,
          departments: [...o.departments, {
            ...department,
            id: generateId(),
            officeId,
            createdAt: new Date().toISOString(),
          }]
        } : o)
      })),

      updateDepartment: (officeId, departmentId, updates) => set((state) => ({
        offices: state.offices.map(o => o.id === officeId ? {
          ...o,
          departments: o.departments.map(d => d.id === departmentId ? { ...d, ...updates } : d)
        } : o)
      })),

      deleteDepartment: (officeId, departmentId) => set((state) => ({
        offices: state.offices.map(o => o.id === officeId ? {
          ...o,
          departments: o.departments.filter(d => d.id !== departmentId)
        } : o)
      })),

      getOfficeById: (id) => get().offices.find(o => o.id === id),
    }),
    {
      name: 'mnr-offices',
    }
  )
);
