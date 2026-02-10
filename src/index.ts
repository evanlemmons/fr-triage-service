import { parseArgs } from 'node:util';
import { loadProductConfig, listAvailableProducts } from './config/loader.js';
import { runTriage } from './pipeline/orchestrator.js';
import { createLogger } from './utils/logger.js';

const FR_DATABASE_ID = 'cf945aaf-4235-4717-9fb9-71717fa0844f';

async function main() {
  const { values } = parseArgs({
    options: {
      product: { type: 'string', short: 'p', default: 'home' },
      'dry-run': { type: 'boolean', default: false },
      backtest: { type: 'boolean', default: false },
      'backtest-days': { type: 'string', default: '7' },
      verbose: { type: 'boolean', short: 'v', default: false },
      'list-products': { type: 'boolean', default: false },
    },
    strict: true,
  });

  const verbose = values.verbose || process.env.VERBOSE === 'true';
  const backtest = values.backtest || process.env.BACKTEST === 'true';
  const backtestDays = parseInt(values['backtest-days'] ?? '7', 10);
  // Backtest always implies dry-run — it should never write to Notion
  const dryRun = backtest || values['dry-run'] || process.env.DRY_RUN === 'true';
  const logger = createLogger(verbose);

  if (backtest) {
    logger.info(`BACKTEST MODE: Re-processing last ${backtestDays} days of FRs (dry-run enforced)`);
  }

  // List available products and exit
  if (values['list-products']) {
    const products = await listAvailableProducts();
    console.log('Available products:');
    for (const p of products) {
      console.log(`  - ${p}`);
    }
    return;
  }

  const productName = values.product!;

  // Handle "all" product mode
  const productNames = productName === 'all'
    ? await listAvailableProducts()
    : [productName];

  for (const name of productNames) {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`Starting triage for product: ${name}`);
    logger.info(`${'='.repeat(60)}`);

    try {
      const config = await loadProductConfig(name);

      const result = await runTriage(
        {
          product: config,
          frDatabaseId: FR_DATABASE_ID,
          dryRun,
          verbose,
          backtest,
          backtestDays,
        },
        logger,
      );

      if (result.status === 'complete') {
        logger.info(`Triage complete for ${name}. Processed ${result.frCount} FRs.`);
      } else if (result.status === 'no_frs') {
        logger.info(`No unprocessed FRs for ${name}.`);
      } else {
        logger.warn(`Triage completed with errors for ${name}.`);
      }
    } catch (err) {
      logger.error(`Triage failed for ${name}: ${err}`);
      if (productNames.length === 1) {
        process.exit(1);
      }
      // Continue with other products if running "all"
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
