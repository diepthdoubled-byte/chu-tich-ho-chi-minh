import './style.css';
import { ArchiveScene } from './scene/ArchiveScene';
import { ArtifactData } from './scene/Artifacts';
import { ArtInfoService, ArtInfoResult } from './services/ArtInfoService';
import { SpeechService } from './services/SpeechService';
import { getAssetUrl } from './utils/url';
import * as THREE from 'three';

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.querySelector('.three-container') as HTMLElement;
  const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;

  if (!container || !canvas) {
    console.error('Three container or canvas not found!');
    return;
  }

  // Load Art Info Service & Speech Service
  const artInfoService = ArtInfoService.getInstance();
  await artInfoService.loadData();

  const speechService = SpeechService.getInstance();

  // Welcome Overlay Gateway (Handles user interaction for browser speech/audio autoplay policy)
  const welcomeOverlay = document.getElementById('welcome-overlay');
  const btnStartExperience = document.getElementById('btn-start-experience');

  function startExperience() {
    welcomeOverlay?.classList.remove('active');
    speechService.speakWelcome();
  }

  btnStartExperience?.addEventListener('click', startExperience);

  // Active States
  let activeArtifact: ArtifactData | null = null;
  let activeArtObject: THREE.Object3D | null = null;

  // Helper to extract custom "url" property from object, parent hook, or hierarchy
  function getArtCustomUrl(artObject: THREE.Object3D | null | undefined): string | null {
    if (!artObject) return null;

    const extractUrl = (obj: any): string | null => {
      if (!obj || !obj.userData) return null;
      const ud = obj.userData;
      const url = ud.url || ud.URL || ud.Url || ud.extras?.url || ud.extras?.URL || ud.extras?.Url;
      if (typeof url === 'string' && url.trim().length > 0) {
        return url.trim();
      }
      return null;
    };

    let url = extractUrl(artObject);
    if (url) return url;

    if (artObject.userData?.parentHook) {
      url = extractUrl(artObject.userData.parentHook);
      if (url) return url;
    }

    let foundChildUrl: string | null = null;
    artObject.traverse((child) => {
      if (!foundChildUrl) {
        foundChildUrl = extractUrl(child);
      }
    });
    if (foundChildUrl) return foundChildUrl;

    let curr = artObject.parent;
    while (curr) {
      url = extractUrl(curr);
      if (url) return url;
      curr = curr.parent;
    }

    return null;
  }

  // Initialize 3D Archive Scene
  const archiveScene = new ArchiveScene(
    container,
    canvas,
    (artifact: ArtifactData) => {
      openRelicModal(artifact);
    },
    (artRawPath: string, artObject: THREE.Object3D) => {
      const customUrl = getArtCustomUrl(artObject);
      if (customUrl) {
        let targetUrl = customUrl;
        if (!targetUrl.match(/^https?:\/\//i) && !targetUrl.startsWith('/')) {
          targetUrl = `https://${targetUrl}`;
        }
        console.log(`🔗 Opening custom URL: ${targetUrl}`);
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      openArtModal(artRawPath, artObject);
    }
  );

  // UI Element References - Header & Drawer
  const btnMenu = document.getElementById('btn-menu');
  const btnAction = document.getElementById('btn-action');
  const drawer = document.getElementById('sidebar-drawer');
  const drawerOverlay = document.getElementById('drawer-overlay');
  const btnCloseDrawer = document.getElementById('btn-close-drawer');

  const btnCamOverview = document.getElementById('btn-cam-overview');
  const btnCamReset = document.getElementById('btn-cam-reset');

  // UI Element References - Settings Panel Controls
  const speechToggle = document.getElementById('speech-toggle') as HTMLInputElement;
  const btnReplayWelcome = document.getElementById('btn-replay-welcome');

  if (speechToggle) {
    speechToggle.checked = speechService.isEnabled();
    speechToggle.addEventListener('change', (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      speechService.setEnabled(isChecked);
      showToast(isChecked ? 'Đã bật thuyết trình giọng nói' : 'Đã tắt thuyết trình giọng nói');
    });
  }

  btnReplayWelcome?.addEventListener('click', () => {
    speechService.speakWelcome();
    showToast('Đang phát lại lời chào mừng...');
    closeDrawer();
  });

  // UI Element References - Relic Modal
  const relicModal = document.getElementById('relic-modal');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalTag = document.getElementById('modal-tag');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCloseModal2 = document.getElementById('btn-close-modal-2');
  const btnFocusRelic = document.getElementById('btn-focus-relic');

  // UI Element References - Art Info Modal (Human-friendly UI)
  const artModal = document.getElementById('art-modal');
  const artModalBackdrop = document.getElementById('art-modal-backdrop');
  const btnCloseArtModal = document.getElementById('btn-close-art-modal');
  const btnCloseArtModal2 = document.getElementById('btn-close-art-modal-2');

  const artTreeCat = document.getElementById('art-tree-cat');
  const artTreeBlock = document.getElementById('art-tree-block');

  const artImageWrapper = document.getElementById('art-image-wrapper');
  const btnArtFullscreen = document.getElementById('btn-art-fullscreen');
  const artModalImg = document.getElementById('art-modal-img') as HTMLImageElement;
  const galleryCount = document.getElementById('gallery-count');
  const artGalleryList = document.getElementById('art-gallery-list');

  // UI Element References - Fullscreen Image Lightbox
  const imageLightboxModal = document.getElementById('image-lightbox-modal');
  const lightboxBackdrop = document.getElementById('lightbox-backdrop');
  const btnCloseLightbox = document.getElementById('btn-close-lightbox');
  const lightboxImg = document.getElementById('lightbox-img') as HTMLImageElement;
  const lightboxCaption = document.getElementById('lightbox-caption');

  const artCatTitle = document.getElementById('art-cat-title');
  const artCatDesc = document.getElementById('art-cat-desc');

  const artBlockTitle = document.getElementById('art-block-title');
  const artBlockDesc = document.getElementById('art-block-desc');
  const artAdditionBox = document.getElementById('art-addition-box');
  const artAdditionText = document.getElementById('art-addition-text');

  // --- Drawer Handlers ---
  function openDrawer() {
    drawer?.classList.add('open');
  }

  function closeDrawer() {
    drawer?.classList.remove('open');
  }

  btnMenu?.addEventListener('click', openDrawer);
  btnCloseDrawer?.addEventListener('click', closeDrawer);
  drawerOverlay?.addEventListener('click', closeDrawer);

  // Camera Presets
  btnCamOverview?.addEventListener('click', () => {
    archiveScene.resetCameraView();
    closeDrawer();
  });

  btnCamReset?.addEventListener('click', () => {
    archiveScene.resetCameraView();
    closeDrawer();
  });

  // Right Header Action Button
  btnAction?.addEventListener('click', () => {
    archiveScene.resetCameraView();
    showToast('Đã khôi phục góc nhìn mặc định');
  });

  // --- Relic Modal Handlers ---
  function openRelicModal(artifact: ArtifactData) {
    activeArtifact = artifact;
    if (modalTag) modalTag.textContent = artifact.categoryLabel;
    if (modalTitle) modalTitle.textContent = artifact.title;
    if (modalBody) modalBody.textContent = artifact.description;
    relicModal?.classList.add('active');
  }

  function closeRelicModal() {
    relicModal?.classList.remove('active');
    activeArtifact = null;
  }

  btnCloseModal?.addEventListener('click', closeRelicModal);
  btnCloseModal2?.addEventListener('click', closeRelicModal);
  modalBackdrop?.addEventListener('click', closeRelicModal);

  btnFocusRelic?.addEventListener('click', () => {
    if (activeArtifact) {
      archiveScene.focusOnArtifact(activeArtifact);
    }
    closeRelicModal();
  });

  // --- Art Info Modal Handlers (Human-Friendly Historical Display) ---
  function openArtModal(artRawPath: string, artObject: THREE.Object3D) {
    activeArtObject = artObject;

    const customUrl = getArtCustomUrl(artObject);
    if (customUrl) {
      let targetUrl = customUrl;
      if (!targetUrl.match(/^https?:\/\//i) && !targetUrl.startsWith('/')) {
        targetUrl = `https://${targetUrl}`;
      }
      console.log(`🔗 Opening custom URL: ${targetUrl}`);
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const info: ArtInfoResult | null = artInfoService.getArtInfo(artRawPath);

    if (!info) {
      console.warn(`Could not find info.json data for ${artRawPath}`);
      showToast(`Không tìm thấy thông tin tư liệu`);
      return;
    }

    // 1. Update Breadcrumb Header
    if (artTreeCat) artTreeCat.textContent = info.categoryTitle;
    if (artTreeBlock) artTreeBlock.textContent = info.blockTitle || info.categoryTitle;

    // 2. Category Section
    if (artCatTitle) artCatTitle.textContent = info.categoryTitle;
    if (artCatDesc) artCatDesc.textContent = info.categoryDescription;

    // 3. Historical Event / Block Section
    if (artBlockTitle) artBlockTitle.textContent = info.blockTitle || info.categoryTitle;
    if (artBlockDesc) artBlockDesc.textContent = info.blockDescription || info.categoryDescription;

    if (info.additionInfo && info.additionInfo.trim() !== '') {
      if (artAdditionText) artAdditionText.textContent = info.additionInfo;
      if (artAdditionBox) artAdditionBox.style.display = 'block';
    } else {
      if (artAdditionBox) artAdditionBox.style.display = 'none';
    }

    // 4. Update Active Image Preview
    updateActiveImage(info.fullImagePath);

    // 5. Render Thumbnail Gallery of all images in this event
    renderGallery(info);

    // 6. Speak historical text narration for artwork
    let textToSpeak = `${info.blockTitle || info.categoryTitle}. ${info.blockDescription || info.categoryDescription}`;
    if (info.additionInfo && info.additionInfo.trim() !== '') {
      textToSpeak += `. ${info.additionInfo}`;
    }
    speechService.speak(textToSpeak);

    artModal?.classList.add('active');
  }

  function updateActiveImage(fullPath: string) {
    const resolvedPath = getAssetUrl(fullPath);
    if (artModalImg) artModalImg.src = resolvedPath;
    if (lightboxImg && imageLightboxModal?.classList.contains('active')) {
      lightboxImg.src = resolvedPath;
    }
  }

  function renderGallery(info: ArtInfoResult) {
    if (!artGalleryList) return;
    artGalleryList.innerHTML = '';

    const images = info.images && info.images.length > 0 ? info.images : [info.currentImage];
    if (galleryCount) galleryCount.textContent = `${images.length} hình ảnh`;

    images.forEach((imgFilename) => {
      const fullImgPath = getAssetUrl(`${info.imageFolderPath}${imgFilename}`);
      const thumb = document.createElement('div');
      thumb.className = `gallery-thumb ${imgFilename === info.currentImage ? 'active' : ''}`;

      const imgEl = document.createElement('img');
      imgEl.src = fullImgPath;
      imgEl.alt = info.blockTitle;
      thumb.appendChild(imgEl);

      thumb.addEventListener('click', () => {
        artGalleryList.querySelectorAll('.gallery-thumb').forEach((t) => t.classList.remove('active'));
        thumb.classList.add('active');
        updateActiveImage(fullImgPath);
      });

      artGalleryList.appendChild(thumb);
    });
  }

  function closeArtModal() {
    speechService.stop();
    artModal?.classList.remove('active');
    closeLightbox();
    activeArtObject = null;
  }

  btnCloseArtModal?.addEventListener('click', closeArtModal);
  btnCloseArtModal2?.addEventListener('click', closeArtModal);
  artModalBackdrop?.addEventListener('click', closeArtModal);

  // --- Fullscreen Lightbox Handlers ---
  function openLightbox() {
    if (!artModalImg || !artModalImg.src) return;
    if (lightboxImg) {
      lightboxImg.src = artModalImg.src;
    }
    if (lightboxCaption) {
      const titleText = artBlockTitle?.textContent || artTreeBlock?.textContent || 'Hình ảnh di sản';
      lightboxCaption.textContent = titleText;
    }
    imageLightboxModal?.classList.add('active');
  }

  function closeLightbox() {
    imageLightboxModal?.classList.remove('active');
  }

  btnArtFullscreen?.addEventListener('click', (e) => {
    e.stopPropagation();
    openLightbox();
  });

  artImageWrapper?.addEventListener('click', () => {
    openLightbox();
  });

  btnCloseLightbox?.addEventListener('click', closeLightbox);
  lightboxBackdrop?.addEventListener('click', closeLightbox);

  // UI Element References - HUD Instructions Toggle
  const hudInstructions = document.getElementById('hud-instructions');
  const hudHeader = document.getElementById('hud-header');
  const btnToggleHud = document.getElementById('btn-toggle-hud');

  function toggleHudInstructions() {
    if (!hudInstructions) return;
    const isCollapsed = hudInstructions.classList.toggle('collapsed');
    btnToggleHud?.setAttribute('aria-expanded', String(!isCollapsed));
    localStorage.setItem('hud_collapsed', String(isCollapsed));
  }

  // Restore previous state if saved in localStorage
  if (localStorage.getItem('hud_collapsed') === 'true') {
    hudInstructions?.classList.add('collapsed');
    btnToggleHud?.setAttribute('aria-expanded', 'false');
  }

  btnToggleHud?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleHudInstructions();
  });

  hudHeader?.addEventListener('click', () => {
    toggleHudInstructions();
  });

  // Keyboard shortcut listener (ESC to close modals, 'H' or 'h' to toggle HUD instructions)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (imageLightboxModal?.classList.contains('active')) {
        closeLightbox();
      } else {
        closeArtModal();
        closeRelicModal();
      }
    } else if (e.key === 'h' || e.key === 'H') {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (activeTag !== 'input' && activeTag !== 'textarea') {
        toggleHudInstructions();
      }
    }
  });

  // Notification Toast Helper
  function showToast(message: string) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: #FAF6EF;
      color: #9B7B38;
      border: 1px solid #9B7B38;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      z-index: 2000;
      transition: opacity 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
});
