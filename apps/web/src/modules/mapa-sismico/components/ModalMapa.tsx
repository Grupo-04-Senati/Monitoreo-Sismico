import { useMemo, useState } from "react";
import type { EventoSismico, FiltrosMapa, RegionResumen } from "../types";
import { FILTROS_POR_DEFECTO, hayFiltrosActivos, resumenFiltros, validarFiltros } from "../schemas/filtros.schema";
import { eventosFiltrados, resumirRegiones } from "../services/mapa.service";
import { descargarMapa } from "../services/mapa.service";
import { fmtDateTimeUTC5 } from "@/lib/format";
import ExpandModal from "@/components/ui/ExpandModal";
import FiltrosMapaPanel from "./FiltrosMapa";
import ModalExportarMapa from "./ModalExportarMapa";
import { IconDownload } from "@/components/ui/Icons";

interface ModalMapaProps {
  filtrosIniciales: FiltrosMapa;
  catalogo: EventoSismico[];
  onCerrar: () => void;
}

type Tab = "eventos" | "regiones";

/**
 * Vista ampliada del mapa: **filtros propios** (independientes de la URL),
 * tabla de eventos / regiones y exportación por partes (regiones / eventos).
 */
export default function ModalMapa({ filtrosIniciales, catalogo, onCerrar }: ModalMapaProps) {
  const [filtros, setFiltros] = useState<FiltrosMapa>(filtrosIniciales);
  const [tab, setTab] = useState<Tab>("eventos");
  const [exportar, setExportar] = useState(false);

  const errores = useMemo(() => validarFiltros(filtros), [filtros]);
  const hayFiltros = useMemo(() => hayFiltrosActivos(filtros), [filtros]);
  const eventos = useMemo(() => eventosFiltrados(catalogo, filtros), [catalogo, filtros]);
  const regiones = useMemo(() => resumirRegiones(eventos), [eventos]);

  const setPatch = (patch: Partial<FiltrosMapa>) => setFiltros((f) => ({ ...f, ...patch }));

  const tabCls = (on: boolean) =>
    `rounded-md px-3 py-1 text-xs font-medium transition-colors ${on ? "bg-accent-600 text-white" : "text-content-secondary hover:bg-surface-tertiary"}`;

  const pie = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-content-muted">{resumenFiltros(filtros)} · n = {eventos.length.toLocaleString("es-PE")}</span>
      <button
        type="button"
        onClick={() => setExportar(true)}
        className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-content-secondary transition-colors hover:bg-surface-tertiary"
      >
        <IconDownload size={13} />
        Exportar partes
      </button>
    </div>
  );

  return (
    <>
      <ExpandModal title="Mapa sísmico · vista ampliada" onClose={onCerrar} footer={pie} resizable>
        <FiltrosMapaPanel filtros={filtros} errores={errores} hayFiltros={hayFiltros} onCambiar={setPatch} onLimpiar={() => setFiltros(FILTROS_POR_DEFECTO)} />

        <div className="mb-2 flex items-center gap-1.5" role="tablist" aria-label="Contenido">
          <button type="button" role="tab" aria-selected={tab === "eventos"} onClick={() => setTab("eventos")} className={tabCls(tab === "eventos")}>
            Eventos ({eventos.length})
          </button>
          <button type="button" role="tab" aria-selected={tab === "regiones"} onClick={() => setTab("regiones")} className={tabCls(tab === "regiones")}>
            Regiones ({regiones.length})
          </button>
        </div>

        {tab === "eventos" ? <TablaEventos eventos={eventos} /> : <TablaRegiones regiones={regiones} />}
      </ExpandModal>

      {exportar && (
        <ModalExportarMapa
          iniciales={["regiones", "eventos"]}
          totalRegiones={regiones.length}
          totalEventos={eventos.length}
          onCerrar={() => setExportar(false)}
          onDescargar={(partes, formato) => {
            descargarMapa(partes, regiones, eventos, formato);
            setExportar(false);
          }}
        />
      )}
    </>
  );
}

function TablaEventos({ eventos }: { eventos: EventoSismico[] }) {
  if (eventos.length === 0) {
    return <p className="rounded-lg border border-border bg-surface-secondary px-3.5 py-3 text-xs text-content-muted">Sin eventos con estos filtros.</p>;
  }
  return (
    <div className="max-h-[55vh] overflow-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-surface-secondary text-[10px] uppercase tracking-wide text-content-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Fecha (UTC-5)</th>
            <th className="px-2 py-2 text-left font-medium">Localidad</th>
            <th className="px-2 py-2 text-left font-medium">Región</th>
            <th className="px-2 py-2 text-right font-medium">Mag.</th>
            <th className="px-2 py-2 text-right font-medium">Prof. (km)</th>
          </tr>
        </thead>
        <tbody>
          {[...eventos]
            .sort((a, b) => b.occurredAtUtc.localeCompare(a.occurredAtUtc))
            .map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-3 py-1.5 text-content-secondary">{fmtDateTimeUTC5(e.occurredAtUtc)}</td>
                <td className="px-2 py-1.5 text-content">{e.locality}</td>
                <td className="px-2 py-1.5 text-content-secondary">{e.region}</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-content">
                  {e.magnitude.toFixed(1)} {e.magnitudeType ?? ""}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-content-secondary">{e.depthKm ?? "—"}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

function TablaRegiones({ regiones }: { regiones: RegionResumen[] }) {
  return (
    <div className="max-h-[55vh] overflow-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-surface-secondary text-[10px] uppercase tracking-wide text-content-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Región</th>
            <th className="px-2 py-2 text-right font-medium">Eventos</th>
            <th className="px-2 py-2 text-right font-medium">%</th>
            <th className="px-2 py-2 text-right font-medium">Máx.</th>
          </tr>
        </thead>
        <tbody>
          {regiones.map((r) => (
            <tr key={r.slug} className="border-b border-border last:border-0">
              <td className="px-3 py-1.5 text-content">{r.nombre}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-content-secondary">{r.eventos}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-content-muted">{r.porcentaje.toFixed(1)}%</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-content-secondary">{r.magnitudMaxima != null ? r.magnitudMaxima.toFixed(1) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
