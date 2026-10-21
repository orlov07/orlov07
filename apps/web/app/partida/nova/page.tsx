"use client";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Camera, Check, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearActiveMatch } from "@/lib/local-match-store";

export default function NewMatch() {
  const router = useRouter();
  const [teamA,setA]=useState(""),[teamB,setB]=useState(""),[camera,setCamera]=useState(true);
  const start=()=>{void clearActiveMatch().finally(()=>{localStorage.setItem("setra-match",JSON.stringify({teamA:teamA.trim(),teamB:teamB.trim(),camera}));router.push("/partida/ao-vivo")})};
  return <main className="appPage"><header className="appHeader"><Link href="/" className="brand"><img src="/setra-logo.png" alt=""/><span>SETRA</span></Link><span>NOVA PARTIDA</span><span>1 / 3</span></header>
    <div className="formWrap"><Link href="/" className="back"><ArrowLeft/> Voltar</Link><div className="formIntro"><span className="kicker">CONFIGURAÇÃO RÁPIDA</span><h1>Quem entra<br/>em quadra?</h1><p>Você poderá ajustar as regras e o saque antes de começar.</p></div>
      <div className="matchForm"><label><span><b>Equipe A</b><small>Nome da dupla ou jogador</small></span><input value={teamA} onChange={e=>setA(e.target.value)} maxLength={36} placeholder="Digite o nome da equipe A" autoComplete="off"/></label><div className="versus">VS</div><label><span><b>Equipe B</b><small>Nome da dupla ou jogador</small></span><input value={teamB} onChange={e=>setB(e.target.value)} maxLength={36} placeholder="Digite o nome da equipe B" autoComplete="off"/></label>
        <div className="optionGrid"><button className="selected"><Users/><span><b>Duplas</b><small>2 × 2 jogadores</small></span><Check/></button><button onClick={()=>setCamera(!camera)} className={camera?"selected":""}><Camera/><span><b>Câmera</b><small>{camera?"Será configurada":"Modo manual"}</small></span>{camera&&<Check/>}</button></div>
        <button className="button startButton" disabled={!teamA.trim()||!teamB.trim()} onClick={start}>Continuar <ArrowRight/></button>
      </div>
    </div></main>;
}
