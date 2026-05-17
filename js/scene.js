/* ===================================================================
   Three.js Hero – metallisches Ikosaeder in Kupfer/Gold
   =================================================================== */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';

const canvas = document.getElementById('hero-canvas');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 6);

const geometry = new THREE.IcosahedronGeometry(1.6, 0);
const material = new THREE.MeshStandardMaterial({
  color: 0xBF853B,
  metalness: 0.95,
  roughness: 0.32,
  flatShading: true
});
const ikosaeder = new THREE.Mesh(geometry, material);
scene.add(ikosaeder);

const wireGeo = new THREE.IcosahedronGeometry(1.62, 0);
const wireMat = new THREE.MeshBasicMaterial({
  color: 0xC9A877,
  wireframe: true,
  transparent: true,
  opacity: 0.18
});
const wireOverlay = new THREE.Mesh(wireGeo, wireMat);
scene.add(wireOverlay);

const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.4);
keyLight.position.set(4, 5, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x6080a0, 0.6);
fillLight.position.set(-5, -2, 3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xBF853B, 0.8);
rimLight.position.set(-3, 3, -5);
scene.add(rimLight);

const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
if (!reducedMotion) {
  window.addEventListener('mousemove', (e) => {
    mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.targetY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
}

const clock = new THREE.Clock();
let running = true;

function animate() {
  if (!running) return;
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  if (!reducedMotion) {
    ikosaeder.rotation.y = t * 0.18;
    ikosaeder.rotation.x = Math.sin(t * 0.25) * 0.15;
    ikosaeder.position.y = Math.sin(t * 0.7) * 0.12;

    wireOverlay.rotation.copy(ikosaeder.rotation);
    wireOverlay.position.copy(ikosaeder.position);

    mouse.x += (mouse.targetX - mouse.x) * 0.04;
    mouse.y += (mouse.targetY - mouse.y) * 0.04;
    camera.position.x = mouse.x * 0.4;
    camera.position.y = -mouse.y * 0.3;
    camera.lookAt(0, 0, 0);
  } else {
    ikosaeder.rotation.set(0.4, 0.6, 0);
    wireOverlay.rotation.copy(ikosaeder.rotation);
  }

  renderer.render(scene, camera);
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false;
  } else if (!running) {
    running = true;
    clock.getDelta();
    animate();
  }
});

animate();
