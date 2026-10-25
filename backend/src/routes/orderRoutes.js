import express from 'express';
import { createOrderFromCart } from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// POST /api/orders/checkout -> Creates order from the user's active cart document
router.route('/checkout').post(protect, createOrderFromCart);

export default router;