import { useEffect, useState } from "react";
import { fmtDateUTC5 } from "@/lib/format";

const UTC5_MS = -5 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Hora y fecha en vivo (zona Perú, UTC-5) con segundos: se actualiza cada segundo.
 * El título muestra la hora UTC exacta.
 */
export default function LiveClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const iso = now.toISOString();
  const d = new Date(now.getTime() + UTC5_MS);

  return (
    <span className={className} title={`${iso} (UTC)`}>
      {fmtDateUTC5(iso)}, {pad(d.getUTCHours())}:{pad(d.getUTCMinutes())}:{pad(d.getUTCSeconds())} (UTC-5)
    </span>
  );
}
