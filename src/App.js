import React, { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber'
import { Box, OrbitControls, TransformControls, useFBX } from '@react-three/drei'
import * as THREE from 'three'
import { CCDIKSolver, CCDIKHelper } from 'three/examples/jsm/animation/CCDIKSolver'

const SMPLX_JOINT_NAMES = [   'pelvis','left_hip','right_hip','spine1','left_knee','right_knee','spine2','left_ankle','right_ankle','spine3', 'left_foot','right_foot','neck','left_collar','right_collar','head','left_shoulder','right_shoulder','left_elbow', 'right_elbow','left_wrist','right_wrist',
  'jaw','left_eye_smplhf','right_eye_smplhf','left_index1','left_index2','left_index3','left_middle1','left_middle2','left_middle3','left_pinky1','left_pinky2','left_pinky3','left_ring1','left_ring2','left_ring3','left_thumb1','left_thumb2','left_thumb3','right_index1','right_index2','right_index3','right_middle1','right_middle2','right_middle3','right_pinky1','right_pinky2','right_pinky3','right_ring1','right_ring2','right_ring3','right_thumb1','right_thumb2','right_thumb3']

// Extend TransformControls to use events in R3F
extend({ TransformControls })

function IKScene({ orbitControlsRef }) {
  const fbx = useFBX('/handler_left_wrist.fbx') // Path to your FBX
  const [skinnedMesh, setSkinnedMesh] = useState(null)
  const [iksConfig, setIksConfig] = useState([])

  const ikSolverRef = useRef(null)
  const ikHelperRef = useRef(null)

  const prevPositionRef = useRef(new THREE.Vector3());

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
    const bone = skinnedMesh.skeleton.getBoneByName('left_wrist')
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

    const effectorIndex = skeleton.bones.findIndex((b) => b.name === 'left_wrist')
    const link0Index    = skeleton.bones.findIndex((b) => b.name === 'left_elbow')
    const link1Index    = skeleton.bones.findIndex((b) => b.name === 'left_shoulder')
    const link2Index    = skeleton.bones.findIndex((b) => b.name === 'left_collar')

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
        // target: effectorIndex,
        // effector: link1Index,
        links: [
          {
            index: link0Index, 
            rotationMin: new THREE.Vector3( 1.2, - 1.8, - .4 ),
            rotationMax: new THREE.Vector3( 1.7, - 1.1, .3 )
          },
          { 
            index: link1Index, 
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
    if (
      effectorBoneRef.current &&
      handleMeshRef.current &&
      ikSolverRef.current &&
      handleMeshRef.current.position
    ) {
      const currentPosition = handleMeshRef.current.position.clone();
  
      // Check if the position has changed
      if (!currentPosition.equals(prevPositionRef.current)) {
        const skeleton = skinnedMesh.skeleton;
        const targetIndex = skeleton.bones.findIndex((b) => b.name === 'handler_left_wrist');
        const targetBone = skeleton.bones[targetIndex];
  
        if (targetBone) {
          // Update the target bone's position
          targetBone.position.copy(currentPosition);
          targetBone.updateMatrixWorld();
        }
  
        // Update the IK solver
        ikSolverRef.current.update();
  
        // Update bounding spheres for the skinned mesh
        scene.traverse((object) => {
          if (object.isSkinnedMesh) object.computeBoundingSphere();
        });
  
        // Store the current position for the next comparison
        prevPositionRef.current.copy(currentPosition);

        const q_list = []
        const v_list = []

        SMPLX_JOINT_NAMES.forEach((bone)=>{
          if (bone === "left_wrist") {
            const targetIndex = skeleton.bones.findIndex((b) => b.name === bone);
            const targetBone = skeleton.bones[targetIndex];

            if (targetBone) {
              q_list.push(targetBone.quaternion
              )
              v_list.push(targetBone.position)
              // console.log(targetBone)
            }
            else console.log("\n---\n\nMatching ERROR\n\n")
          }
        })

        // console.log({
        //   q_list: q_list,
        //   v_list: v_list
        // })
      }
    }
  });

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
          space='world'
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

  useEffect(() => {
    if (orbitControlsRef.current) {
      const controls = orbitControlsRef.current;

      function handleControlsChange() {
        console.log("fuuuk---------------------------------")
        const camera = controls.object;

        // Function to convert Three.js position to Blender coordinates
        function convertPosition(threePos) {
          return {
            x: threePos.x,
            y: threePos.z,
            z: -threePos.y,
          };
        }

        // Function to calculate focal length from fov
        function calculateFocalLength(fov, sensorHeight = 36) {
          return (sensorHeight / 2) / Math.tan((fov / 2) * (Math.PI / 180));
        }

        // Get camera and target positions
        const threeCameraPos = camera.position;
        const threeTargetPos = controls.target;

        const blenderCameraPos = convertPosition(threeCameraPos);
        const blenderTargetPos = convertPosition(threeTargetPos);

        // Calculate direction
        const direction = new THREE.Vector3()
          .subVectors(threeTargetPos, threeCameraPos)
          .normalize();

        // Convert direction to Blender
        const blenderDirection = {
          x: direction.x,
          y: direction.z,
          z: -direction.y,
        };

        // Get camera data
        const fov = camera.fov;
        const focalLength = calculateFocalLength(fov);

        console.log('Blender Camera Data:');
        console.log('Position:', blenderCameraPos);
        console.log('Direction:', blenderDirection);
        console.log('Focal Length:', focalLength, 'mm');
        console.log('Near Clip:', camera.near);
        console.log('Far Clip:', camera.far);
      }

      controls.addEventListener('change', handleControlsChange);

      // Cleanup
      return () => {
        controls.removeEventListener('change', handleControlsChange);
      };
    }
  }, []);
  

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
