"""
Query Rewriter: Transforms user queries into multiple search variants.

Strategies:
- Expand abbreviated legal terms (FIR → First Information Report)
- Generate semantic variants (judicial officer → judge)
- Decompose compound questions
- Normalize formatting and punctuation
"""

import re
import os
from typing import List


# Legal domain abbreviations and expansions
LEGAL_EXPANSIONS = {
    "fir": ["First Information Report", "FIR complaint", "police complaint", "registration of FIR"],
    "cr": ["criminal", "criminal case", "criminal petition"],
    "crl": ["criminal", "criminal case", "criminal petition"],
    "civ": ["civil", "civil case", "civil petition"],
    "nia": ["National Investigation Agency", "NIA case"],
    "hrcp": ["Human Rights Case Petition", "human rights", "HRCP petition"],
    "pld": ["Pakistan Law Digest", "reported case", "law digest decision"],
    "scr": ["Supreme Court reported", "reported judgment"],
    "sha": ["Shariat Appellate Bench"],
    "icj": ["International Court of Justice"],
    "ss": ["Section", "statute section"],
    "art": ["Article", "constitutional article"],
    # ── Bail ──
    "bail": ["bail Section 497", "bail Section 498", "anticipatory bail", "post-arrest bail",
             "pre-arrest bail", "non-bailable offence bail", "bail grant conditions"],
    "497": ["Section 497 CrPC", "bail non-bailable", "bail murder"],
    "498": ["Section 498 CrPC", "anticipatory bail"],
    # ── Writ ──
    "writ": ["writ petition Article 199", "constitutional jurisdiction", "mandamus certiorari"],
    "199": ["Article 199 Constitution", "High Court constitutional jurisdiction", "writ petition"],
    # ── Family / Khula ──
    "khula": ["khula dissolution marriage", "Family Courts Act 1964", "wife divorce consent"],
    "divorce": ["dissolution of marriage", "talaq", "khula", "Family Courts Act 1964"],
    # ── FIR Quash ──
    "quash": ["quashment FIR Section 561-A", "abuse of process", "inherent jurisdiction High Court"],
    "561": ["Section 561-A CrPC", "inherent jurisdiction", "quash FIR"],
}

# Judge-related expansions
JUDGE_EXPANSIONS = {
    "judge": ["judge", "justice", "judicial officer", "presiding judge"],
    "justice": ["justice", "judge", "judicial officer"],
    "cj": ["Chief Justice", "chief judge"],
    "cjp": ["Chief Justice of Pakistan"],
    "ihc": ["Islamabad High Court", "IHC"],
    "lhc": ["Lahore High Court", "LHC"],
    "sc": ["Supreme Court", "Supreme Court of Pakistan"],
}

# Case-related expansions
CASE_EXPANSIONS = {
    "case": ["case", "judgment", "decision", "ruling"],
    "judgment": ["judgment", "decision", "verdict", "ruling", "order"],
    "petition": ["petition", "application", "writ petition"],
    "appeal": ["appeal", "appellate", "appellate decision"],
}


class QueryRewriterService:
    def expand_abbreviations(self, query: str) -> List[str]:
        """Expand common legal abbreviations in the query."""
        variants = [query]
        query_lower = query.lower()

        for abbr, expansions in LEGAL_EXPANSIONS.items():
            if f" {abbr} " in f" {query_lower} " or query_lower.endswith(abbr):
                for expansion in expansions:
                    expanded = re.sub(
                        r'\b' + re.escape(abbr) + r'\b',
                        expansion,
                        query,
                        flags=re.IGNORECASE,
                    )
                    variants.append(expanded)

        return variants

    def generate_semantic_variants(self, query: str) -> List[str]:
        """Generate semantically similar query variants."""
        variants: List[str] = []

        if any(word in query.lower() for word in ["judge", "justice", "cj"]):
            for replacement_set in JUDGE_EXPANSIONS.values():
                for replacement in replacement_set:
                    variant = query
                    for original in ["judge", "justice", "cj", "judicial"]:
                        if original in variant.lower():
                            variant = re.sub(
                                r'\b' + original + r'\b',
                                replacement,
                                variant,
                                flags=re.IGNORECASE,
                            )
                            variants.append(variant)

        if any(word in query.lower() for word in ["case", "judgment", "petition", "appeal"]):
            for replacement_set in CASE_EXPANSIONS.values():
                for replacement in replacement_set[:2]:
                    variant = query
                    for original in ["case", "judgment", "petition", "appeal"]:
                        if original in variant.lower():
                            variant = re.sub(
                                r'\b' + original + r'\b',
                                replacement,
                                variant,
                                flags=re.IGNORECASE,
                            )
                            variants.append(variant)

        return variants

    def decompose_question(self, query: str) -> List[str]:
        """Break compound questions into multiple searches."""
        variants = [query]

        if " and " in query.lower():
            variants.extend(re.split(r'\s+and\s+', query, flags=re.IGNORECASE))

        if " or " in query.lower():
            variants.extend(re.split(r'\s+or\s+', query, flags=re.IGNORECASE))

        return variants

    def rewrite_query(self, query: str, max_variants: int = None) -> List[str]:
        """
        Generate multiple search query variants from a single user query.

        Strategy:
        1. Start with original query
        2. Expand abbreviations (FIR -> First Information Report)
        3. Generate semantic variants (judge -> justice)
        4. Decompose compound questions
        5. Return top N variants
        """
        if max_variants is None:
            max_variants = int(os.getenv("QUERY_REWRITER_MAX_VARIANTS", "5"))

        all_variants = set()
        all_variants.add(query.strip())
        all_variants.update(self.expand_abbreviations(query))
        all_variants.update(self.generate_semantic_variants(query))
        all_variants.update(self.decompose_question(query))

        unique_variants = list(set(all_variants))
        unique_variants = [value.strip() for value in unique_variants if value.strip()]
        unique_variants.sort(key=len, reverse=True)

        result = [query.strip()]
        result.extend([value for value in unique_variants if value != query.strip()])
        return result[:max_variants]

    def enrich_query(self, query: str) -> str:
        """Enrich a query by appending relevant legal keywords for better vector search.

    Instead of generating multiple separate query variants (which require
    multiple search calls), this appends the most relevant legal terms
    directly to the original query string.  The enriched query gives the
    embedding model more signal in a single vector, improving recall
    without any additional latency.

    Example:
        >>> enrich_query("bail under 302 PPC")
        'bail under 302 PPC | Section 497 CrPC anticipatory bail post-arrest bail Section 302 PPC murder'
    """
        query_lower = query.lower()

        extra_terms: List[str] = []
        for abbr, expansions in LEGAL_EXPANSIONS.items():
            if f" {abbr} " in f" {query_lower} " or query_lower.endswith(abbr):
                extra_terms.extend(expansions[:2])

        seen: set = set()
        unique: List[str] = []
        for term in extra_terms:
            term_lower = term.lower()
            if term_lower not in seen and term_lower not in query_lower:
                seen.add(term_lower)
                unique.append(term)

        if not unique:
            return query.strip()

        enrichment = " ".join(unique)[:300]
        return f"{query.strip()} | {enrichment}"


query_rewriter_service = QueryRewriterService()


def rewrite_query(query: str, max_variants: int = None) -> List[str]:
    return query_rewriter_service.rewrite_query(query=query, max_variants=max_variants)


def enrich_query(query: str) -> str:
    return query_rewriter_service.enrich_query(query=query)

