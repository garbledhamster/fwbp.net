import Phaser from '../assets/vendor/phaser-4.2.1.esm.js';

// The Campaign clock owns motion. Phaser projects the current rig through the
// same camera offset as the existing lake art and fish sprites.
export function mountCampaignScene(viewport) {
  const parent = document.createElement('div');
  parent.className = 'campaign-scene';
  parent.setAttribute('aria-hidden', 'true');
  viewport.append(parent);
  let frame;
  let painted;
  let rig;
  let camera;

  const game = new Phaser.Game({
    type: Phaser.CANVAS,
    parent,
    transparent: true,
    banner: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    scene: {
      create() {
        rig = this.add.graphics();
        camera = this.cameras.main;
        parent.dataset.ready = '';
      },
      update() {
        if (painted === frame) return;
        painted = frame;
        rig.clear();
        if (!frame) return;
        const { start, eye, bend, attached, ready, linePull, scrollX, scrollY } = frame;
        camera.setScroll(scrollX, scrollY);
        const lineEye = attached ? { x: eye.x - 5, y: eye.y - 4 } : eye;
        const curve = new Phaser.Curves.QuadraticBezier(
          new Phaser.Math.Vector2(start.x, start.y),
          new Phaser.Math.Vector2(start.x + bend, start.y + (eye.y - start.y) * .72),
          new Phaser.Math.Vector2(lineEye.x, lineEye.y),
        );
        rig.lineStyle(linePull ? 2.1 : 1.5, linePull ? 0xffdc91 : 0xffedbd);
        rig.strokePoints(curve.getPoints(32), false);
        rig.fillStyle(0xffd688).fillCircle(lineEye.x, lineEye.y, 2.4);
        if (attached) {
          // The shank starts at the line eye and the tip returns to the mouth.
          rig.lineStyle(1.7, 0xffefc7);
          rig.beginPath();
          rig.moveTo(lineEye.x, lineEye.y);
          rig.lineTo(eye.x - 5, eye.y + 3);
          rig.lineTo(eye.x - 2, eye.y + 5);
          rig.lineTo(eye.x + 1, eye.y + 3);
          rig.lineTo(eye.x, eye.y);
          rig.strokePath();
        } else if (ready) {
          rig.lineStyle(2, 0xffd75b, .95).strokeCircle(eye.x, eye.y, 12);
        }
      },
    },
  });
  return {
    draw(next) { frame = next; },
    destroy() {
      game.destroy(true);
      parent.remove();
    },
  };
}
