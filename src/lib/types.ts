export type DishType = 'main' | 'veg' | 'soup'
export type Tool = '爐' | '氣' | '蒸' | '免'
export type People = 2 | 3 | 8

export interface Dish {
  type: DishType
  name: string
  min: number
  tool: Tool
  hot: boolean
  /** 食材：[名稱, 3 人份數量, 單位] */
  ing: [string, number, string][]
  /** 配料：[名稱, 3 人份用量（例如「1 大匙」或「少許」）] */
  sauce: [string, string][]
  custom: boolean
}

export interface Settings {
  people: People
  diet: boolean
  noHot: boolean
  maxMin: 0 | 20 | 30
  /** 下班到家要幾分鐘 */
  commute: number
  /** 想幾點吃飯，從午夜算起的分鐘 */
  dinnerMin: number
}

export interface Mark {
  fav: boolean
  banned: boolean
}

export interface Day {
  day: string
  reroll: number
  dishes: string[] | null
  people: People | null
  cooked: boolean
  /** 按「我下班了」的時間；在家也會記 */
  offAt: string | null
  /** 下班後可以煮的分鐘；null 代表今天在家 */
  avail: number | null
}
