import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { ArtifactFactory, ArtifactData } from './Artifacts';
import { getAssetUrl } from '../utils/url';

export type OnArtifactSelectCallback = (artifact: ArtifactData) => void;
export type OnArtSelectCallback = (artRawPath: string, artObject: THREE.Object3D) => void;

const RAYCAST_LAYER = 1;

export interface DoorLeaf {
  mesh: THREE.Object3D;
  initialRotationY: number;
  targetAngleY: number;
}

export interface DoorPair {
  name: string;
  leafL: DoorLeaf;
  leafR: DoorLeaf;
  isOpen: boolean;
}

export class ArchiveScene {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  private artifacts: ArtifactData[] = [];
  private pedestals: THREE.Group[] = [];
  private particlesMesh!: THREE.Points;
  private envModel: THREE.Group | null = null;
  private moveIconModel: THREE.Group | null = null;
  private artsHookModel: THREE.Group | null = null;
  private frameTemplates: { [key: string]: THREE.Group } = {};

  private doorPairs: DoorPair[] = [];
  private doorMeshes: THREE.Mesh[] = [];
  private hoveredDoor: DoorPair | null = null;

  private wallMeshes: THREE.Mesh[] = [];
  private groundMeshes: THREE.Mesh[] = [];
  private raycastTargets: THREE.Object3D[] = [];

  private raycaster: THREE.Raycaster;
  private wallRaycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private hoveredArtifact: ArtifactData | null = null;
  private selectedArtifact: ArtifactData | null = null;
  private hoveredArt: { rawPath: string; object: THREE.Object3D } | null = null;
  private groundTargetPos: THREE.Vector3 | null = null;
  private targetCamPos: THREE.Vector3 | null = null;

  private onSelectCallback?: OnArtifactSelectCallback;
  private onArtSelectCallback?: OnArtSelectCallback;
  private animationFrameId: number = 0;
  private clock: THREE.Clock;

  // Camera Rotation & Mouse State
  private isRightMouseDown: boolean = false;
  private previousMousePosition = { x: 0, y: 0 };
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');

  // Keyboard Movement States
  private moveForward: boolean = false;
  private moveBackward: boolean = false;
  private moveLeft: boolean = false;
  private moveRight: boolean = false;

  // Mobile Touch & Joystick State
  private isTouchDragging: boolean = false;
  private touchStartPos = { x: 0, y: 0 };
  private lastTouchPos = { x: 0, y: 0 };
  private touchStartTime: number = 0;
  private totalTouchDist: number = 0;
  private joystickVector = { x: 0, y: 0 };

  private moveSpeed: number = 6.0;
  private clickMoveSpeed: number = 2.8; // Smooth & controlled walking speed in m/s
  private playerRadius: number = 0.6;
  private playerEyeHeight: number = 1.6;

  // 3D Model & Texture Loading Manager State
  private loadingManager: THREE.LoadingManager;
  private dracoLoader: DRACOLoader;
  private targetLoadingProgress: number = 0;
  private currentLoadingProgress: number = 0;
  private isFinishedLoading: boolean = false;

  private loadingScreenEl: HTMLElement | null = null;
  private loadingBarFillEl: HTMLElement | null = null;
  private loadingStatusEl: HTMLElement | null = null;
  private loadingPercentageEl: HTMLElement | null = null;
  private loadingDetailsEl: HTMLElement | null = null;

  constructor(
    container: HTMLElement,
    canvas: HTMLCanvasElement,
    onSelect?: OnArtifactSelectCallback,
    onArtSelect?: OnArtSelectCallback
  ) {
    this.container = container;
    this.canvas = canvas;
    this.onSelectCallback = onSelect;
    this.onArtSelectCallback = onArtSelect;
    this.clock = new THREE.Clock();

    // 0. Setup Loading Manager & DOM Elements
    this.loadingScreenEl = document.getElementById('loading-screen');
    this.loadingBarFillEl = document.getElementById('loading-bar-fill');
    this.loadingStatusEl = document.getElementById('loading-status');
    this.loadingPercentageEl = document.getElementById('loading-percentage');
    this.loadingDetailsEl = document.getElementById('loading-details');

    this.dracoLoader = new DRACOLoader();
    this.dracoLoader.setDecoderPath(getAssetUrl('/draco/gltf/'));

    this.loadingManager = new THREE.LoadingManager();
    this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
      this.handleLoadingProgress(url, itemsLoaded, itemsTotal);
    };
    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      this.handleLoadingProgress(url, itemsLoaded, itemsTotal);
    };
    this.loadingManager.onLoad = () => {
      this.targetLoadingProgress = 100;
    };
    this.loadingManager.onError = (url) => {
      console.warn(`⚠️ Asset load warning/error for: ${url}`);
    };

    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0b0914, 0.015);

    // 2. Camera Setup (Starting position at 0, 1.6, 0)
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(0, this.playerEyeHeight, 0);
    this.camera.rotation.order = 'YXZ';

    // 3. Renderer Setup
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    // 4. Raycasters & Mouse Vector
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(RAYCAST_LAYER);
    this.wallRaycaster = new THREE.Raycaster();
    this.wallRaycaster.layers.set(RAYCAST_LAYER);
    this.mouse = new THREE.Vector2(-999, -999);

    // 5. Build World
    this.initLights();
    this.createGroundCollider();
    // this.createFallbackWallColliders();
    this.loadHDR(getAssetUrl('/mainroom.hdr'));
    this.loadEnvironmentModel(getAssetUrl('/models/env.glb'));
    this.loadMoveIcon(getAssetUrl('/models/move_icon.glb'));
    this.loadDoorsModel(getAssetUrl('/models/doors.glb'));
    this.loadArtsHookModel(getAssetUrl('/models/arts_hook.glb'));

    // 6. Event Listeners & Touch Controls
    window.addEventListener('resize', this.onResize.bind(this));
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));

    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('click', this.onClick.bind(this));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.setupTouchEvents();
    this.setupJoystick();

    // 7. Start Loop
    this.animate();
  }

  private handleLoadingProgress(url: string, itemsLoaded: number, itemsTotal: number): void {
    const rawPercent = Math.min(100, Math.round((itemsLoaded / itemsTotal) * 100));
    if (rawPercent > this.targetLoadingProgress) {
      this.targetLoadingProgress = rawPercent;
    }

    const formattedMsg = this.formatAssetLoadingMessage(url);
    if (this.loadingStatusEl) {
      this.loadingStatusEl.textContent = formattedMsg;
    }
    if (this.loadingDetailsEl) {
      this.loadingDetailsEl.textContent = `Đang tải: ${itemsLoaded}/${itemsTotal} tài nguyên 3D & kết cấu`;
    }
  }

  private formatAssetLoadingMessage(url: string): string {
    const cleanUrl = url.split('?')[0];
    const fileName = cleanUrl.split('/').pop() || url;

    if (fileName.endsWith('.hdr')) {
      return `Đang tải môi trường ánh sáng (${fileName})`;
    } else if (fileName === 'env.glb') {
      return `Đang tải kiến trúc 3D không gian chính`;
    } else if (fileName === 'doors.glb') {
      return `Đang tải mô hình cửa tương tác 3D`;
    } else if (fileName === 'move_icon.glb') {
      return `Đang tải biểu tượng bước chân 3D`;
    } else if (fileName === 'arts_hook.glb') {
      return `Đang tải vị trí trưng bày di sản 3D`;
    } else if (fileName.startsWith('Frame_')) {
      return `Đang tải mô hình khung tranh 3D (${fileName})`;
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(fileName)) {
      return `Đang tải kết cấu tư liệu: ${fileName}`;
    }
    return `Đang tải tài nguyên: ${fileName}`;
  }

  private initLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0001;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x88bbff, 1.2);
    fillLight.position.set(-20, 20, -20);
    this.scene.add(fillLight);
  }

  private registerRaycastTarget(object: THREE.Object3D): void {
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.layers.enable(RAYCAST_LAYER);
      }
    });
    if (!this.raycastTargets.includes(object)) {
      this.raycastTargets.push(object);
    }
  }

  private createGroundCollider(): void {
    // Primary ground object plane explicitly named "Ground"
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshBasicMaterial({ visible: false });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.name = 'Ground';
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    this.scene.add(groundMesh);
    this.groundMeshes.push(groundMesh);
    this.registerRaycastTarget(groundMesh);
  }

  private createFallbackWallColliders(): void {
    const wallMaterial = new THREE.MeshBasicMaterial({ visible: false });
    const roomSize = 30;
    const wallHeight = 10;

    // North Wall (+Z)
    const nWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, wallHeight), wallMaterial);
    nWall.name = 'Env_Wall';
    nWall.position.set(0, wallHeight / 2, roomSize / 2);
    nWall.rotation.y = Math.PI;

    // South Wall (-Z)
    const sWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, wallHeight), wallMaterial);
    sWall.name = 'Env_Wall';
    sWall.position.set(0, wallHeight / 2, -roomSize / 2);

    // East Wall (+X)
    const eWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, wallHeight), wallMaterial);
    eWall.name = 'Env_Wall';
    eWall.position.set(roomSize / 2, wallHeight / 2, 0);
    eWall.rotation.y = -Math.PI / 2;

    // West Wall (-X)
    const wWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, wallHeight), wallMaterial);
    wWall.name = 'Env_Wall';
    wWall.position.set(-roomSize / 2, wallHeight / 2, 0);
    wWall.rotation.y = Math.PI / 2;

    [nWall, sWall, eWall, wWall].forEach((w) => {
      this.scene.add(w);
      this.wallMeshes.push(w);
      this.registerRaycastTarget(w);
    });
  }

  private loadHDR(url: string): void {
    const rgbeLoader = new RGBELoader(this.loadingManager);
    rgbeLoader.load(
      url,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = texture;
        this.scene.background = texture;
        console.log('✅ Loaded HDR mainroom.hdr successfully into scene:', url);
      },
      undefined,
      (error) => {
        console.error('❌ Failed to load mainroom.hdr:', error);
      }
    );
  }

  private createGLTFLoader(): GLTFLoader {
    const loader = new GLTFLoader(this.loadingManager);
    loader.setDRACOLoader(this.dracoLoader);
    return loader;
  }

  private loadEnvironmentModel(url: string): void {
    const loader = this.createGLTFLoader();

    loader.load(
      url,
      (gltf) => {
        if (this.envModel) {
          this.scene.remove(this.envModel);
        }

        const model = gltf.scene;
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.wallMeshes.push(mesh);

            // Kiểm tra vật liệu của mesh, nếu có aoMap thì set UV channel 1 (channel = 0 trong Three.js)
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach((mat) => {
              if (mat && 'aoMap' in mat && (mat as THREE.MeshStandardMaterial).aoMap) {
                const stdMat = mat as THREE.MeshStandardMaterial;
                if (stdMat.aoMap) {
                  stdMat.aoMap.channel = 1; // UV channel 1
                  stdMat.needsUpdate = true;
                }
              }
            });

            if (mesh.geometry && mesh.geometry.attributes.uv && !mesh.geometry.attributes.uv2) {
              mesh.geometry.attributes.uv2 = mesh.geometry.attributes.uv;
            }

            const nameLower = mesh.name.toLowerCase();
            if (nameLower.includes('ground') || nameLower.includes('floor')) {
              mesh.name = 'Ground';
              this.groundMeshes.push(mesh);
            } else {
              mesh.name = 'Env_Wall';
            }
          }
        });

        this.envModel = model;
        this.scene.add(model);
        this.registerRaycastTarget(model);
        console.log('✅ Loaded env.glb model successfully into scene:', model);
      },
      undefined,
      (error) => {
        console.error('❌ Failed to load env.glb:', error);
      }
    );
  }

  private loadDoorsModel(url: string): void {
    const loader = this.createGLTFLoader();

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;

        const leafMap: Map<string, { L?: THREE.Object3D; R?: THREE.Object3D }> = new Map();

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.doorMeshes.push(mesh);
            this.wallMeshes.push(mesh);
          }

          const name = child.name;
          if (name.endsWith('_L') || name.endsWith('_R')) {
            const isL = name.endsWith('_L');
            const prefix = name.substring(0, name.length - 2);

            if (!leafMap.has(prefix)) {
              leafMap.set(prefix, {});
            }
            const pair = leafMap.get(prefix)!;
            if (isL) pair.L = child;
            else pair.R = child;
          }
        });

        this.scene.add(model);
        this.registerRaycastTarget(model);

        leafMap.forEach((leaves, prefix) => {
          if (!leaves.L || !leaves.R) return;

          const leafLObj = leaves.L;
          const leafRObj = leaves.R;

          leafLObj.userData.doorPairName = prefix;
          leafRObj.userData.doorPairName = prefix;

          const doorPair: DoorPair = {
            name: prefix,
            leafL: {
              mesh: leafLObj,
              initialRotationY: leafLObj.rotation.y,
              targetAngleY: leafLObj.rotation.y
            },
            leafR: {
              mesh: leafRObj,
              initialRotationY: leafRObj.rotation.y,
              targetAngleY: leafRObj.rotation.y
            },
            isOpen: false
          };

          this.doorPairs.push(doorPair);
        });

        console.log('✅ Loaded doors.glb successfully (direct object rotation):', this.doorPairs);
      },
      undefined,
      (error) => {
        console.error('❌ Failed to load doors.glb:', error);
      }
    );
  }

  private loadArtsHookModel(url: string): void {
    const loader = this.createGLTFLoader();
    const textureLoader = new THREE.TextureLoader(this.loadingManager);

    // 1. Tải 3 mẫu khung tranh GLB tương ứng với các tỷ lệ
    const framePaths = {
      horizon: getAssetUrl('/models/Frame_Horizon.glb'),
      portal: getAssetUrl('/models/Frame_portal.glb'),
      square: getAssetUrl('/models/Frame_square.glb'),
    };

    const loadFrameTemplate = (key: string, path: string) => {
      return new Promise<void>((resolve, reject) => {
        loader.load(
          path,
          (gltf) => {
            this.frameTemplates[key] = gltf.scene;
            resolve();
          },
          undefined,
          (err) => reject(err)
        );
      });
    };

    Promise.all([
      loadFrameTemplate('horizon', framePaths.horizon),
      loadFrameTemplate('portal', framePaths.portal),
      loadFrameTemplate('square', framePaths.square),
    ])
      .then(() => {
        // 2. Sau khi 3 mẫu khung tranh được tải xong, tải file arts_hook.glb
        loader.load(
          url,
          (gltf) => {
            if (this.artsHookModel) {
              this.scene.remove(this.artsHookModel);
            }

            const model = gltf.scene;

            const artLoadPromises: Promise<{ child: THREE.Object3D; frameInstance: THREE.Group } | null>[] = [];

            model.traverse((child) => {
              const hasPath = child.userData && child.userData.path && typeof child.userData.path === 'string';
              const customUrl: string | undefined =
                child.userData?.url ||
                child.userData?.URL ||
                child.userData?.Url ||
                child.userData?.extras?.url ||
                child.userData?.extras?.URL ||
                child.userData?.extras?.Url;

              if (hasPath || customUrl) {
                const rawPath: string = child.userData.path || '';
                let cleanPath = rawPath.replace(/\\/g, '/');
                if (cleanPath.startsWith('public/')) {
                  cleanPath = cleanPath.substring(6);
                }
                if (cleanPath && !cleanPath.startsWith('/')) {
                  cleanPath = '/' + cleanPath;
                }

                child.userData.isArt = true;
                child.userData.artRawPath = rawPath;
                child.userData.artCleanPath = cleanPath;
                if (customUrl) {
                  child.userData.url = customUrl;
                }

                if (cleanPath) {
                  const promise = new Promise<{ child: THREE.Object3D; frameInstance: THREE.Group } | null>((resolve) => {
                    textureLoader.load(
                      getAssetUrl(cleanPath),
                      (texture) => {
                        texture.colorSpace = THREE.SRGBColorSpace;

                        const imgWidth = texture.image.width || 1;
                        const imgHeight = texture.image.height || 1;
                        const aspect = imgWidth / imgHeight;

                        // Chọn khung tương ứng tỷ lệ gần nhất: 1.5 (Horizon - 3:2), 2/3 (Portal - 2:3), 1.0 (Square - 1:1)
                        const diffH = Math.abs(aspect - 1.5);
                        const diffP = Math.abs(aspect - 2 / 3);
                        const diffS = Math.abs(aspect - 1.0);

                        let frameKey: string;
                        let rawW: number;
                        let rawH: number;

                        if (diffH <= diffS && diffH <= diffP) {
                          frameKey = 'horizon';
                          rawW = 3.0;
                          rawH = 2.0;
                        } else if (diffP <= diffS && diffP <= diffH) {
                          frameKey = 'portal';
                          rawW = 2.0;
                          rawH = 3.0;
                        } else {
                          frameKey = 'square';
                          rawW = 2.0;
                          rawH = 2.0;
                        }

                        const template = this.frameTemplates[frameKey];
                        if (!template) {
                          resolve(null);
                          return;
                        }

                        // Nhân bản khung tranh
                        const frameInstance = template.clone(true);

                        // Gán texture cho material 'Art' & userData để nhận diện Raycast click
                        frameInstance.traverse((node) => {
                          if ((node as THREE.Mesh).isMesh) {
                            const mesh = node as THREE.Mesh;
                            mesh.castShadow = true;
                            mesh.receiveShadow = true;

                            mesh.userData.isArt = true;
                            mesh.userData.artRawPath = rawPath;
                            mesh.userData.artCleanPath = cleanPath;
                            mesh.userData.parentHook = child;
                            if (customUrl) {
                              mesh.userData.url = customUrl;
                            }

                            if (Array.isArray(mesh.material)) {
                              mesh.material = mesh.material.map((mat) => {
                                if (mat.name === 'Art' || mat.name.toLowerCase().includes('art')) {
                                  const newMat = (mat as THREE.MeshStandardMaterial).clone();
                                  newMat.map = texture;
                                  newMat.color = new THREE.Color(0xffffff);
                                  newMat.needsUpdate = true;
                                  return newMat;
                                }
                                return mat;
                              });
                            } else if (mesh.material) {
                              if (mesh.material.name === 'Art' || mesh.material.name.toLowerCase().includes('art')) {
                                const newMat = (mesh.material as THREE.MeshStandardMaterial).clone();
                                newMat.map = texture;
                                newMat.color = new THREE.Color(0xffffff);
                                newMat.needsUpdate = true;
                                mesh.material = newMat;
                              }
                            }
                          }
                        });

                        // Scale khung tranh để khớp chuẩn với tỷ lệ bức hình
                        const targetHeight = 1.2;
                        const targetWidth = targetHeight * aspect;
                        const scaleX = targetWidth / rawW;
                        const scaleY = targetHeight / rawH;
                        const scaleZ = scaleY;

                        frameInstance.scale.set(scaleX, scaleY, scaleZ);
                        frameInstance.rotation.x = -Math.PI / 2; // Dựng đứng khung tranh vuông góc mặt sàn
                        frameInstance.name = `ArtFrame_${child.name}`;

                        this.registerRaycastTarget(frameInstance);
                        child.add(frameInstance);
                        resolve({ child, frameInstance });
                      },
                      undefined,
                      (err) => {
                        console.error(`❌ Failed to load art texture at ${cleanPath}:`, err);
                        resolve(null);
                      }
                    );
                  });
                  artLoadPromises.push(promise);
                }
              }
            });

            this.artsHookModel = model;
            this.scene.add(model);
            this.registerRaycastTarget(model);

            // 3. Tự động tính toán khoảng cách giữa các art và điều chỉnh kích thước để tránh chồng lấn
            Promise.all(artLoadPromises).then((results) => {
              const loadedFrames = results.filter(
                (item): item is { child: THREE.Object3D; frameInstance: THREE.Group } => item !== null
              );
              this.adjustArtFrameSizesAndSpacing(loadedFrames);
            });

            console.log('✅ Loaded arts_hook.glb and 3D art frames successfully:', model);
          },
          undefined,
          (error) => {
            console.error('❌ Failed to load arts_hook.glb:', error);
          }
        );
      })
      .catch((err) => {
        console.error('❌ Failed to load frame templates:', err);
      });
  }

  /**
   * Tự động tính toán khoảng cách giữa các khung tranh art trong không gian 3D.
   * Nếu 2 bức tranh đứng gần nhau có nguy cơ chồng lấn hoặc vượt quá khoảng cách tối thiểu (margin),
   * hệ thống sẽ tự động điều chỉnh tỷ lệ scale của các khung tranh để đảm bảo khoảng cách hiển thị hợp lý.
   */
  private adjustArtFrameSizesAndSpacing(
    loadedFrames: Array<{ child: THREE.Object3D; frameInstance: THREE.Group }>
  ): void {
    if (!loadedFrames || loadedFrames.length === 0) return;

    // Cập nhật matrix world để tính toán chính xác vị trí và bounding box trong không gian 3D
    this.scene.updateMatrixWorld(true);

    interface FrameDataItem {
      child: THREE.Object3D;
      frameInstance: THREE.Group;
      worldPos: THREE.Vector3;
      size: THREE.Vector3;
    }

    const items: FrameDataItem[] = loadedFrames.map((lf) => {
      const worldPos = new THREE.Vector3();
      lf.frameInstance.getWorldPosition(worldPos);

      const box = new THREE.Box3().setFromObject(lf.frameInstance);
      const size = new THREE.Vector3();
      box.getSize(size);

      return {
        child: lf.child,
        frameInstance: lf.frameInstance,
        worldPos,
        size,
      };
    });

    const MIN_GAP = 0.2; // Khoảng cách tối thiểu 20cm giữa 2 viền bức tranh
    const MIN_SCALE = 0.35; // Giới hạn thu nhỏ tối thiểu (35%) để tranh không bị bé quá
    const scales = new Array<number>(items.length).fill(1.0);

    // Vòng lặp giải nén (relaxation iterations) để tính toán tỷ lệ scale không chồng lấn
    const maxPasses = 5;
    for (let pass = 0; pass < maxPasses; pass++) {
      let adjustedAny = false;

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const itemA = items[i];
          const itemB = items[j];

          const diff = new THREE.Vector3().subVectors(itemB.worldPos, itemA.worldPos);
          const dist = diff.length();

          // Chỉ xét các cặp art nằm trong bán kính 6m
          if (dist < 0.001 || dist > 6.0) continue;

          const dir = diff.clone().normalize();

          // Bán kính/nửa kích thước hình chiếu của tranh dọc theo hướng liên kết
          const rA = 0.5 * (Math.abs(dir.x) * itemA.size.x + Math.abs(dir.y) * itemA.size.y + Math.abs(dir.z) * itemA.size.z);
          const rB = 0.5 * (Math.abs(dir.x) * itemB.size.x + Math.abs(dir.y) * itemB.size.y + Math.abs(dir.z) * itemB.size.z);

          const currentSpan = rA * scales[i] + rB * scales[j] + MIN_GAP;

          if (currentSpan > dist) {
            const maxAllowedSpan = Math.max(0.01, dist - MIN_GAP);
            const requiredScaleFactor = maxAllowedSpan / (rA * scales[i] + rB * scales[j]);

            if (requiredScaleFactor < 1.0) {
              const newScaleA = Math.max(MIN_SCALE, scales[i] * requiredScaleFactor);
              const newScaleB = Math.max(MIN_SCALE, scales[j] * requiredScaleFactor);

              if (newScaleA < scales[i] || newScaleB < scales[j]) {
                scales[i] = newScaleA;
                scales[j] = newScaleB;
                adjustedAny = true;
              }
            }
          }
        }
      }

      if (!adjustedAny) break;
    }

    // Áp dụng tỷ lệ scale đã tính toán vào 3D Mesh
    items.forEach((item, idx) => {
      const scaleFactor = scales[idx];
      if (scaleFactor < 0.999) {
        item.frameInstance.scale.multiplyScalar(scaleFactor);
        console.log(
          `📐 Auto-adjusted art frame size [${item.child.name}] by ${(scaleFactor * 100).toFixed(1)}% to prevent overlap.`
        );
      }
    });

    // Cập nhật lại matrix world sau khi scale
    this.scene.updateMatrixWorld(true);
  }

  public toggleDoor(doorPair: DoorPair): void {
    doorPair.isOpen = !doorPair.isOpen;
    const deg7InRad = (12 * Math.PI) / 180;
    if (doorPair.isOpen) {
      doorPair.leafL.targetAngleY = doorPair.leafL.initialRotationY + deg7InRad;
      doorPair.leafR.targetAngleY = doorPair.leafR.initialRotationY - deg7InRad;
    } else {
      doorPair.leafL.targetAngleY = doorPair.leafL.initialRotationY;
      doorPair.leafR.targetAngleY = doorPair.leafR.initialRotationY;
    }
  }

  private loadMoveIcon(url: string): void {
    const loader = this.createGLTFLoader();

    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            if (mesh.material) {
              const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
              mat.emissive = new THREE.Color(0xD4AF37);
              mat.emissiveIntensity = 0.8;
              mesh.material = mat;
            }
          }
        });

        model.scale.set(0.6, 0.6, 0.6);
        model.visible = false;
        this.moveIconModel = model;
        this.scene.add(model);
        console.log('✅ Loaded footstep model move_icon.glb:', model);
      },
      undefined,
      (error) => {
        console.warn('⚠️ Failed to load move_icon.glb, using fallback footstep marker:', error);
        this.createFallbackMoveIcon();
      }
    );
  }

  private createFallbackMoveIcon(): void {
    const group = new THREE.Group();

    // Ring marker
    const ringGeo = new THREE.RingGeometry(0.25, 0.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xD4AF37,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    group.add(ring);

    // Center dot
    const dotGeo = new THREE.CircleGeometry(0.12, 16);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xFFE082, side: THREE.DoubleSide });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    dot.rotation.x = -Math.PI / 2;
    group.add(dot);

    group.visible = false;
    this.moveIconModel = group;
    this.scene.add(group);
  }



  private onMouseDown(event: MouseEvent): void {
    if (event.button === 2) {
      // Right Click down -> start rotation
      this.isRightMouseDown = true;
      this.previousMousePosition = { x: event.clientX, y: event.clientY };
      this.canvas.style.cursor = 'grabbing';
    }
  }

  private onMouseUp(event: MouseEvent): void {
    if (event.button === 2) {
      // Right Click up -> stop rotation
      this.isRightMouseDown = false;
      this.canvas.style.cursor = this.hoveredArtifact || this.hoveredDoor || this.groundTargetPos ? 'pointer' : 'default';
    }
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Right Mouse Drag Rotation
    if (this.isRightMouseDown) {
      const deltaX = event.clientX - this.previousMousePosition.x;
      const deltaY = event.clientY - this.previousMousePosition.y;
      this.previousMousePosition = { x: event.clientX, y: event.clientY };

      const sensitivity = 0.003;
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= deltaX * sensitivity;
      this.euler.x -= deltaY * sensitivity;
      // Clamp pitch to prevent flipping
      this.euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.euler.x));

      this.camera.quaternion.setFromEuler(this.euler);
    }

    // Raycast check for artifacts & ground step icon
    this.updateMouseHover();
  }

  private onClick(event: MouseEvent): void {
    // Ignore non-left click
    if (event.button !== 0) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.updateMouseHover();

    this.handleTapAction();
  }

  private getRaycastTargets(): THREE.Object3D[] {
    return this.raycastTargets;
  }

  private handleTapAction(): void {
    // Perform raycast on click to log raycast object name
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.raycastTargets, true);
    if (intersects.length > 0) {
      const hitObj = intersects[0].object;
      console.log(`🎯 [Raycast Click] Object name: "${hitObj.name || '(unnamed)'}" | Parent: "${hitObj.parent?.name || ''}"`, hitObj);
    } else {
      console.log('🎯 [Raycast Click] No object hit');
    }

    if (this.hoveredArt) {
      if (this.onArtSelectCallback) {
        this.onArtSelectCallback(this.hoveredArt.rawPath, this.hoveredArt.object);
      }
      return;
    }

    if (this.hoveredArtifact) {
      this.focusOnArtifact(this.hoveredArtifact);
      if (this.onSelectCallback) {
        this.onSelectCallback(this.hoveredArtifact);
      }
      return;
    }

    if (this.hoveredDoor) {
      this.toggleDoor(this.hoveredDoor);
      return;
    }

    // Click or Tap on Ground -> Smoothly walk to clicked position
    if (this.groundTargetPos) {
      this.targetCamPos = new THREE.Vector3(
        this.groundTargetPos.x,
        this.playerEyeHeight,
        this.groundTargetPos.z
      );
    }
  }

  private setupTouchEvents(): void {
    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });
  }

  private onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.touchStartPos = { x: touch.clientX, y: touch.clientY };
      this.lastTouchPos = { x: touch.clientX, y: touch.clientY };
      this.touchStartTime = performance.now();
      this.totalTouchDist = 0;
      this.isTouchDragging = false;
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - this.lastTouchPos.x;
      const deltaY = touch.clientY - this.lastTouchPos.y;
      this.lastTouchPos = { x: touch.clientX, y: touch.clientY };

      this.totalTouchDist += Math.hypot(deltaX, deltaY);

      if (this.totalTouchDist > 8) {
        this.isTouchDragging = true;
        event.preventDefault(); // Prevent full page scrolling while dragging to look around

        const sensitivity = 0.003;
        this.euler.setFromQuaternion(this.camera.quaternion);
        this.euler.y -= deltaX * sensitivity;
        this.euler.x -= deltaY * sensitivity;
        this.euler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.euler.x));

        this.camera.quaternion.setFromEuler(this.euler);

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
        this.updateMouseHover();
      }
    }
  }

  private onTouchEnd(event: TouchEvent): void {
    if (!this.isTouchDragging && (performance.now() - this.touchStartTime) < 400) {
      const touch = event.changedTouches[0];
      if (touch) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

        this.updateMouseHover();
        this.handleTapAction();
      }
    }
  }

  private setupJoystick(): void {
    const joystickBase = document.getElementById('joystick-base');
    const joystickStick = document.getElementById('joystick-stick');
    if (!joystickBase || !joystickStick) return;

    let activeTouchId: number | null = null;
    let baseCenter = { x: 0, y: 0 };
    const maxRadius = 40;

    const updateJoystickPos = (clientX: number, clientY: number) => {
      const dx = clientX - baseCenter.x;
      const dy = clientY - baseCenter.y;
      const dist = Math.hypot(dx, dy);

      const angle = Math.atan2(dy, dx);
      const clampedDist = Math.min(dist, maxRadius);

      const stickX = Math.cos(angle) * clampedDist;
      const stickY = Math.sin(angle) * clampedDist;

      joystickStick.style.transform = `translate(${stickX}px, ${stickY}px)`;

      this.joystickVector = {
        x: stickX / maxRadius,
        y: -stickY / maxRadius // Invert Y so up is forward (+)
      };
    };

    const resetJoystick = () => {
      activeTouchId = null;
      joystickStick.style.transform = 'translate(0px, 0px)';
      this.joystickVector = { x: 0, y: 0 };
    };

    joystickBase.addEventListener('touchstart', (e: TouchEvent) => {
      if (activeTouchId !== null) return;
      const touch = e.changedTouches[0];
      activeTouchId = touch.identifier;

      const rect = joystickBase.getBoundingClientRect();
      baseCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      updateJoystickPos(touch.clientX, touch.clientY);
      e.stopPropagation();
      e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e: TouchEvent) => {
      if (activeTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === activeTouchId) {
          updateJoystickPos(touch.clientX, touch.clientY);
          e.preventDefault();
          break;
        }
      }
    }, { passive: false });

    window.addEventListener('touchend', (e: TouchEvent) => {
      if (activeTouchId === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === activeTouchId) {
          resetJoystick();
          break;
        }
      }
    });

    window.addEventListener('touchcancel', (e: TouchEvent) => {
      if (activeTouchId === null) return;
      resetJoystick();
    });

    // Mouse Drag support for testing Joystick on PC
    let isMouseDownOnJoystick = false;
    joystickBase.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.button !== 0) return;
      isMouseDownOnJoystick = true;
      const rect = joystickBase.getBoundingClientRect();
      baseCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };
      updateJoystickPos(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (isMouseDownOnJoystick) {
        updateJoystickPos(e.clientX, e.clientY);
      }
    });

    window.addEventListener('mouseup', () => {
      if (isMouseDownOnJoystick) {
        isMouseDownOnJoystick = false;
        resetJoystick();
      }
    });
  }

  private updateMouseHover(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.raycastTargets, true);

    if (intersects.length > 0) {
      const firstHit = intersects[0];
      const hitObj = firstHit.object;

      // 1. Check if hit object is an Art Artwork Frame
      let currArt: THREE.Object3D | null = hitObj;
      let foundArtRawPath: string | null = null;
      let foundArtHook: THREE.Object3D | null = null;

      while (currArt) {
        if (currArt.userData && currArt.userData.isArt && (currArt.userData.artRawPath || currArt.userData.url)) {
          foundArtRawPath = currArt.userData.artRawPath || '';
          foundArtHook = currArt.userData.parentHook || currArt;
          break;
        }
        currArt = currArt.parent;
      }

      if (foundArtRawPath && foundArtHook) {
        this.hoveredArt = { rawPath: foundArtRawPath, object: foundArtHook };
        this.hoveredArtifact = null;
        this.hoveredDoor = null;
        if (!this.isRightMouseDown) this.canvas.style.cursor = 'pointer';
        if (this.moveIconModel) this.moveIconModel.visible = false;
        this.groundTargetPos = null;
        return;
      }

      this.hoveredArt = null;

      // 2. Check if first hit object is an Artifact
      let artifactObj: THREE.Object3D | null = hitObj;
      let foundArtifact: ArtifactData | null = null;
      while (artifactObj && !artifactObj.userData?.artifactId && artifactObj.parent) {
        artifactObj = artifactObj.parent;
      }
      if (artifactObj && artifactObj.userData?.artifactId) {
        foundArtifact = this.artifacts.find((a) => a.id === artifactObj?.userData.artifactId) || null;
      }

      if (foundArtifact) {
        this.hoveredArtifact = foundArtifact;
        this.hoveredDoor = null;
        if (!this.isRightMouseDown) this.canvas.style.cursor = 'pointer';
        if (this.moveIconModel) this.moveIconModel.visible = false;
        this.groundTargetPos = null;
        return;
      }

      this.hoveredArtifact = null;

      // 3. Check if first hit object is a Door
      let doorObj: THREE.Object3D | null = hitObj;
      let foundDoorPair: DoorPair | null = null;
      while (doorObj) {
        if (doorObj.userData?.doorPairName) {
          foundDoorPair = this.doorPairs.find((d) => d.name === doorObj?.userData.doorPairName) || null;
          if (foundDoorPair) break;
        }
        doorObj = doorObj.parent;
      }

      if (foundDoorPair) {
        this.hoveredDoor = foundDoorPair;
        if (!this.isRightMouseDown) this.canvas.style.cursor = 'pointer';
        if (this.moveIconModel) this.moveIconModel.visible = false;
        this.groundTargetPos = null;
        return;
      }

      this.hoveredDoor = null;

      // 4. Check if the VERY FIRST intersected object is named "Ground"
      let isGroundFirst = false;
      let curr: THREE.Object3D | null = hitObj;
      while (curr) {
        if (curr.name === 'Ground' || curr.name.toLowerCase() === 'ground' || curr.name.toLowerCase().includes('ground')) {
          isGroundFirst = true;
          break;
        }
        curr = curr.parent;
      }

      if (isGroundFirst) {
        // The first intersected object IS Ground -> Show move icon
        this.groundTargetPos = firstHit.point.clone();
        if (this.moveIconModel) {
          this.moveIconModel.visible = true;
          this.moveIconModel.position.copy(firstHit.point);
          this.moveIconModel.position.y += 0.05;
        }
        if (!this.isRightMouseDown) this.canvas.style.cursor = 'pointer';
      } else {
        // The first intersected object is NOT Ground (e.g. wall, pedestal, column) -> HIDE move icon
        this.groundTargetPos = null;
        if (this.moveIconModel) {
          this.moveIconModel.visible = false;
        }
        if (!this.isRightMouseDown) this.canvas.style.cursor = 'default';
      }
    } else {
      // Raycast hits nothing -> HIDE move icon
      this.hoveredArt = null;
      this.hoveredArtifact = null;
      this.hoveredDoor = null;
      this.groundTargetPos = null;
      if (this.moveIconModel) {
        this.moveIconModel.visible = false;
      }
      if (!this.isRightMouseDown) this.canvas.style.cursor = 'default';
    }
  }

  private isDescendantOf(object: THREE.Object3D, parent: THREE.Object3D): boolean {
    let curr: THREE.Object3D | null = object.parent;
    while (curr) {
      if (curr === parent) return true;
      curr = curr.parent;
    }
    return false;
  }

  private onKeyDown(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = true;
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveForward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveBackward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveLeft = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveRight = false;
        break;
    }
  }

  public focusOnArt(artObject: THREE.Object3D): void {
    this.selectedArtifact = null;

    const artWorldPos = new THREE.Vector3();
    artObject.getWorldPosition(artWorldPos);

    const artWorldQuat = new THREE.Quaternion();
    artObject.getWorldQuaternion(artWorldQuat);

    // Calculate position 2 meters in front of the artwork
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(artWorldQuat);
    const destination = artWorldPos.clone().add(forward.multiplyScalar(2.0));
    destination.y = this.playerEyeHeight;

    this.targetCamPos = destination;

    const lookAtPos = artWorldPos.clone();
    lookAtPos.y = Math.max(1.2, lookAtPos.y);
    this.camera.lookAt(lookAtPos);
  }

  public focusOnArtifact(artifact: ArtifactData): void {
    this.selectedArtifact = artifact;
    const targetPos = artifact.position.clone();

    const cameraOffset = new THREE.Vector3(0, 0, 2.2);
    const destination = targetPos.clone().add(cameraOffset);
    destination.y = this.playerEyeHeight;

    this.targetCamPos = destination;
    this.camera.lookAt(targetPos);
  }

  public resetCameraView(): void {
    this.selectedArtifact = null;
    this.targetCamPos = new THREE.Vector3(0, this.playerEyeHeight, 0);
    this.euler.set(0, 0, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
  }

  public filterArtifacts(category: string): void {
    this.artifacts.forEach((artifact, index) => {
      const pedestal = this.pedestals[index];
      const match = category === 'all' || artifact.category === category;

      artifact.mesh.visible = match;
      pedestal.visible = match;
    });
  }

  private updatePlayerKeyboardMovement(delta: number): void {
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    cameraDirection.y = 0;
    cameraDirection.normalize();

    const sideDirection = new THREE.Vector3();
    sideDirection.crossVectors(this.camera.up, cameraDirection).negate().normalize();
    sideDirection.y = 0;

    let moveX = 0;
    let moveZ = 0;

    if (this.moveForward) moveZ += 1;
    if (this.moveBackward) moveZ -= 1;
    if (this.moveLeft) moveX -= 1;
    if (this.moveRight) moveX += 1;

    // Combine Joystick touch input
    moveX += this.joystickVector.x;
    moveZ += this.joystickVector.y;

    if (Math.abs(moveX) < 0.01 && Math.abs(moveZ) < 0.01) return;

    // Interrupt click-to-move if user manually presses movement keys or uses joystick
    this.targetCamPos = null;

    const intendedMove = new THREE.Vector3();
    intendedMove.addScaledVector(cameraDirection, moveZ);
    intendedMove.addScaledVector(sideDirection, moveX);

    if (intendedMove.lengthSq() > 1.0) {
      intendedMove.normalize();
    }
    intendedMove.multiplyScalar(this.moveSpeed * delta);

    const playerPos = this.camera.position.clone();
    const rayOrigin = new THREE.Vector3(playerPos.x, 1.0, playerPos.z);

    // Wall collision checks
    if (intendedMove.x !== 0) {
      const xDir = new THREE.Vector3(Math.sign(intendedMove.x), 0, 0);
      this.wallRaycaster.set(rayOrigin, xDir);
      this.wallRaycaster.far = Math.abs(intendedMove.x) + this.playerRadius;

      const intersectsX = this.wallRaycaster.intersectObjects(this.wallMeshes, true);
      if (intersectsX.length > 0) intendedMove.x = 0;
    }

    if (intendedMove.z !== 0) {
      const zDir = new THREE.Vector3(0, 0, Math.sign(intendedMove.z));
      const rayOriginZ = new THREE.Vector3(playerPos.x + intendedMove.x, 1.0, playerPos.z);
      this.wallRaycaster.set(rayOriginZ, zDir);
      this.wallRaycaster.far = Math.abs(intendedMove.z) + this.playerRadius;

      const intersectsZ = this.wallRaycaster.intersectObjects(this.wallMeshes, true);
      if (intersectsZ.length > 0) intendedMove.z = 0;
    }

    this.camera.position.x += intendedMove.x;
    this.camera.position.z += intendedMove.z;
    this.camera.position.y = this.playerEyeHeight;
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));

    const delta = this.clock.getDelta();
    const elapsedTime = this.clock.getElapsedTime();

    // 0. Update Loading Progress Bar & Smooth Fade-Out
    if (!this.isFinishedLoading) {
      if (this.currentLoadingProgress < this.targetLoadingProgress) {
        this.currentLoadingProgress += (this.targetLoadingProgress - this.currentLoadingProgress) * 0.12;
        if (this.targetLoadingProgress - this.currentLoadingProgress < 0.2) {
          this.currentLoadingProgress = this.targetLoadingProgress;
        }
      }

      const rounded = Math.floor(this.currentLoadingProgress);
      if (this.loadingBarFillEl) {
        this.loadingBarFillEl.style.width = `${rounded}%`;
      }
      if (this.loadingPercentageEl) {
        this.loadingPercentageEl.textContent = `${rounded}%`;
      }

      if (rounded >= 100) {
        this.isFinishedLoading = true;
        if (this.loadingStatusEl) {
          this.loadingStatusEl.textContent = 'Hoàn tất tải không gian 3D!';
        }
        if (this.loadingDetailsEl) {
          this.loadingDetailsEl.textContent = 'Đã sẵn sàng trải nghiệm di sản lịch sử!';
        }
        setTimeout(() => {
          this.loadingScreenEl?.classList.add('fade-out');
        }, 450);
      }
    }

    // 1. WASD & Touch Joystick Movement
    this.updatePlayerKeyboardMovement(delta);

    // 2. Smooth Controlled Speed to Target Position (Click/Tap on Ground)
    if (this.targetCamPos) {
      const dist = this.camera.position.distanceTo(this.targetCamPos);
      if (dist < 0.08) {
        this.camera.position.copy(this.targetCamPos);
        this.targetCamPos = null;
      } else {
        // Slow down smoothly when near destination (< 1.2m)
        const speed = Math.min(this.clickMoveSpeed, Math.max(0.8, dist * 2.2));
        const step = Math.min(dist, speed * delta);
        const moveDir = new THREE.Vector3()
          .subVectors(this.targetCamPos, this.camera.position)
          .normalize();
        this.camera.position.addScaledVector(moveDir, step);
      }
    }

    // 3. Pulse / Rotate Footstep moveIcon model
    if (this.moveIconModel && this.moveIconModel.visible) {
      this.moveIconModel.rotation.y = elapsedTime * 1.2;
      const pulseScale = 0.6 + Math.sin(elapsedTime * 4) * 0.05;
      this.moveIconModel.scale.set(pulseScale, pulseScale, pulseScale);
    }



    // 6. Doors Opening / Closing Animation (Direct mesh rotation from center)
    this.doorPairs.forEach((doorPair) => {
      doorPair.leafL.mesh.rotation.y += (doorPair.leafL.targetAngleY - doorPair.leafL.mesh.rotation.y) * 0.1;
      doorPair.leafR.mesh.rotation.y += (doorPair.leafR.targetAngleY - doorPair.leafR.mesh.rotation.y) * 0.1;
    });

    // 7. Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  private onResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  public dispose(): void {
    cancelAnimationFrame(this.animationFrameId);
    window.removeEventListener('resize', this.onResize.bind(this));
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.removeEventListener('keyup', this.onKeyUp.bind(this));
    window.removeEventListener('mouseup', this.onMouseUp.bind(this));
    this.dracoLoader.dispose();
    this.renderer.dispose();
  }
}
