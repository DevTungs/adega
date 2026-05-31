import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { licenseService } from '../services/license.service';
import { asyncHandler } from '../middleware/async-handler';

const router = Router();

const activateSchema = z.object({
  licenseKey: z.string().min(1, 'Chave de licença é obrigatória'),
  machineFingerprint: z.string().min(1, 'Fingerprint da máquina é obrigatório'),
  appId: z.string().optional(),
});

const validateSchema = z.object({
  licenseKey: z.string().min(1, 'Chave de licença é obrigatória'),
  machineFingerprint: z.string().min(1, 'Fingerprint da máquina é obrigatório'),
  appId: z.string().optional(),
});

const deactivateSchema = z.object({
  licenseKey: z.string().min(1, 'Chave de licença é obrigatória'),
  machineFingerprint: z.string().min(1, 'Fingerprint da máquina é obrigatório'),
});

const machinesSchema = z.object({
  licenseKey: z.string().min(1, 'Chave de licença é obrigatória'),
});

// Activate license (client-facing, no JWT — authenticated by license key)
router.post('/activate', validateBody(activateSchema), asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey, machineFingerprint, appId } = req.body;
  const result = await licenseService.activate(licenseKey, machineFingerprint, appId);
  res.json(result);
}));

// Validate license (client-facing, no JWT — authenticated by license key)
router.post('/validate', validateBody(validateSchema), asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey, machineFingerprint, appId } = req.body;
  const result = await licenseService.validate(licenseKey, machineFingerprint, appId);
  res.json(result);
}));

// Deactivate a machine
router.post('/deactivate', validateBody(deactivateSchema), asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey, machineFingerprint } = req.body;

  // Find license by key
  const { queryOne } = await import('../config/database');
  const license = await queryOne('SELECT id FROM licenses WHERE license_key = ?', [licenseKey]) as any;

  if (!license) {
    return res.status(404).json({ success: false, message: 'Licença não encontrada' });
  }

  const result = await licenseService.deactivateMachine(license.id, machineFingerprint);
  res.json(result);
}));

// List activated machines
router.post('/machines', validateBody(machinesSchema), asyncHandler(async (req: Request, res: Response) => {
  const { licenseKey } = req.body;

  const { queryOne } = await import('../config/database');
  const license = await queryOne('SELECT id FROM licenses WHERE license_key = ?', [licenseKey]) as any;

  if (!license) {
    return res.status(404).json({ success: false, message: 'Licença não encontrada' });
  }

  const machines = await licenseService.getMachines(license.id);
  res.json({ success: true, data: machines });
}));

export default router;
