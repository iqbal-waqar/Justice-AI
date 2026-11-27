// Reference lists for the Add case form (court picker + case auto-fill).
// District ids are the Punjab District Judiciary portal's own numbering (backend/services/court_lookup.py).

export const PUNJAB_DISTRICTS = [
    ['Sahiwal', 31], ['Lahore', 17], ['Multan', 22], ['Attock', 1], ['Bahawalnagar', 2], ['Bahawalpur', 3], ['Bhakkar', 4],
    ['Chakwal', 5], ['Chiniot', 6], ['D.G.Khan', 7], ['Faisalabad', 8], ['Gujranwala', 9], ['Gujrat', 10], ['Hafizabad', 11],
    ['Jhang', 12], ['Jhelum', 13], ['Kasur', 14], ['Khanewal', 15], ['Khushab', 16], ['Layyah', 18], ['Lodhran', 19],
    ['M.B.Din', 20], ['Mianwali', 21], ['Muzaffargarh', 23], ['Nankana Sahib', 24], ['Narowal', 25], ['Okara', 26],
    ['Pakpattan', 27], ['R.Y.Khan', 28], ['Rajanpur', 29], ['Rawalpindi', 30], ['Sargodha', 32], ['Sheikhupura', 33],
    ['Sialkot', 34], ['T.T.Singh', 35], ['Vehari', 36],
].map(([name, id]) => ({ id, name }));

// Which Lahore High Court bench hears appeals from a district (used to preset the bench).
const BENCH_OF = {
    Rawalpindi: 'Rawalpindi', Attock: 'Rawalpindi', Chakwal: 'Rawalpindi', Jhelum: 'Rawalpindi',
    Multan: 'Multan', Khanewal: 'Multan', Lodhran: 'Multan', Vehari: 'Multan', Sahiwal: 'Multan', Pakpattan: 'Multan',
    Muzaffargarh: 'Multan', 'D.G.Khan': 'Multan', Rajanpur: 'Multan', Layyah: 'Multan',
    Bahawalpur: 'Bahawalpur', Bahawalnagar: 'Bahawalpur', 'R.Y.Khan': 'Bahawalpur',
};
export const benchFor = (district) => BENCH_OF[district] || 'Lahore';

export const HIGH_COURTS = ['Lahore High Court', 'Islamabad High Court', 'Supreme Court of Pakistan'];

export const LHC_BENCHES = [
    { code: 'L', name: 'Lahore' }, { code: 'R', name: 'Rawalpindi' }, { code: 'M', name: 'Multan' }, { code: 'B', name: 'Bahawalpur' },
];

// Court types in a district, grouped as lawyers name them.
export const COURT_TYPES = [
    { group: 'District and Sessions Courts', items: ['District and Sessions Courts', 'Civil Courts', 'Criminal Courts'] },
    { group: 'Special Courts and Tribunals', items: ['Special Courts and Tribunals', 'Anti-Terrorism Courts', 'Banking Courts', 'Labour Courts', 'Environmental Protection Tribunals', 'Accountability Courts', 'Consumer Protection Courts', 'Narcotics Control Courts', 'Family Courts'] },
    { group: 'Magistrate Courts', items: ['Magistrate Courts', 'Judicial Magistrates', 'Executive Magistrates', 'Juvenile Courts'] },
    { group: 'Revenue Courts', items: ['Revenue Courts'] },
    { group: 'High Courts', items: HIGH_COURTS },
];

/* district | lhc | ihc | sc — what the court type means for auto-fill. */
export function levelOf(court_type) {
    if (court_type === 'Lahore High Court') return { value: 'lhc', fetch: true };
    if (court_type === 'Islamabad High Court') return { value: 'ihc', fetch: false };
    if (court_type === 'Supreme Court of Pakistan') return { value: 'sc', fetch: false };
    return { value: 'district', fetch: true };
}

export const CASE_CATEGORIES = ['Civil Suit', 'Criminal Trial', 'Bail Application', 'Family Suit', 'Guardian Petition', 'Succession', 'Rent Petition', 'Civil Appeal', 'Criminal Appeal', 'Family Appeal', 'Civil Revision', 'Criminal Revision', 'Writ Petition', 'Execution Petition', 'Other'];

/* The human-readable court line stored on the case ("Civil Courts, Sahiwal", "Lahore High Court, Multan Bench"). */
export function courtLabel({ district, court_type, bench }) {
    const level = levelOf(court_type).value;
    if (level === 'lhc') return `Lahore High Court${bench && bench !== 'Lahore' ? `, ${bench} Bench` : ''}`;
    if (level === 'ihc' || level === 'sc') return court_type;
    return district ? `${court_type || 'District and Sessions Courts'}, ${district}` : court_type || '';
}

/* Bench of an existing Lahore High Court case, read back from its court line. */
export function benchFromCourt(court = '') {
    const c = court.toLowerCase();
    return LHC_BENCHES.find(b => c.includes(b.name.toLowerCase()) && c.includes('high court'))?.name || null;
}
