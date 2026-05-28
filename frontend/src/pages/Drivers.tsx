import { useEffect, useState } from 'react';
import { driversApi } from '../api/management';
import { DeliveryDriver } from '../types';
import { Plus, Edit, Trash2, Search, Bike, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import DriverModal from '../components/drivers/DriverModal';

export default function Drivers() {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<DeliveryDriver | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await driversApi.getAll();
      setDrivers(res.data.data);
    } catch {
      toast.error('Erro ao carregar motoristas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este motorista?')) return;
    try {
      await driversApi.delete(id);
      setDrivers(drivers.filter((d) => d.id !== id));
      toast.success('Motorista removido');
    } catch {
      toast.error('Erro ao remover motorista');
    }
  };

  const handleToggleAvailability = async (id: string) => {
    try {
      const res = await driversApi.toggleAvailability(id);
      setDrivers(drivers.map((d) => d.id === id ? res.data.data : d));
      toast.success('Disponibilidade atualizada');
    } catch {
      toast.error('Erro ao atualizar disponibilidade');
    }
  };

  const handleSave = async (data: any) => {
    try {
      if (editingDriver) {
        await driversApi.update(editingDriver.id, data);
        toast.success('Motorista atualizado');
      } else {
        await driversApi.create(data);
        toast.success('Motorista criado');
      }
      setModalOpen(false);
      setEditingDriver(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar motorista');
    }
  };

  const openEdit = (driver: DeliveryDriver) => { setEditingDriver(driver); setModalOpen(true); };
  const openCreate = () => { setEditingDriver(null); setModalOpen(true); };

  const filtered = drivers.filter((d) =>
    !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.phone.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Motoristas</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Novo Motorista
        </button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar motoristas..."
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
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motorista</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Telefone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Veículo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entregas</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disponível</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((driver) => (
                <tr key={driver.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Bike size={16} className="text-green-600" />
                      <span className="font-medium text-gray-900">{driver.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{driver.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {driver.vehicle || '-'}
                    {driver.plate && <span className="ml-1 text-gray-400">({driver.plate})</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{driver.total_deliveries}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleAvailability(driver.id)}
                      className="flex items-center gap-1"
                    >
                      {driver.is_available ? (
                        <ToggleRight size={24} className="text-green-600" />
                      ) : (
                        <ToggleLeft size={24} className="text-gray-400" />
                      )}
                      <span className={`text-xs ${driver.is_available ? 'text-green-600' : 'text-gray-400'}`}>
                        {driver.is_available ? 'Sim' : 'Não'}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      driver.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {driver.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(driver)} className="p-1 text-gray-400 hover:text-blue-600">
                        <Edit size={18} />
                      </button>
                      <button onClick={() => handleDelete(driver.id)} className="p-1 text-gray-400 hover:text-red-600">
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
        <DriverModal
          driver={editingDriver}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditingDriver(null); }}
        />
      )}
    </div>
  );
}
