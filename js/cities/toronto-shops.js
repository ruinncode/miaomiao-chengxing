// Storefront looks for the real Toronto shops in js/cities/toronto-streets.js (hand-authored, not generated).
// Read by js/hub/storefront.js. Nothing here is a logo: signs are plain text wordmarks in the brand's colours.
//
// Every look below is APPROXIMATE unless `ref` says otherwise: chain looks follow the brand's usual Toronto
// storefront (colour band, glazing, typical displays), not a survey of that exact branch; independent shops use
// the shop type + district (Distillery = 1860s–1920s red brick with arched openings and cast-iron details).
// Fields (all optional; unset → kind default in storefront.js):
//   fac   facade: glass | brick | heritage | stone | metal | wood | concrete | inset (no surround, e.g. inside a colonnade)
//   fc    facade colour        band  sign colour      tc  sign text colour   pin  accent stripe under the sign
//   sign  band | box | letters | plaque | awn (text on the awning)          bold/caps/it  wordmark style
//   awn   none | stripe | solid | canopy   ac / ac2 awning colours
//   win   full | grid | arch | split | high | frost      mull  mullion spacing (px)
//   door  l | r | c | 2 (double, centred)   dc door colour
//   glow  interior light colour at night    in  interior wall colour by day
//   props window display, left → right     out  things on the sidewalk in front
//   short / tiny  shorter sign texts used when the full name doesn't fit (no "…" truncation)
//   approx  what is estimated        ref  source consulted
window.MM_SHOPSTYLE = window.MM_SHOPSTYLE || {};
window.MM_SHOPSTYLE.toronto = {
  // chains: matched on the start of the OSM name
  brand: {
    'Starbucks': { fac: 'metal', fc: '#33363a', band: '#00704a', tc: '#ffffff', caps: 1, bold: 1, win: 'full', mull: 12, door: 'r', props: ['menu', 'counter', 'cups', 'pastry'], out: ['patio'], in: '#b89a72', glow: '#ffd59a', approx: 'chain look: dark metal frame, green sign band, floor-to-ceiling glass; branch not surveyed' },
    'Tim Hortons': { fac: 'brick', fc: '#8a4a34', band: '#c8102e', tc: '#ffffff', it: 1, bold: 1, pin: '#5a3420', win: 'full', mull: 10, door: 'l', props: ['menu', 'donuts', 'counter', 'cups'], in: '#d8b48a', glow: '#ffd79a', approx: 'chain look: red sign band with brown trim over brick, donut rack and menu boards; branch not surveyed' },
    'TD': { fac: 'glass', fc: '#2a3a30', band: '#008a3a', tc: '#ffffff', bold: 1, caps: 1, win: 'full', mull: 9, door: 'c', props: ['atm', 'desk', 'plant'], in: '#e4ece6', glow: '#e8fff0', approx: 'bank branch look: green band, full glazing, ATM + desk; branch not surveyed' },
    'CIBC': { fac: 'glass', fc: '#3a2a30', band: '#b5123a', tc: '#ffffff', bold: 1, caps: 1, win: 'full', mull: 9, door: 'l', props: ['atm', 'desk', 'plant'], in: '#ece6e6', glow: '#fff4e8', approx: 'bank branch look: burgundy band, full glazing; branch not surveyed' },
    'Scotiabank': { fac: 'stone', fc: '#c8c0b0', band: '#ec111a', tc: '#ffffff', bold: 1, win: 'full', mull: 9, door: 'r', props: ['atm', 'desk', 'plant'], in: '#eeeae6', glow: '#fff4e8', approx: 'bank branch look: red band, glass in a light stone base; branch not surveyed' },
    'LCBO': { fac: 'metal', fc: '#2a2c30', band: '#1a1a1a', tc: '#ffffff', pin: '#6ab04c', bold: 1, caps: 1, win: 'full', mull: 10, door: 'l', props: ['bottles', 'bottles', 'wine'], in: '#e8e4dc', glow: '#fff0d0', approx: 'chain look: black fascia, white wordmark, bottle shelves; green accent; branch not surveyed' },
    'Wine Rack': { fac: 'glass', fc: '#3a2a2a', band: '#7a1f2b', tc: '#f4eadc', win: 'full', door: 'r', props: ['wine', 'wine'], in: '#e8dcc8', glow: '#ffe0b0', approx: 'chain look: wine-red band, wine racks; branch not surveyed' },
    'Farm Boy': { fac: 'metal', fc: '#2a3a2a', band: '#2c6e2f', tc: '#ffffff', bold: 1, pin: '#d8342a', win: 'full', mull: 11, door: 'c', props: ['shelves', 'produce', 'shelves'], out: ['crates'], in: '#eae6d8', glow: '#fff4d0', approx: 'chain look: green band with red accent, produce up front; branch not surveyed' },
    'Rogers': { fac: 'glass', fc: '#2a2a2e', band: '#da291c', tc: '#ffffff', bold: 1, win: 'full', mull: 12, door: 'l', props: ['screens', 'phones', 'phones'], in: '#f2f2f2', glow: '#f4f8ff', approx: 'chain look: red band, bright white interior with phone tables; branch not surveyed' },
    'Popeyes': { fac: 'brick', fc: '#a85a3a', band: '#f47b20', tc: '#ffffff', bold: 1, pin: '#c8102e', win: 'full', door: 'r', props: ['menu', 'counter', 'chicken'], in: '#f0e0c8', glow: '#ffe0a0', approx: 'chain look: orange band with red accent, menu lightboxes; branch not surveyed' },
    'The Keg': { fac: 'stone', fc: '#5a4a3e', band: '#1a1a1a', tc: '#d8b46a', caps: 1, win: 'grid', mull: 7, door: 'c', dc: '#3a2416', props: ['tables', 'tables'], in: '#5a3a28', glow: '#ffb862', out: ['planter', 'planter'], approx: 'steakhouse look: dark stone, black sign with gold letters, dim warm dining room; branch not surveyed' },
    'Staples': { fac: 'glass', fc: '#2a2a2e', band: '#cc0000', tc: '#ffffff', bold: 1, win: 'full', door: 'c', props: ['shelves'], in: '#eeeeee', glow: '#f4f8ff', short: 'Staples', approx: 'chain look: red band, shelves; branch not surveyed' },
    'west elm': { fac: 'metal', fc: '#1e1e20', band: '#1e1e20', tc: '#ffffff', win: 'full', mull: 14, door: 'l', props: ['sofa', 'lamp'], in: '#e6ddd0', glow: '#ffe2b0', approx: 'chain look: black frame and sign, lowercase white wordmark, living-room displays' },
    'Aldo': { fac: 'metal', fc: '#1a1a1a', band: '#1a1a1a', tc: '#ffffff', caps: 1, bold: 1, win: 'full', door: 'c', props: ['shoes', 'shoes'], in: '#efece6', glow: '#fff4e0', approx: 'chain look: black fascia, shoe shelves' },
    'Swarovski': { fac: 'stone', fc: '#e8e4dc', band: '#ffffff', tc: '#1a1a1a', caps: 1, win: 'full', door: 'r', props: ['jewels', 'jewels'], in: '#f4f4f4', glow: '#f8f8ff', approx: 'boutique look: white sign, black caps, lit glass cases' },
    'Tip Top Tailors': { fac: 'metal', fc: '#1a1a1a', band: '#1a1a1a', tc: '#ffffff', caps: 1, win: 'full', door: 'l', props: ['mannequin', 'hangers'], in: '#e8e4dc', glow: '#fff0d0', short: 'Tip Top', approx: 'chain look: black sign, suits on mannequins' },
    'Lids': { fac: 'inset', band: '#1a1a1a', tc: '#ffffff', caps: 1, bold: 1, win: 'full', door: 'c', props: ['caps', 'caps'], in: '#efefef', glow: '#f8f8ff', approx: 'chain kiosk look: black sign, wall of caps; inside the station' },
    'Church\u2019s': { fac: 'brick', fc: '#9a4a3a', band: '#d4202a', tc: '#ffffff', bold: 1, win: 'full', door: 'l', props: ['menu', 'counter', 'chicken'], in: '#f0e0c8', glow: '#ffe0a0', short: 'Church\u2019s', approx: 'chain look: red band, counter + menu boards' },
    "Church's": { fac: 'brick', fc: '#9a4a3a', band: '#d4202a', tc: '#ffffff', bold: 1, win: 'full', door: 'l', props: ['menu', 'counter', 'chicken'], in: '#f0e0c8', glow: '#ffe0a0', short: "Church's", approx: 'chain look: red band, counter + menu boards' },
    'BeaverTails': { fac: 'wood', fc: '#6a4426', band: '#4a2a16', tc: '#f4e2b8', bold: 1, win: 'full', door: 'r', props: ['counter', 'pastry'], awn: 'solid', ac: '#b8322a', in: '#e8c898', glow: '#ffcf80', short: 'Beaver', tiny: 'BT', approx: 'chain look: brown wood stand, cream wordmark, red canopy; branch not surveyed' },
    'F45': { fac: 'metal', fc: '#1a2440', band: '#1a2440', tc: '#ffffff', caps: 1, bold: 1, pin: '#d8342a', win: 'frost', door: 'r', props: ['weights'], in: '#c8d0dc', glow: '#dfe8ff', short: 'F45', approx: 'gym look: navy fascia, frosted glass' },
    'Hunny Pot': { fac: 'metal', fc: '#1a1a1a', band: '#f2b21a', tc: '#1a1a1a', bold: 1, win: 'frost', door: 'l', in: '#e8dcb8', glow: '#ffe8a0', short: 'Hunny Pot', approx: 'shop look: honey-yellow band, frosted windows (exterior only)' },
    "The Burger's Priest": { fac: 'brick', fc: '#3a3a3a', band: '#1a1a1a', tc: '#ffffff', caps: 1, win: 'full', door: 'r', props: ['menu', 'counter'], in: '#e8e0d0', glow: '#ffe8b0', short: 'Burger Priest', tiny: 'Priest', approx: 'chain look: black and white sign, counter' },
    'Mad Radish': { fac: 'glass', fc: '#2a2e2a', band: '#3a8a4a', tc: '#ffffff', win: 'full', door: 'l', props: ['counter', 'produce'], in: '#eef0e4', glow: '#fff8e0', short: 'Radish', approx: 'chain look: fresh-green sign, salad counter' },
    'Joey': { fac: 'stone', fc: '#3a3634', band: '#1a1a1a', tc: '#f0e8d8', caps: 1, win: 'full', mull: 13, door: 'c', props: ['tables', 'bar', 'tables'], in: '#4a3a30', glow: '#ffb25a', out: ['patio'], approx: 'restaurant look: dark stone, big glazing, warm dining room' },
  },
  // single shops, keyed by OSM id
  shops: {
    // Distillery District (heritage brick; signs are small plaques/boards with gooseneck lamps)
    'n12091108916': { fac: 'heritage', win: 'frost', band: '#1e2420', tc: '#e8dcb0', short: 'FIKA', approx: 'heritage brick unit, frosted glass (exterior only)' },
    'n12091108914': { fac: 'heritage', band: '#1a1a1a', tc: '#e8d8a8', props: ['barber'], out: ['pole'], short: 'McManus', tiny: 'M&C', approx: 'barbershop in a heritage brick unit' },
    'n12091108915': { fac: 'heritage', band: '#1e5a6a', tc: '#ffffff', props: ['socks'], short: 'FloorPlay', tiny: 'Socks', approx: 'sock shop: wall of colourful socks' },
    'n3338988889': { fac: 'heritage', band: '#1a1a1a', tc: '#e8c070', props: ['bar', 'tables'], out: ['barrel', 'patio'], glow: '#ffb050', in: '#5a3a26', short: 'Old Flame', approx: 'brewery taproom in heritage brick' },
    'n3338988879': { fac: 'heritage', band: '#1a1a1a', tc: '#d8b46a', win: 'arch', props: ['tables', 'bread', 'tables'], out: ['patio'], glow: '#ffbe6a', in: '#6a4a30', short: 'Cluny Bistro', tiny: 'Cluny', approx: 'French bistro with tall arched windows; patio' },
    'n3338997893': { fac: 'heritage', band: '#2a1e16', tc: '#e8d8b8', props: ['bags', 'bags'], short: 'Jacob & Seb.', approx: 'leather goods boutique' },
    'n475881501': { fac: 'heritage', band: '#1a1a1a', tc: '#f0e0b8', caps: 1, win: 'arch', props: ['kettle', 'tables', 'bar'], out: ['patio', 'barrel'], glow: '#ffb050', in: '#5a3a26', short: 'Mill St.', ref: 'https://commons.wikimedia.org/wiki/Category:Mill_Street_Brewery', approx: 'brewpub in a heritage brick building; brew kettle in the window' },
    'n5572377723': { fac: 'heritage', band: '#1a2a34', tc: '#e8e0c8', win: 'arch', props: ['tables', 'bar'], out: ['patio'], glow: '#ffbe6a', in: '#5a4030', approx: 'oyster house / restaurant in heritage stone and brick' },
    'n6001296589': { fac: 'heritage', band: '#1a1a1a', tc: '#e8d8b0', props: ['menu', 'counter', 'cups'], out: ['board'], short: 'Arena Coffee', tiny: 'Arena', approx: 'cafe in a heritage brick unit' },
    'n3522054593': { fac: 'heritage', band: '#1a1a1a', tc: '#ffffff', caps: 1, win: 'arch', props: ['mannequin', 'hangers', 'mannequin'], short: 'Gotstyle', approx: 'menswear in a heritage brick building' },
    'n3522052992': { fac: 'heritage', band: '#2a2a2a', tc: '#e8dcc0', props: ['mannequin', 'hangers'], approx: 'menswear boutique' },
    'n3522054595': { fac: 'heritage', band: '#b8322a', tc: '#ffffff', props: ['hangers'], short: 'Red Canoe', tiny: 'Canoe', approx: 'clothing shop; red sign' },
    'n12091108925': { fac: 'heritage', band: '#2a4a44', tc: '#ffffff', props: ['shelves'], short: 'Skin Treats', tiny: 'Skin', approx: 'beauty shop' },
    'n3522054594': { fac: 'heritage', band: '#1a1a1a', tc: '#ffffff', props: ['hangers'], short: 'Hoi Bo', approx: 'clothing boutique' },
    'n3522054597': { fac: 'heritage', band: '#1a1a1a', tc: '#e8d8a8', props: ['jars'], short: 'vomFASS', tiny: 'FASS', approx: 'oil and vinegar deli: jars on shelves' },
    'n3522052991': { fac: 'heritage', band: '#1a1a1a', tc: '#ffffff', props: ['hangers'], short: 'Blackbird', approx: 'vintage clothing' },
    'n4035520640': { fac: 'heritage', band: '#1a1a1a', tc: '#ffffff', caps: 1, props: ['hangers'], short: 'Peace Co.', tiny: 'Peace', approx: 'clothing shop' },
    'n12091108922': { fac: 'heritage', band: '#2a3a5a', tc: '#ffffff', props: ['pastry'], short: 'Sweetie Pie', tiny: 'Pie', approx: 'bakery' },
    'n4035520534': { fac: 'heritage', band: '#1a1a1a', tc: '#e8d8a8', win: 'arch', props: ['jewels', 'jewels'], short: 'Corktown', approx: 'jewellery shop' },
    'n475881505': { fac: 'heritage', band: '#1a1a1a', tc: '#d8b46a', win: 'arch', props: ['counter', 'cups', 'pastry'], out: ['patio'], glow: '#ffc070', in: '#6a4a30', short: 'Balzac\'s', approx: 'cafe in a tall heritage brick building with arched windows' },
    // Queens Quay
    'n1251456919': { fac: 'glass', band: '#1e4a8a', tc: '#ffffff', props: ['menu', 'counter'], short: 'Alexandros', approx: 'souvlaki counter' },
    'n13050093714': { fac: 'glass', band: '#1a2a3a', tc: '#e8dcb0', props: ['bar', 'tables'], glow: '#ffb862', in: '#4a3a30', approx: 'hotel bar (lobby level)' },
    'n9828803323': { fac: 'glass', band: '#4a2a5a', tc: '#ffffff', props: ['barber'], short: 'Prayosha', approx: 'threading and wax bar' },
    'n267314406': { fac: 'glass', band: '#2a6a3a', tc: '#ffffff', props: ['shelves', 'shelves'], out: ['crates'], short: 'Nav\u2019s', approx: 'grocery' },
    'n4092587731': { fac: 'glass', band: '#1e3a6a', tc: '#ffffff', props: ['racks'], short: 'Platis', approx: 'dry cleaner: clothes rack' },
    'n12849797697': { fac: 'glass', band: '#2a4a3a', tc: '#ffffff', props: ['counter', 'cups'], out: ['patio'], short: 'Ivy Coffee', tiny: 'Ivy', approx: 'cafe' },
    'n12849850916': { fac: 'inset', band: '#1e5a8a', tc: '#ffffff', props: ['posters'], short: 'Harbour Tours', tiny: 'Tours', approx: 'harbour-tour ticket kiosk' },
    'n420549585': { fac: 'inset', band: '#1e5a8a', tc: '#ffffff', props: ['posters'], short: 'Boat Tours', tiny: 'Tickets', approx: 'boat-tour ticket booth' },
    'n420549584': { fac: 'inset', band: '#e8b020', tc: '#5a2a10', props: ['counter'], short: 'Churros', approx: 'churro stand' },
    'n13016314592': { fac: 'glass', band: '#1a2a3a', tc: '#ffffff', props: ['tables'], out: ['patio'], short: 'Queens Harbour', approx: 'waterfront restaurant' },
    // Union
    'n12823412365': { fac: 'inset', band: '#1a3a6a', tc: '#ffffff', props: ['shelves'], short: 'Gateway', approx: 'newsstand inside the station' },
    'w14744491': { fac: 'none', approx: 'the station itself: drawn by the colonnade building, no storefront' },
    // King St W
    'n13661339260': { fac: 'glass', band: '#2a5a3a', tc: '#ffffff', props: ['shelves'], out: ['crates'], short: 'Pinto', approx: 'convenience market' },
    'n1141395501': { fac: 'glass', band: '#d86a1a', tc: '#ffffff', props: ['menu', 'counter'], short: 'Tacos', approx: 'taco counter' },
    'n12994457039': { fac: 'glass', band: '#1a1a1a', tc: '#ffffff', props: ['menu', 'counter'], approx: 'lunch counter' },
    'n12590737060': { fac: 'glass', band: '#1e3a6a', tc: '#ffffff', props: ['pastry'], short: 'Michel\u2019s', tiny: 'Bakery', approx: 'bakery cafe' },
    'n12893555612': { fac: 'stone', band: '#1a1a1a', tc: '#8ab0e0', caps: 1, props: ['tables'], glow: '#ffb862', in: '#4a3a30', short: 'Black+Blue', approx: 'steakhouse' },
    'n12893512353': { fac: 'stone', band: '#1a1a1a', tc: '#e8c070', props: ['bar', 'tables'], glow: '#ffb050', in: '#4a3a30', out: ['patio'], approx: 'beer hall' },
    'n1215363422': { short: 'Tip Top' },
    'n1157111671': { fac: 'glass', band: '#2a4a2a', tc: '#ffffff', props: ['flowers'], out: ['buckets'], short: 'Pistil', approx: 'florist: flower buckets out front' },
    'n1141474875': { fac: 'glass', band: '#1a1a1a', tc: '#ffffff', props: ['menu', 'counter'], short: 'Bento', approx: 'bento counter' },
    // Yonge-Eglinton
    'n13764023918': { fac: 'glass', band: '#1a1a1a', tc: '#ffffff', props: ['counter', 'tables'], glow: '#ffc070', short: 'Moru Katsu', tiny: 'Moru', approx: 'katsu restaurant' },
    'n7779253324': { approx: 'TD branch on the corner (wider than the POI suggests)' },
    'n13570992784': { fac: 'glass', band: '#3a7a3a', tc: '#ffffff', props: ['produce', 'shelves'], out: ['crates'], short: 'Salus Fresh', tiny: 'Salus', approx: 'fresh food market' },
    'n12770977460': { fac: 'glass', band: '#2a2a3a', tc: '#e8dcc0', props: ['plant'], short: 'Signature', tiny: 'Clinic', approx: 'cosmetic clinic: plain frosted front' , win: 'frost' },
    'n2111244292': { fac: 'brick', band: '#b8322a', tc: '#ffffff', props: ['pizza', 'tables'], out: ['patio'], glow: '#ffb050', short: 'PI CO. Pizza', tiny: 'PI CO.', approx: 'pizza bar: oven glow' },
    'n13689858678': { fac: 'glass', band: '#1a1a1a', tc: '#ffffff', props: ['counter', 'cups'], out: ['board'], short: 'Hale Coffee', tiny: 'Hale', approx: 'cafe' },
    'n11582894865': { fac: 'glass', band: '#1a1a1a', tc: '#ffffff', props: ['lanterns', 'tables'], glow: '#ffb862', short: 'Sansotei', approx: 'ramen shop with lanterns' },
    'n9722676572': { fac: 'glass', band: '#2a5a5a', tc: '#f4ead8', props: ['tables', 'bar'], glow: '#ffbe6a', out: ['patio'], approx: 'Italian restaurant' },
    'n7596627757': { fac: 'brick', band: '#2a6a3a', tc: '#ffd040', props: ['tables'], glow: '#ffb050', approx: 'Brazilian steakhouse' },
    'n925965281': { fac: 'glass', band: '#1e4a8a', tc: '#ffffff', props: ['screens'], short: 'iRepair', approx: 'phone/computer repair' },
  },
  // buildings with a recognisable landmark base (matched on name)
  bld: {
    'Westin Harbour Castle': { style: 'westin', ref: 'https://www.toronto.ca/wp-content/uploads/2024/03/8d3a-G.7-Westin-Harbour-Castle-Hotel-Cultural-Heritage-Evaluation-Reportreduced.pdf', approx: 'massing simplified: exposed-aggregate precast podium, horizontal window bands, open ground-floor colonnade' },
    'Union Station': { style: 'beaux', ref: 'https://en.wikipedia.org/wiki/Union_Station_(Toronto)', approx: 'Front St colonnade of giant limestone columns under an attic; column count compressed' },
  },
};
