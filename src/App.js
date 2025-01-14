import { useState, Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, TransformControls, useCursor, useFBX,} from '@react-three/drei'
import * as THREE from 'three';
import { CCDIKSolver } from 'three/examples/jsm/animation/CCDIKSolver';



function AllFBX() {
  const fbx = useFBX('/all.fbx');
  const [bones, setBones] = useState([]);
  const [targetBone, setTargetBone] = useState(null);
  const transformControlsRef = useRef(null);
  const [iksConfig, setIksConfig] = useState(null);
  const ikSolverRef = useRef(null);
  



  useEffect(() => {
    // Traverse the FBX object to find bones
    const bonesArray = [];
    fbx.traverse((object, index) => {
      if (object instanceof THREE.Bone) {
        console.log(object.name, index)
        bonesArray.push(object);
      }
    });
    setBones(bonesArray);

    // Set the target bone (for example, the first bone)
    if (bonesArray.length > 0) {
      console.log(bonesArray[0])
      setTargetBone(bonesArray[0]);
    }

  // Ensure the FBX object is a SkinnedMesh and has a skeleton
  if (fbx && fbx.skeleton) {
    // Add the root bone to the SkinnedMesh
    fbx.add(fbx.skeleton.bones[0]);

    // Define the IK configuration
    const iks = [
      {
        target: 0, // "target_hand_l"
        effector: 1, // "hand_l"
        links: [
          {
            index: 2, // "lowerarm_l"
            rotationMin: new THREE.Vector3(1.2, -1.8, -0.4),
            rotationMax: new THREE.Vector3(1.7, -1.1, 0.3),
          },
          {
            index: 3, // "Upperarm_l"
            rotationMin: new THREE.Vector3(0.1, -0.7, -1.8),
            rotationMax: new THREE.Vector3(1.1, 0, -1.4),
          },
        ],
      },
    ];

    // Create the IK solver
    ikSolverRef.current = new CCDIKSolver(fbx, iks);
    setIksConfig(iks);
  }
  }, [fbx]);

  useFrame(() => {
    if (transformControlsRef.current && targetBone && ikSolverRef.current) {
      // Update the IK solver when the TransformControls are manipulated
      transformControlsRef.current.updateMatrixWorld();
      targetBone.updateMatrixWorld();
      ikSolverRef.current.update();
    }
  });

  // Handle TransformControls events
  useEffect(() => {
    const transformControls = transformControlsRef.current;
    if (transformControls && targetBone) {
      const onMouseDown = () => {
        // Detach the target bone from the skeleton hierarchy
        targetBone.parent.remove(targetBone);
      };

      const onMouseUp = () => {
        // Reattach the target bone to the skeleton hierarchy
        fbx.skeleton.bones[0].add(targetBone);
      };

      transformControls.addEventListener('mouseDown', onMouseDown);
      transformControls.addEventListener('mouseUp', onMouseUp);

      return () => {
        transformControls.removeEventListener('mouseDown', onMouseDown);
        transformControls.removeEventListener('mouseUp', onMouseUp);
      };
    }
  }, [targetBone, fbx]);


  return <>
  <primitive object={fbx} scale={0.1} />
  {targetBone && (
        <TransformControls
          ref={transformControlsRef}
          object={targetBone}
          mode="translate"
          scale={100}
        />
      )}
  </>
}

export default function App() {
  return (
    <Canvas dpr={[1, 2]}>
      <Suspense fallback={null}>
        <AllFBX position={[2, 2, 0]} />
      </Suspense>
      <OrbitControls makeDefault />
    </Canvas>
  )
}
