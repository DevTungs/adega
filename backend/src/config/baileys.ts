import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const baileysConfig = {
  sessionPath: path.resolve(__dirname, '../../..', process.env.WA_SESSION_PATH || './data/sessions'),
  reconnectInterval: parseInt(process.env.WA_RECONNECT_INTERVAL || '5000'),
  maxReconnect: parseInt(process.env.WA_MAX_RECONNECT || '10'),
};
