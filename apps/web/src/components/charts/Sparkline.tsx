interface SparklineProps {
  values: number[];
  /** altura en px del trazo */
  height?: number;
  className?: string;
}

/**
 * Línea mínima para resúmenes compactos (p. ej. la serie horaria de una fuente).
 * No lleva ejes ni etiquetas: solo muestra la tendencia.
 */
export default function Sparkline({ values, height = 28, className = "" }: SparklineProps) {
  if (!values.length) {
    return null;
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const n = values.length;
  const fx = (i: number) => (n === 1 ? 100 : (i / (n - 1)) * 100);
  const fy = (v: number) => 100 - ((v - min) / span) * 100;

  const line = values.map((v, i) => `${fx(i).toFixed(2)},${fy(v).toFixed(2)}`).join(" ");

  return (
    <svg
      className={className}
      style={{ height }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={line}
        fill="none"
        stroke="var(--accent-500)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
