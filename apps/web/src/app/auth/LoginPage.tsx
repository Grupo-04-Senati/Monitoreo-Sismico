import { useState, useRef, useCallback, type FormEvent, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/app/auth/AuthContext";
import ParticleBackground from "@/components/background/ParticleBackground";
import PeruMap from "@/components/background/PeruMap";
import { IconEye, IconEyeOff, IconLogIn, IconShield } from "@/components/ui/Icons";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [showMfa, setShowMfa] = useState(false);
  const [error, setError] = useState("");
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
    setError("");
    setLoading(true);
    const result = await login({ email, password, remember, mfaCode });
    setLoading(false);
    if (result.success) navigate("/", { replace: true });
    else setError(result.error ?? "Error al iniciar sesión.");
  };

  return (
    <div className="min-h-screen flex relative" style={{ background: "#0B2545" }}>
      <ParticleBackground />
      {/* ── Izquierda: formulario ─────────────────────── */}
      <div className="relative w-full lg:w-1/2 flex items-center justify-center overflow-hidden" style={{ zIndex: 10 }}>

        <div className="relative w-full max-w-xl px-6 py-10" style={{ zIndex: 10 }}>
          {/* Logo */}
          <div className="text-center mb-8" style={{ animation: "slideUp 0.6s ease-out" }}>
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{
                background: "linear-gradient(135deg, #0E9FBC 0%, #0A7C93 100%)",
                boxShadow: "0 0 30px rgba(14,159,188,0.4)",
              }}
            >
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white" style={{ textShadow: "0 0 30px rgba(14,159,188,0.3)" }}>
              Monitoreo Sísmico
            </h1>
            <p className="text-base mt-2" style={{ color: "#A9BCD0" }}>
              Plataforma empresarial de monitoreo y análisis
            </p>
          </div>

          {/* Card */}
          <div className="auth-card-wrap" style={{ perspective: "1200px", animation: "slideUp 0.6s ease-out 0.15s both" }}>
            <div
              ref={cardRef}
              className="auth-card"
              onMouseMove={handleCardMove}
              onMouseLeave={handleCardLeave}
            >
              <div className="auth-card-glow" />
              <div className="relative p-10">
                <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(14,159,188,0.1)", border: "1px solid rgba(14,159,188,0.25)" }}
              >
                <IconLogIn size={19} style={{ color: "#4CC9E0" }} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Iniciar sesión</h2>
                <p className="text-sm" style={{ color: "#A9BCD0" }}>Acceda a la plataforma</p>
              </div>
            </div>

            {error && (
              <div
                className="mb-4 p-3 rounded-lg text-sm flex items-start gap-2"
                role="alert"
                style={{ background: "rgba(180,35,24,0.1)", border: "1px solid rgba(180,35,24,0.35)", color: "#F97066" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold mb-2" style={{ color: "#D9E1E8" }}>
                  Correo electrónico
                </label>
                <input
                  id="email" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@sismo.pe" className="login-input"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold mb-2" style={{ color: "#D9E1E8" }}>
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="password" type={showPassword ? "text" : "password"} required autoComplete="current-password"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" className="login-input pr-11"
                  />
                  <button
                    type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 transition-colors"
                    style={{ color: showPassword ? "#4CC9E0" : "#5D6F80" }}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <IconEyeOff size={17} /> : <IconEye size={17} />}
                  </button>
                </div>
              </div>

              {showMfa && (
                <div>
                  <label htmlFor="mfa" className="block text-sm font-semibold mb-2" style={{ color: "#D9E1E8" }}>
                    Código MFA
                  </label>
                  <input
                    id="mfa" type="text" inputMode="numeric" value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="000000" maxLength={6} className="login-input tracking-[0.3em]"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none group">
                  <input
                    type="checkbox" checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="w-4 h-4 rounded" style={{ accentColor: "#4CC9E0" }}
                  />
                  <span className="text-[13px] transition-colors group-hover:text-cyan-400" style={{ color: "#A9BCD0" }}>
                    Recordar sesión
                  </span>
                </label>
                <button
                  type="button" onClick={() => setShowMfa(!showMfa)}
                  className="flex items-center gap-1 text-xs font-semibold transition-colors hover:text-cyan-400"
                  style={{ color: "#4CC9E0" }}
                >
                  <IconShield size={13} />
                  {showMfa ? "Ocultar MFA" : "Usar código MFA"}
                </button>
              </div>

              <button type="submit" disabled={loading} className="login-btn w-full">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                      <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
                    </svg>
                    Verificando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <IconLogIn size={16} />
                    Iniciar sesión
                  </span>
                )}
              </button>
            </form>

            <p className="text-sm text-center mt-6" style={{ color: "#A9BCD0" }}>
              ¿No tiene cuenta?{" "}
              <Link to="/registro" className="font-semibold transition-colors hover:text-cyan-300" style={{ color: "#4CC9E0" }}>
                Registrarse
              </Link>
            </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Derecha: mapa del Perú (solo visual) ──────── */}
      <div
        className="hidden lg:flex w-1/2 items-center justify-center relative overflow-hidden"
        style={{ zIndex: 10 }}
        aria-hidden="true"
      >
        <PeruMap />
      </div>

      <style>{`
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
          padding: 14px 16px;
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
          padding: 16px;
          background: #0E9FBC;
          color: #0B2545;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 20px rgba(14,159,188,0.35);
          margin-top: 8px;
        }
        .login-btn:hover:not(:disabled) {
          background: #0A7C93;
          color: #FFFFFF;
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(14,159,188,0.5);
        }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
