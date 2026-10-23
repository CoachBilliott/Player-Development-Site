import * as THREE from "three";

export interface FootballRenderer {
  setMotion: (enabled: boolean) => void;
  rotate: (direction: number) => void;
  dispose: () => void;
}

/** Procedural geometry and leather texture: no downloaded model, photo, or coaching media. */
export function createFootballRenderer(
  host: HTMLDivElement,
  initialMotion: boolean,
  onContextLost: () => void,
): FootballRenderer {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;
  const canvas = renderer.domElement;
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "Original interactive 3D football artwork. Use the rotate buttons to explore.",
  );
  host.appendChild(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  camera.position.set(0, 1, 5.8);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xd9eeff, 0x34241b, 2.2));
  const key = new THREE.DirectionalLight(0xffdfb6, 4.5);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x7cdaff, 5);
  rim.position.set(3, 2, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xc4fa5d, 0.65);
  fill.position.set(-4, -2, 1);
  scene.add(fill);

  // Repeatable pebbled leather, generated locally at a modest texture size.
  const textureCanvas = document.createElement("canvas");
  textureCanvas.width = textureCanvas.height = 512;
  const context = textureCanvas.getContext("2d")!;
  context.fillStyle = "#915035";
  context.fillRect(0, 0, 512, 512);
  let seed = 7201;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let y = -5; y < 520; y += 6) {
    for (let x = -5; x < 520; x += 6) {
      const px = x + random() * 3;
      const py = y + random() * 3;
      context.fillStyle = `rgba(35,14,7,${0.2 + random() * 0.3})`;
      context.beginPath();
      context.ellipse(px, py, 2.3, 1.8, random(), 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "rgba(236,165,112,.22)";
      context.beginPath();
      context.ellipse(px - 0.5, py - 0.6, 1.2, 0.7, 0, 0, Math.PI * 2);
      context.fill();
    }
  }
  const leather = new THREE.CanvasTexture(textureCanvas);
  leather.colorSpace = THREE.SRGBColorSpace;
  leather.wrapS = leather.wrapT = THREE.RepeatWrapping;
  leather.repeat.set(3, 2);
  leather.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshStandardMaterial({
    map: leather,
    bumpMap: leather,
    bumpScale: 0.045,
    roughness: 0.74,
    metalness: 0.04,
  });
  const shape = new THREE.SphereGeometry(1, 80, 48);
  const vertices = shape.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const y = vertices.getY(i);
    const radial = Math.pow(Math.max(0, 1 - y * y), 0.13);
    vertices.setXYZ(
      i,
      vertices.getX(i) * radial,
      y * 1.82,
      vertices.getZ(i) * radial,
    );
  }
  shape.rotateZ(Math.PI / 2);
  shape.computeVertexNormals();
  const ball = new THREE.Group();
  ball.add(new THREE.Mesh(shape, material));
  scene.add(ball);
  const seamMaterial = new THREE.MeshStandardMaterial({
    color: 0x331c13,
    roughness: 0.9,
  });
  const laceMaterial = new THREE.MeshStandardMaterial({
    color: 0xf1e4c9,
    roughness: 0.6,
  });
  const radiusAt = (x: number) =>
    Math.pow(Math.max(0, 1 - (x / 1.82) ** 2), 0.63);
  const tube = (
    points: THREE.Vector3[],
    thickness: number,
    mat: THREE.Material,
  ) => {
    const geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points),
      points.length * 2,
      thickness,
      6,
      false,
    );
    ball.add(new THREE.Mesh(geometry, mat));
  };
  // Four recessed-looking panel seams run from tip to tip.
  for (let panel = 0; panel < 4; panel++) {
    const angle = 0.35 + (panel * Math.PI) / 2;
    tube(
      Array.from({ length: 65 }, (_, i) => {
        const x = -1.81 + (i / 64) * 3.62;
        const r = radiusAt(x) + 0.004;
        return new THREE.Vector3(x, Math.sin(angle) * r, Math.cos(angle) * r);
      }),
      0.012,
      seamMaterial,
    );
  }
  // Raised, curved laces sit on the front upper panel.
  const laceAngle = 0.35;
  const surfacePoint = (x: number, angle: number, lift: number) => {
    const r = radiusAt(x) + lift;
    return new THREE.Vector3(x, Math.sin(angle) * r, Math.cos(angle) * r);
  };
  for (const offset of [-0.055, 0.055]) {
    tube(
      Array.from({ length: 20 }, (_, i) =>
        surfacePoint(-0.58 + (i / 19) * 1.16, laceAngle + offset, 0.03),
      ),
      0.025,
      laceMaterial,
    );
  }
  for (let i = 0; i < 8; i++) {
    const x = -0.49 + i * 0.14;
    tube(
      Array.from({ length: 9 }, (_, j) =>
        surfacePoint(x, laceAngle - 0.19 + (j / 8) * 0.38, 0.055),
      ),
      0.031,
      laceMaterial,
    );
  }
  // Original end stripes, following the actual curvature of the ball.
  for (const sign of [-1, 1]) {
    const points = Array.from({ length: 2 }, (_, i) => {
      const x = sign * (1.13 + i * 0.16);
      return new THREE.Vector2(radiusAt(x) + 0.007, x);
    });
    points.sort((a, b) => a.y - b.y);
    const stripe = new THREE.Mesh(
      new THREE.LatheGeometry(points, 80),
      laceMaterial,
    );
    stripe.rotation.z = -Math.PI / 2;
    ball.add(stripe);
  }

  let enabled = initialMotion;
  let visible = true;
  let disposed = false;
  let contextAvailable = true;
  let frame = 0;
  let lastTime = 0;
  let lastPaint = 0;
  let phase = 0;
  let rotation = 0;
  let target = 0;
  let dragging = false;
  let pointerX = 0;
  const render = (time: number) => {
    frame = 0;
    if (disposed || !contextAvailable) return;
    // This decorative scene needs only 30 rendered frames per second.
    if (enabled && time - lastPaint < 1000 / 30) {
      if (visible && !document.hidden) frame = requestAnimationFrame(render);
      return;
    }
    lastPaint = time;
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    if (enabled && visible && !document.hidden) phase += delta;
    rotation += (target - rotation) * 0.13;
    ball.rotation.set(
      -0.12 + rotation,
      -0.25 + (enabled ? Math.sin(phase * 0.38) * 0.16 : 0),
      -0.3,
    );
    ball.position.y = enabled ? Math.sin(phase * 0.8) * 0.08 : 0;
    renderer.render(scene, camera);
    if (
      visible &&
      !document.hidden &&
      (enabled || Math.abs(target - rotation) > 0.001)
    )
      frame = requestAnimationFrame(render);
  };
  const draw = () => {
    if (!disposed && contextAvailable && !frame) {
      lastTime = performance.now();
      frame = requestAnimationFrame(render);
    }
  };
  const resize = () => {
    if (disposed) return;
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(Math.max(1, width), Math.max(1, height));
    camera.aspect = Math.max(1, width) / Math.max(1, height);
    // Narrow phones retain the whole football, including both tips.
    camera.position.z = camera.aspect < 1.35 ? 6.2 : 5.8;
    camera.updateProjectionMatrix();
    draw();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
    if (visible) draw();
  });
  intersection.observe(host);
  const visibility = () => {
    if (document.hidden && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else draw();
  };
  const pointerDown = (event: PointerEvent) => {
    if (!enabled || event.pointerType !== "mouse") return;
    dragging = true;
    pointerX = event.clientX;
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = "grabbing";
  };
  const pointerMove = (event: PointerEvent) => {
    if (!dragging) return;
    target += (event.clientX - pointerX) * 0.012;
    pointerX = event.clientX;
    draw();
  };
  const pointerUp = () => {
    dragging = false;
    canvas.style.cursor = enabled ? "grab" : "default";
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    contextAvailable = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    onContextLost();
  };
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("webglcontextlost", contextLost);
  document.addEventListener("visibilitychange", visibility);
  canvas.style.cursor = enabled ? "grab" : "default";
  resize();
  return {
    setMotion(value) {
      enabled = value;
      dragging = false;
      if (!enabled) rotation = target;
      canvas.style.cursor = enabled ? "grab" : "default";
      draw();
    },
    rotate(direction) {
      target += (direction * Math.PI) / 4;
      host.dataset.view = String(Math.round((target * 180) / Math.PI));
      // An explicit button changes the view instantly when ambient motion is off.
      if (!enabled) rotation = target;
      draw();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("webglcontextlost", contextLost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) object.geometry.dispose();
      });
      leather.dispose();
      material.dispose();
      seamMaterial.dispose();
      laceMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
