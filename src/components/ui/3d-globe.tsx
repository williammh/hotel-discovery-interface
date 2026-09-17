"use client"
import React, { useRef, useMemo, useState, useCallback, Suspense } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Html, useTexture } from "@react-three/drei"
import * as THREE from "three"
import { cn } from "@/lib/utils"

export interface GlobeMarker {
  lat: number
  lng: number
  src: string
  label?: string
}

export interface Globe3DConfig {
  radius?: number
  textureUrl?: string
  bumpMapUrl?: string
  showAtmosphere?: boolean
  atmosphereColor?: string
  atmosphereIntensity?: number
  /** Higher = more diffuse */
  atmosphereBlur?: number
  /** Terrain bump scale (0 = flat, higher = more pronounced) */
  bumpScale?: number
  /** Auto rotate speed (0 = disabled) */
  autoRotateSpeed?: number
  enableZoom?: boolean
  enablePan?: boolean
  minDistance?: number
  maxDistance?: number
  showWireframe?: boolean
  wireframeColor?: string
  ambientIntensity?: number
  pointLightIntensity?: number
  /** Background color (null for transparent) */
  backgroundColor?: string | null
}

interface Globe3DProps {
  markers?: GlobeMarker[]
  config?: Globe3DConfig
  className?: string
  onMarkerClick?: (marker: GlobeMarker) => void
  onMarkerHover?: (marker: GlobeMarker | null) => void
  /**
   * The GPU took the context away — the driver reset, the tab was backgrounded
   * too long, or the browser hit its per-page context cap. Nothing renders from
   * here on, so the caller is expected to show something else.
   */
  onContextLost?: (event: WebGLContextEvent) => void
}

const DEFAULT_EARTH_TEXTURE =
  "https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg"
const DEFAULT_BUMP_TEXTURE =
  "https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png"

function latLngToVector3(
  lat: number,
  lng: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)

  const x = -(radius * Math.sin(phi) * Math.cos(theta))
  const z = radius * Math.sin(phi) * Math.sin(theta)
  const y = radius * Math.cos(phi)

  return new THREE.Vector3(x, y, z)
}

interface MarkerProps {
  marker: GlobeMarker
  radius: number
  onClick?: (marker: GlobeMarker) => void
  onHover?: (marker: GlobeMarker | null) => void
}

function Marker({ marker, radius, onClick, onHover }: MarkerProps) {
  const [hovered, setHovered] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const groupRef = useRef<THREE.Group>(null)
  const imageGroupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()

  const surfacePosition = useMemo(() => {
    return latLngToVector3(marker.lat, marker.lng, radius * 1.001)
  }, [marker.lat, marker.lng, radius])

  // Far enough out that the pin head never clips into the globe
  const topPosition = useMemo(() => {
    return latLngToVector3(marker.lat, marker.lng, radius * 1.18)
  }, [marker.lat, marker.lng, radius])

  const lineHeight = topPosition.distanceTo(surfacePosition)

  // Hide markers on the far side of the globe
  useFrame(() => {
    if (!imageGroupRef.current) return

    const worldPos = new THREE.Vector3()
    imageGroupRef.current.getWorldPosition(worldPos)

    const markerDirection = worldPos.clone().normalize()

    const cameraDirection = camera.position.clone().normalize()

    const dot = markerDirection.dot(cameraDirection)

    setIsVisible(dot > 0.1)
  })

  const handlePointerEnter = useCallback(() => {
    setHovered(true)
    onHover?.(marker)
  }, [marker, onHover])

  const handlePointerLeave = useCallback(() => {
    setHovered(false)
    onHover?.(null)
  }, [onHover])

  const handleClick = useCallback(() => {
    onClick?.(marker)
  }, [marker, onClick])

  const { lineCenter, lineQuaternion } = useMemo(() => {
    const center = surfacePosition.clone().lerp(topPosition, 0.5)

    const direction = topPosition.clone().sub(surfacePosition).normalize()
    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)

    return { lineCenter: center, lineQuaternion: quaternion }
  }, [surfacePosition, topPosition])

  return (
    <group ref={groupRef} visible={isVisible}>
      <mesh position={lineCenter} quaternion={lineQuaternion}>
        <cylinderGeometry args={[0.003, 0.003, lineHeight, 8]} />
        <meshBasicMaterial
          color={hovered ? "#ffffff" : "#94a3b8"}
          transparent
          opacity={hovered ? 0.9 : 0.6}
        />
      </mesh>

      <mesh position={surfacePosition} quaternion={lineQuaternion}>
        <coneGeometry args={[0.015, 0.04, 8]} />
        <meshBasicMaterial color={hovered ? "#f97316" : "#ef4444"} />
      </mesh>

      <group ref={imageGroupRef} position={topPosition}>
        {/*
          No drei `transform` mode: its CSS 3D matrix chain depends on canvas
          size, so the head drifts off the pin on large canvases. Plain mode
          uses the same screen projection as the pin itself.
        */}
        <Html
          center
          distanceFactor={10}
          style={{
            pointerEvents: isVisible ? "auto" : "none",
            opacity: isVisible ? 1 : 0,
            transition: "opacity 0.15s ease-out",
          }}
        >
          <div
            className={cn(
              "cursor-pointer overflow-hidden rounded-full bg-neutral-900 shadow-lg transition-transform duration-200",
              hovered && "scale-125 shadow-xl ring-1 ring-white/50"
            )}
            style={{
              width: "8px",
              height: "8px",
            }}
            onMouseEnter={handlePointerEnter}
            onMouseLeave={handlePointerLeave}
            onClick={handleClick}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={marker.src}
              alt={marker.label || "Marker"}
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>
        </Html>
      </group>
    </group>
  )
}

interface RotatingGlobeProps {
  config: Required<Globe3DConfig>
  markers: GlobeMarker[]
  onMarkerClick?: (marker: GlobeMarker) => void
  onMarkerHover?: (marker: GlobeMarker | null) => void
}

function RotatingGlobe({
  config,
  markers,
  onMarkerClick,
  onMarkerHover,
}: RotatingGlobeProps) {
  const groupRef = useRef<THREE.Group>(null)

  const [earthTexture, bumpTexture] = useTexture(
    [config.textureUrl, config.bumpMapUrl],
    ([earth, bump]) => {
      earth.colorSpace = THREE.SRGBColorSpace
      earth.anisotropy = 16
      bump.anisotropy = 8
    }
  )

  const geometry = useMemo(() => {
    return new THREE.SphereGeometry(config.radius, 64, 64)
  }, [config.radius])

  const wireframeGeometry = useMemo(() => {
    return new THREE.SphereGeometry(config.radius * 1.002, 32, 16)
  }, [config.radius])

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          map={earthTexture}
          bumpMap={bumpTexture}
          bumpScale={config.bumpScale * 0.05}
          roughness={0.7}
          metalness={0.0}
        />
      </mesh>

      {config.showWireframe && (
        <mesh geometry={wireframeGeometry}>
          <meshBasicMaterial
            color={config.wireframeColor}
            wireframe
            transparent
            opacity={0.08}
          />
        </mesh>
      )}

      {/* Markers - inside the rotating group so they turn with the globe */}
      {markers.map((marker, index) => (
        <Marker
          key={`marker-${index}-${marker.lat}-${marker.lng}`}
          marker={marker}
          radius={config.radius}
          onClick={onMarkerClick}
          onHover={onMarkerHover}
        />
      ))}
    </group>
  )
}

interface AtmosphereProps {
  radius: number
  color: string
  intensity: number
  blur: number
}

function Atmosphere({ radius, color, intensity, blur }: AtmosphereProps) {
  // Higher blur means a lower fresnel exponent, so a softer edge
  const fresnelPower = Math.max(0.5, 5 - blur)

  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        atmosphereColor: { value: new THREE.Color(color) },
        intensity: { value: intensity },
        fresnelPower: { value: fresnelPower },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 atmosphereColor;
        uniform float intensity;
        uniform float fresnelPower;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          float fresnel = pow(1.0 - abs(dot(vNormal, normalize(-vPosition))), fresnelPower);
          gl_FragColor = vec4(atmosphereColor, fresnel * intensity);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })
  }, [color, intensity, fresnelPower])

  return (
    <mesh scale={[1.12, 1.12, 1.12]}>
      <sphereGeometry args={[radius, 64, 32]} />
      <primitive object={atmosphereMaterial} attach="material" />
    </mesh>
  )
}

interface SceneProps {
  markers: GlobeMarker[]
  config: Required<Globe3DConfig>
  onMarkerClick?: (marker: GlobeMarker) => void
  onMarkerHover?: (marker: GlobeMarker | null) => void
}

function Scene({ markers, config, onMarkerClick, onMarkerHover }: SceneProps) {
  const { camera } = useThree()

  React.useEffect(() => {
    camera.position.set(0, 0, config.radius * 3.5)
    camera.lookAt(0, 0, 0)
  }, [camera, config.radius])

  return (
    <>
      <ambientLight intensity={config.ambientIntensity} />
      <directionalLight
        position={[config.radius * 5, config.radius * 2, config.radius * 5]}
        intensity={config.pointLightIntensity}
        color="#ffffff"
      />
      <directionalLight
        position={[-config.radius * 3, config.radius, -config.radius * 2]}
        intensity={config.pointLightIntensity * 0.3}
        color="#88ccff"
      />

      <RotatingGlobe
        config={config}
        markers={markers}
        onMarkerClick={onMarkerClick}
        onMarkerHover={onMarkerHover}
      />

      {/* Outside the rotating group so the glow stays fixed */}
      {config.showAtmosphere && (
        <Atmosphere
          radius={config.radius}
          color={config.atmosphereColor}
          intensity={config.atmosphereIntensity}
          blur={config.atmosphereBlur}
        />
      )}

      <OrbitControls
        makeDefault
        enablePan={config.enablePan}
        enableZoom={config.enableZoom}
        minDistance={config.minDistance}
        maxDistance={config.maxDistance}
        rotateSpeed={0.4}
        autoRotate={config.autoRotateSpeed > 0}
        autoRotateSpeed={config.autoRotateSpeed}
        enableDamping
        dampingFactor={0.1}
      />
    </>
  )
}

/**
 * Context loss arrives as a DOM event on the canvas, not as a render error, so
 * an error boundary can't see it. This turns it into a callback.
 */
function ContextLossWatcher({
  onLost,
}: {
  onLost?: (event: WebGLContextEvent) => void
}) {
  const gl = useThree((state) => state.gl)

  React.useEffect(() => {
    const canvas = gl.domElement

    function handleLost(event: Event) {
      // Without this the browser won't ever restore a context to this canvas.
      event.preventDefault()
      onLost?.(event as WebGLContextEvent)
    }

    canvas.addEventListener("webglcontextlost", handleLost)
    return () => canvas.removeEventListener("webglcontextlost", handleLost)
  }, [gl, onLost])

  return null
}

function LoadingFallback() {
  return (
    <Html center>
      <div className="flex shrink-0 flex-col items-center gap-3">
        <span className="inline-block shrink-0 text-sm text-neutral-400">
          Loading globe...
        </span>
      </div>
    </Html>
  )
}

const defaultConfig: Required<Globe3DConfig> = {
  radius: 2,
  textureUrl: DEFAULT_EARTH_TEXTURE,
  bumpMapUrl: DEFAULT_BUMP_TEXTURE,
  showAtmosphere: false,
  atmosphereColor: "#4da6ff",
  atmosphereIntensity: 0.5,
  atmosphereBlur: 2,
  bumpScale: 1,
  autoRotateSpeed: 0.3,
  enableZoom: false,
  enablePan: false,
  minDistance: 5,
  maxDistance: 15,
  showWireframe: false,
  wireframeColor: "#4a9eff",
  ambientIntensity: 0.6,
  pointLightIntensity: 1.5,
  backgroundColor: null,
}

export function Globe3D({
  markers = [],
  config = {},
  className,
  onMarkerClick,
  onMarkerHover,
  onContextLost,
}: Globe3DProps) {
  const mergedConfig = useMemo(
    () => ({ ...defaultConfig, ...config }),
    [config]
  )

  return (
    <div className={cn("relative h-[500px] w-full", className)}>
      <Canvas
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        dpr={[1, 2]}
        camera={{
          fov: 45,
          near: 0.1,
          far: 1000,
          position: [0, 0, mergedConfig.radius * 3.5],
        }}
        style={{
          background: mergedConfig.backgroundColor || "transparent",
        }}
      >
        <ContextLossWatcher onLost={onContextLost} />

        <Suspense fallback={<LoadingFallback />}>
          <Scene
            markers={markers}
            config={mergedConfig}
            onMarkerClick={onMarkerClick}
            onMarkerHover={onMarkerHover}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default Globe3D
