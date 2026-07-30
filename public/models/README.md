# Thư mục chứa File Model 3D (.glb / .gltf)

Thư mục này được dùng để lưu trữ các file mô hình 3D định dạng `.glb` hoặc `.gltf`.

## Hướng dẫn sử dụng:
1. Bạn hãy chép/thả file `.glb` của mình vào thư mục này:
   `public/models/`

2. Ví dụ nếu bạn đặt file tên là `my_model.glb`, đường dẫn truy cập trong code Three.js / Vite sẽ là:
   `"/models/my_model.glb"`

3. Ví dụ cách load trong Three.js bằng `GLTFLoader`:
   ```typescript
   import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

   const loader = new GLTFLoader();
   loader.load('/models/my_model.glb', (gltf) => {
     scene.add(gltf.scene);
   });
   ```
