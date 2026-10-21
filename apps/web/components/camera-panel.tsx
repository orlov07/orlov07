"use client";

import { Camera, Check, CircleStop, Crosshair, Download, MonitorUp, Play, RotateCcw, Video, VideoOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Team } from "@setra/scoring-engine";

type CameraPanelProps = {
  onClose: () => void;
  onPoint: (team: Team) => void;
  onUndo: () => void;
  onResume: () => void;
  teams: Record<Team, string>;
  canScore: boolean;
  canUndo: boolean;
};

type CameraStatus = "requesting" | "ready" | "recording" | "error";
type VideoSource = "camera" | "screen" | "test-video";

export function CameraPanel({ onClose, onPoint, onUndo, onResume, teams, canScore, canUndo }: CameraPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const clipUrlRef = useRef<string | null>(null);
  const targetColorRef = useRef<[number, number, number] | null>(null);
  const lastBallRef = useRef<{ x: number; y: number } | null>(null);
  const lastSeenRef = useRef(0);
  const autoArmedRef = useRef(false);
  const cooldownRef = useRef(0);
  const velocityRef = useRef({ x: 0, y: 0 });
  const stableFramesRef = useRef(0);
  const movingFramesRef = useRef(0);
  const [status, setStatus] = useState<CameraStatus>("requesting");
  const [error, setError] = useState("");
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [motion, setMotion] = useState(0);
  const [source, setSource] = useState<VideoSource>("camera");
  const [ball, setBall] = useState<{ x: number; y: number } | null>(null);
  const [calibrated, setCalibrated] = useState(false);
  const [detectionConfirmed, setDetectionConfirmed] = useState(false);
  const [autoScore, setAutoScore] = useState(true);
  const [confidence, setConfidence] = useState(0);
  const [pendingPoint, setPendingPoint] = useState<Team | null>(null);
  const [notice, setNotice] = useState("Use os botões ou as teclas A e B para confirmar o ponto.");

  const registerPoint = useCallback((team: Team) => {
    if (!canScore) { setNotice("Retome a partida para registrar pontos."); return; }
    onPoint(team);
    setNotice(`Ponto confirmado para ${teams[team]}.`);
  }, [canScore, onPoint, teams]);

  const undo = useCallback(() => {
    if (!canUndo) { setNotice("Ainda não há ponto para desfazer."); return; }
    onUndo();
    setNotice("Último ponto desfeito.");
  }, [canUndo, onUndo]);

  const attachStream = useCallback((stream: MediaStream, nextSource: VideoSource) => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = stream;
    previousFrameRef.current = null;
    movingFramesRef.current = 0;
    setMotion(0);
    setSource(nextSource);
    setError("");
    setStatus("ready");
    if (videoRef.current) { videoRef.current.removeAttribute("src"); videoRef.current.srcObject = stream; }
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) videoTrack.onended = () => {
      if (streamRef.current !== stream) return;
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setError(nextSource === "screen" ? "O compartilhamento de tela foi encerrado." : "A câmera foi desconectada.");
      setStatus("error");
      setMotion(0);
    };
  }, []);

  const startTestVideo = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    previousFrameRef.current = null;
    setMotion(0);
    setSource("test-video");
    setError("");
    setStatus("ready");
    setPendingPoint(null);
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
      video.src = "/api/test-video";
      video.load();
      void video.play().catch(() => setNotice("Pressione play para iniciar o vídeo da partida."));
    }
    setNotice("Vídeo da quadra carregado. Pause e clique sobre a bola para calibrar.");
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador não oferece acesso à câmera.");
      setStatus("error");
      return;
    }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      attachStream(stream, "camera");
      setNotice("Câmera ativa. Use A e B para confirmar os pontos.");
    } catch {
      setError("Não foi possível acessar a câmera. Verifique a permissão e use HTTPS ou localhost.");
      setStatus("error");
    }
  }, [attachStream]);

  const startScreen = useCallback(async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setError("O compartilhamento de tela não é suportado neste navegador.");
      setStatus("error");
      return;
    }
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: false });
      attachStream(stream, "screen");
      setNotice("Tela compartilhada. O vídeo é processado somente neste dispositivo.");
    } catch {
      setError("O compartilhamento foi cancelado ou bloqueado pelo navegador.");
      setStatus("error");
    }
  }, [attachStream]);

  useEffect(() => {
    void startCamera();
    return () => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
    };
  }, [startCamera]);

  useEffect(() => {
    if (status === "error") return;
    const interval = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const current = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const previous = previousFrameRef.current;
      if (previous) {
        let changed = 0;
        for (let index = 0; index < current.length; index += 16) {
          const difference = Math.abs(current[index]! - previous[index]!) + Math.abs(current[index + 1]! - previous[index + 1]!) + Math.abs(current[index + 2]! - previous[index + 2]!);
          if (difference > 75) changed += 1;
        }
        setMotion(Math.min(100, Math.round((changed / (current.length / 16)) * 240)));
      }
      const target = targetColorRef.current;
      if (!target) {
        previousFrameRef.current = new Uint8ClampedArray(current);
        setBall(null);
        setConfidence(0);
        return;
      }
      const previousBall = lastBallRef.current;
      const predicted = previousBall ? { x: previousBall.x + velocityRef.current.x, y: previousBall.y + velocityRef.current.y } : null;
      const mask = new Uint8Array(canvas.width * canvas.height);
      const roi = { left: .06, right: .94, top: .06, bottom: .90 };
      for (let y = 1; y < canvas.height - 1; y += 1) for (let x = 1; x < canvas.width - 1; x += 1) {
        const normalizedX = x / canvas.width; const normalizedY = y / canvas.height;
        if (normalizedX < roi.left || normalizedX > roi.right || normalizedY < roi.top || normalizedY > roi.bottom) continue;
        const pixel = (y * canvas.width + x) * 4;
        const red = current[pixel]!; const green = current[pixel + 1]!; const blue = current[pixel + 2]!;
        const colorMatch = Math.hypot(red - target[0], green - target[1], blue - target[2]) < 52;
        const frameDifference = previous ? Math.abs(red - previous[pixel]!) + Math.abs(green - previous[pixel + 1]!) + Math.abs(blue - previous[pixel + 2]!) : 0;
        const closeToPrediction = !predicted || Math.hypot(normalizedX - predicted.x, normalizedY - predicted.y) < .16;
        if (colorMatch && closeToPrediction && frameDifference > 28) mask[y * canvas.width + x] = 1;
      }
      previousFrameRef.current = new Uint8ClampedArray(current);

      const visited = new Uint8Array(mask.length);
      let candidate: { x: number; y: number; score: number } | null = null;
      for (let start = 0; start < mask.length; start += 1) {
        if (!mask[start] || visited[start]) continue;
        const queue = [start]; visited[start] = 1;
        let head = 0; let area = 0; let sumX = 0; let sumY = 0; let minX = canvas.width; let maxX = 0; let minY = canvas.height; let maxY = 0;
        while (head < queue.length && area <= 48) {
          const position = queue[head++]!; const x = position % canvas.width; const y = Math.floor(position / canvas.width);
          area += 1; sumX += x; sumY += y;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          for (const neighbor of [position - 1, position + 1, position - canvas.width, position + canvas.width]) {
            if (neighbor >= 0 && neighbor < mask.length && mask[neighbor] && !visited[neighbor]) { visited[neighbor] = 1; queue.push(neighbor); }
          }
        }
        if (area < 2 || area > 48) continue;
        const x = sumX / area / canvas.width; const y = sumY / area / canvas.height;
        const distance = predicted ? Math.hypot(x - predicted.x, y - predicted.y) : 0;
        const width = maxX - minX + 1; const height = maxY - minY + 1;
        const aspect = width / Math.max(1, height);
        if (aspect < .35 || aspect > 2.8 || width > 14 || height > 14) continue;
        const shapePenalty = Math.abs(width / Math.max(1, height) - 1) * 8;
        const score = -Math.abs(area - 6) * .7 - distance * 180 - shapePenalty;
        if (!candidate || score > candidate.score) candidate = { x, y, score };
      }
      const now = Date.now();
      if (candidate) {
        const nextBall = { x: candidate.x, y: candidate.y };
        const jump = previousBall ? Math.hypot(nextBall.x - previousBall.x, nextBall.y - previousBall.y) : 0;
        if (previousBall) velocityRef.current = { x: (nextBall.x - previousBall.x) * .65 + velocityRef.current.x * .35, y: (nextBall.y - previousBall.y) * .65 + velocityRef.current.y * .35 };
        stableFramesRef.current = jump < .14 ? stableFramesRef.current + 1 : 1;
        movingFramesRef.current = jump > .0025 && jump < .14 ? movingFramesRef.current + 1 : Math.max(0, movingFramesRef.current - 2);
        lastBallRef.current = nextBall;
        lastSeenRef.current = now;
        const nextConfidence = Math.min(96, movingFramesRef.current * 14 + stableFramesRef.current * 3);
        setConfidence(nextConfidence);
        if (movingFramesRef.current >= 4 && nextConfidence >= 64 && nextBall.x > .18 && nextBall.x < .82) autoArmedRef.current = true;
        setBall(nextBall);
      } else {
        const hadConfirmedMotion = movingFramesRef.current >= 4;
        if (now - lastSeenRef.current > 450) { setBall(null); setConfidence(0); }
        const lastBall = lastBallRef.current;
        if (detectionConfirmed && autoScore && canScore && autoArmedRef.current && hadConfirmedMotion && lastBall && now - lastSeenRef.current > 700 && now > cooldownRef.current) {
          if (lastBall.x <= .18) setPendingPoint("B");
          else if (lastBall.x >= .82) setPendingPoint("A");
          else return;
          setNotice("Fim de jogada detectado. Confirme a equipe antes de atualizar o placar.");
          autoArmedRef.current = false;
          stableFramesRef.current = 0;
          cooldownRef.current = now + 2500;
        }
        if (now - lastSeenRef.current > 900) movingFramesRef.current = 0;
      }
    }, 140);
    return () => window.clearInterval(interval);
  }, [autoScore, canScore, detectionConfirmed, registerPoint, status]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key.toLowerCase() === "a") registerPoint("A");
      if (event.key.toLowerCase() === "b") registerPoint("B");
      if (event.key.toLowerCase() === "u") undo();
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, registerPoint, undo]);

  const toggleRecording = () => {
    if (status === "recording") { recorderRef.current?.stop(); return; }
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") {
      setError("A gravação não é suportada neste navegador.");
      setStatus("error");
      return;
    }
    chunksRef.current = [];
    const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(type => MediaRecorder.isTypeSupported(type));
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      const nextUrl = URL.createObjectURL(blob);
      if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current);
      clipUrlRef.current = nextUrl;
      setClipUrl(nextUrl);
      setStatus("ready");
      setNotice("Clipe pronto para replay ou download.");
    };
    recorder.start(1000);
    setStatus("recording");
    setNotice("Gravando o lance. Pare para revisar.");
  };

  const calibrateBall = (event: React.MouseEvent<HTMLVideoElement>) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const bounds = video.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((event.clientX - bounds.left) / bounds.width * canvas.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((event.clientY - bounds.top) / bounds.height * canvas.height)));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const sample = context.getImageData(Math.max(0, x - 2), Math.max(0, y - 2), Math.min(5, canvas.width - Math.max(0, x - 2)), Math.min(5, canvas.height - Math.max(0, y - 2))).data;
    const colors: [number, number, number][] = [];
    for (let index = 0; index < sample.length; index += 4) colors.push([sample[index]!, sample[index + 1]!, sample[index + 2]!]);
    colors.sort((a, b) => (b[0] + b[1] - b[2]) - (a[0] + a[1] - a[2]));
    const selected = colors.slice(0, Math.max(1, Math.ceil(colors.length / 3)));
    targetColorRef.current = [Math.round(selected.reduce((sum, item) => sum + item[0], 0) / selected.length), Math.round(selected.reduce((sum, item) => sum + item[1], 0) / selected.length), Math.round(selected.reduce((sum, item) => sum + item[2], 0) / selected.length)];
    lastBallRef.current = { x: x / canvas.width, y: y / canvas.height };
    lastSeenRef.current = Date.now();
    autoArmedRef.current = false;
    velocityRef.current = { x: 0, y: 0 };
    stableFramesRef.current = 0;
    movingFramesRef.current = 0;
    setCalibrated(true);
    setDetectionConfirmed(false);
    setNotice("Bola marcada. Aguarde o círculo acompanhar o movimento e confirme a detecção.");
  };

  const confirmDetection = () => {
    if (!ball || confidence < 64) {
      setNotice("Aguarde o marcador estabilizar sobre a bola antes de confirmar.");
      return;
    }
    setDetectionConfirmed(true);
    setNotice("Detecção da bola confirmada. A pontuação automática está liberada.");
  };

  const confirmPendingPoint = (team: Team) => {
    registerPoint(team);
    setPendingPoint(null);
  };

  const resetCalibration = () => {
    targetColorRef.current = null;
    lastBallRef.current = null;
    velocityRef.current = { x: 0, y: 0 };
    stableFramesRef.current = 0;
    movingFramesRef.current = 0;
    autoArmedRef.current = false;
    setBall(null); setConfidence(0); setCalibrated(false); setDetectionConfirmed(false);
    setNotice("Pause o vídeo e clique exatamente sobre a bola.");
  };

  return <div className="cameraOverlay" role="dialog" aria-modal="true" aria-label="Controle da partida pela câmera"><div className="cameraPanel">
    <button type="button" className="cameraClose" onClick={onClose} aria-label="Fechar câmera"><X/></button>
    <div className="videoSourceTabs" aria-label="Fonte de vídeo">
      <button type="button" className={source === "camera" && status !== "error" ? "active" : ""} onClick={() => void startCamera()} disabled={status === "recording"}><Camera/> Câmera</button>
      <button type="button" className={source === "screen" && status !== "error" ? "active" : ""} onClick={() => void startScreen()} disabled={status === "recording"}><MonitorUp/> Compartilhar tela</button>
      <button type="button" className={source === "test-video" && status !== "error" ? "active" : ""} onClick={startTestVideo} disabled={status === "recording"}><Play/> Vídeo de teste</button>
    </div>
    <div className="cameraViewport">
      {status !== "error" ? <video ref={videoRef} autoPlay playsInline muted controls={source === "test-video"} onClick={source === "test-video" ? undefined : calibrateBall} onDoubleClick={source === "test-video" ? calibrateBall : undefined} title={source === "test-video" ? "Pause o vídeo e dê dois cliques sobre a bola" : "Clique sobre a bola para calibrar"}/> : <div className="cameraError"><VideoOff/><p>{error}</p></div>}
      <span>{status === "recording" ? "● GRAVANDO LANCE" : source === "screen" ? "TELA COMPARTILHADA" : source === "test-video" ? "PARTIDA DE TESTE" : "CÂMERA DA QUADRA"}</span>
      <div className="calibration" aria-hidden="true"><i/><i/><i/><i/></div>
      <div className="motionMeter"><span>Movimento</span><i style={{ width: `${motion}%` }}/><b>{motion}%</b></div>
      {ball && <i className="ballTracker" style={{ left: `${ball.x * 100}%`, top: `${ball.y * 100}%` }} aria-label="Bola rastreada"><b>{confidence}%</b></i>}
      <canvas ref={canvasRef} width="320" height="180" hidden/>
    </div>
    <div className="cameraToolbar"><div>{source === "screen" ? <MonitorUp/> : source === "test-video" ? <Play/> : <Camera/>}<span><b>{status === "requesting" ? "Solicitando permissão" : status === "error" ? "Fonte indisponível" : source === "screen" ? "Teste por compartilhamento de tela" : source === "test-video" ? "Partida gravada da quadra" : "Visão computacional local"}</b><small>O vídeo é analisado neste dispositivo; confirme cada ponto detectado antes de alterar o placar.</small></span></div>{status !== "error" && source !== "test-video" && <button type="button" onClick={toggleRecording}>{status === "recording" ? <><CircleStop/> Parar e revisar</> : <><Video/> Gravar lance</>}</button>}</div>
    <div className={`trackingControls ${detectionConfirmed ? "isConfirmed" : ""}`}><span><Crosshair/> {calibrated ? ball ? detectionConfirmed ? `Bola confirmada · confiança ${confidence}%` : `Possível bola · confiança ${confidence}%` : "Procurando a bola marcada" : "Pause e clique exatamente sobre a bola"}</span><div className="detectionActions">{calibrated && ball && !detectionConfirmed && <button type="button" className="confirmDetection" onClick={confirmDetection} disabled={confidence < 64}><Check/> Confirmar bola</button>}{calibrated && <button type="button" onClick={resetCalibration}>{detectionConfirmed ? "Marcar outra vez" : "Não é a bola"}</button>}</div><label><input type="checkbox" checked={autoScore} onChange={event => setAutoScore(event.target.checked)} disabled={!detectionConfirmed}/> Pontuação automática</label></div>
    {pendingPoint && <div className="pointProposal" role="alert"><div><small>FIM DE JOGADA DETECTADO</small><strong>Ponto para {teams[pendingPoint]}?</strong></div><button type="button" className="confirmPoint" onClick={() => confirmPendingPoint(pendingPoint)}><Check/> Confirmar ponto</button><button type="button" onClick={() => confirmPendingPoint(pendingPoint === "A" ? "B" : "A")}>Ponto da outra equipe</button><button type="button" onClick={() => setPendingPoint(null)}>Ignorar</button></div>}
    {!canScore && <button type="button" className="resumeFromCamera" onClick={onResume}><Play/> Retomar partida para contabilizar pontos</button>}
    <div className="cameraScoreControls" aria-label="Registrar pontuação">
      <button type="button" onClick={() => registerPoint("A")} disabled={!canScore}><small>TECLA A</small><b>+ Ponto</b><span>{teams.A}</span></button>
      <button type="button" className="cameraUndo" onClick={undo} disabled={!canUndo}><RotateCcw/><span>Desfazer</span><small>TECLA U</small></button>
      <button type="button" onClick={() => registerPoint("B")} disabled={!canScore}><small>TECLA B</small><b>+ Ponto</b><span>{teams.B}</span></button>
    </div>
    <p className="cameraNotice" role="status">{notice}</p>
    {clipUrl && <div className="clipReview"><div><span>Último lance gravado</span><a href={clipUrl} download={`setra-lance-${Date.now()}.webm`}><Download/> Baixar clipe</a></div><video src={clipUrl} controls playsInline/></div>}
  </div></div>;
}
