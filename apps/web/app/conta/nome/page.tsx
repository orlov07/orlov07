"use client";

import { authClient } from "@/lib/auth/client";
import { Check, LoaderCircle, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function UsernamePage() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isPending && !session) router.replace("/login");
    if (session?.user.name) setUsername(session.user.name);
  }, [isPending, router, session]);

  async function saveUsername(event: FormEvent) {
    event.preventDefault();
    const chosenName = username.trim();
    if (!chosenName) {
      setError("Digite um nome de usuário.");
      return;
    }

    setSaving(true);
    setError("");
    const result = await authClient.updateUser({ name: chosenName });
    if (result.error) {
      setError(result.error.message ?? "Não foi possível salvar o nome de usuário.");
      setSaving(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (isPending) return <main className="accountPage"><LoaderCircle className="accountLoader" /></main>;

  return <main className="accountPage">
    <section className="accountCard">
      <a href="/" className="brand"><img src="/setra-logo.png" alt=""/><span>SETRA</span></a>
      <div className="accountIcon"><UserRound /></div>
      <span className="kicker">SEU PERFIL</span>
      <h1>Como devemos<br/>chamar você?</h1>
      <p>Escolha um nome de usuário para aparecer no seu painel e nas suas partidas.</p>
      <form onSubmit={saveUsername} className="usernameForm">
        <label htmlFor="username">Nome de usuário</label>
        <div className="usernameInput"><UserRound/><input id="username" value={username} onChange={event=>setUsername(event.target.value)} placeholder="Digite como quiser ser chamado" autoComplete="username" autoFocus /></div>
        <small>Use letras, números, espaços, acentos ou símbolos. Você poderá alterar esse nome depois.</small>
        {error && <p className="accountError" role="alert">{error}</p>}
        <button className="button" disabled={saving || !username.trim()}>{saving ? <><LoaderCircle className="spin"/> Salvando…</> : <>Salvar e continuar <Check/></>}</button>
      </form>
    </section>
  </main>;
}
