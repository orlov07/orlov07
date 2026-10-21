"use client";

import { Check, CheckCircle2, Clipboard, Clock3, Copy, Link2, LoaderCircle, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type FriendEntry = { username: string };
type RequestEntry = { id: string; username: string; created_at: string };
type FriendsData = {
  profile: { username: string; friendCode: string };
  friends: FriendEntry[];
  incoming: RequestEntry[];
  outgoing: RequestEntry[];
};

export default function FriendsPage() {
  const [data, setData] = useState<FriendsData | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/friends", { cache: "no-store" });
    if (response.status === 401) { window.location.href = "/login"; return; }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Não foi possível carregar seus amigos.");
    setData(body);
    setLoading(false);
  }, []);

  useEffect(() => {
    const sharedCode = new URL(window.location.href).searchParams.get("codigo");
    if (sharedCode) setCode(sharedCode);
    void load().catch(reason => { setError(reason.message); setLoading(false); });
  }, [load]);

  async function sendRequest(event: FormEvent) {
    event.preventDefault();
    setSending(true); setError(""); setMessage("");
    const response = await fetch("/api/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Não foi possível enviar a solicitação."); setSending(false); return; }
    setMessage("Solicitação de amizade enviada."); setCode(""); setSending(false); await load();
  }

  async function answer(requestId: string, action: "accept" | "reject") {
    setError(""); setMessage("");
    const response = await fetch("/api/friends", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, action }) });
    const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Não foi possível atualizar a solicitação."); return; }
    setMessage(action === "accept" ? "Amizade aceita." : "Solicitação recusada."); await load();
  }

  async function copyShareLink() {
    if (!data) return;
    await navigator.clipboard.writeText(`${window.location.origin}/amigos?codigo=${data.profile.friendCode}`);
    setMessage("Link de amizade copiado.");
  }

  if (loading) return <main className="friendsPage"><LoaderCircle className="accountLoader"/></main>;

  return <main className="friendsPage"><div className="friendsShell">
    <header className="friendsHeader"><div><Link href="/dashboard" className="brand"><img src="/setra-logo.png" alt=""/><span>SETRA</span></Link><span className="kicker">REDE DE AMIGOS</span><h1>Jogue com<br/>quem você conhece.</h1></div><Link href="/dashboard" className="friendsBack">Voltar ao painel</Link></header>

    {error&&<div className="friendsNotice error" role="alert">{error}</div>}{message&&<div className="friendsNotice"><CheckCircle2/>{message}</div>}

    <section className="shareFriendCard">
      <div><Link2/><span><b>Seu código de amizade</b><small>Compartilhe o código ou envie o link.</small></span></div>
      <strong>{data?.profile.friendCode}</strong>
      <button onClick={copyShareLink}><Copy/> Copiar link</button>
    </section>

    <div className="friendsGrid">
      <section className="friendPanel"><div className="friendPanelTitle"><UserPlus/><div><h2>Adicionar amigo</h2><p>Cole o código recebido para enviar uma solicitação.</p></div></div><form onSubmit={sendRequest} className="friendCodeForm"><input value={code} onChange={event=>setCode(event.target.value.toUpperCase())} placeholder="CÓDIGO DE AMIZADE" autoComplete="off"/><button className="button" disabled={sending||!code.trim()}>{sending?<LoaderCircle className="spin"/>:<><UserPlus/> Enviar solicitação</>}</button></form></section>

      <section className="friendPanel"><div className="friendPanelTitle"><Users/><div><h2>Solicitações recebidas</h2><p>{data?.incoming.length ?? 0} aguardando sua resposta.</p></div></div><div className="friendList">{data?.incoming.length ? data.incoming.map(item=><article key={item.id}><span className="friendAvatar">{item.username.slice(0,1).toUpperCase()}</span><b>{item.username}</b><div><button aria-label={`Aceitar ${item.username}`} onClick={()=>answer(item.id,"accept")}><Check/></button><button aria-label={`Recusar ${item.username}`} onClick={()=>answer(item.id,"reject")}><X/></button></div></article>):<div className="friendEmpty"><Clipboard/><span>Nenhuma solicitação recebida.</span></div>}</div></section>

      <section className="friendPanel"><div className="friendPanelTitle"><Users/><div><h2>Seus amigos</h2><p>{data?.friends.length ?? 0} conexões.</p></div></div><div className="friendList">{data?.friends.length ? data.friends.map(item=><article key={item.username}><span className="friendAvatar">{item.username.slice(0,1).toUpperCase()}</span><b>{item.username}</b><CheckCircle2 className="friendAccepted"/></article>):<div className="friendEmpty"><Users/><span>Seus amigos aparecerão aqui.</span></div>}</div></section>

      <section className="friendPanel"><div className="friendPanelTitle"><Clock3/><div><h2>Enviadas</h2><p>Solicitações aguardando resposta.</p></div></div><div className="friendList">{data?.outgoing.length ? data.outgoing.map(item=><article key={item.id}><span className="friendAvatar">{item.username.slice(0,1).toUpperCase()}</span><b>{item.username}</b><small>Pendente</small></article>):<div className="friendEmpty"><Clock3/><span>Nenhuma solicitação pendente.</span></div>}</div></section>
    </div>
  </div></main>;
}
