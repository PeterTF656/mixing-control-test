import { useState, Suspense, useEffect } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, TransformControls, useCursor, useFBX } from '@react-three/drei'
import { useControls } from 'leva'
import * as THREE from 'three';
// import {useStore} from 'zustand'



function Box(props) {
  // const setTarget = useStore((state) => state.setTarget)
  const [hovered, setHovered] = useState(false)
  useCursor(hovered)
  return (
    <mesh {...props} onClick={()=>{}} onPointerOut={() => setHovered(false)}>
      <boxGeometry />
      <meshNormalMaterial />
    </mesh>
  )
}

function AllFBX() {
  let fbx = useFBX('/all.fbx')
  useEffect(() => {
    // Traverse the FBX object to find bones
    const bones = [];
    fbx.traverse((object) => {
      if (object instanceof THREE.Bone) {
        bones.push(object);
      }
    });

    // Log the bones to the console
    console.log('Bones in the FBX model:', bones);
  }, [fbx]);
  return <primitive object={fbx} />
}

export default function App() {
  // const { target, setTarget } = useStore()
  const { mode } = useControls({ mode: { value: 'translate', options: ['translate', 'rotate', 'scale'] } })
  return (
    <Canvas dpr={[1, 2]}>
      <Suspense fallback={null}>
        <AllFBX position={[2, 2, 0]} />
      </Suspense>
      <Box position={[2, 2, 0]} />
      <Box />
      {/* {target && <TransformControls mode={mode} />} */}
      <OrbitControls makeDefault />
    </Canvas>
  )
}
