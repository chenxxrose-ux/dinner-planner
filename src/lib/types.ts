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
}
