import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Performance Monitor (opsional)
let stats = null;
let showStats = false;

// Cek apakah WebGL didukung
function checkWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext && 
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

// Tampilkan error jika WebGL tidak didukung
if (!checkWebGLSupport()) {
  document.body.innerHTML = `
    <div style="color: white; text-align: center; padding: 50px; font-family: Arial;">
      <h1>WebGL Tidak Didukung</h1>
      <p>Browser Anda tidak mendukung WebGL.</p>
      <p>Silakan gunakan browser modern seperti Chrome, Firefox, atau Edge.</p>
    </div>
  `;
  throw new Error('WebGL not supported');
}

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  1000
);
camera.position.z = 5;

// Renderer setup dengan optimasi
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ 
  canvas, 
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = false; // Nonaktifkan jika tidak perlu
renderer.outputColorSpace = THREE.SRGBColorSpace;

// OrbitControls untuk navigasi
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Efek momentum saat berhenti
controls.dampingFactor = 0.05; // Kekuatan damping
controls.enableZoom = true; // Zoom dengan scroll
controls.enablePan = true; // Geser dengan klik kanan
controls.minDistance = 2; // Jarak minimum zoom
controls.maxDistance = 20; // Jarak maksimum zoom

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// Loading Manager untuk progress indicator
const loadingManager = new THREE.LoadingManager();
const progressBar = document.getElementById('progress');
const loadingScreen = document.getElementById('loading');

// Event handler untuk loading manager
loadingManager.onProgress = (url, loaded, total) => {
  const progress = Math.round((loaded / total) * 100);
  progressBar.textContent = `${progress}%`;
};

loadingManager.onLoad = () => {
  loadingScreen.style.display = 'none';
  console.log('Semua assets berhasil dimuat!');
};

loadingManager.onError = (url) => {
  console.error(`Gagal memuat: ${url}`);
};

// Texture Loader
const textureLoader = new THREE.TextureLoader(loadingManager);

// Contoh texture dari URL (menggunakan placeholder textures)
// Dalam proyek nyata, ganti dengan texture Anda sendiri
const cubeTexture = textureLoader.load(
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/uv_grid_opengl.jpg',
  (texture) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
);

const sphereTexture = textureLoader.load(
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/land_ocean_ice_cloud_2048.jpg'
);

const torusTexture = textureLoader.load(
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/colors.png'
);

// Template 3D Objects
// 1. Cube dengan texture
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const cubeMaterial = new THREE.MeshStandardMaterial({ 
  map: cubeTexture,
  metalness: 0.3,
  roughness: 0.4
});
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.x = -2;
scene.add(cube);

// 2. Sphere dengan texture
const sphereGeometry = new THREE.SphereGeometry(0.7, 32, 32);
const sphereMaterial = new THREE.MeshStandardMaterial({ 
  map: sphereTexture,
  metalness: 0.5,
  roughness: 0.3
});
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
scene.add(sphere);

// 3. Torus dengan texture
const torusGeometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100);
const torusMaterial = new THREE.MeshStandardMaterial({ 
  map: torusTexture,
  metalness: 0.4,
  roughness: 0.5
});
const torus = new THREE.Mesh(torusGeometry, torusMaterial);
torus.position.x = 2;
scene.add(torus);

// Grid helper (opsional - untuk referensi)
const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
gridHelper.position.y = -2;
scene.add(gridHelper);

// Raycaster untuk deteksi klik
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Objek yang bisa diklik
const clickableObjects = [cube, sphere, torus];

// Fungsi untuk mendapatkan warna acak
function getRandomColor() {
  return Math.floor(Math.random() * 16777215);
}

// Fungsi untuk menangani klik pada objek
function onMouseClick(event) {
  // Hitung posisi mouse dalam normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Update raycaster dengan posisi mouse dan kamera
  raycaster.setFromCamera(mouse, camera);
  
  // Cek objek mana yang terkena ray
  const intersects = raycaster.intersectObjects(clickableObjects);
  
  if (intersects.length > 0) {
    const clickedObject = intersects[0].object;
    
    // Efek 1: Animasi skala (bounce)
    const originalScale = { ...clickedObject.scale };
    clickedObject.scale.set(1.3, 1.3, 1.3);
    
    // Kembalikan skala setelah 300ms
    setTimeout(() => {
      clickedObject.scale.copy(originalScale);
    }, 300);
    
    // Efek 2: Log ke console
    console.log(`Objek diklik: ${clickedObject.geometry.type}`);
    console.log(`Texture: ${clickedObject.material.map ? 'Ya' : 'Tidak'}`);
  }
}

// Event listener untuk klik
window.addEventListener('click', onMouseClick);

// Mobile touch support
let touchStartX = 0;
let touchStartY = 0;

window.addEventListener('touchstart', (event) => {
  if (event.touches.length === 1) {
    touchStartX = event.touches[0].clientX;
    touchStartY = event.touches[0].clientY;
  }
});

window.addEventListener('touchend', (event) => {
  if (event.changedTouches.length === 1) {
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    
    // Deteksi tap (bukan drag)
    const deltaX = Math.abs(touchEndX - touchStartX);
    const deltaY = Math.abs(touchEndY - touchStartY);
    
    if (deltaX < 10 && deltaY < 10) {
      // Simulasikan click
      const fakeEvent = {
        clientX: touchEndX,
        clientY: touchEndY
      };
      onMouseClick(fakeEvent);
    }
  }
});

// Animation loop
let lastTime = 0;
const targetFPS = 60;
const frameInterval = 1000 / targetFPS;

function animate(currentTime = 0) {
  requestAnimationFrame(animate);
  
  // Frame rate limiting untuk optimasi
  const deltaTime = currentTime - lastTime;
  
  if (deltaTime < frameInterval) {
    return;
  }
  
  lastTime = currentTime - (deltaTime % frameInterval);
  
  // Rotasi objek (dengan delta time untuk konsistensi)
  const rotationSpeed = deltaTime * 0.001;
  
  cube.rotation.x += 0.01 * rotationSpeed;
  cube.rotation.y += 0.01 * rotationSpeed;
  
  sphere.rotation.y += 0.005 * rotationSpeed;
  
  torus.rotation.x += 0.008 * rotationSpeed;
  torus.rotation.z += 0.008 * rotationSpeed;
  
  // Update controls
  controls.update();
  
  renderer.render(scene, camera);
}

// Handle resize dengan debounce
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Update pixel ratio untuk HiDPI displays
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }, 100);
});

// Cleanup resources saat page unload
window.addEventListener('beforeunload', () => {
  // Dispose geometries
  cubeGeometry.dispose();
  sphereGeometry.dispose();
  torusGeometry.dispose();
  
  // Dispose materials
  cubeMaterial.dispose();
  sphereMaterial.dispose();
  torusMaterial.dispose();
  
  // Dispose textures
  cubeTexture.dispose();
  sphereTexture.dispose();
  torusTexture.dispose();
  
  // Dispose renderer
  renderer.dispose();
  
  console.log('Resources cleaned up');
});

// Keyboard shortcuts
window.addEventListener('keydown', (event) => {
  // Toggle stats dengan tombol 'S'
  if (event.key === 's' || event.key === 'S') {
    showStats = !showStats;
    console.log(`Stats: ${showStats ? 'ON' : 'OFF'}`);
  }
  
  // Reset camera dengan tombol 'R'
  if (event.key === 'r' || event.key === 'R') {
    camera.position.z = 5;
    controls.reset();
    console.log('Camera reset');
  }
  
  // Toggle wireframe dengan tombol 'W'
  if (event.key === 'w' || event.key === 'W') {
    const wireframe = !cubeMaterial.wireframe;
    cubeMaterial.wireframe = wireframe;
    sphereMaterial.wireframe = wireframe;
    torusMaterial.wireframe = wireframe;
    console.log(`Wireframe: ${wireframe ? 'ON' : 'OFF'}`);
  }
});

// Start animation
animate();