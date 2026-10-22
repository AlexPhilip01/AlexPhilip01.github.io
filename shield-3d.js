/* SHIELD interactive 3D hero — gracefully degrades if WebGL or the CDN is unavailable. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

(() => {
  const stage = document.getElementById('shield-3d-stage');
  const canvas = document.getElementById('shield-3d-canvas');
  if (!stage || !canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (error) {
    stage.classList.add('shield-3d-fallback');
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  camera.position.set(0, 0, 10.8);

  scene.add(new THREE.AmbientLight(0xffe7b0, 1.45));
  const key = new THREE.DirectionalLight(0xffd778, 4.2);
  key.position.set(-3.8, 5, 7);
  scene.add(key);
  const rim = new THREE.PointLight(0xffa51f, 38, 20, 2);
  rim.position.set(4, 1.5, 3);
  scene.add(rim);
  const coolFill = new THREE.PointLight(0xfff1d0, 18, 18, 2);
  coolFill.position.set(-4, -2, 2);
  scene.add(coolFill);

  const root = new THREE.Group();
  scene.add(root);
  const shield = new THREE.Group();
  root.add(shield);

  function shieldOutline(scale, Ctor) {
    const s = new Ctor();
    const S = scale;
    s.moveTo(-1.44 * S, 1.26 * S);
    s.quadraticCurveTo(-1.44 * S, 1.42 * S, -1.28 * S, 1.50 * S);
    s.lineTo(-0.16 * S, 1.98 * S);
    s.quadraticCurveTo(0, 2.05 * S, 0.16 * S, 1.98 * S);
    s.lineTo(1.28 * S, 1.50 * S);
    s.quadraticCurveTo(1.44 * S, 1.42 * S, 1.44 * S, 1.26 * S);
    s.lineTo(1.44 * S, -0.52 * S);
    s.quadraticCurveTo(1.44 * S, -0.70 * S, 1.32 * S, -0.86 * S);
    s.lineTo(0.14 * S, -2.26 * S);
    s.quadraticCurveTo(0, -2.40 * S, -0.14 * S, -2.26 * S);
    s.lineTo(-1.32 * S, -0.86 * S);
    s.quadraticCurveTo(-1.44 * S, -0.70 * S, -1.44 * S, -0.52 * S);
    s.closePath();
    return s;
  }

  const gold = new THREE.MeshStandardMaterial({
    color: 0xc9972d, metalness: 0.92, roughness: 0.23,
    emissive: 0x5a3508, emissiveIntensity: 0.2
  });
  const brightGold = new THREE.MeshStandardMaterial({
    color: 0xffd977, metalness: 0.84, roughness: 0.2,
    emissive: 0x6b410a, emissiveIntensity: 0.12
  });
  const darkGold = new THREE.MeshStandardMaterial({
    color: 0x16120a, metalness: 0.74, roughness: 0.31,
    emissive: 0x281b07, emissiveIntensity: 0.18
  });

  // Hollow shield: outer silhouette with a slightly smaller hole punched
  // through it, so the frame reads as a drawn stroke rather than a slab.
  const frameShape = shieldOutline(1, THREE.Shape);
  frameShape.holes.push(shieldOutline(0.855, THREE.Path));
  const frameGeometry = new THREE.ExtrudeGeometry(frameShape, {
    depth: 0.22, bevelEnabled: true, bevelSegments: 3,
    steps: 1, bevelSize: 0.035, bevelThickness: 0.045, curveSegments: 14
  });
  frameGeometry.center();
  const frame = new THREE.Mesh(frameGeometry, gold);
  shield.add(frame);

  // Fingerprint emblem: concentric gold ridges with a core curl.
  const fingerprint = new THREE.Group();
  fingerprint.position.set(-0.06, 0.30, 0.07);
  shield.add(fingerprint);

  // Each ridge is one continuous stroke: it arcs over the top, then both
  // ends run straight down to staggered depths, the way a print's ridges
  // leave the whorl. Legs get extra sample points so they stay straight
  // through the Catmull-Rom smoothing, and a sphere caps each tip.
  function archedRidge(rx, ry, yRight, yLeft, tube = 0.058, mat = brightGold) {
    const pts = [];
    const legSteps = 8;
    for (let i = legSteps; i >= 1; i--) {
      pts.push(new THREE.Vector3(rx, yRight * (i / legSteps), 0));
    }
    new THREE.EllipseCurve(0, 0, rx, ry, 0, Math.PI, false, 0)
      .getPoints(56)
      .forEach(pt => pts.push(new THREE.Vector3(pt.x, pt.y, 0)));
    for (let i = 1; i <= legSteps; i++) {
      pts.push(new THREE.Vector3(-rx, yLeft * (i / legSteps), 0));
    }

    fingerprint.add(new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 190, tube, 9, false),
      mat
    ));

    const cap = new THREE.SphereGeometry(tube, 12, 10);
    const capR = new THREE.Mesh(cap, mat);
    capR.position.set(rx, yRight, 0);
    fingerprint.add(capR);
    const capL = new THREE.Mesh(cap, mat);
    capL.position.set(-rx, yLeft, 0);
    fingerprint.add(capL);
  }

  archedRidge(0.98, 0.82, -1.08, -0.74, 0.060);
  archedRidge(0.74, 0.64, -0.46, -1.16, 0.056);
  archedRidge(0.53, 0.47, -1.02, -0.52, 0.052);
  archedRidge(0.33, 0.31, -0.58, -0.94, 0.048);
  archedRidge(0.15, 0.16, -0.80, -0.38, 0.044);

  // Fine orbit rings and a sparse perimeter of glowing telemetry points.
  const orbitMaterial = new THREE.MeshBasicMaterial({ color: 0xd4a83a, transparent: true, opacity: 0.34 });
  const orbitA = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.008, 6, 180), orbitMaterial);
  orbitA.rotation.set(1.12, 0.22, -0.25);
  root.add(orbitA);
  const orbitB = new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.006, 6, 180), new THREE.MeshBasicMaterial({
    color: 0xffd977, transparent: true, opacity: 0.2
  }));
  orbitB.rotation.set(0.35, 1.05, 0.48);
  root.add(orbitB);

  const points = new THREE.Group();
  root.add(points);
  const pointMaterial = new THREE.MeshBasicMaterial({ color: 0xffd977 });
  const pointCount = coarsePointer ? 22 : 38;
  for (let i = 0; i < pointCount; i++) {
    const t = (i / pointCount) * Math.PI * 2;
    const radius = 2.55 + Math.sin(i * 2.37) * 0.24;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(i % 5 === 0 ? 0.035 : 0.018, 8, 8), pointMaterial);
    dot.position.set(Math.cos(t) * radius, Math.sin(t) * radius * 1.28, Math.sin(t * 3) * 0.25);
    points.add(dot);
  }

  const particleGeometry = new THREE.BufferGeometry();
  const particleCount = coarsePointer ? 160 : 280;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 9;
    particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 8;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 1;
  }
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({
    color: 0xe5bd62, size: coarsePointer ? 0.018 : 0.024,
    transparent: true, opacity: 0.58, sizeAttenuation: true
  }));
  root.add(particles);

  let targetX = -0.08, targetY = -0.22, pointerDown = false, lastX = 0, lastY = 0;
  let scrollProgress = 0;
  const pointer = { x: 0, y: 0 };
  function setPointer(event) {
    const rect = stage.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    if (!pointerDown) {
      targetY = -0.22 + pointer.x * 0.2;
      targetX = -0.08 + pointer.y * 0.14;
    }
  }
  stage.addEventListener('pointermove', event => {
    setPointer(event);
    if (pointerDown) {
      targetY += (event.clientX - lastX) * 0.008;
      targetX += (event.clientY - lastY) * 0.006;
      lastX = event.clientX; lastY = event.clientY;
    }
  });
  stage.addEventListener('pointerdown', event => {
    pointerDown = true;
    lastX = event.clientX; lastY = event.clientY;
    stage.classList.add('is-dragging');
    if (stage.setPointerCapture) stage.setPointerCapture(event.pointerId);
  });
  function releasePointer() {
    pointerDown = false;
    stage.classList.remove('is-dragging');
  }
  stage.addEventListener('pointerup', releasePointer);
  stage.addEventListener('pointercancel', releasePointer);
  stage.addEventListener('pointerleave', () => { if (!pointerDown) { targetY = -0.22; targetX = -0.08; } });

  window.addEventListener('scroll', () => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    scrollProgress = window.scrollY / maxScroll;
  }, { passive: true });

  let width = 0, height = 0, raf = 0, visible = true;
  const resizeObserver = new ResizeObserver(() => {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 420 ? 12 : width < 600 ? 11.5 : 10.8;
    camera.updateProjectionMatrix();
  });
  resizeObserver.observe(stage);

  const visibilityObserver = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible && !raf) raf = requestAnimationFrame(animate);
  }, { threshold: 0.01 });
  visibilityObserver.observe(stage);

  function animate(time = 0) {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = time * 0.00035;
    if (!reduceMotion && !pointerDown) {
      targetY += Math.sin(t * 1.2) * 0.0006;
      targetX += Math.cos(t) * 0.00025;
    }
    shield.rotation.y += (targetY + scrollProgress * 0.22 - shield.rotation.y) * (reduceMotion ? 0.22 : 0.055);
    shield.rotation.x += (targetX + Math.sin(t * 0.7) * (reduceMotion ? 0 : 0.025) - shield.rotation.x) * 0.055;
    shield.rotation.z = Math.sin(t * 0.6) * (reduceMotion ? 0 : 0.025);
    orbitA.rotation.z += reduceMotion ? 0 : 0.0007;
    orbitB.rotation.x += reduceMotion ? 0 : 0.00045;
    points.rotation.z -= reduceMotion ? 0 : 0.00025;
    particles.rotation.y += reduceMotion ? 0 : 0.00012;
    renderer.render(scene, camera);
    if (!reduceMotion) raf = requestAnimationFrame(animate);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && visible && !raf) raf = requestAnimationFrame(animate);
  });
  if (reduceMotion) {
    const renderOnce = () => renderer.render(scene, camera);
    renderOnce();
    window.addEventListener('resize', renderOnce, { passive: true });
  } else {
    raf = requestAnimationFrame(animate);
  }
})();
