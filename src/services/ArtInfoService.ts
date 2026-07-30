import { getAssetUrl } from '../utils/url';

export interface ArtBlockInfo {
  path: string;
  title: string;
  description: string;
  additionInfo?: string;
  images: string[];
}

export interface ArtCategoryInfo {
  title: string;
  path: string;
  description: string;
  blocks: ArtBlockInfo[];
}

export interface ArtInfoData {
  [key: string]: ArtCategoryInfo;
}

export interface ArtInfoResult {
  categoryKey: string;
  categoryTitle: string;
  categoryDescription: string;
  categoryPath: string;
  
  blockTitle: string;
  blockPath: string;
  blockDescription: string;
  additionInfo: string;
  
  currentImage: string;
  fullImagePath: string;
  images: string[];
  imageFolderPath: string;
}

export class ArtInfoService {
  private static instance: ArtInfoService;
  private data: ArtInfoData | null = null;
  private isLoaded: boolean = false;

  private constructor() {}

  public static getInstance(): ArtInfoService {
    if (!ArtInfoService.instance) {
      ArtInfoService.instance = new ArtInfoService();
    }
    return ArtInfoService.instance;
  }

  public async loadData(): Promise<ArtInfoData> {
    if (this.data && this.isLoaded) {
      return this.data;
    }

    try {
      const response = await fetch(getAssetUrl('/arts/info.json'));
      if (!response.ok) {
        throw new Error(`Failed to fetch info.json: ${response.statusText}`);
      }
      this.data = await response.json();
      this.isLoaded = true;
      console.log('✅ info.json loaded successfully in ArtInfoService:', this.data);
      return this.data!;
    } catch (error) {
      console.error('❌ Error loading info.json:', error);
      this.data = {};
      return this.data;
    }
  }

  public getArtInfo(imagePath: string): ArtInfoResult | null {
    if (!this.data) {
      console.warn('⚠️ ArtInfoService data not loaded yet!');
      return null;
    }

    // Normalize path string (handle backslashes and multiple slashes)
    const normPath = imagePath.split('\\').join('/').replace(/\/+/g, '/');
    const parts = normPath.split('/');
    const filename = parts.pop() || '';

    const base = import.meta.env.BASE_URL || '/';
    const cleanBaseName = base.replace(/^\/+|\/+$/g, '');

    // Filter out 'public', 'arts', base URL folder name, and empty strings to extract category & block folder names
    const cleanParts = parts.filter(p => p !== 'public' && p !== 'arts' && p !== '' && p !== cleanBaseName);

    let catKey = cleanParts[0] || '';
    let blockPath = cleanParts[1] || '';

    let category: ArtCategoryInfo | undefined = this.data[catKey];
    if (!category) {
      // Search categories by cat.path
      for (const [k, v] of Object.entries(this.data)) {
        if (v.path === catKey) {
          category = v;
          catKey = k;
          break;
        }
      }
    }

    let matchedBlock: ArtBlockInfo | undefined = undefined;

    if (category) {
      if (blockPath) {
        matchedBlock = category.blocks.find(b => b.path === blockPath);
      }
      if (!matchedBlock) {
        // Search by filename in block's images array
        matchedBlock = category.blocks.find(b => b.images && b.images.includes(filename));
      }
      if (!matchedBlock && category.blocks.length === 1) {
        matchedBlock = category.blocks[0];
      }
    }

    // Global fallback search across all categories and blocks for filename
    if (!category || !matchedBlock) {
      for (const [k, v] of Object.entries(this.data)) {
        for (const b of v.blocks) {
          if (b.images && b.images.includes(filename)) {
            category = v;
            catKey = k;
            matchedBlock = b;
            break;
          }
        }
        if (matchedBlock) break;
      }
    }

    if (category && matchedBlock) {
      let folderPath = `/arts/${category.path}`;
      if (matchedBlock.path) {
        folderPath += `/${matchedBlock.path}`;
      }
      folderPath += '/';

      const fullImagePath = getAssetUrl(folderPath + filename);
      folderPath = getAssetUrl(folderPath);

      return {
        categoryKey: catKey,
        categoryTitle: category.title,
        categoryDescription: category.description,
        categoryPath: category.path,

        blockTitle: matchedBlock.title || category.title,
        blockPath: matchedBlock.path || '',
        blockDescription: matchedBlock.description || category.description,
        additionInfo: matchedBlock.additionInfo || '',

        currentImage: filename,
        fullImagePath: fullImagePath,
        images: matchedBlock.images || [filename],
        imageFolderPath: folderPath
      };
    }

    return null;
  }
}
