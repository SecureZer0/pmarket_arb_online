import { runAiMatchChecker } from '../../src/aiMatching/aiMatchChecker.js';

async function main(): Promise<void> {
  await runAiMatchChecker(5);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


