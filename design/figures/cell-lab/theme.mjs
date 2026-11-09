// Plain + marigold theme for the Cell Lab (matches the owner reference set):
// cream body, tan base edge, near-black ink, strong marigold accent, flat dark-brown offset shadow.
export const PLAIN_CSS = `
.iso{--anatomy-page:#f6f3ea;--anatomy-card:#fbfaf5;--anatomy-text:#6b6252;--anatomy-strong:#161412;--anatomy-muted:#9a8f78;
--anatomy-paper:#fbfaf5;--anatomy-face:#fef8ed;--anatomy-top:#fffdf8;--anatomy-weight:.95px;
--anatomy-shade-0:#c3a972;--anatomy-shade-1:#d8c399;--anatomy-shade-2:#ecdcb8;--anatomy-shade-3:#fef8ed;
--anatomy-lit-top:#ffd57a;--anatomy-lit-shade:#f8aa06;
--anatomy-hi:#161412;--anatomy-mid:#5e5340;--anatomy-lo:#9d8e6c;--anatomy-faint:#d6c8a6;--anatomy-lit:#161412;
--anatomy-halo:#2a2218;--anatomy-halo-opacity:1;--anatomy-dot:#161412;
--anatomy-red:#d94135;--anatomy-green:#4a8b3a;--anatomy-blue:#3e6fb0;
--mari:#f8aa06;--mari-hi:#ffd57a;--mari-dk:#b87800;--ink:#161412;--brown:#2a2218}
.iso-svg{overflow:hidden}
.iso-plate{box-shadow:0 0 0 1px #d9cdb0;padding:44px 20px 52px}
.iso-halo{display:none}
.shadow-flat{fill:var(--brown);stroke:none}
/* tan base edge */
.tan{--anatomy-shade-0:#8f7a52;--anatomy-shade-1:#a48d5e;--anatomy-shade-2:#b9a06c;--anatomy-shade-3:#c9b07e;--anatomy-top:#fffdf8}
/* dark brown (belt, deep recess) */
.brown{--anatomy-face:#8e7a56;--anatomy-top:#9c8762;--anatomy-paper:#8e7a56;--anatomy-shade-0:#6e5d40;--anatomy-shade-1:#7a6847;--anatomy-shade-2:#86724f;--anatomy-shade-3:#927e59}
/* marigold solid */
.mari{--anatomy-paper:#f8aa06;--anatomy-face:#f8aa06;--anatomy-top:#ffd57a;--anatomy-shade-0:#b87800;--anatomy-shade-1:#d68f00;--anatomy-shade-2:#eea102;--anatomy-shade-3:#f8aa06}
/* cytoplasm / matrix tint */
.cyto{--anatomy-paper:#f1e2bb;--anatomy-face:#f1e2bb;--anatomy-top:#f7ebcb;--anatomy-shade-0:#c9b27c;--anatomy-shade-1:#d9c590;--anatomy-shade-2:#e6d4a6;--anatomy-shade-3:#f1e2bb}
.warm{--anatomy-paper:#f6e6bf;--anatomy-face:#f6e6bf;--anatomy-top:#fff1cd;--anatomy-shade-0:#d9b45e;--anatomy-shade-1:#e8c57a;--anatomy-shade-2:#f2d595;--anatomy-shade-3:#f8e2aa}
.bone{--anatomy-paper:#f0eadb;--anatomy-face:#f6f1e4;--anatomy-top:#fffaf0;--anatomy-shade-0:#c9bfa6;--anatomy-shade-1:#dcd2b8;--anatomy-shade-2:#e9e1cb;--anatomy-shade-3:#f6f1e4}
.dark{--anatomy-paper:#3a2f22;--anatomy-face:#3a2f22;--anatomy-top:#5a4a36;--anatomy-shade-0:#241c13;--anatomy-shade-1:#2e2519;--anatomy-shade-2:#382d1f;--anatomy-shade-3:#463828}
.steel{--anatomy-paper:#dedbd2;--anatomy-face:#e8e5dc;--anatomy-top:#faf8f1;--anatomy-shade-0:#a8a597;--anatomy-shade-1:#bdbaab;--anatomy-shade-2:#d0cdc0;--anatomy-shade-3:#e4e1d6}
.ember{--anatomy-paper:#e8762b;--anatomy-face:#e8762b;--anatomy-top:#ffae6e;--anatomy-shade-0:#a8430f;--anatomy-shade-1:#c9581a;--anatomy-shade-2:#de6b22;--anatomy-shade-3:#e8762b}
.ice{--anatomy-paper:#a9d4ec;--anatomy-face:#a9d4ec;--anatomy-top:#e4f3fb;--anatomy-shade-0:#6aa3c4;--anatomy-shade-1:#83b8d6;--anatomy-shade-2:#98c8e2;--anatomy-shade-3:#a9d4ec}
.glow{--anatomy-paper:#c8e36a;--anatomy-face:#c8e36a;--anatomy-top:#eaf7a8;--anatomy-shade-0:#8aa62a;--anatomy-shade-1:#a3c23a;--anatomy-shade-2:#b8d553;--anatomy-shade-3:#c8e36a}
.water{--anatomy-paper:#bfe0f0;--anatomy-face:#bfe0f0;--anatomy-top:#e6f5fb;--anatomy-shade-0:#80b4cf;--anatomy-shade-1:#98c6dc;--anatomy-shade-2:#aed3e6;--anatomy-shade-3:#bfe0f0}
.acid{--anatomy-paper:#d8e58a;--anatomy-face:#d8e58a;--anatomy-top:#f0f6bb;--anatomy-shade-0:#a3b24a;--anatomy-shade-1:#b8c862;--anatomy-shade-2:#c9d975;--anatomy-shade-3:#d8e58a}
.iso-line[data-tone="mari"]{stroke:var(--mari)}
.ink:not([fill]){fill:none}
.ink{stroke:var(--ink);stroke-width:.95px;stroke-linecap:round;stroke-linejoin:round}
.ink2{fill:none;stroke:var(--anatomy-mid);stroke-width:.7px;stroke-linecap:round;stroke-linejoin:round}
.ink3{fill:none;stroke:var(--anatomy-lo);stroke-width:.55px;stroke-linecap:round;stroke-linejoin:round}
.inkf{fill:var(--ink);stroke:none}
.f-mari{fill:var(--mari);stroke:var(--ink);stroke-width:.8px;stroke-linejoin:round}
.f-mari-hi{fill:var(--mari-hi);stroke:var(--ink);stroke-width:.7px;stroke-linejoin:round}
.f-cream{fill:var(--anatomy-face);stroke:var(--ink);stroke-width:.8px;stroke-linejoin:round}
.f-top{fill:var(--anatomy-top);stroke:var(--ink);stroke-width:.8px;stroke-linejoin:round}
.f-tan{fill:#d8c399;stroke:var(--ink);stroke-width:.8px;stroke-linejoin:round}
.f-dk{fill:#3a2f22;stroke:var(--ink);stroke-width:.7px;stroke-linejoin:round}
.f-none{fill:none}
.glass-fill{fill:#fffdf6;fill-opacity:.07;stroke:none}
.glass-fill-b{fill:#e9f2f4;fill-opacity:.22;stroke:none}
.glass-edge{fill:none;stroke:var(--ink);stroke-width:.9px;stroke-linecap:round;stroke-linejoin:round;opacity:.92}
.glass-edge-b{fill:none;stroke:var(--anatomy-mid);stroke-width:.6px;stroke-linecap:round;stroke-linejoin:round;opacity:.7}
.glass-hi{fill:#fff;fill-opacity:.85;stroke:none}
.glow-ring{fill:none;stroke:var(--mari);stroke-width:2.4px;stroke-linecap:round;opacity:.9}
.txt{font:600 2.1px ui-monospace,Menlo,Consolas,monospace;fill:var(--ink);letter-spacing:.03em}
.txt-l{font:600 2.4px ui-monospace,Menlo,Consolas,monospace;fill:var(--anatomy-mid);letter-spacing:.05em}
.txt-w{font:700 2.1px ui-monospace,Menlo,Consolas,monospace;fill:#fff;letter-spacing:.03em}
`;
