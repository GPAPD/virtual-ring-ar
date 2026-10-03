
"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";

export default function RingTryOn() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("Camera is off");
  const [ringScale, setRingScale] = useState(1);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");

  const activeRef = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let handTracker: HandLandmarker | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let animationId = 0;
    let lastVideoTime = -1;

    let ring: THREE.Group | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.OrthographicCamera | null = null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    async function listVideoDevices() {
      try {
        
        const all = await navigator.mediaDevices.enumerateDevices();
        const cams = all.filter((d) => d.kind === "videoinput");
        alert(`Found ${cams.length} camera(s)`);
        setDevices(cams);

      } catch {
        // ignore; some browsers restrict before permission
      }
    }

    async function acquireStream(selectedId?: string) {
      const primary: MediaStreamConstraints = {
        audio: false,
        video: selectedId
          ? { deviceId: { exact: selectedId } }
          : {
              facingMode: { ideal: "user" },
              width: { ideal: 720 },
              height: { ideal: 960 },
            },
      };

      try {
        return await navigator.mediaDevices.getUserMedia(primary);
      } catch (e) {
        const err = e as DOMException & { name?: string };
        if (err.name === "OverconstrainedError" || err.name === "NotFoundError") {
          // Fallback to any available camera
          return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        }
        throw e;
      }
    }

    async function start() {
      try {
        setStatus("Requesting camera access...");

        await listVideoDevices();

        stream = await acquireStream(deviceId || undefined);

        video!.srcObject = stream;
        await video!.play();

        setStatus("Loading hand tracking...");

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        handTracker = await HandLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: "/hand_landmarker.task",
            },
            runningMode: "VIDEO",
            numHands: 1,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          }
        );

        const width = video!.videoWidth || 720;
        const height = video!.videoHeight || 960;

        scene = new THREE.Scene();

        camera = new THREE.OrthographicCamera(
          0, width, 0, height, 0.1, 1000
        );
        camera.position.z = 100;

        renderer = new THREE.WebGLRenderer({
          canvas: canvas!,
          alpha: true,
          antialias: true,
        });

        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        scene.add(new THREE.AmbientLight(0xffffff, 2));

        const light = new THREE.DirectionalLight(0xffffff, 2);
        light.position.set(-100, -100, 200);
        scene.add(light);

        setStatus("Loading ring model...");

        const gltf = await new GLTFLoader().loadAsync(
          "/model/ring.glb"
        );

        ring = gltf.scene;

        // Adjust these values to match your model's units
        // and the orientation in which it was exported.
        ring.scale.setScalar(0.01);

        scene.add(ring);
        activeRef.current = true;
        setActive(true);
        setStatus("Show your hand to the camera");

        function render() {
          if (!activeRef.current) return;

          if (
            video!.readyState >= 2 &&
            video!.currentTime !== lastVideoTime
          ) {
            lastVideoTime = video!.currentTime;

            const result = handTracker!.detectForVideo(
              video!,
              performance.now()
            );

            const landmarks = result.landmarks[0];

            if (landmarks && ring) {
              // MediaPipe ring-finger landmarks:
              // 13 = MCP/base, 14 = PIP, 15 = DIP, 16 = tip.
              const base = landmarks[13];
              const next = landmarks[14];
              const middle = landmarks[15];

              // Place near the base of the ring finger.
              const t = 0.18;
              const x = base.x + (next.x - base.x) * t;
              const y = base.y + (next.y - base.y) * t;

              // Convert normalized landmarks to video pixels.
              ring.position.set(x * width, y * height, 0);

              // Estimate the finger's screen-space direction.
              const dx = middle.x - base.x;
              const dy = middle.y - base.y;

              // A starting approximation only; model orientation
              // and perspective will need device testing.
              ring.rotation.set(
                0,
                0,
                Math.atan2(dy, dx) + Math.PI / 2
              );

              // Scale relative to the apparent finger width.
              const fingerWidth = Math.hypot(
                (next.x - base.x) * width,
                (next.y - base.y) * height
              );

              const targetScale = fingerWidth * 0.08 * ringScale;
              ring.scale.setScalar(
                THREE.MathUtils.clamp(targetScale, 0.002, 0.08)
              );

              setStatus("Hand detected");
            } else {
              setStatus("Show your hand to the camera");
            }
          }

          if (renderer && scene && camera) {
            renderer.render(scene, camera);
          }

          animationId = requestAnimationFrame(render);
        }

        render();
      } catch (error) {
        console.error("Ring try-on error:", error);
        if (error && typeof error === "object") {
          const err = error as DOMException & { name?: string; message?: string };
          if (err.name === "NotAllowedError") {
            setStatus(
              window.isSecureContext
                ? "Camera permission denied. Please allow access in the browser."
                : "Camera blocked on insecure origin. Use https or localhost."
            );
          } else if (err.name === "NotFoundError") {
            setStatus("No camera device found.");
          } else if (err.name === "NotReadableError") {
            setStatus("Camera is busy or not readable (used by another app).");
          } else {
            setStatus(err.message || "Unable to start the try-on");
          }
        } else {
          setStatus("Unable to start the try-on");
        }
        stop();
      }
    }

    function stop() {
      activeRef.current = false;
      cancelAnimationFrame(animationId);

      handTracker?.close();
      handTracker = null;

      stream?.getTracks().forEach((track) => track.stop());
      stream = null;

      renderer?.dispose();
      renderer = null;

      video!.srcObject = null;
      setActive(false);
    }

    if (active) {
      start();
    }

    return () => {
      stop();
    };
  }, [active, ringScale, deviceId]);

  return (
    <section className="try-on">
      <div className="camera-frame">
        <video
          ref={videoRef}
          className="camera-video"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="ring-canvas"
        />
        {!active && (
          <div className="camera-placeholder">
            <p>Enable your camera to try on a ring</p>
          </div>
        )}
      </div>

      <p className="try-on-status" aria-live="polite">
        {status}
      </p>

      <label className="scale-control">
        Ring size adjustment
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.05"
          value={ringScale}
          onChange={(e) => setRingScale(Number(e.target.value))}
        />
      </label>

      {devices.length > 0 && (
        <label className="camera-select">
          Camera
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          >
            <option value="">Auto (front/any)</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${d.deviceId.slice(-4)}`}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        className="camera-button"
        onClick={() => setActive((value) => !value)}
      >
        {active ? "Stop camera" : "Start virtual try-on"}
      </button>
    </section>
  );
}