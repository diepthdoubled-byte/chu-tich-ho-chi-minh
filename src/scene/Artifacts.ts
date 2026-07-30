import * as THREE from 'three';

export interface ArtifactData {
  id: string;
  title: string;
  category: 'manuscripts' | 'relics' | 'multimedia';
  categoryLabel: string;
  description: string;
  position: THREE.Vector3;
  mesh: THREE.Group;
  initialY: number;
}

export class ArtifactFactory {
  public static createArtifacts(): ArtifactData[] {
    const artifacts: ArtifactData[] = [];

    // 1. Bản Thảo Tuyên Ngôn (Historical Scroll)
    const scrollGroup = this.createScrollMesh();
    artifacts.push({
      id: 'scroll-1',
      title: 'Bản Thảo Tuyên Độc Lập 1945',
      category: 'manuscripts',
      categoryLabel: 'BẢN THẢO QUỐC GIA',
      description: 'Văn kiện lịch sử vô giá đánh dấu mốc son chói lọi trong lịch sử dân tộc. Bản thảo được bảo tồn nguyên vẹn với nét chữ và dấu ấn vàng son.',
      position: new THREE.Vector3(-4, 1.6, -2),
      mesh: scrollGroup,
      initialY: 1.6
    });

    // 2. Viên Ngọc Tri Thức (Crystal of Memories)
    const crystalGroup = this.createCrystalMesh();
    artifacts.push({
      id: 'crystal-1',
      title: 'Khối Cầu Tri Thức & Ký Ức Số',
      category: 'multimedia',
      categoryLabel: 'TƯ LIỆU SỐ HÓA 3D',
      description: 'Lưu trữ hơn 10.000 hình ảnh, thước phim tư liệu quý giá được số hóa với độ phân giải cao, tái hiện sinh động hành trình lịch sử.',
      position: new THREE.Vector3(0, 1.8, -4),
      mesh: crystalGroup,
      initialY: 1.8
    });

    // 3. Cuốn Sách Di Sản (Historical Journal)
    const bookGroup = this.createBookMesh();
    artifacts.push({
      id: 'book-1',
      title: 'Nhật Ký Hành Trình Tìm Đường Cứu Nước',
      category: 'manuscripts',
      categoryLabel: 'TẬP DI BẢO TƯ LIỆU',
      description: 'Ghi chép lại những năm tháng hoạt động bôn ba qua nhiều quốc gia trên thế giới, đúc kết tư tưởng độc lập, tự do cho dân tộc.',
      position: new THREE.Vector3(4, 1.6, -2),
      mesh: bookGroup,
      initialY: 1.6
    });

    // 4. Chiếc Rương Di Vật (Relic Chest)
    const chestGroup = this.createChestMesh();
    artifacts.push({
      id: 'chest-1',
      title: 'Rương Di Vật Lịch Sử',
      category: 'relics',
      categoryLabel: 'DI VẬT NGUYÊN BẢN',
      description: 'Chứa đựng những vật dụng giản dị gắn liền với cuộc sống hàng ngày: chiếc máy đánh chữ cũ, bộ quần áo kaki và đôi dép cao su huyền thoại.',
      position: new THREE.Vector3(-2.5, 1.5, 2.5),
      mesh: chestGroup,
      initialY: 1.5
    });

    // 5. Bút Ngỗng & Nghiên Mực (Quill Pen)
    const quillGroup = this.createQuillMesh();
    artifacts.push({
      id: 'quill-1',
      title: 'Bút Tích & Văn Bản Lịch Sử',
      category: 'relics',
      categoryLabel: 'DI VẬT BÚT TÍCH',
      description: 'Biểu tượng của tri thức và ngòi bút chiến đấu sắc bén. Nơi sinh ra những tác phẩm văn học, bài báo luận thuyết đi vào lòng người.',
      position: new THREE.Vector3(2.5, 1.5, 2.5),
      mesh: quillGroup,
      initialY: 1.5
    });

    return artifacts;
  }

  // Helper: Create Pedestal for Artifacts
  public static createPedestal(): THREE.Group {
    const group = new THREE.Group();

    // Base Tier 1
    const baseGeo = new THREE.CylinderGeometry(0.9, 1.1, 0.3, 32);
    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0x1f1b26,
      roughness: 0.3,
      metalness: 0.6,
    });
    const baseMesh = new THREE.Mesh(baseGeo, marbleMat);
    baseMesh.position.y = 0.15;
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    group.add(baseMesh);

    // Column Tier 2
    const colGeo = new THREE.CylinderGeometry(0.7, 0.8, 1.0, 32);
    const colMesh = new THREE.Mesh(colGeo, marbleMat);
    colMesh.position.y = 0.8;
    colMesh.receiveShadow = true;
    colMesh.castShadow = true;
    group.add(colMesh);

    // Gold Trim Ring
    const ringGeo = new THREE.TorusGeometry(0.72, 0.03, 16, 64);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0x9B7B38,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x3d3012
    });
    const ringMesh = new THREE.Mesh(ringGeo, goldMat);
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.y = 1.3;
    group.add(ringMesh);

    return group;
  }

  private static createScrollMesh(): THREE.Group {
    const group = new THREE.Group();
    const scrollMat = new THREE.MeshStandardMaterial({
      color: 0xF4E8C1,
      roughness: 0.7,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xD4AF37,
      metalness: 0.8,
      roughness: 0.2
    });

    // Scroll Roll
    const cylGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.9, 32);
    const scrollCyl = new THREE.Mesh(cylGeo, scrollMat);
    scrollCyl.rotation.z = Math.PI / 3;
    group.add(scrollCyl);

    // Ribbon Ring
    const ribbonGeo = new THREE.TorusGeometry(0.13, 0.02, 16, 32);
    const ribbon = new THREE.Mesh(ribbonGeo, goldMat);
    ribbon.rotation.x = Math.PI / 2;
    group.add(ribbon);

    // Glowing aura light
    const pointLight = new THREE.PointLight(0xD4AF37, 2, 3);
    pointLight.position.set(0, 0.2, 0);
    group.add(pointLight);

    return group;
  }

  private static createCrystalMesh(): THREE.Group {
    const group = new THREE.Group();
    
    // Core Crystal Sphere
    const sphereGeo = new THREE.IcosahedronGeometry(0.4, 2);
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transmission: 0.85,
      opacity: 1,
      transparent: true,
      roughness: 0.1,
      ior: 1.5,
      thickness: 0.5,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5
    });
    const crystalMesh = new THREE.Mesh(sphereGeo, crystalMat);
    crystalMesh.name = 'rotatingCore';
    group.add(crystalMesh);

    // Orbit Ring
    const ringGeo = new THREE.TorusGeometry(0.6, 0.015, 16, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x9B7B38,
      metalness: 0.9,
      roughness: 0.1
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 4;
    ring.name = 'orbitRing';
    group.add(ring);

    // Blue light
    const light = new THREE.PointLight(0x38bdf8, 3, 4);
    group.add(light);

    return group;
  }

  private static createBookMesh(): THREE.Group {
    const group = new THREE.Group();

    // Cover
    const coverGeo = new THREE.BoxGeometry(0.6, 0.1, 0.8);
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x5c1d1d,
      roughness: 0.4
    });
    const cover = new THREE.Mesh(coverGeo, coverMat);
    group.add(cover);

    // Pages
    const pagesGeo = new THREE.BoxGeometry(0.56, 0.08, 0.76);
    const pagesMat = new THREE.MeshStandardMaterial({
      color: 0xfdf6e2,
      roughness: 0.9
    });
    const pages = new THREE.Mesh(pagesGeo, pagesMat);
    pages.position.set(0.01, 0.01, 0);
    group.add(pages);

    // Gold spine details
    const spineGeo = new THREE.BoxGeometry(0.02, 0.11, 0.81);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.8 });
    const spine = new THREE.Mesh(spineGeo, goldMat);
    spine.position.x = -0.3;
    group.add(spine);

    group.rotation.x = 0.3;
    group.rotation.y = -0.4;

    const light = new THREE.PointLight(0xffb703, 1.5, 3);
    group.add(light);

    return group;
  }

  private static createChestMesh(): THREE.Group {
    const group = new THREE.Group();

    // Main Box
    const boxGeo = new THREE.BoxGeometry(0.7, 0.4, 0.45);
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: 0x4a3b2c,
      roughness: 0.5,
      metalness: 0.7
    });
    const box = new THREE.Mesh(boxGeo, bronzeMat);
    group.add(box);

    // Lid Top
    const lidGeo = new THREE.CylinderGeometry(0.225, 0.225, 0.7, 16, 1, false, 0, Math.PI);
    const lid = new THREE.Mesh(lidGeo, bronzeMat);
    lid.rotation.z = Math.PI / 2;
    lid.position.y = 0.2;
    group.add(lid);

    // Lock ornament
    const lockGeo = new THREE.BoxGeometry(0.08, 0.1, 0.02);
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.9, roughness: 0.2 });
    const lock = new THREE.Mesh(lockGeo, goldMat);
    lock.position.set(0, 0.05, 0.23);
    group.add(lock);

    return group;
  }

  private static createQuillMesh(): THREE.Group {
    const group = new THREE.Group();

    // Ink bottle
    const bottleGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.25, 16);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0.2,
      metalness: 0.8
    });
    const bottle = new THREE.Mesh(bottleGeo, glassMat);
    bottle.position.set(-0.15, 0, 0);
    group.add(bottle);

    // Feather quill
    const featherGeo = new THREE.ConeGeometry(0.08, 0.7, 8);
    const featherMat = new THREE.MeshStandardMaterial({
      color: 0xFAF6EF,
      roughness: 0.8
    });
    const feather = new THREE.Mesh(featherGeo, featherMat);
    feather.position.set(0.1, 0.25, 0);
    feather.rotation.z = -0.5;
    group.add(feather);

    return group;
  }
}
