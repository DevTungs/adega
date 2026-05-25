import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { licenseService } from '../services/license.service';

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

// Activate license (client-facing, no JWT — authenticated by license key)
router.post('/activate', validateBody(activateSchema), async (req: Request, res: Response) => {
  const { licenseKey, machineFingerprint, appId } = req.body;
  const result = await licenseService.activate(licenseKey, machineFingerprint, appId);
  res.json(result);
});

// Validate license (client-facing, no JWT — authenticated by license key)
router.post('/validate', validateBody(validateSchema), async (req: Request, res: Response) => {
  const { licenseKey, machineFingerprint, appId } = req.body;
  const result = await licenseService.validate(licenseKey, machineFingerprint, appId);
  res.json(result);
});

export default router;
