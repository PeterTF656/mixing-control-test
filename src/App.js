import React, { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber'
import { Box, OrbitControls, TransformControls, useFBX, GizmoHelper, GizmoViewport, PerspectiveCamera, useHelper } from '@react-three/drei'
import * as THREE from 'three'
import { CCDIKSolver, CCDIKHelper } from 'three/examples/jsm/animation/CCDIKSolver'

const SMPLX_JOINT_NAMES = [
  'pelvis',
  'left_hip',
  'right_hip',
  'spine1',
  'left_knee',
  'right_knee',
  'spine2',
  'left_ankle',
  'right_ankle',
  'spine3',
  'left_foot',
  'right_foot',
  'neck',
  'left_collar',
  'right_collar',
  'head',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'jaw',
  'left_eye_smplhf',
  'right_eye_smplhf',
  'left_index1',
  'left_index2',
  'left_index3',
  'left_middle1',
  'left_middle2',
  'left_middle3',
  'left_pinky1',
  'left_pinky2',
  'left_pinky3',
  'left_ring1',
  'left_ring2',
  'left_ring3',
  'left_thumb1',
  'left_thumb2',
  'left_thumb3',
  'right_index1',
  'right_index2',
  'right_index3',
  'right_middle1',
  'right_middle2',
  'right_middle3',
  'right_pinky1',
  'right_pinky2',
  'right_pinky3',
  'right_ring1',
  'right_ring2',
  'right_ring3',
  'right_thumb1',
  'right_thumb2',
  'right_thumb3'
]

// Extend TransformControls to use events in R3F
extend({ TransformControls })

function IKScene({ orbitControlsRef }) {
  const fbx = useFBX('/handler_left_wrist.fbx') // Path to your FBX
  const [skinnedMesh, setSkinnedMesh] = useState(null)
  const [iksConfig, setIksConfig] = useState([])

  const ikSolverRef = useRef(null)
  const ikHelperRef = useRef(null)

  const prevPositionRef = useRef(new THREE.Vector3())

  // The "handle" mesh ref
  const handleMeshRef = useRef(null)

  // We'll track the real effector bone ("right_thumb3") so we can move it each frame
  const effectorBoneRef = useRef(null)

  const transformControlsRef = useRef(null)
  const { scene } = useThree()

  useEffect(()=>{
    if (orbitControlsRef.current) {
      const controls = orbitControlsRef.current;
      const camera = controls.object;

      // Manually set the camera's initial position and rotation
      camera.position.set(138, 207.08, 45.926);
      camera.rotation.set(
        THREE.MathUtils.degToRad(40.4333),
        THREE.MathUtils.degToRad(-0.0009),
        THREE.MathUtils.degToRad(93.448)
      );

      // Log the camera's position and rotation
      console.log("Camera Position:", camera.position.x, camera.position.y, camera.position.z );
      console.log("Camera Rotation:", camera.rotation.x, camera.rotation.y, camera.rotation.z);

      const target = new THREE.Vector3(0, 0, 0); // Assuming the target is at the origin

      const camera1Position = new THREE.Vector3(138, 207.08, 45.926);
      const camera2Position = new THREE.Vector3(27.27, 40.92, 9.07);

      const direction1 = new THREE.Vector3().subVectors(target, camera1Position).normalize();
      const direction2 = new THREE.Vector3().subVectors(target, camera2Position).normalize();

      console.log("1", direction1, "2", direction2)

      // // Calculate pitch and yaw for Camera 1
      // const pitch1 = Math.asin(-direction1.y); // Pitch (rotation around X-axis)
      // const yaw1 = Math.atan2(direction1.x, direction1.z); // Yaw (rotation around Y-axis)
      // const roll1 = 0; // Roll (rotation around Z-axis)

      // // Calculate pitch and yaw for Camera 2
      // const pitch2 = Math.asin(-direction2.y); // Pitch (rotation around X-axis)
      // const yaw2 = Math.atan2(direction2.x, direction2.z); // Yaw (rotation around Y-axis)
      // const roll2 = 0; // Roll (rotation around Z-axis)

      // // Log the results
      // console.log("Camera 1 Rotation (Radians):", { pitch: pitch1, yaw: yaw1, roll: roll1 });
      // console.log("Camera 2 Rotation (Radians):", { pitch: pitch2, yaw: yaw2, roll: roll2 });

      // // Convert to degrees for easier interpretation
      // const toDegrees = (radians) => THREE.MathUtils.radToDeg(radians);

      // console.log("Camera 1 Rotation (Degrees):", {
      //   pitch: toDegrees(pitch1),
      //   yaw: toDegrees(yaw1),
      //   roll: toDegrees(roll1),
      // });

      // console.log("Camera 2 Rotation (Degrees):", {
      //   pitch: toDegrees(pitch2),
      //   yaw: toDegrees(yaw2),
      //   roll: toDegrees(roll2),
      // });
    }
  }),[]

  // ---------------------------
  // Step 1: Find the SkinnedMesh + the "handler_right_thumb2_bone" mesh
  // ---------------------------
  useEffect(() => {
    let foundSkinnedMesh = null

    fbx.traverse((child) => {
      // console.log('showing fbx children', child)
      if (child.isSkinnedMesh) {
        foundSkinnedMesh = child
        // console.log('Found SkinnedMesh:', child.name)
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
        // console.log(`Bone ${index}: ${bone.name} (parent: ${bone.parent?.name})`)
        if (bone.name === 'handler_left_wrist') {
          console.log('****Found it!', bone)
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
    const link0Index = skeleton.bones.findIndex((b) => b.name === 'left_elbow')
    const link1Index = skeleton.bones.findIndex((b) => b.name === 'left_shoulder')
    const link2Index = skeleton.bones.findIndex((b) => b.name === 'left_collar')

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
            rotationMin: new THREE.Vector3(1.2, -1.8, -0.4),
            rotationMax: new THREE.Vector3(1.7, -1.1, 0.3)
          },
          {
            index: link1Index,
            rotationMin: new THREE.Vector3(1.2, -1.8, -0.4),
            rotationMax: new THREE.Vector3(1.7, -1.1, 0.3)
          },
          { index: link2Index, rotationMin: new THREE.Vector3(1.2, -1.8, -0.4), rotationMax: new THREE.Vector3(1.7, -1.1, 0.3) }
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

  // ? define a retrieve orbit camera function
  function handleControlsChange(controls) {
    console.log('fuuuk---------------------------------')
    const camera = controls.object
    

    // Function to convert Three.js position to Blender coordinates
    function convertPosition(threePos) {
      return {
        x: threePos.x,
        y: threePos.z,
        z: -threePos.y
      }
    }

    // Function to calculate focal length from fov
    function calculateFocalLength(fov, sensorHeight = 36) {
      return sensorHeight / 2 / Math.tan((fov / 2) * (Math.PI / 180))
    }

    // Get camera and target positions
    const threeCameraPos = camera.position
    const threeTargetPos = controls.target

    console.log("target position", threeTargetPos)

    const blenderCameraPos = convertPosition(threeCameraPos)

    // Calculate direction
   // Calculate direction and up vector
    const direction = new THREE.Vector3().subVectors(threeTargetPos, threeCameraPos).normalize();
        // Given pitch and yaw in radians
    const pitch = Math.asin(-direction.z); // Pitch (rotation around X-axis)
    const yaw = Math.atan2(direction.x, direction.y); // Yaw (rotation around Y-axis)
    const roll = 0; // Roll (rotation around Z-axis, default 0)

    // Euler angles in radians
    const euler = new THREE.Euler(pitch, yaw, roll, 'XYZ');

    // Convert to degrees if needed
    const pitchDeg = THREE.MathUtils.radToDeg(pitch);
    const yawDeg = THREE.MathUtils.radToDeg(yaw);
    const rollDeg = THREE.MathUtils.radToDeg(roll);

    console.log('Euler Angles (Radians):', euler);
    console.log('Euler Angles (Degrees):', { x: pitchDeg, y: yawDeg, z: rollDeg });
    // Get camera data
    const fov = camera.fov
    const focalLength = calculateFocalLength(fov)

    console.log('Blender Camera Data:')
    console.log('Position:', blenderCameraPos)
    // console.log('Direction:', blenderDirection)
    console.log('Focal Length:', focalLength, 'mm')
    console.log('Near Clip:', camera.near)
    console.log('Far Clip:', camera.far)
  }

  // ---------------------------
  // Step 6: useFrame => copy "handleMesh" pos -> effectorBone pos, then solver.update()
  // ---------------------------
  useFrame(() => {
    if (effectorBoneRef.current && handleMeshRef.current && ikSolverRef.current && handleMeshRef.current.position && orbitControlsRef.current) {
      const currentPosition = handleMeshRef.current.position.clone()

      // Check if the position has changed
      if (!currentPosition.equals(prevPositionRef.current)) {
        const camera = orbitControlsRef.current.object
        // ** camera position
        console.log("camera position ---------------------------------");
        console.log("target", orbitControlsRef.current.target)
        console.log("Camera Position:", camera.position.x, camera.position.y, camera.position.z );
        console.log("Camera Rotation:", THREE.MathUtils.radToDeg(camera.rotation.x), THREE.MathUtils.radToDeg(camera.rotation.y), THREE.MathUtils.radToDeg(camera.rotation.z));

        // ** ## h

        const skeleton = skinnedMesh.skeleton
        const targetIndex = skeleton.bones.findIndex((b) => b.name === 'handler_left_wrist')
        const targetBone = skeleton.bones[targetIndex]

        if (targetBone) {
          // Update the target bone's position
          targetBone.position.copy(currentPosition)
          targetBone.updateMatrixWorld()
        }

        // Update the IK solver
        ikSolverRef.current.update()

        // Update bounding spheres for the skinned mesh
        scene.traverse((object) => {
          if (object.isSkinnedMesh) object.computeBoundingSphere()
        })

        // Store the current position for the next comparison
        prevPositionRef.current.copy(currentPosition)

        const q_list = []
        const v_list = []

        SMPLX_JOINT_NAMES.forEach((bone) => {
          if (bone === 'left_ankle') {
            const targetIndex = skeleton.bones.findIndex((b) => b.name === bone)
            const targetBone = skeleton.bones[targetIndex]

            if (targetBone) {
              q_list.push(targetBone.quaternion)
              v_list.push(targetBone.position)
              console.log(targetBone,targetBone.position )
            } else console.log('\n---\n\nMatching ERROR\n\n')
          }
        })

        // console.log({
        //   q_list: q_list,
        //   v_list: v_list
        // })
      }
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
      <primitive object={fbx} scale={1} postion={[0,0,0]} />
      {/* 
        We attach transform controls to the "handler_right_thumb2_bone" mesh. 
        Because it's presumably parented under the FBX group (which is in the scene),
        we won't get "must be part of scene graph" error.
      */}
      {handleMeshRef.current && (
        <TransformControls
          object={handleMeshRef.current}
          mode="translate"
          space="world"
          ref={transformControlsRef}
          size={0.5}
          onMouseDown={onDragStart}
          onMouseUp={onDragEnd}
        />
      )}
    </>
  )
}

const CameraWrapper = () => {
  const cameraRef = useRef();
  const [helper, setHelper] = useState(null);
  const aspect = 16 / 9; // Desired aspect ratio

  useEffect(() => {
    if (cameraRef.current) {
      // Update camera properties
      cameraRef.current.aspect = 1200/744;
      cameraRef.current.updateProjectionMatrix();

      // Create and set the CameraHelper once the camera is ready
      const cameraHelper = new THREE.CameraHelper(cameraRef.current);
      setHelper(cameraHelper);
    }
  }, [aspect]);

  return (
    <>
      {/* Perspective camera */}
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={[0, 2, 5]}
        fov={30}
        near={0.001}
        far={5000}
      />

      {/* Render the CameraHelper */}
      {helper && <primitive object={helper} />}
    </>
  );
};

export default function App() {
  const orbitControlsRef = useRef()


  return (
    <Canvas
      onCreated={({ scene }) => {
        scene.background = new THREE.Color(0xffffff)
        scene.fog = new THREE.FogExp2(0xffffff, 0.01)
      }}>
        <CameraWrapper />
      <ambientLight intensity={0.2} />
      {/* <Box position={[0,0,0]}/> */}
      <Suspense fallback={null}>
        <IKScene orbitControlsRef={orbitControlsRef} />
      </Suspense>
      <OrbitControls ref={orbitControlsRef} makeDefault minDistance={1} maxDistance={50} enableDamping target={[1,2,1]} />
      <GizmoHelper
        alignment="bottom-right" // widget alignment within scene
        margin={[80, 80]} // widget margins (X, Y)
        // onUpdate={/* called during camera animation  */}
        onTarget={(target)=>{console.log("helper", target)}}
        // renderPriority={/* use renderPriority to prevent the helper from disappearing if there is another useFrame(..., 1)*/}
      >
        <GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="black" />
        {/* alternative: <GizmoViewcube /> */}
      </GizmoHelper>
    </Canvas>
  )
}
