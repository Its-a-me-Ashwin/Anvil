import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Box } from 'lucide-react';

interface StlViewerProps {
  data: ArrayBuffer | null;
  emptyLabel?: string;
}

export default function StlViewer({ data, emptyLabel }: StlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  // One-time scene/renderer/camera setup, torn down on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14161a);
    scene.add(new THREE.GridHelper(200, 20, 0x353a45, 0x22252c));
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight || 1, 0.1, 10000);
    camera.position.set(80, 60, 80);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(100, 150, 100);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-100, -50, -100);
    scene.add(fill);

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Swap the displayed mesh whenever new STL bytes arrive (initial load or
  // a hot-reload triggered by a backend re-export).
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;

    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      (meshRef.current.material as THREE.Material).dispose();
      meshRef.current = null;
    }

    if (!data) return;

    const geometry = new STLLoader().parse(data);
    geometry.computeVertexNormals();
    geometry.center();

    const material = new THREE.MeshStandardMaterial({ color: 0x4f8ef7, roughness: 0.45, metalness: 0.1 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2; // STL is Z-up; three.js is Y-up.
    scene.add(mesh);
    meshRef.current = mesh;

    geometry.computeBoundingSphere();
    const radius = geometry.boundingSphere?.radius || 50;
    const dist = radius * 2.8;
    camera.position.set(dist, dist * 0.75, dist);
    camera.near = Math.max(dist / 100, 0.1);
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  }, [data]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {!data && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-anvil-muted pointer-events-none">
          <Box className="w-8 h-8 mb-2" />
          <p className="text-xs">{emptyLabel || 'No model to preview yet'}</p>
        </div>
      )}
    </div>
  );
}
