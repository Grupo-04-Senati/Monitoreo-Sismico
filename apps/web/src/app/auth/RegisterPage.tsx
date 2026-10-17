import { useState, useRef, useCallback, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/auth/AuthContext";
import ParticleBackground from "@/components/background/ParticleBackground";
import PeruMap from "@/components/background/PeruMap";
import { IconCheck, IconUserPlus } from "@/components/ui/Icons";

interface FormErrors {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

const PASSWORD_RULES = [
  { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Una letra mayúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Una letra minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "Un número", test: (p: string) => /[0-9]/.test(p) },
  { label: "Un carácter especial", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

/* ── Panel derecho (comparte fondo de estrellas) ─────── */
function RightPanel() {
  return (
    <div
      className="hidden lg:flex w-1/2 items-center justify-center relative overflow-hidden"
      style={{ zIndex: 10 }}
      aria-hidden="true"
    >
      <PeruMap />
    </div>
  );
}

/* ── Estilos compartidos ───────────────────────────────── */
const styles = `
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .auth-card-wrap { position: relative; }
  .auth-card {
    position: relative;
    border-radius: 16px;
    background: rgba(19, 49, 92, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid #1F4A7A;
    box-shadow:
      0 8px 40px rgba(0,0,0,0.4),
      0 0 30px rgba(14,159,188,0.12),
      inset 0 1px 0 rgba(255,255,255,0.06);
    transform-style: preserve-3d;
    transition: transform 0.2s ease-out, box-shadow 0.35s ease, border-color 0.35s ease;
  }
  .auth-card:hover {
    box-shadow:
      0 20px 60px rgba(0,0,0,0.5),
      0 0 50px rgba(14,159,188,0.25),
      0 0 90px rgba(14,159,188,0.1),
      inset 0 1px 0 rgba(255,255,255,0.08);
    border-color: rgba(76, 201, 224, 0.5);
  }
  .auth-card-glow {
    position: absolute;
    inset: -1px;
    border-radius: 16px;
    padding: 1px;
    background: conic-gradient(from 0deg, transparent 0%, rgba(14,159,188,0.6) 15%, transparent 30%, transparent 50%, rgba(10,124,147,0.5) 65%, transparent 80%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    animation: borderGlow 4s linear infinite;
    pointer-events: none;
  }
  @keyframes borderGlow {
    0% { transform: rotate(0deg); opacity: 0.5; }
    50% { opacity: 1; }
    100% { transform: rotate(360deg); opacity: 0.5; }
  }
  .login-input {
    width: 100%;
    padding: 13px 16px;
    border: 2px solid #2B5C8F;
    border-radius: 10px;
    font-size: 16px;
    color: #FFFFFF;
    background: #0B2545;
    outline: none;
    transition: all 0.3s;
  }
  .login-input::placeholder { color: #5D6F80; }
  .login-input:focus {
    border-color: #4CC9E0;
    box-shadow: 0 0 0 3px rgba(76,201,224,0.25), inset 0 0 12px rgba(76,201,224,0.06);
    background: #0B2545;
  }
  .login-btn {
    display: inline-block;
    padding: 15px;
    background: #0E9FBC;
    color: #0B2545;
    border: none;
    border-radius: 10px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 4px 20px rgba(14,159,188,0.35);
    text-align: center;
    text-decoration: none;
    margin-top: 6px;
  }
  .login-btn:hover:not(:disabled) {
    background: #0A7C93;
    color: #FFFFFF;
    transform: translateY(-2px);
    box-shadow: 0 6px 30px rgba(14,159,188,0.5);
  }
  .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
`;

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCardMove = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 12;
    const rotateX = (0.5 - y) * 10;
    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px) scale(1.015)`;
  }, []);

  const handleCardLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.transform = "rotateX(0deg) rotateY(0deg) translateY(0) scale(1)";
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError("");

    const newErrors: FormErrors = {};
    if (!fullName.trim()) newErrors.fullName = "El nombre completo es obligatorio.";
    if (!email.trim()) newErrors.email = "El correo es obligatorio.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Correo electrónico inválido.";
    if (!PASSWORD_RULES.every((r) => r.test(password))) newErrors.password = "La contraseña no cumple todas las reglas.";
    if (password !== confirmPassword) newErrors.confirmPassword = "Las contraseñas no coinciden.";
    if (!acceptTerms) newErrors.terms = "Debe aceptar los términos y condiciones.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    const result = register({ fullName, email, password });
    setLoading(false);
    if (result.success) setSuccess(true);
    else setServerError(result.error ?? "Error al registrar.");
  };

  const cardAnim = { animation: "slideUp 0.6s ease-out 0.15s both" } as const;

  /* ── Éxito ─────────────────────────────────────────── */
  if (success) {
    return (
      <div className="min-h-screen flex relative" style={{ background: "#0B2545" }}>
        <ParticleBackground />
        <div className="relative w-full lg:w-1/2 flex items-center justify-center overflow-hidden" style={{ zIndex: 10 }}>
          <div className="relative w-full max-w-xl px-6 py-10" style={{ zIndex: 10 }}>
            <div className="rounded-2xl p-10 text-center" style={{ background: "rgba(19,49,92,0.92)", backdropFilter: "blur(20px)", border: "1px solid #1F4A7A", boxShadow: "0 8px 40px rgba(0,0,0,0.4)", ...cardAnim }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }}>
                <IconCheck size={28} style={{ color: "#4CC9E0" }} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Registro exitoso</h2>
              <p className="text-base mb-6 leading-relaxed" style={{ color: "#A9BCD0" }}>
                Su cuenta está en estado <strong className="text-white">Pendiente de aprobación</strong>.
                Un administrador asignará su rol y activará el acceso.
              </p>
              <Link to="/login" className="login-btn px-6">Volver al inicio de sesión</Link>
            </div>
          </div>
        </div>
        <RightPanel />
        <style>{styles}</style>
      </div>
    );
  }

  /* ── Formulario ────────────────────────────────────── */
  return (
    <div className="min-h-screen flex relative" style={{ background: "#0B2545" }}>
      <ParticleBackground />
      {/* Izquierda */}
      <div className="relative w-full lg:w-1/2 flex items-center justify-center overflow-hidden" style={{ zIndex: 10 }}>

        <div className="relative w-full max-w-xl px-6 py-10" style={{ zIndex: 10 }}>
          {/* Logo */}
          <div className="text-center mb-6" style={{ animation: "slideUp 0.6s ease-out" }}>
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "linear-gradient(135deg,#0E9FBC,#0A7C93)", boxShadow: "0 0 30px rgba(14,159,188,0.4)" }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white" style={{ textShadow: "0 0 30px rgba(14,159,188,0.3)" }}>Crear cuenta</h1>
            <p className="text-base mt-1" style={{ color: "#A9BCD0" }}>Registro de usuario nuevo</p>
          </div>

          {/* Card */}
          <div className="auth-card-wrap" style={{ perspective: "1200px", ...cardAnim }}>
            <div
              ref={cardRef}
              className="auth-card"
              onMouseMove={handleCardMove}
              onMouseLeave={handleCardLeave}
            >
              <div className="auth-card-glow" />
              <div className="relative p-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(14,159,188,0.1)", border: "1px solid rgba(14,159,188,0.25)" }}>
                <IconUserPlus size={18} style={{ color: "#4CC9E0" }} />
              </div>
              <h2 className="text-xl font-bold text-white">Registro</h2>
            </div>

            {serverError && (
              <div className="mb-4 p-3 rounded-lg text-sm" role="alert" style={{ background: "rgba(180,35,24,0.1)", border: "1px solid rgba(180,35,24,0.35)", color: "#F97066" }}>
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-semibold mb-2" style={{ color: "#D9E1E8" }}>Nombre completo</label>
                <input id="fullName" type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Juan Pérez López" className="login-input" />
                {errors.fullName && <p className="text-xs mt-1" style={{ color: "#F97066" }}>{errors.fullName}</p>}
              </div>

              <div>
                <label htmlFor="regEmail" className="block text-sm font-semibold mb-2" style={{ color: "#D9E1E8" }}>Correo electrónico</label>
                <input id="regEmail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@correo.com" className="login-input" />
                {errors.email && <p className="text-xs mt-1" style={{ color: "#F97066" }}>{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="regPassword" className="block text-sm font-semibold mb-2" style={{ color: "#D9E1E8" }}>Contraseña</label>
                <input id="regPassword" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="login-input" />
                <div className="mt-2 space-y-1">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = password.length > 0 && rule.test(password);
                    return (
                      <p key={rule.label} className="text-xs flex items-center gap-1.5" style={{ color: ok ? "#4CC9E0" : "#5D6F80" }}>
                        {ok ? <IconCheck size={11} /> : <span className="w-2.5 h-2.5 rounded-full border border-current inline-block" />}
                        {rule.label}
                      </p>
                    );
                  })}
                </div>
                {errors.password && <p className="text-xs mt-1" style={{ color: "#F97066" }}>{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold mb-2" style={{ color: "#D9E1E8" }}>Confirmar contraseña</label>
                <input id="confirmPassword" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="login-input" />
                {errors.confirmPassword && <p className="text-xs mt-1" style={{ color: "#F97066" }}>{errors.confirmPassword}</p>}
              </div>

              <div>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="w-4 h-4 mt-0.5 rounded" style={{ accentColor: "#4CC9E0" }} />
                  <span className="text-sm leading-snug" style={{ color: "#A9BCD0" }}>
                    Acepto los <span className="underline" style={{ color: "#4CC9E0" }}>términos y condiciones</span> y la política de privacidad.
                  </span>
                </label>
                {errors.terms && <p className="text-xs mt-1" style={{ color: "#F97066" }}>{errors.terms}</p>}
              </div>

              <button type="submit" disabled={loading} className="login-btn w-full">
                {loading ? "Creando cuenta..." : "Crear cuenta"}
              </button>
            </form>

            <p className="text-sm text-center mt-5" style={{ color: "#A9BCD0" }}>
              ¿Ya tiene cuenta?{" "}
              <Link to="/login" className="font-semibold transition-colors hover:text-cyan-300" style={{ color: "#4CC9E0" }}>Iniciar sesión</Link>
            </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Derecha: planeta */}
      <RightPanel />
      <style>{styles}</style>
    </div>
  );
}
