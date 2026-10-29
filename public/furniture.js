// The furniture shop. Every piece in the office is one of these designs, placed by the layout
// (see layouts.js). Designs share a category, and "Replace" only ever offers the same category,
// so a sofa becomes another sofa and a fridge another fridge.
//
// Each design draws itself at the origin in local space, front toward +z, and reports what the
// office needs to know about it: where bots can sit (`seats`), stand (`spots`), work (`desk`),
// what's solid underfoot (`solids`, default: its whole footprint), and any lamp it carries.

export const CATEGORIES = [
  ['desk', 'Desks'], ['executive', 'Boss desks'], ['command', 'Command desks'],
  ['sofa', 'Sofas'], ['armchair', 'Armchairs'], ['beanbag', 'Beanbags'], ['chair', 'Chairs & stools'], ['bench', 'Benches'], ['pod', 'Focus pods'],
  ['table', 'Tables'], ['coffee', 'Coffee & side tables'], ['storage', 'Cupboards & shelves'],
  ['fridge', 'Fridges'], ['kitchen', 'Kitchen & café'], ['drinks', 'Drinks'],
  ['games', 'Games'], ['tech', 'Tech'], ['screen', 'Screens & boards'],
  ['lamp', 'Floor lamps'], ['pendant', 'Ceiling lights'], ['plant', 'Plants'],
  ['rug', 'Rugs & floors'], ['platform', 'Platforms'], ['partition', 'Walls & dividers'],
];

// What can be handed to a bot as its own place: it works there and goes back there to rest.
export const ASSIGNABLE = new Set(['desk', 'executive', 'command', 'sofa', 'armchair', 'beanbag', 'chair', 'bench', 'pod']);

export function makeCatalog(k) {
  const { THREE, mat } = k;
  const B = (g) => (w, h, d, c, x = 0, y = 0, z = 0, o = {}) => k.box(w, h, d, c, x, y, z, { parent: g, ...o });
  const C = (g) => (rt, rb, h, c, x = 0, y = 0, z = 0, o = {}) => k.cyl(rt, rb, h, c, x, y, z, { parent: g, ...o });
  const mesh = (g, geo, m, x, y, z, live = false) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; if (live) o.userData.live = true; g.add(o); return o; };
  const GLASS = { transparent: true, opacity: 0.2, depthWrite: false, roughness: 0.08, metalness: 0.1 };
  const CHROME = { metalness: 0.75, roughness: 0.25 };
  const { BRASS, spine } = k;
  const front = (d, gap = 0.8) => [[0, d / 2 + gap, Math.PI]]; // a standing spot facing the thing

  const list = [];
  const add = (cat, id, name, w, d, h, build, extra = {}) => list.push({ cat, id: `${cat}.${id}`, name, w, d, h, build, ...extra });

  // ------------------------------------------------------------ desks
  // A monitor off to one side and angled in, so the screen faces the agent (who sits at -z) and
  // we can still see their face, plus the soft glow pool the office tints with their status.
  const monitor = (g, x = 0.55, z = -0.2, rot = -0.45, w = 1.0, shell = '#1f1d2b') => {
    const mon = new THREE.Group(); mon.position.set(x, 0, z); mon.rotation.y = rot; g.add(mon);
    const b = B(mon);
    b(w, w * 0.62, 0.07, shell, 0, 1.22, 0, { r: 0.03 });
    b(0.07, 0.26, 0.07, shell, 0, 0.98, 0.03, { ink: false });
    b(0.36, 0.03, 0.22, shell, 0, 0.96, 0.03, { r: 0.01, ink: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.08, w * 0.54), new THREE.MeshStandardMaterial({ color: '#111', emissive: '#000', roughness: 0.3 }));
    screen.position.set(0, 1.22 + w * 0.31, -0.04); screen.rotation.y = Math.PI; screen.userData.live = true; mon.add(screen);
    return screen;
  };
  const officeChair = (g, z, c, style = 'task') => {
    const ch = new THREE.Group(); ch.position.set(0, 0, z); g.add(ch);
    const b = B(ch), cy = C(ch);
    cy(0.05, 0.05, 0.45, '#2a2638'); cy(0.32, 0.32, 0.04, '#2a2638');
    b(0.75, 0.1, 0.7, c, 0, 0.45, 0, { r: 0.05 });
    if (style === 'racer') { b(0.7, 1.15, 0.12, c, 0, 0.55, -0.35, { r: 0.06 }); b(0.5, 0.9, 0.13, '#1f1d2b', 0, 0.68, -0.35, { r: 0.05, ink: false }); for (const sx of [-0.4, 0.4]) b(0.08, 0.22, 0.5, '#1f1d2b', sx, 0.55, 0, { r: 0.03, ink: false }); }
    else if (style === 'leather') { b(0.78, 0.95, 0.14, c, 0, 0.5, -0.36, { r: 0.07 }); for (const sx of [-0.42, 0.42]) b(0.1, 0.2, 0.55, c, sx, 0.55, 0, { r: 0.04 }); }
    else b(0.75, 0.8, 0.1, c, 0, 0.55, -0.35, { r: 0.05 });
  };
  const DESK_SOLIDS = [[0, 0, 2.4, 1.2], [0, -1.3, 0.75, 0.7, 0.25]];
  const desk = (id, name, o) => add('desk', id, name, 2.4, 1.2, 1.6, (g, it) => {
    const b = B(g);
    if (o.glass) b(2.4, 0.05, 1.2, '#cfe9ff', 0, 0.94, 0, { r: 0.02, ink: false, cast: false, opts: GLASS });
    else b(2.4, 0.08, 1.2, o.top, 0, 0.92, 0, { r: 0.03 });
    if (o.trim) b(2.3, 0.04, 0.05, o.trim, 0, 0.88, 0.56, { r: 0.01, ink: false, opts: o.trimGlow ? { emissive: o.trim, emissiveIntensity: 1.6 } : undefined });
    if (o.legs === 'trestle') for (const lx of [-0.95, 0.95]) { b(0.08, 0.9, 1.0, o.leg, lx, 0, 0, { r: 0.03 }); b(0.1, 0.08, 1.1, o.leg, lx, 0, 0, { r: 0.02, ink: false }); }
    else if (o.legs === 'panel') for (const lx of [-1.12, 1.12]) b(0.12, 0.92, 1.15, o.leg, lx, 0, 0, { r: 0.02 });
    else for (const [lx, lz] of [[-1.1, -0.5], [1.1, -0.5], [-1.1, 0.5], [1.1, 0.5]]) b(0.07, 0.92, 0.07, o.leg, lx, 0, lz, { r: 0.02, ink: false, opts: o.chrome ? CHROME : undefined });
    const screen = monitor(g);
    if (o.second) { const s2 = monitor(g, -0.5, -0.25, 0.4, 0.8); s2.userData.mirror = true; }
    officeChair(g, -1.3, o.chair, o.chairStyle);
    k.deskProps(it.theme || 'ops', g, it.accent || '#5b8cff');
    return { solids: DESK_SOLIDS, desk: { seat: [0, 0.55, -1.25], screen, pool: k.pool(g, 1.9, 1.1, 0.15, 1.004, -0.3) } };
  }, { hit: [0, -0.6, 2.5, 2.5, 1.6] });
  desk('classic', 'Classic white', { top: '#f2eef8', leg: '#2a2638', trim: '#d9d2e6', chair: '#3b3552' });
  desk('walnut', 'Walnut', { top: '#7b5a43', leg: '#3b2f2a', trim: '#5f4533', chair: '#5a3d2b', chairStyle: 'leather', legs: 'panel' });
  desk('oak', 'Oak trestle', { top: '#d2ad80', leg: '#7a5a3c', chair: '#2f7a4c', legs: 'trestle' });
  desk('gamer', 'Battle station', { top: '#1f1d2b', leg: '#2a2638', trim: '#f472b6', trimGlow: true, chair: '#e05d5d', chairStyle: 'racer', second: true });
  desk('glass', 'Glass top', { glass: true, leg: '#c9ccd6', chrome: true, chair: '#f4f1fa' });
  desk('pastel', 'Mint & blush', { top: '#bfe8d8', leg: '#f4f1fa', trim: '#a6dcc7', chair: '#f2a7bb' });

  // ------------------------------------------------------------ the boss's desk
  // Wide, with a modesty panel toward the room carrying the boss's nameplate, and a tall chair.
  const exec = (id, name, o) => add('executive', id, name, 3.2, 1.4, 1.6, (g, it) => {
    const b = B(g), c = C(g);
    b(3.2, 0.1, 1.4, o.top, 0, 0.88, 0, { r: 0.04, opts: o.topOpts });
    b(3.1, 0.82, 0.08, o.body, 0, 0.06, 0.62, { r: 0.02 });
    for (const sx of [-1.3, 1.3]) b(0.5, 0.88, 1.3, o.body, sx, 0, 0, { r: 0.03 });
    b(3.1, 0.04, 0.05, o.trim, 0, 0.8, 0.68, { r: 0.01, ink: false, opts: BRASS });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375), new THREE.MeshStandardMaterial({ map: k.BOSS_SIGN, transparent: true, roughness: 0.5, emissive: '#ffffff', emissiveMap: k.BOSS_SIGN, emissiveIntensity: 0.15 }));
    plate.position.set(0, 0.48, 0.67); plate.userData.live = true; g.add(plate);
    const screen = monitor(g, 0.7, -0.25, -0.45, 1.1);
    c(0.12, 0.14, 0.04, '#c9a227', -1.05, 0.98, -0.1, { opts: BRASS }); c(0.02, 0.02, 0.3, '#c9a227', -1.05, 1.0, -0.1, { opts: BRASS });
    const banker = b(0.5, 0.12, 0.18, o.lamp, -1.05, 1.28, -0.05, { r: 0.06, opts: { emissive: '#ffd27a', emissiveIntensity: 0.2 } });
    banker.material = banker.material.clone(); banker.userData.live = true;
    k.toy(-1.05, 0.95, -0.1, 0.65, 0.5, 0.45, { kind: 'lamp', on: it.on ?? true, apply(t) { banker.material.emissiveIntensity = this.on ? 0.2 + t.lamps * 0.4 : 0; } }, g);
    c(0.1, 0.09, 0.17, '#f4f1fa', -0.45, 0.98, 0.25); b(0.3, 0.05, 0.14, '#2a2638', 0.1, 0.98, 0.35, { r: 0.02, ink: false });
    const ch = new THREE.Group(); ch.position.set(0, 0, -1.3); g.add(ch);
    const cb = B(ch), cc = C(ch);
    cc(0.06, 0.06, 0.42, '#2a2638'); cc(0.36, 0.36, 0.04, '#2a2638');
    cb(0.86, 0.14, 0.8, o.chair, 0, 0.42, 0, { r: 0.06 }); cb(0.9, 1.25, 0.16, o.chair, 0, 0.5, -0.4, { r: 0.08 });
    for (const ax of [-0.45, 0.45]) cb(0.1, 0.26, 0.7, o.arm, ax, 0.56, 0, { r: 0.04 });
    return { solids: [[0, 0, 3.2, 1.4], [0, -1.3, 0.86, 0.8, 0.25]], desk: { boss: true, seat: [0, 0.55, -1.3], screen, pool: k.pool(g, 2.2, 1.2, 0.2, 0.984, -0.3) } };
  }, { hit: [0, -0.6, 3.3, 2.7, 1.6] });
  exec('walnut', 'Walnut executive', { top: '#6b4a35', body: '#5a3d2b', trim: '#c9a227', lamp: '#2f7a4c', chair: '#3a2630', arm: '#2e1e27' });
  exec('marble', 'Marble & gold', { top: '#efeae4', topOpts: { roughness: 0.25 }, body: '#2a2638', trim: '#e9c46a', lamp: '#1d2547', chair: '#f4f1fa', arm: '#d9d2e6' });
  exec('ebony', 'Ebony & red', { top: '#1f1d2b', body: '#141218', trim: '#e05d5d', lamp: '#e05d5d', chair: '#7a1f2b', arm: '#5a1720' });

  // ------------------------------------------------------------ the command desk
  // A curved desk wrapped round Claude's chair, with an ultra-wide curved monitor. Claude sits
  // with its back to us, so the screens face the room. Origin is the seat.
  const command = (id, name, o) => add('command', id, name, 5.0, 3.0, 2.5, (g) => {
    const A = 1.15, R1 = 1.45, R2 = 2.45, RM = 2.3, MH = 0.95, MY = 1.95, b = B(g), c = C(g);
    const at = (r, th) => [r * Math.sin(th), r * Math.cos(th)]; // th = PI points straight back (-z)
    const shape = new THREE.Shape();
    for (let i = 0; i <= 40; i++) { const [x, z] = at(R2, Math.PI - A + (2 * A * i) / 40); i ? shape.lineTo(x, -z) : shape.moveTo(x, -z); }
    for (let i = 40; i >= 0; i--) { const [x, z] = at(R1, Math.PI - A + (2 * A * i) / 40); shape.lineTo(x, -z); }
    const top = mesh(g, new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }), mat(o.top), 0, 0.92, 0);
    top.rotation.x = -Math.PI / 2;
    for (const th of [-1.0, -0.35, 0.35, 1.0]) for (const r of [R1 + 0.12, R2 - 0.12]) { const [x, z] = at(r, Math.PI + th); b(0.07, 0.92, 0.07, '#2a2638', x, 0, z, { r: 0.02, ink: false }); }
    const screen = new THREE.Mesh(new THREE.CylinderGeometry(RM, RM, MH, 72, 1, true, Math.PI - A + 0.06, 2 * A - 0.12), new THREE.MeshBasicMaterial({ map: k.STUDIO_TEX, side: THREE.BackSide, toneMapped: false }));
    screen.position.y = MY; screen.userData.live = true; g.add(screen);
    const back = mesh(g, new THREE.CylinderGeometry(RM + 0.04, RM + 0.04, MH + 0.12, 72, 1, true, Math.PI - A, 2 * A), mat(o.shell, { side: THREE.DoubleSide, roughness: 0.5 }), 0, MY, 0);
    back.receiveShadow = false;
    for (const th of [Math.PI - A, Math.PI + A]) { const [x, z] = at(RM + 0.02, th); b(0.08, MH + 0.12, 0.08, o.shell, x, MY - (MH + 0.12) / 2, z, { r: 0.02, ink: false }); }
    for (const th of [-0.8, 0, 0.8]) { const [x, z] = at(RM + 0.08, Math.PI + th); b(0.08, MY - MH / 2 - 0.98, 0.08, o.shell, x, 1.0, z, { r: 0.02, ink: false }); }
    c(0.05, 0.05, 0.45, '#2a2638'); c(0.34, 0.34, 0.04, '#2a2638');
    b(0.8, 0.1, 0.75, o.chair, 0, 0.45, 0, { r: 0.05 }); b(0.8, 0.38, 0.1, o.chair, 0, 0.55, 0.36, { r: 0.05 });
    { const [x, z] = at(1.95, Math.PI - 0.95); c(0.11, 0.1, 0.18, '#efe6dc', x, 1.0, z); }
    { const [x, z] = at(1.95, Math.PI - 0.55); c(0.1, 0.08, 0.14, '#c8674a', x, 1.0, z); mesh(g, new THREE.IcosahedronGeometry(0.14, 0), mat('#3f8f5a', { flatShading: true }), x, 1.24, z); }
    // an inbox tray whose paper stack is the chats resting off screen
    const [px, pz] = at(1.95, Math.PI + 0.9);
    b(0.56, 0.04, 0.7, '#3b2f2a', px, 1.0, pz, { r: 0.015 }).rotation.y = -0.5;
    const papers = [];
    for (let i = 0; i < 12; i++) { const p = b(0.44, 0.014, 0.58, i % 4 === 3 ? '#fde68a' : '#fbfbfe', px + Math.sin(i * 2.1) * 0.02, 1.04 + i * 0.016, pz, { r: 0.004, ink: false }); p.rotation.y = -0.5 + Math.sin(i * 1.7) * 0.08; p.userData.live = true; p.visible = false; papers.push(p); }
    return {
      solids: [[0, 0, 0.8, 0.75, 0.25], [0, -1.95, 2.6, 1.0], [-1.7, -1.05, 1.1, 1.3], [1.7, -1.05, 1.1, 1.3]],
      desk: { studio: true, seat: [0, 0.55, 0], facing: Math.PI - 0.8, papers, pool: k.pool(g, 4.6, 1.6, 0, 1.004, -1.8) },
    };
  }, { hit: [0, -1.1, 5.0, 2.9, 2.5] });
  command('terracotta', 'Terracotta curve', { top: '#f2eef8', shell: '#1f1d2b', chair: '#7a3b22' });
  command('midnight', 'Midnight curve', { top: '#2a2638', shell: '#141218', chair: '#3d5199' });
  command('birch', 'Birch curve', { top: '#e3c9a3', shell: '#2a2638', chair: '#f4f1fa' });

  // ------------------------------------------------------------ sofas (two seats each)
  const SOFA_SEATS = [[-0.9, 0.55, 0.1, 0], [0.9, 0.55, 0.1, 0]];
  add('sofa', 'teal', 'Teal classic', 4.6, 1.3, 1.3, (g) => {
    const b = B(g);
    b(4.2, 0.55, 1.3, '#2f8f86', 0, 0, 0, { r: 0.18 }); b(4.2, 0.9, 0.35, '#2f8f86', 0, 0.4, -0.65, { r: 0.15 });
    for (const sx of [-2.1, 2.1]) b(0.4, 0.75, 1.3, '#287a72', sx, 0, 0, { r: 0.15 });
    b(0.8, 0.5, 0.18, '#f5c04a', -1, 0.55, -0.4, { r: 0.08 }).rotation.x = -0.25;
    b(0.8, 0.5, 0.18, '#e05d8a', 1, 0.55, -0.4, { r: 0.08 }).rotation.x = -0.25;
    return { seats: SOFA_SEATS, solids: [[0, -0.15, 4.6, 1.3]] };
  });
  add('sofa', 'chesterfield', 'Chesterfield', 4.4, 1.3, 1.2, (g) => {
    const b = B(g), c = C(g), L = '#6b3a2a';
    b(3.6, 0.5, 1.2, L, 0, 0.08, 0, { r: 0.1 }); b(3.6, 0.32, 1.0, '#7a4632', 0, 0.48, 0.08, { r: 0.12 });
    b(4.3, 0.95, 0.3, L, 0, 0.08, -0.5, { r: 0.12 });
    for (const sx of [-2.0, 2.0]) { b(0.36, 0.72, 1.25, L, sx, 0.08, 0, { r: 0.1 }); c(0.2, 0.2, 1.25, '#5f3324', sx, 0.175, 0).rotation.x = Math.PI / 2; } // rolled arms
    for (let i = 0; i < 8; i++) for (const y of [0.5, 0.8]) mesh(g, new THREE.SphereGeometry(0.03, 8, 6), mat('#3e2018'), -1.6 + i * 0.46, y, -0.34);
    for (const [x, z] of [[-2, -0.5], [2, -0.5], [-2, 0.5], [2, 0.5]]) c(0.06, 0.04, 0.08, '#c9a227', x, 0, z, { opts: BRASS });
    return { seats: SOFA_SEATS, solids: [[0, -0.1, 4.4, 1.3]] };
  });
  add('sofa', 'midcentury', 'Mid-century mustard', 3.8, 1.2, 1.1, (g) => {
    const b = B(g), c = C(g), M = '#e0a83a';
    b(3.6, 0.14, 1.1, '#9a6b3f', 0, 0.3, 0, { r: 0.03 });
    for (const sx of [-0.9, 0.9]) b(1.75, 0.22, 1.0, M, sx, 0.44, 0.03, { r: 0.08 });
    for (const sx of [-0.9, 0.9]) b(1.7, 0.6, 0.22, M, sx, 0.5, -0.45, { r: 0.08 }).rotation.x = -0.12;
    for (const sx of [-1.83, 1.83]) b(0.14, 0.38, 1.05, '#9a6b3f', sx, 0.3, 0, { r: 0.03 });
    for (const [x, z] of [[-1.6, -0.4], [1.6, -0.4], [-1.6, 0.4], [1.6, 0.4]]) c(0.04, 0.025, 0.3, '#5a3d2b', x, 0, z, { seg: 8 });
    return { seats: [[-0.9, 0.62, 0.1, 0], [0.9, 0.62, 0.1, 0]] };
  });
  add('sofa', 'sectional', 'Grey sectional', 4.4, 2.4, 1.2, (g) => {
    const b = B(g), G = '#8f8aa3', D = '#7b7690';
    b(4.4, 0.5, 1.2, G, 0, 0, -0.6, { r: 0.14 }); b(4.4, 0.85, 0.32, D, 0, 0.3, -1.05, { r: 0.12 });
    b(1.3, 0.5, 1.4, G, 1.55, 0, 0.5, { r: 0.14 }); b(0.3, 0.7, 2.4, D, 2.2, 0, -0.1, { r: 0.12 }); b(0.3, 0.7, 1.2, D, -2.2, 0, -0.6, { r: 0.12 });
    for (const [x, c] of [[-1.3, '#f5c04a'], [0.2, '#5b8cff']]) b(0.7, 0.45, 0.16, c, x, 0.5, -0.8, { r: 0.07 }).rotation.x = -0.25;
    return { seats: [[-1.1, 0.55, -0.5, 0], [0.5, 0.55, -0.5, 0], [1.55, 0.55, 0.5, 0]], solids: [[0, -0.6, 4.4, 1.2], [1.65, 0.6, 1.5, 1.2]] };
  }, { hit: [0, 0, 4.4, 2.4, 1.2] });
  add('sofa', 'blush', 'Blush velvet loveseat', 3.0, 1.2, 1.2, (g) => {
    const b = B(g), P = '#e7a1b0';
    b(2.8, 0.5, 1.1, P, 0, 0.05, 0, { r: 0.22 });
    const back = mesh(g, new THREE.CylinderGeometry(1.5, 1.5, 0.9, 32, 1, false, -Math.PI / 2 - 0.55, 1.1), mat('#d98c9e', { roughness: 0.85 }), 0, 0.85, 0.95);
    back.scale.set(1, 1, 0.35);
    for (const sx of [-1.4, 1.4]) b(0.3, 0.72, 1.1, '#d98c9e', sx, 0.05, 0, { r: 0.14 });
    for (const [x, z] of [[-1.2, -0.4], [1.2, -0.4], [-1.2, 0.4], [1.2, 0.4]]) b(0.08, 0.08, 0.08, '#c9a227', x, 0, z, { r: 0.02, ink: false, opts: BRASS });
    return { seats: [[-0.6, 0.6, 0.1, 0], [0.6, 0.6, 0.1, 0]] };
  });

  // ------------------------------------------------------------ armchairs (they can be picked up)
  const ARM_SEAT = [[0, 0.5, 0.05, 0]];
  const club = (id, name, c) => add('armchair', id, name, 1.2, 1.1, 1.2, (g) => {
    const b = B(g);
    b(1.15, 0.45, 1.0, c, 0, 0, 0, { r: 0.14 }); b(1.15, 0.85, 0.28, c, 0, 0.3, -0.42, { r: 0.12 });
    for (const sx of [-0.52, 0.52]) b(0.22, 0.65, 1.0, c, sx, 0, 0, { r: 0.1 });
    return { seats: ARM_SEAT };
  }, { movable: true, pad: 0.25 });
  club('mustard', 'Club chair, mustard', '#f5c04a');
  club('teal', 'Club chair, teal', '#2dd4bf');
  club('white', 'Club chair, cloud', '#f4f1fa');
  add('armchair', 'guest', 'Navy guest chair', 0.8, 0.8, 1.0, (g) => {
    const b = B(g);
    b(0.78, 0.42, 0.72, '#3d5199', 0, 0, 0, { r: 0.08 }); b(0.78, 0.5, 0.14, '#3d5199', 0, 0.38, -0.32, { r: 0.06 });
    for (const ax of [-0.36, 0.36]) b(0.1, 0.22, 0.66, '#2f3f7a', ax, 0.38, 0, { r: 0.04 });
    return { seats: [[0, 0.55, 0, 0]] };
  }, { movable: true, pad: 0.2 });
  add('armchair', 'wingback', 'Wingback', 1.1, 1.0, 1.6, (g) => {
    const b = B(g), c = C(g), W = '#5b8cff';
    b(0.95, 0.2, 0.85, W, 0, 0.3, 0.05, { r: 0.08 }); b(1.0, 1.35, 0.2, W, 0, 0.25, -0.42, { r: 0.1 });
    for (const sx of [-0.48, 0.48]) { b(0.14, 0.45, 0.85, '#4a78e0', sx, 0.3, 0, { r: 0.06 }); b(0.14, 0.55, 0.36, W, sx, 0.75, -0.28, { r: 0.07 }); }
    for (const [x, z] of [[-0.4, -0.35], [0.4, -0.35], [-0.4, 0.38], [0.4, 0.38]]) c(0.04, 0.03, 0.3, '#5a3d2b', x, 0, z, { seg: 8 });
    return { seats: ARM_SEAT };
  }, { movable: true, pad: 0.25 });
  add('armchair', 'egg', 'Egg chair', 1.2, 1.2, 1.5, (g) => {
    const c = C(g);
    const shell = mesh(g, new THREE.SphereGeometry(0.7, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.72), mat('#f4f1fa', { roughness: 0.4, side: THREE.DoubleSide }), 0, 0.85, -0.05);
    shell.rotation.x = -1.2;
    mesh(g, new THREE.SphereGeometry(0.42, 20, 12), mat('#ff8a4c', { roughness: 0.9 }), 0, 0.55, 0.05).scale.set(1, 0.32, 1);
    c(0.04, 0.04, 0.4, '#c9ccd6', 0, 0, 0, { opts: CHROME }); c(0.4, 0.42, 0.04, '#c9ccd6', 0, 0, 0, { opts: CHROME });
    return { seats: [[0, 0.55, 0.05, 0]] };
  }, { movable: true, pad: 0.25 });

  // ------------------------------------------------------------ beanbags (poke one: it squishes)
  const bean = (id, name, c, shape = 'round') => add('beanbag', id, name, 1.2, 1.2, 0.8, (g) => {
    let b;
    if (shape === 'pouf') b = k.box(1.0, 0.55, 1.0, c, 0, 0, 0, { parent: g, r: 0.22 });
    else { b = mesh(g, new THREE.SphereGeometry(0.65, 28, 18), mat(c, { roughness: 0.9 }), 0, 0.38, 0); b.scale.y = shape === 'pear' ? 0.85 : 0.6; }
    b.userData.live = true;
    const sy = b.scale.y;
    k.toy(0, 0, 0, 1.3, 0.8, 1.3, { kind: 'poke', dur: 1.4, sound: [180, 0.18, 'sine', 0.06], step(e) { const w = e < this.dur ? Math.sin(e * 16) * Math.exp(-e * 4) : 0; b.scale.set(1 + w * 0.22, sy * (1 - w * 0.35), 1 + w * 0.22); } }, g);
    return { seats: [[0, shape === 'pouf' ? 0.55 : 0.62, 0, 0]], solids: [[0, 0, 1.2, 1.2, 0.3]] };
  });
  bean('pink', 'Bubblegum', '#e05d8a'); bean('yellow', 'Sunny', '#f5c04a'); bean('blue', 'Ocean', '#5b8cff'); bean('teal', 'Lagoon', '#2dd4bf');
  bean('pear', 'Tall pear', '#a78bfa', 'pear'); bean('pouf', 'Cube pouf', '#c86f5a', 'pouf');

  // ------------------------------------------------------------ chairs & stools (pick them up)
  const task = (id, name, c) => add('chair', id, name, 0.7, 0.7, 1.1, (g) => {
    const b = B(g), cy = C(g);
    cy(0.05, 0.05, 0.45, '#2a2638'); cy(0.3, 0.3, 0.04, '#2a2638');
    b(0.7, 0.1, 0.65, c, 0, 0.45, 0, { r: 0.05 }); b(0.7, 0.62, 0.1, c, 0, 0.55, -0.32, { r: 0.05 });
    return { seats: [[0, 0.55, 0, 0]] };
  }, { movable: true, pad: 0.2 });
  task('task', 'Task chair, plum', '#3b3552'); task('blue', 'Task chair, blue', '#5b8cff');
  add('chair', 'wood', 'Wooden chair', 0.6, 0.6, 1.1, (g) => {
    const b = B(g), W = '#a8784f';
    b(0.58, 0.06, 0.55, W, 0, 0.45, 0, { r: 0.02 });
    for (const [x, z] of [[-0.25, -0.23], [0.25, -0.23], [-0.25, 0.23], [0.25, 0.23]]) b(0.05, 0.45, 0.05, '#7a5a3c', x, 0, z, { r: 0.01, ink: false });
    for (const x of [-0.25, 0.25]) b(0.05, 0.6, 0.05, '#7a5a3c', x, 0.5, -0.25, { r: 0.01, ink: false });
    for (const y of [0.75, 0.95]) b(0.55, 0.08, 0.04, W, 0, y, -0.25, { r: 0.01 });
    return { seats: [[0, 0.52, 0, 0]] };
  }, { movable: true, pad: 0.15 });
  add('chair', 'shell', 'Shell chair', 0.6, 0.6, 1.0, (g) => {
    const b = B(g);
    const s = mesh(g, new THREE.SphereGeometry(0.34, 24, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), mat('#f4f1fa', { side: THREE.DoubleSide, roughness: 0.45 }), 0, 0.82, 0);
    s.rotation.x = -0.35;
    for (const [x, z, rx, rz] of [[-0.2, -0.2, 0.25, -0.25], [0.2, -0.2, 0.25, 0.25], [-0.2, 0.2, -0.25, -0.25], [0.2, 0.2, -0.25, 0.25]]) { const l = b(0.035, 0.5, 0.035, '#c8a27a', x, 0, z, { r: 0.01, ink: false }); l.rotation.set(rx * 0.4, 0, rz * 0.4); }
    return { seats: [[0, 0.52, 0, 0]] };
  }, { movable: true, pad: 0.15 });
  add('chair', 'stool', 'Bar stool', 0.55, 0.55, 0.9, (g) => {
    const c = C(g);
    c(0.04, 0.04, 0.7, '#2a2638'); c(0.24, 0.24, 0.03, '#2a2638'); c(0.28, 0.26, 0.09, '#d97757', 0, 0.7, 0);
    return { seats: [[0, 0.8, 0, 0]] };
  }, { movable: true, pad: 0.15 });
  add('chair', 'stool-wood', 'Saddle stool', 0.55, 0.55, 0.9, (g) => {
    const c = C(g), b = B(g);
    for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) b(0.04, 0.72, 0.04, '#3b2f2a', x, 0, z, { r: 0.01, ink: false });
    b(0.4, 0.03, 0.4, '#3b2f2a', 0, 0.3, 0, { r: 0.01, ink: false }); c(0.27, 0.25, 0.08, '#a8784f', 0, 0.72, 0);
    return { seats: [[0, 0.8, 0, 0]] };
  }, { movable: true, pad: 0.15 });

  // ------------------------------------------------------------ benches
  add('bench', 'garden', 'Garden bench', 2.2, 0.6, 0.6, (g) => {
    const b = B(g);
    b(2.2, 0.08, 0.6, '#c8a27a', 0, 0.42, 0, { r: 0.03 });
    for (const lx of [-0.9, 0.9]) b(0.08, 0.42, 0.5, '#3b2f2a', lx, 0, 0, { r: 0.02, ink: false });
    return { seats: [[-0.5, 0.5, 0, 0], [0.5, 0.5, 0, 0]], solids: [[0, 0, 2.2, 0.6, 0.2]] };
  });
  add('bench', 'park', 'Park bench', 2.2, 0.75, 1.0, (g) => {
    const b = B(g);
    for (let i = 0; i < 4; i++) b(2.2, 0.04, 0.12, '#2f7a4c', 0, 0.44, -0.24 + i * 0.15, { r: 0.01 });
    for (let i = 0; i < 3; i++) b(2.2, 0.1, 0.04, '#2f7a4c', 0, 0.6 + i * 0.14, -0.34, { r: 0.01 });
    for (const lx of [-0.95, 0.95]) { b(0.06, 0.44, 0.6, '#2a2638', lx, 0, 0, { r: 0.02, ink: false }); b(0.06, 0.5, 0.06, '#2a2638', lx, 0.44, -0.34, { ink: false }); }
    return { seats: [[-0.5, 0.52, 0, 0], [0.5, 0.52, 0, 0]], solids: [[0, 0, 2.2, 0.7, 0.2]] };
  });
  add('bench', 'stone', 'Stone block bench', 2.0, 0.7, 0.5, (g) => {
    const b = B(g);
    b(2.0, 0.42, 0.7, '#b8b2c4', 0, 0, 0, { r: 0.06 }); b(1.6, 0.08, 0.5, '#8f84ad', 0, 0.42, 0, { r: 0.04 });
    return { seats: [[-0.5, 0.52, 0, 0], [0.5, 0.52, 0, 0]], solids: [[0, 0, 2.0, 0.7, 0.2]] };
  });

  // ------------------------------------------------------------ focus pods: felt-lined booths,
  // open at the front so you can see who's tucked away in them
  const pod = (id, name, c) => add('pod', id, name, 2.6, 2.2, 2.3, (g, it) => {
    const W = 2.6, D = 2.2, H = 2.3, back = -D / 2, b = B(g), cy = C(g), felt = { roughness: 0.95 };
    b(W - 0.1, 0.04, D - 0.1, '#ebe6f3', 0, 0, 0, { r: 0.02, ink: false, cast: false });
    b(W, H, 0.14, c, 0, 0, back, { r: 0.05, opts: felt });
    for (const sx of [-1, 1]) {
      const x = sx * (W / 2 - 0.07);
      b(0.14, 1.0, D, c, x, 0, 0, { r: 0.05, opts: felt });
      b(0.05, H - 1.0, D - 0.1, '#cfe9ff', x, 1.0, 0, { r: 0.01, ink: false, cast: false, opts: { transparent: true, opacity: 0.22, depthWrite: false, roughness: 0.08 } });
      b(0.16, 0.08, D, '#2a2638', x, H, 0, { r: 0.02, ink: false });
    }
    b(W, 0.08, 0.18, '#2a2638', 0, H, back, { r: 0.02, ink: false });
    const lamp = cy(0.12, 0.16, 0.18, '#fde6c8', -0.75, 1.7, back + 0.15, { opts: { emissive: '#ffcf9a', emissiveIntensity: 0.6 } });
    lamp.material = lamp.material.clone(); lamp.userData.live = true;
    k.toy(-0.75, 1.55, back + 0.2, 0.5, 0.5, 0.5, { kind: 'lamp', on: it.on ?? true, apply() { lamp.material.emissiveIntensity = this.on ? 0.6 : 0; } }, g);
    b(1.0, 0.42, 0.85, '#f4f1fa', -0.15, 0, back + 0.7, { r: 0.12 }); b(1.0, 0.72, 0.22, '#f4f1fa', -0.15, 0.3, back + 0.36, { r: 0.1 });
    cy(0.03, 0.03, 0.55, '#2a2638', 0.75, 0, back + 0.55); cy(0.24, 0.24, 0.04, '#7b5a43', 0.75, 0.55, back + 0.55);
    b(0.3, 0.02, 0.22, '#3b3552', 0.75, 0.59, back + 0.55, { r: 0.005, ink: false });
    return { seats: [[-0.15, 0.48, back + 0.75, 0]], solids: [[0, back, W, 0.14], [-(W / 2 - 0.07), 0, 0.14, D], [W / 2 - 0.07, 0, 0.14, D], [-0.15, back + 0.7, 1.0, 0.85, 0.2]] };
  });
  pod('blue', 'Focus pod, blue', '#5b8cff'); pod('yellow', 'Focus pod, yellow', '#f5c04a'); pod('teal', 'Focus pod, teal', '#2dd4bf'); pod('pink', 'Focus pod, pink', '#e05d8a');

  // ------------------------------------------------------------ tables
  add('table', 'meeting', 'Walnut meeting table', 6.2, 2.2, 0.9, (g) => {
    const b = B(g);
    b(6.2, 0.08, 2.2, '#7b5a43', 0, 0.82, 0, { r: 0.04 });
    for (const dx of [-2.6, 2.6]) b(0.3, 0.82, 1.6, '#3b2f2a', dx, 0, 0, { r: 0.03 });
    b(0.5, 0.06, 1.0, '#fbfbfe', -0.6, 0.9, 0.1, { r: 0.01, ink: false }); b(0.4, 0.04, 0.3, '#2a2638', 1.2, 0.9, -0.3, { r: 0.01, ink: false });
    return { solids: [[0, 0, 6.2, 2.2, 0.3]] };
  });
  add('table', 'boardroom', 'Black boardroom', 6.2, 2.2, 0.9, (g) => {
    const b = B(g);
    b(6.2, 0.1, 2.2, '#1f1d2b', 0, 0.8, 0, { r: 0.08, opts: { roughness: 0.3 } });
    b(5.0, 0.8, 0.5, '#2a2638', 0, 0, 0, { r: 0.04 });
    for (const dx of [-1.8, 0, 1.8]) b(0.3, 0.02, 0.2, '#f4f1fa', dx, 0.9, 0.5, { r: 0.005, ink: false });
    return { solids: [[0, 0, 6.2, 2.2, 0.3]] };
  });
  add('table', 'farmhouse', 'Oak farmhouse', 5.4, 1.8, 0.9, (g) => {
    const b = B(g);
    for (let i = 0; i < 4; i++) b(5.4, 0.09, 0.44, i % 2 ? '#c8a27a' : '#bd9670', 0, 0.8, -0.67 + i * 0.45, { r: 0.02 });
    for (const [x, z] of [[-2.4, -0.7], [2.4, -0.7], [-2.4, 0.7], [2.4, 0.7]]) b(0.16, 0.8, 0.16, '#8a6444', x, 0, z, { r: 0.03 });
    mesh(g, new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f4f1fa', { side: THREE.DoubleSide }), 0.4, 0.89, 0);
    for (const [dx, c] of [[0.3, '#e05d5d'], [0.5, '#f5c04a'], [0.42, '#34d399']]) mesh(g, new THREE.SphereGeometry(0.07, 10, 8), mat(c), dx, 0.98, (dx - 0.4) * 0.8);
    return { solids: [[0, 0, 5.4, 1.8, 0.3]] };
  });
  add('table', 'glass', 'Glass & chrome', 5.0, 1.8, 0.9, (g) => {
    const b = B(g);
    b(5.0, 0.05, 1.8, '#cfe9ff', 0, 0.82, 0, { r: 0.02, ink: false, cast: false, opts: GLASS });
    for (const dx of [-2.1, 2.1]) { b(0.06, 0.82, 1.4, '#c9ccd6', dx, 0, 0, { r: 0.02, opts: CHROME }); }
    return { solids: [[0, 0, 5.0, 1.8, 0.3]] };
  });
  add('table', 'round', 'Round café table', 2.2, 2.2, 0.9, (g) => {
    const c = C(g);
    c(1.1, 1.1, 0.07, '#f4f1fa', 0, 0.8, 0, { seg: 40 }); c(0.06, 0.06, 0.8, '#2a2638'); c(0.5, 0.55, 0.05, '#2a2638');
    c(0.08, 0.07, 0.14, '#5b8cff', 0.3, 0.87, 0.2);
    return { solids: [[0, 0, 1.6, 1.6, 0.3]] };
  });

  // ------------------------------------------------------------ coffee & side tables
  add('coffee', 'walnut', 'Walnut coffee table', 1.8, 1.0, 0.5, (g) => {
    const b = B(g), c = C(g);
    b(1.8, 0.4, 1.0, '#7b5a43', 0, 0, 0, { r: 0.06 });
    c(0.18, 0.16, 0.22, '#f5c04a', 0.4, 0.4, 0); b(0.4, 0.04, 0.3, '#5b8cff', -0.4, 0.4, -0.1, { r: 0.01, ink: false });
    return { solids: [[0, 0, 1.8, 1.0, 0.3]] };
  });
  add('coffee', 'side', 'Round side table', 0.8, 0.8, 0.7, (g) => {
    const b = B(g), c = C(g);
    c(0.38, 0.38, 0.05, '#7b5a43', 0, 0.6, 0); c(0.05, 0.05, 0.6, '#3b2f2a');
    b(0.3, 0.05, 0.22, '#e05d5d', -0.05, 0.65, -0.05, { r: 0.01, ink: false }); c(0.07, 0.06, 0.12, '#f4f1fa', 0.18, 0.65, 0.1);
    return { solids: [[0, 0, 0.8, 0.8, 0.2]] };
  });
  add('coffee', 'marble', 'Marble drum', 1.3, 1.3, 0.5, (g) => {
    const c = C(g);
    c(0.62, 0.62, 0.06, '#efeae4', 0, 0.4, 0, { seg: 40, opts: { roughness: 0.2 } }); c(0.5, 0.5, 0.4, '#c9a227', 0, 0, 0, { seg: 40, opts: BRASS });
    c(0.12, 0.1, 0.2, '#2f7a4c', 0.2, 0.46, 0.1);
    return { solids: [[0, 0, 1.2, 1.2, 0.3]] };
  });
  add('coffee', 'glass', 'Glass coffee table', 1.8, 1.0, 0.5, (g) => {
    const b = B(g);
    b(1.8, 0.04, 1.0, '#cfe9ff', 0, 0.4, 0, { r: 0.01, ink: false, cast: false, opts: GLASS });
    b(1.6, 0.03, 0.8, '#2a2638', 0, 0.12, 0, { r: 0.01, ink: false });
    for (const [x, z] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) b(0.04, 0.4, 0.04, '#c9ccd6', x, 0, z, { ink: false, opts: CHROME });
    return { solids: [[0, 0, 1.8, 1.0, 0.3]] };
  });
  add('coffee', 'crates', 'Stacked crates', 1.4, 0.8, 0.6, (g) => {
    const b = B(g);
    for (const [x, y, r] of [[-0.35, 0, 0], [0.35, 0, 0.05], [0, 0.32, -0.08]]) { const cr = b(0.65, 0.3, 0.6, '#c8a27a', x, y, 0, { r: 0.02 }); cr.rotation.y = r; }
    return { solids: [[0, 0, 1.4, 0.8, 0.2]] };
  });

  // ------------------------------------------------------------ cupboards & shelves
  const books = (g, x0, y, z, n, step, w = 0.18, d = 0.4, seed = 0) => { for (let i = 0; i < n; i++) if ((seed + i * 3) % 4) k.box(w, 0.42 + ((i + seed) % 3) * 0.06, d, spine[(i + seed) % spine.length], x0 + i * step, y, z, { parent: g, r: 0.02, ink: false }); };
  add('storage', 'bookshelf', 'Tall bookshelf', 2.4, 0.7, 3.4, (g) => {
    const b = B(g);
    b(2.4, 3.4, 0.7, '#5b4636', 0, 0, 0, { r: 0.03 });
    for (let r = 0; r < 4; r++) {
      b(2.25, 0.05, 0.6, '#4a382b', 0, 0.25 + r * 0.8, 0.03, { cast: false, ink: false });
      for (let i = 0; i < 8; i++) if ((r * 13 + i * 7) % 5) b(0.18, 0.45 + ((i * 3 + r) % 4) * 0.06, 0.42, spine[(i + r * 2) % spine.length], -0.95 + i * 0.26, 0.3 + r * 0.8, 0.1, { r: 0.02, ink: false });
    }
    return { spots: front(0.7) };
  });
  add('storage', 'manuals', 'Shelf of manuals', 2.6, 0.6, 2.2, (g) => {
    k.box(2.6, 2.2, 0.6, '#5b4636', 0, 0, 0, { parent: g, r: 0.03 });
    for (let r = 0; r < 3; r++) books(g, -1.0, 0.12 + r * 0.7, 0.15, 9, 0.25, 0.18, 0.4, r);
    return { spots: front(0.6) };
  });
  add('storage', 'lowcase', 'Low bookcase', 4.2, 0.5, 1.5, (g) => {
    k.box(4.2, 1.1, 0.5, '#5b4636', 0, 0, 0, { parent: g, r: 0.03 });
    for (let i = 0; i < 15; i++) if (i % 4) k.box(0.2, 0.3 + (i % 3) * 0.06, 0.3, spine[i % spine.length], -1.9 + i * 0.27, 1.1, 0, { parent: g, r: 0.02, ink: false });
    return { spots: front(0.5) };
  });
  add('storage', 'wardrobe', 'Two-door wardrobe', 2.0, 0.7, 2.5, (g) => {
    const b = B(g);
    b(2.0, 2.4, 0.7, '#e9e2f3', 0, 0.08, 0, { r: 0.04 }); b(2.05, 0.1, 0.75, '#c3b8d8', 0, 2.45, 0, { r: 0.02 });
    b(0.02, 2.2, 0.02, '#c3b8d8', 0, 0.18, 0.36, { ink: false });
    for (const sx of [-0.12, 0.12]) b(0.04, 0.4, 0.05, '#9a92ad', sx, 1.1, 0.38, { r: 0.015, ink: false, opts: CHROME });
    for (const [x, z] of [[-0.9, -0.3], [0.9, -0.3], [-0.9, 0.3], [0.9, 0.3]]) b(0.06, 0.08, 0.06, '#5a3d2b', x, 0, z, { ink: false });
    return { spots: front(0.7) };
  });
  add('storage', 'cupboard', 'Oak cupboard', 1.8, 0.6, 1.9, (g) => {
    const b = B(g);
    b(1.8, 1.85, 0.6, '#c8a27a', 0, 0, 0, { r: 0.04 });
    for (let i = 0; i < 3; i++) { b(1.7, 0.36, 0.03, '#bd9670', 0, 0.12 + i * 0.4, 0.3, { r: 0.01 }); b(0.3, 0.04, 0.05, '#3b2f2a', 0, 0.28 + i * 0.4, 0.33, { r: 0.015, ink: false }); }
    for (const sx of [-0.43, 0.43]) b(0.82, 0.55, 0.03, '#bd9670', sx, 1.27, 0.3, { r: 0.01 });
    mesh(g, new THREE.IcosahedronGeometry(0.2, 0), mat('#3f8f5a', { flatShading: true }), 0.5, 2.05, 0); k.cyl(0.14, 0.11, 0.2, '#c8674a', 0.5, 1.85, 0, { parent: g });
    return { spots: front(0.6) };
  });
  add('storage', 'credenza', 'Credenza with trophies', 3.4, 0.55, 1.6, (g) => {
    const b = B(g), c = C(g);
    b(3.4, 0.78, 0.55, '#5a3d2b', 0, 0, 0, { r: 0.03 });
    c(0.16, 0.2, 0.08, '#c9a227', -1.1, 0.78, 0, { opts: BRASS }); c(0.04, 0.04, 0.3, '#c9a227', -1.1, 0.86, 0, { opts: BRASS });
    mesh(g, new THREE.SphereGeometry(0.19, 20, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#e9c46a', { ...BRASS, side: THREE.DoubleSide }), -1.1, 1.36, 0);
    mesh(g, new THREE.SphereGeometry(0.22, 24, 16), mat('#4f8dff', { roughness: 0.5 }), 1.1, 1.1, 0);
    c(0.03, 0.03, 0.12, '#c9a227', 1.1, 0.78, 0, { opts: BRASS });
  });
  add('storage', 'filing', 'Filing cabinets', 1.8, 0.7, 1.4, (g) => {
    const b = B(g);
    for (const x of [-0.6, 0, 0.6]) { b(0.58, 1.3, 0.7, '#9a9fb0', x, 0, 0, { r: 0.02, opts: { metalness: 0.4, roughness: 0.5 } }); for (let i = 0; i < 3; i++) b(0.2, 0.04, 0.04, '#5a5470', x, 0.3 + i * 0.4, 0.36, { r: 0.01, ink: false }); }
    return { spots: front(0.7) };
  });

  // ------------------------------------------------------------ fridges
  add('fridge', 'classic', 'Classic white', 1.1, 1.1, 2.4, (g) => {
    const b = B(g);
    b(1.1, 2.4, 1.1, '#f3f0f8', 0, 0, 0, { r: 0.06 });
    b(1.0, 0.015, 0.02, '#d9d2e6', 0, 1.55, 0.56, { ink: false });
    b(0.06, 0.6, 0.04, '#9a92ad', 0.3, 1.7, 0.57, { r: 0.02, ink: false }); b(0.06, 0.45, 0.04, '#9a92ad', 0.3, 0.9, 0.57, { r: 0.02, ink: false });
    return { spots: front(1.1) };
  });
  add('fridge', 'retro', 'Retro mint', 1.0, 0.9, 1.9, (g) => {
    const b = B(g);
    b(1.0, 1.75, 0.9, '#a6dcc7', 0, 0.12, 0, { r: 0.3 });
    for (const [x, z] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]]) b(0.08, 0.14, 0.08, '#2a2638', x, 0, z, { r: 0.03, ink: false });
    b(0.95, 0.02, 0.02, '#8cc9b2', 0, 1.35, 0.46, { ink: false });
    b(0.07, 0.3, 0.06, '#c9ccd6', -0.35, 1.45, 0.47, { r: 0.03, ink: false, opts: CHROME }); b(0.07, 0.35, 0.06, '#c9ccd6', -0.35, 0.85, 0.47, { r: 0.03, ink: false, opts: CHROME });
    b(0.3, 0.08, 0.02, '#c9ccd6', 0.1, 1.58, 0.46, { r: 0.02, ink: false, opts: CHROME });
    return { spots: front(0.9) };
  });
  add('fridge', 'steel', 'Double-door steel', 1.6, 0.85, 2.3, (g) => {
    const b = B(g), S = { metalness: 0.65, roughness: 0.32 };
    b(1.6, 2.3, 0.85, '#c3c7d1', 0, 0, 0, { r: 0.04, opts: S });
    b(0.02, 2.2, 0.02, '#8a8ea0', 0, 0.05, 0.43, { ink: false });
    for (const sx of [-0.1, 0.1]) b(0.04, 1.0, 0.06, '#e9ebf0', sx, 0.8, 0.45, { r: 0.015, ink: false, opts: CHROME });
    b(0.32, 0.45, 0.02, '#2a2638', -0.4, 1.3, 0.43, { r: 0.02, ink: false });
    b(0.18, 0.05, 0.02, '#7dd3fc', -0.4, 1.62, 0.44, { ink: false, opts: { emissive: '#7dd3fc', emissiveIntensity: 1.2 } });
    return { spots: front(0.85) };
  });
  add('fridge', 'mini', 'Mini fridge', 0.65, 0.65, 1.1, (g) => {
    const b = B(g), c = C(g);
    b(0.65, 0.85, 0.65, '#2a2638', 0, 0, 0, { r: 0.05 }); b(0.04, 0.3, 0.04, '#9a92ad', 0.22, 0.4, 0.34, { r: 0.015, ink: false });
    for (const [x, col] of [[-0.15, '#e05d5d'], [0.0, '#34d399'], [0.15, '#f5c04a']]) c(0.05, 0.05, 0.14, col, x, 0.85, 0);
    return { spots: front(0.65) };
  });
  add('fridge', 'glass', 'Glass-door drinks fridge', 1.0, 0.8, 2.1, (g) => {
    const b = B(g), c = C(g);
    b(1.0, 2.1, 0.8, '#1f1d2b', 0, 0, 0, { r: 0.04 });
    b(0.86, 1.7, 0.02, '#0f1424', 0, 0.25, 0.39, { ink: false, opts: { emissive: '#bfe8ff', emissiveIntensity: 0.25 } });
    for (let r = 0; r < 4; r++) for (let i = 0; i < 5; i++) c(0.05, 0.05, 0.28, ['#e05d5d', '#f5c04a', '#34d399', '#5b8cff', '#f4f1fa'][(i + r) % 5], -0.32 + i * 0.16, 0.3 + r * 0.42, 0.33, { seg: 10 });
    b(0.9, 0.2, 0.05, '#e05d5d', 0, 1.88, 0.39, { r: 0.02, ink: false, opts: { emissive: '#e05d5d', emissiveIntensity: 0.6 } });
    return { spots: front(0.8) };
  });

  // ------------------------------------------------------------ kitchen & café
  add('kitchen', 'counter', 'Kitchen counter', 4.6, 1.2, 1.6, (g) => {
    const b = B(g), c = C(g);
    b(4.4, 1.0, 1.1, '#e7e2ef', 0, 0, 0, { r: 0.04 }); b(4.6, 0.08, 1.2, '#7b6f8f', 0, 1.0, 0, { r: 0.02 });
    for (let i = 0; i < 4; i++) b(1.0, 0.8, 0.02, '#ddd6e8', -1.6 + i * 1.07, 0.1, 0.56, { r: 0.01 });
    b(0.4, 0.5, 0.45, '#2a2638', 1.1, 1.08, 0, { r: 0.05 });
    c(0.08, 0.07, 0.14, '#e05d5d', -0.1, 1.08, 0.1); c(0.08, 0.07, 0.14, '#f4f1fa', -0.5, 1.08, -0.05);
    return { spots: front(1.2), solids: [[0, 0, 4.4, 1.1]] };
  });
  add('kitchen', 'sink', 'Sink counter, oak', 4.6, 1.2, 1.6, (g) => {
    const b = B(g), c = C(g);
    b(4.4, 1.0, 1.1, '#3b3552', 0, 0, 0, { r: 0.04 }); b(4.6, 0.08, 1.2, '#c8a27a', 0, 1.0, 0, { r: 0.02 });
    b(0.9, 0.04, 0.6, '#c9ccd6', -0.8, 1.06, 0, { r: 0.02, ink: false, opts: CHROME });
    c(0.03, 0.03, 0.35, '#c9ccd6', -0.8, 1.08, -0.35, { opts: CHROME });
    for (let i = 0; i < 3; i++) mesh(g, new THREE.IcosahedronGeometry(0.16, 0), mat(['#3f8f5a', '#2f7a4c', '#4fa26a'][i], { flatShading: true }), 1.2 + i * 0.35, 1.3, -0.3);
    for (let i = 0; i < 3; i++) c(0.1, 0.08, 0.16, '#c8674a', 1.2 + i * 0.35, 1.08, -0.3);
    return { spots: front(1.2), solids: [[0, 0, 4.4, 1.1]] };
  });
  add('kitchen', 'island', 'Marble island', 3.2, 1.4, 1.2, (g) => {
    const b = B(g);
    b(3.0, 0.95, 1.2, '#2f3a66', 0, 0, 0, { r: 0.04 }); b(3.2, 0.08, 1.4, '#efeae4', 0, 0.95, 0, { r: 0.03, opts: { roughness: 0.2 } });
    mesh(g, new THREE.SphereGeometry(0.25, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c8a27a', { side: THREE.DoubleSide }), 0, 1.28, 0).rotation.x = Math.PI;
    for (const [dx, c] of [[-0.1, '#f5c04a'], [0.1, '#e05d5d'], [0, '#34d399']]) mesh(g, new THREE.SphereGeometry(0.08, 10, 8), mat(c), dx, 1.1, (dx + 0.05) * 0.5);
    return { spots: [[0, 1.4, Math.PI], [0, -1.4, 0]] };
  });
  const bar = (id, name, body, top) => add('kitchen', id, name, 5.4, 1.15, 1.8, (g) => {
    const b = B(g), c = C(g);
    b(5.2, 1.05, 0.95, body, 0, 0, 0, { r: 0.04 }); b(5.4, 0.08, 1.15, top, 0, 1.05, 0, { r: 0.03 });
    b(0.55, 0.62, 0.45, '#2a2638', -1.6, 1.13, -0.15, { r: 0.05 }); b(0.3, 0.12, 0.2, '#9a92ad', -1.6, 1.38, 0.12, { r: 0.02, ink: false, opts: { metalness: 0.6, roughness: 0.3 } });
    c(0.06, 0.05, 0.1, '#f4f1fa', -1.6, 1.13, 0.15);
    // click the coffee machine and the cup steams for a bit
    const puffs = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.userData.live = true; g.add(m); return m; });
    k.toy(-1.6, 1.1, 0, 0.75, 0.75, 0.8, { kind: 'poke', dur: 4, sound: [90, 0.5, 'sawtooth', 0.015], step(e) {
      puffs.forEach((m, i) => { const q = (e * 0.8 + i / puffs.length) % 1; m.visible = e < this.dur; m.position.set(-1.6 + Math.sin(e * 3 + i * 2) * 0.05, 1.28 + q * 0.75, 0.15); m.scale.setScalar(0.6 + q * 1.6); m.material.opacity = (1 - q) * 0.45 * Math.min(1, this.dur - e, e * 2); });
    } }, g);
    b(1.0, 0.45, 0.6, '#fbfbfe', 1.4, 1.13, -0.1, { r: 0.04, opts: { transparent: true, opacity: 0.55 } });
    for (let i = 0; i < 3; i++) c(0.1, 0.1, 0.07, ['#c8674a', '#f5c04a', '#e05d8a'][i], 1.1 + i * 0.3, 1.18, -0.1);
    for (let i = 0; i < 4; i++) c(0.07, 0.06, 0.13, ['#5b8cff', '#f4f1fa', '#2dd4bf', '#f4f1fa'][i], -0.6 + i * 0.22, 1.13, -0.25);
    return { solids: [[0, 0, 5.4, 1.15, 0.3]] };
  });
  bar('cafe', 'Coffee bar', '#3b3552', '#e9e2f3');
  bar('cafe-wood', 'Coffee bar, timber', '#8a6444', '#efeae4');

  // ------------------------------------------------------------ drinks
  add('drinks', 'cooler', 'Water cooler', 0.6, 0.6, 1.5, (g) => {
    k.box(0.5, 0.95, 0.5, '#e9e2f3', 0, 0, 0, { parent: g, r: 0.05 });
    k.cyl(0.2, 0.2, 0.45, '#7dd3fc', 0, 0.95, 0, { parent: g, opts: { transparent: true, opacity: 0.7, roughness: 0.1 } });
    return { spots: [[0, 0.9, Math.PI]], solids: [[0, 0, 0.5, 0.5]] };
  });
  const vend = (id, name, c, glow) => add('drinks', id, name, 1.1, 0.9, 2.2, (g) => {
    k.box(1.1, 2.2, 0.9, c, 0, 0, 0, { parent: g, r: 0.06 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.3), new THREE.MeshStandardMaterial({ color: '#2a2638', emissive: glow, emissiveIntensity: 0.25 }));
    face.position.set(-0.08, 1.35, 0.46); g.add(face);
    k.box(0.2, 0.5, 0.02, '#1f1d2b', 0.38, 1.1, 0.45, { parent: g, r: 0.01, ink: false });
    return { spots: front(0.9, 0.6) };
  });
  vend('vending', 'Vending machine, red', '#e05d5d', '#7dd3fc');
  vend('vending-blue', 'Vending machine, blue', '#4f8dff', '#fde68a');

  // ------------------------------------------------------------ games
  add('games', 'pingpong', 'Ping-pong table', 2.8, 1.6, 0.9, (g) => {
    const b = B(g);
    b(2.74, 0.06, 1.52, '#1f6f5a', 0, 0.74, 0, { r: 0.02 });
    b(2.74, 0.005, 0.03, '#f4f1fa', 0, 0.8, 0, { r: 0.002, ink: false }); b(0.03, 0.005, 1.52, '#f4f1fa', 0, 0.8, 0, { r: 0.002, ink: false });
    b(0.04, 0.16, 1.6, '#f4f1fa', 0, 0.8, 0, { r: 0.01, ink: false, opts: { transparent: true, opacity: 0.7 } });
    for (const dx of [-1.1, 1.1]) for (const dz of [-0.6, 0.6]) b(0.06, 0.74, 0.06, '#2a2638', dx, 0, dz, { r: 0.02, ink: false });
    const ball = mesh(g, new THREE.SphereGeometry(0.04, 10, 8), mat('#ffb547'), -0.5, 0.86, 0.2, true);
    const rest = ball.position.clone();
    // click the table for a rally: over the net, a bounce on the far side, up to the far paddle
    k.toy(0, 0.6, 0, 2.8, 0.4, 1.6, { kind: 'poke', dur: 5.6, hits: 0, poke() { this.hits = 0; }, step(e) {
      if (e >= this.dur) return ball.position.copy(rest);
      const p = e * 1.25, f = p % 1, dir = Math.floor(p) % 2 ? -1 : 1;
      const y = f < 0.7 ? k.lerp(1.0, 0.83, f / 0.7) + 0.22 * Math.sin(Math.PI * f / 0.7) : 0.83 + 0.17 * ((f - 0.7) / 0.3) + 0.08 * Math.sin(Math.PI * (f - 0.7) / 0.3);
      ball.position.set(dir * (-1.25 + 2.5 * f), y, Math.sin(p * 2.3) * 0.35);
      const hit = Math.floor(p * 2 + 0.6);
      if (hit > this.hits) { this.hits = hit; k.blip(hit % 2 ? 1900 : 1300, 0.025, 'square', 0.012); }
    } }, g);
    return { spots: [[-2.05, 0, Math.PI / 2], [2.05, 0, -Math.PI / 2]], solids: [[0, 0, 2.74, 1.52, 0.3]] };
  });
  const arcade = (id, name, c) => add('games', id, name, 0.9, 0.85, 2.0, (g) => {
    const b = B(g);
    b(0.9, 1.95, 0.85, c, 0, 0, 0, { r: 0.05 }); b(0.85, 0.12, 0.5, '#2a2638', 0, 1.0, 0.35, { r: 0.03 });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.3), toneMapped: false }));
    scr.position.set(0, 1.5, 0.43); scr.userData.live = true; g.add(scr);
    const idle = scr.material.color.clone(), seed = c.length + c.charCodeAt(2);
    k.toy(0, 0, 0, 1.0, 2.0, 0.95, { kind: 'poke', dur: 4, sound: [440, 0.12, 'square', 0.015], step(e) {
      if (e >= this.dur) return scr.material.color.copy(idle);
      scr.material.color.setHSL(e * 1.7 + seed, 0.85, 0.55 + 0.15 * Math.sin(e * 30));
      if (Math.random() < 0.06) k.blip(300 + Math.random() * 900, 0.04, 'square', 0.01);
    } }, g);
    return { spots: front(0.85, 0.85), solids: [[0, 0, 0.9, 0.85, 0.3]] };
  });
  arcade('arcade-purple', 'Arcade cabinet, violet', '#a78bfa');
  arcade('arcade-pink', 'Arcade cabinet, pink', '#f472b6');
  arcade('arcade-green', 'Arcade cabinet, lime', '#84cc16');
  add('games', 'foosball', 'Foosball table', 1.5, 0.9, 1.0, (g) => {
    const b = B(g), c = C(g);
    b(1.4, 0.3, 0.8, '#7b5a43', 0, 0.6, 0, { r: 0.03 }); b(1.3, 0.02, 0.7, '#2f9f5a', 0, 0.88, 0, { ink: false });
    for (const [x, z] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) b(0.08, 0.6, 0.08, '#3b2f2a', x, 0, z, { r: 0.02, ink: false });
    const rods = [];
    for (let i = 0; i < 6; i++) {
      const rod = new THREE.Group(); rod.position.set(-0.55 + i * 0.22, 0.98, 0); rod.userData.live = true; g.add(rod);
      c(0.012, 0.012, 1.2, '#c9ccd6', 0, -0.6, 0, { parent: rod, seg: 6 }).rotation.x = Math.PI / 2;
      for (let m = 0; m < 3; m++) k.box(0.05, 0.14, 0.05, i % 2 ? '#e05d5d' : '#5b8cff', 0, -0.12, -0.2 + m * 0.2, { parent: rod, r: 0.01, ink: false });
      rods.push(rod);
    }
    k.toy(0, 0.5, 0, 1.5, 0.6, 1.0, { kind: 'poke', dur: 3, sound: [240, 0.06, 'square', 0.02], step(e) { rods.forEach((r, i) => (r.rotation.z = e < this.dur ? Math.sin(e * 14 + i) * 1.2 : 0)); if (Math.random() < 0.05) k.blip(800, 0.02, 'square', 0.01); } }, g);
    return { spots: [[0, 1.2, Math.PI], [0, -1.2, 0]], solids: [[0, 0, 1.4, 0.8, 0.3]] };
  });
  add('games', 'pool', 'Pool table', 2.8, 1.6, 0.9, (g) => {
    const b = B(g);
    b(2.7, 0.2, 1.5, '#5a3d2b', 0, 0.62, 0, { r: 0.05 }); b(2.4, 0.02, 1.2, '#1f6f5a', 0, 0.82, 0, { ink: false });
    for (const [x, z] of [[-1.15, -0.6], [1.15, -0.6], [-1.15, 0.6], [1.15, 0.6]]) b(0.16, 0.62, 0.16, '#3b2f2a', x, 0, z, { r: 0.04 });
    [['#f4f1fa', -0.7, 0], ['#e05d5d', 0.5, 0], ['#f5c04a', 0.6, 0.06], ['#5b8cff', 0.6, -0.06], ['#2a2638', 0.7, 0], ['#34d399', 0.7, 0.12], ['#a78bfa', 0.7, -0.12]].forEach(([c, x, z]) => mesh(g, new THREE.SphereGeometry(0.035, 10, 8), mat(c, { roughness: 0.3 }), x, 0.87, z));
    k.box(1.4, 0.025, 0.025, '#c8a27a', -0.4, 0.9, 0.3, { parent: g, ink: false }).rotation.y = 0.2;
    return { spots: [[-2.0, 0, Math.PI / 2], [2.0, 0, -Math.PI / 2]], solids: [[0, 0, 2.7, 1.5, 0.3]] };
  });

  // ------------------------------------------------------------ tech
  add('tech', 'rack', 'Server rack', 1.3, 1.1, 2.7, (g, it) => {
    const b = B(g), n = (it.x * 7 + it.z * 3) | 0;
    b(1.3, 2.7, 1.1, '#24212f', 0, 0, 0, { r: 0.04 });
    b(1.14, 2.5, 0.03, '#312c42', 0, 0.1, 0.56, { r: 0.01, ink: false });
    for (let r = 0; r < 10; r++) {
      const y = 0.3 + r * 0.23;
      b(1.0, 0.012, 0.02, '#1a1824', 0, y - 0.05, 0.58, { r: 0.003, ink: false, cast: false });
      for (let q = 0; q < 3; q++) if ((n * 7 + r * 3 + q) % 4) { const led = b(0.07, 0.035, 0.02, '#000', 0.28 + q * 0.11, y, 0.58, { r: 0.008, ink: false, cast: false }); led.material = k.LEDS[Math.abs(n * 5 + r * 2 + q) % k.LEDS.length]; }
    }
    b(1.4, 0.08, 0.5, '#5a5470', 0, 3.0, 0, { r: 0.02 }); // a length of the cable tray
    return { spots: front(1.1, 1.0) };
  });
  add('tech', 'console', 'Ops console', 2.6, 2.4, 1.9, (g) => {
    const b = B(g);
    b(2.6, 0.08, 1.0, '#e9e2f3', 0, 0.9, 0, { r: 0.03 });
    for (const dx of [-1.2, 1.2]) b(0.12, 0.9, 0.9, '#3b3552', dx, 0, 0, { r: 0.02 });
    for (const dx of [-0.6, 0.6]) {
      b(1.0, 0.62, 0.06, '#1f1d2b', dx, 1.25, -0.2, { r: 0.03 }); b(0.07, 0.3, 0.07, '#1f1d2b', dx, 0.98, -0.2, { ink: false });
      for (const [z, ry] of [[-0.16, Math.PI], [-0.24, 0]]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.54), new THREE.MeshBasicMaterial({ map: k.GRAPH_TEX, toneMapped: false, color: new THREE.Color(0.9, 0.9, 0.9) })); s.position.set(dx, 1.56, z); s.rotation.y = ry; g.add(s); }
    }
    const ch = new THREE.Group(); ch.position.set(0, 0, -1.15); ch.rotation.y = Math.PI; g.add(ch);
    const cb = B(ch), cc = C(ch);
    cc(0.05, 0.05, 0.45, '#2a2638'); cc(0.3, 0.3, 0.04, '#2a2638'); cb(0.7, 0.1, 0.65, '#3b3552', 0, 0.45, 0, { r: 0.05 }); cb(0.7, 0.62, 0.1, '#3b3552', 0, 0.55, -0.32, { r: 0.05 });
    return { seats: [[0, 0.55, -1.15, Math.PI]], solids: [[0, 0, 2.6, 1.0], [0, -1.15, 0.7, 0.7, 0.2]] };
  }, { hit: [0, -0.55, 2.6, 2.2, 1.9] });
  add('tech', 'printer', 'Office printer', 1.0, 0.8, 1.2, (g) => {
    const b = B(g);
    b(1.0, 0.8, 0.8, '#e9e2f3', 0, 0, 0, { r: 0.05 }); b(0.9, 0.25, 0.7, '#d9d2e6', 0, 0.8, 0, { r: 0.04 });
    b(0.3, 0.06, 0.02, '#34d399', 0.25, 1.0, 0.36, { ink: false, opts: { emissive: '#34d399', emissiveIntensity: 1 } });
    const page = k.box(0.5, 0.01, 0.6, '#fbfbfe', 0, 0.6, 0.2, { parent: g, r: 0.002, ink: false }); page.userData.live = true;
    k.toy(0, 0, 0, 1.0, 1.1, 0.8, { kind: 'poke', dur: 1.6, sound: [520, 0.3, 'sawtooth', 0.01], step(e) { page.position.z = 0.2 + Math.min(1, e / this.dur) * 0.35; if (e >= this.dur) page.position.z = 0.2; } }, g);
    return { spots: front(0.8) };
  });

  // ------------------------------------------------------------ screens & boards
  add('screen', 'tv', 'TV on a rolling stand', 0.9, 2.3, 2.6, (g) => {
    const b = B(g), c = C(g);
    c(0.05, 0.05, 1.5, '#2a2638'); b(0.9, 0.06, 0.9, '#2a2638', 0, 0, 0, { r: 0.02, ink: false });
    b(0.12, 1.3, 2.3, '#1f1d2b', 0, 1.3, 0, { r: 0.03 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 1.18), new THREE.MeshBasicMaterial({ map: k.SLIDES[0], toneMapped: false, color: new THREE.Color(0.85, 0.85, 0.85) }));
    face.position.set(0.07, 1.95, 0); face.rotation.y = Math.PI / 2; face.userData.live = true; g.add(face);
    const slides = [...k.SLIDES, null];
    // click the screen for the next slide, then off, then back to the start
    k.toy(0, 1.2, 0, 0.4, 1.5, 2.4, { kind: 'poke', n: 0, sound: [660, 0.05, 'square', 0.015], poke() {
      const s = slides[this.n = (this.n + 1) % slides.length];
      face.material.map = s; face.material.color.setScalar(s ? 0.85 : 0.05); face.material.needsUpdate = true;
    } }, g);
    return { spots: [[1.2, -2.6, -0.4]], solids: [[0, 0, 0.9, 2.3, 0.3]] };
  });
  add('screen', 'whiteboard', 'Rolling whiteboard', 0.7, 2.2, 2.3, (g) => {
    const b = B(g);
    for (const z of [-1.0, 1.0]) { b(0.06, 2.1, 0.06, '#9a92ad', 0, 0.1, z, { ink: false }); b(0.6, 0.06, 0.08, '#2a2638', 0, 0, z, { r: 0.02, ink: false }); }
    b(0.06, 1.2, 2.1, '#c9c3d6', 0, 0.9, 0, { r: 0.02 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.1), new THREE.MeshStandardMaterial({ map: k.BOARD_TEX, roughness: 0.4 }));
    face.position.set(0.04, 1.5, 0); face.rotation.y = Math.PI / 2; g.add(face);
    return { spots: [[1.1, -0.6, -Math.PI / 2]], solids: [[0, 0, 0.7, 2.2, 0.2]] };
  });

  // ------------------------------------------------------------ floor lamps (click to switch)
  const floorLamp = (id, name, o) => add('lamp', id, name, 0.7, 0.7, o.h + 0.4, (g, it) => {
    const b = B(g), c = C(g);
    if (o.tripod) for (let i = 0; i < 3; i++) { const l = b(0.04, o.h, 0.04, '#a8784f', 0, 0, 0, { ink: false }); l.rotation.set(Math.cos(i * 2.1) * 0.18, 0, Math.sin(i * 2.1) * 0.18); }
    else { c(o.pole, o.pole, o.h, o.metal); c(0.25, 0.25, 0.04, o.metal); }
    let shade;
    if (o.globe) shade = mesh(g, new THREE.SphereGeometry(0.3, 24, 16), mat('#fff6e6', { emissive: '#ffcf9a', emissiveIntensity: 0.7 }), 0, o.h + 0.2, 0);
    else shade = c(o.top, o.bottom, o.sh, o.shade, 0, o.h - o.sh * 0.6, 0, { opts: { emissive: o.glow, emissiveIntensity: 0.6 } });
    shade.material = shade.material.clone(); shade.userData.live = true;
    const light = { y: o.h - 0.1, color: o.glow, power: o.power || 3 };
    k.toy(0, 0, 0, 0.75, o.h + 0.35, 0.75, { kind: 'lamp', on: it.on ?? true, apply(t) { shade.material.emissiveIntensity = this.on ? 0.3 + t.lamps * 0.6 : 0; } }, g);
    return { solids: [[0, 0, 0.5, 0.5]], light };
  });
  floorLamp('arc', 'Studio lamp', { h: 2.6, pole: 0.05, metal: '#3b2f2a', top: 0.35, bottom: 0.5, sh: 0.5, shade: '#fde6c8', glow: '#ffb27a', power: 6 });
  floorLamp('nook', 'Reading lamp', { h: 2.0, pole: 0.03, metal: '#2a2638', top: 0.22, bottom: 0.32, sh: 0.38, shade: '#fde6c8', glow: '#ffcf9a' });
  floorLamp('banker', "Banker's floor lamp", { h: 1.9, pole: 0.04, metal: '#2a2638', top: 0.22, bottom: 0.32, sh: 0.3, shade: '#2f7a4c', glow: '#ffd27a' });
  floorLamp('tripod', 'Tripod drum lamp', { h: 1.7, tripod: true, top: 0.38, bottom: 0.38, sh: 0.42, shade: '#f4f1fa', glow: '#ffe2b8' });
  floorLamp('globe', 'Opal globe lamp', { h: 1.6, pole: 0.03, metal: '#c9a227', globe: true, glow: '#ffcf9a' });

  // ------------------------------------------------------------ ceiling lights (hang over things)
  const pendant = (id, name, o) => add('pendant', id, name, 1.0, 1.0, 0.8, (g, it) => {
    k.cyl(0.012, 0.012, 2.4, '#2a2638', 0, 3.7, 0, { parent: g, seg: 6 });
    if (o.globe) mesh(g, new THREE.SphereGeometry(0.32, 20, 14), mat('#fff6e6', { transparent: true, opacity: 0.85 }), 0, 3.45, 0);
    else if (o.cage) for (let i = 0; i < 6; i++) { const r = mesh(g, new THREE.TorusGeometry(0.24, 0.012, 6, 20), mat('#c9a227', BRASS), 0, 3.42, 0); r.rotation.y = (i * Math.PI) / 6; }
    else k.cyl(0.12, 0.42, 0.34, o.color, 0, 3.4, 0, { parent: g });
    const bulb = new THREE.Mesh(o.globe || o.cage ? new THREE.SphereGeometry(o.cage ? 0.1 : 0.2, 14, 10) : new THREE.CircleGeometry(0.36, 28), new THREE.MeshBasicMaterial({ color: '#ffe2b8', toneMapped: false }));
    if (!o.globe && !o.cage) bulb.rotation.x = Math.PI / 2;
    bulb.position.set(0, o.globe ? 3.45 : o.cage ? 3.42 : 3.39, 0); bulb.userData.live = true; g.add(bulb);
    k.toy(0, 3.15, 0, 0.95, 0.7, 0.95, { kind: 'lamp', pendant: true, on: it.on ?? true, apply(t) { bulb.material.color.set(this.on ? '#ffe2b8' : '#3a3442').multiplyScalar(this.on ? 0.55 + t.lamps * 0.5 : 1); } }, g);
    return { solids: [] };
  }, { hit: [0, 0, 0.9, 0.9, 0.8, 3.1], hanging: true });
  pendant('dome', 'Black dome', { color: '#2a2638' });
  pendant('white', 'White dome', { color: '#f4f1fa' });
  pendant('globe', 'Opal globe', { globe: true });
  pendant('cage', 'Brass cage', { cage: true });

  // ------------------------------------------------------------ plants
  const potted = (g, pot = '#c8674a', rim = '#b35a40') => { k.cyl(0.38, 0.3, 0.6, pot, 0, 0, 0, { parent: g }); k.cyl(0.4, 0.4, 0.06, rim, 0, 0.58, 0, { parent: g }); };
  const scaled = (g, s) => { const inner = new THREE.Group(); inner.scale.setScalar(s || 1); g.add(inner); return inner; };
  add('plant', 'cone', 'Cone tree', 0.8, 0.8, 2.0, (g, it) => {
    const p = scaled(g, it.s); potted(p);
    for (let i = 0; i < 3; i++) { const c = mesh(p, new THREE.ConeGeometry(0.55 - i * 0.12, 0.75, 7), mat(i % 2 ? '#3f8f5a' : '#2f7a4c', { flatShading: true }), 0, 0.95 + i * 0.42, 0); c.rotation.y = i; }
    return { solids: [[0, 0, 0.8 * (it.s || 1), 0.8 * (it.s || 1)]] };
  });
  add('plant', 'monstera', 'Monstera', 1.0, 1.0, 1.7, (g, it) => {
    const p = scaled(g, it.s); potted(p, '#f4f1fa', '#ddd6e8');
    for (let i = 0; i < 7; i++) { const a = i * 0.9, r = 0.25 + (i % 3) * 0.1; const l = mesh(p, new THREE.SphereGeometry(0.28, 10, 6), mat(i % 2 ? '#2f7a4c' : '#3f8f5a', { flatShading: true }), Math.cos(a) * r, 0.95 + (i % 4) * 0.18, Math.sin(a) * r); l.scale.set(1, 0.25, 0.7); l.rotation.set(0.4, a, 0.3); }
    return { solids: [[0, 0, 0.9 * (it.s || 1), 0.9 * (it.s || 1)]] };
  });
  add('plant', 'cactus', 'Cactus', 0.7, 0.7, 1.6, (g, it) => {
    const p = scaled(g, it.s); potted(p, '#e9c46a', '#d4ad52');
    k.cyl(0.16, 0.18, 0.95, '#4fa26a', 0, 0.6, 0, { parent: p, seg: 10 });
    mesh(p, new THREE.SphereGeometry(0.16, 10, 8), mat('#4fa26a'), 0, 1.55, 0);
    for (const sx of [-1, 1]) { k.cyl(0.08, 0.08, 0.3, '#4fa26a', sx * 0.24, 1.0 + (sx > 0 ? 0.15 : 0), 0, { parent: p, seg: 8 }); k.cyl(0.08, 0.08, 0.1, '#4fa26a', sx * 0.15, 1.0 + (sx > 0 ? 0.15 : 0), 0, { parent: p, seg: 8 }).rotation.z = Math.PI / 2; }
    mesh(p, new THREE.SphereGeometry(0.05, 8, 6), mat('#f472b6'), 0, 1.7, 0);
    return { solids: [[0, 0, 0.7 * (it.s || 1), 0.7 * (it.s || 1)]] };
  });
  add('plant', 'palm', 'Tall palm', 1.0, 1.0, 2.8, (g, it) => {
    const p = scaled(g, it.s); potted(p, '#3b3552', '#2a2638');
    k.cyl(0.06, 0.09, 1.8, '#8a6444', 0, 0.6, 0, { parent: p, seg: 8 });
    for (let i = 0; i < 7; i++) { const f = mesh(p, new THREE.ConeGeometry(0.16, 1.1, 4), mat(i % 2 ? '#3f8f5a' : '#4fa26a', { flatShading: true }), 0, 2.4, 0); f.geometry.translate(0, 0.55, 0); f.rotation.set(1.1, (i * Math.PI * 2) / 7, 0); }
    return { solids: [[0, 0, 0.8 * (it.s || 1), 0.8 * (it.s || 1)]] };
  });
  add('plant', 'fern', 'Bushy fern', 0.9, 0.9, 1.3, (g, it) => {
    const p = scaled(g, it.s); potted(p, '#7b5a43', '#6b4a35');
    for (let i = 0; i < 6; i++) mesh(p, new THREE.IcosahedronGeometry(0.3 - (i % 2) * 0.06, 0), mat(i % 2 ? '#4fa26a' : '#2f7a4c', { flatShading: true }), Math.cos(i) * 0.2, 0.85 + (i % 3) * 0.14, Math.sin(i) * 0.2);
    return { solids: [[0, 0, 0.8 * (it.s || 1), 0.8 * (it.s || 1)]] };
  });
  add('plant', 'planter', 'Long planter', 7.0, 1.3, 2.4, (g) => {
    const b = B(g);
    b(7.0, 0.55, 1.3, '#7b5a43', 0, 0, 0, { r: 0.05 }); b(6.7, 0.04, 1.0, '#4a3626', 0, 0.55, 0, { r: 0.01, ink: false, cast: false });
    for (const [dx, s] of [[-2.6, 0.95], [0, 1.15], [2.6, 0.9]]) {
      const p = new THREE.Group(); p.position.set(dx, 0.55, 0); p.scale.setScalar(s); g.add(p); potted(p);
      for (let i = 0; i < 3; i++) { const c = mesh(p, new THREE.ConeGeometry(0.55 - i * 0.12, 0.75, 7), mat(i % 2 ? '#3f8f5a' : '#2f7a4c', { flatShading: true }), 0, 0.95 + i * 0.42, 0); c.rotation.y = i; }
    }
    for (const dx of [-1.3, 1.3]) for (const q of [-0.6, 0.6]) mesh(g, new THREE.IcosahedronGeometry(0.32 + Math.abs(dx + q) % 0.12, 0), mat(q > 0 ? '#4fa26a' : '#3f8f5a', { flatShading: true }), dx + q * 0.6, 0.78, q * 0.25);
  });

  // ------------------------------------------------------------ rugs & floors (walk right over them)
  const rugMat = (c) => mat(c, { roughness: 0.95 });
  const flat = (g, geo, c, y) => { const r = new THREE.Mesh(geo, rugMat(c)); r.rotation.x = -Math.PI / 2; r.position.y = y; r.receiveShadow = true; g.add(r); return r; };
  const rect = (id, name, w, d, c1, c2) => add('rug', id, name, w, d, 0.03, (g, it) => {
    const W = it.w || w, D = it.d || d;
    flat(g, new THREE.PlaneGeometry(W, D), c1, 0.006); flat(g, new THREE.PlaneGeometry(W - 0.5, D - 0.5), c2, 0.008);
    return { solids: [], size: [W, D] };
  }, { flat: true, resizable: true });
  rect('lilac', 'Lilac rug', 8, 6, '#a89cc2', '#b6abcd');
  rect('mauve', 'Mauve rug', 8, 5, '#8f84ad', '#a69bc4');
  rect('slate', 'Slate blue rug', 7, 5, '#5b6b8f', '#6d7da3');
  rect('forest', 'Forest green rug', 7, 6, '#3f8f6a', '#4fa27a');
  rect('gold', 'Navy & gold rug', 7, 4.4, '#e9c46a', '#3d5199');
  rect('sand', 'Sand rug', 6, 4, '#d8c3a5', '#e6d5bc');
  const round = (id, name, r, c, ring) => add('rug', id, name, r * 2, r * 2, 0.03, (g, it) => {
    const R = (it.w || r * 2) / 2;
    flat(g, new THREE.CircleGeometry(R, 64), c, 0.01);
    if (ring) flat(g, new THREE.RingGeometry(R - 0.4, R - 0.28, 64), ring, 0.015);
    return { solids: [], size: [R * 2, R * 2] };
  }, { flat: true, resizable: true, round: true });
  round('navy-round', 'Round navy rug', 4.0, '#3b4a9a');
  round('clay-round', 'Round clay rug', 3.8, '#d97757', '#f3d9c8');
  round('terracotta-round', 'Round terracotta rug', 2.9, '#c86f5a');
  round('mint-round', 'Round mint rug', 3.0, '#8fd1b8', '#e6f6ef');
  const tiles = (id, name, tex) => add('rug', id, name, 8, 6, 0.03, (g, it) => {
    const W = it.w || 8, D = it.d || 6, t = k.tiles(tex).clone(); t.needsUpdate = true; t.repeat.set(W / 2.4, D / 2.4);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
    f.rotation.x = -Math.PI / 2; f.position.y = 0.007; f.receiveShadow = true; g.add(f);
    return { solids: [], size: [W, D] };
  }, { flat: true, resizable: true });
  tiles('server-tiles', 'Raised server tiles', 'server');
  tiles('checker', 'Checkerboard floor', 'checker');
  tiles('terrazzo', 'Terrazzo floor', 'terrazzo');

  // ------------------------------------------------------------ platforms (a low step bots ride up)
  const platform = (id, name, c, h) => add('platform', id, name, 8, 6, h, (g, it) => {
    const W = it.w || 8, D = it.d || 6;
    k.box(W, h, D, c, 0, 0, 0, { parent: g, r: 0.05, cast: false });
    return { solids: [], step: h, size: [W, D] };
  }, { flat: true, resizable: true });
  platform('terracotta', 'Terracotta stage', '#e8c4ae', 0.16);
  platform('navy', 'Navy stage', '#2f3a66', 0.12);
  platform('oak', 'Oak deck', '#c8a27a', 0.14);
  platform('slate', 'Slate stage', '#5a5470', 0.14);

  // ------------------------------------------------------------ walls & dividers
  const wall = (id, name, o) => add('partition', id, name, 4, 0.14, o.h, (g, it) => {
    const W = it.w || 4, b = B(g);
    if (o.kind === 'glass') {
      b(W, 0.12, 0.08, '#3b3552', 0, 0, 0, { r: 0.02, ink: false });
      b(W, o.h - 0.24, 0.06, '#cfe9ff', 0, 0.12, 0, { r: 0.01, ink: false, cast: false, opts: GLASS });
      b(W + 0.04, 0.1, 0.1, '#3b3552', 0, o.h - 0.12, 0, { r: 0.02, ink: false });
      for (const x of [-W / 2, W / 2]) b(0.08, o.h, 0.08, '#3b3552', x, 0, 0, { r: 0.02, ink: false });
    } else if (o.kind === 'brass') {
      b(W, o.h, 0.06, '#d6e6ff', 0, 0, 0, { r: 0.01, ink: false, cast: false, opts: { ...GLASS, opacity: 0.18 } });
      b(W + 0.05, 0.07, 0.11, '#c9a227', 0, o.h, 0, { r: 0.02, ink: false, opts: BRASS });
      for (const x of [-W / 2, W / 2]) b(0.1, o.h + 0.1, 0.1, '#c9a227', x, 0, 0, { r: 0.02, ink: false, opts: BRASS });
    } else if (o.kind === 'felt') {
      for (let i = 0; i < Math.round(W / 1); i++) b(W / Math.round(W / 1) - 0.06, o.h, 0.12, o.colors[i % o.colors.length], -W / 2 + (i + 0.5) * (W / Math.round(W / 1)), 0.1, 0, { r: 0.05, opts: { roughness: 0.95 } });
      for (const x of [-W / 2 + 0.2, W / 2 - 0.2]) b(0.3, 0.1, 0.4, '#2a2638', x, 0, 0, { r: 0.02, ink: false });
    } else {
      for (const x of [-W / 2, W / 2]) b(0.08, o.h, 0.4, '#7b5a43', x, 0, 0, { r: 0.02 });
      for (const y of [0.3, 0.95, 1.6]) b(W, 0.05, 0.4, '#8a6444', 0, y, 0, { r: 0.01 });
      for (let i = 0; i < W * 1.2; i++) mesh(g, new THREE.IcosahedronGeometry(0.17, 0), mat(i % 2 ? '#3f8f5a' : '#4fa26a', { flatShading: true }), -W / 2 + 0.4 + i * 0.8, [0.47, 1.12, 1.77][i % 3], 0);
    }
    return { solids: [[0, 0, W, o.kind === 'shelf' ? 0.4 : 0.14]], size: [W, 0.14] };
  }, { resizable: 'w' });
  wall('glass', 'Glass partition', { kind: 'glass', h: 2.67 });
  wall('brass', 'Low glass, brass rail', { kind: 'brass', h: 1.15 });
  wall('felt', 'Felt acoustic panels', { kind: 'felt', h: 1.6, colors: ['#5b8cff', '#2dd4bf', '#f5c04a'] });
  wall('shelf', 'Plant shelf divider', { kind: 'shelf', h: 1.9 });

  return Object.fromEntries(list.map((t) => [t.id, t]));
}
