"use client";
import Link from "next/link";
import { applyPoint, createMatch, displayPoint, pauseMatch, resumeMatch, revertLastPoint, startMatch, type MatchState, type Team } from "@setra/scoring-engine";
import { Camera, ChevronLeft, Pause, RotateCcw, Sparkles, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { CameraPanel } from "@/components/camera-panel";
import { archiveMatch, loadActiveMatch, saveActiveMatch } from "@/lib/local-match-store";

export default function LiveMatch(){
  const [state,setState]=useState<MatchState|null>(null); const [elapsed,setElapsed]=useState(0); const [cameraOpen,setCameraOpen]=useState(false);
  useEffect(()=>{void (async()=>{try{const saved=await loadActiveMatch();if(saved){setState(saved);return}const raw=localStorage.getItem("setra-match");const data=raw?JSON.parse(raw) as {teamA:string;teamB:string}:{teamA:"Equipe A",teamB:"Equipe B"};setState(startMatch(createMatch({teamA:data.teamA,teamB:data.teamB})))}catch{setState(startMatch(createMatch({teamA:"Equipe A",teamB:"Equipe B"}))) }})()},[]);
  useEffect(()=>{if(state)void saveActiveMatch(state)},[state]);
  useEffect(()=>{if(state?.status==="finished")void archiveMatch(state)},[state]);
  useEffect(()=>{if(state?.status!=="live")return;const id=setInterval(()=>setElapsed(v=>v+1),1000);return()=>clearInterval(id)},[state?.status]);
  if(!state)return <main className="livePage"/>;
  const score=(team:Team)=>{if(state.status!=="live")return;setState(applyPoint(state,team))};
  const set=state.sets[state.sets.length-1]!; const time=`${String(Math.floor(elapsed/60)).padStart(2,"0")}:${String(elapsed%60).padStart(2,"0")}`;
  return <main className="livePage"><header className="liveHeader"><Link href="/partida/nova"><ChevronLeft/> Sair</Link><div className="liveStatus"><i/> AO VIVO <span>·</span> SET {state.sets.length}</div><div><Wifi/> Online</div></header>
    {state.status==="finished"&&<div className="winnerBanner">PARTIDA ENCERRADA · {state.teams[state.winner!]} VENCEU</div>}
    <section className="liveBoard"><div className="liveMeta"><span>QUADRA PRINCIPAL</span><b>{time}</b><span>MELHOR DE 3 SETS</span></div>
      {(["A","B"] as Team[]).map((team,i)=><div className={`liveTeam ${state.server===team?"isServing":""}`} key={team}><div className="teamIdentity"><small>EQUIPE {team}</small><h2>{state.teams[team]}</h2><span>{state.server===team?"● SACANDO":"AGUARDANDO"}</span></div><div className="gameScore"><small>GAMES</small><strong>{team==="A"?set.gamesA:set.gamesB}</strong></div><button onClick={()=>score(team)} disabled={state.status!=="live"} className="pointScore" aria-label={`Ponto para ${state.teams[team]}`}><small>PONTOS</small><strong>{displayPoint(state,team)}</strong><span>+ PONTO</span></button></div>)}
    </section>
    <div className="liveControls"><button onClick={()=>{try{setState(revertLastPoint(state))}catch{}}}><RotateCcw/> Desfazer</button><button onClick={()=>setState(state.status==="paused"?resumeMatch(state):pauseMatch(state))}><Pause/> {state.status==="paused"?"Retomar":"Pausar"}</button><button onClick={()=>setCameraOpen(true)}><Camera/> Câmera</button><div className="aiState"><Sparkles/> IA assistiva <b>Indisponível</b></div></div>
    <p className="liveHint">Toque no placar de pontos da equipe para registrar. Cada ação é validada pelo motor de regras.</p>
    {cameraOpen&&<CameraPanel onClose={()=>setCameraOpen(false)}/>} 
  </main>
}
