// Building and place information shown in the info panel and used by search, the map and the tour.
// Every entry lists its sources and how confident the identification and position are:
//   verified   - identity and position established from authoritative sources (Historic England grid references, official pages)
//   probable   - identity inferred from official descriptions of where it is (e.g. "opposite Founder's central entrance")
//   project    - identified on the ground by the original project (campus drive video); not independently verified here
//   candidate  - plausible match, unconfirmed; shown with a question mark
//   area       - an approximate area rather than one building
export const SRC = {
  he_founders: { label: 'Historic England list entry 1028946', url: 'https://historicengland.org.uk/listing/the-list/list-entry/1028946' },
  he_statue_n: { label: 'Listed building 1189442 (statue, North Quad)', url: 'https://britishlistedbuildings.co.uk/101189442-royal-holloway-college-statue-in-north-quadrangle-runnymede-englefield-green-east-ward' },
  he_statue_s: { label: 'Listed building 1028947 (statue, South Quad)', url: 'https://britishlistedbuildings.co.uk/101028947' },
  he_pool: { label: 'Listed building 1378057 (swimming pool)', url: 'https://britishlistedbuildings.co.uk/101378057-royal-holloway-college-swimming-pool-south-west-of-main-building-runnymede-englefield-green-east-ward' },
  he_gates: { label: 'Listed building 1294234 (entrance gates and lodge)', url: 'https://britishlistedbuildings.co.uk/101294234-royal-holloway-college-entrance-gates-and-lodge-runnymede-englefield-green-east-ward' },
  rh_history: { label: 'Royal Holloway: history of the college', url: 'https://www.royalholloway.ac.uk/about-us/art-collections-and-archives/picture-gallery/history-of-the-college/' },
  rh_campus: { label: 'Royal Holloway: our campus', url: 'https://www.royalholloway.ac.uk/student-life/our-campus/' },
  rh_find: { label: 'Royal Holloway: how to find us', url: 'https://royalholloway.ac.uk/about-us/more/how-to-find-us' },
  rh_map: { label: 'Royal Holloway campus map (August 2025)', url: 'https://www.royalholloway.ac.uk/media/o3kd5zcu/campus-map-august-2025.pdf' },
  vt_life: { label: 'Official virtual tour (Life)', url: 'https://virtualexperience.royalholloway.ac.uk/file_hosting/virtual-tour-2025/life.html' },
  vt_study: { label: 'Official virtual tour (Study)', url: 'https://virtualexperience.royalholloway.ac.uk/file_hosting/virtual-tour-2025/study.html' },
  rh_ewd: { label: 'Royal Holloway news: opening of the Emily Wilding Davison Building', url: 'https://www.royalholloway.ac.uk/about-us/news/hrh-the-princess-royal-opens-the-new-emily-wilding-davison-building-at-royal-holloway' },
  rh_shilling: { label: 'Royal Holloway: the Beatrice Shilling Building', url: 'https://venue.royalholloway.ac.uk/student-life/our-campus/explore-the-campus/campus-investment/the-beatrice-shilling-building' },
  rh_isg: { label: 'Royal Holloway: history of the Information Security Group (PDF)', url: 'https://www.royalholloway.ac.uk/media/2019/historyofisg.pdf' },
  acc_su: { label: "AccessAble: Students' Union", url: 'https://www.accessable.co.uk/royal-holloway-university-of-london/access-guides/students-union' },
  acc_bedford: { label: 'AccessAble: Bedford Building', url: 'https://www.accessable.co.uk/royal-holloway-university-of-london/access-guides/bedford-building' },
  wiki_founders: { label: "Wikipedia: Founder's Building", url: 'https://en.wikipedia.org/wiki/Founder%27s_Building' },
  vweb: { label: 'Victorian Web: Royal Holloway College', url: 'https://victorianweb.org/art/architecture/holloway/1.html' },
  project: { label: 'Original RHUL Campus Drive project (campus drive video)', url: 'https://alexphilip01.github.io/rhul.html' }
};

// ref: { building: 'Bxx' } | { feature: 'northQuad' } (Founder's Building features) | { place: id } | { xz: [x, z] }
export const ENTRIES = [
  {
    id: 'founders', name: "Founder's Building", ref: { building: 'B25' }, conf: 'verified', category: 'historic',
    func: 'Picture Gallery, Chapel, dining hall, reading room, lecture theatre, offices and accommodation for around 500 students.',
    text: ["Designed by William Henry Crossland for Thomas Holloway and modelled on French Renaissance châteaux, chiefly Chambord. The first brick was laid in 1879; Queen Victoria opened the college in 1886.",
      'Four storeys and an attic of red brick with stone bands and dressings, built round two courtyards. The entrance front faces north-west towards Egham Hill.'],
    sig: 'Grade I listed (1986). Pevsner called it "the most ebullient Victorian building in the Home Counties."',
    sources: ['he_founders', 'rh_history', 'rh_campus', 'vweb'], tour: true
  },
  {
    id: 'clock-tower', name: 'Clock Tower (entrance front)', ref: { feature: 'clockTower' }, conf: 'verified', category: 'feature',
    func: "Main entrance arch on the north-west front of Founder's Building.",
    text: ['A central arch leads through to the North Quad. The three-storey centre section carries an entablature, a balustrade and a clock face; the north tower above is known as the Clock Tower.'],
    sig: 'Height of the tower here is an estimate.', sources: ['he_founders', 'wiki_founders']
  },
  {
    id: 'north-quad', name: 'North Quad', ref: { feature: 'northQuad' }, conf: 'verified', category: 'feature',
    func: "The north courtyard of Founder's Building, with lawns, paths and seating.",
    text: ['At its centre stands a statue of Queen Victoria beside a throne, on a plinth carried by four bulbous columns, by Count Gleichen (1887). Queen Victoria granted the "Royal" title to Holloway College.'],
    sig: 'The statue is listed Grade II; its grid reference was used to position this model.', sources: ['he_statue_n', 'vt_life', 'rh_history']
  },
  {
    id: 'south-quad', name: 'South Quad', ref: { feature: 'southQuad' }, conf: 'verified', category: 'feature',
    func: "The south courtyard of Founder's Building; home to the Crosslands bar and eatery.",
    text: ['At its centre is the statue of Thomas Holloway standing and Jane Holloway seated, by Count Gleichen (c. 1887), on a Baroque plinth with four muses at the corners.'],
    sig: 'The statue is listed Grade II; its grid reference was used to position this model.', sources: ['he_statue_s', 'vt_life']
  },
  {
    id: 'chapel', name: 'Chapel', ref: { feature: 'chapel' }, conf: 'verified', category: 'feature',
    func: 'Non-denominational chapel: Choral Evensong, Compline and Catholic Masses; known for daily sung morning services.',
    text: ['The Chapel lies east of the main entrance inside Founder\'s Building, with a depressed barrel-vaulted ceiling, painted relief panels and an apse. The Chapel Choir gives around 50 concerts a year.'],
    sig: 'Interior position from the Historic England description; the interior is not modelled.', sources: ['he_founders', 'vt_life', 'vweb']
  },
  {
    id: 'gallery', name: 'Picture Gallery', ref: { feature: 'gallery' }, conf: 'verified', category: 'feature',
    func: "Thomas Holloway's collection of Victorian paintings, open to students, staff and visitors.",
    text: ['West of the main entrance, under a barrel-vaulted ceiling. Holloway bought 77 paintings for the college; artists include William Powell Frith, John Everett Millais and Edward Burne-Jones.'],
    sig: 'Interior position from the Historic England description; the interior is not modelled.', sources: ['he_founders', 'vt_life', 'vweb']
  },
  {
    id: 'lantern-tower', name: 'Lantern Tower and dining hall', ref: { feature: 'lanternTower' }, conf: 'verified', category: 'feature',
    func: "Founder's Dining Hall, serving students since 1886, lies in the range between the two courtyards.",
    text: ['The range between the courtyards is crowned by an octagonal turret with radiating arches and buttresses rising to a lantern, known as the Lantern Tower.'],
    sig: 'Turret height here is an estimate.', sources: ['he_founders', 'wiki_founders', 'vt_life']
  },
  {
    id: 'dragon-tower', name: 'South-east front (Dragon Tower)', ref: { feature: 'dragonTower' }, conf: 'verified', category: 'feature',
    func: "Central pavilion of the south-east front of Founder's Building.",
    text: ['Four circular turrets rise to radial buttresses, urns and a louvred bell turret over a central vaulted entrance. The south tower is known as the Dragon Tower, after its dragon-like gargoyles.'],
    sig: 'Detail is simplified; heights are estimates.', sources: ['he_founders', 'wiki_founders']
  },
  {
    id: 'ewd', name: 'Emily Wilding Davison Building', ref: { building: 'B48' }, conf: 'probable', category: 'academic',
    func: 'Library (24/7 for most of the year), Student Services Centre, careers and employability, event and exhibition spaces, café and Students\' Union shop.',
    text: ['Opened in 2017 and formally opened by The Princess Royal, it is named after the suffragette and alumna Emily Wilding Davison. Its roof terrace overlooks Founder\'s Square and Founder\'s Building.',
      "Royal Holloway's directions place the Visitors' Centre in Founder's central entrance, opposite this building."],
    sig: 'Façade shown is generic: no photographs could be inspected in this build.', sources: ['rh_ewd', 'rh_find', 'vt_life'], tour: true
  },
  {
    id: 'founders-square', name: "Founder's Square", ref: { feature: 'foundersSquare' }, conf: 'probable', category: 'space',
    func: 'Open courtyard at the heart of the campus with paved areas and benches; used for events.',
    text: ["Bordered by Founder's Building and the Emily Wilding Davison Building. The Windsor Building, with the largest auditorium on campus (400 seats), sits just off the square."],
    sig: 'Bench positions are illustrative.', sources: ['vt_life', 'vt_study', 'rh_ewd']
  },
  {
    id: 'windsor', name: 'Windsor Building', ref: { building: 'B23' }, conf: 'candidate', category: 'academic',
    func: 'Conference centre with a 400-seat auditorium (the largest on campus), foyer, breakout spaces and seminar rooms.',
    text: ["The official tour says it sits just off Founder's Square. This footprint, on the north side of the square, is a plausible match but has not been confirmed."],
    sig: 'Unconfirmed identification.', sources: ['vt_study']
  },
  {
    id: 'shilling', name: 'Shilling Building', ref: { building: 'B20' }, conf: 'project', category: 'academic',
    func: 'Home of the Department of Electronic Engineering: 268-seat auditorium, teaching and research labs, fabrication lab, open 24/7.',
    text: ['Opened in 2018 and named after the aeronautical engineer Beatrice Shilling. A rooftop field laboratory has photovoltaic panels and a wind turbine. Three storeys, about 3,950 m².'],
    sig: 'Identified by the original project from the campus video; the rooftop wind turbine is not modelled.', sources: ['rh_shilling', 'vt_study', 'project']
  },
  {
    id: 'union', name: "Students' Union and Union Plaza", ref: { building: 'B04' }, conf: 'project', category: 'social',
    func: "Students' Union: two floors with Tommy's Kitchen/bar and the Advice Centre; Union Plaza outside has food vans, benches and a permanent canopy.",
    text: ['A weekly street-food market runs at the Union. The student-run Insanity Radio broadcasts from the campus on 103.2 FM.'],
    sig: 'Identification from the original project; car park 4 lies behind the Union next to the International Building (AccessAble).', sources: ['vt_life', 'acc_su', 'project'], tour: true
  },
  {
    id: 'pool', name: 'Victorian swimming pool (1893)', ref: { building: 'B28' }, conf: 'verified', category: 'historic',
    func: 'Listed 1893 indoor swimming pool. Its present-day use was not confirmed for this build.',
    text: ['A single-storey building with a red-brick base, pebble-dash bands and a hipped tiled roof with a glazed section over the pool. The listing records its original filtration plant.'],
    sig: 'Grade II listed. Its grid reference matched this traced footprint to within 2 m and was used to fix the scale of the whole model.', sources: ['he_pool']
  },
  {
    id: 'gates', name: 'Main entrance gates and lodge', ref: { place: 'gate' }, conf: 'verified', category: 'historic',
    func: 'The main entrance from Egham Hill (A30), with a bus stop in front of it.',
    text: ['Five stone piers topped with urns, joined by short quadrant walls of balusters, with plain iron gates finished in spear-head tips. The lodge is red brick with stone dressings, a splayed bay window, a tiled roof and two chimney stacks (c. 1880).'],
    sig: 'Grade II listed. The arrangement of piers and the lodge layout are simplified.', sources: ['he_gates', 'acc_bedford']
  },
  {
    id: 'gowar', name: 'Gowar & Wedderburn halls', ref: { building: 'B66' }, conf: 'project', category: 'residential',
    func: 'Self-catered halls with en-suite bedrooms and shared kitchen/diners: Gowar 217 rooms, Wedderburn 353 rooms.',
    text: ['At the southern end of campus. Concrete blocks raised on columns over parking, as recorded in the original project.'],
    sig: 'Which block is Gowar and which Wedderburn is not distinguished here.', sources: ['vt_life', 'project'], tour: true
  },
  {
    id: 'academic', name: 'Academic quarter', ref: { place: 'academic' }, conf: 'area', category: 'area',
    func: 'Teaching and research buildings including Bedford (Computer Science, Electronic Engineering, Information Security, Mathematics, Physics), Bourne, McCrea and Moore.',
    text: ['The Moore Building, a botanical laboratory in the 1890s, now houses the School of Business and Management behind a yellow and green façade. Computer Science, in the Bedford Building, was founded in 1968.',
      "The Information Security Group launched its MSc in Information Security in October 1992, the first of its kind in the world."],
    sig: 'Individual buildings in this area are not yet identified on the map.', sources: ['vt_study', 'acc_bedford', 'rh_isg'], tour: true
  },
  {
    id: 'north', name: 'Boilerhouse & George Eliot', ref: { place: 'north' }, conf: 'area', category: 'area',
    func: 'Boilerhouse: lecture theatre, seminar room and café in the former boiler house; George Eliot: self-catered townhouses on the northern side of campus.',
    text: ['The Boilerhouse once generated heat and power for the whole university. Its café has a cobbled courtyard; the old Tank Room is now a seminar room for up to 80 students.'],
    sig: 'Area placed by the original project.', sources: ['vt_study', 'vt_life', 'project'], tour: true
  },
  {
    id: 'science', name: 'Wolfson & Shilling area', ref: { place: 'science' }, conf: 'area', category: 'area',
    func: 'Science buildings on the east side of the academic area.', text: ['See the Shilling Building for Electronic Engineering.'],
    sig: 'Area placed by the original project.', sources: ['project']
  },
  {
    id: 'hub', name: 'The Hub', ref: { place: 'hub' }, conf: 'area', category: 'social',
    func: 'Dining venue: hot dishes, burgers, vegetarian and vegan meals, Kimiko Japanese Kitchen, and Imagine downstairs for bubble tea and ice cream.',
    text: ['Car park 6A lies behind Tuke hall, next to Tuke and The Hub (AccessAble). The five-storey clad halls around it are as recorded by the original project.'],
    sig: 'Area placed by the original project.', sources: ['vt_life', 'acc_su', 'project'], tour: true
  },
  {
    id: 'sports', name: 'Sports grounds', ref: { place: 'sports' }, conf: 'area', category: 'area',
    func: 'The Sports Centre has a gym, sports hall, 3G pitch (FA-accredited for 11-a-side) and hockey pitch; the Hockey Club is the largest sports club on campus.',
    text: ['The official campus map signposts the Sports Centre ("To Sports Centre"); its building and pitches are not modelled because their positions could not be confirmed.'],
    sig: 'Area placed by the original project.', sources: ['vt_life', 'rh_map', 'project'], tour: true
  },
  {
    id: 'woodland', name: 'Woodland & Meadow', ref: { place: 'woodland' }, conf: 'area', category: 'area',
    func: 'Managed woodland and grassland; the Woodland Walk and the Bee Walk.',
    text: ['The Meadow, just beyond Jane Holloway Hall, is semi-natural grassland on the Bee Walk past a beehive. The campus woodlands are managed for wildlife under the Living Campus initiative.'],
    sig: 'Area placed by the original project.', sources: ['vt_life', 'project'], tour: true
  },
  {
    id: 'tennis', name: 'Tennis courts', ref: { place: 'tennis' }, conf: 'project', category: 'sport',
    func: 'Two tennis courts in a fenced enclosure.', text: ['The 2018 campus plan lists car park P12 as "Tennis Courts".'],
    sig: 'Position from the original project (campus video).', sources: ['project']
  }
];
export const CONF_LABEL = { verified: 'Verified', probable: 'Probable', project: 'From the original project', candidate: 'Unconfirmed', area: 'Approximate area' };
