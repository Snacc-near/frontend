/** Isometric SVG colony plate (anatomy kit, plain + marigold). Static geometry is
 * precomputed; the client component only writes the needle transform on a ref —
 * no per-frame re-renders. Needle motion: the kit's `follow` loop. */
import React, { useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { MacroZone } from "../config/zones.ts";
import { Dots, FaceText, IsoFigure, Line, Solid } from "./iso/draw.tsx";
import { cellGeometry, DOME_CUT, DOME_H, tagGeometry } from "./iso/cellGeom.ts";
import { DISH_Z, needleRatio, placeCells, statusLook, tempLabel, type PlateCellInput } from "./iso/layout.ts";
import { magnifierGeometry, plateGeometry, plateProjection, VIEWS, zoneLabel, type PlateView } from "./iso/plateGeom.ts";
import { follow, useLoop, useStillness } from "./iso/live.tsx";

interface ColonyPlateProps {
  cells: PlateCellInput[];
  zone: MacroZone;
  selectedId: number | null;
  onCellSelect: (cellId: number, cx: number, cy: number) => void;
  crucibleTempMk: number | null;
}

export { type PlateCellInput };

const PHONE = "(max-width: 639px)";
function usePlateView(): PlateView {
  return useSyncExternalStore(
    (changed) => {
      const query = window.matchMedia(PHONE);
      query.addEventListener("change", changed);
      return () => query.removeEventListener("change", changed);
    },
    () => (window.matchMedia(PHONE).matches ? "tall" : "wide"),
    () => "wide",
  );
}

export const ColonyPlate: React.FC<ColonyPlateProps> = ({ cells, zone, selectedId: pickedId, onCellSelect, crucibleTempMk }) => {
  const view = usePlateView();
  // the magnifier, ring and id tag follow the picked cell, or the one under the pointer / focus
  const [hoverId, setHoverId] = useState<number | null>(null);
  const selectedId = pickedId ?? hoverId;
  const P = useMemo(() => plateProjection(view), [view]);
  const ratio = needleRatio(crucibleTempMk);
  const ratioStep = ratio === null ? null : Math.round(ratio * 50) / 50;
  const geo = useMemo(() => plateGeometry(zone, P, ratioStep), [zone, P, ratioStep]);
  const placed = useMemo(() => placeCells(cells, P), [cells, P]);
  const stillness = useStillness();
  const minHit = view === "tall" ? 24 : 20;
  const cellGeos = useMemo(
    () => new Map(placed.map((c) => [c.id, cellGeometry(c, P, minHit)])),
    [placed, P, minHit],
  );
  const selected = placed.find((c) => c.id === selectedId) ?? null;
  const tag = useMemo(() => (selected ? tagGeometry(selected, P) : null), [selected, P]);
  const arm = useMemo(
    () =>
      magnifierGeometry(
        selected
          ? { x: selected.x, y: selected.y, z: DISH_Z + selected.radius * DOME_H * DOME_CUT + 7, rho: selected.radius * 1.15 + 1.5 }
          : null,
        P,
      ),
    [selected, P],
  );

  const targetDeg = -105 + 210 * (ratio ?? 0);
  const needleRef = useRef<SVGGElement | null>(null);
  const degRef = useRef(targetDeg);
  const targetRef = useRef(targetDeg);
  targetRef.current = targetDeg;
  useLoop(
    (dt, calm) => {
      const next = follow(degRef.current, targetRef.current, dt, 0.35, calm);
      degRef.current = next;
      needleRef.current?.setAttribute("transform", `rotate(${next.toFixed(2)})`);
      return true;
    },
    true,
  );

  const paintOrder = useMemo(() => [...placed].sort((a, b) => a.depth - b.depth), [placed]);
  const { w, h } = VIEWS[view];
  const shift = `translate(${geo.shadowShift[0].toFixed(1)} ${geo.shadowShift[1].toFixed(1)})`;

  return (
    <div className={`plate-wrap iso plate-wrap--${view} zone-${zone}`} role="region" aria-label="colony plate">
      <IsoFigure width={w} height={h} label={`colony plate, zone ${zone}, ${cells.length} strains`} className="colony-figure">
        <defs>
          <clipPath id="plate-well">
            <path d={geo.rimWell} />
          </clipPath>
          <radialGradient id="agar-vig" cx="50%" cy="50%" r="50%">
            <stop offset="0.55" stopColor="#3a2a10" stopOpacity="0" />
            <stop offset="0.9" stopColor="#3a2a10" stopOpacity="0.16" />
            <stop offset="1" stopColor="#2a2218" stopOpacity="0.34" />
          </radialGradient>
        </defs>

        <path className="shadow-flat" d={geo.shadow} transform={shift} />
        {geo.feet.map((feet, i) => (
          <Solid paths={feet} tone="hi" className="tan" key={`foot-${i}`} />
        ))}
        <Solid paths={geo.base} tone="hi" className="tan" key="base" />
        <Line d={geo.groove} tone="lo" key="groove" />
        {geo.screws.rings.map((d, i) => (
          <Line d={d} tone="mid" key={`screw-ring-${i}`} />
        ))}
        {geo.screws.slots.map((d, i) => (
          <Line d={d} tone="lo" key={`screw-slot-${i}`} />
        ))}
        <Dots points={geo.screws.dots} size={0.5} tone="hi" key="screw-dots" />

        {/* floor-level: cables with plugs, ruler strip, label plate */}
        {geo.cables.map((cable, i) => (
          <g key={`cable-${i}`}>
            <path className="cable-ink" d={cable.d} />
            <path className={cable.tone === "mari" ? "cable-core cable-core--mari" : "cable-core"} d={cable.d} />
            {cable.plugs.map((plug, j) => (
              <Solid paths={plug} tone="hi" className="tan" key={j} />
            ))}
          </g>
        ))}
        <Solid paths={geo.jack.body} tone="hi" className="tan" key="jack" />
        <Line d={geo.jack.ring} tone="hi" key="jack-ring" />

        <Solid paths={geo.ruler} tone="hi" key="ruler" />
        <Line d={geo.rulerEdge} tone="mid" key="ruler-edge" />
        <Line d={geo.rulerTicks.minor} tone="mid" key="ruler-ticks-minor" />
        <Line d={geo.rulerTicks.major} tone="hi" key="ruler-ticks-major" />

        <Solid paths={geo.label} tone="hi" key="label" />
        <path className="label-stripe" d={geo.labelStripe} />
        {geo.labelRules.map((d, i) => (
          <Line d={d} tone="lo" key={`label-rule-${i}`} />
        ))}
        <FaceText transform={geo.labelMatrix} size={2.3} tone="hi">
          {zoneLabel(zone)}
        </FaceText>
        <FaceText transform={geo.labelMatrix2} size={2.3} tone="mid">
          {`TEMP ${tempLabel(crucibleTempMk)}`}
        </FaceText>

        {/* back instruments: controller box, thermometer, dial gauge */}
        <Solid paths={geo.tube.block} tone="hi" className="tan" key="tube-block" />
        <Solid paths={geo.tube.plate} tone="hi" key="tube-plate" />
        <Line d={geo.tube.ticks.minor} tone="mid" key="tube-ticks-minor" />
        <Line d={geo.tube.ticks.major} tone="hi" key="tube-ticks-major" />
        <Solid paths={geo.tube.bulb} tone="hi" className="mari" key="tube-bulb" />
        <Solid paths={geo.tube.liquid} tone="hi" className="mari" key="tube-liquid" />
        <path className="glass-fill" d={geo.tube.glass.fill} />
        <path className="glass-edge" d={geo.tube.glass.outline} />
        <path className="glass-edge" d={geo.tube.glass.crease} />
        <path className="glass-edge-b" d={geo.tube.glassTop} />
        <path className="glass-hi-line" d={geo.tube.shine} />
        {geo.tube.clamps.map((c, i) => (
          <Solid paths={c} tone="hi" className="tan" key={`tube-clamp-${i}`} />
        ))}

        <Solid paths={geo.beaker.liquid} tone="hi" className="mari" key="beaker-liquid" />
        <path className="glass-fill" d={geo.beaker.glass.fill} />
        <path className="glass-edge" d={geo.beaker.glass.outline} />
        <path className="glass-edge" d={geo.beaker.glass.crease} />
        <path className="glass-edge-b" d={geo.beaker.rim} />
        <path className="glass-hi-line" d={geo.beaker.ticks} />
        {geo.stack.layers.map((l, i) => (
          <Solid paths={l} tone="hi" className={i === 0 ? "tan" : "glassbody"} key={`stack-${i}`} />
        ))}
        {geo.stack.seams.map((d, i) => (
          <Line d={d} tone="lo" key={`stack-seam-${i}`} />
        ))}
        <Solid paths={geo.stack.sticker} tone="hi" className="mari" key="stack-sticker" />

        <Solid paths={geo.box} tone="hi" key="box" />
        {geo.boxVents.map((d, i) => (
          <path className="vent-slot" d={d} key={`vent-${i}`} />
        ))}
        <Solid paths={geo.boxLed} tone="hi" className="mari" key="box-led" />
        <FaceText transform={geo.boxMatrix} size={2} tone="mid">
          THERMAL
        </FaceText>

        <Solid paths={geo.dialFoot} tone="hi" className="tan" key="dial-foot" />
        <Solid paths={geo.dialPost} tone="hi" className="tan" key="dial-post" />
        <Solid paths={geo.dialBody} tone="hi" key="dial-body" />
        <Line d={geo.dialBezel} tone="hi" key="dial-bezel" />
        <Line d={geo.dialBezelInner} tone="lo" key="dial-bezel-inner" />
        {geo.dialBands.map((b, i) => (
          <path className={`dial-band dial-band--${b.tone}`} d={b.d} key={`dial-band-${i}`} />
        ))}
        <Line d={geo.dialTicks.minor} tone="mid" key="dial-ticks-minor" />
        <Line d={geo.dialTicks.major} tone="hi" key="dial-ticks-major" />
        <g transform={geo.needleMatrix} key="needle">
          <g ref={needleRef}>
            <path className="thermo-needle" d={geo.needlePath} />
          </g>
        </g>
        <Dots points={[geo.needleHub]} size={1.1} tone="hi" key="needle-hub" />

        {/* the culture dish: seat ring, clips, wall, rim, well, agar */}
        <Solid paths={geo.seat} tone="hi" className="tan" key="seat" />
        <Line d={geo.seatRim} tone="lo" key="seat-rim" />
        {geo.clips.map((c, i) => (
          <g key={`clip-${i}`}>
            <Solid paths={c.body} tone="hi" className="tan" />
            <Solid paths={c.screw} tone="hi" className="mari" />
            <Line d={c.knurl} tone="hi" />
            <Line d={c.slot} tone="hi" />
          </g>
        ))}
        <Solid paths={geo.dish} tone="hi" key="dish" />
        <Line d={geo.rimSeam} tone="lo" key="rim-seam" />
        <Line d={geo.rimRing} tone="mid" key="rim-ring" />
        <Line d={geo.rimTicks.minor} tone="lo" key="rim-ticks-minor" />
        <Line d={geo.rimTicks.major} tone="hi" key="rim-ticks-major" />
        <path className="well-wall" d={geo.rimWell} key="well-wall" />
        <g clipPath="url(#plate-well)" key="agar-group">
          <path className="agar" d={geo.agar} />
          <path className="agar-vig" d={geo.agar} fill="url(#agar-vig)" />
          <Line d={geo.guideRing} tone="faint" />
          {geo.agarRipples.map(([d, alpha], i) => (
            <path className="agar-ripple" d={d} opacity={alpha} key={i} />
          ))}
          <Dots points={geo.agarDots} size={0.5} tone="mid" />
        </g>
        <Line d={geo.rimWell} tone="hi" key="well-edge" />
        <Dots points={geo.condensation} size={0.55} tone="mid" key="condensation" />

        {paintOrder.map((cell) => {
          const g = cellGeos.get(cell.id)!;
          const look = statusLook(cell.status, cell.id === selectedId);
          const motionClass = look.motion === "breathe" ? "cell--breathe" : look.motion === "shiver" ? "cell--shiver" : "";
          const lit = cell.producing && !look.ghost && !look.cracked;
          return (
            <g
              key={cell.id}
              className={`cell ${look.className} ${motionClass}`}
              data-testid={`plate-cell-${cell.id}`}
              opacity={look.opacity}
              tabIndex={0}
              role="button"
              aria-label={`strain ${cell.id}, ${cell.status}`}
              onPointerEnter={(event) => event.pointerType === "mouse" && setHoverId(cell.id)}
              onPointerLeave={() => setHoverId((cur) => (cur === cell.id ? null : cur))}
              onFocus={() => setHoverId(cell.id)}
              onBlur={() => setHoverId((cur) => (cur === cell.id ? null : cur))}
              onClick={(event) => onCellSelect(cell.id, event.clientX, event.clientY)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
                  onCellSelect(cell.id, rect.left + rect.width / 2, rect.top + rect.height / 2);
                }
              }}
            >
              <circle className="cell-hit" cx={g.hit.center[0]} cy={g.hit.center[1]} r={g.hit.radius} />
              <path className="cell-shadow" d={g.shadow} />
              {look.selectedRing ? (
                <>
                  <path className="sel-halo" d={g.selectHalo} />
                  <path className="sel-ring" d={g.selectRing} />
                </>
              ) : null}
              {g.bud ? (
                <>
                  <Solid paths={g.bud.body} tone={look.tone} className="cw cw-bud" crease="none" />
                  <Line d={g.bud.ring} tone="faint" />
                </>
              ) : null}
              <g className="cell-body">
                <Solid paths={g.dome} tone={look.tone} className="cw" crease="none" />
                {g.budScars.map((s, i) => (
                  <g className="scar" key={`scar-${i}`}>
                    <path className="scar-lip" d={s.outer} />
                    <Line d={s.outer} tone="mid" />
                    <Line d={s.inner} tone="lo" />
                  </g>
                ))}
                {look.cracked ? <Line d={g.sideCrack} tone="red" className="cell-crack" /> : null}
                <path className="wall-band" d={g.wallBand} fillRule="evenodd" />
                <path className="cyto" d={g.rimInner} />
                <path className="cyto-sheen" d={g.sheen} />
                <Line d={g.rimOuter} tone={look.tone === "faint" ? "mid" : "hi"} className="cell-rim" />
                <Line d={g.rimInner} tone="mid" />
                {g.mitochondria.map((m, i) => (
                  <g className={lit ? "mito mito--lit" : "mito"} key={`mito-${i}`}>
                    <Solid paths={m.body} tone="hi" className={lit ? "mari" : "bean"} crease="none" />
                    {m.cristae.map(([d, alpha], j) => (
                      <path className="iso-line crista" data-tone="hi" d={d} opacity={alpha} key={j} />
                    ))}
                  </g>
                ))}
                <Solid paths={g.vacuole} tone="hi" className="vac" crease="none" />
                <circle className="vac-shine" cx={g.vacuoleShine[0]} cy={g.vacuoleShine[1]} r={0.95} />
                <Solid paths={g.nucleus} tone="hi" className="nuc" crease="none" />
                <Line d={g.nucleusEnvelope} tone="mid" />
                <Dots points={g.pores} size={0.5} tone="hi" />
                <Solid paths={g.nucleolus} tone="hi" className="nucleolus" crease="none" />
                <Dots points={g.ribosomes} size={0.5} tone="hi" />
                {look.cracked ? <Line d={g.cracks} tone="red" className="cell-crack" /> : null}
              </g>
              {look.selectedRing && tag ? (
                <g className="cell-tag">
                  <Solid paths={tag.slab} tone="hi" className="tan" />
                  <FaceText transform={tag.matrix} size={tag.size} tone="hi">
                    #{cell.id}
                  </FaceText>
                </g>
              ) : null}
              {lit && !stillness
                ? [0, 1, 2].map((i) => (
                    <circle
                      className="atp-spark"
                      cx={g.spark[0] + (i - 1) * 5}
                      cy={g.spark[1] - (i === 1 ? 3 : 0)}
                      r={i === 1 ? 2.1 : 1.6}
                      style={{ animationDelay: `${i * 0.8}s` }}
                      key={i}
                    />
                  ))
                : null}
            </g>
          );
        })}

        {/* front of the plate: pipette on cradles, glass lid, vial rack */}
        {geo.pipette.cradles.map((c, i) => (
          <Solid paths={c} tone="hi" className="tan" key={`cradle-${i}`} />
        ))}
        <Solid paths={geo.pipette.body} tone="hi" className="glassbody" crease="none" key="pipette" />
        <Line d={geo.pipette.ticks} tone="mid" key="pipette-ticks" />
        <Solid paths={geo.pipette.tip} tone="hi" className="steel" crease="none" key="pipette-tip" />
        <Solid paths={geo.pipette.bulb} tone="hi" className="mari" crease="none" key="pipette-bulb" />

        <Solid paths={geo.rack} tone="hi" className="tan" key="rack" />
        {geo.rackHoles.map((d, i) => (
          <path className="rack-hole" d={d} key={`hole-${i}`} />
        ))}
        {geo.vials.map((v, i) => (
          <g key={`vial-${i}`}>
            <Solid paths={v.liquid} tone="hi" className={v.tint === "mari" ? "mari" : v.tint === "ice" ? "ice" : "cyto-solid"} />
            <path className="glass-fill" d={v.glass.fill} />
            <path className="glass-edge" d={v.glass.outline} />
            <path className="glass-edge" d={v.glass.crease} />
            <Solid paths={v.cap} tone="hi" className={v.tint === "mari" ? "tan" : ""} />
            <Line d={v.capKnurl} tone="mid" />
          </g>
        ))}

        {geo.lid.pads.map((p, i) => (
          <Solid paths={p} tone="hi" className="tan" key={`pad-${i}`} />
        ))}
        <path className="glass-fill glass-fill--lid" d={geo.lid.body.fill} />
        <path className="glass-top" d={geo.lid.body.top} />
        <path className="glass-edge" d={geo.lid.body.outline} />
        <path className="glass-edge" d={geo.lid.body.crease} />
        <path className="glass-edge-b" d={geo.lid.edge} />
        {geo.lid.streaks.map((d, i) => (
          <path className="glass-hi-line" d={d} key={`streak-${i}`} />
        ))}
        <Solid paths={geo.lid.knob} tone="hi" className="mari" key="lid-knob" />
        <Line d={geo.lid.knobKnurl} tone="hi" key="lid-knurl" />

        {/* magnifier on an articulated arm, pointing at the selected cell */}
        <g className="magnifier" key={`arm-${selectedId ?? "park"}`}>
          <Solid paths={arm.base} tone="hi" className="tan" />
          <Solid paths={arm.post} tone="hi" />
          {arm.links.map((d, i) => (
            <g key={`link-${i}`}>
              <path className="arm-ink" d={d} />
              <path className="arm-core" d={d} />
              <path className="arm-hi" d={d} />
            </g>
          ))}
          <Solid paths={arm.shoulderBall} tone="hi" className="mari" crease="none" />
          {arm.joints.slice(1).map(([jx, jy], i) => (
            <g key={`joint-${i}`}>
              <circle className="joint-ring" cx={jx} cy={jy} r={4.2} />
              <circle className="joint-dot" cx={jx} cy={jy} r={1.5} />
            </g>
          ))}
          <path className="yoke" d={arm.yoke} />
          <path className="lens-glass" d={arm.glass} />
          <path className="lens-ink" d={arm.rim} />
          <path className="lens-rim" d={arm.rim} />
          {arm.streaks.map((d, i) => (
            <path className="glass-hi-line" d={d} key={`lens-streak-${i}`} />
          ))}
        </g>
      </IsoFigure>
      <span className="sr-only" aria-live="polite">
        {`${cells.length} strains on plate, zone ${zone}, crucible temperature ${tempLabel(crucibleTempMk)}`}
      </span>
    </div>
  );
};
