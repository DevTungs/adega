import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody } from '../middleware/validate';
import { clientAuthService } from '../services/client-auth.service';

const router = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username é obrigatório'),
  password: z.string().min(1, 'Senha é obrigatória'),
});

// Login for app users (client-facing, no JWT — authenticated by credentials)
router.post('/login', validateBody(loginSchema), async (req: Request, res: Response) => {
  const { username, password } = req.body;
  const user = await clientAuthService.login(username, password);

  if (!user) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Credenciais inválidas' });
  }

  res.json({ success: true, data: user });
});

export default router;
