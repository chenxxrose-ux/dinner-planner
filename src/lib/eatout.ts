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
  f('清燉牛肉麵', D, true, '點清燉不要紅燒，加一盤燙青菜，湯喝一半就好', '牛肉麵'),
  f('水餃加燙青菜', D, true, '水餃 8 到 10 顆，配酸辣湯或蛋花湯，沾醬少一點', '水餃'),
  f('海南雞飯', D, true, '雞肉去皮，油飯換白飯，醬汁另外放', '海南雞飯'),
  f('越南河粉', D, true, '點雞肉或牛肉河粉，湯頭清，加豆芽和九層塔', '越南河粉'),
  f('小火鍋', D, true, '湯底選昆布或蔬菜，火鍋料少拿，沾醬用醬油加蔥蒜', '小火鍋'),
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
  f('鹹水雞', B, true, '雞胸肉加花椰菜、玉米筍、木耳，醬少一點，不要加辣油'),
  f('滷味', B, true, '多拿青菜、豆腐、海帶，少拿丸子和王子麵，醬汁少一點'),
  f('清粥小菜', B, true, '地瓜粥配一樣魚或蛋、兩樣青菜，少拿醬菜', '清粥小菜'),
  f('超商組合', L, true, '茶葉蛋兩顆、烤地瓜一條、一份沙拉或無糖豆漿', '便利商店'),
  f('豆漿店', L, true, '無糖豆漿配蘿蔔糕或飯糰，不要加油條', '豆漿店'),
  f('關東煮', L, true, '白蘿蔔、玉米、豆腐、蒟蒻，湯少喝', '關東煮'),
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
