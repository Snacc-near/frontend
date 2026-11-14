/**
 * Demo-mode text (UI-161 phase B3): the log lines and refusals of the local simulation in
 * `game/simulation.ts`, the thesis receipt line in `plate/iso/layout.ts` and the seed log of the game
 * screen. Only words change between languages; every number the simulation computes stays the same.
 */
const demo = {
  seed: "demo · simulated: colony seeded at 600..610 mk balance band",
  started: "started {kind} production: +{amount} on collect",
  needSpores: "need {need} spores, have {have}",
  needEnzymes: "need {need} enzymes, have {have}",
  collected: "collected +{amount} {kind}",
  unknownItem: "unknown item",
  notReady: "not ready yet",
  needSnacc: "need 10 snacc",
  fed: "fed strain: +12 atp, +220 vitality (demo · simulated)",
  maxLevel: "{key} already at max level {max}",
  needAtp: "need {cost} atp, have {have}",
  upgraded: "{key} upgraded to {level}: {note}",
  noteMito: "+10% atp output",
  noteNucleus: "+10% output per level",
  noteLysosome: "-10% hunger per level",
  divideGate: "divide gate: births must stay within merges + lyses",
  needDivide: "need 30 atp to divide",
  mitosis: "mitosis: cell split into two (demo · simulated)",
  lysis: "lysis harvest: released {n} nutrients (base burst 2.00%)",
  needSplice: "need 20 atp to splice",
  splice: "splice: two strains merged (demo · simulated)",
  vacuole: "vacuole pulse played (demo · simulated)",
  attest: "attest: tee verification preview · no numbers changed",
  kinds: { atp: "atp", spores: "spores", enzymes: "enzymes", elixir: "elixir" },
  receipt: "in {inflow} = out {outflow} + stored {stored} ✓",
  seedLogs: {
    actor: "strain #3",
    burst: "cell lysis released 7200 nutrients · discount -20.00% until epoch 2",
    zone: "alkemis.testnet triggered a zone shift from hypothermia to goldilocks (605 mK)",
  },
};

export default demo;
