import { Router } from 'express';
import { SlackController } from '../controllers/slack.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

// OAuth callback is called by Slack's redirect (contains state=userId)
router.get('/callback', SlackController.callback);

// Authenticated Slack actions
router.get('/connect', requireAuth, SlackController.connect);
router.get('/status', requireAuth, SlackController.status);
router.post('/disconnect', requireAuth, SlackController.disconnect);

export default router;
