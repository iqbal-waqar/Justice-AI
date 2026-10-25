import re
from typing import List, Dict, Any, Optional
from langchain.text_splitter import RecursiveCharacterTextSplitter
import tiktoken

# Voyage voyage-3.5 handles up to 32k tokens per input, so chunks are fully embedded.
CHUNK_SIZE = 1024
CHUNK_OVERLAP = 128
CHUNK_MIN_SIZE = 50

class ChunkingService:
    def __init__(self):
        self.encoder = tiktoken.get_encoding("cl100k_base")

    def get_token_length(self, text: str) -> int:
        return len(self.encoder.encode(text))

    def is_valid_http_url(self, value: Any) -> bool:
        if not value:
            return False
        value_str = str(value)
        return value_str.startswith("http") and "None" not in value_str

    def get_text_splitter(self) -> RecursiveCharacterTextSplitter:
        return RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE,
            chunk_overlap=CHUNK_OVERLAP,
            length_function=self.get_token_length,
            separators=[
                # ── Structure-aware: prefer splitting at legal provision boundaries ──
                r"\n(?=\s*CHAPTER\s)",
                r"\n(?=\s*PART\s)",
                r"\n(?=\s*Article\s+\d)",
                r"\n(?=\s*Section\s+\d)",
                r"\n(?=\s*\d{1,3}[.\)]\s)",
                "\n\n",
                "\n",
                "(?<=[.!?]) ",
                " ",
                "",
            ],
            is_separator_regex=True,
        )

    def chunk_document(
        self,
        text: str,
        metadata: Dict[str, Any],
        record: Dict[str, Any] = None,
        doc_type: str = "",
    ) -> List[Dict[str, Any]]:
        result = []

        if "judge" in doc_type and record:
            metadata_chunk = self.create_judge_metadata_chunk(record, metadata, doc_type)
            if metadata_chunk:
                result.append(metadata_chunk)

        splitter = self.get_text_splitter()
        chunks = splitter.split_text(text)

        for i, chunk in enumerate(chunks):
            chunk_text = chunk.strip()
            if len(chunk_text) < CHUNK_MIN_SIZE:
                continue

            chunk_data = {
                "content": chunk_text,
                "chunk_index": len(result) + i,
                "chunk_size": len(chunk_text),
                "token_count": self.get_token_length(chunk_text),
                **metadata,
            }
            result.append(chunk_data)

        return result

    def extract_text_from_record(self, record: Dict[str, Any], doc_type: str) -> str:
        text_fields = [
            "text_content", "full_text", "biography", "judgment_text",
            "text", "content", "law_text", "description", "summary",
            "body", "facts", "decision", "order", "opinion",
        ]

        parts = []

        if "judge" in doc_type:
            header_parts = []
            name = record.get("full_name") or record.get("name") or ""
            if name:
                header_parts.append(f"Name: {name}")

            designation = record.get("designation", "")
            if designation:
                header_parts.append(f"Designation: {designation}")

            if self.is_chief_justice(record):
                chief_status = self.extract_chief_justice_status(record, doc_type)
                if chief_status:
                    header_parts.append(f"Chief Justice Status: {chief_status}")

            judge_status = self.extract_judge_status(record, doc_type)
            if judge_status and judge_status != "UNKNOWN":
                header_parts.append(f"Status: {judge_status}")

            if header_parts:
                parts.append(f"[JUDGE PROFILE]\n{' | '.join(header_parts)}")

        for title_field in ["title", "case_title", "full_name", "name", "law_title", "judge_name"]:
            if record.get(title_field):
                parts.append(str(record[title_field]))
                break

        for ref_field in ["citation", "case_no", "reference", "act_number", "law_no", "sr_no"]:
            if record.get(ref_field):
                parts.append(str(record[ref_field]))
                break

        for field in text_fields:
            if record.get(field):
                parts.append(str(record[field]))
                break

        if len(parts) <= 1:
            for _, value in record.items():
                if isinstance(value, str) and len(value) > 100:
                    parts.append(value)

        return "\n\n".join(parts)

    def extract_metadata(self, record: Dict[str, Any], doc_type: str) -> Dict[str, Any]:
        meta = record.get("metadata", {})
        is_judge = "judge" in doc_type

        if is_judge:
            source_id = str(meta.get("judge_id", record.get("full_name", "unknown")))
        else:
            source_id = str(
                record.get(
                    "case_number",
                    record.get("law_no", record.get("sr_no", record.get("id", record.get("_id", "unknown"))),),
                )
            )

        title = str(
            record.get("case_title", record.get("title", record.get("full_name", record.get("name", "Untitled"))))
        )[:500]

        year_raw = record.get("year", "")
        if not year_raw:
            date_raw = record.get("decision_date", record.get("date", ""))
            if date_raw and str(date_raw) != "N/A":
                parts = str(date_raw).replace("/", "-").split("-")
                for part in parts:
                    if len(part) == 4 and part.isdigit():
                        year_raw = part
                        break

        if not year_raw and is_judge:
            appointment = record.get("appointment_date", "")
            if appointment and appointment != "N/A":
                match = re.search(r"(\d{4})", str(appointment))
                if match:
                    year_raw = match.group(1)
            if not year_raw:
                bio = meta.get("bio", "")
                if bio:
                    match = re.search(r"(\d{4})", str(bio))
                    if match:
                        year_raw = match.group(1)

        year = str(year_raw)[:4] if year_raw else ""

        result = {
            "doc_type": doc_type,
            "source_id": source_id,
            "title": title,
            "court": self.extract_court(record, doc_type),
            "year": year,
        }

        if "category" in record:
            result["category"] = record["category"]
        if "jurisdiction" in record:
            result["jurisdiction"] = record["jurisdiction"]

        if not is_judge:
            result["pdf_url"] = str(record.get("pdf_url", meta.get("pdf_url", "")))

        if is_judge:
            result["image_url"] = self.resolve_local_image(record, doc_type)
            result["judge_status"] = self.extract_judge_status(record, doc_type)
            result["is_chief_justice"] = self.is_chief_justice(record)
            result["chief_justice_status"] = self.extract_chief_justice_status(record, doc_type)
            result["chief_justice_tenure"] = self.extract_chief_justice_tenure(record)
            result["judge_name"] = str(
                record.get("judge_name")
                or record.get("full_name")
                or record.get("name")
                or ""
            )

        return result

    def resolve_local_image(self, record: Dict[str, Any], doc_type: str) -> str:
        if "judge" not in doc_type:
            return ""

        profile_photo_url = record.get("profile_photo_url")
        if self.is_valid_http_url(profile_photo_url):
            return str(profile_photo_url)

        for field in ["image_url", "photo_url"]:
            url = record.get(field)
            if self.is_valid_http_url(url):
                return str(url)

        meta = record.get("metadata", {})
        if isinstance(meta, dict):
            for field in ["profile_photo_url", "photo_url", "image_url"]:
                url = meta.get(field)
                if self.is_valid_http_url(url):
                    return str(url)

        return ""

    def extract_court(self, record: Dict[str, Any], doc_type: str) -> str:
        court_map = {
            "sc_case": "Supreme Court of Pakistan",
            "sc_judge": "Supreme Court of Pakistan",
            "isb_case": "Islamabad High Court",
            "isb_judge": "Islamabad High Court",
            "lhc_case": "Lahore High Court",
            "lhc_judge": "Lahore High Court",
            "lhc_district": "Lahore High Court (District)",
            "federal_law": "Federal Legislature",
            "punjab_law": "Punjab Legislature",
        }
        return record.get("court", court_map.get(doc_type, "Unknown"))

    def extract_judge_status(self, record: Dict[str, Any], doc_type: str) -> str:
        if "judge" not in doc_type:
            return ""

        biography = record.get("biography", "")
        if "SITTING" in biography:
            return "SITTING"
        if "FORMER" in biography:
            return "FORMER"

        profile_bio = record.get("profile_bio", "")
        if "SITTING" in profile_bio:
            return "SITTING"
        if "FORMER" in profile_bio:
            return "FORMER"

        meta = record.get("metadata", {})
        if isinstance(meta, dict):
            status = meta.get("status", "")
            if status == "SITTING":
                return "SITTING"
            if status == "FORMER":
                return "FORMER"

        return "UNKNOWN"

    def is_chief_justice(self, record: Dict[str, Any]) -> bool:
        designation = record.get("designation", "").upper()
        if "CHIEF JUSTICE" in designation or "THE CHIEF JUSTICE" in designation:
            return True

        biography = record.get("biography", "").upper()
        profile_bio = record.get("profile_bio", "").upper()
        return "CHIEF JUSTICE" in (biography + " " + profile_bio)

    def extract_chief_justice_status(self, record: Dict[str, Any], doc_type: str = "lhc_judge") -> str:
        designation = record.get("designation", "")
        biography = record.get("biography", "")

        if "CHIEF JUSTICE" in designation.upper() and "SITTING" in biography:
            return "CURRENT"
        if "SITTING CHIEF JUSTICE" in biography:
            return "CURRENT"
        if "FORMER CHIEF JUSTICE" in biography:
            return "FORMER"

        judge_status = self.extract_judge_status(record, doc_type)
        if "CHIEF JUSTICE" in designation.upper():
            if judge_status == "SITTING":
                return "CURRENT"
            if judge_status == "FORMER":
                return "FORMER"
        return ""

    def extract_chief_justice_tenure(self, record: Dict[str, Any]) -> str:
        biography = record.get("biography", "")
        if not biography or "CHIEF JUSTICE" not in biography.upper():
            return ""

        patterns = [
            r"(?:Chief Justice|Chief Justices).*?\(([^)]*\d{4}[^)]*)\)",
            r"(?:Chief Justice|Chief Justices).*?(\d{1,2}[.-]\d{1,2}[.-]\d{4}\s+(?:to|TO)\s+\d{1,2}[.-]\d{1,2}[.-]\d{4})",
            r"(?:Chief Justice|Chief Justices).*?(\d{4}\s+(?:to|TO)\s+\d{4})",
        ]

        for pattern in patterns:
            matches = re.finditer(pattern, biography, re.IGNORECASE | re.DOTALL)
            for match in matches:
                text = match.group(1).strip()
                if text and len(text) > 3:
                    return text
        return ""

    def create_judge_metadata_chunk(
        self,
        record: Dict[str, Any],
        metadata: Dict[str, Any],
        doc_type: str = "lhc_judge",
    ) -> Optional[Dict[str, Any]]:
        name = record.get("full_name") or record.get("judge_name") or record.get("name") or ""
        if not name:
            return None

        designation = record.get("designation", "")
        biography = record.get("biography", "")
        judge_status = self.extract_judge_status(record, doc_type)
        is_chief = self.is_chief_justice(record)
        chief_status = self.extract_chief_justice_status(record, doc_type)
        chief_tenure = self.extract_chief_justice_tenure(record)

        content_parts = [f"JUDGE PROFILE: {name}"]

        if designation:
            content_parts.append(f"Position: {designation}")
            if "CHIEF JUSTICE" in designation.upper():
                content_parts.append("Chief Justice of Lahore High Court")

        if judge_status == "SITTING":
            content_parts.append("Currently serving as active judge. This judge is SITTING and actively serving.")
        elif judge_status == "FORMER":
            content_parts.append("Retired from judicial service. This judge is FORMER and no longer serving.")

        if is_chief:
            content_parts.append("This judge has served or is serving as Chief Justice.")
            if chief_status == "CURRENT":
                content_parts.append(
                    f"CURRENT CHIEF JUSTICE: {name} is the CURRENT Chief Justice of Lahore High Court. "
                    "This judge is currently serving as the Chief Justice."
                )
            elif chief_status == "FORMER":
                content_parts.append(
                    f"FORMER CHIEF JUSTICE: {name} is a FORMER Chief Justice of Lahore High Court. "
                    "This judge previously served as Chief Justice but is no longer in this position."
                )
            if chief_tenure:
                content_parts.append(f"Chief Justice served from: {chief_tenure}")

        if biography:
            summary = biography.split("\n\n")[0][:300]
            if summary:
                content_parts.append(f"Biography: {summary}")

        content = "\n".join(content_parts)
        return {
            "content": content,
            "chunk_index": 0,
            "chunk_size": len(content),
            "token_count": self.get_token_length(content),
            **metadata,
        }


chunking_service = ChunkingService()