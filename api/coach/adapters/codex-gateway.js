/* A Codex CLI provider routed through an administrator-configured Responses API gateway.
 *
 * This is separate from the regular Codex login-cache provider. The gateway credential is
 * supplied only through a job-scoped environment variable, and every provider setting is
 * explicit on argv. In particular, --ignore-user-config prevents a host config.toml from
 * silently replacing the endpoint selected in the Coach admin page.
 */
import { run } from './spawn.js';
import { argvFor } from './codex.js';
import { baseUrlFor, isGatewayModel, validateGatewayBaseUrl } from '../core/providers.js';

const CLI = 'codex';
const ID = 'codex-gateway';
const PROVIDER_ID = 'opengym_coach_gateway';
const KEY_ENV = 'CODEX_GATEWAY_API_KEY';

function settings(cfg, env, model) {
  const checked = validateGatewayBaseUrl(baseUrlFor(ID, cfg));
  if (!checked.ok) return { error: checked.error };
  if (!checked.value) return { error: 'Set a valid Codex gateway API base URL, including its API path (for example /v1).' };
  // --model consumes the following argv item; reject option-looking aliases so a hand-edited
  // coach.json cannot turn a model name into an extra CLI flag.
  if (!isGatewayModel(model)) {
    return { error: 'Set the model name supplied by your Codex gateway.' };
  }
  if (!env?.[KEY_ENV]) return { error: 'Connect a Codex gateway API key.', needsKey: true };
  return { baseUrl: checked.value, model: model.trim() };
}

/** Build CLI config overrides as fixed keys plus TOML-safe string values; no shell is used. */
export function argvForGateway(cfg, model) {
  const baseUrl = baseUrlFor(ID, cfg);
  return [
    ...argvFor(model),
    '--sandbox', 'read-only',
    '-c', `model_provider=${JSON.stringify(PROVIDER_ID)}`,
    '-c', `model_providers.${PROVIDER_ID}.name="OpenGym Coach gateway"`,
    '-c', `model_providers.${PROVIDER_ID}.base_url=${JSON.stringify(baseUrl)}`,
    '-c', `model_providers.${PROVIDER_ID}.wire_api="responses"`,
    '-c', `model_providers.${PROVIDER_ID}.env_key="${KEY_ENV}"`,
    '-c', 'web_search="disabled"'
  ];
}

export default {
  id: ID,
  spawns: true,
  cli: CLI,

  async check(cfg, env) {
    const selected = settings(cfg, env, cfg?.models?.[ID]);
    if (selected.error) return { ok: false, error: selected.error, needsKey: !!selected.needsKey };
    const r = await run(CLI, ['--version'], { env, timeoutMs: 20000 });
    if (r.spawnError) return { ok: false, error: `the ${CLI} CLI is not installed in this image` };
    if (r.timedOut) return { ok: false, error: `the ${CLI} CLI did not respond` };
    if (r.code !== 0) return { ok: false, error: (r.stderr || '').trim().slice(0, 300) || `${CLI} --version exited ${r.code}` };
    return { ok: true, version: (r.stdout || '').trim() };
  },

  async invoke({ cfg, prompt, jobDir, env, model, timeoutMs }) {
    const selected = settings(cfg, env, model);
    if (selected.error) return { code: -1, text: '', stderr: selected.error };
    const r = await run(CLI, argvForGateway(cfg, selected.model), {
      stdin: prompt, cwd: jobDir, env, timeoutMs
    });
    return { ...r, text: (r.stdout || '').trim() };
  }
};
