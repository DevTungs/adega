import { useEffect, useState } from 'react';
import { couponsApi } from '../api/management';
import { Coupon } from '../types';
import { Plus, Edit, Trash2, Search, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import CouponModal from '../components/coupons/CouponModal';

export default function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await couponsApi.getAll();
      setCoupons(res.data.data);
    } catch {
      toast.error('Erro ao carregar cupons');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este cupom?')) return;
    try {
      await couponsApi.delete(id);
      setCoupons(coupons.filter((c) => c.id !== id));
      toast.success('Cupom removido');
    } catch {
      toast.error('Erro ao remover cupom');
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (editingCoupon) {
        await couponsApi.update(editingCoupon.id, data);
        toast.success('Cupom atualizado');
      } else {
        await couponsApi.create(data);
        toast.success('Cupom criado');
      }
      setModalOpen(false);
      setEditingCoupon(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar cupom');
    }
  };

  const openEdit = (coupon: Coupon) => { setEditingCoupon(coupon); setModalOpen(true); };
  const openCreate = () => { setEditingCoupon(null); setModalOpen(true); };

  const filtered = coupons.filter((c) =>
    !search || c.code.toLowerCase().includes(search.toLowerCase()) || (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  );

  const isExpired = (endDate: string) => new Date(endDate) < new Date();

  const formatType = (type: string) => {
    const types: Record<string, string> = { percentage: 'Porcentagem', fixed: 'Valor fixo', free_delivery: 'Frete grátis' };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Cupons</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Novo Cupom
        </button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar cupons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>

      {isLoading ? (
        <div className="card text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validade</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Tag size={16} className="text-primary-600" />
                      <span className="font-mono font-medium text-gray-900">{coupon.code}</span>
                    </div>
                    {coupon.description && <div className="text-sm text-gray-500 mt-1">{coupon.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatType(coupon.type)}</td>
                  <td className="px-4 py-3 font-medium">
                    {coupon.type === 'percentage' ? `${coupon.value}%` : coupon.type === 'free_delivery' ? 'Grátis' : `R$ ${coupon.value.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {coupon.current_uses}{coupon.max_uses ? ` / ${coupon.max_uses}` : ''}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(coupon.end_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      !coupon.is_active ? 'bg-gray-100 text-gray-600' :
                      isExpired(coupon.end_date) ? 'bg-red-100 text-red-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {!coupon.is_active ? 'Inativo' : isExpired(coupon.end_date) ? 'Expirado' : 'Ativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(coupon)} className="p-1 text-gray-400 hover:text-blue-600">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(coupon.id)} className="p-1 text-gray-400 hover:text-red-600">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <CouponModal
          coupon={editingCoupon}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingCoupon(null); }}
        />
      )}
    </div>
  );
}
