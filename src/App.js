import React, { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber'
import { OrbitControls, TransformControls, useFBX } from '@react-three/drei'
import * as THREE from 'three'
import { CCDIKSolver, CCDIKHelper } from 'three/examples/jsm/animation/CCDIKSolver'

// Extend TransformControls to use events in R3F
extend({ TransformControls })

function IKScene({ orbitControlsRef }) {
  const fbx = useFBX('/all_1.fbx') // Ensure the path is correct and the model is accessible
  const [skinnedMesh, setSkinnedMesh] = useState(null)
  const [iksConfig, setIksConfig] = useState([])
  const ikSolverRef = useRef(null)
  const ikHelperRef = useRef(null)
  const targetRef = useRef(new THREE.Bone())
  const transformControlsRef = useRef(null)

  const { scene, gl } = useThree()

  // Step 1: Find the SkinnedMesh within the FBX
  useEffect(() => {
    let foundSkinnedMesh = null
    fbx.traverse((child) => {
      if (child.isSkinnedMesh) {
        foundSkinnedMesh = child
        console.log('Found SkinnedMesh:', child.name)
      }
    })

    if (foundSkinnedMesh) {
      setSkinnedMesh(foundSkinnedMesh)
    } else {
      console.error('No SkinnedMesh found in the FBX model.')
    }
  }, [fbx])

  // Step 2: Log Bone Names and Indices for Debugging
  useEffect(() => {
    if (skinnedMesh) {
      console.log('SkinnedMesh:', skinnedMesh.name)
      if (skinnedMesh.skeleton && skinnedMesh.skeleton.getBoneByName) {
        console.log('getBoneByName is available.')
      } else {
        console.error('getBoneByName is NOT available on skinnedMesh.skeleton.')
      }

      // Log all bone names and their indices
      skinnedMesh.skeleton.bones.forEach((bone, index) => {
        console.log(`Bone ${index}: ${bone.name}, isBone=${bone.isBone}, parent=${bone.parent?.name}`)
      })
    }
  }, [skinnedMesh])

  // Step 3: Create and Position the IK Target for Right Thumb
  useEffect(() => {
    if (!skinnedMesh) return

    console.log('[IK Target Setup] Starting...')

    const targetBone = targetRef.current
    targetBone.name = 'IKTarget_RightThumb'

    // 1) Log the skeleton before changes
    console.log(
      '[IK Target Setup] Skeleton bones BEFORE adding target:',
      skinnedMesh.skeleton.bones.map((b) => b.name)
    )

    // 3) Find root bone
    let rootBone = skinnedMesh.skeleton.getBoneByName('root')
    if (rootBone) {
      console.log(`[IK Target Setup] "root" bone found: ${rootBone.name}`)
    } else {
      console.warn('[IK Target Setup] "root" bone not found, fallback to skeleton.bones[0]')
      rootBone = skinnedMesh.skeleton.bones[0]
    }

    // 2) Get thumb tip
    const thumbTip = skinnedMesh.skeleton.getBoneByName('right_thumb3')
    if (thumbTip) {
      const thumbTipPos = new THREE.Vector3()
      thumbTip.getWorldPosition(thumbTipPos) // <--- You need this
      rootBone.worldToLocal(thumbTipPos) // convert world -> local
      targetBone.position.copy(thumbTipPos)
      console.log(`[IK Target Setup] Found "right_thumb3". Positioning targetBone at ${thumbTipPos.toArray()}`)
      console.log('right_thumb3 parent is:', thumbTip.parent?.name)
    } else {
      console.warn('[IK Target Setup] No bone named "right_thumb3". Check your bone names.')
    }

    // 4) Add the new target bone as a child of the root bone
    console.log(`[IK Target Setup] Parenting targetBone to "${rootBone.name}"`)
    rootBone.add(targetBone)

    // 5) Insert bone into skeleton
    console.log('[IK Target Setup] Pushing targetBone into skeleton.bones array...')
    skinnedMesh.skeleton.bones.push(targetBone)

    // 6) Recalc the skeleton's inverse matrices
    console.log('[IK Target Setup] Recalculating skeleton inverses...')
    skinnedMesh.skeleton.calculateInverses()

    // 7) Re-bind the mesh to the updated skeleton
    console.log('[IK Target Setup] Re-binding skinnedMesh to new skeleton...')
    skinnedMesh.bind(skinnedMesh.skeleton)

    // Final logs
    console.log(
      '[IK Target Setup] Skeleton bones AFTER adding target:',
      skinnedMesh.skeleton.bones.map((b) => b.name)
    )
  }, [skinnedMesh])

  // Step 4: Define IK Configuration Based on Bone Indices for Right Thumb
  useEffect(() => {
    if (!skinnedMesh || !targetRef.current) return

    const effectorIndex = skinnedMesh.skeleton.bones.findIndex((b) => b.name === 'right_thumb3')
    const link1Index = skinnedMesh.skeleton.bones.findIndex((b) => b.name === 'right_thumb2')
    const link2Index = skinnedMesh.skeleton.bones.findIndex((b) => b.name === 'right_thumb1')

    if (effectorIndex < 0 || link1Index < 0 || link2Index < 0) {
      console.error('Some thumb bones not found. Check names.')
      return
    }

    const targetIndex = skinnedMesh.skeleton.bones.length - 1 // last one we just pushed

    // One simple chain: (target) -> effector (thumb3) -> link(thumb2) -> link(thumb1)
    const iks = [
      {
        target: targetIndex,
        effector: effectorIndex,
        links: [
          { index: link1Index }, // right_thumb2
          { index: link2Index } // right_thumb1
        ]
      }
    ]

    setIksConfig(iks)
  }, [skinnedMesh])

  // Step 5: Initialize IK Solver and Helper
  useEffect(() => {
    if (skinnedMesh && iksConfig.length > 0) {
      ikSolverRef.current = new CCDIKSolver(skinnedMesh, iksConfig)
      ikHelperRef.current = new CCDIKHelper(skinnedMesh, iksConfig, 0.01)
      scene.add(ikHelperRef.current)
    }
    return () => {
      if (ikHelperRef.current) {
        ikHelperRef.current.dispose()
        ikHelperRef.current = null
      }
    }
  }, [skinnedMesh, iksConfig, scene])

  // 6) Animate: update solver
  useFrame(() => {
    console.log('Frame start: about to call IK solver update...')
    if (ikSolverRef.current) {
      ikSolverRef.current.update()
    }
    console.log('Frame end: solver update ok.')
  })

  // Step 7: Manage TransformControls and OrbitControls Interaction
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
      <TransformControls
        object={targetRef.current}
        mode="translate"
        ref={transformControlsRef}
        size={0.5}
        onMouseDown={onDragStart}
        onMouseUp={onDragEnd}
      />
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
      }}>
      <ambientLight intensity={0.2} />
      <Suspense fallback={null}>
        <IKScene orbitControlsRef={orbitControlsRef} />
      </Suspense>
      <OrbitControls ref={orbitControlsRef} makeDefault minDistance={1} maxDistance={50} enableDamping />
    </Canvas>
  )
}
