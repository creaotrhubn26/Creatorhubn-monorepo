// infographic-element.ts — <role-room-infographic> Web Component (custom element).
//
// «Kobles til hva som helst»: en selvstendig, rammeverk-agnostisk embed. En hvilken som
// helst side inkluderer den bundlede JS-en og bruker elementet:
//
//   <script src="/embed/role-room-infographic.js"></script>
//   <role-room-infographic accent="#2f6df0" autoplay="5"
//                          data='{"cards":[{"label":"Pasienter","value":"124","icon":"group"}]}'>
//     <template>...infographic-mal-HTML (leser window.__CFG__ + setProgress)...</template>
//   </role-room-infographic>
//
// Malen kan gis via (a) et <template>-barn, (b) `template`-property (JS), eller (c)
// `template-url`-attributt (fetches). Data via `data`-attributt (JSON) eller `data`-property.
// Rendres isolert i en iframe (srcdoc) via infographic-engine.assembleHtml. Reaktiv på
// attributt-/property-endring.

import { assembleHtml } from './infographic-engine';

class RoleRoomInfographic extends HTMLElement {
  static get observedAttributes() { return ['data', 'accent', 'autoplay', 'template-url', 'loop']; }

  private _tpl: string | null = null;
  private _data: Record<string, unknown> | null = null;
  private _fontsCss: string | undefined;
  private _frame: HTMLIFrameElement | null = null;
  private _fetching = false;

  /** Sett mal-HTML programmatisk. */
  set template(html: string) { this._tpl = html; this.render(); }
  /** Sett data programmatisk (unngår JSON-i-attributt for store objekter). */
  set data(obj: Record<string, unknown>) { this._data = obj; this.render(); }
  /** Valgfri bundlet @font-face-CSS (ikon-glyfer/merkevare-fonter i embed). */
  set fontsCss(css: string) { this._fontsCss = css; this.render(); }

  connectedCallback() {
    // Pre-upgrade-properties: hvis en app satte .template/.data/.fontsCss FØR elementet
    // ble definert (async script-last), sitter verdien som en own-property som SKYGGER
    // setteren → data «forsvinner». Løft dem tilbake via setteren.
    for (const prop of ['template', 'data', 'fontsCss'] as const) {
      if (Object.prototype.hasOwnProperty.call(this, prop)) {
        const value = (this as unknown as Record<string, unknown>)[prop];
        delete (this as unknown as Record<string, unknown>)[prop];
        (this as unknown as Record<string, unknown>)[prop] = value;
      }
    }
    if (!this._frame) {
      const root = this.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = ':host{display:block;position:relative}iframe{width:100%;height:100%;min-height:inherit;border:0;display:block;background:transparent}';
      this._frame = document.createElement('iframe');
      this._frame.setAttribute('title', 'infographic');
      root.append(style, this._frame);
    }
    this.render();
  }

  attributeChangedCallback() { this.render(); }

  private resolveData(): Record<string, unknown> {
    const base: Record<string, unknown> = this._data ? { ...this._data } : {};
    const attr = this.getAttribute('data');
    if (!this._data && attr) { try { Object.assign(base, JSON.parse(attr)); } catch { /* ugyldig JSON → behold */ } }
    const accent = this.getAttribute('accent'); if (accent) base.accent = accent;
    return base;
  }

  private render() {
    if (!this._frame) return;
    // Mal-kilde (prioritert): (1) property, (2) <script type="text/html"> BARN (RÅ tekst —
    // bevarer full-dokument-HTML m/ scripts; <template> ville parset + manglet dette),
    // (3) <template>-barn, (4) template-url (fetches). __CFG__/setProgress-kontrakten intakt.
    let tpl = this._tpl
      || this.querySelector('script[type="text/html"],script[type="text/template"]')?.textContent
      || this.querySelector('template')?.innerHTML
      || '';
    if (!tpl) {
      const url = this.getAttribute('template-url');
      if (url && !this._fetching) {
        this._fetching = true;
        fetch(url).then((r) => r.text()).then((html) => { this._tpl = html; this._fetching = false; this.render(); }).catch(() => { this._fetching = false; });
      }
      return;
    }
    const autoplaySec = parseFloat(this.getAttribute('autoplay') || '0') || undefined;
    const loop = this.getAttribute('loop') !== 'false';
    const html = assembleHtml(tpl, this.resolveData(), { autoplaySec, loop, fontsCss: this._fontsCss });
    this._frame.srcdoc = html;
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('role-room-infographic')) {
  customElements.define('role-room-infographic', RoleRoomInfographic);
}

export { RoleRoomInfographic };
