-- 0130 — Full template-seed for ResumeBuilder
--
-- 0128 seedet kun 3 templates. Vi har nå 15 render-komponenter i
-- frontend/client/src/components/resume/templates/ResumeTemplates.tsx.
-- Denne migrasjonen seeder de 12 manglende slik at template-velgeren
-- i ResumeBuilder viser dem alle.
--
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING på primary key (id).

INSERT INTO resume_templates (
  id, name, description, category, ats_score, is_ats_optimized,
  layout, sections, color_schemes, fonts, is_premium, is_active
) VALUES
  ('professional-two-column', 'Profesjonell to-kolonne',
   'Moderne design med farget sidebar. God balanse mellom visuelt og ATS-vennlighet.',
   'professional', 95, TRUE, 'two-column',
   '["personal","summary","experience","education","skills","certifications"]'::jsonb,
   '["professional-blue","modern-navy"]'::jsonb,
   '{"heading":"Helvetica","body":"Arial"}'::jsonb, FALSE, TRUE),

  ('minimal-clean', 'Minimalistisk Ren',
   'Enkel, ren design med fokus på innhold. Best for kreative roller.',
   'minimal', 90, TRUE, 'single-column',
   '["personal","summary","experience","education","skills"]'::jsonb,
   '["minimal-black","minimal-charcoal"]'::jsonb,
   '{"heading":"Helvetica","body":"Helvetica"}'::jsonb, FALSE, TRUE),

  ('norwegian-two-column', 'Norsk to-kolonne',
   'Klassisk norsk CV-stil med to-spaltet layout. Brukes mye av rekruttering i Norge.',
   'professional', 93, TRUE, 'two-column',
   '["personal","summary","experience","education","skills","languages"]'::jsonb,
   '["norwegian-blue","norwegian-navy"]'::jsonb,
   '{"heading":"Arial","body":"Arial"}'::jsonb, FALSE, TRUE),

  ('creative-photographer', 'Kreativ fotograf',
   'Visuelt sterk mal for fotografer og videografer med fargesterk profil.',
   'creative', 85, FALSE, 'two-column',
   '["personal","summary","experience","education","skills","projects"]'::jsonb,
   '["creative-orange","creative-coral"]'::jsonb,
   '{"heading":"Helvetica","body":"Helvetica"}'::jsonb, FALSE, TRUE),

  ('healthcare-professional', 'Helsearbeider',
   'Profesjonell mal for helse-personell med grønt tema og fokus på sertifiseringer.',
   'healthcare', 90, TRUE, 'two-column',
   '["personal","summary","experience","education","skills","certifications","languages"]'::jsonb,
   '["healthcare-green","healthcare-teal"]'::jsonb,
   '{"heading":"Arial","body":"Arial"}'::jsonb, FALSE, TRUE),

  ('academic-researcher', 'Akademisk forsker',
   'Profesjonell mal for forskere, professorer og akademikere med fokus på publikasjoner.',
   'academic', 95, TRUE, 'single-column',
   '["personal","summary","experience","education","skills","certifications","projects"]'::jsonb,
   '["academic-blue","academic-gray"]'::jsonb,
   '{"heading":"Times New Roman","body":"Times New Roman"}'::jsonb, FALSE, TRUE),

  ('executive-leadership', 'Toppledelse',
   'Elegant mal for direktører, ledere og toppledelse med sofistikert design.',
   'executive', 85, TRUE, 'single-column',
   '["personal","summary","experience","education","skills","certifications"]'::jsonb,
   '["executive-black","executive-navy"]'::jsonb,
   '{"heading":"Helvetica","body":"Helvetica"}'::jsonb, FALSE, TRUE),

  ('sales-professional', 'Salgsprofil',
   'Dynamisk mal for salgsrepresentanter og -ledere med oransje tema.',
   'sales', 90, TRUE, 'single-column',
   '["personal","summary","experience","education","skills","certifications"]'::jsonb,
   '["sales-orange","sales-coral"]'::jsonb,
   '{"heading":"Arial","body":"Arial"}'::jsonb, FALSE, TRUE),

  ('nordic-dark-sidebar', 'Nordic Dark Sidebar',
   'To-spaltet med mørk navy høyresidebar. Klassisk norsk kreatør-CV-design med tidslinje-prikker og caps-datoer.',
   'creative', 92, TRUE, 'two-column',
   '["personal","summary","experience","education","skills","languages","certifications","internships"]'::jsonb,
   '["nordic-navy","nordic-charcoal","nordic-graphite"]'::jsonb,
   '{"heading":"Inter","body":"Inter"}'::jsonb, FALSE, TRUE),

  ('modern-tan-sidebar', 'Modern Tan Sidebar',
   'Elegant to-spaltet med lys sidebar og tan/bronse-aksent, sirkulært profilbilde og chip-overskrifter.',
   'creative', 88, TRUE, 'two-column',
   '["personal","summary","experience","education","skills","languages","certifications"]'::jsonb,
   '["tan-bronze","tan-warm-gray","tan-cream"]'::jsonb,
   '{"heading":"Inter","body":"Inter"}'::jsonb, FALSE, TRUE),

  ('timeline-centered', 'Timeline Centered',
   'Sentrert layout med vertikal tidslinje, dot-markører og minimalistiske side-overskrifter. Klassisk skandinavisk.',
   'creative', 90, TRUE, 'two-column',
   '["personal","summary","experience","education","skills","languages","certifications","internships"]'::jsonb,
   '["classic-black","classic-navy","classic-charcoal"]'::jsonb,
   '{"heading":"Inter","body":"Inter"}'::jsonb, FALSE, TRUE),

  ('minimal-mono', 'Minimal Mono',
   'Single-column monospace med maksimal ATS-kompatibilitet (100% score). Renheten gir tech-feel.',
   'professional', 100, TRUE, 'single-column',
   '["personal","summary","experience","education","skills","languages","certifications"]'::jsonb,
   '["mono-black","mono-charcoal"]'::jsonb,
   '{"heading":"IBM Plex Mono","body":"IBM Plex Mono"}'::jsonb, FALSE, TRUE),

  ('bold-creative', 'Bold Creative',
   'CreatorHub-orange med vinklede chip-overskrifter og fargesterk visuell profil. For kreatører som vil bli lagt merke til.',
   'creative', 82, FALSE, 'two-column',
   '["personal","summary","experience","education","skills","languages","certifications"]'::jsonb,
   '["creator-orange","creator-coral","creator-amber"]'::jsonb,
   '{"heading":"Inter","body":"Inter"}'::jsonb, FALSE, TRUE)

ON CONFLICT (id) DO NOTHING;
