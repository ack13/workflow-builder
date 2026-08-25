import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { router as workflowRoutes } from './routes/workflows';
import { startScheduler } from './engine/scheduler';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', workflowRoutes);

app.get('/', (_req, res) => {
  res.json({ service: 'workflow-builder-api', status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Workflow builder API listening on :${PORT}`);
  startScheduler();
});
