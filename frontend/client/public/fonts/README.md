# Custom Fonts

Drop your font files here and register them in `/src/styles/custom-fonts.css`.

## 📁 Supported Formats

- `.woff2` (recommended - best compression)
- `.woff` (good fallback)
- `.ttf` (works but larger file size)
- `.otf` (works but larger file size)

## 🚀 Quick Start

### 1. Add Font Files

```
public/fonts/
  ├── MyFont-Regular.woff2
  ├── MyFont-Bold.woff2
  └── MyFont-Italic.woff2
```

### 2. Register in CSS

Edit `/src/styles/custom-fonts.css`:

```css
@font-face {
  font-family: 'MyFont';
  src: url('/fonts/MyFont-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'MyFont';
  src: url('/fonts/MyFont-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
}
```

### 3. Add to PropertyPanel

Edit `/src/components/admin/visual-editor/PropertyPanel.tsx` (around line 446):

```tsx
<MenuItem value="'MyFont', sans-serif">MyFont (Custom)</MenuItem>
```

### 4. Enable in Resvg Renderer

Edit `/src/components/admin/visual-editor/PropertyPanel.tsx` (around line 276):

```tsx
const result = await svgRenderer.renderSVGToPNG(svg, {
  width: element.width * 2,
  height: element.height * 2,
  cache: true,
  fitTo: 'width',
  fonts: ['/fonts/MyFont-Regular.woff2', '/fonts/MyFont-Bold.woff2'],
});
```

## 📝 Font Weight Reference

- 300 = Light
- 400 = Regular/Normal
- 500 = Medium
- 600 = SemiBold
- 700 = Bold
- 800 = ExtraBold
- 900 = Black

## 🔍 Where to Get Fonts

- [Google Fonts](https://fonts.google.com/) - Download for local use
- [Font Squirrel](https://www.fontsquirrel.com/) - Free commercial fonts
- [Adobe Fonts](https://fonts.adobe.com/) - If you have Adobe subscription
- Purchase from font foundries (ensure license allows web use)

## ⚖️ License Check

Always verify your font license allows:

- ✅ Web embedding (@font-face)
- ✅ Server-side rendering (for Resvg)
- ✅ Commercial use (if applicable)

## 🎯 Tips

- Use `.woff2` for best performance (70% smaller than `.ttf`)
- Include only the weights you need
- Use `font-display: swap` for better loading UX
- Test your fonts in the PropertyPanel preview
