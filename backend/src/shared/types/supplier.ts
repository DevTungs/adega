export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  cnpj: string | null;
  address: string | null;
  notes: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}
