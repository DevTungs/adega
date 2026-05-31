import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { licenseService } from '../services/license.service';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

const createLicenseSchema = z.object({
  client_id: z.string().min(1, 'Cliente é obrigatório'),
  plan_id: z.string().min(1, 'Plano é obrigatório'),
  expires_at: z.string().min(1, 'Data de vencimento é obrigatória'),
  max_machines: z.number().int().positive().optional(),
});

const renewLicenseSchema = z.object({
  expires_at: z.string().min(1, 'Nova data de vencimento é obrigatória'),
});

// List all licenses (admin)
router.get('/', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, client_id } = req.query as any;
  const licenses = await licenseService.listAll({ status, client_id });
  res.json({ success: true, data: licenses });
}));

// Get license by ID (admin)
router.get('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const license = await licenseService.getById(req.params.id);
  if (!license) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Licença não encontrada' });
  res.json({ success: true, data: license });
}));

// Create license (admin)
router.post('/', authMiddleware, validateBody(createLicenseSchema), asyncHandler(async (req: Request, res: Response) => {
  const license = await licenseService.create(req.body);
  res.status(201).json({ success: true, data: license });
}));

// Renew license (admin)
router.patch('/:id/renew', authMiddleware, validateBody(renewLicenseSchema), asyncHandler(async (req: Request, res: Response) => {
  const license = await licenseService.renew(req.params.id, req.body.expires_at);
  if (!license) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Licença não encontrada' });
  res.json({ success: true, data: license, message: 'Licença renovada' });
}));

// Block license (admin)
router.patch('/:id/block', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const license = await licenseService.block(req.params.id);
  if (!license) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Licença não encontrada' });
  res.json({ success: true, data: license, message: 'Licença bloqueada' });
}));

// Unblock license (admin)
router.patch('/:id/unblock', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const license = await licenseService.unblock(req.params.id);
  if (!license) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Licença não encontrada' });
  res.json({ success: true, data: license, message: 'Licença desbloqueada' });
}));

// Delete license (admin)
router.delete('/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const license = await licenseService.remove(req.params.id);
  if (!license) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Licença não encontrada' });
  res.json({ success: true, message: 'Licença excluída' });
}));

// Get activation log (admin)
router.get('/:id/activations', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const logs = await query(
    'SELECT * FROM license_activations WHERE license_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.params.id]
  );
  res.json({ success: true, data: logs });
}));

// Get machines for a license (admin)
router.get('/:id/machines', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const machines = await licenseService.getMachines(req.params.id);
  res.json({ success: true, data: machines });
}));

// Deactivate a machine (admin)
router.delete('/:id/machines/:fingerprint', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await licenseService.deactivateMachine(req.params.id, req.params.fingerprint);
  res.json(result);
}));

export default router;
