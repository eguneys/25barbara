import Time from './time'
import Graphics from './graphics'

type PlayCtor<T extends Play> = { new(g: Graphics, x: number, y: number): T }

export default abstract class Play {

  _data: any

  _set_data(data: any) {
    this._data = data
    return this
  }

  life!: number
  objects: Play[]

  _scheds: [number, () => void][]

  parent!: Play

  get position() {
    return [this.x, this.y]
  }

  sched(n: number, p: () => void) {
    this._scheds.push([n, p])
  }


  constructor(readonly g: Graphics, public x: number, public y: number) {
    this.objects = []
    this._scheds = []
  }


  many<T extends Play>(ctor: PlayCtor<T>): T[] {
    return this.objects.filter(_ => _ instanceof ctor) as T[]
  }



  one<T extends Play>(ctor: PlayCtor<T>): T | undefined {
    return this.objects.find(_ => _ instanceof ctor) as T | undefined
  }

  _make<T extends Play>(ctor: PlayCtor<T>, data: any, x: number, y: number) {
    let res = new ctor(this.g, x, y)
    res.parent = this
    res._set_data(data).init()
    return res
  }

  make<T extends Play>(ctor: PlayCtor<T>, data: any = {}, x = 0, y = x) {
    let res = this._make(ctor, data, x, y)
    this.objects.push(res)
    return res
  }

  remove(p?: Play) {
    if (!p) {
      this.parent?.remove(this)
      return
    }
    let i = this.objects.indexOf(p)
    if (i === -1) {
      throw 'noscene rm'
    }
    this.objects.splice(i, 1)
  }

  init() {

    this.life = 0

    this._init()
    return this
  }

  update() {
    if (this.life === 0) {
      this._first_update()
    }
    this.objects.forEach(_ => _.update())
    this.life += Time.dt

    this._scheds = this._scheds.map<[number, () => void]>(([n, p]) => {
      if (n - Time.dt < 0) {
        p()
      }
      return [n - Time.dt, p]
    }).filter(_ => _[0] > 0)

    this._update()
  }

  visible = true
  draw() {
    if (!this.visible) {
      return
    }
    this._pre_draw()
    this.objects.forEach(_ => _.draw())
    this._draw()
    this._post_draw()
  }


  _init() {}
  _first_update() {}
  _update() {}
  _draw() {}
  _pre_draw() {}
  _post_draw() {}
}

export type SOrigin = 'c' | 'bc' | 'tl'

export type AnimData = {
  name: string,
  tag?: string,
  s_origin?: SOrigin,
  duration?: number
}