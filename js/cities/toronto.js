// ============================================================
//  Toronto — flagship city config (data only).
//  Schema reference for every city file; all names and station
//  orders checked against public sources (see docs/TRAVEL_NOTES.md).
//  Hotels, shops and companies are fictional; no logos are drawn.
// ============================================================
(function () {
  const L1 = [ // Line 1 Yonge–University, Vaughan → Finch (U-shape). Renamed stops as of Dec 7 2025.
    ['Vaughan Metropolitan Centre', '旺市都会中心'], ['Highway 407', '407 号公路', 0], ['Pioneer Village', '先锋村'], ['York University', '约克大学'],
    ['Finch West', '芬治西'], ['Downsview Park', '当士维公园'], ['Sheppard West', '雪柏西'], ['Wilson', '威尔逊', 0], ['Yorkdale', '约克谷', 0],
    ['Lawrence West', '劳伦斯西', 0], ['Glencairn', '格伦凯恩'], ['Cedarvale', '雪松谷'], ['St Clair West', '圣克莱尔西'], ['Dupont', '杜邦'],
    ['Spadina', '士巴丹拿'], ['St George', '圣乔治'], ['Museum', '博物馆'], ["Queen's Park", '女王公园'], ['St Patrick', '圣帕特里克'],
    ['Osgoode', '奥斯古德'], ['St Andrew', '圣安德鲁', 1, 'bay', 300], ['Union', '联合站', 1, 'waterfront', 380], ['King', '国王站', 1, 'bay', 900], ['Queen', '皇后站'],
    ['TMU', '都会大学'], ['College', '学院'], ['Wellesley', '威士利'], ['Bloor-Yonge', '布洛-央'], ['Rosedale', '玫瑰谷', 0], ['Summerhill', '夏山'],
    ['St Clair', '圣克莱尔'], ['Davisville', '戴维斯维尔', 0], ['Eglinton', '央街-爱林顿', 1, 'yongeeg', 520], ['Lawrence', '劳伦斯'], ['York Mills', '约克米尔斯'],
    ['Sheppard-Yonge', '雪柏-央'], ['North York Centre', '北约克中心'], ['Finch', '芬治'],
  ].map(([n, zh, u, area, x]) => ({ n, zh, under: u !== 0, area, x }));
  const L5 = ['Mount Dennis', 'Keelesdale', 'Caledonia', 'Fairbank', 'Oakwood', 'Cedarvale', 'Forest Hill', 'Chaplin', 'Avenue', 'Eglinton', 'Mount Pleasant', 'Leaside', 'Laird',
    'Sunnybrook Park', 'Don Valley', 'Aga Khan Park & Museum', 'Wynford', 'Sloane', "O'Connor", 'Pharmacy', 'Hakimi Lebovic', 'Golden Mile', 'Birchmount', 'Ionview', 'Kennedy']
    .map((n, i) => ({ n, under: i >= 1 && i <= 12, area: n === 'Eglinton' ? 'yongeeg' : undefined, x: n === 'Eglinton' ? 520 : undefined, zh: { 'Mount Dennis': '丹尼斯山', Eglinton: '央街-爱林顿', Kennedy: '肯尼迪', Cedarvale: '雪松谷', 'Science Centre': '' }[n] }));
  const GO = [['Union', 'waterfront', 1600], ['Bloor'], ['Mount Dennis'], ['Weston'], ['Etobicoke North'], ['Malton'], ['Bramalea'], ['Brampton Innovation District'], ['Mount Pleasant'], ['Georgetown'], ['Acton'], ['Guelph Central'], ['Kitchener', 'kitchener', 700, 'waterloo']]
    .map(([n, area, x, city]) => ({ n, area, x, city, under: false }));

  Cities.add({
    id: 'toronto', name: '多伦多', local: 'Toronto', drive: 'R', countdown: true,
    blurb: '安大略湖边的大城市：CN 塔、红色电车、地下 PATH、和刚开通的 5 号线。',
    palette: ['#8a4a3a', '#c8b8a0', '#5a6a7a', '#a86a4a', '#d8d0c0', '#3a4a5a'], styles: ['glass', 'brick', 'condo', 'victorian'], laneColor: '#f3c55e',
    shops: ['cafe', 'books', 'grocery', 'bakery', 'tea', 'flowers', 'conv', 'gift', 'bank'],
    shopNames: { cafe: ['Lakeside Café', 'Maple Bean', 'Queen West Roasters'], books: ['Spadina Books', 'Annex Paperbacks'], grocery: ['Front St Market', 'Corner Fresh'], bakery: ['Butter Tart Bakery', 'Leslieville Loaves'],
      tea: ['Bubble Bay', 'Pearl Tea House'], flowers: ['Rosedale Flowers'], conv: ['King Variety', '24h Variety'], gift: ['Six Gifts', 'Lake & Leaf'], bank: ['Maple Trust (fictional)'], bar: ['Cask & Kettle'] },
    signs: { welcome: 'Welcome to Toronto', exit: 'Exit', reception: 'Reception', towards: 'To', boarding: 'Boarding', shop: { cafe: 'Café', books: 'Books', grocery: 'Grocery', bakery: 'Bakery', tea: 'Bubble Tea', flowers: 'Florist', conv: 'Variety', gift: 'Gifts', bank: 'Bank', library: 'Library', bar: 'Pub' } },
    taxi: '#e8e8ee', tramColor: '#d8343a', tramColor2: '#2a2a30', tramLabel: '504', busColor: '#d8343a', busStripe: '#ffffff', streetSign: { bg: '#2a5aa8', fg: '#ffffff' },
    peek: '安大略湖和远处的多伦多群岛', ann: { next: 'The next station is', arr: 'Arriving at', end: 'This is the last stop' },
    items: { gift: [['枫糖浆小瓶', 4], ['CN 塔钥匙扣（原创）', 3], ['浣熊毛绒', 6]], bakery: [['黄油挞 butter tart', 2], ['肉桂卷', 2], ['枫叶饼干', 1]], tea: [['珍珠奶茶', 2], ['芋泥奶茶', 2]], cafe: [['燕麦拿铁', 2], ['热可可', 1], ['双双 double-double 风格咖啡', 1]] },

    views: {
      lake: { id: 'to-lake', horizon: .64, water: true, sunX: .82, skyline: { far: { hMax: 50, center: .55 }, mid: { hMax: 92, center: .58, spread: .2, kinds: ['glass', 'glass', 'condo'] }, near: false },
        landmarks: [{ k: 'cntower', x: .46, depth: .35 }, { k: 'dome', x: .34, depth: .4 }], near: false,
        movers: [{ k: 'boat', y: .8, dir: 1, speed: 8 }, { k: 'sail', y: .74, dir: -1, speed: 5 }, { k: 'go', y: .63, color: '#3c8a2e', stripe: '#ffffff', dir: -1, speed: 60, period: 26 }, { k: 'birds', y: .3 }] },
      downtown: { id: 'to-dt', horizon: .78, skyline: { far: { hMax: 70 }, mid: { hMax: 120, hMin: 40, spread: .3, kinds: ['glass', 'glass', 'glass', 'condo'] }, near: { kinds: ['glass', 'brick'] } },
        landmarks: [{ k: 'cntower', x: .18, depth: .25 }], movers: [{ k: 'tram', y: .95, color: '#d8343a', stripe: '#2a2a30', dir: 1, speed: 30, period: 30 }, { k: 'cars', side: 'R', n: 5, taxi: true }, { k: 'birds', y: .2 }] },
      distillery: { id: 'to-dist', horizon: .72, skyline: { far: { hMax: 80, center: .2, kinds: ['glass', 'condo'] }, mid: { hMax: 34, hMin: 18, kinds: ['brick', 'brick', 'old'] }, near: { kinds: ['brick', 'old'] } },
        landmarks: [{ k: 'cntower', x: .1, depth: .15 }], movers: [{ k: 'tram', y: .96, color: '#d8343a', stripe: '#2a2a30', dir: -1, speed: 22, period: 40 }, { k: 'birds', y: .25 }] },
      midtown: { id: 'to-mid', horizon: .74, skyline: { far: { hMax: 50 }, mid: { hMax: 96, hMin: 30, center: .5, kinds: ['condo', 'condo', 'glass'] }, near: { kinds: ['condo', 'brick'] } },
        movers: [{ k: 'cars', side: 'R', n: 6 }, { k: 'blink' }, { k: 'birds', y: .3 }] },
      island: { id: 'to-island', horizon: .6, water: true, skyline: { far: { hMax: 60, center: .5 }, mid: { hMax: 110, center: .5, spread: .18, kinds: ['glass', 'glass', 'condo'] }, near: false }, near: false,
        landmarks: [{ k: 'cntower', x: .42, depth: .3 }], movers: [{ k: 'boat', y: .78, dir: -1, speed: 10 }, { k: 'sail', y: .7, dir: 1, speed: 6 }, { k: 'geese', y: .35 }] },
    },

    hotels: [
      { id: 'harbour', name: '湖景塔楼酒店', area: 'waterfront', x: 760, room: 'condo', roomName: '湖景双人房', view: 'lake', bed: 'double', floor: 32, tip: '推荐',
        desc: '在湖边的玻璃塔楼里，窗外是 CN 塔、渡轮和进出联合站的 GO 列车。', lobby: { wall: '#d8d4cc', uniform: '#2a3a5a' }, hall: { wall: '#c8c4bc', carpet: '#3a4a6a', door: '#5a4a3a' }, rug: '#4a5a7a' },
      { id: 'loft', name: '酿酒厂红砖 Loft', area: 'distillery', x: 620, room: 'loft', roomName: '红砖阁楼', view: 'distillery', bed: 'double', floor: 3,
        desc: '老酿酒厂改造的红砖建筑，裸露木梁，楼下就是石板路和冬天的市集。', lobby: { wall: '#a8644a', uniform: '#3a2a20' }, hall: { wall: '#9a5a44', carpet: '#5a3a2a', door: '#3a2a1a' }, rug: '#8a4a3a' },
      { id: 'condo', name: '央街高层公寓', area: 'yongeeg', x: 900, room: 'modern', roomName: '高层一居室', view: 'midtown', bed: 'double', floor: 25,
        desc: 'Yonge & Eglinton 的高层公寓，楼下 1 号线和 5 号线换乘，窗外是一片公寓楼和灯光。', lobby: { wall: '#e0e0e4', uniform: '#4a4a5a' }, hall: { wall: '#d4d4dc', carpet: '#5a5a6a', door: '#8a8a96' } },
    ],

    areas: [
      { id: 'waterfront', name: '湖滨 · 联合站', view: 'lake', start: 760,
        street: { len: 9, seed: 5, tram: true, cross: [2, 6], names: ['York St', 'Bay St'], label: 'Queens Quay W', styles: ['glass', 'condo'], trees: true },
        spots: [
          { id: 'u1', k: 'station', x: 380, line: 'l1', stn: 'Union', name: 'Union 地铁站 · 1 号线' },
          { id: 'ugo', k: 'station', x: 1600, line: 'go', stn: 'Union', name: 'Union 站 · GO 火车' },
          { id: 'hh', k: 'hotel', x: 760, h: 'harbour', name: '湖景塔楼酒店', fw: 60, color: '#5a7a9a' },
          { id: 'q509', k: 'tram', x: 1050, line: '509', stn: 'Harbourfront Centre', name: '509 电车站 · Harbourfront Centre' },
          { id: 'ferry', k: 'act', x: 1250, act: 'island', icon: 'ticket', name: '坐渡轮去多伦多群岛' },
          { id: 'rink', k: 'act', x: 1420, act: 'skate', icon: 'snow', name: '湖边溜冰场' },
          { id: 'photo', k: 'act', x: 600, act: 'cnphoto', icon: 'star', name: '和 CN 塔合影' },
          { id: 'b1', k: 'cuddle', kind: 'bench', x: 1800, y: 230, name: '湖边长椅' },
          { id: 'toBay', k: 'go', x: 1950, area: 'bay', tx: 200, dir: 1, short: '金融区', name: '沿 Bay St 往北 → 金融区' },
          { id: 'sg', k: 'sign', x: 140, text: 'Harbourfront：湖边步道，夏天有音乐会，冬天有溜冰场。' },
        ] },
      { id: 'bay', name: '金融区 · Bay St', view: 'downtown', start: 300,
        street: { len: 8, seed: 9, tram: true, cross: [1, 5], names: ['King St W', 'Adelaide St W'], label: 'Bay St', styles: ['glass', 'glass', 'old'], trees: false, shops: ['cafe', 'bank', 'conv', 'books', 'cafe', 'gift'] },
        spots: [
          { id: 'sa', k: 'station', x: 300, line: 'l1', stn: 'St Andrew', name: 'St Andrew 站 · 1 号线' },
          { id: 'kg', k: 'station', x: 900, line: 'l1', stn: 'King', name: 'King 站 · 1 号线' },
          { id: 't504', k: 'tram', x: 1120, line: '504', stn: 'King (Yonge)', name: '504 King 电车 → Distillery' },
          { id: 'iv', k: 'act', x: 1450, act: 'interview', icon: 'book', name: 'Co-op 面试 · 枫叶资本大楼' },
          { id: 'path', k: 'act', x: 680, act: 'path', icon: 'cup', name: '进 PATH 地下城送咖啡' },
          { id: 'toWf', k: 'go', x: 60, area: 'waterfront', tx: 1900, dir: -1, short: '湖滨', name: '往南 → 湖滨' },
          { id: 'sgp', k: 'sign', x: 520, text: 'PATH：市中心约 30 公里的地下步行网络，冬天不用出门也能上班。' },
        ] },
      { id: 'distillery', name: '酿酒厂区', view: 'distillery', start: 620,
        street: { len: 6, seed: 13, tram: false, cars: false, cross: [3], names: ['Trinity St'], label: 'Gristmill Ln', styles: ['brick', 'victorian'], walk: '#8a7a6a', shops: ['cafe', 'gift', 'bakery', 'flowers', 'bar', 'books'], trees: false },
        spots: [
          { id: 'hl', k: 'hotel', x: 620, h: 'loft', name: '酿酒厂红砖 Loft', fw: 40, color: '#8a4a3a' },
          { id: 'loop', k: 'tram', x: 140, line: '504', stn: 'Distillery Loop', name: '504 电车 Distillery Loop' },
          { id: 'mk', k: 'act', x: 980, act: 'xmas', icon: 'star', name: '冬季市集' },
          { id: 'ph', k: 'act', x: 1250, act: 'brick', icon: 'flower', name: '红砖巷拍照' },
          { id: 'b2', k: 'cuddle', kind: 'bench', x: 1350, y: 230, name: '石板路长椅' },
          { id: 'sgd', k: 'sign', x: 420, text: '酿酒厂区：19 世纪的威士忌酒厂，现在是步行街区，没有汽车。' },
        ] },
      { id: 'yongeeg', name: 'Yonge & Eglinton', view: 'midtown', start: 520,
        street: { len: 7, seed: 21, tram: false, cross: [2, 5], names: ['Eglinton Ave', 'Roehampton Ave'], label: 'Yonge St', styles: ['condo', 'glass', 'brick'], shops: ['tea', 'cafe', 'grocery', 'bakery', 'conv', 'books', 'flowers'] },
        spots: [
          { id: 'eg', k: 'station', x: 520, line: 'l1', stn: 'Eglinton', name: 'Eglinton 站 · 1 号线' },
          { id: 'eg5', k: 'station', x: 640, line: 'l5', stn: 'Eglinton', name: 'Eglinton 站 · 5 号线' },
          { id: 'hc', k: 'hotel', x: 900, h: 'condo', name: '央街高层公寓', fw: 50, color: '#8a9aaa' },
          { id: 'lib', k: 'study', kind: 'library', x: 1300, name: 'Northern District 图书馆', fw: 40, color: '#6a5a4a' },
          { id: 'br', k: 'act', x: 1550, act: 'brunch', icon: 'cup', name: '周末 brunch 点单' },
          { id: 'rc', k: 'act', x: 1080, act: 'raccoon', icon: 'apple', name: '夜里护住零食（浣熊出没）' },
          { id: 'b3', k: 'cuddle', kind: 'bench', x: 200, y: 230, name: '公园长椅' },
        ] },
    ],

    lines: [
      { id: 'l1', name: '1 号线 Yonge–University', short: '1', color: '#f8c300', text: '#111', body: '#c8ccd4', car: 'subway', wall: '#d8c8a0', sign: '#14161e', floor: '#8a8a92', stations: L1 },
      { id: 'l5', name: '5 号线 Eglinton', short: '5', color: '#f58220', text: '#111', body: '#e8e8ec', car: 'lrt', wall: '#e4e0d8', sign: '#2a2a30', stations: L5 },
      { id: 'go', name: 'GO Kitchener 线', short: 'GO', color: '#3c8a2e', color2: '#2e6a2a', text: '#fff', body: '#e8e8e4', car: 'bilevel', view: 'lake', sign: '#1e3a22', ann: { next: 'The next station stop is', arr: 'Now arriving at', end: 'This train terminates here' }, stations: GO },
      { id: '504', name: '504 King 电车', short: '504', color: '#d8343a', body: '#e8e8ec', car: 'streetcar', view: 'downtown', ann: { next: 'Next stop', arr: 'Arriving at' },
        stations: [{ n: 'Dundas West' }, { n: 'Roncesvalles' }, { n: 'Dufferin' }, { n: 'Bathurst' }, { n: 'Spadina' }, { n: 'St Andrew', area: 'bay', x: 300 }, { n: 'King (Yonge)', area: 'bay', x: 1120 }, { n: 'Jarvis' }, { n: 'Parliament' }, { n: 'Distillery Loop', area: 'distillery', x: 140 }].map(s => Object.assign({ under: false }, s)) },
      { id: '509', name: '509 Harbourfront 电车', short: '509', color: '#d8343a', body: '#e8e8ec', car: 'streetcar', view: 'lake', ann: { next: 'Next stop', arr: 'Arriving at' },
        stations: [{ n: 'Union', under: true, area: 'waterfront', x: 380 }, { n: 'Queens Quay', under: true }, { n: 'Harbourfront Centre', area: 'waterfront', x: 1050 }, { n: 'Spadina Ave' }, { n: 'Bathurst St' }, { n: 'Exhibition Loop' }].map(s => Object.assign({ under: false }, s)) },
      { id: '510', name: '510 Spadina 电车', short: '510', color: '#d8343a', body: '#e8e8ec', car: 'streetcar', view: 'downtown',
        stations: [{ n: 'Union', under: true, area: 'waterfront', x: 380 }, { n: 'Queens Quay', under: true }, { n: 'Spadina / Queens Quay' }, { n: 'King St' }, { n: 'Queen St' }, { n: 'College St' }, { n: 'Spadina Station' }].map(s => Object.assign({ under: false }, s)) },
    ],

    routes: [
      { name: '联合站 → 央街-爱林顿', desc: '1 号线 Yonge 段一路往北到 Eglinton。', legs: [['l1', 'Union', 'Eglinton']] },
      { name: '金融区 → 酿酒厂区', desc: '504 King 电车往东，终点 Distillery Loop。', legs: [['504', 'King (Yonge)', 'Distillery Loop']] },
      { name: 'GO + 5 号线 → 央街', desc: 'GO Kitchener 线到 Mount Dennis，换乘 5 号线往东到 Eglinton。', legs: [['go', 'Union', 'Mount Dennis'], ['l5', 'Mount Dennis', 'Eglinton']] },
      { name: '坐 GO 去滑铁卢地区', desc: 'Union → Kitchener，GO Kitchener 线（约 2 小时）。', legs: [['go', 'Union', 'Kitchener']] },
      { name: '湖滨电车小游', desc: '509 Harbourfront 从 Union 地下站出发沿湖往西。', legs: [['509', 'Union', 'Exhibition Loop']] },
    ],

    acts: [
      { id: 'interview', name: 'Bay St co-op 面试', area: 'bay', kind: 'quiz', view: 'downtown', tod: 'day', coinK: .9, good: 10,
        intro: '一起去金融区面试 co-op（实习）岗位！每题两只猫各自选答案，都锁定后揭晓。答对越多，面试官越满意。', real: 'Bay Street 是加拿大金融业的代名词；公司名为虚构。',
        win: '面试官：Welcome aboard! 🎉 拿到 offer 啦', ok: '面试官：我们会再联系你～',
        cfg: { qtitle: '面试题', n: 6, qtime: 25, qs: [
          ['利率上升时，已发行债券的价格通常会？', ['上升', '下降', '不变', '变成零'], 1, '债券价格和收益率反向变动：新债利息更高，旧债就要降价。'],
          ['市盈率 P/E 是怎么算的？', ['股价 ÷ 每股收益', '收益 ÷ 资产', '股息 ÷ 股价', '负债 ÷ 权益'], 0, 'P/E = Price ÷ EPS。'],
          ['TSX 是哪里的证券交易所？', ['温哥华', '纽约', '多伦多', '伦敦'], 2, 'Toronto Stock Exchange，总部在多伦多金融区。'],
          ['三大财务报表不包括哪一个？', ['资产负债表', '利润表', '现金流量表', '员工通讯录'], 3, '三大报表：Balance sheet、Income statement、Cash flow statement。'],
          ['DCF 估值的核心思想是？', ['看公司 logo', '把未来现金流折现到今天', '只看去年利润', '比较员工人数'], 1, 'Discounted Cash Flow：钱的时间价值。'],
          ['分散投资主要是为了？', ['保证赚钱', '降低单一资产的风险', '提高手续费', '避税'], 1, 'Diversification 降低非系统性风险。'],
          ['加拿大的中央银行是？', ['Bank of Canada', 'TSX', 'OSC', 'CRA'], 0, '加拿大央行 Bank of Canada 设定政策利率。'],
          ['“Tell me about yourself” 最好怎么答？', ['背简历每一行', '一两分钟讲经历和为什么适合这个岗位', '讲猫的名字', '沉默'], 1, '简洁的故事 + 与岗位的联系。'],
          ['毛利 = ?', ['收入 − 销售成本', '收入 + 成本', '净利 × 2', '资产 − 负债'], 0, 'Gross profit = Revenue − COGS。'],
        ] } },
      { id: 'path', name: 'PATH 地下城送咖啡', area: 'bay', kind: 'collect', view: 'downtown', tod: 'day', time: 40, good: 14,
        intro: '冬天的早上，同事们都在 PATH 地下通道里赶路。两只猫一起收集咖啡杯送到办公室，小心别撞上赶时间的公文包！', real: 'PATH 是多伦多市中心约 30 公里的地下步行网络（吉尼斯纪录最大地下购物街区）。',
        cfg: { items: ['cup', 'cup', 'coin'], max: 6, hazards: 2, hazard: 'book', hazSpeed: 50, ground: '#b8b0a0' } },
      { id: 'island', name: '渡轮去多伦多群岛', area: 'waterfront', kind: 'paddle', view: 'island', tod: 'golden', time: 50, good: 12,
        intro: '从湖滨坐渡轮到中心岛，再一起划独木舟穿过岛间水道。两只猫轮流按 ↑ 划桨，节奏一致就越划越快！', real: 'Jack Layton 渡轮码头 → Toronto Island Park；岛上有独木舟出租（夏季）。',
        cfg: { goal: 700, vmax: 80, boatColor: '#d8643a' } },
      { id: 'skate', name: '湖边溜冰', area: 'waterfront', kind: 'collect', view: 'lake', tod: 'night', wea: 'snow', time: 45, good: 12,
        intro: '冬夜在湖边的溜冰场滑冰！冰上会滑，提前减速。收集雪花和星星，两只猫手拉手滑得更稳。', real: 'Harbourfront Centre 湖边的户外溜冰场（冬季开放，免费）。',
        cfg: { ice: true, items: ['snow', 'star'], max: 6 } },
      { id: 'cnphoto', name: '和 CN 塔合影', area: 'waterfront', kind: 'photo', view: 'lake', tod: 'golden', time: 40, good: 14,
        intro: '取景框会左右移动。两只猫走进框里、靠在一起，等 CN 塔也在框里时按 ↑ 拍照。拍 4 张！', real: 'CN Tower（553 m），1976 年建成，多伦多的天际线标志。',
        cfg: { target: .46, lmName: 'CN 塔', n: 4 } },
      { id: 'xmas', name: '酿酒厂冬季市集', area: 'distillery', kind: 'collect', view: 'distillery', tod: 'night', wea: 'snow', time: 40, good: 14,
        intro: '冬季市集的灯串亮起来了！接住掉下来的热可可、姜饼星星和小礼物。', real: 'Distillery District 每年冬季举办市集（以官方日期为准）。',
        cfg: { fall: true, items: ['cup', 'star', 'coin'], max: 6 } },
      { id: 'brick', name: '红砖巷拍照', area: 'distillery', kind: 'photo', view: 'distillery', tod: 'day', time: 40, good: 12,
        intro: '在石板路和红砖墙之间找最好的角度。两只猫一起进框按 ↑。', real: '酿酒厂区保存了 40 多栋维多利亚时代工业建筑。',
        cfg: { target: .6, lmName: '红砖巷', n: 4 } },
      { id: 'brunch', name: '周末 brunch', area: 'yongeeg', kind: 'order', view: 'midtown', tod: 'day', time: 40, good: 12,
        intro: '周日 brunch！照着清单一起点单：黄油挞、班尼迪克蛋、枫糖松饼……点错要多等 3 秒。', real: 'Yonge & Eglinton（“Young and Eligible”）一带满是早午餐店。',
        cfg: { listTitle: '点单清单', n: 6, pool: [['松饼', 'cup'], ['黄油挞', 'apple'], ['燕麦拿铁', 'cup'], ['水果碗', 'apple'], ['枫糖浆', 'syrup'], ['可颂', 'star'], ['热可可', 'cup'], ['薯饼', 'coin']] } },
      { id: 'raccoon', name: '浣熊出没！', area: 'yongeeg', kind: 'collect', view: 'midtown', tod: 'night', time: 40, good: 12,
        intro: '多伦多的浣熊会打开垃圾桶找吃的！趁它们没来，收集散落的零食。被浣熊碰到会晕一下。', real: '多伦多以聪明的城市浣熊闻名（市里专门设计过防浣熊垃圾桶）。',
        cfg: { items: ['apple', 'fish', 'star'], max: 6, hazards: 3, hazard: 'raccoon', hazSpeed: 45, ground: '#4a4a52' } },
    ],

    map: {
      land: '#d8dccc', water: [[0, 82, 100, 18]], parks: [[18, 84, 22, 6], [62, 36, 8, 10]],
      roads: [[[55, 0], [55, 80]], [[0, 30], [100, 30]], [[0, 72], [100, 72]]],
      lines: {
        l1: [[30, 2, 'VMC'], [32, 20], [35, 31, 'Cedarvale'], [40, 50], [45, 56, 'St George'], [45, 72, 'St Andrew'], [50, 78, 'Union'], [55, 72, 'King'], [55, 56], [55, 30, 'Eglinton'], [55, 4, 'Finch']],
        l5: [[10, 32, 'Mount Dennis'], [35, 31], [55, 30], [75, 30], [96, 34, 'Kennedy']],
        go: [[50, 79], [30, 70], [12, 33], [2, 18, '→ Kitchener']],
        '504': [[22, 72, 'Dundas West'], [55, 72], [68, 77, 'Distillery']],
        '509': [[50, 80], [40, 82], [24, 81, 'Exhibition']],
        '510': [[50, 80], [42, 81], [40, 72], [40, 56, 'Spadina']],
      },
      areas: { waterfront: [48, 84], bay: [51, 72], distillery: [68, 78], yongeeg: [57, 28] },
      labels: [[20, 92, 'Lake Ontario 安大略湖', '#3a6a9a'], [30, 89, 'Toronto Islands', '#3a6a5a']],
    },
  });
})();
