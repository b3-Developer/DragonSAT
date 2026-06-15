import express, { Express } from 'express';
import 'dotenv/config';
import { corsMiddleware } from './middleware/cors';
import { requireAuth, requireAdmin } from './middleware/auth';
import { initializeDatabase } from './db/init';
import { loadOpenSATData } from './services/opensat';
import questionsRouter from './routes/questions';
import { createProgressRouter } from './routes/progress';
import { createAuthRouter } from './routes/auth';
import { createAdminRouter } from './routes/admin';

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(corsMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize database
    console.log('Initializing database...');
    const db = await initializeDatabase();

    // Routes
    app.use('/api', questionsRouter);
    app.use('/api/auth', createAuthRouter(db));
    app.use('/api/progress', requireAuth, createProgressRouter(db));
    app.use('/api/admin', requireAdmin, createAdminRouter(db));

    // 404 handler
    app.use((_req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not found',
      });
    });

    // Error handler
    app.use(
      (
        err: Error,
        _req: express.Request,
        res: express.Response,
        _next: express.NextFunction
      ) => {
        console.error('Server error:', err);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    );

    app.listen(PORT, () => {
      console.log(`DragonSAT backend listening on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      // Load question data after server is up — failure is non-fatal
      console.log('Loading OpenSAT data...');
      loadOpenSATData().catch(() => {});
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
