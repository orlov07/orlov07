"use client";

import type { MatchState } from "@setra/scoring-engine";
import { Activity, ArrowRight, Clock, History, Play, Plus, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadActiveMatch, loadMatchHistory } from "@/lib/local-match-store";

export default function Dashboard(){
  const [active,setActive]=useState<MatchState|null>(null); const [history,setHistory]=useState<MatchState[]>([]);
  useEffect(()=>{void Promise.all([loadActiveMatch(),loadMatchHistory()]).then(([current,items])=>{if(current?.status!=="finished")setActive(current);setHistory(items)}).catch(()=>undefined)},[]);
  const wins=history.filter(match=>match.winner!==null).length;
  return <main className="dashboardPage"><header className="appHeader"><Link href="/" className="brand"><img src="/setra-logo.png" alt=""/><span>SETRA</span></Link><span>PAINEL DO JOGADOR</span><span>MODO LOCAL</span></header>
    <div className="dashboardShell"><div className="dashHello"><div><span className="kicker">BEM-VINDO À QUADRA</span><h1>Pronto para<br/>o próximo ponto?</h1></div><Link href="/partida/nova" className="button"><Plus/> Nova partida</Link></div>
      {active&&<Link href="/partida/ao-vivo" className="resumeCard"><div><i/><span>PARTIDA EM ANDAMENTO</span><h2>{active.teams.A} <b>vs</b> {active.teams.B}</h2></div><div><Play/> Retomar partida <ArrowRight/></div></Link>}
      <div className="statGrid"><article><Activity/><span>Partidas</span><strong>{history.length}</strong><small>registradas neste dispositivo</small></article><article><Trophy/><span>Concluídas</span><strong>{wins}</strong><small>com resultado confirmado</small></article><article><Clock/><span>Sincronização</span><strong>Local</strong><small>Supabase ainda não conectado</small></article></div>
      <section className="historySection"><div className="historyHead"><div><History/><span><b>Histórico recente</b><small>Resultados armazenados localmente</small></span></div></div>
        {history.length===0?<div className="emptyState"><Trophy/><h3>Sua história começa aqui.</h3><p>Quando uma partida for concluída, o resultado aparecerá neste painel.</p><Link href="/partida/nova">Criar primeira partida <ArrowRight/></Link></div>:<div className="historyList">{history.map(match=>{const last=match.sets.at(-1);return <article key={match.id}><div><small>FINALIZADA</small><b>{match.teams.A} × {match.teams.B}</b></div><div className="historyResult"><span>{match.setsWon.A}</span><i>SETS</i><span>{match.setsWon.B}</span></div><div><small>ÚLTIMO SET</small><b>{last?.gamesA} — {last?.gamesB}</b></div></article>})}</div>}
      </section>
    </div></main>
}
