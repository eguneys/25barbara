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

abstract class HasTexture implements State {

    constructor(readonly g: Graphics, transform: Vec3 = Vec3.zero) {

        this.lerpables = [
            new Life(),
            new Rigid(transform)
        ]
    }

    get life() {
        return this.lerpables[0] as Life
    }

    get transform() {
        return this.lerpables[1] as Rigid
    }

    lerpables: Lerpable[]



    tx!: number
    ty!: number

    init() {
        [this.tx, this.ty] = this.g.borrow_texture_space()!
        this._init()
    }

    integrate() {
        this._update()
    }

    render() {
        this._pre_draw()
        this._draw()
        this._post_draw()
    }


    _init() {}
    _update() {}
    _draw() {}
    _pre_draw() {}
    _post_draw() {}
}


class Scene extends HasTexture {


    _pre_draw() {
        this.g.clear()
    }


    _draw() {
        let { g } = this
        let { tx, ty } = this
        let a = this.life.x

        g.clear_rect(tx, ty)
        g.ctx.fillStyle = 'gold'
        g.ctx.fillRect(0, 0, 20, 20)
        g.ctx.beginPath()
        g.ctx.arc(64, 64, Math.abs(Math.sin(a)) * 64, 0, Math.PI * 2)
        g.ctx.fill()

        g.push_el(0, 0, Math.sin(a), 0, 0, 0, tx, ty)
    }

    _post_draw() {
        this.g.draw()
    }
}



export default function SceneManager(g: Graphics) {

    g.once()

    let state = new Scene(g)
    my_loop(state)
}