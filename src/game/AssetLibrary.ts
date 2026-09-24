import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { AssetManifest } from "./types";
export class AnimatedAsset {
  readonly mixer: THREE.AnimationMixer;
  private current = "";
  constructor(
    readonly root: THREE.Group,
    private readonly clips: THREE.AnimationClip[],
  ) {
    this.mixer = new THREE.AnimationMixer(root);
  }
  play(name: string, once = false): void {
    if (name === this.current && !once) return;
    const clip = this.clips.find((c) => c.name === name);
    if (!clip) return;
    this.mixer.stopAllAction();
    const action = this.mixer.clipAction(clip).reset();
    action.setLoop(
      once ? THREE.LoopOnce : THREE.LoopRepeat,
      once ? 1 : Infinity,
    );
    action.clampWhenFinished = once;
    action.play();
    this.current = name;
  }
  update(dt: number): void {
    this.mixer.update(dt);
  }
}
export class AssetLibrary {
  private readonly loaded = new Map<string, GLTF>();
  async load(): Promise<void> {
    const base = import.meta.env.BASE_URL;
    const response = await fetch(base + "assets/models/manifest.json");
    if (!response.ok) throw new Error("The mall's assets could not be loaded.");
    const manifest = (await response.json()) as AssetManifest;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    await Promise.all(
      Object.entries(manifest.assets).map(async ([id, asset]) =>
        this.loaded.set(id, await loader.loadAsync(base + asset.url)),
      ),
    );
  }
  create(id: string): AnimatedAsset {
    const source = this.loaded.get(id);
    if (!source) throw new Error("Missing asset: " + id);
    const root = source.scene.clone(true);
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
        if (object.name.startsWith("eye"))
          object.material = new THREE.MeshBasicMaterial({ color: 0xdcd8b8 });
      }
    });
    return new AnimatedAsset(root, source.animations);
  }
}
