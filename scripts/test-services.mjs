import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const HA_URL = env.VITE_HA_URL;
const TOKEN = env.VITE_HA_TOKEN;
const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

async function callService(domain, service, entityId, data = {}) {
  const res = await fetch(`${HA_URL}/api/services/${domain}/${service}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ entity_id: entityId, ...data }),
  });
  return { ok: res.ok, status: res.status };
}

const tests = [
  ['switch read', 'GET', `${HA_URL}/api/states/switch.m8_pro_swich_6_switch_1`],
  ['weather read', 'GET', `${HA_URL}/api/states/weather.forecast_home`],
  ['blind scene open', 'POST', ['scene', 'turn_on', 'scene.curtain_fdoor_open']],
  ['blind scene stop', 'POST', ['scene', 'turn_on', 'scene.curtain_fdoor_stop']],
  ['aircon lobby on scene', 'POST', ['scene', 'turn_on', 'scene.aircon_lobby_on']],
  ['aircon dev auto scene', 'POST', ['scene', 'turn_on', 'scene.dev_team_aircon_auto']],
  ['fan percentage', 'POST', ['fan', 'turn_on', 'fan.lobby_ceiling_fan', { percentage: 33 }]],
  ['bulb switch', 'POST', ['switch', 'turn_on', 'switch.smart_plug_bulb_lamp_socket_1']],
];

console.log('=== SERVICE TESTS ===');
for (const test of tests) {
  if (test[1] === 'GET') {
    const res = await fetch(test[2], { headers });
    console.log(`${res.ok ? 'PASS' : 'FAIL'} ${test[0]} (${res.status})`);
  } else {
    const [domain, service, entityId, data] = test[2];
    const result = await callService(domain, service, entityId, data ?? {});
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${test[0]} (${result.status})`);
  }
}
