import { Zone } from '../types';

export const ZONE_CONFIG: Zone[] = [
  {
    id: 'front_door',
    name: 'Front Door',
    devices: [
      { id: 'fd_sw1', entityId: 'switch.m8_pro_swich_6_switch_1', name: 'Front door 1', type: 'switch', isOn: false },
      { id: 'fd_sw2', entityId: 'switch.m8_pro_swich_6_switch_2', name: 'Front door 2', type: 'switch', isOn: false },
      {
        id: 'fd_blinds',
        entityId: 'cover.office_curtain_front_door_curtain',
        name: 'Blinds',
        type: 'blind',
        isOn: false,
        blindScenes: {
          open: 'scene.curtain_fdoor_open',
          close: 'scene.curtain_fdoor_close',
          stop: 'scene.curtain_fdoor_stop',
          tilt: 'scene.curtain_fdoor_tilt',
          open_tilt: 'scene.curtain_fdoor_untilt',
        },
      },
      { id: 'fd_fan', entityId: 'fan.front_door_ceiling_fan', name: 'Ceiling Fan', type: 'fan', isOn: false },
    ],
  },
  {
    id: 'lobby',
    name: 'Lobby',
    devices: [
      { id: 'lb_sw1', entityId: 'switch.m8_pro_swich_6_switch_3', name: 'Lobby 1', type: 'switch', isOn: false },
      { id: 'lb_sw2', entityId: 'switch.m8_pro_swich_6_switch_4', name: 'Lobby 2', type: 'switch', isOn: false },
      { id: 'lb_sw3', entityId: 'switch.light_switch_breaker_side_1_switch_4', name: 'Lobby 3', type: 'switch', isOn: false },
      {
        id: 'lb_bulb',
        entityId: 'switch.smart_plug_bulb_lamp_socket_1',
        name: 'Bulb Lamp',
        type: 'light',
        isOn: false,
      },
      { id: 'lb_fan', entityId: 'fan.lobby_ceiling_fan', name: 'Ceiling Fan', type: 'fan', isOn: false },
      {
        id: 'lb_ac',
        entityId: 'scene.aircon_lobby_on',
        name: 'Aircon',
        type: 'aircon',
        isOn: false,
        airconScenes: {
          on: 'scene.aircon_lobby_on',
          off: 'scene.aircon_lobby_turn_off',
        },
      },
      {
        id: 'lb_blinds',
        entityId: 'cover.office_curtain_front_right_side_curtain',
        name: 'Blinds Lobby',
        type: 'blind',
        isOn: false,
        blindScenes: {
          open: 'scene.curtain_lobby_open',
          close: 'scene.curtain_lobby_close',
          stop: 'scene.curtain_lobby_stop',
          tilt: 'scene.curtain_lobby_tilt',
          open_tilt: 'scene.curtain_lobby_untilt',
        },
      },
    ],
  },
  {
    id: 'dev_team',
    name: 'Dev Team',
    devices: [
      { id: 'dt_sw1', entityId: 'switch.light_switch_breaker_side_2_switch_4', name: 'Switch Front', type: 'switch', isOn: false },
      { id: 'dt_sw2', entityId: 'switch.light_switch_breaker_side_2_switch_3', name: 'Switch Middle', type: 'switch', isOn: false },
      { id: 'dt_sw3', entityId: 'switch.light_switch_breaker_side_2_switch_2', name: 'Switch Back', type: 'switch', isOn: false },
      { id: 'dt_fan1', entityId: 'fan.dev_team_fan_1', name: 'Fan 1', type: 'fan', isOn: false },
      { id: 'dt_fan2', entityId: 'fan.dev_team_fan_2', name: 'Fan 2', type: 'fan', isOn: false },
      {
        id: 'dt_ac',
        entityId: 'scene.dev_team_aircon_turn_on',
        name: 'Aircon',
        type: 'aircon',
        isOn: false,
        airconScenes: {
          on: 'scene.dev_team_aircon_turn_on',
          off: 'scene.dev_team_aircon_turn_off',
          auto: 'scene.dev_team_aircon_auto',
          cool: 'scene.dev_team_aircon_cool',
        },
      },
      {
        id: 'dt_blinds',
        entityId: 'cover.office_curtain_back_curtain',
        name: 'Blinds Back',
        type: 'blind',
        isOn: false,
        blindScenes: {
          open: 'scene.curtain_back_open',
          close: 'scene.curtain_back_close',
          stop: 'scene.curtain_back_stop',
          tilt: 'scene.curtain_back_tilt',
          open_tilt: 'scene.curtain_back_untilt',
        },
      },
    ],
  },
  {
    id: 'desks',
    name: 'Desks & Signage',
    devices: [
      { id: 'os_indoor', entityId: 'switch.indoor_signage_socket_1', name: 'Indoor Signage', type: 'switch', isOn: false },
      { id: 'os_outdoor', entityId: 'switch.ronnel_plug_socket_1', name: 'Outdoor Signage', type: 'switch', isOn: false },
      { id: 'os_boss', entityId: 'switch.light_switch_breaker_side_2_switch_1', name: 'Boss Joe Desk', type: 'switch', isOn: false },
      { id: 'os_carlo', entityId: 'light.carlo_desk', name: 'Sir Carlo Lamp', type: 'light', isOn: false },
      { id: 'os_ronnel', entityId: 'light.ronnel', name: 'Ronnel Lamp', type: 'light', isOn: false },
    ],
  },
];
