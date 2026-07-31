import { getAssetUrl } from '../utils/url';

export interface SpeechSettings {
  enabled: boolean;
  rate: number;   // 0.8 to 1.5
}

export class SpeechService {
  private static instance: SpeechService;
  private synth: SpeechSynthesis | null = null;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private welcomeAudio: HTMLAudioElement | null = null;
  private settings: SpeechSettings = {
    enabled: true,
    rate: 0.95,
  };

  public static readonly WELCOME_TEXT = `Hồ Chí Minh – Hành Trình Và Di Sản.
Chủ tịch Hồ Chí Minh – Vị lãnh tụ kính yêu của dân tộc Việt Nam, Anh hùng giải phóng dân tộc, Nhà văn hóa kiệt xuất.

Chào mừng Quý vị đến với Không gian Triển lãm Virtual 3D: "Hồ Chí Minh – Hành Trình Và Di Sản".

Tại không gian tương tác này, Quý vị sẽ được ngược dòng thời gian, tái hiện trọn vẹn chặng đường lịch sử vang dội qua từng cột mốc di sản:

Hành trình tìm đường cứu nước: Theo chân người thanh niên Nguyễn Tất Thành rời bến cảng Nhà Rồng năm 1911, bôn ba qua nhiều châu lục để tìm ra ánh sáng tự do.

Sự nghiệp cách mạng vĩ đại: Khám phá những dấu ấn lịch sử—từ việc thành lập Đảng, lãnh đạo Cách mạng Tháng Tám 1945, Đọc Bản Tuyên ngôn Độc lập, cho đến những năm tháng kháng chiến trường kỳ cùng dân tộc.

Di sản văn hóa & Tư tưởng: Chiêm ngưỡng không gian lưu giữ những tác phẩm văn học, bài báo và những câu chuyện giản dị nhưng sâu sắc về đạo đức, phong cách sống của Bác.`;

  private constructor() {
    this.loadSettings();
    if (typeof window !== 'undefined') {
      try {
        this.welcomeAudio = new Audio(getAssetUrl('/audios/chaomung.mp3'));
      } catch (e) {
        console.warn('⚠️ Could not load welcome audio file:', e);
      }

      if ('speechSynthesis' in window) {
        this.synth = window.speechSynthesis;
        this.initVoices();
      } else {
        console.warn('⚠️ Web Speech API (speechSynthesis) is not supported in this browser.');
      }
    }
  }

  public static getInstance(): SpeechService {
    if (!SpeechService.instance) {
      SpeechService.instance = new SpeechService();
    }
    return SpeechService.instance;
  }

  private loadSettings(): void {
    const savedEnabled = localStorage.getItem('speech_enabled');
    if (savedEnabled !== null) {
      this.settings.enabled = savedEnabled === 'true';
    }
  }

  private saveSettings(): void {
    localStorage.setItem('speech_enabled', String(this.settings.enabled));
  }

  private getVietnameseVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    if (!voices || voices.length === 0) return null;

    // Filter Vietnamese voices (checking lang code or voice name)
    const viVoices = voices.filter(v => {
      const l = v.lang.toLowerCase().replace('_', '-');
      const n = v.name.toLowerCase();
      return l.startsWith('vi') || n.includes('vietnam') || n.includes('tiếng việt') || n.includes('hoaimy') || n.includes('linh');
    });

    if (viVoices.length > 0) {
      // Prioritize female voice (e.g. HoaiMy, Linh, Lien, Female, Nữ, Google tiếng Việt)
      const femaleViVoice = viVoices.find(v => 
        /female|hoaimy|linh|lien|nữ|nu|gương|lan|mai|google/i.test(v.name)
      );
      return femaleViVoice || viVoices[0];
    }

    return null;
  }

  private initVoices(): void {
    if (!this.synth) return;

    const updateVoiceList = () => {
      this.selectedVoice = this.getVietnameseVoice();
      if (this.selectedVoice) {
        console.log('🔊 SpeechService selected Vietnamese voice:', `${this.selectedVoice.name} (${this.selectedVoice.lang})`);
      }
    };

    updateVoiceList();
    if (typeof this.synth.onvoiceschanged !== 'undefined') {
      this.synth.onvoiceschanged = updateVoiceList;
    }
  }

  public speak(text: string, force: boolean = false): void {
    if (!this.synth) return;
    if (!this.settings.enabled && !force) return;

    this.stop(); // Cancel previous speech utterance and stop audio player

    const cleanText = text.trim();
    if (!cleanText) return;

    // Refresh voice selection dynamically in case voices loaded after init
    const voice = this.selectedVoice || this.getVietnameseVoice();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.volume = 1.0;
    utterance.rate = this.settings.rate;
    utterance.pitch = 1.0;

    if (voice) {
      utterance.voice = voice;
      console.log(`🎤 Speaking using voice: ${voice.name} (${voice.lang})`);
    } else {
      console.warn('⚠️ No specific Vietnamese voice object found in browser. Falling back to lang="vi-VN"');
    }

    utterance.onstart = () => {
      console.log('🎤 Speech narration started');
    };

    utterance.onerror = (e) => {
      console.warn('⚠️ Speech synthesis error:', e);
    };

    this.synth.speak(utterance);
  }

  public stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    if (this.welcomeAudio) {
      this.welcomeAudio.pause();
      this.welcomeAudio.currentTime = 0;
    }
  }

  public speakWelcome(): void {
    if (!this.settings.enabled) return;

    this.stop();

    if (this.welcomeAudio) {
      this.welcomeAudio.currentTime = 0;
      this.welcomeAudio.play().catch((err) => {
        console.warn('⚠️ Welcome audio playback error:', err);
      });
    }
  }

  public isEnabled(): boolean {
    return this.settings.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.saveSettings();
    if (!enabled) {
      this.stop();
    }
  }
}
