import { Router } from 'express';
import { SenderController } from '../controllers/sender.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', SenderController.getSenders);
router.post('/', SenderController.createSender);
router.post('/auto-ethereal', SenderController.createEtherealSender);
router.patch('/:id', SenderController.updateSender);
router.delete('/:id', SenderController.deleteSender);

export default router;
