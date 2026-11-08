/* SNACC Homunculus Bioreactor · Interactive Hand-Drawn Statechart Sheet */

const ST = {
  dormant: 'dormant',
  homeostasis: 'homeostasis',
  transmuting: 'transmuting',
  fever: 'fever',
  lysis: 'lysis'
};

function draw(seed) {
  begin(seed);
  OX = 700;
  OY = 520;

  // Title block
  title('a flow machine · statechart', 'Homunculus Bioreactor');
  out.push(`<text x="72" y="202" class="it" font-size="22" fill="${INK}" letter-spacing=".8">Crucible homeostasis, catalytic transmutation, and cell lysis</text>`);

  // Main laboratory tiled platform
  board(-220, -220, 440, 440, 24, '#efeae0', '#cfc3ab', 20);

  // Isometric floor tile seams
  const tileLines = [];
  for (let k = -200; k <= 200; k += 50) {
    tileLines.push([P(k, -200, 0), P(k, 200, 0)]);
    tileLines.push([P(-200, k, 0), P(200, k, 0)]);
  }
  rule(tileLines, '#b8ad96', 0.5);

  // Cast shadows for structures
  cast(-160, 40, 60, 60, 40);       // Hopper / feeder
  castDisc(0, 0, 52, 120);          // Central crucible vat
  cast(120, -60, 70, 70, 50);       // Transmutation condenser
  cast(-140, -140, 60, 60, 36);     // Stasis incubator
  cast(40, 140, 70, 70, 24);        // Lysis collection basin
  layShades();

  // 1. DORMANT STASIS INCUBATOR (data-state="dormant")
  group('data-state="dormant"', () => {
    const x = -130, y = -130;
    box(x, y, 0, 54, 54, 18, { left: '#a4b3b8', top: '#cbd7db', marks: false, ink: 1 });
    lifeTurn(x + 27, y + 27, 18, [[20, 0], [22, 10], [16, 32], [4, 40]], '#d7e8ec', { cap: '#c0d6dc', wall: 1, sink: 4 });
    // Dormant spore egg inside
    const sp = P(x + 27, y + 27, 26);
    const eb = blob(sp[0], sp[1], 10, 13);
    flat(eb, '#729864');
    rim(eb, 0.8, INK);
    dot(sp[0] - 2, sp[1] - 2, 2, '#fffdf6', 0.4);
    tag(x + 5, y + 60, 44, 'STASIS');
  });

  // 2. FEEDING HOPPER & NUTRIENT PIPE
  {
    const hx = -130, hy = 70;
    box(hx - 10, hy - 10, 0, 50, 50, 20, { left: '#969ea3', top: '#b8c1c4', marks: false, ink: 1 });
    lifeHopper(hx + 15, hy + 15, 20, 16, 26, 36, '#728892', '#598555');
    // Nutrient feed pipe into crucible
    const p0 = P(hx + 15, hy + 15, 20);
    const p1 = P(-50, 15, 40);
    const p2 = P(-35, 10, 50);
    lifePipe([p0, [p0[0] + 40, p0[1] - 10], p1, p2], 4, '#8a9ea8');
    // Feed pellets in hopper
    for (let i = 0; i < 7; i++) {
      const q = P(hx + 7 + (i % 3) * 8, hy + 7 + Math.floor(i / 3) * 8, 54);
      dot(q[0], q[1], 3, '#66a265', 0.6);
    }
  }

  // 3. CENTRAL HOMUNCULUS CRUCIBLE VAT (data-state="homeostasis")
  group('data-state="homeostasis"', () => {
    // Metal pedestal ring
    cyl(0, 0, 0, 52, 16, '#566068');
    rule([[P(-46, 0, 8), P(46, 0, 8)]], INK, 0.5);

    // Glass cylinder body (semi-transparent wash)
    const glassProf = [[46, 0], [46, 105]];
    lifeTurn(0, 0, 16, glassProf, '#d8eef3', { cap: '#b0dbe4', wall: 1.5, sink: 12, ink: 1.1 });

    // Nutrient broth level (changes opacity/tint dynamically in state)
    group('id="broth"', () => {
      cyl(0, 0, 16, 42, 75, '#82d6a5');
    });

    // Swimming Homunculus creature
    group('id="homunculus"', () => {
      const hc = P(0, 0, 56);
      // Main soft body
      const b = blob(hc[0], hc[1], 24, 20);
      flat(b, '#f3a6bb');
      rim(b, 1.2, INK);
      // Big expressive eyes
      dot(hc[0] - 7, hc[1] - 3, 3.2, INK, 0);
      dot(hc[0] + 7, hc[1] - 3, 3.2, INK, 0);
      dot(hc[0] - 8, hc[1] - 4, 1.2, '#fffdf6', 0);
      dot(hc[0] + 6, hc[1] - 4, 1.2, '#fffdf6', 0);
      // Little blush cheeks
      dot(hc[0] - 11, hc[1] + 3, 2.5, '#ef6a4c', 0);
      dot(hc[0] + 11, hc[1] + 3, 2.5, '#ef6a4c', 0);
      // Tendrils/spores floating around it
      for (const [dx, dy] of [[-18, -12], [18, -10], [-14, 14], [16, 12]]) {
        dot(hc[0] + dx, hc[1] + dy, 2.2, '#93d3b0', 0.5);
      }
    });

    // Top metal dome & seal ring
    lifeTurn(0, 0, 121, [[48, 0], [46, 10], [28, 22], [14, 30]], '#566068', { cap: '#7c8890', ink: 1.1 });
  });

  // 4. THERMAL FEVER STEAM VENT & OVERHEAT INDICATOR (data-state="fever")
  group('data-state="fever"', () => {
    // Chimney / pressure valve on dome
    lifeTurn(0, 0, 151, [[8, 0], [8, 18], [12, 22]], '#8a4b42', { cap: '#d8554f' });
    // Thermal warning wisps / steam
    const vt = P(0, 0, 175);
    for (let i = 0; i < 4; i++) {
      out.push(`<g class="fever-wisp" data-x="${n1(vt[0])}" data-y="${n1(vt[1])}"><path d="M${n1(vt[0] - 4 + i * 3)} ${n1(vt[1])}q6-12 -2-24t8-20" fill="none" stroke="#d8554f" stroke-width="1.8" stroke-linecap="round"/></g>`);
    }
  });

  // 5. TRANSMUTATION CONDENSER COIL & FLASK (data-state="transmuting")
  group('data-state="transmuting"', () => {
    const cx = 140, cy = -40;
    // Wooden desk for apparatus
    box(cx - 25, cy - 25, 0, 65, 65, 42, { left: '#a6784d', top: '#c89d6d', marks: false, ink: 1 });

    // Glass condenser column
    lifeTurn(cx + 8, cy + 8, 42, [[14, 0], [14, 48], [10, 56]], '#d4eef2', { cap: '#fffdf6', wall: 1 });

    // Spiral cooling pipe connecting crucible to condenser
    const pipeStart = P(20, -10, 130);
    const pipeMid = P(80, -20, 110);
    const pipeEnd = P(cx + 8, cy + 8, 90);
    lifePipe([pipeStart, pipeMid, pipeEnd], 3.2, '#c49a45');

    // Collection flask with elixir
    lifeTurn(cx + 25, cy + 25, 42, [[10, 0], [18, 12], [8, 28]], '#fffdf6', { cap: '#f4b829', wall: 1 });
    const fl = P(cx + 25, cy + 25, 48);
    dot(fl[0], fl[1], 7, '#f4b829', 0);
  });

  // 6. CELL LYSIS SUMP & NUTRIENT BURST BASIN (data-state="lysis")
  group('data-state="lysis"', () => {
    const lx = 70, ly = 130;
    // Reinforced octagonal sump pit
    box(lx - 25, ly - 25, 0, 65, 65, 16, { left: '#4a4846', top: '#73706c', marks: false, ink: 1.2 });

    // Heavy brass drainage gate valve
    lifeTurn(lx + 8, ly + 8, 16, [[16, 0], [16, 14]], '#8c7647', { cap: '#baa368' });
    const wh = P(lx + 8, ly + 8, 30);
    dot(wh[0], wh[1], 12, '#baa368', 1.2);
    pen([[wh[0] - 10, wh[1]], [wh[0] + 10, wh[1]]], 1.2);
    pen([[wh[0], wh[1] - 8], [wh[0], wh[1] + 8]], 1.2);

    // Hazard stripes on sump rim
    for (let s = -20; s <= 20; s += 8) {
      pen([P(lx + s, ly + 25, 16), P(lx + s + 6, ly + 25, 0)], 1.2);
    }

    // Golden Nutrient Burst crystals collected in basin
    for (const [bx, by] of [[-10, -8], [6, -6], [-4, 6], [8, 8], [0, 0]]) {
      const cp = P(lx + 8 + bx, ly + 8 + by, 18);
      dot(cp[0], cp[1], 4, '#f4b829', 0.8);
    }
  });

  // 7. ISOMETRIC THERMOSTAT GAUGE (Crucible Temperature)
  {
    const gx = 0, gy = -160, gz = 30;
    box(gx - 20, gy - 15, 0, 40, 30, gz, { left: '#5a6266', top: '#808b90', marks: false, ink: 1 });
    // Round gauge dial facing sheet
    const gp = P(gx, gy, gz + 20);
    const R = 28;
    const gd = blob(gp[0], gp[1], R, R * 0.85);
    flat(gd, '#fffdf6');
    rim(gd, 1.4, INK);

    // Colored thermal arcs
    ticks(gp[0], gp[1], R - 6, -3.14, 0, 7, 5);
    out.push(`<text x="${n1(gp[0] - 18)}" y="${n1(gp[1] + 12)}" class="cap" font-size="9" fill="#2d7a55">310 mK</text>`);
    out.push(`<text x="${n1(gp[0] + 4)}" y="${n1(gp[1] + 12)}" class="cap" font-size="9" fill="#a83232">610 mK</text>`);

    // Needle element moved dynamically in tick
    out.push(`<g id="needle" transform="translate(${n1(gp[0])}, ${n1(gp[1])})"><line x1="0" y1="0" x2="0" y2="-18" stroke="${RED}" stroke-width="2" stroke-linecap="round"/><circle cx="0" cy="0" r="2.8" fill="${INK}"/></g>`);
  }

  // 8. LAB TECHNICIAN (ALCHEMIST OBSERVER)
  who(-150, 160, {
    hair: 'cap',
    cap: PAL.sky,
    shirt: PAL.sage,
    apron: '#fffdf6',
    arm: 'wave',
    look: 1,
    say: 'Crucible must stay close to 310 mK! Fever above 610 mK will damage the strain.'
  });

  // 9. MARGIN LABELS WITH LEADER LINES
  label(72, 420, 'NUTRIENT HOPPER', 'Feeds $SNACC pellets to sustain basal metabolic rate (BMR)', [-130, 70, 36], 'start');
  label(72, 720, 'GLASS CRUCIBLE', 'Regulates living culture in warm 310 mK nutrient broth', [0, 0, 70], 'start');
  label(1020, 240, 'CRUCIBLE THERMOSTAT', '310 mK homeostasis · 610 mK fever threshold', [0, -160, 45], 'end');
  label(1020, 480, 'TRANSMUTATION COIL', 'Catalyzes spores into high-potency elixirs', [148, -32, 56], 'end');
  label(1020, 860, 'NUTRIENT BURST SUMP', 'Disburses 2,000–3,000 bps liquidation bounty', [78, 138, 20], 'end');

  // Footnote
  out.push(`<text x="72" y="1360" class="it" font-size="15" fill="#6a5d4e">SNACC Protocol v0.1 · Kamus Angka: 310 mK homeostasis, 610 mK fever line, 2000–3000 bps burst bounty · Hand-drawn statechart</text>`);

  finish();
}

function init(ctx) {
  let at = ST.dormant;
  let temp = 280; // mK
  let fed = false;
  let vitality = 50;

  const needle = document.getElementById('needle');
  const broth = document.getElementById('broth')?.querySelector('path') || document.getElementById('broth');
  const homunculus = document.getElementById('homunculus');
  const feverWisps = [...document.querySelectorAll('.fever-wisp')];

  // Map state to DOM highlighting
  const updateVisuals = () => {
    document.querySelectorAll('[data-state]').forEach(el => {
      const st = el.getAttribute('data-state');
      el.classList.toggle('lit', st === at);
    });

    // Update broth color according to strain health & temp
    if (broth) {
      if (at === ST.fever) broth.setAttribute('fill', '#e07663');
      else if (at === ST.transmuting) broth.setAttribute('fill', '#e2be6c');
      else if (at === ST.lysis) broth.setAttribute('fill', '#9a948e');
      else if (at === ST.homeostasis) broth.setAttribute('fill', '#82d6a5');
      else broth.setAttribute('fill', '#b5d4c3');
    }
  };

  ctx.say('Homunculus spore is dormant. Press Feed $SNACC to awaken culture into homeostasis.');

  // Button 1: Feed $SNACC
  ctx.button('feed $SNACC', () => {
    if (at === ST.lysis) {
      return ctx.say('Refused: Specimen has lysed; no living cells remain to metabolise nutrients.');
    }
    if (at === ST.fever) {
      return ctx.say('Refused: Feeding an overheated crucible risks rupture; vent the thermal core first.');
    }
    fed = true;
    vitality = 100;
    temp = 310;
    at = ST.homeostasis;
    updateVisuals();
    ctx.say('Fed $SNACC: Satiety topped up. Culture thriving in 310 mK homeostasis.');
  });

  // Button 2: Catalyze Spores
  ctx.button('catalyze spores', () => {
    if (at === ST.lysis) {
      return ctx.say('Refused: Chamber contains only lysed sediment.');
    }
    if (at === ST.dormant) {
      return ctx.say('Refused: Specimen is dormant in stasis; awaken with $SNACC feeding first.');
    }
    if (!fed) {
      return ctx.say('Refused: Insufficient nutrients in hopper; feed $SNACC before catalyzing.');
    }
    if (temp >= 610) {
      return ctx.say('Refused: Thermal overload guard! Crucible is at fever threshold (>610 mK). Vent first.');
    }

    at = ST.transmuting;
    fed = false; // consume nutrient batch
    temp += 170; // heat up!
    updateVisuals();

    if (temp >= 610) {
      at = ST.fever;
      updateVisuals();
      ctx.say('Catalytic burn completed, but crucible exceeded 610 mK! Strain entered Thermal Fever.');
    } else {
      ctx.say(`Transmutation active: Spores condensing into elixirs. Crucible warming to ${temp} mK.`);
      setTimeout(() => {
        if (at === ST.transmuting) {
          at = ST.homeostasis;
          updateVisuals();
          ctx.say('Condensation finished. Yield collected; crucible stabilized.');
        }
      }, 2500);
    }
  });

  // Button 3: Vent Crucible
  ctx.button('vent crucible', () => {
    if (at === ST.lysis) {
      return ctx.say('Refused: Reactor drainage seals are locked during liquidation.');
    }
    if (temp <= 310) {
      return ctx.say('Refused: Crucible is already stabilized at optimal 310 mK homeostasis.');
    }
    temp = 310;
    at = ST.homeostasis;
    vitality = 85;
    updateVisuals();
    ctx.say('Cryogenic vent opened: Heat purged. Crucible restored to 310 mK homeostasis.');
  });

  // Button 4: Trigger Lysis
  ctx.button('trigger lysis', () => {
    if (at === ST.lysis) {
      return ctx.say('Refused: Cell lysis already completed; nutrient burst vault emptied.');
    }
    if (at === ST.homeostasis && vitality > 60) {
      return ctx.say('Refused: Homunculus is in peak vitality (>60%). Lysis protocol barred on healthy culture.');
    }
    at = ST.lysis;
    temp = 273;
    updateVisuals();
    ctx.say('Cell Lysis executed: Homunculus ruptured! 2,450 bps Nutrient Burst disbursed to scavenger vault.');
  });

  updateVisuals();

  return {
    tick(t, dt) {
      // Bobbing homunculus in broth
      if (homunculus && at !== ST.lysis) {
        const bob = Math.sin(t * 3) * 5;
        homunculus.setAttribute('transform', `translate(0, ${bob.toFixed(1)})`);
      }

      // Needle rotation according to temperature
      if (needle) {
        // 280 mK -> -45deg, 310 mK -> -10deg, 480 mK -> 35deg, 650 mK -> 75deg
        const ang = ((temp - 280) / (650 - 280)) * 110 - 45;
        needle.setAttribute('transform', `rotate(${ang.toFixed(1)})`);
      }

      // Rising steam wisps during fever
      if (at === ST.fever) {
        feverWisps.forEach((w, i) => {
          rising(w, (t * 0.4 + i / 4) % 1, 15, -45, 0.4, 1.4);
        });
      }
    }
  };
}
