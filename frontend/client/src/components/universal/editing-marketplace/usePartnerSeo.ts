/**
 * usePartnerSeo.ts
 *
 * SEO + GEO for partner-sidene. Setter document.title + meta description og
 * injiserer JSON-LD i <head> (samme mønster som agency-faq/theroleroom-landing).
 * GEO = strukturert data (FAQPage/Organization) som gjør sidene siterbare for
 * AI-svaringsmotorer (Claude/GPT/Perplexity) + bedre rangering i søk.
 */

import { useEffect } from "react";

export function usePartnerSeo(opts: { title: string; description: string; jsonLd?: object; jsonLdId?: string }): void {
  const { title, description, jsonLd, jsonLdId = "partner-jsonld" } = opts;
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const metaDesc = (document.querySelector('meta[name="description"]')
      ?? Object.assign(document.createElement("meta"), { name: "description" })) as HTMLMetaElement;
    const prevDesc = metaDesc.getAttribute("content");
    metaDesc.setAttribute("content", description);
    if (!metaDesc.parentNode) document.head.appendChild(metaDesc);

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = jsonLdId;
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }
    return () => {
      document.title = prevTitle;
      if (prevDesc != null) metaDesc.setAttribute("content", prevDesc);
      if (script) script.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, jsonLdId]);
}
