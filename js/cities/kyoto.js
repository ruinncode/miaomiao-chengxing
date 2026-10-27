// Kyoto — compact config. Left-hand traffic. Karasuma Line K01–K15 (Kokusaikaikan → Takeda);
// Tokaido Shinkansen (reverse order) links back to Tokyo. Shops, inns and teahouses are fictional.
Cities.quick({
  id: 'kyoto', name: '京都', local: '京都', drive: 'L',
  blurb: '石板小巷、八坂塔、锦市场和抹茶；从东京坐新干线 2 小时就到。',
  palette: ['#5a3a2a', '#8a6a4a', '#c8b08a', '#3a3a3a', '#a8643a'], styles: ['old', 'old', 'brick'], laneColor: '#f4f4f4',
  shops: ['tea', 'gift', 'bakery', 'ramen', 'flowers', 'books', 'conv'],
  shopNames: { tea: ['茶寮 しずく', '抹茶処 はんなり'], gift: ['京みやげ 梅や', '扇子 かぜ'], bakery: ['パン屋 ことり'], ramen: ['京らーめん 灯'], flowers: ['花屋 こもも'], books: ['古本 ふみ'], conv: ['まねきマート'] },
  signs: { welcome: 'おこしやす京都', exit: '出口', reception: '帳場', towards: '方面', boarding: '乗車口', shop: { cafe: '喫茶', books: '古本', bakery: 'パン', ramen: 'ラーメン', flowers: '花', conv: 'コンビニ', gift: 'みやげ', tea: '甘味処' } },
  taxi: '#3a2a5a', streetSign: { bg: '#3a2a1a', fg: '#f4e8d0' },
  items: { tea: [['抹茶套餐', 3], ['抹茶芭菲', 3], ['蕨饼', 2]], gift: [['八桥（生八ッ橋）', 2], ['猫咪扇子', 3]], bakery: [['抹茶面包', 1]] },
  views: {
    gion: { id: 'ky-gion', horizon: .72, mountains: 'hills', skyline: { far: { hMax: 18, hMin: 8, kinds: ['old'] }, mid: { hMax: 26, hMin: 10, kinds: ['old', 'old'] }, near: false }, near: false,
      landmarks: [{ k: 'pagoda', x: .55, depth: .5 }], movers: [{ k: 'birds', y: .3 }] },
    city: { id: 'ky-city', horizon: .76, mountains: 'hills', skyline: { far: { hMax: 30 }, mid: { hMax: 50, hMin: 16, kinds: ['condo', 'old', 'glass'] }, near: { kinds: ['old', 'condo'] } },
      landmarks: [{ k: 'spire', x: .7, depth: .4 }], movers: [{ k: 'shinkansen', y: .9, color: '#f4f4f0', stripe: '#1e4aa8', dir: 1, speed: 60, period: 26, len: 140 }, { k: 'cars', side: 'L', n: 4 }] },
    river: { id: 'ky-kamo', horizon: .64, water: true, mountains: 'hills', skyline: { far: { hMax: 20, kinds: ['old'] }, mid: { hMax: 26, hMin: 10, kinds: ['old', 'condo'] } }, near: false, movers: [{ k: 'birds', y: .35 }] },
  },
  hotels: [
    { id: 'ryokan', name: '祇园町家旅馆', area: 'gion', x: 1000, room: 'ryokan', roomName: '町家和室', view: 'gion', bed: 'futon', floor: 2, tip: '推荐',
      desc: '百年町家改成的小旅馆：木格子窗、榻榻米、地上的被褥；窗外是八坂塔。', lobby: { wall: '#c8b08a', uniform: '#3a2a4a' }, hall: { wall: '#b89a74', carpet: '#5a4a3a', door: '#e8dcc4' }, rug: '#7a8a4a' },
    { id: 'station', name: '京都站前酒店', area: 'kyotostn', x: 900, room: 'modern', roomName: '车站景观房', view: 'city', floor: 12, desc: '车站对面的商务酒店，窗外是京都塔和进站的新干线。' },
  ],
  areas: [
    { id: 'kyotostn', name: '京都站', view: 'city', start: 500, street: { len: 6, cross: [2], names: ['塩小路通'], label: '烏丸通', styles: ['glass', 'condo', 'old'], shops: ['conv', 'gift', 'bakery', 'ramen'] },
      sign: [1100, '京都站：新干线、JR、地铁乌丸线都在这里。'] },
    { id: 'shijo', name: '四条 · 锦市场', view: 'river', start: 300, bench: 1200, benchName: '鸭川边的长椅',
      street: { len: 6, cross: [3], names: ['錦小路通'], label: '四条通', styles: ['old', 'brick'], shops: ['tea', 'books', 'gift', 'flowers', 'bakery'] } },
    { id: 'gion', name: '祇园 · 东山', view: 'gion', start: 300, bench: 1320, benchName: '石板路长椅',
      street: { len: 7, cars: false, cross: [2], names: ['花見小路'], label: '八坂通', styles: ['machiya', 'machiya', 'machiya', 'old'], hMax: 64, road: '#8a8478', walk: '#8a8070', shops: ['tea', 'gift', 'tea', 'flowers', 'gift'], trees: true },
      sign: [1200, '祇园：请不要拍摄或打扰行猫和舞伎，安静地走过石板路。'] },
  ],
  lines: [
    { id: 'k', name: '京都市营地铁 乌丸线', short: 'K', color: '#2a9a5a', body: '#e8ece8', car: 'subway',
      st: ['Kokusaikaikan|国际会馆', 'Matsugasaki|松崎', 'Kitayama|北山', 'Kitaoji|北大路', 'Kuramaguchi|鞍马口', 'Imadegawa|今出川', 'Marutamachi|丸太町', 'Karasuma Oike|乌丸御池', 'Shijo|四条@shijo:300', 'Gojo|五条', 'Kyoto|京都@kyotostn:300', 'Kujo|九条', 'Jujo|十条', 'Kuinabashi|久势桥', 'Takeda|竹田'] },
    { id: 'tkd', name: '东海道新干线', short: '新干线', color: '#1e4aa8', body: '#f4f4f0', car: 'shinkansen', view: 'city', ann: { next: 'We will soon make a brief stop at', arr: 'We will soon arrive at', end: 'This train terminates here' },
      st: ['Shin-Osaka|新大阪', 'Kyoto|京都@kyotostn:1300', 'Maibara|米原', 'Gifu-Hashima|岐阜羽岛', 'Nagoya|名古屋', 'Mikawa-Anjo|三河安城', 'Toyohashi|丰桥', 'Hamamatsu|滨松', 'Kakegawa|挂川', 'Shizuoka|静冈', 'Shin-Fuji|新富士', 'Mishima|三岛', 'Atami|热海', 'Odawara|小田原', 'Shin-Yokohama|新横滨', 'Shinagawa|品川', 'Tokyo|东京@marunouchi:1000:tokyo'] },
  ],
  routes: [
    ['京都站 → 四条', '乌丸线往北一站。', [['k', 'Kyoto', 'Shijo']]],
    ['新干线回东京', '东海道新干线往东（约 2 小时 15 分）。', [['tkd', 'Kyoto', 'Tokyo']]],
    ['四条 → 国际会馆', '乌丸线坐到北边终点，路过御所和北山。', [['k', 'Shijo', 'Kokusaikaikan']]],
  ],
  acts: [
    { id: 'matcha', name: '茶屋点抹茶', area: 'gion', x: 600, icon: 'cup', kind: 'order', intro: '在町家茶屋里照单点：抹茶、和果子、蕨饼……点错要多等一会。', real: '宇治抹茶与京都和果子文化。',
      cfg: { listTitle: '茶屋菜单', n: 5, pool: [['抹茶', 'cup'], ['和果子', 'flower'], ['蕨饼', 'star'], ['团子', 'apple'], ['抹茶芭菲', 'cup'], ['煎茶', 'cup']] } },
    { id: 'yasaka', name: '八坂塔取景', area: 'gion', x: 1500, icon: 'flower', kind: 'photo', tod: 'golden', intro: '在石板坡上取景，让八坂塔进框，两只猫一起按 ↑。', real: '法观寺五重塔（八坂塔），东山的标志。', cfg: { target: .55, lmName: '八坂塔', n: 4 } },
    { id: 'momiji', name: '接红叶', area: 'gion', x: 900, icon: 'leaf', kind: 'collect', tod: 'golden', intro: '秋天的东山，红叶飘下来了！一起接住叶子。', real: '京都的红叶季一般在 11 月中下旬。', cfg: { fall: true, items: ['leaf', 'leaf', 'flower'], max: 6 } },
    { id: 'nishiki', name: '锦市场边走边吃', area: 'shijo', x: 900, icon: 'fish', kind: 'order', intro: '“京都的厨房”锦市场！照着清单买小吃。', real: '锦市场是约 400 年历史的食品商店街（约 390 米长）。',
      cfg: { listTitle: '小吃清单', n: 6, pool: [['玉子烧', 'star'], ['豆乳甜甜圈', 'coin'], ['渍物', 'leaf'], ['章鱼小丸子', 'fish'], ['抹茶冰', 'cup'], ['鱼糕', 'fish']] } },
  ],
  map: { land: '#e4dccc', water: [[60, 0, 4, 100]], parks: [[30, 20, 14, 10]], lines: { k: [[40, 2], [40, 98]], tkd: [[2, 82], [40, 80], [98, 76]] }, labels: [[62, 50, '鸭川', '#3a6a9a'], [68, 40, '祇园', '#5a3a2a']], areas: { gion: [70, 46] } },
});
