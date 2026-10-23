"use client";

import { Camera, Check, Crosshair, MonitorUp, Play, RotateCcw, Settings2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Team } from "@setra/scoring-engine";
import { BallTracker, RallyEventAnalyzer, rgbToHsv, type CourtCalibration, type Detection, type HsvColor, type Point, type PointCandidate, type TrackerState } from "@/lib/vision/tracker-core";
import { adaptiveFrameInterval, preferredTransport, shouldCaptureFrame } from "@/lib/vision/pipeline";

type TeamScore = { points: string; games: number; sets: number };
type Props = { onClose: () => void; onPoint: (team: Team) => void; onUndo: () => void; onResume: () => void; teams: Record<Team, string>; scores: Record<Team, TeamScore>; canScore: boolean; canUndo: boolean };
type Source = "camera" | "screen" | "test-video";
type Step = "ball" | "corners" | "net" | "done";
type RuntimeState = "booting" | "ready" | "error";
type OpenCvState = "loading" | "ready" | "error";
type WorkerMessage =
  | { type: "status"; worker: "ready"; opencv: OpenCvState; offscreenCanvas: boolean; message?: string }
  | { type: "result"; frameId: number; candidates: Detection[]; candidateCount: number; processingMs: number; calibrated: boolean }
  | { type: "error"; frameId?: number; fatal?: boolean; message: string }
  | { type: "dropped"; frameId: number; reason: string }
  | { type: "pong"; at: number };

export function CameraPanel({ onClose, onPoint, onUndo, onResume, teams, scores, canScore, canUndo }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null), canvasRef = useRef<HTMLCanvasElement>(null), streamRef = useRef<MediaStream | null>(null), workerRef = useRef<Worker | null>(null);
  const trackerRef = useRef(new BallTracker()), analyzerRef = useRef(new RallyEventAnalyzer()), targetRef = useRef<HsvColor | null>(null), calibrationRef = useRef<CourtCalibration | null>(null);
  const pendingRef = useRef(false), pendingSinceRef = useRef(0), frameIdRef = useRef(0), lastFrameRef = useRef(0), rafRef = useRef(0), captureCounterRef = useRef(0), processCounterRef = useRef(0);
  const ballRef = useRef<Point | null>(null), sensitivityRef = useRef(.55), offscreenRef = useRef(false), stepRef = useRef<Step>("ball");

  const [source, setSource] = useState<Source>("camera"), [sourceError, setSourceError] = useState(""), [lastError, setLastError] = useState("Nenhum"), [notice, setNotice] = useState("O processamento inicia automaticamente; clique na bola para calibrar a cor.");
  const [step, setStep] = useState<Step>("ball"), [points, setPoints] = useState<Point[]>([]), [sensitivity, setSensitivity] = useState(.55), [videoReady, setVideoReady] = useState(false);
  const [ball, setBall] = useState<Point | null>(null), [trajectory, setTrajectory] = useState<Point[]>([]), [trackerState, setTrackerState] = useState<TrackerState>("SEARCHING"), [confidence, setConfidence] = useState(0), [speed, setSpeed] = useState(0);
  const [captureFps, setCaptureFps] = useState(0), [processingFps, setProcessingFps] = useState(0), [processingMs, setProcessingMs] = useState(0), [candidateCount, setCandidateCount] = useState(0), [proposal, setProposal] = useState<PointCandidate | null>(null);
  const [workerState, setWorkerState] = useState<RuntimeState>("booting"), [opencvState, setOpencvState] = useState<OpenCvState>("loading"), [transport, setTransport] = useState<"bitmap" | "pixels">("pixels");

  useEffect(() => { sensitivityRef.current = sensitivity; }, [sensitivity]);
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { ballRef.current = ball; }, [ball]);

  const reset = useCallback(() => {
    targetRef.current = null; calibrationRef.current = null; trackerRef.current.reset(); workerRef.current?.postMessage({ type: "reset" });
    setStep("ball"); setPoints([]); setBall(null); setTrajectory([]); setConfidence(0); setSpeed(0); setTrackerState("SEARCHING"); setProposal(null);
    setNotice("O diagnóstico continua ativo. Clique exatamente no centro da bola para calibrar a cor.");
  }, []);

  const attach = useCallback((stream: MediaStream, next: Source) => {
    streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = stream; setSource(next); setSourceError(""); setVideoReady(false); reset();
    const video = videoRef.current;
    if (video) { video.removeAttribute("src"); video.srcObject = stream; void video.play().catch(error => setLastError(`Reprodução: ${error instanceof Error ? error.message : String(error)}`)); }
    const track = stream.getVideoTracks()[0]; if (track) track.onended = () => { setVideoReady(false); setSourceError("A fonte de vídeo foi encerrada."); };
  }, [reset]);

  const startCamera = useCallback(async () => {
    try { attach(await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false }), "camera"); }
    catch (error) { setSourceError("Não foi possível acessar a câmera. Use HTTPS/localhost e verifique a permissão."); setLastError(error instanceof Error ? error.message : String(error)); }
  }, [attach]);
  const startScreen = useCallback(async () => {
    try { attach(await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30, max: 30 } }, audio: false }), "screen"); }
    catch (error) { setSourceError("O compartilhamento de tela foi cancelado ou bloqueado."); setLastError(error instanceof Error ? error.message : String(error)); }
  }, [attach]);
  const startTest = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; setSource("test-video"); setSourceError(""); setVideoReady(false); reset();
    const video = videoRef.current; if (video) { video.srcObject = null; video.src = "/api/test-video"; video.load(); void video.play().catch(error => setLastError(`Vídeo de teste: ${error instanceof Error ? error.message : String(error)}`)); }
  }, [reset]);

  useEffect(() => { void startCamera(); return () => { cancelAnimationFrame(rafRef.current); workerRef.current?.terminate(); streamRef.current?.getTracks().forEach(track => track.stop()); }; }, [startCamera]);

  useEffect(() => {
    let worker: Worker;
    try { worker = new Worker(new URL("../workers/vision.worker.ts", import.meta.url), { name: "setra-vision" }); }
    catch (error) { setWorkerState("error"); setOpencvState("error"); setLastError(`Criação do Worker: ${error instanceof Error ? error.message : String(error)}`); return; }
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;
      if (message.type === "status") { setWorkerState("ready"); setOpencvState(message.opencv); offscreenRef.current = message.offscreenCanvas; setTransport(preferredTransport(message.offscreenCanvas, typeof createImageBitmap === "function")); if (message.message) setNotice(message.message); if (message.opencv === "error") setLastError(message.message ?? "Falha ao carregar OpenCV.js"); return; }
      if (message.type === "pong") return;
      pendingRef.current = false;
      if (message.type === "error") { setLastError(`Worker: ${message.message}`); if (message.fatal) setWorkerState("error"); return; }
      if (message.type === "dropped") { setLastError(`Frame ${message.frameId} descartado: ${message.reason}`); return; }
      processCounterRef.current += 1; setProcessingMs(Math.round(message.processingMs)); setCandidateCount(message.candidateCount);
      if (!message.calibrated) return;
      const now = performance.now(), sample = trackerRef.current.update(message.candidates, now); setTrackerState(trackerRef.current.state);
      if (sample) { setBall(sample.position); setConfidence(sample.confidence); setSpeed(Math.round(sample.speed * (canvasRef.current?.width ?? 480))); setTrajectory(trackerRef.current.history.map(item => item.position)); }
      else if (trackerRef.current.state === "LOST") { setBall(null); setConfidence(0); const candidate = calibrationRef.current && analyzerRef.current.analyze(trackerRef.current.history, calibrationRef.current, now); if (candidate) setProposal(candidate); }
    };
    worker.onerror = event => { pendingRef.current = false; setWorkerState("error"); setOpencvState("error"); setLastError(`Worker: ${event.message || "erro de execução"}`); };
    worker.onmessageerror = () => { pendingRef.current = false; setLastError("Worker: falha ao desserializar mensagem."); };
    worker.postMessage({ type: "ping" });
    return () => { worker.terminate(); if (workerRef.current === worker) workerRef.current = null; };
  }, []);

  useEffect(() => {
    const metrics = window.setInterval(() => { setCaptureFps(captureCounterRef.current); setProcessingFps(processCounterRef.current); captureCounterRef.current = 0; processCounterRef.current = 0; }, 1000);
    return () => window.clearInterval(metrics);
  }, []);

  useEffect(() => {
    const loop = async (now: number) => {
      const video = videoRef.current, canvas = canvasRef.current, worker = workerRef.current;
      const interval = adaptiveFrameInterval(processingMs);
      if (pendingRef.current && now - pendingSinceRef.current > 2500) { pendingRef.current = false; setLastError("Timeout: o Worker não respondeu ao último frame em 2,5 s."); }
      if (video && canvas && worker && shouldCaptureFrame({ workerReady: workerState === "ready", openCvReady: opencvState === "ready", videoReady: video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0, pending: pendingRef.current, elapsedMs: now - lastFrameRef.current, intervalMs: interval })) {
        const ratio = video.videoWidth / video.videoHeight; canvas.width = 480; canvas.height = Math.max(180, Math.round(480 / ratio));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        try {
          if (!context) throw new Error("Canvas 2D indisponível no navegador.");
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frameId = ++frameIdRef.current, base = { type: "frame", frameId, capturedAt: performance.now(), width: canvas.width, height: canvas.height, sensitivity: sensitivityRef.current, target: targetRef.current ?? undefined, predicted: ballRef.current ?? undefined };
          pendingRef.current = true; pendingSinceRef.current = now; lastFrameRef.current = now; captureCounterRef.current += 1;
          if (offscreenRef.current && typeof createImageBitmap === "function") {
            try { const bitmap = await createImageBitmap(canvas); worker.postMessage({ ...base, bitmap }, [bitmap]); setTransport("bitmap"); }
            catch { const image = context.getImageData(0, 0, canvas.width, canvas.height); worker.postMessage({ ...base, pixels: image.data.buffer }, [image.data.buffer]); setTransport("pixels"); }
          } else { const image = context.getImageData(0, 0, canvas.width, canvas.height); worker.postMessage({ ...base, pixels: image.data.buffer }, [image.data.buffer]); setTransport("pixels"); }
        } catch (error) { pendingRef.current = false; setLastError(`Captura: ${error instanceof Error ? error.message : String(error)}`); }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop); return () => cancelAnimationFrame(rafRef.current);
  }, [opencvState, processingMs, workerState]);

  const calibrate = (event: React.MouseEvent<HTMLVideoElement>) => {
    const video = videoRef.current, canvas = canvasRef.current; if (!video || !canvas || video.readyState < 2) return;
    const bounds = video.getBoundingClientRect(), point = { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
    canvas.width = Math.max(320, video.videoWidth); canvas.height = Math.max(180, video.videoHeight); const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) return; context.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (stepRef.current === "ball") {
      const px = Math.round(point.x * canvas.width), py = Math.round(point.y * canvas.height), sample = context.getImageData(Math.max(0, Math.min(canvas.width - 7, px - 3)), Math.max(0, Math.min(canvas.height - 7, py - 3)), 7, 7).data, hsv: HsvColor[] = [];
      for (let index = 0; index < sample.length; index += 4) hsv.push(rgbToHsv(sample[index]!, sample[index + 1]!, sample[index + 2]!));
      hsv.sort((a, b) => b.s - a.s); const selected = hsv.slice(0, 20); targetRef.current = { h: selected.reduce((sum, item) => sum + item.h, 0) / selected.length, s: selected.reduce((sum, item) => sum + item.s, 0) / selected.length, v: selected.reduce((sum, item) => sum + item.v, 0) / selected.length };
      trackerRef.current.reset(point); setBall(point); setStep("corners"); setNotice("Cor calibrada e rastreamento ativo. Marque os cantos: próximo E, próximo D, distante D, distante E."); return;
    }
    if (stepRef.current === "corners") { const next = [...points, point]; setPoints(next); if (next.length === 4) { setStep("net"); setNotice("Marque as duas extremidades da rede."); } return; }
    if (stepRef.current === "net") { const next = [...points, point]; setPoints(next); if (next.length === 6) { calibrationRef.current = { corners: next.slice(0, 4) as CourtCalibration["corners"], net: next.slice(4, 6) as CourtCalibration["net"], frame: { width: video.videoWidth, height: video.videoHeight } }; setStep("done"); setNotice("Calibração completa. Eventos da quadra estão habilitados."); } }
  };

  const register = (team: Team) => { if (!canScore) { setNotice("Retome a partida antes de pontuar."); return; } onPoint(team); setProposal(null); setNotice(`Ponto confirmado para ${teams[team]}.`); };
  const label = { SEARCHING: "PROCURANDO", TRACKING: "RASTREANDO", OCCLUDED: "OCLUSÃO", LOST: "PERDIDA", RECOVERING: "RECUPERANDO" }[trackerState];
  const readyLabel = videoReady ? `${videoRef.current?.videoWidth ?? 0}×${videoRef.current?.videoHeight ?? 0}` : "aguardando vídeo";

  return <div className="cameraOverlay" role="dialog" aria-modal="true" aria-label="Rastreamento da bola"><div className="cameraPanel">
    <button className="cameraClose" onClick={onClose} aria-label="Fechar"><X /></button>
    <div className="videoSourceTabs"><button className={source === "camera" ? "active" : ""} onClick={() => void startCamera()}><Camera /> Câmera</button><button className={source === "screen" ? "active" : ""} onClick={() => void startScreen()}><MonitorUp /> Tela</button><button className={source === "test-video" ? "active" : ""} onClick={startTest}><Play /> Vídeo de teste</button></div>
    <div className="cameraViewport">{sourceError ? <div className="cameraError"><p>{sourceError}</p></div> : <video ref={videoRef} autoPlay playsInline muted controls={source === "test-video"} onLoadedData={() => setVideoReady(true)} onPlaying={() => setVideoReady(true)} onWaiting={() => setVideoReady(false)} onError={() => setLastError("A fonte de vídeo informou erro de reprodução.")} onClick={calibrate} />}
      <span>{label} · CAP {captureFps} FPS · PROC {processingFps} FPS</span>
      {points.slice(0, 4).map((point, index) => <i key={`c-${index}`} className="courtCalibrationPoint" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}>{index + 1}</i>)}
      {points.slice(4).map((point, index) => <i key={`n-${index}`} className="netCalibrationPoint" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}>R</i>)}
      {trajectory.length > 1 && <svg className="ballTrajectory" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={trajectory.map(point => `${point.x * 100},${point.y * 100}`).join(" ")} /></svg>}
      {ball && <i className="ballTracker" style={{ left: `${ball.x * 100}%`, top: `${ball.y * 100}%` }}><b>{confidence} · {speed}px/s</b></i>}<canvas ref={canvasRef} hidden />
    </div>
    <div className="visionDiagnostics" aria-label="Diagnóstico do rastreador"><span><small>VÍDEO</small><b>{readyLabel}</b></span><span><small>WORKER</small><b data-state={workerState}>{workerState}</b></span><span><small>OPENCV</small><b data-state={opencvState}>{opencvState}</b></span><span><small>TRANSPORTE</small><b>{transport}</b></span><span><small>CAPTURA</small><b>{captureFps} FPS</b></span><span><small>PROCESSAMENTO</small><b>{processingFps} FPS</b></span><span><small>TEMPO</small><b>{processingMs} ms</b></span><span><small>CANDIDATOS</small><b>{candidateCount}</b></span><span className="diagnosticError"><small>ÚLTIMO ERRO</small><b>{lastError}</b></span></div>
    <div className="trackingDashboard"><span><Crosshair /><b>{label}</b><small>Índice técnico {confidence}/100 — não é probabilidade</small></span><label><Settings2 /> Sensibilidade <input type="range" min="0" max="1" step=".05" value={sensitivity} onChange={event => setSensitivity(Number(event.target.value))} /></label><button onClick={reset}>Recalibrar</button></div>
    {proposal && <div className="pointProposal"><div><small>EVENTO CANDIDATO</small><strong>{proposal.reason}</strong></div>{proposal.suggestedTeam && <button className="confirmPoint" onClick={() => register(proposal.suggestedTeam!)}><Check /> Confirmar {teams[proposal.suggestedTeam]}</button>}<button onClick={() => register(proposal.suggestedTeam === "A" ? "B" : "A")}>Corrigir equipe</button><button onClick={() => setProposal(null)}>Descartar</button></div>}
    <div className="cameraScoreControls">{(["A", "B"] as Team[]).map((team, index) => <div className={`cameraTeamScore cameraTeamScore${team}`} key={team}><button onClick={() => register(team)} disabled={!canScore} aria-label={`Marcar ponto para ${teams[team]}`}><b>+ PONTO</b><span>{teams[team]}</span><strong aria-label={`${scores[team].points} pontos`}>{scores[team].points}</strong><small>{scores[team].games} GAMES · {scores[team].sets} SETS</small></button>{index === 0 && <button className="cameraUndo" onClick={onUndo} disabled={!canUndo}><RotateCcw /> Desfazer</button>}</div>)}</div>
    <p className="cameraNotice" role="status">{notice}</p>{!canScore && <button className="resumeFromCamera" onClick={onResume}><Play /> Retomar partida</button>}
  </div></div>;
}
