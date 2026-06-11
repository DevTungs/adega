import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { X, Check, XCircle, Send, Image as ImageIcon, MapPin, FileText, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi } from '../../api/orders';
import { whatsappApi } from '../../api/whatsapp';
import { formatCurrency, formatPhone, formatTime } from '../../utils/format';

const isElectron = window.location.protocol === 'file:';
const wsOrigin = isElectron ? 'http://localhost:3333' : window.location.origin;

interface PixPendingData {
  phone: string;
  customerName: string;
  total: number;
  imageBase64?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  address?: string;
  notes?: string;
  deliveryFee?: number;
  time: string;
}

interface ChatMessage {
  phone: string;
  message: string;
  direction: 'in' | 'out';
  time: string;
  name?: string | null;
}

interface Props {
  data: PixPendingData;
  onClose: () => void;
  onConfirmed: () => void;
}

export default function PixConfirmationModal({ data, onClose, onConfirmed }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(data.imageBase64 || null);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
  }, [data.phone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (data.imageBase64) {
      console.log('[PIX Modal] Image received, length:', data.imageBase64.length);
      console.log('[PIX Modal] Image preview:', data.imageBase64.substring(0, 100));
      setImagePreview(data.imageBase64);
    }
  }, [data.imageBase64]);

  useEffect(() => {
    const socket = io(wsOrigin, { transports: ['websocket', 'polling'] });

    socket.on('wa:message', (payload: ChatMessage) => {
      if (payload.phone === data.phone) {
        setMessages(prev => [...prev, payload]);
      }
    });

    socket.on('pix:pending', (payload: PixPendingData) => {
      if (payload.phone === data.phone && payload.imageBase64) {
        setImagePreview(payload.imageBase64);
        setMessages(prev => [...prev, {
          phone: payload.phone,
          message: '📷 Comprovante enviado',
          direction: 'in',
          time: payload.time,
        }]);
      }
    });

    return () => { socket.disconnect(); };
  }, [data.phone]);

  const fetchMessages = async () => {
    try {
      const { data: res } = await whatsappApi.getMessages(data.phone);
      if (res.success) {
        setMessages(res.data.slice(-50));
      }
    } catch {
      // silent
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    try {
      await whatsappApi.sendMessage(data.phone, newMessage);
      setNewMessage('');
    } catch {
      toast.error('Erro ao enviar mensagem');
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await ordersApi.confirmPix(data.phone);
      toast.success('PIX confirmado! Pedido criado com sucesso.', { icon: '✅' });
      onConfirmed();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao confirmar PIX');
    } finally {
      setConfirming(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      await ordersApi.rejectPix(data.phone);
      toast.success('PIX rejeitado. Sessão resetada.', { icon: '❌' });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao rejeitar PIX');
    } finally {
      setRejecting(false);
    }
  };

  const subtotal = (data.items || []).reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
              <span className="text-green-400 font-bold text-lg">R$</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Comprovante PIX</h3>
              <p className="text-sm text-gray-400">
                {data.customerName} &middot; {formatPhone(data.phone)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-green-400">{formatCurrency(data.total)}</span>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white ml-2">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Chat Section */}
          <div className="flex-1 flex flex-col border-r border-gray-800 min-w-0">
            {/* Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-800/30">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  Nenhuma mensagem nesta conversa
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                      msg.direction === 'out'
                        ? 'bg-primary-600 text-white rounded-br-none'
                        : 'bg-gray-900 text-white border border-gray-800 rounded-bl-none'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                    <p className={`text-xs mt-1 ${msg.direction === 'out' ? 'text-primary-200' : 'text-gray-400'}`}>
                      {formatTime(msg.time)}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-gray-800 bg-gray-900">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enviar mensagem ao cliente..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="flex-1 px-4 py-2 bg-gray-800/50 border border-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-white placeholder-gray-500"
                />
                <button
                  onClick={handleSend}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar: Order Info + Comprovante */}
          <div className="w-80 flex-shrink-0 flex flex-col overflow-y-auto bg-gray-900/50">
            {/* Comprovante */}
            <div className="p-4 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <ImageIcon size={16} /> Comprovante
              </h4>
              {imagePreview ? (
                <div
                  className="rounded-lg overflow-hidden border border-gray-800 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setFullImage(imagePreview)}
                >
                  <img src={imagePreview} alt="Comprovante PIX" className="w-full h-auto max-h-64 object-contain bg-gray-800" />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-700 p-6 text-center">
                  <ImageIcon size={32} className="mx-auto text-gray-600 mb-2" />
                  <p className="text-sm text-gray-500">Aguardando comprovante...</p>
                </div>
              )}
            </div>

            {/* Order Items */}
            <div className="p-4 border-b border-gray-800">
              <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <ShoppingBag size={16} /> Itens do Pedido
              </h4>
              <div className="space-y-2">
                {(data.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-300">{item.quantity}x {item.name}</span>
                    <span className="text-white font-medium">{formatCurrency(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-800 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Subtotal</span>
                  <span className="text-gray-300">{formatCurrency(subtotal)}</span>
                </div>
                {(data.deliveryFee ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Taxa de entrega</span>
                    <span className="text-gray-300">{formatCurrency(data.deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold pt-1">
                  <span className="text-white">Total</span>
                  <span className="text-green-400">{formatCurrency(data.total)}</span>
                </div>
              </div>
            </div>

            {/* Address */}
            {data.address && (
              <div className="p-4 border-b border-gray-800">
                <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <MapPin size={16} /> Endereço
                </h4>
                <p className="text-sm text-gray-400">{data.address}</p>
              </div>
            )}

            {/* Notes */}
            {data.notes && (
              <div className="p-4 border-b border-gray-800">
                <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <FileText size={16} /> Observações
                </h4>
                <p className="text-sm text-gray-400">{data.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-end gap-3 bg-gray-900">
          <button
            onClick={handleReject}
            disabled={rejecting || confirming}
            className="flex items-center gap-2 px-6 py-2.5 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <XCircle size={18} />
            {rejecting ? 'Rejeitando...' : 'Rejeitar PIX'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirming || rejecting}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Check size={18} />
            {confirming ? 'Confirmando...' : 'Confirmar PIX'}
          </button>
        </div>
      </div>

      {/* Full Image Overlay */}
      {fullImage && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setFullImage(null)}
        >
          <img src={fullImage} alt="Comprovante PIX" className="max-w-full max-h-full object-contain rounded-lg" />
          <button
            onClick={() => setFullImage(null)}
            className="absolute top-4 right-4 p-2 bg-gray-800 rounded-full text-white hover:bg-gray-700"
          >
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
