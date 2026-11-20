import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Google OAuth routes
router.get('/google', AuthController.googleRedirect);
router.get('/google/callback', AuthController.googleCallback);
router.post('/google', AuthController.googleLogin);
router.post('/demo', AuthController.demoLogin);

// Current session and logout
router.get('/me', requireAuth, AuthController.getCurrentUser);
router.post('/logout', AuthController.logout);

export default router;
