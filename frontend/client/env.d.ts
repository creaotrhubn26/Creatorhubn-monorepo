/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA_MEASUREMENT_ID: string;
  readonly VITE_RECAPTCHA_SITE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Google Picker API types
declare global {
  interface Window {
    google: {
      picker: {
        PickerBuilder: new () => GooglePickerBuilder;
        ViewId: {
          DOCS: string;
          SPREADSHEETS: string;
          PRESENTATIONS: string;
          PDFS: string;
          IMAGES: string;
          VIDEOS: string;
        };
        Action: {
          PICKED: string;
        };
      };
      load: (api: string, callback: () => void) => void;
    };
  }
}

interface GooglePickerBuilder {
  addView(view: string): GooglePickerBuilder;
  setOAuthToken(token: string): GooglePickerBuilder;
  setDeveloperKey(key: string): GooglePickerBuilder;
  setCallback(callback: (data: any) => void): GooglePickerBuilder;
  build(): GooglePicker;
}

interface GooglePicker {
  setVisible(visible: boolean): void;
}

export {};
