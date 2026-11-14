/**
 * First-run intro (UI-161 phase B4): the four steps and the buttons of `help/OnboardingModal.tsx`. Step
 * text is built by `introSteps()` in `help/content.ts`, which fills the `{...}` figures from the code
 * constants; no number is typed in here that a constant holds.
 */
const onboarding = {
  /** "step 1 of 4" under the dots. */
  step: "step {n} of {total}",
  skip: "skip intro",
  back: "back",
  next: "next",
  start: "start playing",

  steps: {
    what: {
      topic: "what it is",
      title: "Meet your Snacc",
      body: "A Snacc is an NFT that behaves like a small living organism. It owns a balance of $SNACC and has a vitality that drains every hour.",
      p1: "Vitality is its health, shown as a percentage. Keep it fed and it stays healthy.",
      p2: "$SNACC is the memecoin it eats. On testnet it has no monetary value.",
      p3: "This is an experimental game on NEAR testnet. Nothing here is a promise of profit.",
    },
    modes: {
      topic: "demo and live",
      title: "Demo or live",
      body: "The demo and live switch in the header decides where the numbers come from.",
      p1: "Demo is simulated on your device. No wallet, no transactions, nothing is written to the chain.",
      p2: "Live testnet reads the real contract. You can look around without logging in.",
      p3: "To hatch and feed in live mode, press connect wallet and pick a NEAR wallet. If email login is switched on for this site it shows up in the same picker, powered by Privy. Either way you sign testnet transactions yourself and the app never sees your wallet's keys. Optional one-tap play (Settings) adds a limited key made in this browser, so deposit-free actions need no popup.",
    },
    hatch: {
      topic: "hatching",
      title: "Hatch your first Snacc",
      body: "In live mode, once your wallet is linked, press Hatch in the action bar at the bottom.",
      p1: "Pick a role and a testnet NEAR stake, then approve the transaction in your wallet. The new Snacc appears in my collection.",
      p2: "No testnet NEAR? The wallet panel links to the free NEAR faucet.",
      p3: "In demo, tap a cell to open the lab and try every action with simulated numbers.",
    },
    feed: {
      topic: "daily feeding",
      title: "Feed it daily, or it gets snacked",
      body: "Vitality drains every hour, so check in about once a day and press Feed. Feeding burns a little $SNACC from the Snacc's own balance and refills its vitality.",
      p1: "At {distressPct} effective vitality or less a Snacc is Distressed, and another player can adopt it.",
      p2: "At zero it is starving, and anyone can snack it: the hunter keeps {bountyPct} of its $SNACC and the rest goes to The Pantry.",
      p3: "Open help any time for the rules, the glossary and what things cost.",
    },
  },
};

export default onboarding;
