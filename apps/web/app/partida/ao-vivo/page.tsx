"use client";
import Link from "next/link";
import { applyPoint, createMatch, displayPoint, finishMatch, pauseMatch, resumeMatch, revertLastPoint, startMatch, type MatchState, type Team } from "@setra/scoring-engine";
import { Camera, ChevronLeft, Flag, Pause, RotateCcw, ScanLine, Wifi, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CameraPanel } from "@/components/camera-panel";
import { archiveMatch, loadActiveMatch, saveActiveMatch } from "@/lib/local-match-store";

export default function LiveMatch(){
  const router=useRouter();
  const [state,setState]=useState<MatchState|null>(null); const [elapsed,setElapsed]=useState(0); const [cameraOpen,setCameraOpen]=useState(false); const [finishOpen,setFinishOpen]=useState(false); const [actionMessage,setActionMessage]=useState("");
  useEffect(()=>{void (async()=>{try{const saved=await loadActiveMatch();if(saved){setState(saved);return}const raw=localStorage.getItem("setra-match");if(!raw){router.replace("/partida/nova");return}const data=JSON.parse(raw) as {teamA?:string;teamB?:string};if(!data.teamA?.trim()||!data.teamB?.trim()){router.replace("/partida/nova");return}setState(startMatch(createMatch({teamA:data.teamA.trim(),teamB:data.teamB.trim()})))}catch{router.replace("/partida/nova")}})()},[router]);
  useEffect(()=>{if(state)void saveActiveMatch(state)},[state]);
  useEffect(()=>{if(state?.status==="finished")void archiveMatch(state)},[state]);
  useEffect(()=>{if(state?.status!=="live")return;const id=setInterval(()=>setElapsed(v=>v+1),1000);return()=>clearInterval(id)},[state?.status]);
  if(!state)return <main className="livePage"/>;
  const score=(team:Team)=>{setState(current=>{if(!current||current.status==="finished")return current;const active=current.status==="paused"?resumeMatch(current):current;setActionMessage(`Ponto contabilizado para ${active.teams[team]}.`);return applyPoint(active,team)})};
  const undo=()=>{setState(current=>{if(!current||current.history.length===0){setActionMessage("Ainda não há ponto para desfazer.");return current}setActionMessage("Último ponto desfeito.");return revertLastPoint(current)})};
  const set=state.sets[state.sets.length-1]!; const time=`${String(Math.floor(elapsed/60)).padStart(2,"0")}:${String(elapsed%60).padStart(2,"0")}`;
  return <main className="livePage"><header className="liveHeader"><Link href="/partida/nova"><ChevronLeft/> Sair</Link><div className="liveStatus"><i/> AO VIVO <span>·</span> SET {state.sets.length}</div><div><Wifi/> Online</div></header>
    {state.status==="finished"&&<div className="winnerBanner">PARTIDA ENCERRADA · {state.teams[state.winner!]} VENCEU</div>}
    <section className="liveBoard"><div className="liveMeta"><span>PARTIDA ATUAL</span><b>{time}</b><span>{state.rules.setsToWin * 2 - 1} SETS · {state.rules.gamesPerSet} GAMES</span></div>
      {(["A","B"] as Team[]).map((team,i)=><div className={`liveTeam ${state.server===team?"isServing":""}`} key={team}><div className="teamIdentity"><small>EQUIPE {team}</small><h2>{state.teams[team]}</h2><span>{state.server===team?"● SACANDO":"AGUARDANDO"}</span></div><div className="gameScore"><small>GAMES</small><strong>{team==="A"?set.gamesA:set.gamesB}</strong></div><button onClick={()=>score(team)} disabled={state.status!=="live"} className="pointScore" aria-label={`Ponto para ${state.teams[team]}`}><small>PONTOS</small><strong>{displayPoint(state,team)}</strong><span>+ PONTO</span></button></div>)}
    </section>
    <div className="liveControls"><button type="button" onClick={undo} disabled={state.history.length===0} title={state.history.length===0?"Registre um ponto antes de desfazer":"Desfazer o último ponto"}><RotateCcw/> Desfazer</button><button type="button" onClick={()=>setState(state.status==="paused"?resumeMatch(state):pauseMatch(state))} disabled={state.status==="finished"}><Pause/> {state.status==="paused"?"Retomar":"Pausar"}</button><button type="button" onClick={()=>setCameraOpen(true)}><Camera/> Câmera</button><button type="button" className="finishMatchButton" onClick={()=>setFinishOpen(true)} disabled={state.status==="finished"}><Flag/> Finalizar</button><div className="aiState"><ScanLine/> Câmera + código <b>SEM IA</b></div></div>
    {actionMessage&&<p className="liveActionMessage" role="status">{actionMessage}</p>}
    <p className="liveHint">Toque no placar de pontos da equipe para registrar. Cada ação é validada pelo motor de regras.</p>
    {cameraOpen&&<CameraPanel onClose={()=>setCameraOpen(false)} onPoint={score} onUndo={undo} onResume={()=>setState(current=>current?.status==="paused"?resumeMatch(current):current)} teams={state.teams} canScore={state.status!=="finished"} canUndo={state.history.length>0}/>}
    {finishOpen&&<div className="finishOverlay" role="dialog" aria-modal="true" aria-labelledby="finish-title"><div className="finishDialog"><button type="button" className="finishClose" onClick={()=>setFinishOpen(false)} aria-label="Cancelar"><X/></button><Flag/><small>FINALIZAR PARTIDA</small><h2 id="finish-title">Quem venceu?</h2><p>O resultado será salvo no histórico. Se necessário, você poderá desfazer a finalização.</p><div><button type="button" onClick={()=>{setState(finishMatch(state,"A"));setFinishOpen(false);setCameraOpen(false)}}>{state.teams.A}</button><button type="button" onClick={()=>{setState(finishMatch(state,"B"));setFinishOpen(false);setCameraOpen(false)}}>{state.teams.B}</button></div></div></div>}
  </main>
}
