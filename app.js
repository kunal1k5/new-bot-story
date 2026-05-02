const http = require('http');
const { logError, setupGlobalErrorHandlers } = require('./src/utils/errorHandler');

setupGlobalErrorHandlers();

const connectDB = require('./src/database/connection');
const { startScheduler } = require('./src/bot/scheduler');

function startHealthServer() {
  const port = Number(process.env.PORT);

  if (!Number.isFinite(port) || port <= 0) {
    return;
  }

  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'telegram-story-bot' }));
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`Health server listening on port ${port}`);
  });
}

async function startApp() {
  startHealthServer();
  await connectDB();

  const bot = require('./src/bot/bot');
  startScheduler(bot);

  console.log('🤖 Bot is running...');
}

startApp().catch((error) => {
  logError('Failed to start app', error);
  process.exit(1);
});
