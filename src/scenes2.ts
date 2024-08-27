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

const max_dx = 90

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

function vec3_appr(a: Vec3, b: Vec3, t: number) {
    return new Vec3(
        appr(a.x, b.x, t),
        appr(a.y, b.y, t),
        appr(a.z, b.z, t),
    )
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

        dposition = vec3_appr(dposition, Vec3.zero, Time.dt * 300)

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

    sx?: number
    sy?: number

    r?: number

    init() {
        [this.tx, this.ty] = this.g.borrow_texture_space()!
        this._init()
        return this
    }

    integrate() {
        this.children.forEach(_ => _.integrate())
        this.update()
    }

    render() {
        this._pre_draw()

        this.children.forEach(_ => _.render())
        let { tx, ty } = this

        this.g.begin_rect(tx, ty, this.r, this.sx, this.sy)
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
        this.g.path('M 0 0 L 0 100', 'red', 'red', 10)
        this.g.path('M 128 128 L 100 100', 'green', 'green', 10)
    }

    update() {
        this._update()
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




abstract class OnGround extends Play {

    get ground() {
        return this.parent as OneG
    }


    move_on_ground(v: Vec3) {
        return Mat4.from_quat(this.ground.quat).mVec3(v)
    }

    direction = [0, 0]

    freeze_dir = false
    
    update() {
        let n = this.transform.dposition
        if (n.x === 0 && n.y === 0) {

        } else if (this.freeze_dir) {
        } else {
            this.direction = [Math.sign(n.x), Math.sign(n.y)]
        }

        super.update()
    }
}

abstract class OnGroundGroup extends OnGround {

    render() {
        this._pre_draw()
        this.children.forEach(_ => _.render())
        this._post_draw()
    }
}



// @ts-ignore
class Gold extends OnGround {


    _init() {
    }

    _draw() {
        let { g } = this
        let a = this.life.x

        g.ctx.fillStyle = 'gold'
        g.ctx.fillRect(0, 0, 20, 20)
        g.ctx.beginPath()
        g.ctx.arc(64, 64, 10 + Math.abs(Math.sin(a)) * 54, 0, Math.PI * 2)
        g.ctx.fill()
    }

}

class OneBot extends OnGround {

    shoot_cool = 0
    swoop_dir = [0, 0]

    t_swoop = 0
    swoop_lines: [number, number][] = []

    _update() {
        let is_up = i('ArrowUp') || i('w')
        let is_down = i('ArrowDown') || i('s')
        let is_left = i('ArrowLeft') || i('a')
        let is_right = i('ArrowRight') || i('d')
        let is_shoot = i(' ') || i('x')


        let left = this.move_on_ground(Vec3.left).scale(max_dx)
        let right = this.move_on_ground(Vec3.right).scale(max_dx)
        let up = this.move_on_ground(Vec3.up).scale(max_dx)
        let down = this.move_on_ground(Vec3.down).scale(max_dx)

        if (this.t_swoop > 0) {

            this.transform.dposition = vec3_appr(this.transform.dposition, Vec3.zero, Time.dt * 30)
            is_left = false
            is_right = false
            is_up = false
            is_down = false
        }


        if (is_left) {
            if (is_up) {
                this.transform.dposition = up.add(left)
            } else if (is_down) {
                this.transform.dposition = down.add(left)
            } else {
                this.transform.dposition = left
            }
        } else if (is_right) {
            if (is_up) {
                this.transform.dposition = up.add(right)
            } else if (is_down) {
                this.transform.dposition = down.add(right)
            } else {
                this.transform.dposition = right
            }
        } else {
            if (is_up) {
                this.transform.dposition = up
            } else if (is_down) {
                this.transform.dposition = down
            }
        }

        if (this.shoot_cool > 0) {
            this.shoot_cool = appr(this.shoot_cool, 0, Time.dt)
        }

        if (this.t_swoop > 0) {
            this.t_swoop = appr(this.t_swoop, 0, Time.dt)
        }

        if (is_shoot) {
            if (this.shoot_cool === 0) {
                this.t_swoop = .5
                this.swoop_dir = this.direction
                this.shoot_cool = .7
            }
        }


        if (this.t_swoop > 0) {
            let a = Math.min(Math.PI, Math.PI * ((.5 - this.t_swoop) * 8))
            if (this.t_swoop > .3) {
                this.swoop_lines.push([Math.sin(a) * 100, 200 + Math.cos(a) * 200])
            } else {
                this.swoop_lines.shift()
            }
        } else {
            this.swoop_lines = []
        }


    }


    _draw() {
        let { g } = this
        let swing_h = Math.sin(this.life.x * 4) * 2
        let x = 200
        let y = 200
        let n = 60

        let [dx, dy] = this.direction

        y += (this.transform.dposition.length > 0) ? Math.sin(this.life.x * 20) * 8 : 0
        x += dx === 0 ? 0 : this.t_swoop * 80
        y += (dy * this.t_swoop) * 80

        let blink = this.life.x % 3 < 2.3 || (this.life.x % 3 > 2.6 && this.life.x % 3 < 2.8)

        if (this.swoop_lines.length > 0) {
            let [l0, l1] = this.swoop_lines[0]
            let ll = this.swoop_lines.slice(1).map(_ => `L ${_[0] + 180} ${_[1]}`).join(' ')
            let ll2 = this.swoop_lines.slice(1).reverse().map((_, i) => `L ${_[0] + (i / this.swoop_lines.length) * 80 + 220} ${_[1]}`).join(' ')
            this.g.path(`M ${l0 + 180} ${l1} ${ll} ${ll2}`, 'white', 'white')
        }



        if (dx === 0 || (dx === 0 && dy < 0)) {

                g.circle(x, y + 40, 40, Colors.red, Colors.black)
                g.circle(x, y - 20 + swing_h, 64, Colors.red, Colors.black)
                g.path(`M ${x + n} ${y} A 1 1 0 0 0 ${x + n} ${y - n}`, Colors.black, Colors.black, 13)
                g.path(`M ${x - n} ${y - n} A 1 1 0 0 0 ${x - n} ${y}`, Colors.black, Colors.black, 13)
                g.path(`M ${x + n} ${y - n} A 1 1 0 0 0 ${x - n} ${y - n}`, Colors.black, undefined, 13)


            if (false) {
                g.path(`M ${x - n / 2 - 10} ${y + n} L ${x - n / 2} ${y + n - 20}`, Colors.black, Colors.black, 30)
                g.path(`M ${x + n / 2 + 10} ${y + n} L ${x + n / 2} ${y + n - 20}`, Colors.black, Colors.black, 30)

                g.path(`M ${x - n / 2 + 5} ${y + n + 10} L ${x - n / 2} ${y + n + 30}`, Colors.black, Colors.black, 30)
                g.path(`M ${x + n / 2 - 5} ${y + n + 10} L ${x + n / 2} ${y + n + 30}`, Colors.black, Colors.black, 30)
            } 

            if (dy < 0) {

            } else {
                if (blink) {
                    g.path(`M ${x - n / 2} ${y - n / 2} L ${x - n / 2} ${y - 20}`, Colors.white, Colors.white, 20)
                    g.path(`M ${x + n / 2} ${y - n / 2} L ${x + n / 2} ${y - 20}`, Colors.white, Colors.white, 20)
                } else {
                    g.path(`M ${x - n / 2 - 10} ${y - n / 2 + 10} L ${x - n / 2 + 10} ${y - n / 2 + 10}`, Colors.white, Colors.white, 20)
                    g.path(`M ${x + n / 2 - 10} ${y - n / 2 + 10} L ${x + n / 2 + 10} ${y - n / 2 + 10}`, Colors.white, Colors.white, 20)
                }
            }
        } else {
            g.circle(x, y + 40, 40, Colors.red, Colors.black)
            g.circle(x, y - 20 + swing_h, 64, Colors.red, Colors.black)
            g.circle(x - 15, y - 15, 30, Colors.black, Colors.black)
            g.path(`M ${x - 15} ${y - n - 33} A 1 5 0 0 0 ${x - 15 - 10} ${y - n}`, Colors.black, Colors.black, 20)
            if (blink) {
                g.path(`M ${x + (n / 2 + 18)} ${y - n / 2} L ${x + (n / 2 + 18)} ${y - 20}`, Colors.white, Colors.white, 20)
            } else {
                g.path(`M ${x + (n / 2 + 20)} ${y - n / 2 + 10} L ${x + (n / 2 + 10)} ${y - n / 2 + 10}`, Colors.white, Colors.white, 20)
            }
        }

        if (dx !== 0) { this.sx = dx }

    }
    
}


class Bush extends OnGroundGroup {
    _init() {
        this.make(Grass, { l: 10 + Math.random() * 180 }, this.move_on_ground(Vec3.make(0, 0, 0)))
        this.make(Grass, { l: 20 + Math.random() * 110 }, this.move_on_ground(Vec3.make(10, 0, 0)))
        this.make(Grass, { l: 30 + Math.random() * 130 }, this.move_on_ground(Vec3.make(5, -10, 0)))
    }
}

class Grass extends OnGround {

    n!: number

    _init() {
        this.n = 6 + Math.random() * 4
    }

    _draw() {
        let l = 160 + this._data.l
        let w = 23
        let lines = []
        let { n } = this
        for (let i = 0; i < n; i++) {
            lines.push([Math.sin(i + this.life.x) * 8, (i / n) * l])
        }

        let ll1 = lines.map(l => `L ${200 + l[0]} ${400 - l[1]}`)
        let ll2 = lines.reverse().map(l => `L ${200 + l[0] - w} ${400 - l[1]}`)

        this.g.path(`M 200 400 ${ll1} A 3 3 0 0 0 ${200 - w} ${400 - l} ${ll2}`, Colors.black, Colors.darkgreen, 10)
    }
}

class OneG extends Play {
    _init() {
        this.make(OneBot, {}, Vec3.make(-100, 0, -25), Vec3.make(Math.PI * 0.25, 0, Math.PI * 0))
        this.make(Bush, {}, Vec3.make(20, 38, -25), Vec3.make(Math.PI * 0.25, 0, 0))
        this.make(Bush, {}, Vec3.make(0, 0, -25), Vec3.make(Math.PI * 0.25, 0, 0))
        this.make(Bush, {}, Vec3.make(100, 60, -25), Vec3.make(Math.PI * 0.25, 0, 0))
        //this.make(Gold, {}, Vec3.make(0, 0, -25), Vec3.make(Math.PI * 0.25, 0, 0))

    }

    _draw() {
        let { g } = this
        g.ctx.fillStyle = Colors.sand
        g.ctx.fillRect(0, 0, 400, 400)
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