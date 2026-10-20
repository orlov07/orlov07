"use client";

import { Camera, CircleStop, VideoOff, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function CameraPanel({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [status, setStatus] = useState<"requesting" | "ready" | "recording" | "error">("requesting");
  const [error, setError] = useState("");
  const [clipUrl, setClipUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(stream => { if (!active) { stream.getTracks().forEach(track => track.stop()); return; } streamRef.current = stream; if (videoRef.current) videoRef.current.srcObject = stream; setStatus("ready"); })
      .catch(() => { setError("Não foi possível acessar a câmera. Verifique a permissão e use HTTPS."); setStatus("error"); });
    return () => { active = false; streamRef.current?.getTracks().forEach(track => track.stop()); if (clipUrl) URL.revokeObjectURL(clipUrl); };
  }, []);

  const toggleRecording = () => {
    if (status === "recording") { recorderRef.current?.stop(); return; }
    const stream = streamRef.current;
    if (!stream || typeof MediaRecorder === "undefined") { setError("Gravação não é suportada neste navegador."); setStatus("error"); return; }
    chunksRef.current = [];
    const recorder = MediaRecorder.isTypeSupported("video/webm") ? new MediaRecorder(stream, { mimeType: "video/webm" }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => { const blob = new Blob(chunksRef.current, { type: recorder.mimeType }); setClipUrl(previous => { if (previous) URL.revokeObjectURL(previous); return URL.createObjectURL(blob); }); setStatus("ready"); };
    recorder.start(1000); setStatus("recording");
  };

  return <div className="cameraOverlay" role="dialog" aria-modal="true" aria-label="Câmera da partida"><div className="cameraPanel">
    <button className="cameraClose" onClick={onClose} aria-label="Fechar câmera"><X/></button>
    <div className="cameraViewport">{status !== "error" ? <video ref={videoRef} autoPlay playsInline muted/> : <div className="cameraError"><VideoOff/><p>{error}</p></div>}<span>{status === "recording" ? "● GRAVANDO CLIPE" : "CÂMERA DA QUADRA"}</span><div className="calibration"><i/><i/><i/><i/></div></div>
    <div className="cameraToolbar"><div><Camera/><span><b>{status === "requesting" ? "Solicitando permissão" : status === "error" ? "Indisponível" : "Câmera pronta"}</b><small>Os clipes permanecem apenas neste dispositivo nesta fase.</small></span></div>{status !== "error" && <button onClick={toggleRecording}>{status === "recording" ? <><CircleStop/> Parar e revisar</> : "Gravar clipe"}</button>}</div>
    {clipUrl && <div className="clipReview"><span>Último clipe</span><video src={clipUrl} controls playsInline/></div>}
  </div></div>;
}
