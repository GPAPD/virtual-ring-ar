"use client";

import { useCallback, useRef, useState } from "react";

export default function CameraTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Idle");
  const [secure, setSecure] = useState<boolean>(typeof window !== "undefined" ? window.isSecureContext : false);
  const [error, setError] = useState<string>("");

  const start = useCallback(async () => {
    setStatus("Requesting camera...");
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "user" } },
        audio: false,
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStatus("Camera started");
    } catch (e) {
      const err = e as DOMException & { name?: string; message?: string };
      if (err.name === "NotAllowedError") {
        setError(
          window.isSecureContext
            ? "Permission denied. Please allow camera in Safari."
            : "Insecure context. Use HTTPS (your Cloudflare URL)."
        );
      } else if (err.name === "NotFoundError") {
        setError("No camera device found.");
      } else if (err.name === "NotReadableError") {
        setError("Camera in use by another app.");
      } else {
        setError(err.message || "Unknown error");
      }
      setStatus("Failed");
    }
  }, []);

  const stop = useCallback(() => {
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
    setStatus("Stopped");
  }, []);

  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1>Camera Test</h1>
      <p>Secure context: {String(secure)}</p>
      <p>Status: {status}</p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ width: "100%", maxWidth: 420, background: "#000" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={start}>Start</button>
        <button onClick={stop}>Stop</button>
      </div>
      <p>
        Tip: On iPhone/Safari, open your HTTPS Cloudflare URL directly in the
        address bar (not inside another app’s in-app browser).
      </p>
    </main>
  );
}
