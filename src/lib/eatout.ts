// 吃外面：阿寶下班先吃、草莓運動完去買。只列「吃什麼」，不寫店名；附近哪家有開，用地圖搜尋看「營業中」。
import { rng } from './meal'

export type When = 'dinner' | 'late'
export interface OutFood {
  name: string
  /** dinner：晚上 8 點下班吃；late：半夜運動完買得到 */
  when: When[]
  /** 草莓減重時可以吃 */
  light: boolean
  /** 怎麼點比較好（減重的點法） */
  tip: string
  /** 地圖搜尋用的字 */
  q: string
  /** 我們自己加的店 */
  mine?: boolean
}

/** 住的地方：地圖搜尋時加在前面 */
export const AREA = '鳳山五甲'

const D: When[] = ['dinner']
const L: When[] = ['late']
const B: When[] = ['dinner', 'late']
const f = (name: string, when: When[], light: boolean, tip: string, q = name): OutFood => ({ name, when, light, tip, q })

export const OUT_FOODS: OutFood[] = [
  f('自助餐', D, true, '三樣青菜加一樣蒸或滷的肉，飯半碗，不要淋肉燥'),
  f('清燉牛肉麵', B, true, '點清燉不要紅燒，加一盤燙青菜，湯喝一半就好', '牛肉麵'),
  f('水餃加燙青菜', B, true, '水餃 8 到 10 顆，配酸辣湯或蛋花湯，沾醬少一點', '水餃'),
  f('海南雞飯', D, true, '雞肉去皮，油飯換白飯，醬汁另外放', '海南雞飯'),
  f('越南河粉', D, true, '點雞肉或牛肉河粉，湯頭清，加豆芽和九層塔', '越南河粉'),
  f('小火鍋', B, true, '湯底選昆布或蔬菜，火鍋料少拿，沾醬用醬油加蔥蒜', '小火鍋'),
  f('虱目魚湯配飯', D, true, '虱目魚湯或魚肚，飯半碗，肉燥飯換白飯', '虱目魚'),
  f('壽司', D, true, '選生魚片和蒸蛋，少拿炸物和美乃滋口味'),
  f('涼麵配味噌湯', D, false, '麻醬一半就好，加一顆蛋', '涼麵'),
  f('滷肉飯加燙青菜', D, false, '小碗滷肉飯，燙青菜不要淋肉燥，配一碗清湯', '滷肉飯'),
  f('鍋燒意麵', D, false, '可以換成鍋燒烏龍麵，比較不油', '鍋燒意麵'),
  f('炒飯炒麵', D, false, '一份兩個人分，加點一盤燙青菜', '炒飯'),
  f('拉麵', D, false, '湯不要喝完，加點溏心蛋'),
  f('咖哩飯', D, false, '飯少一點，選雞肉', '咖哩飯'),
  f('排骨便當', D, false, '可以換雞腿便當或烤肉便當，比較不油', '便當'),
  f('義大利麵', D, false, '選清炒或番茄紅醬，不要白醬', '義大利麵'),
  f('烤魚定食', D, true, '鹽烤鯖魚或秋刀魚定食，白飯半碗，味噌湯可以喝', '定食'),
  f('嫩豆腐鍋', D, true, '韓式豆腐鍋選海鮮或蔬菜，不辣，飯半碗', '豆腐鍋'),
  f('健康餐盒', D, true, '舒肥雞胸或鮭魚配糙米和三樣菜', '健康餐盒'),
  f('素食自助餐', D, true, '青菜多拿，少拿炸的和勾芡的，飯半碗', '素食自助餐'),
  f('鵝肉配燙青菜', D, true, '鵝肉不要皮，配燙青菜和下水湯，飯換白飯', '鵝肉'),
  f('客家湯粄條', D, true, '點湯的不要乾的，加一盤燙青菜', '粄條'),
  f('潤餅', D, true, '請老闆花生粉和糖粉少一點', '潤餅'),
  f('生菜沙拉店', D, true, '選雞胸或鮭魚，醬汁另外放只用一半', '沙拉'),
  f('酸菜白肉鍋', D, true, '肉選瘦的，沾醬少一點，湯喝一碗就好', '酸菜白肉鍋'),
  f('餛飩湯麵', B, true, '湯麵加燙青菜，紅油抄手換清湯', '餛飩'),
  f('擔仔麵', B, true, '小碗擔仔麵配一盤燙青菜和滷蛋', '擔仔麵'),
  f('麻辣燙（不辣）', B, true, '湯底選大骨或番茄，不辣，多拿青菜豆腐，少拿丸子', '麻辣燙'),
  f('豬血湯', B, true, '豬血湯配一碗白飯或燙青菜，韭菜多一點', '豬血湯'),
  f('四神湯', B, true, '四神湯配一個菜包或肉包', '四神湯'),
  f('港式燒臘飯', D, false, '油雞去皮，飯少一點，配一碗例湯', '燒臘'),
  f('親子丼', D, false, '飯少一點，加點一份味噌湯和小菜', '丼飯'),
  f('打拋豬飯', D, false, '泰式料理可以加點涼拌木瓜絲', '泰式料理'),
  f('石鍋拌飯', D, false, '辣醬少放，青菜拌多一點', '石鍋拌飯'),
  f('平價牛排', D, false, '點雞排或魚排比較不油，麵少吃一點', '牛排'),
  f('披薩', D, false, '選薄皮，一兩片就好，配沙拉', '披薩'),
  f('韓式炸雞', D, false, '一份兩個人分，配醃蘿蔔和沙拉', '韓式炸雞'),
  f('肉圓', D, false, '蒸的肉圓比炸的不油，配一碗四神湯', '肉圓'),
  f('碗粿米糕', D, false, '一碗就好，配虱目魚湯', '碗粿'),
  f('燒肉飯', D, false, '肉選瘦一點的，加燙青菜', '燒肉飯'),
  f('刈包', D, false, '一個就好，配四神湯', '刈包'),
  f('越南法國麵包', D, false, '配一碗河粉湯就很飽', '越南法國麵包'),
  f('蚵仔麵線', B, false, '小碗就好，蒜泥和辣油少一點', '麵線'),
  f('蚵仔煎', B, false, '醬汁少一點，配一碗蛤蜊湯', '蚵仔煎'),
  f('臭豆腐', B, false, '選麻辣或清蒸臭豆腐比炸的不油', '臭豆腐'),
  f('熱炒', B, false, '點一個清蒸魚、一盤炒青菜、一個湯', '熱炒'),
  f('鍋貼', B, false, '10 顆左右，配酸辣湯', '鍋貼'),
  f('薑母鴨', L, false, '冬天吃，湯少喝，多加高麗菜', '薑母鴨'),
  f('鹹水雞', B, true, '雞胸肉加花椰菜、玉米筍、木耳，醬少一點，不要加辣油'),
  f('滷味', B, true, '多拿青菜、豆腐、海帶，少拿丸子和王子麵，醬汁少一點'),
  f('清粥小菜', B, true, '地瓜粥配一樣魚或蛋、兩樣青菜，少拿醬菜', '清粥小菜'),
  f('超商組合', L, true, '茶葉蛋兩顆、烤地瓜一條、一份沙拉或無糖豆漿', '便利商店'),
  f('豆漿店', L, true, '無糖豆漿配蘿蔔糕或飯糰，不要加油條', '豆漿店'),
  f('關東煮', L, true, '白蘿蔔、玉米、豆腐、蒟蒻，湯少喝', '關東煮'),
  f('虱目魚粥', B, true, '魚肚粥或魚肉粥，油條不要加', '虱目魚粥'),
  f('鹹粥', B, true, '點魚肉或瘦肉鹹粥，配一盤燙青菜', '鹹粥'),
  f('廣東粥', B, true, '皮蛋瘦肉粥或魚片粥，不要加油條', '廣東粥'),
  f('海產粥', B, true, '海鮮多一點，飯粒少一點，湯喝一半', '海產粥'),
  f('牛肉湯', B, true, '牛肉湯配一小碗白飯，肉燥飯換白飯', '牛肉湯'),
  f('鮮魚湯', B, true, '清湯的魚湯，不要加油蔥酥', '鮮魚湯'),
  f('雞肉飯加燙青菜', B, true, '小碗雞肉飯，雞油少一點，配燙青菜和蛋花湯', '雞肉飯'),
  f('陽春湯麵', B, true, '湯麵不要乾麵，加燙青菜和滷蛋', '麵店'),
  f('蒸餃', B, true, '蒸的不要煎的，8 顆左右，配蛋花湯', '蒸餃'),
  f('烤雞胸串', L, true, '雞胸、香菇、玉米、青椒，刷醬少一點，不要撒胡椒鹽', '燒烤'),
  f('超商雞胸肉沙拉', L, true, '即食雞胸肉配一盒生菜沙拉，醬只倒一半', '便利商店'),
  f('超商飯糰配蛋', L, true, '一個飯糰配兩顆茶葉蛋和無糖豆漿', '便利商店'),
  f('超商蒸地瓜配優格', L, true, '烤地瓜一條、無糖優格一盒、茶葉蛋一顆', '便利商店'),
  f('鹽酥雞', L, false, '少拿炸的，多拿青菜，不要加胡椒鹽', '鹽酥雞'),
  f('麥當勞', L, false, '雞塊換成沙拉或玉米湯，飲料點無糖茶', '麥當勞'),
  f('宵夜炒麵', L, false, '一份兩人分，配燙青菜', '宵夜'),
]

export interface MyPlace {
  name: string
  when: When | 'both'
}
/** 我們自己加的店也一起抽，而且機會多一點（常吃才會加） */
export function myFoods(mine: MyPlace[]): OutFood[] {
  return mine.map((m) => ({
    name: m.name,
    when: m.when === 'both' ? B : [m.when],
    light: true,
    tip: '我們常吃的',
    q: m.name,
    mine: true,
  }))
}

export const mapUrl = (x: OutFood) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${AREA} ${x.q}`)}`

export interface OutOpts {
  when: When
  /** 草莓減重中：只抽輕盈的 */
  light: boolean
  /** 不想吃的 */
  no: string[]
  /** 這幾個不要抽到（另一個人的、剛剛那個、最近吃過的） */
  avoid: string[]
  mine: MyPlace[]
}

/** 可以抽的選項 */
export function outChoices(o: OutOpts): OutFood[] {
  const all = [...myFoods(o.mine), ...OUT_FOODS]
  const seen = new Set<string>()
  return all.filter((x) => {
    if (seen.has(x.name)) return false
    seen.add(x.name)
    return x.when.includes(o.when) && (!o.light || x.light) && !o.no.includes(x.name)
  })
}

/** 抽一個：先避開 avoid，避不開才放寬；自己加的店機會 ×3 */
export function pickOut(o: OutOpts, seed: string): OutFood | null {
  const all = outChoices(o)
  const fresh = all.filter((x) => !o.avoid.includes(x.name))
  const list = fresh.length ? fresh : all
  if (!list.length) return null
  const r = rng(seed)
  const w = list.map((x) => (x.mine ? 3 : 1))
  let k = r() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < list.length; i++) {
    k -= w[i]
    if (k < 0) return list[i]
  }
  return list[list.length - 1]
}

export function findOut(name: string, mine: MyPlace[]): OutFood | undefined {
  return [...myFoods(mine), ...OUT_FOODS].find((x) => x.name === name)
}
