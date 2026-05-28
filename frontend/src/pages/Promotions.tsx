import { useEffect, useState } from 'react';
import { promotionsApi } from '../api/management';
import { Promotion } from '../types';
import { Plus, Edit, Trash2, Search, Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import PromotionModal from '../components/promotions/PromotionModal';

export default function Promotions() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await promotionsApi.getAll();
      setPromotions(res.data.data);
    } catch {
      toast.error('Erro ao carregar promoções');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta promoção?')) return;
    try {
      await promotionsApi.delete(id);
      setPromotions(promotions.filter((p) => p.id !== id));
      toast.success('Promoção removida');
    } catch {
      toast.error('Erro ao remover promoção');
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (editingPromotion) {
        await promotionsApi.update(editingPromotion.id, data);
        toast.success('Promoção atualizada');
      } else {
        await promotionsApi.create(data);
        toast.success('Promoção criada');
      }
      setModalOpen(false);
      setEditingPromotion(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar promoção');
    }
  };

  const openEdit = (promotion: Promotion) => { setEditingPromotion(promotion); setModalOpen(true); };
  const openCreate = () => { setEditingPromotion(null); setModalOpen(true); };

  const filtered = promotions.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const isActive = (promotion: Promotion) => {
    const now = new Date();
    return promotion.is_active && new Date(promotion.start_date) <= now && new Date(promotion.end_date) >= now;
  };

  const formatType = (type: string) => {
    const types: Record<string, string> = { percentage: 'Porcentagem', fixed: 'Valor fixo', buy_x_get_y: 'Compre X Leve Y' };
    return types[type] || type;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Promoções</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Nova Promoção
        </button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar promoções..."
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Período</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usos</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((promotion) => (
                <tr key={promotion.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Percent size={16} className="text-orange-600" />
                      <span className="font-medium text-gray-900">{promotion.name}</span>
                    </div>
                    {promotion.description && <div className="text-sm text-gray-500 mt-1">{promotion.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatType(promotion.type)}</td>
                  <td className="px-4 py-3 font-medium">
                    {promotion.type === 'percentage' ? `${promotion.value}%` :
                     promotion.type === 'fixed' ? `R$ ${(promotion.value || 0).toFixed(2)}` :
                     `Leve ${promotion.get_quantity}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(promotion.start_date).toLocaleDateString('pt-BR')} - {new Date(promotion.end_date).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {promotion.current_uses}{promotion.max_uses ? ` / ${promotion.max_uses}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      isActive(promotion) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isActive(promotion) ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(promotion)} className="p-1 text-gray-400 hover:text-blue-600">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(promotion.id)} className="p-1 text-gray-400 hover:text-red-600">
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
        <PromotionModal
          promotion={editingPromotion}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingPromotion(null); }}
        />
      )}
    </div>
  );
}
