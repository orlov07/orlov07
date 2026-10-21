"use client";

import type { MatchState } from "@setra/scoring-engine";
import { Activity, ArrowRight, Cloud, History, Play, Plus, Trophy, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadActiveMatch, loadMatchHistory } from "@/lib/local-match-store";
import { authClient } from "@/lib/auth/client";

export default function Dashboard(){
  const {data:session}=authClient.useSession();
  const [owner,setOwner]=useState(false);
  const [active,setActive]=useState<MatchState|null>(null); const [history,setHistory]=useState<MatchState[]>([]);
  useEffect(()=>{void Promise.all([loadActiveMatch(),loadMatchHistory()]).then(([current,items])=>{if(current?.status!=="finished")setActive(current);setHistory(items)}).catch(()=>undefined)},[]);
  useEffect(()=>{void fetch("/api/account/access").then(response=>response.ok?response.json():null).then(data=>setOwner(Boolean(data?.owner))).catch(()=>undefined)},[]);
  const wins=history.filter(match=>match.winner!==null).length;
  return <main className="dashboardPage"><header className="appHeader"><Link href="/" className="brand"><img src="/setra-logo.png" alt=""/><span>SETRA</span></Link><span>PAINEL DO JOGADOR</span><div className="headerActions"><Link href="/amigos" className="profileLink"><Users/> Amigos</Link><Link href="/conta/nome" className="profileLink"><UserRound/> Perfil</Link></div></header>
    <div className="dashboardShell"><div className="dashHello"><div><span className="kicker">{session?.user.name ? `OLÁ, ${session.user.name}` : "BEM-VINDO À QUADRA"}{owner&&<b className="ownerBadge">PROPRIETÁRIO</b>}</span><h1>Pronto para<br/>o próximo ponto?</h1></div><Link href="/partida/nova" className="button"><Plus/> Nova partida</Link></div>
      {active&&<Link href="/partida/ao-vivo" className="resumeCard"><div><i/><span>PARTIDA EM ANDAMENTO</span><h2>{active.teams.A} <b>vs</b> {active.teams.B}</h2></div><div><Play/> Retomar partida <ArrowRight/></div></Link>}
      <div className="statGrid"><article><Activity/><span>Partidas</span><strong>{history.length}</strong><small>sincronizadas com sua conta</small></article><article><Trophy/><span>Concluídas</span><strong>{wins}</strong><small>com resultado confirmado</small></article><article><Cloud/><span>Neon</span><strong>Conectado</strong><small>partidas, conta e amizades sincronizadas</small></article></div>
      <section className="historySection"><div className="historyHead"><div><History/><span><b>Histórico recente</b><small>Resultados privados sincronizados no Neon</small></span></div></div>
        {history.length===0?<div className="emptyState"><Trophy/><h3>Sua história começa aqui.</h3><p>Quando uma partida for concluída, o resultado aparecerá neste painel.</p><Link href="/partida/nova">Criar primeira partida <ArrowRight/></Link></div>:<div className="historyList">{history.map(match=>{const last=match.sets.at(-1);return <article key={match.id}><div><small>FINALIZADA</small><b>{match.teams.A} × {match.teams.B}</b></div><div className="historyResult"><span>{match.setsWon.A}</span><i>SETS</i><span>{match.setsWon.B}</span></div><div><small>ÚLTIMO SET</small><b>{last?.gamesA} — {last?.gamesB}</b></div></article>})}</div>}
      </section>
    </div></main>
}
