import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const HA_URL = env.VITE_HA_URL;
const TOKEN = env.VITE_HA_TOKEN;

const devices = [
  { name: 'fd_sw1', entityId: 'switch.m8_pro_swich_6_switch_1', type: 'switch' },
  { name: 'fd_sw2', entityId: 'switch.m8_pro_swich_6_switch_2', type: 'switch' },
  { name: 'fd_blinds cover', entityId: 'cover.office_curtain_front_door_curtain', type: 'blind' },
  { name: 'fd_fan', entityId: 'fan.front_door_ceiling_fan', type: 'fan' },
  { name: 'lb_sw1', entityId: 'switch.m8_pro_swich_6_switch_3', type: 'switch' },
  { name: 'lb_bulb', entityId: 'switch.smart_plug_bulb_lamp_socket_1', type: 'light' },
  { name: 'lb_fan', entityId: 'fan.lobby_ceiling_fan', type: 'fan' },
  { name: 'lb_ac on', entityId: 'scene.aircon_lobby_on', type: 'scene' },
  { name: 'lb_ac off', entityId: 'scene.aircon_lobby_turn_off', type: 'scene' },
  { name: 'lb_ac auto', entityId: 'scene.aircon_lobby_auto', type: 'scene' },
  { name: 'lb_ac cool', entityId: 'scene.aircon_lobby_cool', type: 'scene' },
  { name: 'dt_ac auto', entityId: 'scene.dev_team_aircon_auto', type: 'scene' },
  { name: 'dt_ac cool', entityId: 'scene.dev_team_aircon_cool', type: 'scene' },
  { name: 'os_carlo', entityId: 'light.carlo_desk', type: 'light' },
  { name: 'os_ronnel', entityId: 'light.ronnel', type: 'light' },
];

const blindScenes = [
  'scene.curtain_fdoor_open', 'scene.curtain_fdoor_close', 'scene.curtain_fdoor_stop',
  'scene.curtain_fdoor_tilt', 'scene.curtain_fdoor_untilt',
  'scene.curtain_lobby_open', 'scene.curtain_back_open',
];

const res = await fetch(`${HA_URL}/api/states`, {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const states = await res.json();
const map = new Map(states.map((s) => [s.entity_id, s]));

console.log('=== ENTITY CHECK ===');
for (const d of devices) {
  const s = map.get(d.entityId);
  console.log(`${s ? 'OK' : 'MISSING'} ${d.entityId} ${s ? `(${s.state})` : ''}`);
}
for (const id of blindScenes) {
  const s = map.get(id);
  console.log(`${s ? 'OK' : 'MISSING'} ${id}`);
}

console.log('\n=== AIRCON RELATED ===');
states.filter((s) => /aircon|climate/i.test(s.entity_id)).forEach((s) => {
  console.log(s.entity_id, s.state);
});
