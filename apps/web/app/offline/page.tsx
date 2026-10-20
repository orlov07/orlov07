import Link from "next/link";
import { WifiOff } from "lucide-react";

export default function OfflinePage(){return <main className="offlinePage"><img src="/setra-logo.png" alt="SETRA"/><WifiOff/><h1>Você está offline.</h1><p>A partida ativa continua salva neste dispositivo. Reconecte para sincronizar serviços remotos.</p><Link className="button" href="/partida/ao-vivo">Voltar ao placar</Link></main>}
