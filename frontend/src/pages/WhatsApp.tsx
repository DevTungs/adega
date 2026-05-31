import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { MessageCircle, RefreshCw, Send, Wifi, WifiOff, Power, PowerOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { whatsappApi } from '../api/whatsapp';

type WAStatus = 'disconnected' | 'connecting' | 'connected' | 'qr_pending';

interface WAMessage {
  phone: string;
  message: string;
  direction: 'in' | 'out';
  time: string;
}

export default function WhatsApp() {
  const [status, setStatus] = useState<WAStatus>('disconnected');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [botActive, setBotActive] = useState(true);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  const [connecting, setConnecting] = useState(false);

  // Fetch initial status
  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const { data } = await whatsappApi.getStatus();
      if (data.success) {
        setStatus(data.data.state);
        setBotActive(data.data.bot_active);
        if (data.data.qr) setQrCode(data.data.qr);
      }
    } catch {}
  };

  // WebSocket for real-time updates
  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('[WS] Connected');
      fetchStatus();
    });

    socket.on('disconnect', () => {
      console.log('[WS] Disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('[WS] connect_error', error);
    });

    socket.on('connect_timeout', () => {
      console.warn('[WS] connect_timeout');
    });

    socket.on('wa:qr', (payload: { qr: string }) => {
      setQrCode(payload.qr);
      setStatus('qr_pending');
    });

    socket.on('wa:status', (payload: { status: WAStatus }) => {
      setStatus(payload.status);
      if (payload.status === 'connected') {
        setQrCode(null);
      }
    });

    socket.on('wa:message', (payload: WAMessage) => {
      setMessages(prev => [...prev.slice(-49), payload]);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data } = await whatsappApi.connect();
      if (data.success) {
        toast.success('Conectando...');
        setStatus('connecting');
        await fetchStatus();
      } else {
        toast.error(data.error || 'Erro ao conectar');
      }
    } catch {
      toast.error('Erro ao conectar');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await whatsappApi.disconnect();
      setStatus('disconnected');
      setQrCode(null);
      toast.success('Desconectado');
    } catch {
      toast.error('Erro ao desconectar');
    }
  };

  const handleToggleBot = async () => {
    try {
      const { data } = await whatsappApi.toggleBot(!botActive);
      if (data.success) {
        setBotActive(data.data.active);
        toast.success(data.data.active ? 'Bot ativado' : 'Bot desativado');
      }
    } catch {
      toast.error('Erro ao alterar bot');
    }
  };

  const handleSendTest = async () => {
    if (!testPhone || !testMessage) return;
    try {
      const { data } = await whatsappApi.sendMessage(testPhone, testMessage);
      if (data.success) {
        setMessages(prev => [...prev.slice(-49), {
          phone: testPhone,
          message: testMessage,
          direction: 'out',
          time: new Date().toISOString(),
        }]);
        setTestMessage('');
        toast.success('Mensagem enviada');
      } else {
        toast.error(data.error || 'Erro ao enviar');
      }
    } catch {
      toast.error('Erro ao enviar mensagem');
    }
  };

  const statusConfig = {
    disconnected: { label: 'Desconectado', color: 'bg-red-500', icon: WifiOff },
    connecting: { label: 'Conectando...', color: 'bg-yellow-500 animate-pulse', icon: RefreshCw },
    connected: { label: 'Conectado', color: 'bg-green-500', icon: Wifi },
    qr_pending: { label: 'Aguardando QR Code', color: 'bg-blue-500 animate-pulse', icon: Wifi },
  };

  const st = statusConfig[status];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">WhatsApp Bot</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection Status */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={20} className="text-green-600" />
            <h2 className="text-lg font-semibold">Conexão</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${st.color}`}></div>
              <span className="text-sm text-gray-400">{st.label}</span>
            </div>

            {status === 'disconnected' ? (
              <button onClick={handleConnect} disabled={connecting} className="btn-primary w-full">
                {connecting ? 'Conectando...' : 'Conectar WhatsApp'}
              </button>
            ) : (
              <button onClick={handleDisconnect} className="btn-secondary w-full">
                Desconectar
              </button>
            )}

            {/* Bot toggle */}
            <div className="border-t pt-3">
              <button onClick={handleToggleBot} className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg ${
                botActive ? 'bg-green-100 text-green-700' : 'bg-gray-800 text-gray-400'
              }`}>
                {botActive ? <Power size={18} /> : <PowerOff size={18} />}
                {botActive ? 'Bot Ativo' : 'Bot Inativo'}
              </button>
            </div>
          </div>
        </div>

        {/* QR Code */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">📱</span>
            <h2 className="text-lg font-semibold">QR Code</h2>
          </div>
          <div className="flex items-center justify-center min-h-[200px]">
            {status === 'qr_pending' && qrCode ? (
              <img src={qrCode} alt="QR Code" className="w-48 h-48" />
            ) : status === 'connected' ? (
              <div className="text-center text-green-600">
                <Wifi size={48} className="mx-auto mb-2" />
                <p className="font-medium">WhatsApp Conectado</p>
              </div>
            ) : (
              <div className="text-center text-gray-400">
                <WifiOff size={48} className="mx-auto mb-2" />
                <p className="text-sm">Clique em "Conectar" para gerar o QR Code</p>
              </div>
            )}
          </div>
        </div>

        {/* Test Message */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Send size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold">Testar Envio</h2>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Telefone (ex: 5511999999999)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="input w-full"
            />
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Mensagem..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="input flex-1"
              />
              <button onClick={handleSendTest} className="btn-primary px-3">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Messages */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Mensagens Recentes</h2>
          <button onClick={() => setMessages([])} className="p-2 hover:bg-gray-800 rounded">
            <RefreshCw size={18} className="text-gray-400" />
          </button>
        </div>
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            Nenhuma mensagem ainda. Conecte o WhatsApp para ver as mensagens.
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                <div className={`px-3 py-2 rounded-lg max-w-xs ${
                  msg.direction === 'out'
                    ? 'bg-primary-100 text-primary-900'
                    : 'bg-gray-800 text-white'
                }`}>
                  <div className="text-xs text-gray-400 mb-1">
                    {msg.direction === 'out' ? '→' : '←'} {msg.phone} - {new Date(msg.time).toLocaleTimeString('pt-BR')}
                  </div>
                  <div className="text-sm">{msg.message}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
