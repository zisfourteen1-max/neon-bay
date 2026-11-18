// NEON BAY — keyboard and mouse state, read fresh every frame by the game.
// WASD/arrows to move, mouse to aim, click to shoot, E to steal a car.
export class Input {
  constructor(canvas) {
    this.keys = {};
    this.pressed = {};
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      if (!this.keys[k]) this.pressed[k] = true;
      this.keys[k] = true;
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => {
      this.keys = {};
      this.mouseDown = false;
    });
  }

  down(key) {
    return !!this.keys[key];
  }

  // True only on the frame the key went down; cleared by endFrame().
  hit(key) {
    return !!this.pressed[key];
  }

  axis() {
    let x = 0;
    let y = 0;
    if (this.down('a') || this.down('arrowleft')) x -= 1;
    if (this.down('d') || this.down('arrowright')) x += 1;
    if (this.down('w') || this.down('arrowup')) y -= 1;
    if (this.down('s') || this.down('arrowdown')) y += 1;
    return { x, y };
  }

  endFrame() {
    this.pressed = {};
    this.mouseClicked = false;
  }
}
