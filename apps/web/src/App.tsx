import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/app/auth/AuthContext";
import { RouteGuard } from "@/app/guards/RouteGuard";
import ForbiddenPage from "@/app/guards/ForbiddenPage";
import LoginPage from "@/app/auth/LoginPage";
import RegisterPage from "@/app/auth/RegisterPage";
import ErpLayout from "@/components/layout/ErpLayout";

// Módulos
import DashboardPage from "@/modules/dashboard/DashboardPage";
import EventosPage from "@/modules/eventos/EventosPage";
import MapaPage from "@/modules/mapa-sismico/MapaPage";
import AnalisisPage from "@/modules/analisis/AnalisisPage";
import PreparacionDatosPage from "@/modules/preparacion-datos/PreparacionDatosPage";
import ModelosMLPage from "@/modules/modelos-ml/ModelosMLPage";
import EstimacionesPage from "@/modules/estimaciones/EstimacionesPage";
import ReglasAlertasPage from "@/modules/alertas/ReglasAlertasPage";
import CentroAlertasPage from "@/modules/alertas/CentroAlertasPage";
import FuentesDatosPage from "@/modules/fuentes-datos/FuentesDatosPage";
import ReportesPage from "@/modules/reportes/ReportesPage";
import UsuariosPage from "@/modules/usuarios-roles/UsuariosPage";
import AuditoriaPage from "@/modules/auditoria/AuditoriaPage";
import ConfiguracionPage from "@/modules/configuracion/ConfiguracionPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Públicas */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/403" element={<ForbiddenPage />} />

        {/* Protegidas – layout ERP */}
        <Route element={<RouteGuard permission="dashboard" />}>
          <Route element={<ErpLayout />}>
            <Route path="/" element={<DashboardPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="eventos" />}>
          <Route element={<ErpLayout />}>
            <Route path="/eventos" element={<EventosPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="mapa" />}>
          <Route element={<ErpLayout />}>
            <Route path="/mapa" element={<MapaPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="analisis" />}>
          <Route element={<ErpLayout />}>
            <Route path="/analisis" element={<AnalisisPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="preparacion" />}>
          <Route element={<ErpLayout />}>
            <Route path="/preparacion-datos" element={<PreparacionDatosPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="modelos" />}>
          <Route element={<ErpLayout />}>
            <Route path="/modelos-ml" element={<ModelosMLPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="estimaciones" />}>
          <Route element={<ErpLayout />}>
            <Route path="/estimaciones" element={<EstimacionesPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="reglas" />}>
          <Route element={<ErpLayout />}>
            <Route path="/reglas-alertas" element={<ReglasAlertasPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="alertas" />}>
          <Route element={<ErpLayout />}>
            <Route path="/alertas" element={<CentroAlertasPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="fuentes" />}>
          <Route element={<ErpLayout />}>
            <Route path="/fuentes-datos" element={<FuentesDatosPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="reportes" />}>
          <Route element={<ErpLayout />}>
            <Route path="/reportes" element={<ReportesPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="usuarios" />}>
          <Route element={<ErpLayout />}>
            <Route path="/usuarios" element={<UsuariosPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="auditoria" />}>
          <Route element={<ErpLayout />}>
            <Route path="/auditoria" element={<AuditoriaPage />} />
          </Route>
        </Route>

        <Route element={<RouteGuard permission="configuracion" />}>
          <Route element={<ErpLayout />}>
            <Route path="/configuracion" element={<ConfiguracionPage />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
