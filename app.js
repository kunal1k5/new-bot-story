const { logError, setupGlobalErrorHandlers } = require('./src/utils/errorHandler');

setupGlobalErrorHandlers();

const connectDB = require('./src/database/connection');
const { startScheduler } = require('./src/bot/scheduler');

async function startApp() {
  await connectDB();

  const bot = require('./src/bot/bot');
  startScheduler(bot);

  console.log('🤖 Bot is running...');
}

startApp().catch((error) => {
  logError('Failed to start app', error);
  process.exit(1);
});
