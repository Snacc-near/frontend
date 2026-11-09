/* SNACC Homunculus Bioreactor · Interactive Hand-Drawn 3D Statechart Sheet */
/* Designed in the April Zhu Tinycharts / Copic wash isometric aesthetic */

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
  OY = 500;

  // 1. Title Block (April Zhu Copic style)
  title('a flow machine · statechart', 'Homunculus Bioreactor');
  out.push(`<text x="72" y="196" class="it" font-size="20" fill="${INK}" letter-spacing=".6">Crucible homeostasis, catalytic spore transmutation, and nutrient burst lysis</text>`);

  // 2. Thick 3D Laboratory Slab (Stepped Strata with Bevelled Edge)
  const slabW = 480, slabD = 480, slabH = 34;
  board(-240, -240, slabW, slabD, slabH, '#f2ece0', '#cebfa5', 28);

  // Rock/masonry horizontal strata joint lines on vertical board rim
  for (const k of [8, 17, 26]) {
    rule([
      [P(-240, 240, -k), P(240, 240, -k)],
      [P(240, 240, -k), P(240, -240, -k)]
    ], '#968872', 0.45);
  }

  // Laboratory floor tiled surface seams
  const tiles = [];
  for (let k = -200; k <= 200; k += 40) {
    tiles.push([P(k, -200, 0), P(k, 200, 0)]);
    tiles.push([P(-200, k, 0), P(200, k, 0)]);
  }
  rule(tiles, '#c2b59d', 0.4);

  // 3. Cast 3D Shadows
  cast(-155, 45, 62, 62, 45);        // Hopper tower
  castDisc(0, 0, 58, 130);           // Central crucible vat
  cast(115, -65, 75, 75, 52);        // Transmutation desk & condenser
  cast(-155, -155, 66, 66, 38);      // Stasis egg chamber
  cast(55, 135, 76, 76, 26);         // Sump liquidation basin
  cast(-20, -170, 48, 36, 40);       // Thermostat gauge mount
  layShades();

  // -------------------------------------------------------------
  // 4. DORMANT STASIS POD (data-state="dormant")
  // -------------------------------------------------------------
  group('data-state="dormant"', () => {
    const px = -140, py = -140;
    // Stepped plinth
    box(px, py, 0, 56, 56, 16, { left: '#96a5aa', top: '#c8d4d8', marks: false, ink: 1 });
    // Glass bell jar
    lifeTurn(px + 28, py + 28, 16, [
      [22, 0], [22, 12], [18, 30], [8, 42], [2, 46]
    ], '#d6eaee', { cap: '#bad5dc', wall: 1.2, sink: 6, ink: 1 });

    // Dormant Homunculus Spore Egg inside jar
    const ep = P(px + 28, py + 28, 26);
    const egg = blob(ep[0], ep[1], 12, 15);
    flat(egg, '#759968');
    rim(egg, 1, INK);
    dot(ep[0] - 2, ep[1] - 3, 2.5, '#ffffff', 0);
    // Pulsing spore dots around egg
    for (const [dx, dy] of [[-6, 4], [6, 2], [0, 8]]) {
      dot(ep[0] + dx, ep[1] + dy, 1.4, '#a8cca0', 0);
    }

    tag(px + 4, py + 62, 48, 'STASIS POD');
  });

  // -------------------------------------------------------------
  // 5. FEEDING HOPPER & $SNACC SLURRY APPARATUS (Left Station)
  // -------------------------------------------------------------
  {
    const hx = -135, hy = 65;
    // Four structural support legs
    for (const [lx, ly] of [[0, 0], [42, 0], [0, 42], [42, 42]]) {
      box(hx + lx, hy + ly, 0, 5, 5, 24, { left: '#647076', marks: false, ink: 0.8 });
    }
    // Hopper base plate
    box(hx - 4, hy - 4, 24, 55, 55, 6, { left: '#78848a', top: '#9eabb0', marks: false, ink: 1 });

    // Conical sheet-metal hopper loaded with $SNACC nutrient pellets
    lifeHopper(hx + 24, hy + 24, 30, 16, 26, 38, '#70868f', '#649e62');

    // Pellet dots inside hopper mouth
    for (let i = 0; i < 9; i++) {
      const q = P(hx + 12 + (i % 3) * 8 + (rnd() - 0.5) * 4, hy + 12 + Math.floor(i / 3) * 8, 68);
      dot(q[0], q[1], 2.8, '#528f50', 0.6);
    }

    // Overhead articulated copper/glass feed pipeline into crucible vat
    const p0 = P(hx + 24, hy + 24, 28);
    const p1 = [p0[0] + 36, p0[1] - 8];
    const p2 = P(-44, 18, 48);
    const p3 = P(-34, 12, 60);
    lifePipe([p0, p1, p2, p3], 4.2, '#b37d47');
    // Glass viewing sight-glass section on pipe
    dot(p1[0], p1[1], 4.5, '#76c48a', 0.8);
  }

  // -------------------------------------------------------------
  // 6. CENTRAL CRUCIBLE & 3D HOMUNCULUS VAT (data-state="homeostasis")
  // -------------------------------------------------------------
  group('data-state="homeostasis"', () => {
    // Heavy flanged metal pedestal
    cyl(0, 0, 0, 56, 18, '#444d54', { ink: 1.2, cap: '#66727a' });
    // Brass bolts along pedestal collar
    for (let a = 0; a < 6.28; a += 0.8) {
      const bp = P(48 * Math.cos(a), 48 * Math.sin(a), 12);
      dot(bp[0], bp[1], 1.8, '#c99a4e', 0.4);
    }

    // Glass cylinder body (semi-transparent wash with refraction sheen)
    const vatH = 110, vatR = 48;
    lifeTurn(0, 0, 18, [
      [vatR, 0], [vatR, vatH]
    ], '#d9f0f5', { cap: '#a9dbe6', wall: 1.8, sink: 12, ink: 1.2 });

    // Glass highlight reflections (curved vertical lines)
    pen(lifeArc(0, 0, 30, vatR - 2, 210, 270), 0.9);
    pen(lifeArc(0, 0, 80, vatR - 2, 210, 270), 0.9);

    // Glowing nutrient broth liquid level inside vat
    group('id="broth"', () => {
      cyl(0, 0, 18, vatR - 4, 82, '#80dca6', { ink: 0.8 });
    });

    // Carbonation & nutrient bubbles inside liquid
    for (let i = 0; i < 8; i++) {
      const bAng = rnd() * 6.28, bRad = 10 + rnd() * 26;
      const bPt = P(bRad * Math.cos(bAng), bRad * Math.sin(bAng), 28 + rnd() * 60);
      out.push(`<circle cx="${n1(bPt[0])}" cy="${n1(bPt[1])}" r="${n1(1.2 + rnd() * 2)}" fill="#ffffff" opacity=".6" stroke="${INK}" stroke-width=".3"/>`);
    }

    // 3D Homunculus Living Organism (floating in broth)
    group('id="homunculus"', () => {
      const hc = P(0, 0, 62);

      // Translucent cellular outer membrane halo
      const halo = blob(hc[0], hc[1], 30, 25);
      flat(halo, '#f8b4c4');
      rim(halo, 0.7, '#d66882');

      // Main biological body nucleus
      const body = blob(hc[0], hc[1], 24, 20);
      flat(body, '#ef88a2');
      rim(body, 1.3, INK);

      // Cute big alchemical eyes
      dot(hc[0] - 8, hc[1] - 4, 3.5, INK, 0);
      dot(hc[0] + 8, hc[1] - 4, 3.5, INK, 0);
      // Eye reflection catchlights
      dot(hc[0] - 9.2, hc[1] - 5.5, 1.4, '#ffffff', 0);
      dot(hc[0] + 6.8, hc[1] - 5.5, 1.4, '#ffffff', 0);

      // Rosy blushing cheeks
      dot(hc[0] - 13, hc[1] + 3, 3, '#e55048', 0);
      dot(hc[0] + 13, hc[1] + 3, 3, '#e55048', 0);

      // Little mouth
      pen([[hc[0] - 3, hc[1] + 3], [hc[0], hc[1] + 5], [hc[0] + 3, hc[1] + 3]], 1.1);

      // Spores and mitochondria organelle tendrils waving around body
      for (const [dx, dy] of [[-20, -14], [20, -12], [-18, 16], [18, 14], [0, -22]]) {
        dot(hc[0] + dx, hc[1] + dy, 2.5, '#78ce9e', 0.5);
      }
    });

    // Domed metal crucible lid with flanged seal & pressure collar
    lifeTurn(0, 0, 18 + vatH, [
      [50, 0], [48, 10], [32, 22], [16, 32], [14, 36]
    ], '#505a62', { cap: '#7c8890', ink: 1.2 });
  });

  // -------------------------------------------------------------
  // 7. THERMAL FEVER STEAM VENT (>610 mK) (data-state="fever")
  // -------------------------------------------------------------
  group('data-state="fever"', () => {
    // High-temperature relief chimney on crucible dome
    lifeTurn(0, 0, 164, [
      [8, 0], [8, 16], [13, 20]
    ], '#8a4038', { cap: '#d8554f', ink: 1 });

    // Animated thermal wisps and steam venting
    const vp = P(0, 0, 186);
    for (let i = 0; i < 4; i++) {
      out.push(`<g class="fever-wisp" data-x="${n1(vp[0])}" data-y="${n1(vp[1])}"><path d="M${n1(vp[0] - 5 + i * 3.5)} ${n1(vp[1])}q6-14 -3-26t7-24" fill="none" stroke="#d8554f" stroke-width="2" stroke-linecap="round"/></g>`);
    }
  });

  // -------------------------------------------------------------
  // 8. CATALYTIC TRANSMUTATION CONDENSER (Right Station) (data-state="transmuting")
  // -------------------------------------------------------------
  group('data-state="transmuting"', () => {
    const cx = 135, cy = -45;
    // Wooden alchemical laboratory bench
    box(cx - 28, cy - 28, 0, 72, 72, 44, { left: '#a47244', top: '#c49562', marks: false, ink: 1.1 });
    // Wood grain detail
    rule([
      [P(cx - 24, cy - 10, 44), P(cx + 38, cy - 10, 44)],
      [P(cx - 24, cy + 14, 44), P(cx + 38, cy + 14, 44)]
    ], '#885830', 0.5);

    // Vertical glass condenser jacket column
    lifeTurn(cx + 10, cy + 10, 44, [
      [15, 0], [15, 52], [11, 60]
    ], '#d6eff3', { cap: '#fffdf6', wall: 1.2, ink: 1 });

    // Spiral cooling coil connecting crucible to condenser
    const pipe0 = P(18, -12, 138);
    const pipe1 = P(75, -24, 118);
    const pipe2 = P(cx + 10, cy + 10, 96);
    lifePipe([pipe0, pipe1, pipe2], 3.4, '#c99842');

    // Alchemical distillate beaker collecting golden Elixir
    lifeTurn(cx + 26, cy + 26, 44, [
      [10, 0], [18, 14], [8, 30]
    ], '#ffffff', { cap: '#f4b829', wall: 1.2 });

    const fl = P(cx + 26, cy + 26, 52);
    dot(fl[0], fl[1], 7.5, '#f4b829', 0.8);
  });

  // -------------------------------------------------------------
  // 9. CELL LYSIS SUMP & NUTRIENT BURST VAULT (Foreground) (data-state="lysis")
  // -------------------------------------------------------------
  group('data-state="lysis"', () => {
    const lx = 75, ly = 135;
    // Sunken octagonal drainage pit with heavy concrete rim
    box(lx - 26, ly - 26, 0, 72, 72, 18, { left: '#403f3e', top: '#6a6865', marks: false, ink: 1.3 });

    // Yellow & black hazard stripes around the sump rim
    for (let s = -22; s <= 22; s += 8) {
      pen([P(lx + s, ly + 26, 18), P(lx + s + 6, ly + 26, 0)], 1.4);
    }

    // Heavy brass spillway gate-valve wheel
    lifeTurn(lx + 10, ly + 10, 18, [
      [16, 0], [16, 14]
    ], '#88703e', { cap: '#baa368', ink: 1 });
    const wh = P(lx + 10, ly + 10, 32);
    dot(wh[0], wh[1], 12.5, '#baa368', 1.3);
    pen([[wh[0] - 11, wh[1]], [wh[0] + 11, wh[1]]], 1.3);
    pen([[wh[0], wh[1] - 9], [wh[0], wh[1] + 9]], 1.3);

    // Glistening golden Nutrient Burst crystal shards (2,000–3,000 bps)
    for (const [bx, by] of [[-10, -8], [7, -6], [-4, 7], [9, 9], [0, 1]]) {
      const cp = P(lx + 10 + bx, ly + 10 + by, 20);
      dot(cp[0], cp[1], 4.2, '#f4b829', 0.8);
      // Small glint dot
      dot(cp[0] - 1, cp[1] - 1, 1.2, '#ffffff', 0);
    }
  });

  // -------------------------------------------------------------
  // 10. CRUCIBLE THERMOSTAT GAUGE (Back-Center)
  // -------------------------------------------------------------
  {
    const gx = -2, gy = -165, gz = 32;
    // Heavy brass pedestal & casing
    box(gx - 22, gy - 16, 0, 44, 32, gz, { left: '#545d62', top: '#768288', marks: false, ink: 1.1 });

    // Round gauge dial face facing the viewer
    const gp = P(gx, gy, gz + 22);
    const R = 32;
    const gd = blob(gp[0], gp[1], R, R * 0.88);
    flat(gd, '#fffdf6');
    rim(gd, 1.5, INK);

    // Colored thermal zone indicator arcs
    ticks(gp[0], gp[1], R - 6, -3.14, 0, 8, 6);
    out.push(`<text x="${n1(gp[0] - 22)}" y="${n1(gp[1] + 14)}" class="cap" font-size="9.5" fill="#2d7a55">310 mK</text>`);
    out.push(`<text x="${n1(gp[0] + 5)}" y="${n1(gp[1] + 14)}" class="cap" font-size="9.5" fill="#ab2e2e">610 mK</text>`);

    // Needle element rotated in tick()
    out.push(`<g id="needle" transform="translate(${n1(gp[0])}, ${n1(gp[1])})"><line x1="0" y1="0" x2="0" y2="-20" stroke="${RED}" stroke-width="2.2" stroke-linecap="round"/><circle cx="0" cy="0" r="3.2" fill="${INK}"/></g>`);
  }

  // -------------------------------------------------------------
  // 11. CHARACTERS (April Zhu Pear Figure Doll)
  // -------------------------------------------------------------
  // Arya: Chief Bio-Engineer
  who(-155, 160, {
    hair: 'bun',
    hairCol: '#3a2e28',
    shirt: PAL.sky,
    apron: '#fffdf6',
    arm: 'wave',
    look: 1,
    say: 'Crucible must stay close to 310 mK! Fever above 610 mK will trigger thermal stress!'
  });

  // Assistant Technician by the hopper
  who(-175, 40, {
    size: 0.8,
    hair: 'cap',
    cap: PAL.gold,
    shirt: PAL.sage,
    arm: 'front',
    look: 1,
    say: '$SNACC pellets loaded in the hopper, ready for feeding.'
  });

  // -------------------------------------------------------------
  // 12. MARGIN CALLOUT LABELS WITH LEADER LINES
  // -------------------------------------------------------------
  label(72, 400, 'FEEDING HOPPER', 'Feeds $SNACC pellets to sustain basal metabolic rate (BMR)', [-135, 65, 42], 'start');
  label(72, 700, 'GLASS CRUCIBLE', 'Houses living homunculus in 310 mK regulated broth', [0, 0, 72], 'start');
  label(1020, 220, 'CRUCIBLE THERMOSTAT', '310 mK homeostasis · 610 mK fever line', [-2, -165, 50], 'end');
  label(1020, 460, 'TRANSMUTATION COIL', 'Catalyzes spores into rare alchemical elixirs', [145, -35, 62], 'end');
  label(1020, 840, 'NUTRIENT BURST SUMP', 'Liquidates cell into 2,000–3,000 bps bounty', [85, 145, 24], 'end');

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
      else if (at === ST.homeostasis) broth.setAttribute('fill', '#80dca6');
      else broth.setAttribute('fill', '#b5d4c3');
    }
  };

  ctx.say('Homunculus spore is dormant. Press Feed $SNACC to awaken culture into homeostasis.');

  // Button 1: Feed $SNACC
  ctx.button('feed $SNACC', () => {
    if (at === ST.lysis) {
      return ctx.say('Refused: Specimen has lysed; no living cells remain to metabolize nutrients.');
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
          ctx.say('Condensation finished. Output collected; crucible stabilized.');
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
