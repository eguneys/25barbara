export class Vec2 {
    static from_angle = (n: number) => new Vec2(Math.cos(n), Math.sin(n))

    static make = (x: number, y: number) => new Vec2(x, y)

    static get zero() { return new Vec2(0, 0) }
    static get unit() { return new Vec2(1, 1) }
    static get half() { return new Vec2(1/2, 1/2) }

    get vs(): [number, number] {
        return [this.x, this.y]
    }


    get half() {
        return new Vec2(this.x/ 2, this.y/2)
    }

    get length_squared() {
        return this.x * this.x + this.y * this.y
    }


    get length() {
        return Math.sqrt(this.length_squared)
    }


    get normalize() {
        return this.length === 0 ? Vec2.zero : this.scale(1/ this.length)
    }

    get perpendicular() {
        return new Vec2(-this.y, this.x)
    }

    get clone() {
        return new Vec2(this.x, this.y)
    }

    get angle() {
        return Math.atan2(this.y, this.x)
    }

    constructor(public x: number, public y: number) {}


    dot(v: Vec2) {
        return this.x * v.x + this.y * v.y
    }

    cross(v: Vec2) {
        return this.x * v.y - this.y * v.x
    }

    distance(v: Vec2) {
        return this.sub(v).length
    }

    scale(n: number) {
        return new Vec2(this.x * n, this.y * n)
    }

    add(v: Vec2) {
        return new Vec2(this.x + v.x, this.y + v.y)
    }

    sub(v: Vec2) {
        return new Vec2(this.x - v.x, this.y - v.y)
    }

    mul(v: Vec2) {
        return new Vec2(this.x * v.x, this.y * v.y)
    }


    add_angle(n: number) {
        return Vec2.from_angle(this.angle + n)
    }
}

export class Circle {
    static make = (x: number, y: number, r: number) => new Circle(Vec2.make(x, y), r)


    static get unit() { return Circle.make(0, 0, 1)}

    scale(n: number) { return Circle.make(this.o.x, this.o.y, this.r * n) }


    constructor(public o: Vec2, public r: number) {}
}



export class Matrix {

  static get identity() { return new Matrix(1, 0, 0, 1, 0, 0) }

  static get unit() { return Matrix.identity }

  static projection = (width: number, height: number) => {
    let b = 0,
      c = 0 

    let a = 1 / width * 2,
      d = -1 / height * 2,
      tx = -1,
      ty = 1 

    return new Matrix(a, b, c, d, tx, ty)
  }


  get clone(): Matrix {
    let { a, b, c, d, tx, ty } = this
    return new Matrix(a,b,c,d,tx,ty)
  }


  get inverse(): Matrix {
    let { a, b, c, d, tx, ty } = this

    let n = a * d - b * c

    let a1 = d / n,
      b1 = -b / n,
      c1 = -c / n,
      d1 = a / n,
      tx1 = (c * ty - d * tx) / n,
      ty1 = -(a * ty - b * tx) / n

    return new Matrix(a1, b1, c1, d1, tx1, ty1)
  }

  readonly array_t: Float32Array

  // a c tx
  // b d ty
  // 0 0 1
  constructor(
    public a: number,
    public b: number,
    public c: number,
    public d: number,
    public tx: number,
    public ty: number) {
    this.array_t = new Float32Array([
      a, b, 0,
      c, d, 0,
      tx, ty, 1
    ])
  }

  rotate(r: number): Matrix {

    let cosa = Math.cos(r),
      sina = Math.sin(r)

    let a = this.a * cosa - this.b * sina,
      b = this.a * sina + this.b * cosa,
      c = this.c * cosa - this.d * sina,
      d = this.c * sina + this.d * cosa,
      tx = this.tx * cosa - this.ty * sina,
      ty = this.tx * sina + this.ty * cosa

    this.a = a
    this.b = b
    this.c = c
    this.d = d
    this.tx = tx
    this.ty = ty
    return this
  }

  translate(x: number, y: number): Matrix {

    let tx = x + this.tx,
      ty = y + this.ty

    this.tx = tx
    this.ty = ty
    return this
  }

  scale(x: number, y: number) {
    this.a = x
    this.d = y
    return this
  }

  mVec2(v: Vec2): Vec2 {

    let a = this.a,
      b = this.b,
      c = this.c,
      d = this.d,
      tx = this.tx,
      ty = this.ty

    let x = a * v.x + c * v.y + tx,
      y = b * v.x + d * v.y + ty

    return Vec2.make(x, y)
  }


  mul(m: Matrix) {
    let { a, b, c, d, tx, ty } = this

    this.a = m.a * a + m.b * c
    this.b = m.a * b + m.b * d
    this.c = m.c * a + m.d * c
    this.d = m.c * b + m.d * d

    this.tx = m.tx * a + m.ty * c + tx
    this.ty = m.tx * b + m.ty * d + ty
  }

  transform_in(scale: Vec2, rotation: number, translate: Vec2, pivot: Vec2 = Vec2.half) {

    /*
    this.set_in(Matrix.unit)
    this.translate_in(-0.5, -0.5)
    this.scale_in(scale.x, scale.y)
    this.translate_in(0.5, 0.5)
    this.translate_in(-scale.x*0.5, -scale.y*0.5)
    this.rotate_in(rotation)
    //this.translate_in(scale.x * 0.5, scale.y * 0.5)
    this.translate_in(translate.x, translate.y)
   */

   this.a = Math.cos(rotation) * scale.x
   this.b = Math.sin(rotation) * scale.x
   this.c = - Math.sin(rotation) * scale.y
   this.d = Math.cos(rotation) * scale.y

   this.tx = translate.x - (pivot.x * this.a + pivot.y * this.c)
   this.ty = translate.y - (pivot.x * this.b + pivot.y * this.d)
  }

}

export class Quad {

  static make = (tw: number,
                 th: number,
  x: number,
                 y: number,
  w: number,
  h: number) => new Quad(tw, th, Rectangle.make(x, y, w, h))

  readonly uv_data: Float32Array
  readonly frame: Rectangle

  get w(): number { return this._frame.w }
  get h(): number { return this._frame.h }

  get x0(): number { return this.frame.x }
  get y0(): number { return this.frame.y }

  get x1(): number { return this.frame.x2 }
  get y1(): number { return this.y0 }

  get x2(): number { return this.x1 }
  get y2(): number { return this.frame.y2 }

  get x3(): number { return this.x0 }
  get y3(): number { return this.y2 }

  constructor(readonly tw: number, readonly th: number, readonly _frame: Rectangle) {

    this.frame = _frame.transform(
      Matrix.unit.scale(1/this.tw,
                        1/this.th))

                        this.uv_data = new Float32Array([
                          this.x0,
                          this.y0,
                          this.x1,
                          this.y1,
                          this.x2,
                          this.y2,
                          this.x3,
                          this.y3,
                        ])

  }
}

export class Rectangle {

  static make = (x: number, y: number,
    w: number, h: number) => new Rectangle([
      Vec2.make(x, y),
      Vec2.make(x + w, y),
      Vec2.make(x + w, y + h),
      Vec2.make(x, y + h)
    ])


  static get unit() { return Rectangle.make(0, 0, 1, 1) }


  get vs() { 
    let { x, y, w, h } = this
    return [x, y, w, h] 
  }

  
  get x1() { return this.vertices[0].x }
  get y1() { return this.vertices[0].y }
  get x2() { return this.vertices[2].x }
  get y2() { return this.vertices[2].y }

  get x() { return this.x1 }
  get y() { return this.y1 }
  get w() { return this.x2 - this.x1 }
  get h() { return this.y2 - this.y1 }

  get center() {
    return Vec2.make(this.x + this.w / 2,
                     this.y + this.h / 2)
  }

  get vertex_data(): Float32Array {
    return new Float32Array(
      this.vertices.flatMap(_ =>
                            _.vs))
  }

  get indices(): Uint16Array {
    return new Uint16Array([0, 1, 2, 0, 2, 3])
  }


  larger(r: number) {
    return Rectangle.make(this.x - r, this.y - r,
                          this.w + r, this.h + r)
  }

  constructor(readonly vertices: Array<Vec2>) {}

  transform(m: Matrix): Rectangle {
    return new Rectangle(this.vertices.map(_ => m.mVec2(_)))
  }
}