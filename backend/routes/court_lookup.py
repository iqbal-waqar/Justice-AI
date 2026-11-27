"""Case auto-fill: read a case from the court's public website.

All endpoints need a signed-in firm member. They proxy the Punjab District
Judiciary portal and the Lahore High Court status page (services/court_lookup.py)
so the browser never talks to the court sites and the captcha is solved server side.
"""
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from backend.interactors.firm_interactor import FirmContext, current_firm
from backend.schemas import CauseListIn, CourtLookupIn, FirLookupIn
from backend.services.court_lookup import DISTRICTS, LHC_BENCHES, district_portal, lhc_status

router = APIRouter(prefix="/court-lookup")


@router.get("/districts")
def districts(ctx: FirmContext = Depends(current_firm)):
    return {"districts": [{"id": i, "name": n} for n, i in DISTRICTS.items()],
            "lhc_benches": [{"code": c, "name": n} for c, n in LHC_BENCHES.items()]}


@router.post("/case")
def lookup_case(body: CourtLookupIn, ctx: FirmContext = Depends(current_firm)):
    if body.court == "district":
        if not body.district_id:
            raise HTTPException(status_code=400, detail="Choose the district first.")
        rec = district_portal.by_case_number(body.district_id, body.case_number)
    else:
        rec = lhc_status.by_case_number(body.case_number, body.bench or "L")
    if not rec:
        raise HTTPException(status_code=404, detail="No matching case found — you can still enter the details manually.")
    return rec


@router.post("/fir")
def lookup_fir(body: FirLookupIn, ctx: FirmContext = Depends(current_firm)):
    hits = district_portal.by_fir(body.district_id, body.fir_number, body.fir_year, body.police_station_id)
    return {"results": hits}


@router.get("/detail")
def case_detail(url: str, ctx: FirmContext = Depends(current_firm)):
    """Full record for a row picked from an FIR search or a cause list."""
    if not url.startswith("https://dsj.punjab.gov.pk/casedetail/"):
        raise HTTPException(status_code=400, detail="Not a court portal case link.")
    return district_portal.detail(url, {})


@router.get("/judges")
def judges(district_id: int, ctx: FirmContext = Depends(current_firm)):
    return {"district": next((n for n, i in DISTRICTS.items() if i == district_id), None),
            "judges": district_portal.judges(district_id)}


@router.get("/police-stations")
def police_stations(district_id: int, ctx: FirmContext = Depends(current_firm)):
    return {"police_stations": district_portal.police_stations(district_id)}


@router.post("/cause-list")
def cause_list(body: CauseListIn, ctx: FirmContext = Depends(current_firm)):
    return district_portal.cause_list(body.district_id, body.court_id, body.date)


@router.post("/cause-list/pick")
def pick_from_cause_list(body: CourtLookupIn, ctx: FirmContext = Depends(current_firm)):
    """A case tapped in a cause list is a CMS number — fetch its full record."""
    if not body.district_id:
        raise HTTPException(status_code=400, detail="Choose the district first.")
    rec = district_portal.by_case_number(body.district_id, body.case_number)
    if not rec:
        raise HTTPException(status_code=404, detail="The case could not be opened on the court portal.")
    return rec
