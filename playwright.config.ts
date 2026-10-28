import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const chromiumPath=process.env.CHROMIUM_PATH ?? (existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
const engine = process.env.BROWSER_ENGINE ?? 'chromium';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', fullyParallel: false, workers: 1,
  timeout: 30000, expect: { timeout: 5000 }, reporter: [['list'], ['json', {outputFile:'evidence/browser-results.json'}]],
  use: { baseURL: 'http://localhost:5173', viewport: {width:1280,height:1024}, headless:true, trace:'retain-on-failure', screenshot:'only-on-failure' },
  projects: [{name:engine,use:{browserName:engine as 'chromium'|'firefox'|'webkit',...(engine==='chromium'?{launchOptions:{...(chromiumPath?{executablePath:chromiumPath}:{}),args:['--no-sandbox']}}:{})}}],
  webServer: {command:'npm run dev -- --port 5173',url:'http://localhost:5173',reuseExistingServer:true,timeout:30000}
});
