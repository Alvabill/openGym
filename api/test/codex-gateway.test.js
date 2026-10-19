import test from 'node:test';
import assert from 'node:assert/strict';
import { tempData } from './helpers.mjs';

tempData();
const cfg = await import('../coach/config.js');
const { adapterFor } = await import('../coach/adapters/index.js');
const { argvForGateway } = await import('../coach/adapters/codex-gateway.js');

const URL = 'https://gateway.example.com/v1';
const model = 'gpt-6.1-sol';
const config = { provider: 'codex-gateway', models: { 'codex-gateway': model },
  providerOptions: { 'codex-gateway': { baseUrl: URL } } };

test('Codex gateway uses isolated CLI settings and never puts its key on argv', () => {
  const argv = argvForGateway(config, model);
  assert.deepEqual(argv.slice(0, 7), [
    'exec', '-', '--skip-git-repo-check', '--ephemeral', '--ignore-user-config', '--model', model
  ]);
  assert.ok(argv.includes('--sandbox'));
  assert.equal(argv[argv.indexOf('--sandbox') + 1], 'read-only');
  const settings = argv.filter((item, i) => argv[i - 1] === '-c');
  assert.ok(settings.includes('model_provider="opengym_coach_gateway"'));
  assert.ok(settings.includes(`model_providers.opengym_coach_gateway.base_url="${URL}"`));
  assert.ok(settings.includes('model_providers.opengym_coach_gateway.wire_api="responses"'));
  assert.ok(settings.includes('model_providers.opengym_coach_gateway.env_key="CODEX_GATEWAY_API_KEY"'));
  assert.ok(settings.includes('web_search="disabled"'));
  assert.ok(!argv.join(' ').includes('dummy-secret'));
});

test('gateway configuration requires a URL, model, and API key before invoking Codex', async () => {
  const adapter = adapterFor('codex-gateway');
  assert.equal(adapter.spawns, true);
  assert.equal(cfg.PROVIDERS['codex-gateway'].http, undefined);
  assert.equal(cfg.PROVIDERS['codex-gateway'].baseUrl, true);
  assert.equal(cfg.PROVIDERS['codex-gateway'].keyOptional, undefined);

  let r = await adapter.check({ ...config, providerOptions: {} }, { CODEX_GATEWAY_API_KEY: 'dummy-secret' });
  assert.match(r.error, /base URL/);
  r = await adapter.check({ ...config, providerOptions: { 'codex-gateway': { baseUrl: 'http://gateway.example.com/v1' } } }, { CODEX_GATEWAY_API_KEY: 'dummy-secret' });
  assert.match(r.error, /requires HTTPS/, 'a hand-edited config also cannot send the key over HTTP');
  r = await adapter.check({ ...config, models: {} }, { CODEX_GATEWAY_API_KEY: 'dummy-secret' });
  assert.match(r.error, /model name/);
  r = await adapter.check({ ...config, models: { 'codex-gateway': '--dangerously-bypass-approvals-and-sandbox' } }, { CODEX_GATEWAY_API_KEY: 'dummy-secret' });
  assert.match(r.error, /model name/, 'a model alias cannot become a CLI option');
  r = await adapter.check(config, {});
  assert.equal(r.needsKey, true);
  assert.match(r.error, /API key/);

  r = await adapter.invoke({ cfg: config, model: null, env: { CODEX_GATEWAY_API_KEY: 'dummy-secret' } });
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /model name/);
});

test('gateway key is scoped to this provider and it cannot inherit the Codex login cache', () => {
  cfg.reset();
  cfg.save({ enabled: true, provider: 'codex-gateway', auth: {}, models: {}, providerOptions: {}, boundUid: {} });
  assert.equal(cfg.isConnected(), false);
  cfg.saveAuth('codex-gateway', { type: 'apikey', data: cfg.encrypt({ token: 'dummy-secret' }) });
  assert.equal(cfg.isConnected(), false, 'a key alone must not expose an unconfigured Coach');
  cfg.saveOptions('codex-gateway', { baseUrl: URL });
  assert.equal(cfg.isConnected(), false, 'a model alias is required too');
  cfg.saveModel('codex-gateway', model);
  assert.equal(cfg.isConnected(), true);
  cfg.saveOptions('codex-gateway', { baseUrl: 'http://gateway.example.com/v1' });
  assert.equal(cfg.isConnected(), false, 'a hand-edited plaintext gateway is not offered to users');
  cfg.saveOptions('codex-gateway', { baseUrl: URL });
  cfg.saveModel('codex-gateway', '   ');
  assert.equal(cfg.isConnected(), false, 'a hand-edited blank model is not offered to users');
  cfg.saveModel('codex-gateway', model);
  const env = cfg.jobEnv('/tmp/coach-job', cfg.credentialFor('alice'));
  assert.equal(env.CODEX_GATEWAY_API_KEY, 'dummy-secret');
  assert.equal(env.CODEX_API_KEY, undefined);
  assert.equal(env.CODEX_HOME, undefined);
  assert.equal(env.HOME, '/tmp/coach-job');
  assert.deepEqual(Object.keys(env).sort(), ['CODEX_GATEWAY_API_KEY', 'HOME', 'PATH', 'TMPDIR']);
});
