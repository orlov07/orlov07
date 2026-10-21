import Link from "next/link";
import { ArrowRight, Camera, Check, Radio, ShieldCheck, Sparkles, WifiOff } from "lucide-react";

const features = [
  { icon: Camera, title: "A quadra vira dado", text: "Use a câmera do celular para capturar lances e revisar momentos importantes." },
  { icon: Sparkles, title: "IA que sugere", text: "Eventos candidatos aparecem como hipóteses. Você mantém a palavra final sobre o placar." },
  { icon: Radio, title: "Placar sincronizado", text: "Uma visão clara para atletas, operação e telas externas durante toda a partida." },
];

export default function Home() {
  return <main>
    <nav className="nav shell">
      <Link href="/" className="brand"><img src="/setra-logo.png" alt="" /><span>SETRA</span></Link>
      <div className="navLinks"><a href="#como-funciona">Como funciona</a><a href="#recursos">Recursos</a></div>
      <Link href="/login" className="button buttonSmall">Entrar <ArrowRight size={16} /></Link>
    </nav>

    <section className="hero shell">
      <div className="heroCopy">
        <div className="eyebrow"><span className="pulse" /> PLACAR INTELIGENTE PARA BEACH TENNIS</div>
        <h1>Cada ponto.<br/><em>Sob controle.</em></h1>
        <p className="lead">Pontuação confiável, câmera integrada e inteligência assistiva — para você jogar mais e discutir menos.</p>
        <div className="heroActions"><Link href="/partida/nova" className="button">Iniciar partida <ArrowRight size={19} /></Link><a href="#como-funciona" className="textLink">Ver como funciona <span>↓</span></a></div>
        <div className="trust"><span><Check size={15}/> Funciona sem conta</span><span><WifiOff size={15}/> Pontuação offline</span><span><ShieldCheck size={15}/> Você confirma cada ponto</span></div>
      </div>
      <div className="scoreStage" aria-label="Visão geral do placar SETRA">
        <div className="courtLines" />
        <div className="scoreCard">
          <div className="emptyScoreState"><Radio/><span>Pronto para entrar em quadra?</span><p>Crie uma partida e o placar será atualizado em tempo real.</p><Link href="/partida/nova">Criar partida <ArrowRight size={16}/></Link></div>
        </div>
      </div>
    </section>

    <section className="strip"><div className="shell stripInner"><span>UM NOVO JEITO DE VIVER A PARTIDA</span><i/><span>RÁPIDO</span><i/><span>CONFIÁVEL</span><i/><span>FEITO PARA A QUADRA</span></div></section>

    <section id="como-funciona" className="section shell">
      <div className="sectionHead"><div><span className="kicker">SIMPLES POR DESIGN</span><h2>Três passos.<br/>Um placar confiável.</h2></div><p>O SETRA combina automação e decisão humana. A tecnologia ajuda; você comanda.</p></div>
      <div className="steps">
        {features.map(({icon: Icon,title,text}, i)=><article key={title}><span className="number">0{i+1}</span><Icon size={27}/><h3>{title}</h3><p>{text}</p></article>)}
      </div>
    </section>

    <section id="recursos" className="controlSection"><div className="shell controlGrid">
      <div className="controlCopy"><span className="kicker">HUMANO NO COMANDO</span><h2>Inteligência que<br/>não toma partido.</h2><p>A IA do SETRA nunca altera o resultado sozinha. Ela analisa, sugere e aguarda a confirmação de uma pessoa autorizada.</p><ul><li><Check/> Sugestões com nível de confiança</li><li><Check/> Correção e desfazer a qualquer momento</li><li><Check/> Histórico auditável de cada evento</li></ul></div>
      <div className="confirmCard"><div className="cameraMock"><div className="net"/><span>VISÃO DA QUADRA</span></div><div className="suggestion emptySuggestion"><Sparkles/><h3>Análise assistiva</h3><p>Quando a câmera estiver ativa, sugestões de eventos aparecerão aqui para sua confirmação.</p><small>Nenhuma análise em andamento</small></div></div>
    </div></section>

    <section className="finalCta shell"><span className="kicker">PRONTO PARA O PRIMEIRO SAQUE?</span><h2>Seu jogo merece<br/>um placar à altura.</h2><Link href="/partida/nova" className="button">Criar partida grátis <ArrowRight size={19}/></Link></section>
    <footer className="footer shell"><Link href="/" className="brand"><img src="/setra-logo.png" alt=""/><span>SETRA</span></Link><p>Inteligência em cada ponto.</p><small>© 2026 SETRA</small></footer>
  </main>;
}
