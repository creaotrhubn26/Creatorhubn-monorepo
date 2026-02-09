/**
 * Type definitions for Google API
 */

declare global {
  interface Window {
    google: {
      picker: {
        Action: {
          CANCEL: number;
          PICKED: number;
          LOADED: number;
        };
        ActionCollection: any;
        Document: {
          FOLDERS: string;
          PDFS: string;
        };
        Feature: {
          MULTISELECT_ENABLED: string;
          NAV_HIDDEN: string;
          MINE_ONLY: string;
        };
        FileType: any;
        ResourceId: any;
        Response: {
          DOCUMENTS: string;
          FOLDERS: string;
          THUMBS: string;
        };
        ViewId: {
          DOCS: string;
          FOLDERS: string;
          PDFS: string;
          SPREADSHEETS: string;
          PRESENTATIONS: string;
          IMAGES: string;
          VIDEOS: string;
          DRAWINGS: string;
          FORMS: string;
          ALL: string;
        };
        PickerBuilder: new () => PickerBuilder;
      };
    };
  }
}

interface PickerBuilder {
  addView(view: any): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setCallback(callback: (data: any) => void): PickerBuilder;
  build(): Picker;
}

interface Picker {
  setVisible(visible: boolean): void;
}

export {};
