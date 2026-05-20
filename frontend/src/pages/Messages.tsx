import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { MessageCircle, Send, ArrowLeft, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { whatsappApi } from '../api/whatsapp';

interface WAMessage {
  phone: string;
  message: string;
  direction: 'in' | 'out';
  time: string;
}

interface Conversation {
  phone: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
}

export default function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedPhone) {
      fetchMessages(selectedPhone);
    }
  }, [selectedPhone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebSocket for real-time updates
  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });

    socket.on('wa:message', (payload: WAMessage) => {
      // Update conversations list
      setConversations(prev => {
        const existing = prev.find(c => c.phone === payload.phone);
        if (existing) {
          return prev.map(c =>
            c.phone === payload.phone
              ? { ...c, lastMessage: payload.message, lastTime: payload.time }
              : c
          ).sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
        }
        return [...prev, {
          phone: payload.phone,
          lastMessage: payload.message,
          lastTime: payload.time,
          unread: 0,
        }].sort((a, b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
      });

      // Update messages if viewing this conversation
      if (selectedPhone === payload.phone) {
        setMessages(prev => [...prev, payload]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedPhone]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const { data } = await whatsappApi.getConversations();
      if (data.success) {
        setConversations(data.data);
      }
    } catch {
      toast.error('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (phone: string) => {
    try {
      const { data } = await whatsappApi.getMessages(phone);
      if (data.success) {
        setMessages(data.data);
      }
    } catch {
      toast.error('Erro ao carregar mensagens');
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedPhone) return;

    try {
      await whatsappApi.sendMessage(selectedPhone, newMessage);
      setNewMessage('');
      // Message will appear via WebSocket
    } catch {
      toast.error('Erro ao enviar mensagem');
    }
  };

  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (time: string) => {
    const date = new Date(time);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return 'Hoje';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Ontem';
    return date.toLocaleDateString('pt-BR');
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 13) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
    }
    if (digits.length === 12) {
      return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
    }
    return phone;
  };

  const filteredConversations = conversations.filter(c =>
    c.phone.includes(searchTerm) || c.lastMessage.toLowerCase().includes(searchTerm.toLowerCase()
  ));

  return (
    <div className="h-[calc(100vh-8rem)] flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Conversations List */}
      <div className={`${selectedPhone ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 border-r border-gray-200`}>
        {/* Search */}
        <div className="p-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar conversa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <MessageCircle className="w-8 h-8 mb-2" />
              <p className="text-sm">Nenhuma conversa</p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.phone}
                onClick={() => setSelectedPhone(conv.phone)}
                className={`w-full p-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                  selectedPhone === conv.phone ? 'bg-primary-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {formatPhone(conv.phone)}
                      </p>
                      <span className="text-xs text-gray-500">
                        {formatDate(conv.lastTime)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">
                      {conv.lastMessage}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      {selectedPhone ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-3 border-b border-gray-200 bg-white flex items-center gap-3">
            <button
              onClick={() => setSelectedPhone(null)}
              className="md:hidden p-1 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-primary-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                {formatPhone(selectedPhone)}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-lg text-sm ${
                    msg.direction === 'out'
                      ? 'bg-primary-600 text-white rounded-br-none'
                      : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.message}</p>
                  <p className={`text-xs mt-1 ${
                    msg.direction === 'out' ? 'text-primary-200' : 'text-gray-400'
                  }`}>
                    {formatTime(msg.time)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium">Selecione uma conversa</p>
            <p className="text-sm mt-1">Escolha uma conversa ao lado para começar</p>
          </div>
        </div>
      )}
    </div>
  );
}
