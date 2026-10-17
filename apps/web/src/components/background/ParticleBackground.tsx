import { useEffect, useRef } from "react";

interface Dust {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  vy?: number;
  sway?: number;
  swaySpeed?: number;
}

interface Cloud {
  sprite: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  alpha: number;
  phase: number;
}

interface Sparkle {
  x: number;
  y: number;
  size: number;
  life: number;
  decay: number;
  vx: number;
  vy: number;
  rot: number;
  rotSpeed: number;
  color: string;
}

interface ParticleBackgroundProps {
  /** "stars" = cielo nocturno (login, tema oscuro) · "snow" = cielo con nubes y nieve (tema claro) */
  variant?: "stars" | "snow";
}

/** Nube esponjosa dibujada una sola vez en un canvas aparte (luego solo se estira).
 *  Todos los lóbulos quedan dentro del lienzo para que no aparezcan bordes rectos. */
function makeCloudSprite(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;

  const maxR = h * 0.3;
  const baseY = h - maxR * 0.75;

  const puff = (cx: number, cy: number, r: number, a: number) => {
    const x = Math.min(Math.max(cx, r), w - r);
    const y = Math.min(Math.max(cy, r), h - r);
    const grad = g.createRadialGradient(x, y - r * 0.12, r * 0.08, x, y, r);
    grad.addColorStop(0, `rgba(255,255,255,${a})`);
    grad.addColorStop(0.55, `rgba(255,255,255,${a * 0.85})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };

  // Panza: lóbulos bajos y anchos que unen los domos
  const baseN = 5;
  for (let i = 0; i < baseN; i++) {
    const t = i / (baseN - 1);
    puff(w * (0.26 + 0.48 * t), baseY, maxR * (0.78 + 0.12 * Math.sin(t * Math.PI)), 0.96);
  }

  // Domos redondos encima (el central más alto, como una nube real)
  const domes = 5;
  for (let i = 0; i < domes; i++) {
    const t = i / (domes - 1);
    const s = 0.55 + 0.45 * Math.sin(Math.PI * (0.15 + 0.7 * t));
    puff(w * (0.22 + 0.56 * t), baseY - maxR * (0.5 + 0.55 * s), maxR * (0.5 + 0.35 * s), 0.98);
  }

  // Sombra azulada en la panza de la nube
  const shade = g.createLinearGradient(0, baseY - maxR * 0.5, 0, baseY + maxR * 0.7);
  shade.addColorStop(0, "rgba(168, 202, 234, 0)");
  shade.addColorStop(1, "rgba(150, 188, 224, 0.5)");
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = "source-over";

  return c;
}

export default function ParticleBackground({ variant = "stars" }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const snow = variant === "snow";

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    let animId: number;
    let dust: Dust[] = [];
    let clouds: Cloud[] = [];
    let sparkles: Sparkle[] = [];
    let skyGradient: CanvasGradient | null = null;

    const mouse = { x: 0, y: 0, lastX: 0, lastY: 0 };

    const SPARKLE_COLORS = snow
      ? ["rgba(255, 255, 255,", "rgba(224, 240, 252,", "rgba(186, 216, 240,"]
      : [
          "rgba(255, 255, 255,",
          "rgba(240, 248, 255,",
          "rgba(221, 235, 247,",
        ];

    const spawnSparkles = (x: number, y: number, count: number) => {
      for (let i = 0; i < count; i++) {
        if (sparkles.length > 180) sparkles.shift();
        const angle = Math.random() * Math.PI * 2;
        const speed = snow ? Math.random() * 0.6 + 0.15 : Math.random() * 1.2 + 0.3;
        sparkles.push({
          x: x + (Math.random() - 0.5) * 30,
          y: y + (Math.random() - 0.5) * 30,
          size: Math.random() * 2.5 + 0.8,
          life: 1,
          decay: Math.random() * 0.02 + 0.015,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.3,
          rot: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.15,
          color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
        });
      }
    };

    const initClouds = () => {
      clouds = [];
      const count = 9 + Math.floor(Math.random() * 4);

      for (let i = 0; i < count; i++) {
        const near = Math.random() < 0.45;
        const cw = near ? 340 + Math.random() * 460 : 190 + Math.random() * 260;
        const ch = cw * 0.6;
        clouds.push({
          sprite: makeCloudSprite(360, 216),
          x: Math.random() * (canvas.width + cw) - cw,
          y: near
            ? canvas.height * 0.34 + Math.random() * canvas.height * 0.6
            : Math.random() * canvas.height * 0.5,
          w: cw,
          h: ch,
          speed: (near ? 0.26 : 0.11) * (0.7 + Math.random() * 0.7),
          alpha: near ? 0.55 + Math.random() * 0.3 : 0.28 + Math.random() * 0.26,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const init = () => {
      dust = [];

      if (snow) {
        const flakeCount = Math.max(60, Math.floor((canvas.width * canvas.height) / 11000));
        for (let i = 0; i < flakeCount; i++) {
          const big = Math.random() < 0.14;
          dust.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: big ? Math.random() * 2.2 + 1.8 : Math.random() * 1.5 + 0.7,
            alpha: big ? Math.random() * 0.35 + 0.5 : Math.random() * 0.45 + 0.3,
            twinkleSpeed: Math.random() * 0.0012 + 0.0004,
            twinkleOffset: Math.random() * Math.PI * 2,
            vy: big ? Math.random() * 0.35 + 0.2 : Math.random() * 0.5 + 0.25,
            sway: Math.random() * 0.6 + 0.15,
            swaySpeed: Math.random() * 0.0012 + 0.0004,
          });
        }

        const g = ctx.createLinearGradient(0, 0, canvas.width * 0.4, canvas.height);
        g.addColorStop(0, "#cfe3f6");
        g.addColorStop(0.5, "#eef7fe");
        g.addColorStop(1, "#dceaf7");
        skyGradient = g;

        initClouds();
        return;
      }

      const starCount = Math.floor((canvas.width * canvas.height) / 1600);
      for (let i = 0; i < starCount; i++) {
        const big = Math.random() < 0.05;
        dust.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: big ? Math.random() * 2 + 1.5 : Math.random() * 1.1 + 0.2,
          alpha: big ? Math.random() * 0.4 + 0.4 : Math.random() * 0.5 + 0.12,
          twinkleSpeed: Math.random() * 0.002 + 0.0005,
          twinkleOffset: Math.random() * Math.PI * 2,
        });
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    /** El fondo se dibuja a ~30 fps: suficiente para las nubes/estrellas y la
     *  mitad de trabajo de pintado (el desenfoque del armazón se recalcula menos). */
    const FRAME_MS = 1000 / 30;
    let lastDraw = 0;

    const step = () => {
      animId = requestAnimationFrame(step);
      const now = Date.now();
      if (now - lastDraw < FRAME_MS) return;
      lastDraw = now;

      if (snow) {
        ctx.fillStyle = skyGradient ?? "#f4f9fe";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Nubes (capa lejana y cercana) desplazándose lentamente
        for (const cl of clouds) {
          cl.x += cl.speed;
          if (cl.x > canvas.width + 60) cl.x = -cl.w - 60;
          const bob = Math.sin(now * 0.00018 + cl.phase) * 5;
          ctx.globalAlpha = cl.alpha;
          ctx.drawImage(cl.sprite, cl.x, cl.y + bob, cl.w, cl.h);
        }
        ctx.globalAlpha = 1;

        for (const d of dust) {
          d.y += d.vy!;
          d.x += Math.sin(now * d.swaySpeed! + d.twinkleOffset) * d.sway!;
          if (d.y - d.size > canvas.height) {
            d.y = -d.size;
            d.x = Math.random() * canvas.width;
          }
          if (d.x < -d.size) d.x = canvas.width + d.size;
          else if (d.x > canvas.width + d.size) d.x = -d.size;

          const twinkle = 0.5 + 0.5 * Math.sin(now * d.twinkleSpeed + d.twinkleOffset);
          const a = d.alpha * (0.7 + 0.3 * twinkle);

          ctx.fillStyle = `rgba(196, 221, 243, ${a * 0.3})`;
          ctx.beginPath();
          ctx.arc(d.x, d.y + d.size * 0.35, d.size * 1.55, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = "#06090f";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Campo de estrellas de fondo
        for (const d of dust) {
          const twinkle = 0.5 + 0.5 * Math.sin(now * d.twinkleSpeed + d.twinkleOffset);
          const a = d.alpha * (0.4 + 0.6 * twinkle);
          ctx.fillStyle = `rgba(186, 230, 253, ${a})`;
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Sparkles del cursor
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const sp = sparkles[i];
        sp.life -= sp.decay;
        if (sp.life <= 0) {
          sparkles.splice(i, 1);
          continue;
        }
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += snow ? 0.005 : 0.02;
        sp.vx *= 0.98;
        sp.rot += sp.rotSpeed;

        const twinkle = 0.5 + 0.5 * Math.sin(sp.life * 25 + sp.rot * 3);
        const alpha = sp.life * (0.4 + 0.6 * twinkle);
        const sz = sp.size * (0.5 + 0.5 * sp.life);

        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(sp.rot);

        ctx.fillStyle = `${sp.color} ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, -sz * 2.5);
        ctx.quadraticCurveTo(sz * 0.3, -sz * 0.3, sz * 2.5, 0);
        ctx.quadraticCurveTo(sz * 0.3, sz * 0.3, 0, sz * 2.5);
        ctx.quadraticCurveTo(-sz * 0.3, sz * 0.3, -sz * 2.5, 0);
        ctx.quadraticCurveTo(-sz * 0.3, -sz * 0.3, 0, -sz * 2.5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;

      const dx = e.clientX - mouse.lastX;
      const dy = e.clientY - mouse.lastY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 25) {
        const count = 1 + (Math.random() < 0.3 ? 1 : 0);
        spawnSparkles(e.clientX, e.clientY, count);
        mouse.lastX = e.clientX;
        mouse.lastY = e.clientY;
      }
    };

    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 250);
    };
    let resizeTimer: ReturnType<typeof setTimeout>;

    resize();
    step();

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
    };
  }, [snow]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
}
