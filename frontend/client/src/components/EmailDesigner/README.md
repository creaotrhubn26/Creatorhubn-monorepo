# Email Designer - Complete Implementation

## 📧 Overview

Visual email template builder with drag-and-drop components, template variables, and comprehensive preview system.

## ✅ Feature Matrix Alignment

- **Feature ID**: `email-designer` (Pro plan)
- **Dependencies**: `email-marketing-manager`
- **Related Features**: `branded-email-templates` (Pro plan)
- **Location**: `profession-feature-matrix.ts` lines 2409-2417

## 🎯 Core Features

### 1. **Component Palette** ✅

- Header (Overskrift)
- Text (Tekst)
- Button (Knapp)
- Image (Bilde)
- Video (Video embeds)
- Columns (Todelt layout)
- Divider (Skillelinje)
- Social (Sosiale medier)
- Spacer (Avstand)
- Footer (Bunntekst)

### 2. **Template Variables System** ✅

- **User Variables**: `user_name`, `user_first_name`, `user_email`, etc.
- **Project Variables**: `project_name`, `project_date`, `gallery_link`, etc.
- **Business Variables**: `business_name`, `photographer_name`, etc.
- **Custom Variables**: `greeting`, `closing`
- Copy-to-clipboard functionality
- Visual chip rendering in preview

### 3. **Responsive Preview** ✅

- Desktop (600px)
- Tablet (768px)
- Mobile (375px)
- Smooth width transitions

### 4. **Drag & Drop** ✅

- Reorder components via @hello-pangea/dnd
- Visual feedback during drag
- Selected component highlighting

### 5. **State Management** ✅

- useReducer with comprehensive actions
- Undo/Redo history (up to historyIndex)
- Dirty state tracking
- Auto-save to localStorage (every 30 seconds)

### 6. **Keyboard Shortcuts** ⌨️

- `Ctrl/Cmd + Z`: Undo
- `Ctrl/Cmd + Y` or `Ctrl/Cmd + Shift + Z`: Redo
- `Ctrl/Cmd + S`: Save template
- `Delete` or `Backspace`: Delete selected component

### 7. **Accessibility** ♿

- ARIA labels on all interactive elements
- Semantic HTML roles (main, navigation, complementary, article)
- Keyboard navigation support
- Tooltip descriptions

### 8. **Template Library** 📚

Pre-built templates:

- **Galleri klar** (notification) - Gallery ready notification
- **Påminnelse** (reminder) - Project reminder

### 9. **Export & Import** 💾

- Export as HTML file
- Send test emails
- Template save/load functionality

### 10. **Toast Notifications** 🎉

**Using ToastDesigner** (NOT Material UI Snackbar):

- ✅ Auto-save confirmation: "Utkast lagret automatisk"
- ✅ Save success: "Mal lagret!"
- ✅ Save error: "Kunne ikke lagre mal"
- ✅ Test email sent: "Test-epost sendt!"
- ✅ Email send error: "Kunne ikke sende epost"
- ✅ Template loaded: "Mal lastet inn!"

All toasts use `addToast()` from `useVisualEditor()` hook.

## 🏗️ Architecture

### State Structure

```typescript
interface EmailDesignerState {
  components: EmailComponent[];
  history: EmailComponent[][];
  historyIndex: number;
  selectedComponent: EmailComponent | null;
  globalStyles: GlobalStyles;
  templateName: string;
  subject: string;
  preheader: string;
  customVariables: Record<string, string>;
  showVariablesPanel: boolean;
  previewMode: 'desktop' | 'tablet' | 'mobile';
  lastSaved: Date | null;
  isDirty: boolean;
}
```

### Reducer Actions

- `ADD_COMPONENT`
- `UPDATE_COMPONENT`
- `DELETE_COMPONENT`
- `REORDER_COMPONENTS`
- `SELECT_COMPONENT`
- `UNDO` / `REDO`
- `UPDATE_GLOBAL_STYLES`
- `SET_TEMPLATE_META`
- `LOAD_TEMPLATE`
- `SET_CUSTOM_VARIABLE`
- `TOGGLE_VARIABLES_PANEL`
- `SET_PREVIEW_MODE`
- `MARK_SAVED` / `MARK_DIRTY`

## 🎨 Component Hierarchy

```
EmailDesignerComplete
├── Toolbar (Paper)
│   ├── Undo/Redo buttons
│   ├── Preview mode toggles (Desktop/Tablet/Mobile)
│   ├── Template library button
│   ├── Save button
│   ├── Send test button
│   └── Export button
├── Main Content (Box)
│   ├── Component Palette (Paper, left sidebar)
│   ├── Canvas (Paper, center - draggable components)
│   ├── Properties Panel (Paper, right - when component selected)
│   └── Variables Panel (Paper, right - when toggled)
└── Dialogs
    ├── Send Test Email Dialog
    └── Template Library Dialog
```

## 🔧 Key Helper Functions

### Component Rendering

- `getDefaultContent(type)` - Returns default content for component type
- `getDefaultStyles(type)` - Returns default styles for component type
- `generateHTML(components, globalStyles)` - Exports to HTML

### Sub-Components

- `ComponentPreview` - Memoized component preview with drag handlers
- `RenderComponent` - Renders component based on type (with variable chip support)
- `ComponentProperties` - Property editor panel
- `VariablesPanel` - Template variables list with categories

## 🎯 Integration Points

### 1. ToastDesigner Integration

```typescript
import { useVisualEditor } from '@/components/admin/visual-editor/VisualEditorContext';

const { addToast } = useVisualEditor();

addToast({
  message: 'Mal lagret!',
  type: 'success',
  duration: 3000,
});
```

### 2. API Endpoints Expected

- `POST /api/email-templates` - Save template
- `POST /api/email/send-test` - Send test email
- `GET /api/email-templates` - Load templates (optional)

### 3. LocalStorage Keys

- `email-designer-draft` - Auto-saved draft (every 30s)

## 📦 Dependencies

- `@tanstack/react-query` - Data fetching
- `@hello-pangea/dnd` - Drag and drop
- `@mui/material` - UI components
- `@/hooks/useAuth` - User authentication
- `@/utils/theming-helper` - Theming system
- `@/lib/queryClient` - API requests
- `@/components/admin/visual-editor/VisualEditorContext` - Toast system

## 🚀 Usage Example

```tsx
import EmailDesignerComplete from '@/components/EmailDesigner/EmailDesignerComplete';

function EmailMarketingPage() {
  return (
    <VisualEditorProvider>
      <EmailDesignerComplete />
    </VisualEditorProvider>
  );
}
```

## 🎨 Theming

Uses `useTheming('photographer')` from theming-helper:

- Primary color for selected states
- Themed button styles
- Consistent with CreatorHub brand

## 📊 Performance Optimizations

- `React.memo()` on ComponentPreview
- `useCallback()` for all handler functions
- `useMemo()` for preview width calculation
- Auto-save debouncing (30 seconds)

## 🔮 Future Enhancements

### ✅ **Available Components to Integrate**

#### **1. RichTextEditor.tsx** - React Quill Integration

- ✅ **Rich text editing** for text components instead of plain TextField
- Pre-configured toolbar: bold, italic, underline, strike, headers, lists, links, images
- HTML output compatible with email generation
- Modular configuration support

**Integration**:

```tsx
import RichTextEditor from '@/components/RichTextEditor';

<RichTextEditor
  value={component.content.text}
  onChange={(value) => onUpdate({ content: { ...component.content, text: value } })}
  modules={{
    toolbar: [['bold', 'italic', 'underline'], [{ color: [] }], ['link'], ['clean']],
  }}
/>;
```

#### **2. CreatorhubNotesNew.tsx** - Powerful Features Available

##### **A. Text Analysis Utilities** 📊

```typescript
export function analyzeText(text: string) {
  return {
    words,
    sentences,
    paragraphs,
    charactersNoSpaces,
    characters,
    readingTime,
    averageWordsPerSentence,
  };
}
```

**Use for**: Email content analytics (word count, reading time, character limits for email clients)

##### **B. DOMPurify Sanitization** 🛡️

```typescript
import DOMPurify from 'dompurify';
const cleanHTML = DOMPurify.sanitize(html);
```

**Use for**: Secure HTML sanitization before email sending/export

##### **C. Debounced Input Hook** ⏱️

```typescript
function useDebouncedValue<T>(value: T, ms = 300): T { ... }
```

**Use for**: Debounce template search, property changes, improve auto-save performance

##### **D. EnhancedMasterIntegration** 🔌

```typescript
const { analytics, lifecycle, performance, debugging, features, communication } =
  useEnhancedMasterIntegration();

// Track every action
analytics.trackEvent('email_template_created', { templateId });
features.trackFeatureUsage('email-designer', 'create');

// Performance monitoring
const endTiming = performance.startTiming('template_render');
endTiming();

// Cross-component communication
communication.sendBroadcast('email-template-created', { templateId });
```

**Use for**: Analytics, performance tracking, lifecycle management, cross-component events

##### **E. Google Drive/Docs Integration** ☁️

```typescript
import GoogleDriveDocsBridge from '@/components/admin/GoogleDriveDocsBridge';
```

**Use for**: Import/export templates from Google Docs, auto-backup to Drive

##### **F. Norwegian Language Support** 🇳🇴

```typescript
import NorwegianDictionaryPanel from '@/components/admin/NorwegianDictionaryPanel';
import InlineNorwegianSpellChecker from '@/components/admin/InlineNorwegianSpellChecker';
import { NorwegianSpellChecker } from '@/components/admin/NorwegianSpellChecker';
```

**Use for**: Real-time Norwegian spell checking in email templates (HUGE for CreatorHub Norge!)

##### **G. AI-Powered Writing Tools** 🤖

- Paraphraser: Reword email copy
- Grammar Checker: Fix errors
- Summarizer: Create concise versions
- Translator: Multi-language emails
- Tone Changer: Professional/Casual/Friendly
- Content Generator: Email copy suggestions
- **Subject Line Generator**: AI-powered subject lines

---

### 📦 **New Features to Build**

#### **1. EmailContentAnalyzer** 📊

Email-specific analytics panel:

- Subject line score (ideal: 40-50 chars)
- Preheader length (ideal: 85-100 chars)
- Word/character count
- Reading time
- Link count
- Image count
- Spam score prediction
- Accessibility issues (missing alt text, contrast)

#### **2. EmailAIAssistant** 🤖

Integrated AI tools:

- Subject line generator
- Preview text generator
- Paraphrase tool
- Tone adjuster
- Spam checker
- Personalization suggestions

#### **3. EmailImageManager** 🖼️

- Image upload with drag-and-drop
- Automatic optimization for email (max 1MB)
- CDN integration
- Image gallery/library
- Alt text suggestions

#### **4. EmailSpamChecker** ⚠️

- Analyze spam score (0-100)
- Detect spam triggers:
  - Excessive caps
  - Spam keywords
  - Too many exclamation marks
  - Missing unsubscribe link
  - Suspicious links

#### **5. More Component Types**

- [ ] **Table**: Responsive data tables
- [ ] **Quote**: Blockquote styling
- [ ] **Code**: Code snippet display
- [ ] **Countdown**: Event countdown timer
- [ ] **Products**: Product showcase grid
- [ ] **Testimonial**: Customer testimonial cards
- [ ] **Pricing**: Pricing comparison tables
- [ ] **CTA Banner**: Large call-to-action banners

#### **6. Template Marketplace** 🏪

```typescript
// Feature: 'template-marketplace' (marketplace plan)
interface TemplateMarketplace {
  categories: string[];
  featured: EmailTemplate[];
  popular: EmailTemplate[];
  search: (query: string) => EmailTemplate[];
  purchase: (templateId: string) => Promise<void>;
}
```

#### **7. A/B Testing Support** 🔬

```typescript
interface ABTestConfig {
  variants: Array<{
    template: EmailTemplate;
    weight: number; // percentage
  }>;
  metrics: { openRate; clickRate; conversionRate };
  winner?: string;
}
```

#### **8. Email Analytics Dashboard** 📈

- Sent/Delivered/Opened/Clicked metrics
- Open rate, click rate, bounce rate
- Top clicked links
- Device breakdown (mobile/desktop)
- Geographic data
- Time-based analytics

#### **9. Conditional Content Blocks** 🎭

```typescript
// Show different content based on user segments
<ConditionalBlock
  condition={{ variable: 'user_plan', operator: 'equals', value: 'pro' }}
  contentIfTrue={<ProFeatures />}
  contentIfFalse={<UpgradePrompt />}
/>
```

#### **10. Multi-Language Support** 🌍

```typescript
interface MultiLanguageTemplate {
  defaultLanguage: string;
  translations: Record<
    string,
    {
      subject: string;
      preheader: string;
      components: EmailComponent[];
    }
  >;
}
```

Support: Norwegian (nb), English (en), Swedish (sv), Danish (da)

---

### 🚀 **Implementation Priority**

**Phase 1: Core Enhancements** (Week 1-2)

1. ✅ Integrate RichTextEditor for text components
2. ✅ Add DOMPurify sanitization
3. ✅ Implement EmailContentAnalyzer
4. ✅ Add debounced inputs
5. ✅ EnhancedMasterIntegration tracking

**Phase 2: AI & Analysis** (Week 3-4) 6. ✅ EmailAIAssistant integration 7. ✅ Norwegian spell checker 8. ✅ Spam score checker 9. ✅ Subject line analyzer

**Phase 3: Advanced Components** (Week 5-6) 10. ✅ Table, Quote, Code components 11. ✅ Product showcase component 12. ✅ EmailImageManager with CDN

**Phase 4: Analytics & Testing** (Week 7-8) 13. ✅ EmailAnalyticsDashboard 14. ✅ A/B testing framework 15. ✅ Device/client previews

**Phase 5: Marketplace & i18n** (Week 9-10) 16. ✅ Template marketplace 17. ✅ Multi-language support 18. ✅ Conditional content blocks

---

### 📚 **Additional Dependencies Needed**

```json
{
  "dependencies": {
    "react-quill": "^2.0.0",
    "quill": "^1.3.7",
    "dompurify": "^3.0.6",
    "@types/dompurify": "^3.0.5",
    "html-to-text": "^9.0.5",
    "juice": "^9.1.0",
    "mjml": "^4.14.1"
  }
}
```

---

### 🎯 **Success Metrics**

#### Technical

- Rich text editing response: < 100ms
- Auto-save frequency: every 30s
- Undo/redo history: 50 actions
- Template render time: < 500ms

#### User Experience

- Time to create email: < 5 minutes
- Template reuse rate: > 60%
- AI suggestion acceptance: > 40%

#### Business

- Email open rates: > 25%
- Click-through rates: > 3%
- Bounce rates: < 2%
- Unsubscribe rates: < 0.5%

---

## 📝 Notes

- **Zero Toast Compliance REMOVED**: Now uses ToastDesigner exclusively
- All Material UI Snackbar references removed
- Integrated with Visual Editor context for consistent toast experience
- Component counter visible in toolbar
- Dirty state tracking with visual indicator
- **RichTextEditor available**: Can replace TextField with WYSIWYG editor
- **CreatorhubNotesNew features**: Text analysis, DOMPurify, debouncing, AI tools, Norwegian support all available
- **EnhancedMasterIntegration**: Full analytics, lifecycle, performance tracking ready to integrate
