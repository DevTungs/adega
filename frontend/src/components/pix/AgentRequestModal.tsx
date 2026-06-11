import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { X, Send, User, Phone, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { whatsappApi } from '../../api/whatsapp';
import { formatPhone, formatTime } from '../../utils/format';

const isElectron = window.location.protocol === 'file:';
const wsOrigin = isElectron ? 'http://localhost:3333' : window.location.origin;

export interface AgentRequestData {
  phone: string;
  customerName: string;
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
  requests: AgentRequestData[];
  onClose: () => void;
  onRequestsChange: (requests: AgentRequestData[]) => void;
}

export default function AgentRequestModal({ requests, onClose, onRequestsChange }: Props) {
  const [activePhone, setActivePhone] = useState(requests[0]?.phone || '');
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const [closing, setClosing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activePhone && requests.find(r => r.phone === activePhone)) {
      fetchMessages(activePhone);
    }
  }, [activePhone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesMap[activePhone]]);

  useEffect(() => {
    const socket = io(wsOrigin, { transports: ['websocket', 'polling'] });

    socket.on('wa:message', (payload: ChatMessage) => {
      setMessagesMap(prev => ({
        ...prev,
        [payload.phone]: [...(prev[payload.phone] || []), payload],
      }));
    });

    return () => { socket.disconnect(); };
  }, []);

  const fetchMessages = async (phone: string) => {
    try {
      const { data: res } = await whatsappApi.getMessages(phone);
      if (res.success) {
        setMessagesMap(prev => ({ ...prev, [phone]: res.data.slice(-50) }));
      }
    } catch {
      // silent
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activePhone) return;
    try {
      await whatsappApi.sendMessage(activePhone, newMessage);
      setNewMessage('');
    } catch {
      toast.error('Erro ao enviar mensagem');
    }
  };

  const handleCloseAgent = async (phone: string) => {
    setClosing(true);
    try {
      await whatsappApi.closeAgent(phone);
      toast.success('Chamado encerrado. Bot retomado.');
      const remaining = requests.filter(r => r.phone !== phone);
      onRequestsChange(remaining);
      if (remaining.length === 0) {
        onClose();
      } else if (activePhone === phone) {
        setActivePhone(remaining[0].phone);
      }
    } catch {
      toast.error('Erro ao encerrar chamado');
    } finally {
      setClosing(false);
    }
  };

  const handleModalClose = () => {
    // Close all agent requests when modal is closed
    requests.forEach(r => handleCloseAgent(r.phone));
  };

  const activeRequest = requests.find(r => r.phone === activePhone);
  const activeMessages = messagesMap[activePhone] || [];

  if (!activeRequest) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header with Tabs */}
        <div className="border-b border-gray-800 bg-gray-900">
          {/* Tabs */}
          {requests.length > 1 && (
            <div className="flex overflow-x-auto border-b border-gray-800">
              {requests.map((req) => (
                <button
                  key={req.phone}
                  onClick={() => setActivePhone(req.phone)}
                  className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                    activePhone === req.phone
                      ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                      : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User size={14} />
                    <span>{req.customerName}</span>
                    <span className="text-xs text-gray-500">{formatTime(req.time)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Header Info */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                <User className="text-blue-400" size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Chamado de Atendente</h3>
                <p className="text-sm text-gray-400">
                  {activeRequest.customerName} &middot; {formatPhone(activeRequest.phone)}
                </p>
              </div>
            </div>
            <button
              onClick={handleModalClose}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white"
              title="Fechar e encerrar todos os chamados"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-800/30">
            {activeMessages.length === 0 && (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                Nenhuma mensagem nesta conversa
              </div>
            )}
            {activeMessages.map((msg, i) => (
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
                placeholder="Responder ao cliente..."
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-800 bg-gray-900 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Phone size={14} />
            <span>{formatPhone(activeRequest.phone)}</span>
          </div>
          <button
            onClick={() => handleCloseAgent(activeRequest.phone)}
            disabled={closing}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            <CheckCircle size={16} />
            {closing ? 'Encerrando...' : 'Finalizar Chamado'}
          </button>
        </div>
      </div>
    </div>
  );
}
