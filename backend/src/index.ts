import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router as workflowRoutes } from './routes/workflows';
import { startScheduler } from './engine/scheduler';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', workflowRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Workflow builder API listening on :${PORT}`);
  startScheduler();
});
