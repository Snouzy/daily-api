import { tracer } from '../src/telemetry/opentelemetry';
import { startMetrics } from '../src/telemetry/metrics';
import { parseArgs } from 'node:util';
import api from '../src';
import background from '../src/background';
import cron from '../src/cron';
import personalizedDigest from '../src/commands/personalizedDigest';

async function run(positionals: string[]) {
  switch (positionals[0]) {
    case 'api':
      tracer('api').start();
      startMetrics('api');
      const app = await api();
      await app.listen({
        port: parseInt(process.env.PORT) || 3000,
        host: '0.0.0.0',
      });
      break;
    case 'background':
      tracer('background').start();
      startMetrics('background');
      await background();
      break;
    case 'cron':
      tracer('cron').start();
      startMetrics('cron');
      await cron(positionals[1]);
      process.exit();
      break;
    case 'personalized-digest':
      tracer('personalized-digest').start();
      startMetrics('personalized-digest');
      await personalizedDigest();
      break;
    default:
      console.log('unknown command');
      process.exit();
      break;
  }
}

const { positionals } = parseArgs({
  allowPositionals: true,
});

run(positionals).catch((err) => {
  console.error(err);
  process.exit(1);
});
