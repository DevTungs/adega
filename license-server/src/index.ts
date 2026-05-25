import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import authRoutes from './routes/auth.routes';
import clientRoutes from './routes/client.routes';
import planRoutes from './routes/plan.routes';
import licenseRoutes from './routes/license.routes';
import clientLicenseRoutes from './routes/client-license.routes';
import clientAuthRoutes from './routes/client-auth.routes';
import clientUserRoutes from './routes/client-user.routes';
import statsRoutes from './routes/stats.routes';

const app = express();
const PORT = Number(process.env.PORT || 3400);

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'license-server' });
});

// Admin routes (JWT protected)
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/client-users', clientUserRoutes);

// Client-facing routes (no JWT)
app.use('/api/client/auth', clientAuthRoutes);
app.use('/api/client/licenses', clientLicenseRoutes);

// Serve admin frontend in production
const adminDist = path.resolve(__dirname, '../admin/dist');
app.use('/admin', express.static(adminDist));
app.get('/admin/*', (_req, res) => {
  res.sendFile(path.join(adminDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`License server running on port ${PORT}`);
});
