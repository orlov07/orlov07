"use client";

import { authClient } from "@/lib/auth/client";
import { ArrowLeft, Check, Radio, ShieldCheck, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signInWithGoogle() {
    setLoading(true);
    setError("");
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/conta/nome",
    });
    if (result.error) {
      setError(result.error.message ?? "Não foi possível entrar com o Google.");
      setLoading(false);
    }
  }

  return (
    <main className="loginPage">
      <div className="loginShell">
        <section className="loginShowcase" aria-label="Benefícios do SETRA">
          <div className="loginGlow" />
          <Link href="/" className="brand"><img src="/setra-logo.png" alt="" /><span>SETRA</span></Link>
          <div className="loginShowcaseCopy">
            <span className="kicker"><i /> PLACAR INTELIGENTE</span>
            <h1>Seu jogo.<br/><em>Sempre com você.</em></h1>
            <p>Salve resultados, acompanhe sua evolução e retome cada partida de onde parou.</p>
          </div>
          <div className="loginScorePreview">
            <div className="loginEmptyVisual"><Radio size={28}/><span>Seu placar aparecerá aqui</span><small>Crie uma partida para começar</small></div>
          </div>
          <div className="loginBenefits"><span><Trophy size={16}/> Histórico de partidas</span><span><ShieldCheck size={16}/> Dados protegidos</span></div>
        </section>

        <section className="loginPanel">
          <Link href="/" className="loginBack"><ArrowLeft size={16} /> Voltar para o início</Link>
          <div className="loginMobileBrand brand"><img src="/setra-logo.png" alt="" /><span>SETRA</span></div>
          <div className="loginForm">
            <span className="kicker">ENTRAR OU CRIAR CONTA</span>
            <h2>Entre em quadra.</h2>
            <p>Continue com o Google. Se for seu primeiro acesso, sua conta será criada e você poderá escolher seu nome de usuário.</p>
            <button className="googleButton" onClick={signInWithGoogle} disabled={loading}>
              <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.11-1.32.32-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"/></svg>
              <span>{loading ? "Conectando…" : "Entrar ou criar conta com Google"}</span>
            </button>
            {error && <p className="loginError" role="alert">{error}</p>}
            <div className="loginTrust"><Check size={14}/><span>Login seguro gerenciado pelo Google e Neon Auth</span></div>
          </div>
          <small className="loginLegal">Ao continuar, você concorda com os Termos de Uso e a Política de Privacidade.</small>
        </section>
      </div>
    </main>
  );
}
