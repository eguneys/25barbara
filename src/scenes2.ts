import i from './input'
import Graphics from './graphics'
import { Mat4, Quat, Vec3 } from './math4'
import Time, { Lerpable, my_loop, State } from './time'

const Colors = {
    black: '#000000',
    darkblue: '#1D2B53',
    darkred: '#7E2553',
    darkgreen: '#008751',
    brown: '#AB5236',
    darkgray: '#5F574F',
    gray: '#C2C3C7',
    white: '#FFF1E8',
    red: '#FF004D',
    orange: '#FFA300',
    yellow: '#FFEC27',
    green: '#00E436',
    blue: '#29ADFF',
    purple: '#83769C',
    pink: '#FF77A8',
    sand: '#FFCCAA',
}

const max_dx = 15

// @ts-ignore
function lerp(a: number, b: number, t = 0.1) {
    return (1 - t) * a + t * b
}

// @ts-ignore
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

    constructor(public position: Vec3 = Vec3.zero, public dposition: Vec3 = Vec3.zero) {}

    integrate() {

        let dposition = this.dposition.clone
        let position = this.position.clone

        position = Vec3.make(
            position.x + dposition.x * Time.dt,
            position.y + dposition.y * Time.dt,
            position.z + dposition.z * Time.dt)

        dposition = Vec3.make(
            dposition.x * 0.8,
            dposition.y * 0.8,
            dposition.z * 0.8)

        return new Rigid(position, dposition)
    }

    lerp(next: Rigid, alpha: number) {
        return new Rigid(
            vec3_lerp(this.position, next.position, alpha),
            vec3_lerp(this.dposition, next.dposition, alpha))
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

    get quat() {
        let { x, y, z } = this.world_rotation
        return Quat.identity.rotateX(x).rotateY(y).rotateZ(z)
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
        if (this._data.debug) {
            this.debug_draw()
        } else {
          this._draw()
        }
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


    debug_draw() {
        this.g.ctx.fillStyle = 'white'
        this.g.ctx.fillRect(0, 0, 256, 256)
        this.g.path('M 0 0 L 0 100', 'red', 10)
        this.g.path('M 128 128 L 100 100', 'green', 10)
    }

    _init() {}
    _update() {}
    _draw() {}
    _pre_draw() {}
    _post_draw() {}
    _remove() {}
}

abstract class Group extends Play {

    render() {
        this._pre_draw()
        this.children.forEach(_ => _.render())
        this._post_draw()
    }
}

// @ts-ignore
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

    _update() {
        let is_up = i('ArrowUp') || i('w')
        let is_down = i('ArrowDown') || i('s')
        let is_left = i('ArrowLeft') || i('d')
        let is_right = i('ArrowRight') || i('a')


        let left = Mat4.from_quat(this.parent.quat).mVec3(Vec3.left).scale(max_dx)
        let right = Mat4.from_quat(this.parent.quat).mVec3(Vec3.right).scale(max_dx)
        let up = Mat4.from_quat(this.parent.quat).mVec3(Vec3.up).scale(max_dx)
        let down = Mat4.from_quat(this.parent.quat).mVec3(Vec3.down).scale(max_dx)

        if (is_left) {
            this.transform.dposition = this.transform.dposition.add(left)
        } else if (is_right) {
            this.transform.dposition = this.transform.dposition.add(right)
        }

        if (is_up) {
            this.transform.dposition = this.transform.dposition.add(up)
        } else if (is_down) {
            this.transform.dposition = this.transform.dposition.add(down)
        }
    }


    _draw() {
        let { g } = this
        let swing_h = Math.sin(this.life.x * 4) * 2
        let x = 128 
        let y = 128
        let n = 60
        if (true) {
            g.path(`M ${x + n} ${y} A 1 1 0 0 0 ${x + n} ${y - n}`, Colors.black, 10)
            g.path(`M ${x - n} ${y - n} A 1 1 0 0 0 ${x - n} ${y}`, Colors.black, 10)
            g.path(`M ${x + n} ${y - n} A 1 1 0 0 0 ${x - n} ${y - n}`, Colors.black, 10)
            g.circle(x, y + 40, 40, Colors.red, Colors.black)
            g.circle(x, y - 20 + swing_h, 64, Colors.red, Colors.black)
            if (this.life.x % 3 < 2.3 || (this.life.x % 3 > 2.6 && this.life.x % 3 < 2.8)) {
                g.path(`M ${x - n / 2} ${y - n / 2} L ${x - n / 2} ${y - 20}`, Colors.white, 20)
                g.path(`M ${x + n / 2} ${y - n / 2} L ${x + n / 2} ${y - 20}`, Colors.white, 20)
            } else {
                g.path(`M ${x - n / 2 - 10} ${y - n / 2 + 10} L ${x - n / 2 + 10} ${y - n / 2 + 10}`, Colors.white, 20)
                g.path(`M ${x + n / 2 - 10} ${y - n / 2 + 10} L ${x + n / 2 + 10} ${y - n / 2 + 10}`, Colors.white, 20)
            }
        } else {

        }
    }
}

class OneG extends Play {

    _init() {
        this.make(OneBot, {}, Vec3.make(-100, 0, -25), Vec3.make(Math.PI * 0.25, 0, Math.PI * 0))
        //this.make(Gold, {}, Vec3.make(0, 0, -1), Vec3.make(Math.PI * 0.25, 0, 0))
    }

    _draw() {
        let { g } = this
        g.ctx.fillStyle = Colors.sand
        g.ctx.fillRect(0, 0, 256, 256)
    }
}

class Scene extends Group {

    _init() {

        this.make(OneG, {}, 
            Vec3.make(0, 10, 0), 
            Vec3.make(0, 0, 0), 
            Vec3.make(6, 3, 3))

    }

    _update() {

        //this.g.camera.o.x = Math.sin(this.life.x) * 100
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