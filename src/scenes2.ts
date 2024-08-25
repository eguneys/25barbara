import Graphics from './graphics'
import { Vec3 } from './math4'
import Time, { Lerpable, my_loop, State } from './time'

function vec3_lerp(a: Vec3, b: Vec3, t: number) {
    return new Vec3(
        b.x * t + a.x * (1 - t),
        b.y * t + a.y * (1 - t),
        b.z * t + a.z * (1 - t))
}

class Life implements Lerpable {

    constructor(public life: Vec3 = Vec3.zero) {}

    get x() {
        return this.life.x
    }

    integrate() {
        return new Life(Vec3.make(
            this.life.x + Time.dt, 
            this.life.y + Time.dt, 
            this.life.z + Time.dt))
    }

    lerp(next: Life, alpha: number) {
        return new Life(vec3_lerp(next.life, this.life, alpha))
    }
}

class Rigid implements Lerpable {

    get x() {
        return this.position.x
    }

    get y() {
        return this.position.y
    }

    get z() {
        return this.position.y
    }

    constructor(public position: Vec3 = Vec3.zero, public dposition: Vec3 = Vec3.zero, public ddposition: Vec3 = Vec3.zero) {}

    integrate() {

        return this
    }

    lerp(next: Rigid, alpha: number) {
        return new Rigid(
            vec3_lerp(this.position, next.position, alpha),
            vec3_lerp(this.dposition, next.dposition, alpha),
            vec3_lerp(this.dposition, next.ddposition, alpha),
        )
    }

}

type PlayCtor<T extends Play> = { new(g: Graphics, s: PlayState, t: Rigid): T }
abstract class Play {

    constructor(readonly g: Graphics, readonly s: PlayState, transform: Rigid = new Rigid()) {
    
        this._life = this.s.register_lerpable(new Life())
        this._transform = this.s.register_lerpable(transform)
    }

    _life: number
    get life() {
        return this.s.get_lerpable<Life>(this._life)
    }

    _transform: number
    get transform() {
        return this.s.get_lerpable<Rigid>(this._transform)
    }

    _data: any
    _set_data(data: any) {
        this._data = data
        return this
    }

    many<T extends Play>(ctor: PlayCtor<T>): T[] {
        return this.children.filter(_ => _ instanceof ctor) as T[]
    }



    one<T extends Play>(ctor: PlayCtor<T>): T | undefined {
        return this.children.find(_ => _ instanceof ctor) as T | undefined
    }

    _make<T extends Play>(ctor: PlayCtor<T>, data: any, t: Rigid) {
        let res = new ctor(this.g, this.s, t)
        res.parent = this
        res._set_data(data).init()
        return res
    }

    make<T extends Play>(ctor: PlayCtor<T>, data: any = {}, t: Rigid = new Rigid()) {
        let res = this._make(ctor, data, t)
        this.children.push(res)
        return res
    }

    parent: Play = this
    children: Play[] = []

    tx!: number
    ty!: number



    init() {
        [this.tx, this.ty] = this.g.borrow_texture_space()!
        this._init()
        return this
    }

    integrate() {
        this.children.forEach(_ => _.integrate())
        this._update()
    }

    render() {
        this._pre_draw()
        this.children.forEach(_ => _.render())
        this._draw()
        this._post_draw()
    }

    _init() {}
    _update() {}
    _draw() {}
    _pre_draw() {}
    _post_draw() {}
}

class Gold extends Play {

    _draw() {
        let { g } = this
        let { tx, ty } = this
        let a = this.life.x

        g.begin_rect(tx, ty)
        g.ctx.fillStyle = 'gold'
        g.ctx.fillRect(0, 0, 20, 20)
        g.ctx.beginPath()
        g.ctx.arc(64, 64, Math.abs(Math.sin(a)) * 64, 0, Math.PI * 2)
        g.ctx.fill()
        g.end_rect()

        let { x, y, z } = this.transform
        g.push_el(0, 0, Math.sin(a), x, y, z, tx, ty)
    }


}

class Scene extends Play {

    gold!: Gold

    _init() {
        this.gold = this.make(Gold)
    }

    _pre_draw() {
        this.g.clear()
    }

    _post_draw() {
        this.g.draw()
    }
}


class PlayState implements State {

    scene: Scene

    constructor(g: Graphics) {
        this.scene = new Scene(g, this)._set_data({}).init()
    }

    integrate(): void {
        this.scene.integrate()
    }

    render(): void {
        this.scene.render()
    }

    register_lerpable(lerpable: Lerpable) {
        return this.lerpables.push(lerpable) - 1
    }

    get_lerpable<T extends Lerpable>(n: number) {
        return this.lerpables[n] as T
    }

    lerpables: Lerpable[] = []
}

export default function SceneManager(g: Graphics) {

    g.once()

    let state = new PlayState(g)

    my_loop(state)
}