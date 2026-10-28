// Ponto de entrada do mundo 2.5D (Phaser 3, vendorizado em /static/vendor/).

import { CenaMundo } from "./cena.js";

new Phaser.Game({
  type: Phaser.AUTO,
  parent: "jogo",
  backgroundColor: "#0b0f14",
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: [CenaMundo],
});
