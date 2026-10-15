// 剩菜變新菜：勾選冰箱裡剩的，馬上給能做的菜和做法（不用連網，也不用買新東西）
import type { Dish } from './types'

/** 飯、主菜（肉海鮮蛋豆腐）、有醬汁的滷燒菜、青菜、湯 */
export type LeftKind = 'rice' | 'meat' | 'sauce' | 'veg' | 'soup'
export interface Leftover {
  name: string
  kinds: LeftKind[]
}

const SAUCY = /滷|紅燒|燉|燒|咖哩|三杯|扣肉|東坡|丼|醬爆|京醬|糖醋|打拋|麻婆|魚香|宮保|左宗棠|可樂|啤酒/

/** 從菜單裡的菜判斷是哪一種剩菜 */
export function leftKinds(d: Pick<Dish, 'name' | 'type'>): LeftKind[] {
  if (d.type === 'soup') return ['soup']
  if (d.type === 'veg') return ['veg']
  return SAUCY.test(d.name) ? ['meat', 'sauce'] : ['meat']
}

type Picked = Record<LeftKind, string[]>
export interface LeftIdea {
  name: string
  min: number
  tool: string
  /** 要剩什麼才能做：每一組至少要有一樣 */
  needs: LeftKind[][]
  /** 也會用到的剩菜 */
  uses: LeftKind[]
  /** 家裡要有的東西（不用特地去買的那種） */
  add: string[]
  light: boolean
  steps: (p: Picked) => string[]
}

const j = (xs: string[]) => xs.join('、')
const any = (p: Picked, ...ks: LeftKind[]) => ks.flatMap((k) => p[k])
const uniq = (xs: string[]) => [...new Set(xs)]

export const LEFT_IDEAS: LeftIdea[] = [
  {
    name: '剩菜炒飯', min: 10, tool: '瓦斯爐', needs: [['rice']], uses: ['meat', 'sauce', 'veg'], add: ['雞蛋 2 顆', '蔥 1 根'], light: false,
    steps: (p) => {
      const mix = uniq(any(p, 'meat', 'veg'))
      return [
        `${j(p.rice)}先用手撥散（冰過的飯最好炒）${mix.length ? `；${j(mix)}切小丁` : ''}，蔥切蔥花。`,
        '熱鍋放 1 大匙油，蛋打散倒下去，半熟就把飯倒進去一起炒散。',
        mix.length ? `下${j(mix)}炒到熱透，鍋邊淋 1 小匙醬油。` : '鍋邊淋 1 小匙醬油，炒到飯粒分開。',
        '撒蔥花和一點鹽、白胡椒，起鍋。',
      ]
    },
  },
  {
    name: '剩菜鹹粥', min: 15, tool: '瓦斯爐', needs: [['rice']], uses: ['meat', 'veg', 'soup'], add: ['薑 1 小塊', '蔥 1 根'], light: true,
    steps: (p) => {
      const mix = uniq(any(p, 'meat', 'veg'))
      return [
        `${mix.length ? `${j(mix)}切小塊；` : ''}薑切絲，蔥切蔥花。`,
        p.soup.length ? `${j(p.soup)}加水補到 5 碗，煮滾。` : '5 碗水加薑絲煮滾，加 1 小匙味霸。',
        `下${j(p.rice)}，小火煮 8 分鐘，常常攪一下才不會黏鍋。`,
        mix.length ? `下${j(mix)}再煮 3 分鐘，撒白胡椒和蔥花。` : '撒白胡椒和蔥花，想吃可以打一顆蛋花。',
      ]
    },
  },
  {
    name: '剩菜蓋飯', min: 8, tool: '瓦斯爐', needs: [['rice'], ['meat']], uses: ['sauce', 'veg'], add: ['雞蛋 1 顆／人'], light: false,
    steps: (p) => [
      `${j(p.meat)}連湯汁一起加熱到冒泡${p.sauce.length ? '（滷汁淋在飯上最好吃）' : ''}。`,
      `${j(p.rice)}微波或蒸熱，裝碗。`,
      '另外煎荷包蛋，蛋黃半熟。',
      `${j(p.meat)}鋪在飯上，放荷包蛋${p.veg.length ? `，旁邊放熱好的${j(p.veg)}` : ''}。`,
    ],
  },
  {
    name: '滷汁拌麵', min: 10, tool: '瓦斯爐', needs: [['sauce']], uses: ['veg'], add: ['麵條 1 把／人', '蔥 1 根'], light: false,
    steps: (p) => [
      `${j(p.sauce)}連滷汁加熱，肉切小塊。`,
      '一鍋水煮滾，下麵條照包裝時間煮熟，撈起瀝乾。',
      p.veg.length ? `${j(p.veg)}放進煮麵水燙熱撈起。` : '可以順便燙一把青菜。',
      '麵淋上滷汁和肉，撒蔥花拌勻。',
    ],
  },
  {
    name: '湯麵', min: 10, tool: '瓦斯爐', needs: [['soup']], uses: ['meat', 'veg'], add: ['麵條 1 把／人'], light: true,
    steps: (p) => {
      const mix = uniq(any(p, 'meat', 'veg'))
      return [
        `${j(p.soup)}加 1 碗水煮滾，嚐一下鹹淡。`,
        '另一鍋水把麵煮到八分熟，撈起來（直接下湯裡會變糊）。',
        `麵放進湯裡再煮 1 分鐘${mix.length ? `，下${j(mix)}一起煮熱` : ''}。`,
        '撒蔥花或白胡椒就好。',
      ]
    },
  },
  {
    name: '湯泡飯', min: 8, tool: '瓦斯爐', needs: [['soup'], ['rice']], uses: ['veg'], add: [], light: true,
    steps: (p) => [
      `${j(p.soup)}煮滾。`,
      `下${j(p.rice)}用湯匙壓散，小火煮 3 分鐘。`,
      p.veg.length ? `下${j(p.veg)}煮熱，起鍋。` : '可以打一顆蛋花，起鍋。',
    ],
  },
  {
    name: '剩菜烘蛋', min: 12, tool: '瓦斯爐', needs: [['meat', 'veg']], uses: ['meat', 'veg'], add: ['雞蛋 4 顆', '蔥 1 根'], light: true,
    steps: (p) => {
      const mix = uniq(any(p, 'meat', 'veg'))
      return [
        `${j(mix)}切小丁，湯汁瀝乾；蛋加一點鹽打散，拌進去。`,
        '平底鍋放油，倒蛋液，小火蓋鍋烘 6 分鐘。',
        '底部金黃後用盤子蓋著翻面，再烘 3 分鐘。',
        '切成片上桌，可以沾一點番茄醬。',
      ]
    },
  },
  {
    name: '剩菜炒麵', min: 12, tool: '瓦斯爐', needs: [['meat', 'veg']], uses: ['meat', 'sauce', 'veg'], add: ['油麵或關廟麵 1 份', '醬油'], light: false,
    steps: (p) => {
      const mix = uniq(any(p, 'meat', 'veg'))
      return [
        `${j(mix)}切小塊。`,
        '麵燙 1 分鐘撈起（油麵直接用）。',
        `熱鍋放油，炒${j(mix)}到熱，下麵和 3 大匙水。`,
        `加 1 大匙醬油${p.sauce.length ? '和剩的滷汁' : ''}，炒到湯汁收乾。`,
      ]
    },
  },
  {
    name: '焗烤飯', min: 15, tool: '氣炸烤箱', needs: [['rice']], uses: ['meat', 'sauce', 'veg'], add: ['披薩起司絲', '番茄醬 2 大匙'], light: false,
    steps: (p) => {
      const mix = uniq(any(p, 'meat', 'veg'))
      return [
        `${j(p.rice)}拌番茄醬，鋪在烤盤或耐熱碗。`,
        mix.length ? `${j(mix)}切小塊鋪在飯上。` : '可以打一顆蛋在中間。',
        '撒滿起司絲。',
        '氣炸烤箱 200°C 烤 10 分鐘，起司金黃冒泡就好。',
      ]
    },
  },
  {
    name: '煎飯糰', min: 15, tool: '瓦斯爐', needs: [['rice']], uses: ['meat'], add: ['醬油', '海苔（有的話）'], light: false,
    steps: (p) => [
      `${j(p.rice)}微波熱一下${p.meat.length ? `，${j(p.meat)}切碎拌進去` : ''}。`,
      '手沾水，把飯捏成三角形，壓緊。',
      '平底鍋放一點油，兩面煎到金黃酥脆。',
      '刷一層醬油再煎 30 秒，有海苔就包起來。',
    ],
  },
  {
    name: '雜菜蛋花湯', min: 10, tool: '瓦斯爐', needs: [['veg']], uses: ['meat', 'soup'], add: ['雞蛋 2 顆'], light: true,
    steps: (p) => [
      p.soup.length ? `${j(p.soup)}加 2 碗水煮滾。` : '5 碗水煮滾，加 1 小匙味霸。',
      `${j(uniq(any(p, 'veg', 'meat')))}切小段放進去煮 3 分鐘。`,
      '轉小火，蛋液繞圈倒進去，不要馬上攪。',
      '加白胡椒，嚐一下鹹淡再加鹽。',
    ],
  },
]

const KIND_ORDER: LeftKind[] = ['rice', 'meat', 'sauce', 'veg', 'soup']

/** 勾了哪些剩菜 → 可以做的菜，用到越多樣剩菜的排越前面 */
export function leftIdeas(picked: Leftover[], diet = false) {
  const p = Object.fromEntries(KIND_ORDER.map((k) => [k, picked.filter((x) => x.kinds.includes(k)).map((x) => x.name)])) as Picked
  return LEFT_IDEAS.filter((i) => i.needs.every((g) => g.some((k) => p[k].length)))
    .map((i) => {
      const ks = new Set([...i.needs.flat(), ...i.uses])
      const used = picked.filter((x) => x.kinds.some((k) => ks.has(k))).map((x) => x.name)
      return { idea: i, used, steps: i.steps(p) }
    })
    .sort((a, b) => b.used.length - a.used.length || (diet ? Number(b.idea.light) - Number(a.idea.light) : 0) || a.idea.min - b.idea.min)
}
