// Office sizes and their ready-made layouts. The back-left corner of the room is always at
// (-18, -12); the room runs `w` metres to the right and `d` metres toward the front.
// A layout is { v, size, w, d, items: [{ uid, type, x, z, rot, ... }], wall }.

export const SIZES = {
  small:    { name: 'Studio',       w: 30, d: 22, blurb: 'A cosy room for a small crew', desks: 4 },
  standard: { name: 'Office',       w: 52, d: 36, blurb: 'The full Head Office floor', desks: 12 },
  large:    { name: 'Headquarters', w: 72, d: 48, blurb: 'Two pits, two lounges, room to grow', desks: 24 },
};
export const X0 = -18, Z0 = -12;
const PI = Math.PI;

let n = 0;
const I = (type, x, z, rot = 0, extra = {}) => ({ uid: `t${(n++).toString(36)}`, type, x, z, rot, ...extra });

// What goes on the walls when a layout doesn't say: windows spaced along the back wall either
// side of the plan-usage board, the logo, a whiteboard and a few prints on the left wall.
export function defaultWall(w, d) {
  const X1 = X0 + w, board = Math.round(X0 + w * 0.54);
  const windows = [];
  for (let x = X0 + 8.5; x < X1 - 3; x += 6) if (Math.abs(x - board) > 3.4) windows.push(x);
  return {
    windows, board, clock: board - 3.7, signs: [], feature: [],
    logoZ: Z0 + 5.5, whiteboardZ: d > 26 ? Z0 + 17 : null,
    prints: [[Z0 + 2, '#f5c04a', '#e05d5d'], ...(d > 20 ? [[Z0 + d - 4, '#d97757', '#f5c04a']] : []), ...(d > 30 ? [[Z0 + 21.4, '#2dd4bf', '#5b8cff']] : [])],
  };
}

// ------------------------------------------------------------------ the classic Head Office
function standardItems() {
  const it = [];
  // kitchen nook and bookshelf on the left wall
  it.push(I('kitchen.counter', X0 + 0.7, -6.5, PI / 2), I('fridge.classic', X0 + 0.7, -10.0, PI / 2), I('storage.bookshelf', X0 + 0.45, -0.5, PI / 2));
  for (const [x, z, s] of [[X0 + 0.6, Z0 + 0.6], [-0.5, Z0 + 0.6, 0.9], [33.4, Z0 + 0.6], [X0 + 0.7, 23.3, 1.1], [6.5, 23.4, 0.85], [33.3, 23.2], [X0 + 0.6, 2.2, 0.9], [33.4, 1.2, 0.9], [33.3, 10.5, 1.05], [X0 + 0.7, 12.4, 0.95]]) it.push(I('plant.cone', x, z, 0, { s: s || 1 }));
  // the Grok Bot pit
  it.push(I('rug.lilac', -5.7, -1.2, 0, { w: 21.2, d: 17.4 }));
  for (const z of [-6.4, -1.0, 4.4]) for (const x of [-13.2, -8.2, -3.2, 1.8]) it.push(I('desk.classic', x, z));
  for (const [x, z] of [[-13.2, -3.9], [-8.2, -3.9], [-3.2, -3.9], [1.8, -3.9], [-10.7, 1.5], [-5.7, 1.5], [-0.7, 1.5]]) it.push(I('pendant.dome', x, z));
  // Claude Studio: a raised terracotta corner with one wide command desk
  it.push(I('platform.terracotta', 13.2, -7.1, 0, { w: 14.4, d: 9.0 }), I('rug.clay-round', 13.2, -6.9, 0, { w: 7.6 }), I('command.terracotta', 13.2, -5.6));
  it.push(I('lamp.arc', 19.6, -3.2), I('storage.manuals', 7.6, -11.1), I('plant.cone', 18.4, -10.8, 0, { s: 1.1 }), I('plant.cone', 7.0, -3.4, 0, { s: 0.8 }));
  // the boss's office: a navy corner behind low glass with a gold rail
  it.push(I('platform.navy', -11.2, 11.6, 0, { w: 11.2, d: 6.0 }), I('rug.gold', -11.2, 11.9, 0, { w: 7.0, d: 4.4 }), I('executive.walnut', -11.2, 11.6));
  it.push(I('partition.brass', -11.2, 14.6, 0, { w: 11.2 }), I('partition.brass', -5.6, 12.5, PI / 2, { w: 4.2 }));
  it.push(I('storage.credenza', -11.2, 9.15), I('lamp.banker', -16.0, 9.3), I('plant.cone', -16.1, 13.9, 0, { s: 0.95 }), I('plant.cone', -6.3, 11.0, 0, { s: 0.8 }));
  it.push(I('armchair.guest', -12.05, 13.3, PI), I('armchair.guest', -10.35, 13.3, PI));
  // the lounge
  it.push(I('rug.navy-round', 12, 7.4, 0, { w: 8 }), I('sofa.teal', 12, 6.0), I('coffee.walnut', 12, 8.3));
  it.push(I('beanbag.pink', 8.4, 8.1), I('beanbag.yellow', 15.6, 7.9), I('beanbag.blue', 8.8, 10.3), I('beanbag.teal', 15.2, 10.2));
  // meeting room
  it.push(I('rug.mauve', -9.5, 17.4, 0, { w: 11, d: 6.4 }), I('table.meeting', -9.5, 17.4), I('screen.tv', -14.1, 17.4), I('plant.cone', X0 + 0.7, 20.8));
  for (const dx of [-2.0, 0, 2.0]) it.push(I('chair.blue', -9.5 + dx, 15.75, 0), I('chair.blue', -9.5 + dx, 19.05, PI));
  // reading nook
  it.push(I('rug.terracotta-round', 3.4, 18.0, 0, { w: 5.8 }), I('armchair.mustard', 1.9, 17.6, 0.5), I('armchair.teal', 4.9, 17.6, -0.5));
  it.push(I('coffee.side', 3.4, 18.4), I('lamp.nook', 6.3, 16.8), I('storage.lowcase', 3.4, 20.3, PI));
  // café bar
  it.push(I('rug.slate', 26.6, 13.0, 0, { w: 7.4, d: 5.0 }), I('kitchen.cafe', 26.6, 12.4));
  for (const dx of [-1.6, 0, 1.6]) it.push(I('chair.stool', 26.6 + dx, 13.55, PI));
  it.push(I('drinks.cooler', 23.6, 9.4), I('drinks.vending', 29.6, 8.2));
  // games corner
  it.push(I('rug.forest', 26.8, 2.2, 0, { w: 7.6, d: 6.2 }), I('games.pingpong', 26.8, 2.6), I('games.arcade-purple', 29.8, -1.6, -PI / 2), I('games.arcade-pink', 29.8, -0.3, -PI / 2));
  // server room
  it.push(I('rug.server-tiles', 27.9, -8.3, 0, { w: 12.2, d: 7.4 }));
  for (let i = 0; i < 5; i++) it.push(I('tech.rack', 23.4 + i * 2.0, -11.2));
  it.push(I('partition.glass', 23.9, -4.6, 0, { w: 4.2 }), I('partition.glass', 31.0, -4.6, 0, { w: 6.0 }), I('partition.glass', 21.8, -8.3, PI / 2, { w: 7.4 }), I('tech.console', 27.0, -7.6));
  // focus pods and the garden along the front
  for (const [x, c] of [[18.2, 'blue'], [21.6, 'yellow'], [25.0, 'teal'], [28.4, 'pink']]) it.push(I(`pod.${c}`, x, 20.9));
  it.push(I('plant.planter', 11.6, 21.9), I('bench.garden', 9.6, 19.9), I('bench.garden', 13.6, 19.9));
  return it;
}
const STANDARD_WALL = {
  windows: [-9.5, -3.5, 2.5, 16.6], board: 10.2, clock: 6.5,
  signs: [{ kind: 'pit', x: -6.5 }, { kind: 'studio', x: 10.2 }, { kind: 'server', x: 27.4 }],
  feature: [[5.6, 21.0, '#ecd3c4'], [21.6, 34, '#cdd5e6']],
  logoZ: -6.5, whiteboardZ: 5.0, prints: [[-10.0, '#f5c04a', '#e05d5d'], [9.4, '#2dd4bf', '#5b8cff'], [21.6, '#d97757', '#f5c04a']],
};

// ------------------------------------------------------------------ a small studio
function smallItems() {
  const it = [];
  it.push(I('kitchen.counter', X0 + 0.7, -6.5, PI / 2), I('fridge.retro', X0 + 0.6, -10.0, PI / 2), I('drinks.cooler', -4.0, -11.2));
  it.push(I('rug.lilac', -9.5, -1.5, 0, { w: 11, d: 9 }));
  for (const z of [-4, 1]) for (const x of [-12, -7]) it.push(I('desk.classic', x, z));
  it.push(I('pendant.dome', -12, -1.5), I('pendant.dome', -7, -1.5));
  it.push(I('platform.terracotta', 5, -8, 0, { w: 10, d: 7 }), I('rug.clay-round', 5, -7.8, 0, { w: 6.6 }), I('command.terracotta', 5, -6.6), I('lamp.arc', 9.3, -5.0), I('plant.monstera', 1.0, -10.8));
  it.push(I('platform.navy', -12.5, 6.6, 0, { w: 10, d: 5.2 }), I('rug.gold', -12.5, 6.9, 0, { w: 6, d: 3.6 }), I('executive.walnut', -12.5, 6.9), I('storage.credenza', -12.5, 4.6));
  it.push(I('armchair.guest', -13.35, 8.6, PI), I('armchair.guest', -11.65, 8.6, PI), I('partition.brass', -7.5, 6.6, PI / 2, { w: 5.2 }), I('plant.cone', -16.9, 8.9, 0, { s: 0.9 }));
  it.push(I('rug.navy-round', 5, 4.4, 0, { w: 6.4 }), I('sofa.midcentury', 5, 3.0), I('coffee.glass', 5, 4.8), I('beanbag.pink', 1.6, 5.8), I('beanbag.yellow', 8.4, 5.8), I('lamp.tripod', 1.2, 2.4));
  it.push(I('games.arcade-purple', 11.0, -0.8, -PI / 2), I('games.foosball', 9.6, 8.4));
  for (const [x, z, s] of [[X0 + 0.6, Z0 + 0.6, 1], [11.3, Z0 + 0.6, 1], [11.3, 3.2, 0.9], [-3.4, 9.3, 0.9]]) it.push(I('plant.cone', x, z, 0, { s }));
  return it;
}
const SMALL_WALL = {
  windows: [-10.5, -4.5], board: 5, clock: 1.4, signs: [{ kind: 'pit', x: -7.5 }, { kind: 'studio', x: 5 }],
  feature: [[-0.4, 10.4, '#ecd3c4']], logoZ: -6.5, whiteboardZ: 1.0, prints: [[-10.3, '#f5c04a', '#e05d5d'], [6.5, '#2dd4bf', '#5b8cff']],
};

// ------------------------------------------------------------------ headquarters: the classic floor plus an east wing and a front row
function largeItems() {
  const it = standardItems().filter((t) => !(t.type === 'plant.cone' && t.x > 33)); // those stood against the old right wall
  it.push(I('partition.glass', 34.0, -8.3, PI / 2, { w: 7.4 })); // the server room gets its own right wall
  // a second pit in the east wing
  it.push(I('rug.lilac', 44.8, -1.2, 0, { w: 18, d: 17.4 }));
  for (const z of [-6.4, -1.0, 4.4]) for (const x of [37.6, 42.4, 47.2, 52.0]) it.push(I('desk.oak', x, z));
  for (const [x, z] of [[40, -3.9], [44.8, -3.9], [49.6, -3.9], [42.4, 1.5], [47.2, 1.5]]) it.push(I('pendant.globe', x, z));
  // east lounge
  it.push(I('rug.navy-round', 44, 13.6, 0, { w: 8 }), I('sofa.chesterfield', 44, 12.2), I('coffee.walnut', 44, 14.4), I('beanbag.pear', 40.6, 14.6), I('beanbag.pouf', 47.4, 14.6), I('lamp.globe', 49.4, 11.4));
  for (const [x, c] of [[38.2, 'blue'], [41.6, 'teal'], [45.0, 'yellow'], [48.4, 'pink']]) it.push(I(`pod.${c}`, x, 20.9));
  // the front row: a second lounge, a library, a games room, a boardroom and a big kitchen
  it.push(I('rug.sand', 0, 29.6, 0, { w: 9, d: 6.4 }), I('sofa.sectional', 0, 28.8), I('coffee.marble', -0.6, 31.2), I('armchair.wingback', -4.0, 31.0, 0.6), I('armchair.egg', 4.2, 31.6, -0.6), I('lamp.tripod', -4.6, 27.4));
  for (const z of [27.6, 30.2, 32.8]) it.push(I('storage.bookshelf', X0 + 0.45, z, PI / 2)); // a library on the left wall
  it.push(I('rug.terracotta-round', -14.4, 30.2, 0, { w: 5.6 }), I('armchair.white', -14.0, 28.8, -PI / 2 + 0.3), I('armchair.wingback', -14.0, 31.6, -PI / 2 - 0.3), I('coffee.side', -13.6, 30.2), I('lamp.nook', -11.6, 33.4));
  it.push(I('rug.forest', 14.5, 29.8, 0, { w: 11, d: 6.4 }), I('games.pool', 12.0, 29.8), I('games.foosball', 17.4, 29.8), I('games.arcade-green', 19.4, 33.0, PI), I('games.arcade-purple', 17.9, 33.0, PI));
  it.push(I('rug.mauve', 30, 30, 0, { w: 11, d: 6.4 }), I('table.boardroom', 30, 30), I('screen.whiteboard', 25.2, 30));
  for (const dx of [-2.0, 0, 2.0]) it.push(I('chair.task', 30 + dx, 28.35, 0), I('chair.task', 30 + dx, 31.65, PI));
  it.push(I('rug.checker', 45, 30.4, 0, { w: 14, d: 10 }), I('kitchen.island', 45, 29.6), I('kitchen.sink', 45, 34.9, PI), I('fridge.steel', 50.6, 35.0, PI), I('fridge.glass', 39.6, 35.0, PI));
  for (const dx of [-0.9, 0.9]) it.push(I('chair.stool-wood', 45 + dx, 31.0, PI));
  it.push(I('table.round', 51.4, 27.4), I('chair.shell', 50.0, 27.4, PI / 2), I('chair.shell', 52.8, 27.4, -PI / 2));
  for (const [x, z, s] of [[53.4, Z0 + 0.6, 1], [53.3, 9.0, 1], [53.3, 23.2, 1], [53.4, 35.4, 1], [X0 + 0.7, 26.0, 1], [22.6, 35.4, 0.9], [7.4, 35.4, 0.9]]) it.push(I('plant.palm', x, z, 0, { s }));
  return it;
}
const LARGE_WALL = {
  ...STANDARD_WALL,
  windows: [-9.5, -3.5, 2.5, 16.6, 38.6, 45.0, 51.0], signs: [...STANDARD_WALL.signs, { kind: 'pit', x: 41.8 }],
  feature: [[5.6, 21.0, '#ecd3c4'], [21.6, 34.2, '#cdd5e6']],
};

export function makeLayout(size, furnished) {
  const s = SIZES[size] || SIZES.standard;
  n = 0;
  const items = !furnished ? [] : size === 'small' ? smallItems() : size === 'large' ? largeItems() : standardItems();
  const wall = !furnished ? defaultWall(s.w, s.d) : size === 'small' ? SMALL_WALL : size === 'large' ? LARGE_WALL : STANDARD_WALL;
  return { v: 1, size, w: s.w, d: s.d, furnished: !!furnished, items, wall: structuredClone(wall) };
}
