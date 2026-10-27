// ============================================================
//  Waterloo Region (Waterloo · Kitchener · St. Jacobs) — flagship
//  detail. ION 301 station order N→S per Region of Waterloo / GRT;
//  GO Kitchener line links back to Toronto Union.
//  Hotels / shops are fictional. See docs/TRAVEL_NOTES.md.
// ============================================================
(function () {
  const ION = [['Conestoga', '康斯托加', 'conestoga', 300], ['Northfield', '北原'], ['Research and Technology', '研究科技园'], ['University of Waterloo', '滑铁卢大学', 'uw', 360],
    ['Laurier–Waterloo Park', '劳里埃-滑铁卢公园', 'park', 260], ['Waterloo Public Square', '滑铁卢公共广场', 'uptown', 560], ['Allen', '艾伦'], ['Grand River Hospital', '大河医院'],
    ['Central Station', '中央站', 'kitchener', 300], ['Kitchener City Hall', '基秦拿市政厅', 'kitchener', 900], ['Frederick', '弗雷德里克'], ['Kitchener Market', '基秦拿市场'],
    ['Borden', '博登'], ['Mill', '米尔'], ['Block Line', '布洛克线'], ['Fairway', '费尔韦']].map(([n, zh, area, x]) => ({ n, zh, area, x, under: false }));
  const GO = [['Union', 'union', 850, 'toronto'], ['Bloor'], ['Mount Dennis'], ['Weston'], ['Etobicoke North'], ['Malton'], ['Bramalea'], ['Brampton Innovation District'], ['Mount Pleasant'], ['Georgetown'], ['Acton'], ['Guelph Central'], ['Kitchener', 'kitchener', 700]]
    .map(([n, area, x, city]) => ({ n, area, x, city, under: false }));

  Cities.add({
    id: 'waterloo', name: '滑铁卢', local: 'Waterloo · Kitchener', drive: 'R', countdown: true,
    blurb: '大学城 + 科技城：滑铁卢大学的加拿大鹅、ION 轻轨、Uptown 小街、St. Jacobs 农夫市集。',
    palette: ['#9a5a40', '#c8b090', '#6a7a6a', '#b07a50', '#d8ccb0', '#4a5a4a'], styles: ['brick', 'old', 'condo', 'glass'], laneColor: '#f3c55e',
    shops: ['cafe', 'books', 'tea', 'bakery', 'grocery', 'game', 'conv', 'gift'],
    shopNames: { cafe: ['Uptown Grind', 'Laurel Café', 'King St Coffee'], books: ['Campus Books', 'Uptown Used Books'], tea: ['Plaza Bubble Tea', 'Ring Road Tea'], bakery: ['Mennonite Bake Shop', 'Apple Fritter Co.'],
      grocery: ['Region Fresh'], game: ['Board Game Café'], conv: ['Columbia Variety'], gift: ['Goose & Gear'] },
    signs: { welcome: 'Welcome to Waterloo Region', exit: 'Exit', reception: 'Front Desk', towards: 'To', boarding: 'Boarding', shop: { cafe: 'Café', books: 'Books', tea: 'Bubble Tea', bakery: 'Bakery', grocery: 'Grocery', game: 'Board Games', conv: 'Variety', gift: 'Gifts', library: 'Library' } },
    taxi: '#e8e8ee', tramColor: '#f4f4f4', tramColor2: '#1e5aa8', tramLabel: 'ION', busColor: '#1e5aa8', busStripe: '#ffffff', streetSign: { bg: '#1f6a3a', fg: '#ffffff' },
    peek: '校园的树林和远处的科技园', ann: { next: 'Next stop:', arr: 'Arriving at', end: 'This is the last stop' },
    items: { gift: [['加拿大鹅毛绒（原创）', 5], ['枫糖浆', 4], ['手工被子小方巾', 6]], bakery: [['苹果油炸圈 apple fritter', 2], ['舒弗利派 shoofly pie', 3], ['枫糖曲奇', 1]], game: [['桌游一小时', 3], ['卡牌补充包', 2]] },

    views: {
      campus: { id: 'wl-campus', horizon: .72, ground: '#5a7a4a', mountains: 'hills', skyline: { far: { hMax: 26, n: 7, gap: 30 }, mid: { hMax: 40, hMin: 14, n: 6, gap: 40, kinds: ['glass', 'brick', 'condo'] }, near: { n: 4, gap: 60, kinds: ['brick', 'condo'] } },
        landmarks: [{ k: 'dc', x: .55, depth: .4 }], movers: [{ k: 'tram', y: .9, color: '#f4f4f4', stripe: '#1e5aa8', dir: 1, speed: 28, period: 34 }, { k: 'geese', y: .28 }, { k: 'birds', y: .4 }] },
      uptown: { id: 'wl-up', horizon: .76, skyline: { far: { hMax: 60, center: .7, kinds: ['condo', 'glass'] }, mid: { hMax: 30, hMin: 14, kinds: ['brick', 'old', 'brick'] }, near: { kinds: ['brick', 'old'] } },
        movers: [{ k: 'tram', y: .95, color: '#f4f4f4', stripe: '#1e5aa8', dir: -1, speed: 24, period: 30 }, { k: 'cars', side: 'R', n: 3 }, { k: 'birds', y: .3 }] },
      park: { id: 'wl-park', horizon: .66, water: true, skyline: { far: { hMax: 40, center: .7 }, mid: { hMax: 24, hMin: 10, kinds: ['brick', 'old'] } }, near: false,
        movers: [{ k: 'geese', y: .3 }, { k: 'tram', y: .62, color: '#f4f4f4', stripe: '#1e5aa8', dir: 1, speed: 26, period: 40 }, { k: 'birds', y: .45 }] },
      farm: { id: 'wl-farm', horizon: .7, ground: '#7a9a4a', mountains: 'hills', plane: false, near: false, skyline: { far: { hMax: 14, hMin: 6, n: 6, kinds: ['old', 'brick'] }, mid: { hMax: 20, hMin: 8, n: 5, gap: 60, kinds: ['old', 'brick'] } },
        movers: [{ k: 'train', y: .7, color: '#8a2a2a', stripe: '#f3c55e', dir: 1, speed: 14, period: 50, len: 3 }, { k: 'geese', y: .25 }] },
      mall: { id: 'wl-mall', horizon: .74, skyline: { far: { hMax: 30 }, mid: { hMax: 26, hMin: 14, kinds: ['glass', 'condo'] } },
        movers: [{ k: 'cars', side: 'R', n: 6 }, { k: 'tram', y: .95, color: '#f4f4f4', stripe: '#1e5aa8', dir: 1, speed: 24, period: 36 }] },
      kitchener: { id: 'wl-kit', horizon: .74, water: false, skyline: { far: { hMax: 70, center: .5, kinds: ['condo', 'glass'] }, mid: { hMax: 40, hMin: 16, kinds: ['brick', 'old', 'condo'] }, near: { kinds: ['brick', 'old'] } },
        landmarks: [{ k: 'clocktower', x: .7, depth: .4 }], movers: [{ k: 'tram', y: .95, color: '#f4f4f4', stripe: '#1e5aa8', dir: 1, speed: 24, period: 30 }, { k: 'go', y: .72, color: '#3c8a2e', stripe: '#fff', dir: -1, speed: 40, period: 60 }] },
      lake: { id: 'wl-vp', horizon: .6, water: true, near: false, skyline: { far: { hMax: 60, center: .6, kinds: ['condo', 'glass'] }, mid: { hMax: 30, hMin: 10, kinds: ['brick', 'old'] } },
        landmarks: [{ k: 'clocktower', x: .3, depth: .3 }], movers: [{ k: 'geese', y: .3 }, { k: 'boat', y: .8, dir: 1, speed: 4 }] },
    },

    hotels: [
      { id: 'campus', name: '校园旁高层公寓', area: 'uw', x: 1100, room: 'condo', roomName: '学生公寓风一居室', view: 'campus', bed: 'double', floor: 18, tip: '推荐',
        desc: '在大学附近的高层公寓里，窗外是校园树林、Davis Centre 和 ION 列车，偶尔飞过一队加拿大鹅。', lobby: { wall: '#e0dcd4', uniform: '#3a5a3a' }, hall: { wall: '#d0ccc4', carpet: '#3a5a4a', door: '#7a6a5a' } },
      { id: 'inn', name: 'Uptown 红砖小旅馆', area: 'uptown', x: 860, room: 'cozy', roomName: '红砖小屋', view: 'uptown', bed: 'double', floor: 3,
        desc: 'Uptown Waterloo 的老红砖楼，楼下就是 King St 和 ION，走路到公共广场。', lobby: { wall: '#b07050', uniform: '#4a2a20' }, hall: { wall: '#a86a4a', carpet: '#6a3a2a', door: '#3a2a1a' }, rug: '#8a4a3a' },
      { id: 'farm', name: 'St. Jacobs 乡间民宿', area: 'stjacobs', x: 1000, room: 'cozy', roomName: '农舍阁楼', view: 'farm', bed: 'futon', floor: 2,
        desc: '乡间的木屋民宿：被子是手工拼布的，早上能听到远处的马车铃声。', lobby: { wall: '#c8a878', uniform: '#5a4a2a' }, hall: { wall: '#b89868', carpet: '#7a5a3a', door: '#5a3a1a' }, rug: '#a86a3a' },
    ],

    areas: [
      { id: 'uw', name: '滑铁卢大学', view: 'campus', start: 360,
        street: { len: 8, seed: 31, tram: false, cross: [2, 6], names: ['Phillip St', 'Lester St'], label: 'University Ave W', styles: ['condo', 'brick', 'glass'], shops: ['tea', 'cafe', 'books', 'conv', 'game', 'cafe'] },
        spots: [
          { id: 'ion', k: 'station', x: 360, line: 'ion', stn: 'University of Waterloo', name: 'ION · University of Waterloo' },
          { id: 'geese', k: 'act', x: 700, act: 'geese', icon: 'goose', name: '躲开加拿大鹅（期末周）' },
          { id: 'dp', k: 'study', kind: 'library', x: 920, name: 'Dana Porter 图书馆', fw: 50, color: '#8a7a6a' },
          { id: 'hc', k: 'hotel', x: 1100, h: 'campus', name: '校园旁高层公寓', fw: 50, color: '#8a9a9a' },
          { id: 'ex', k: 'act', x: 1650, act: 'exam', icon: 'book', name: '数学竞赛小测' },
          { id: 'coop', k: 'act', x: 1300, act: 'resume', icon: 'ticket', name: 'Co-op 选岗（排排面试）' },
          { id: 'b1', k: 'cuddle', kind: 'bench', x: 200, y: 230, name: '草地长椅' },
          { id: 'sg', k: 'sign', x: 1450, text: 'Co-op 合作教育：滑铁卢大学的学生每 4 个月在学习和实习之间轮换。' },
          { id: 'toPark', k: 'go', x: 1870, area: 'park', tx: 120, dir: 1, short: '滑铁卢公园', name: '往东南走 → 滑铁卢公园' },
        ] },
      { id: 'park', name: '滑铁卢公园', view: 'park', start: 260,
        street: { len: 6, seed: 37, tram: false, cars: false, cross: [3], names: ['Seagram Dr'], label: 'Waterloo Park', styles: ['old', 'brick'], shops: ['cafe', 'gift'], trees: true },
        spots: [
          { id: 'toUw', k: 'go', x: 60, area: 'uw', tx: 1800, dir: -1, short: '大学', name: '← 回滑铁卢大学' },
          { id: 'ion', k: 'station', x: 260, line: 'ion', stn: 'Laurier–Waterloo Park', name: 'ION · Laurier–Waterloo Park' },
          { id: 'farm', k: 'act', x: 640, act: 'feed', icon: 'apple', name: '小动物农场喂食' },
          { id: 'lake', k: 'act', x: 1000, act: 'silver', icon: 'star', name: 'Silver Lake 拍照' },
          { id: 'b2', k: 'cuddle', kind: 'bench', x: 1200, y: 230, name: '湖边长椅' },
          { id: 'toUp', k: 'go', x: 1400, area: 'uptown', tx: 120, dir: 1, short: 'Uptown', name: '往南 → Uptown Waterloo' },
        ] },
      { id: 'uptown', name: 'Uptown Waterloo', view: 'uptown', start: 560,
        street: { len: 7, seed: 41, tram: true, cross: [2, 5], names: ['Erb St', 'Willis Way'], label: 'King St S', styles: ['brick', 'old', 'victorian'], hMax: 124, shops: ['cafe', 'bakery', 'books', 'tea', 'gift', 'game', 'grocery'] },
        spots: [
          { id: 'toPark', k: 'go', x: 60, area: 'park', tx: 1300, dir: -1, short: '公园', name: '← 滑铁卢公园' },
          { id: 'ion', k: 'station', x: 560, line: 'ion', stn: 'Waterloo Public Square', name: 'ION · Waterloo Public Square' },
          { id: 'hi', k: 'hotel', x: 860, h: 'inn', name: 'Uptown 红砖小旅馆', fw: 40, color: '#9a5a40' },
          { id: 'sq', k: 'act', x: 1000, act: 'square', icon: 'snow', name: '公共广场溜冰' },
          { id: 'wpl', k: 'study', kind: 'library', x: 1350, name: '滑铁卢公共图书馆', fw: 40, color: '#6a6a5a' },
          { id: 'b3', k: 'cuddle', kind: 'bench', x: 1550, y: 230, name: '广场长椅' },
        ] },
      { id: 'kitchener', name: 'Kitchener 市中心 · 维多利亚公园', view: 'kitchener', start: 700,
        street: { len: 8, seed: 47, tram: true, cross: [2, 5], names: ['Victoria St', 'Young St'], label: 'King St W', styles: ['brick', 'old', 'condo', 'glass'], shops: ['cafe', 'books', 'bakery', 'tea', 'conv', 'gift'] },
        spots: [
          { id: 'cs', k: 'station', x: 300, line: 'ion', stn: 'Central Station', name: 'ION · Central Station' },
          { id: 'go', k: 'station', x: 700, line: 'go', stn: 'Kitchener', name: 'Kitchener GO 站 → Toronto' },
          { id: 'ch', k: 'station', x: 900, line: 'ion', stn: 'Kitchener City Hall', name: 'ION · Kitchener City Hall' },
          { id: 'vp', k: 'act', x: 1250, act: 'victoria', icon: 'goose', name: '维多利亚公园划船' },
          { id: 'b4', k: 'cuddle', kind: 'bench', x: 1500, y: 230, name: '公园长椅' },
          { id: 'sg', k: 'sign', x: 1700, text: '维多利亚公园（1896）：Kitchener 最老的公园，湖心有小岛和亭子。' },
        ] },
      { id: 'conestoga', name: 'Conestoga 商场', view: 'mall', start: 300,
        street: { len: 6, seed: 53, tram: false, cross: [3], names: ['Northfield Dr'], label: 'King St N', styles: ['glass', 'condo'], shops: ['cafe', 'tea', 'game', 'gift', 'books', 'grocery'], trees: false },
        spots: [
          { id: 'ion', k: 'station', x: 300, line: 'ion', stn: 'Conestoga', name: 'ION · Conestoga（终点）' },
          { id: 'wcr', k: 'station', x: 1000, line: 'wcr', stn: 'Northfield Drive', name: '滑铁卢中央铁路（观光火车）' },
          { id: 'mall', k: 'act', x: 650, act: 'mall', icon: 'ticket', name: '商场集章寻宝' },
          { id: 'b5', k: 'cuddle', kind: 'bench', x: 1300, y: 230, name: '商场长椅' },
        ] },
      { id: 'stjacobs', name: 'St. Jacobs 农夫市集', view: 'farm', start: 400,
        street: { len: 6, seed: 59, tram: false, cross: [3], names: ['Farmers Market Rd'], label: 'Weber St N', styles: ['old', 'brick', 'victorian'], hMax: 88, walk: '#9a8a6a', shops: ['bakery', 'grocery', 'gift', 'cafe', 'bakery'], trees: true },
        spots: [
          { id: 'wcr', k: 'station', x: 400, line: 'wcr', stn: "St. Jacobs Farmers' Market", name: '滑铁卢中央铁路 · 市集站' },
          { id: 'mk', k: 'act', x: 700, act: 'market', icon: 'apple', name: '农夫市集采购' },
          { id: 'hf', k: 'hotel', x: 1000, h: 'farm', name: 'St. Jacobs 乡间民宿', fw: 40, color: '#a87a4a' },
          { id: 'ph', k: 'act', x: 1250, act: 'country', icon: 'flower', name: '乡间风景拍照' },
          { id: 'b6', k: 'cuddle', kind: 'bench', x: 160, y: 230, name: '木头长椅' },
          { id: 'sg', k: 'sign', x: 1400, text: 'St. Jacobs 一带有门诺派社区：路上可能会看到马车，请减速、礼让、不要随意拍别的猫。' },
        ] },
    ],

    lines: [
      { id: 'ion', name: 'ION 301 轻轨', short: 'ION', color: '#1e5aa8', text: '#fff', body: '#f4f4f4', car: 'lrt', sign: '#1e3a6a', floor: '#a8a8b0', stations: ION },
      { id: 'go', name: 'GO Kitchener 线', short: 'GO', color: '#3c8a2e', color2: '#2e6a2a', text: '#fff', body: '#e8e8e4', car: 'bilevel', view: 'farm', sign: '#1e3a22', ann: { next: 'The next station stop is', arr: 'Now arriving at', end: 'This train terminates here' }, stations: GO },
      { id: 'wcr', name: '滑铁卢中央铁路（观光）', short: 'WCR', color: '#8a2a2a', color2: '#5a1a1a', text: '#fff', body: '#7a2a24', car: 'heritage', view: 'farm', sign: '#3a1a14', ann: { next: 'Next stop', arr: 'Arriving at', end: 'End of the line — all aboard for the return trip' },
        stations: [{ n: 'Northfield Drive', zh: '北原路', area: 'conestoga', x: 1000 }, { n: "St. Jacobs Farmers' Market", zh: '农夫市集', area: 'stjacobs', x: 400 }, { n: 'St. Jacobs Village', zh: '圣雅各布村' }, { n: 'Elmira', zh: '埃尔迈拉' }].map(s => Object.assign({ under: false }, s)) },
    ],

    routes: [
      { name: '大学 → Uptown', desc: 'ION 往南两站：UW → Waterloo Public Square。', legs: [['ion', 'University of Waterloo', 'Waterloo Public Square']] },
      { name: 'Uptown → Kitchener 市中心', desc: 'ION 往南到 Kitchener City Hall，旁边就是维多利亚公园。', legs: [['ion', 'Waterloo Public Square', 'Kitchener City Hall']] },
      { name: '去 St. Jacobs 市集', desc: 'ION 北上到 Conestoga 一带，换观光火车到农夫市集（季节性运营）。', legs: [['ion', 'University of Waterloo', 'Conestoga'], ['wcr', 'Northfield Drive', "St. Jacobs Farmers' Market"]] },
      { name: '坐 GO 回多伦多', desc: 'Kitchener → Union，GO Kitchener 线。', legs: [['go', 'Kitchener', 'Union']] },
    ],

    acts: [
      { id: 'geese', name: '躲开加拿大鹅', area: 'uw', kind: 'collect', view: 'campus', tod: 'day', time: 45, good: 14,
        intro: '期末周！在校园里收集掉落的笔记和课本，千万别惹在草地上巡逻的加拿大鹅——被追上会晕一下还丢一分。', real: '滑铁卢大学以校园里非常凶的加拿大鹅出名（春天筑巢季尤其注意绕行）。',
        cfg: { items: ['book', 'book', 'star', 'leaf'], max: 6, hazards: 3, hazard: 'goose', hazSpeed: 50 } },
      { id: 'exam', name: '数学竞赛小测', area: 'uw', kind: 'quiz', view: 'campus', tod: 'day', good: 9,
        intro: '在 MC 大楼里做一套小测！每题两只猫各选一个答案，一起锁定后揭晓。', real: '滑铁卢大学数学学院每年组织面向中学生的数学竞赛（CEMC）。',
        cfg: { qtitle: '小测', n: 6, qtime: 25, qs: [
          ['2¹⁰ = ?', ['512', '1000', '1024', '2048'], 2, '2¹⁰ = 1024。'],
          ['二进制 1011 等于十进制的？', ['9', '11', '13', '1011'], 1, '8 + 2 + 1 = 11。'],
          ['84 和 36 的最大公约数？', ['6', '12', '18', '4'], 1, '84 = 12×7，36 = 12×3。'],
          ['30 只猫两两握手一次，一共握几次？', ['30', '435', '900', '870'], 1, 'C(30,2) = 30×29/2 = 435。'],
          ['斐波那契 1,1,2,3,5… 第 10 项？', ['34', '55', '89', '44'], 1, '1,1,2,3,5,8,13,21,34,55。'],
          ['√2 是有理数吗？', ['是', '不是', '有时是', '看心情'], 1, '经典反证法：√2 是无理数。'],
          ['1 + 2 + … + 100 = ?', ['5000', '5050', '10100', '4950'], 1, '高斯：100×101/2 = 5050。'],
          ['掷两个骰子，点数和为 7 的概率？', ['1/6', '1/12', '7/36', '1/36'], 0, '6 种组合 / 36 = 1/6。'],
        ] } },
      { id: 'resume', name: 'Co-op 选岗', area: 'uw', kind: 'order', view: 'campus', tod: 'day', time: 40, good: 12,
        intro: '找实习季！照清单把材料准备齐：简历、求职信、成绩单、作品集……拿错要多等 3 秒。', real: 'UW 学生通过学校的 co-op 系统申请岗位、参加面试和排名匹配。',
        cfg: { listTitle: '申请材料', n: 6, pool: [['简历', 'book'], ['求职信', 'ticket'], ['成绩单', 'book'], ['作品集', 'star'], ['西装', 'coin'], ['咖啡', 'cup'], ['推荐信', 'ticket'], ['笔记本电脑', 'coin']] } },
      { id: 'feed', name: '小动物农场喂食', area: 'park', kind: 'collect', view: 'park', tod: 'day', time: 40, good: 14,
        intro: '公园里的小农场！接住树上掉下来的苹果和叶子，一会儿拿给小羊驼。', real: 'Waterloo Park 有免费的 Animal Farm（羊驼、小鹿等）。喂食请按园方规定。',
        cfg: { fall: true, items: ['apple', 'leaf', 'apple'], max: 6 } },
      { id: 'silver', name: 'Silver Lake 拍照', area: 'park', kind: 'photo', view: 'park', tod: 'golden', time: 40, good: 12,
        intro: '傍晚的湖边：两只猫一起进取景框，按 ↑ 拍照。', real: 'Silver Lake 位于滑铁卢公园内，紧邻 Laurier–Waterloo Park ION 站。',
        cfg: { target: .5, lmName: '湖景', n: 4 } },
      { id: 'square', name: '公共广场溜冰', area: 'uptown', kind: 'collect', view: 'uptown', tod: 'night', wea: 'snow', time: 45, good: 12,
        intro: '冬天的 Waterloo Public Square 会变成溜冰场。冰面很滑，一起收集雪花！', real: 'Waterloo Public Square 冬季有户外溜冰场（以市政公告为准）。',
        cfg: { ice: true, items: ['snow', 'star'], max: 6 } },
      { id: 'victoria', name: '维多利亚公园划船', area: 'kitchener', kind: 'paddle', view: 'lake', tod: 'golden', time: 50, good: 12,
        intro: '在 Victoria Park 的湖上划船绕小岛一圈！两只猫轮流按 ↑ 划桨，节奏对了就越来越快。', real: 'Victoria Park, Kitchener（1896 年开园）。划船出租为季节性服务。',
        cfg: { goal: 600, vmax: 70, boatColor: '#f4f0e8' } },
      { id: 'mall', name: '商场集章寻宝', area: 'conestoga', kind: 'collect', view: 'mall', tod: 'day', time: 40, good: 14,
        intro: '下雪天就去商场逛！收集各个店铺的印章和小优惠券，小心别撞到推车。', real: 'Conestoga 商场是 ION 301 的北端终点站。',
        cfg: { items: ['ticket', 'coin', 'star'], max: 6, hazards: 2, hazard: 'cone', hazSpeed: 40, ground: '#c8c0b0' } },
      { id: 'market', name: 'St. Jacobs 农夫市集', area: 'stjacobs', kind: 'order', view: 'farm', tod: 'day', time: 40, good: 12,
        intro: '周末早市！照清单采购：苹果油炸圈、枫糖浆、蜂蜜、奶酪粒、苹果派……买错要多等 3 秒。', real: "St. Jacobs Farmers' Market（周四/周六开市，夏季另有周二）；以官方营业时间为准。",
        cfg: { listTitle: '市集清单', n: 6, pool: [['苹果油炸圈', 'apple'], ['枫糖浆', 'syrup'], ['蜂蜜', 'syrup'], ['奶酪粒', 'coin'], ['苹果派', 'pie'], ['鲜花', 'flower'], ['玉米', 'star'], ['苹果酒', 'cup']] } },
      { id: 'country', name: '乡间风景拍照', area: 'stjacobs', kind: 'photo', view: 'farm', tod: 'golden', time: 40, good: 12,
        intro: '金色的农田和远处的观光小火车。两只猫一起进框，按 ↑ 拍照（拍风景，别拍路猫哦）。', real: 'Waterloo Central Railway：往返于 Waterloo 与 St. Jacobs / Elmira 的志愿者观光铁路。',
        cfg: { target: .4, lmName: '小火车', n: 4 } },
    ],

    map: {
      land: '#d8dcc8', water: [[56, 46, 6, 4], [62, 80, 6, 4]], parks: [[50, 40, 12, 12], [58, 76, 12, 10]],
      roads: [[[40, 0], [55, 50], [70, 100]], [[0, 30], [100, 34]], [[0, 74], [100, 70]]],
      lines: {
        ion: [[44, 14, 'Conestoga'], [46, 22], [44, 30], [44, 38, 'UW'], [52, 46, 'Park'], [55, 54, 'Uptown'], [60, 66], [64, 74], [66, 78, 'City Hall'], [72, 90], [80, 98, 'Fairway']],
        go: [[64, 74, 'Kitchener GO'], [80, 72], [100, 70, '→ Toronto']],
        wcr: [[46, 20], [42, 10], [40, 2, 'St. Jacobs ↑']],
      },
      // area buttons sit beside the line (not on station names) so labels don't overlap
      areas: { stjacobs: [24, 7], conestoga: [24, 17], uw: [26, 36], park: [70, 45], uptown: [36, 58], kitchener: [84, 88] },
      labels: [[6, 90, 'Waterloo Region 滑铁卢地区', '#3a5a3a'], [74, 60, 'Kitchener', '#5a4a3a'], [10, 46, 'Waterloo', '#5a4a3a']],
    },
  });
})();
