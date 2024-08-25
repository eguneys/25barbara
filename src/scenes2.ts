import Graphics from './graphics'
import { Vec3 } from './math4'
import Time, { Lerpable, my_loop, State } from './time'

// @ts-ignore
function lerp(a: number, b: number, t = 0.1) {
    return (1 - t) * a + t * b
}

function appr(v: number, t: number, by = Time.dt) {
    if (v < t) {
        return Math.min(v + by, t)
    } else if (v > t) {
        return Math.max(v - by, t)
    } else {
        return v
    }
}

type XYWH = { x: number, y: number, w: number, h: number }
// @ts-ignore
function collide_rect(a: XYWH, b: XYWH) {
    return a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
}

function vec3_lerp(a: Vec3, b: Vec3, t: number) {
    return new Vec3(
        b.x * t + a.x * (1 - t),
        b.y * t + a.y * (1 - t),
        b.z * t + a.z * (1 - t))
}

class Life implements Lerpable<Vec3> {

    get value() {
        return this.life
    }

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
        return new Life(vec3_lerp(this.life, next.life, alpha))
    }
}

class Rigid implements Lerpable<Vec3> {

    get value() {
        return this.position
    }

    constructor(public position: Vec3 = Vec3.zero, public dposition: Vec3 = Vec3.zero, public ddposition: Vec3 = Vec3.zero) {}

    integrate() {

        let ddposition = this.ddposition.clone
        let dposition = this.dposition.clone
        let position = this.position.clone

        position.x = position.x + dposition.x * Time.dt + ddposition.x * (Time.dt * Time.dt * 0.5)
        position.y = position.y + dposition.y * Time.dt + ddposition.y * (Time.dt * Time.dt * 0.5)
        position.z = position.z + dposition.z * Time.dt + ddposition.z * (Time.dt * Time.dt * 0.5)

        ddposition.x = appr(ddposition.x, 0, Time.dt * 20)
        ddposition.y = appr(ddposition.y, 0, Time.dt * 20)
        ddposition.z = appr(ddposition.z, 0, Time.dt * 20)

        dposition.x = dposition.x * 0.8 + (this.ddposition.x + ddposition.x) * (Time.dt * 0.5)
        dposition.y = dposition.y * 0.8 + (this.ddposition.y + ddposition.y) * (Time.dt * 0.5)
        dposition.z = dposition.z * 0.8 + (this.ddposition.z + ddposition.z) * (Time.dt * 0.5)

        return new Rigid(position, dposition, ddposition)
    }

    lerp(next: Rigid, alpha: number) {
        return new Rigid(
            vec3_lerp(this.position, next.position, alpha),
            vec3_lerp(this.dposition, next.dposition, alpha),
            vec3_lerp(this.ddposition, next.ddposition, alpha),
        )
    }

}

type PlayCtor<T extends Play> = { new(g: Graphics, ps: PlayState, t: Vec3, r: Vec3, s: Vec3): T }
abstract class Play {

    constructor(readonly g: Graphics, readonly ps: PlayState, transform: Vec3 = Vec3.zero, rotation: Vec3 = Vec3.zero, scale = Vec3.unit) {
    
        this._life = this.ps.register_lerpable(new Life())
        this._transform = this.ps.register_lerpable(new Rigid(transform))
        this._rotation = this.ps.register_lerpable(new Rigid(rotation))
        this._scale = this.ps.register_lerpable(new Rigid(scale))
    }

    _life: number
    get life() {
        return this.ps.get_lerpable<Life>(this._life)
    }

    _transform: number
    get transform() {
        return this.ps.get_lerpable<Rigid>(this._transform)
    }

    set transform(transform: Rigid) {
        this.ps.deregister_lerpable(this._transform)
        this._transform = this.ps.register_lerpable(transform)
    }


    _rotation: number
    get rotation() {
        return this.ps.get_lerpable<Rigid>(this._rotation)
    }

    set rotation(rotation: Rigid) {
        this.ps.deregister_lerpable(this._rotation)
        this._rotation = this.ps.register_lerpable(rotation)
    }

    _scale: number
    get scale() {
        return this.ps.get_lerpable<Rigid>(this._scale)
    }

    set scale(scale: Rigid) {
        this.ps.deregister_lerpable(this._scale)
        this._scale = this.ps.register_lerpable(scale)
    }


    get local_position() {
        return this.transform.value
    }

    get world_position(): Vec3 {
        if (this.parent === this) {
            return this.local_position
        }
        return this.local_position.clone.add(this.parent.world_position)
    }

    get local_rotation() {
        return this.rotation.value
    }

    get world_rotation(): Vec3 {
        if (this.parent === this) {
            return this.local_rotation
        }
        return this.local_rotation.clone.add(this.parent.world_rotation)
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

    _make<T extends Play>(ctor: PlayCtor<T>, data: any, t: Vec3 = Vec3.zero, r: Vec3 = Vec3.zero, s: Vec3 = Vec3.unit) {
        let res = new ctor(this.g, this.ps, t, r, s)
        res.parent = this
        res._set_data(data).init()
        return res
    }

    make<T extends Play>(ctor: PlayCtor<T>, data: any = {}, t?: Vec3, r?: Vec3, s?: Vec3) {
        let res = this._make(ctor, data, t, r, s)
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
        let { tx, ty } = this
        this.g.begin_rect(tx, ty)
        this._draw()
        this.g.end_rect()
        let { x, y, z } = this.world_position
        let { x: rx, y: ry, z: rz } = this.world_rotation
        let { x: sx, y: sy, z: sz } = this.scale.value
        this.g.push_el(rx, ry, rz, x, y, z, tx, ty, sx, sy, sz)
        this._post_draw()
    }


    remove() {
        this.ps.deregister_lerpable(this._transform)
        this.ps.deregister_lerpable(this._life)
        this.children.forEach(_ => _.remove())
        this.parent.children.splice(this.parent.children.indexOf(this), 1)
        this._remove()
    }

    _init() {}
    _update() {}
    _draw() {}
    _pre_draw() {}
    _post_draw() {}
    _remove() {}
}

class Gold extends Play {

    _init() {
    }

    _draw() {
        let { g } = this
        let a = this.life.x
        this.rotation.position.z = .1

        g.ctx.fillStyle = 'gold'
        g.ctx.fillRect(0, 0, 20, 20)
        g.ctx.beginPath()
        g.ctx.arc(64, 64, 10 + Math.abs(Math.sin(a)) * 54, 0, Math.PI * 2)
        g.ctx.fill()
    }


}

class OneBot extends Play {
    _draw() {
        let { g } = this
        g.ctx.fillStyle = 'white'
        g.ctx.fillRect(64 - 15, 64 - 15, 30, 30)
    }
}

class OneG extends Play {

    _init() {
        this.make(OneBot, {}, Vec3.make(0, 0, 0), Vec3.make(-Math.PI * 0.39, 0, 0))
    }

    _draw() {
        let { g } = this
        g.ctx.fillStyle = `hsl(${1/13 * 255} 75% 50%)`
        g.ctx.fillRect(0, 0, 128, 128)
    }
}

class Scene extends Play {

    _init() {

        this.make(Gold)
        this.make(OneG, {}, 
            Vec3.make(100, 15, 2), 
            Vec3.make(Math.PI * 0.35, 0, 0), 
            Vec3.make(2, 1, 1))
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

    register_lerpable<T>(lerpable: Lerpable<T>) {
        return this.lerpables.push(lerpable) - 1
    }

    deregister_lerpable(n: number) {
        this.lerpables.splice(n, 1)
    }

    get_lerpable<T extends Lerpable<any>>(n: number) {
        return this.lerpables[n] as T
    }

    lerpables: Lerpable<any>[] = []
}

export default function SceneManager(g: Graphics) {

    g.once()

    let state = new PlayState(g)

    my_loop(state)
}