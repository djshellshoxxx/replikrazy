// Optional test tooling remains external to the application and lockfile.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
export const requireTools = createRequire(resolve(process.env.BROWSER_TEST_TOOLS ?? '.', 'package.json'));
export const browserEngine = process.env.BROWSER_ENGINE ?? 'chromium';
export async function launchBrowser() {
  if (!['chromium', 'firefox', 'webkit'].includes(browserEngine)) throw new Error('BROWSER_ENGINE must be chromium, firefox or webkit');
  const playwright = requireTools('playwright-core');
  const executablePath = process.env.BROWSER_EXECUTABLE ?? (browserEngine === 'chromium' ? process.env.CHROMIUM_PATH ?? '/usr/bin/chromium' : undefined);
  // This runner never installs/downloads a browser or changes security policy.
  return playwright[browserEngine].launch({ executablePath, ...(browserEngine === 'chromium' ? { args: ['--no-sandbox'] } : {}) });
}
