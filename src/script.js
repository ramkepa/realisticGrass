import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// import  imageSource from './textures/blade_alpha.jpg'
import SimplexNoise from "https://cdn.jsdelivr.net/npm/simplex-noise@2.4.0/+esm";
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import GUI from 'lil-gui';
import Stats from 'stats.js';




const simplex = new SimplexNoise();

//create grass function to setup scene and geometry of grass and plane 
function createGrass({ options = { bW: 0.12, bH: 1, joints: 5 }, width = 100, instances = 100000 }) {
    const gui = new GUI();
    const { bW, bH, joints } = options;
 // size of canvas display
    const sizes = {
            width: 1920,
            height: 1080
            
        }
  
    const scene = new THREE.Scene();
    const canvas = document.querySelector('canvas.webgl')
    const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100);
    camera.position.set(15, 15, 10);
    const controls = new OrbitControls( camera, canvas );
            controls.enableDamping = true;
            controls.minPolarAngle = Math.PI / 2.5;
            controls.maxPolarAngle = Math.PI / 2.5;
    
    
    // setup env for the background 
            const sky = new Sky();
            sky.scale.setScalar(1000); 
            const uniforms = sky.material.uniforms;
            uniforms['turbidity'].value = 10;
            uniforms['rayleigh'].value = 2;
            uniforms['mieCoefficient'].value = 0.005;
            uniforms['mieDirectionalG'].value = 0.8;
            const sun = new THREE.Vector3();
            const phi = THREE.MathUtils.degToRad(90 - 36);
            const theta = THREE.MathUtils.degToRad(1 * 180); 
            sun.setFromSphericalCoords(1, phi, theta);
            uniforms['sunPosition'].value.copy(sun);
            scene.add(sky);
       
            // light setup 
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
            scene.add(ambientLight);
    
            const pointLight = new THREE.PointLight(0xffffff, 1);
            pointLight.position.set(10, 10, 10);
            scene.add(pointLight)
            


         const renderer = new THREE.WebGLRenderer({
                            canvas: canvas,
                            antialias: true,
                            precision: "mediump",
                            powerPreference: "high-performance"
                        })
                        renderer.setSize(sizes.width, sizes.height)
                        renderer.setPixelRatio(window.devicePixelRatio);// pixel ratio
                        renderer.render(scene, camera);
                        renderer.shadowMap.enabled = false;
                

    //texture load form real grass view
  const textureloader = new THREE.TextureLoader();
 const bladediffuse = textureloader.load("./assets/textures/blade_diffuse.jpg");
 const bladealpha = textureloader.load("./assets/textures/blade_alpha.jpg");

    
    const attributeData = getAttributeData(instances, width);

  
    const baseGeom = new THREE.PlaneGeometry(bW, bH, 1, joints);
    baseGeom.translate(0, bH / 2, 0);

   
    const groundGeo = new THREE.PlaneGeometry(width, width, 32, 32);
    groundGeo.rotateX(-Math.PI / 2);

   
    const positions = groundGeo.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] = getYPosition(positions[i], positions[i + 2]);
    }
    groundGeo.computeVertexNormals();


// shaders for realistic view and animation and Wind Physics Integration
    const vertexShader = `
     precision lowp float;
      attribute vec3 offset;
      attribute vec4 orientation;
      attribute float halfRootAngleSin;
      attribute float halfRootAngleCos;
      attribute float stretch;
      uniform float time;
      uniform float bladeHeight;
      uniform float windIntensity;
      varying vec2 vUv;
      varying float frc;
            
      vec3 mod289(vec3 x) {return x - floor(x * (1.0 / 289.0)) * 289.0;} vec2 mod289(vec2 x) {return x - floor(x * (1.0 / 289.0)) * 289.0;} vec3 permute(vec3 x) {return mod289(((x*34.0)+1.0)*x);} float snoise(vec2 v){const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439); vec2 i  = floor(v + dot(v, C.yy) ); vec2 x0 = v -   i + dot(i, C.xx); vec2 i1; i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0); vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i); vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 )); vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0); m = m*m ; m = m*m ; vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5; vec3 ox = floor(x + 0.5); vec3 a0 = x - ox; m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h ); vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw; return 130.0 * dot(m, g);}
     
      
      
      vec3 rotateVectorByQuaternion( vec3 v, vec4 q){
        return 2.0 * cross(q.xyz, v * q.w + cross(q.xyz, v)) + v;
      }
      
      
      vec4 slerp(vec4 v0, vec4 v1, float t) {
        normalize(v0);
        normalize(v1);
      
      
        float dot_ = dot(v0, v1);
        if (dot_ < 0.0) {
          v1 = -v1;
          dot_ = -dot_;
        }  
      
        const float DOT_THRESHOLD = 0.9995;
        if (dot_ > DOT_THRESHOLD) {
          vec4 result = t*(v1 - v0) + v0;
          normalize(result);
          return result;
        }
      
   
        float theta_0 = acos(dot_);      
        float theta = theta_0*t;          
        float sin_theta = sin(theta);     
        float sin_theta_0 = sin(theta_0); 
        float s0 = cos(theta) - dot_ * sin_theta / sin_theta_0;  // == sin(theta_0 - theta) / sin(theta_0)
        float s1 = sin_theta / sin_theta_0;
        return (s0 * v0) + (s1 * v1);
      }
      
      void main() {
       
        frc = position.y/float(bladeHeight);
        float windStrength = windIntensity / 10.0;
        float noise = snoise(vec2((time - offset.x / 50.0) * windStrength, (time - offset.z / 50.0) * windStrength)); 
        vec4 direction = vec4(0.0, halfRootAngleSin, 0.0, halfRootAngleCos);
        direction = slerp(direction, orientation, frc);
        vec3 vPosition = vec3(position.x, position.y + position.y * stretch, position.z);
        vPosition = rotateVectorByQuaternion(vPosition, direction);
      
       float halfAngle = noise * 0.15;
        vPosition = rotateVectorByQuaternion(vPosition, normalize(vec4(sin(halfAngle), 0.0, -sin(halfAngle), cos(halfAngle))));
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(offset + vPosition, 1.0 );
      }
`;

const fragmentShader = `
      precision lowp float;
      uniform sampler2D map;
      uniform sampler2D alphaMap;
      uniform vec3 tipColor;
      uniform vec3 bottomColor;
      varying vec2 vUv;
      varying float frc;
      
      void main() {
        float alpha = texture2D(alphaMap, vUv).r;
        if(alpha < 0.15) discard;
        vec4 col = vec4(texture2D(map, vUv));
        col = mix(vec4(tipColor, 1.0), col, frc);
        col = mix(vec4(bottomColor, 1.0), col, frc);
        gl_FragColor = col;
    }
`;


    const grassMaterial = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader ,
        uniforms: {
            time: { value: 0.0 },
            bladeHeight: { value: 1.0 },
            map: { value: bladediffuse },
            alphaMap: { value: bladealpha },
            transparent: true,
            grassColorTop: { value: new THREE.Color(0x6acd5d) },  
            grassColorBottom: { value: new THREE.Color(0x2f7f31) }, 
            windIntensity: { value: 5.0 }
        },
       
        side: THREE.DoubleSide
    });
    //debug
    const params = {
        windIntensity: grassMaterial.uniforms.windIntensity.value 
    };

    gui.add(params, 'windIntensity', 0, 10).step(0.1).onChange((value) => {
        grassMaterial.uniforms.windIntensity.value = value;
    });

    const terrainSize = 100;
    const grassCount = instances;
    const instancedGeom = new THREE.InstancedBufferGeometry().copy(baseGeom);
const offsets = new Float32Array(grassCount * 3);
const orientations = new Float32Array(grassCount * 4);
const scales = new Float32Array(grassCount);
const windFactor = new Float32Array(grassCount);

for (let i = 0; i < grassCount; i++) {
  const x = (Math.random() - 0.5) * terrainSize;
  const z = (Math.random() - 0.5) * terrainSize;
  const y = getYPosition(x, z);

  offsets[i * 3] = x;
  offsets[i * 3 + 1] = y;
  offsets[i * 3 + 2] = z;

  const angle = Math.random() * Math.PI * 2;
  orientations[i * 4] = Math.sin(angle / 2);
  orientations[i * 4 + 1] = 0;
  orientations[i * 4 + 2] = Math.cos(angle / 2);
  orientations[i * 4 + 3] = 1;

  scales[i] = 0.5 + Math.random() * 0.5;
  windFactor[i] = Math.random();
}


instancedGeom.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(attributeData.offsets), 3));
instancedGeom.setAttribute('orientation', new THREE.InstancedBufferAttribute(new Float32Array(attributeData.orientations), 4));
instancedGeom.setAttribute('stretch', new THREE.InstancedBufferAttribute(new Float32Array(attributeData.stretches), 1));
instancedGeom.setAttribute('halfRootAngleSin', new THREE.InstancedBufferAttribute(new Float32Array(attributeData.halfRootAngleSin), 1));
instancedGeom.setAttribute('halfRootAngleCos', new THREE.InstancedBufferAttribute(new Float32Array(attributeData.halfRootAngleCos), 1));
    const grassMesh = new THREE.InstancedMesh(instancedGeom, grassMaterial, grassCount);
    scene.add(grassMesh);

   
    const groundMaterial = new THREE.MeshStandardMaterial({ color: '#000f00' });
    const ground = new THREE.Mesh(groundGeo, groundMaterial);
    scene.add(ground);

    const stats = new Stats();
    stats.showPanel(0); // 0: 
    document.body.appendChild(stats.dom);    
   


    let lastFrameTime = 0;
    function animate(now) {
        stats.begin();
        if (now - lastFrameTime > 16) { 
            grassMaterial.uniforms.time.value += 0.01;
            renderer.render(scene, camera);
            lastFrameTime = now;
        }
        stats.end();
        requestAnimationFrame(animate)
    }

    animate();

    window.addEventListener('resize', () => {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
    
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
    
        renderer.setSize(newWidth, newHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
    });
}


function getAttributeData(instances, width) {
    const offsets = []
    const orientations = []
    const stretches = []
    const halfRootAngleSin = []
    const halfRootAngleCos = []
  
    let quaternion_0 = new THREE.Vector4()
    let quaternion_1 = new THREE.Vector4()
  

    // The min and max angle for the growth direction (in radians)
   
    const min = -0.25
    const max = 0.25
  
    //For each instance of the grass blade
    for (let i = 0; i < instances; i++) {
    
      const offsetX = Math.random() * width - width / 2
      const offsetZ = Math.random() * width - width / 2
      const offsetY = getYPosition(offsetX, offsetZ)
      offsets.push(offsetX, offsetY, offsetZ)
  
    //Define random growth directions
    //Rotate around Y
      let angle = Math.PI - Math.random() * (2 * Math.PI)
      halfRootAngleSin.push(Math.sin(0.5 * angle))
      halfRootAngleCos.push(Math.cos(0.5 * angle))
     
      let RotationAxis = new THREE.Vector3(0, 1, 0)
      let x = RotationAxis.x * Math.sin(angle / 2.0)
      let y = RotationAxis.y * Math.sin(angle / 2.0)
      let z = RotationAxis.z * Math.sin(angle / 2.0)
      let w = Math.cos(angle / 2.0)
      quaternion_0.set(x, y, z, w).normalize()
  
      //Rotate around X
      angle = Math.random() * (max - min) + min
      RotationAxis = new THREE.Vector3(1, 0, 0)
      x = RotationAxis.x * Math.sin(angle / 2.0)
      y = RotationAxis.y * Math.sin(angle / 2.0)
      z = RotationAxis.z * Math.sin(angle / 2.0)
      w = Math.cos(angle / 2.0)
      quaternion_1.set(x, y, z, w).normalize()
  
        //Combine rotations to a single quaternion
      quaternion_0 = multiplyQuaternions(quaternion_0, quaternion_1)
  
    //Rotate around z
      angle = Math.random() * (max - min) + min
      RotationAxis = new THREE.Vector3(0, 0, 1)
      x = RotationAxis.x * Math.sin(angle / 2.0)
      y = RotationAxis.y * Math.sin(angle / 2.0)
      z = RotationAxis.z * Math.sin(angle / 2.0)
      w = Math.cos(angle / 2.0)
      quaternion_1.set(x, y, z, w).normalize()
  
   //Combine rotations to a single quaternion
      quaternion_0 = multiplyQuaternions(quaternion_0, quaternion_1)
  
      orientations.push(quaternion_0.x, quaternion_0.y, quaternion_0.z, quaternion_0.w)

  //Define variety in height
     
      if (i < instances / 3) {
        stretches.push(Math.random() * 1.8)
      } else {
        stretches.push(Math.random())
      }
    }
  
    return {
      offsets,
      orientations,
      stretches,
      halfRootAngleCos,
      halfRootAngleSin,
    }
  }
  
  function multiplyQuaternions(q1, q2) {
    const x = q1.x * q2.w + q1.y * q2.z - q1.z * q2.y + q1.w * q2.x
    const y = -q1.x * q2.z + q1.y * q2.w + q1.z * q2.x + q1.w * q2.y
    const z = q1.x * q2.y - q1.y * q2.x + q1.z * q2.w + q1.w * q2.z
    const w = -q1.x * q2.x - q1.y * q2.y - q1.z * q2.z + q1.w * q2.w
    return new THREE.Vector4(x, y, z, w)
  }
  
  function getYPosition(x, z) {
    var y = 2 * simplex.noise2D(x / 50, z / 50)
    y += 4 * simplex.noise2D(x / 100, z / 100)
    y += 0.2 * simplex.noise2D(x / 10, z / 10)
    return y
  }


createGrass({});