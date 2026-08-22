import { useEffect, useRef } from 'react';

const CHARS = 'アカサタナハマヤラワ0123456789ABCDEF$#@%&*';

export default function MatrixRain({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let drops: number[] = [];
    let fontSize = 16;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      fontSize = Math.max(12, canvas.width / 70);
      const cols = Math.floor(canvas.width / (fontSize * 1.05));
      drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -40));
    };

    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.fillStyle = 'rgba(5, 7, 13, 0.12)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * fontSize * 1.05;
        const y = drops[i] * fontSize * 1.05;
        // Head of the stream glows brighter.
        const head = Math.random() > 0.975;
        ctx.fillStyle = head ? '#22ff9a' : Math.random() > 0.5 ? 'rgba(0,229,255,0.75)' : 'rgba(34,255,154,0.55)';
        ctx.fillText(char, x, y);
        if (y > canvas.height && Math.random() > 0.975) drops[i] = Math.floor(Math.random() * -20);
        drops[i]++;
      }
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={ref} className={`matrix-canvas ${className}`} aria-hidden />;
}
