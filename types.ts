export enum ViewState {
  TUTOR = 'TUTOR',
  VISUALIZER = 'VISUALIZER',
  SOLVER = 'SOLVER',
  EXPLORER = 'EXPLORER',
  PRESENTATION = 'PRESENTATION'
}

export enum Sender {
  USER = 'USER',
  AI = 'AI'
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  image?: string; // Base64
  isThinking?: boolean;
  timestamp: number;
  sources?: { uri: string; title: string }[];
}

export interface ImageConfigOption {
  label: string;
  value: "1K" | "2K" | "4K";
}

export interface PresentationData {
  title: string;
  slides: {
    title: string;
    bullets: string[];
    examples: string[];
    imageDescription: string;
    speakerNotes: string;
  }[];
}