import express from 'express';
import orderRoutes from './routes/orderRoutes.js';

const app = express();

app.use(express.json());

// Mount routes
app.use('/api/orders', orderRoutes);