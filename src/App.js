import React, { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber'
import { OrbitControls, TransformControls, useFBX } from '@react-three/drei'
import * as THREE from 'three'
import { CCDIKSolver, CCDIKHelper } from 'three/examples/jsm/animation/CCDIKSolver'

// Extend TransformControls to use events in R3F
extend({ TransformControls })

function IKScene({ orbitControlsRef }) {
  const fbx = useFBX('/handler_left_wrist.fbx') // Path to your FBX
  const [skinnedMesh, setSkinnedMesh] = useState(null)
  const [iksConfig, setIksConfig] = useState([])

  const ikSolverRef = useRef(null)
  const ikHelperRef = useRef(null)

  // The "handle" mesh ref
  const handleMeshRef = useRef(null)

  // We'll track the real effector bone ("right_thumb3") so we can move it each frame
  const effectorBoneRef = useRef(null)

  const transformControlsRef = useRef(null)
  const { scene } = useThree()

  // ---------------------------
  // Step 1: Find the SkinnedMesh + the "handler_right_thumb2_bone" mesh
  // ---------------------------
  useEffect(() => {
    let foundSkinnedMesh = null

    fbx.traverse((child) => {
      console.log("showing fbx children",child)
      if (child.isSkinnedMesh) {
        foundSkinnedMesh = child
        console.log('Found SkinnedMesh:', child.name)
      }
      // If we find the mesh named "handler_right_thumb2_bone"
      if (child.name === 'handler_left_wrist') {
        console.log('Found the handler:', child.name, child.type)
      }
    })

    if (foundSkinnedMesh) {
      setSkinnedMesh(foundSkinnedMesh)
    } else {
      console.error('No SkinnedMesh found in the FBX model.')
    }
  }, [fbx])

  // ---------------------------
  // Step 2: Log Skeleton Bones
  // ---------------------------
  useEffect(() => {
    if (skinnedMesh) {
      const skeleton = skinnedMesh.skeleton
      console.log('SkinnedMesh:', skinnedMesh.name)
      console.log('Skeleton has bones:', skeleton.bones.length)
      skeleton.bones.forEach((bone, index) => {
        console.log(`Bone ${index}: ${bone.name} (parent: ${bone.parent?.name})`)
        if (bone.name === "handler_left_wrist") {
          console.log("****Found it!", bone)
        }
      })
    }
  }, [skinnedMesh])

  // ---------------------------
  // Step 3: Identify the effector bone = "right_thumb3"
  // ---------------------------
  useEffect(() => {
    if (!skinnedMesh) return
    const handler = skinnedMesh.skeleton.getBoneByName('handler_left_wrist')       
    const bone = skinnedMesh.skeleton.getBoneByName('right_thumb3')
    if (!bone) {
      console.error('No bone named "right_thumb3" found in skeleton.')
      return
    }
    effectorBoneRef.current = bone
    handleMeshRef.current = handler
    console.log('Effector bone is "right_thumb3". Parent:', bone.parent?.name)
  }, [skinnedMesh])

  // ---------------------------
  // Step 4: Define IK config with NO "target:" field
  //          (We do partial approach: effector = thumb3, links = [thumb2, thumb1])
  // ---------------------------
  useEffect(() => {
    if (!skinnedMesh || !effectorBoneRef.current) return

    const skeleton = skinnedMesh.skeleton
    const targetIndex = skeleton.bones.findIndex((b) => b.name === 'handler_left_wrist')
    const effectorIndex = skeleton.bones.findIndex((b) => b.name === 'right_thumb3')
    const link1Index    = skeleton.bones.findIndex((b) => b.name === 'right_thumb2')
    const link2Index    = skeleton.bones.findIndex((b) => b.name === 'right_thumb1')

    console.log(targetIndex)

    if (effectorIndex < 0 || link1Index < 0 || link2Index < 0) {
      console.error('Could not find "right_thumb3", "right_thumb2", or "right_thumb1" in skeleton.')
      return
    }

    // No "target", just effector + links
    const iks = [
      {
        target: targetIndex,
        effector: effectorIndex,
        links: [
          { index: link1Index, 
            rotationMin: new THREE.Vector3( 1.2, - 1.8, - .4 ),
            rotationMax: new THREE.Vector3( 1.7, - 1.1, .3 )
          },
          { index: link2Index, 
            rotationMin: new THREE.Vector3( 1.2, - 1.8, - .4 ),
            rotationMax: new THREE.Vector3( 1.7, - 1.1, .3 )
          },
          // { index: targetIndex,

          //   rotationMin: new THREE.Vector3( 0, - 0, - 0 ),
          //   rotationMax: new THREE.Vector3( 1.7, - 1.1, .3 )
          // }
        ]
      }
    ]

    setIksConfig(iks)
    console.log('Partial IK config (no target):', iks)
  }, [skinnedMesh])

  // ---------------------------
  // Step 5: Initialize IK Solver & Helper
  // ---------------------------
  useEffect(() => {
    if (skinnedMesh && iksConfig.length > 0) {
      ikSolverRef.current = new CCDIKSolver(skinnedMesh, iksConfig)
      ikHelperRef.current = new CCDIKHelper(skinnedMesh, iksConfig, 0.01)
      scene.add(ikHelperRef.current)
    }
    return () => {
      if (ikHelperRef.current) {
        scene.remove(ikHelperRef.current)
        ikHelperRef.current.dispose()
        ikHelperRef.current = null
      }
    }
  }, [skinnedMesh, iksConfig, scene])

  // ---------------------------
  // Step 6: useFrame => copy "handleMesh" pos -> effectorBone pos, then solver.update()
  // ---------------------------
  useFrame(() => {
    if (effectorBoneRef.current && handleMeshRef.current && ikSolverRef.current) {
      // 1) Grab the handle's world position
      const handlePos = new THREE.Vector3()
      handleMeshRef.current.getWorldPosition(handlePos)

      // 2) Convert to effectorBone's parent local space
      if (effectorBoneRef.current.parent) {
        effectorBoneRef.current.parent.worldToLocal(handlePos)
      }

      // 3) Move the effector bone to that local position
      effectorBoneRef.current.position.copy(handlePos)

      // 4) Now solver updates the chain (thumb2, thumb1)
      ikSolverRef.current.update()
    }
  })

  // ---------------------------
  // Step 7: <TransformControls> on the "handleMesh" (a normal mesh in the scene)
  // ---------------------------
  const onDragStart = () => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.enabled = false
    }
  }
  const onDragEnd = () => {
    if (orbitControlsRef.current) {
      orbitControlsRef.current.enabled = true
    }
  }

  return (
    <>
      <primitive object={fbx} scale={0.1} />
      {/* 
        We attach transform controls to the "handler_right_thumb2_bone" mesh. 
        Because it's presumably parented under the FBX group (which is in the scene),
        we won't get "must be part of scene graph" error.
      */}
      {handleMeshRef.current && (
        <TransformControls
          object={handleMeshRef.current}
          mode="translate"
          ref={transformControlsRef}
          size={0.5}
          onMouseDown={onDragStart}
          onMouseUp={onDragEnd}
        />
      )}
    </>
  )
}

export default function App() {
  const orbitControlsRef = useRef()

  return (
    <Canvas
      camera={{ position: [0.97, 1.1, 0.73], fov: 55, near: 0.001, far: 5000 }}
      onCreated={({ scene }) => {
        scene.background = new THREE.Color(0xffffff)
        scene.fog = new THREE.FogExp2(0xffffff, 0.05)
      }}
    >
      <ambientLight intensity={0.2} />
      <Suspense fallback={null}>
        <IKScene orbitControlsRef={orbitControlsRef} />
      </Suspense>
      <OrbitControls
        ref={orbitControlsRef}
        makeDefault
        minDistance={1}
        maxDistance={50}
        enableDamping
      />
    </Canvas>
  )
}
