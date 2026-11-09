/** Isometric SVG colony plate (anatomy kit). Static geometry is precomputed;
 * the client component only writes the needle transform on a ref — no
 * per-frame re-renders. Needle motion: the kit's `follow` loop. */
import React, { useMemo, useRef } from "react";
import type { MacroZone } from "../config/zones.ts";
import { Dots, FaceText, IsoFigure, Line, Solid } from "./iso/draw.tsx";
import { iso, topMatrix } from "./iso/iso-kit.ts";
import { cellGeometry } from "./iso/cellGeom.ts";
import { needleRatio, placeCells, statusLook, tempLabel, type PlateCellInput } from "./iso/layout.ts";
import { plateGeometry, plateProjection, VIEW_H, VIEW_W, zoneLabel } from "./iso/plateGeom.ts";
import { follow, useLoop, useStillness } from "./iso/live.tsx";

interface ColonyPlateProps {
  cells: PlateCellInput[];
  zone: MacroZone;
  selectedId: number | null;
  onCellSelect: (cellId: number, cx: number, cy: number) => void;
  crucibleTempMk: number | null;
}

export { type PlateCellInput };

export const ColonyPlate: React.FC<ColonyPlateProps> = ({
  cells,
  zone,
  selectedId,
  onCellSelect,
  crucibleTempMk,
}) => {
  const P = useMemo(() => plateProjection(), []);
  const geo = useMemo(() => plateGeometry(zone, P), [zone, P]);
  const placed = useMemo(() => placeCells(cells, P), [cells, P]);
  const stillness = useStillness();

  const ratio = needleRatio(crucibleTempMk);
  const targetDeg = -105 + 210 * (ratio ?? 0);
  const needleRef = useRef<SVGGElement | null>(null);
  const degRef = useRef(targetDeg);
  const targetRef = useRef(targetDeg);
  targetRef.current = targetDeg;
  useLoop(
    (dt, calm) => {
      const next = follow(degRef.current, targetRef.current, dt, 0.35, calm);
      degRef.current = next;
      needleRef.current?.setAttribute(
        "transform",
        `rotate(${next.toFixed(2)} ${geo.needleHub[0]} ${geo.needleHub[1]})`,
      );
      return true;
    },
    true,
  );

  const paintOrder = useMemo(() => [...placed].sort((a, b) => a.depth - b.depth), [placed]);

  return (
    <div className="plate-wrap iso" role="region" aria-label="colony plate">
      <IsoFigure
        width={VIEW_W}
        height={VIEW_H}
        label={`colony plate, zone ${zone}, ${cells.length} strains`}
        className="colony-figure"
      >
        <Solid paths={geo.base} tone="lo" halo key="base" />
        {geo.feet.map((feetPaths, i) => (
          <Solid paths={feetPaths} tone="lo" key={`foot-${i}`} />
        ))}
        <Line d={geo.groove} tone="faint" key="groove" />
        {geo.screws.rings.map((d, i) => (
          <Line d={d} tone="mid" key={`screw-ring-${i}`} />
        ))}
        {geo.screws.slots.map((d, i) => (
          <Line d={d} tone="faint" key={`screw-slot-${i}`} />
        ))}
        <Dots points={geo.screws.dots} size={0.45} tone="mid" key="screw-dots" />

        <Solid paths={geo.dish} tone="mid" key="dish" />
        <Line d={geo.rimSeam} tone="lo" key="rim-seam" />
        <Line d={geo.rimRing} tone="mid" key="rim-ring" />
        <Line d={geo.guideRing} tone="faint" key="guide-ring" />
        <Line d={geo.dishTicks.minor} tone="lo" key="dish-ticks-minor" />
        <Line d={geo.dishTicks.major} tone="mid" key="dish-ticks-major" />
        <Line d={geo.dishGlint} tone="faint" key="dish-glint" />
        <Dots points={geo.condensation} size={0.4} tone="faint" key="condensation" />

        {paintOrder.map((cell) => {
          const g = cellGeometry(cell, P);
          const look = statusLook(cell.status, cell.id === selectedId);
          const center = iso([cell.x, cell.y, cell.z + 1.4], P);
          const spark = iso([cell.x, cell.y, cell.z + 6.2], P);
          const motionClass =
            look.motion === "breathe" ? "cell--breathe" : look.motion === "shiver" ? "cell--shiver" : "";
          return (
            <g
              key={cell.id}
              className={`cell ${look.className} ${motionClass}`}
              data-testid={`plate-cell-${cell.id}`}
              opacity={look.opacity}
              tabIndex={0}
              role="button"
              aria-label={`strain ${cell.id}, ${cell.status}`}
              onClick={(event) => onCellSelect(cell.id, event.clientX, event.clientY)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
                  onCellSelect(cell.id, rect.left + rect.width / 2, rect.top + rect.height / 2);
                }
              }}
            >
              <circle
                className="cell-hit"
                cx={center[0]}
                cy={center[1]}
                r={Math.max(cell.radius * 1.9, 26)}
              />
              <Solid paths={g.wall} tone={look.tone} className="cell-wall" halo />
              <Line d={g.membrane} tone="mid" />
              <Line d={g.innerMembrane} tone="faint" />
              <Line d={g.wallGlint} tone="faint" />
              {g.mitochondria.map((mitoPaths, i) => (
                <Solid
                  paths={mitoPaths}
                  tone="mid"
                  lit={cell.producing}
                  className={`mito ${cell.producing ? "mito--lit" : ""}`}
                  key={`mito-${i}`}
                />
              ))}
              {g.cristae.map((d, i) => (
                <Line d={d} tone="faint" key={`crista-${i}`} />
              ))}
              <Solid paths={g.nucleus} tone="mid" className="cell-nucleus" />
              <Dots points={g.nucleolus} size={1.1} tone="hi" />
              <Dots points={g.ribosomes} size={0.5} tone="mid" pulse />
              {g.budScars.map((d, i) => (
                <Line d={d} tone="mid" key={`bud-${i}`} />
              ))}
              {look.cracked ? <Line d={g.cracks} tone="red" className="cell-crack" /> : null}
              {look.selectedRing ? (
                <Line d={g.selectRing} tone="lit" className="cell-ring" />
              ) : null}
              <FaceText transform={topMatrix([cell.x - cell.radius * 0.7, cell.y], cell.z + 2.4, P)} size={2.2} tone="mid">
                #{cell.id}
              </FaceText>
              {cell.producing && !stillness ? (
                <circle className="atp-spark" cx={spark[0]} cy={spark[1]} r={2.2} />
              ) : null}
            </g>
          );
        })}

        <Solid paths={geo.lid} tone="mid" key="lid" />
        <Line d={geo.lidKnurl} tone="lo" key="lid-knurl" />
        <Solid paths={geo.lidKnob} tone="lo" key="lid-knob" />

        <Solid paths={geo.label} tone="mid" key="label" />
        {geo.labelRules.map((d, i) => (
          <Line d={d} tone="faint" key={`label-rule-${i}`} />
        ))}
        <FaceText transform={geo.labelMatrix} size={2.4} tone={stillness ? "mid" : "mid"}>
          {zoneLabel(zone)}
        </FaceText>
        <FaceText transform={geo.labelMatrix2} size={2.4} tone="mid">
          {`TEMP ${tempLabel(crucibleTempMk)}`}
        </FaceText>

        <Solid paths={geo.ruler} tone="lo" key="ruler" />
        <Line d={geo.rulerEdge} tone="mid" key="ruler-edge" />
        <Line d={geo.rulerTicks.minor} tone="lo" key="ruler-ticks-minor" />
        <Line d={geo.rulerTicks.major} tone="mid" key="ruler-ticks-major" />

        <Solid paths={geo.thermoPost} tone="lo" key="thermo-post" />
        <Solid paths={geo.thermoDial} tone="mid" key="thermo-dial" />
        <Line d={geo.thermoBezel} tone="hi" key="thermo-bezel" />
        <Line d={geo.thermoTicks.minor} tone="lo" key="thermo-ticks-minor" />
        <Line d={geo.thermoTicks.major} tone="mid" key="thermo-ticks-major" />
        <g ref={needleRef} key="needle">
          <path className="thermo-needle" d={geo.needlePath} />
        </g>
        <Dots points={[geo.needleHub]} size={1.2} tone="hi" key="needle-hub" />
      </IsoFigure>
      <span className="sr-only" aria-live="polite">
        {`${cells.length} strains on plate, zone ${zone}, crucible temperature ${tempLabel(crucibleTempMk)}`}
      </span>
    </div>
  );
};
