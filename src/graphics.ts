import vs from './default.vert'
import fs from './default.frag'
import { Billboard, Mat4, Quat, Vec3 } from './math4'

export type TextAlign = 'c'

function load_shader(gl: WebGL2RenderingContext, type: GLenum, source: string) {
  let shader = gl.createShader(type)!
  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  return shader
}

export function make_graphics(width: number, height: number) {

    let canvas = document.createElement('canvas')

    let gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false })!
    const on_resize = () => {
      canvas.width = width
      canvas.height = height
    }

    document.addEventListener('scroll', on_resize, { capture: true, passive: true })
    window.addEventListener('resize', on_resize, { passive: true })
    on_resize()


    let off_canvas = document.createElement('canvas')
    let ctx = off_canvas.getContext('2d')!
    off_canvas.width = 2048
    off_canvas.height = 2048
    ctx.imageSmoothingEnabled = false
 
    return new Graphics(canvas, gl, ctx, new Camera(Vec3.make(0, 70, -160), Vec3.make(0, 0, 0)))
  }

type DrawElement = [Mat4, number, number]

let MAX_NB = 100

export default class Graphics {

  get width() {
    return this.canvas.width
  }

  get height() {
    return this.canvas.height
  }

  els: DrawElement[] = []

  vao: WebGLVertexArrayObject
  i_buff: WebGLBuffer
  a_buff: WebGLBuffer
  canvas_texture: WebGLTexture

  u_matrix_loc: WebGLUniformLocation

  get u_matrix() {
    return this.camera.vp_matrix
  }


  constructor(readonly canvas: HTMLCanvasElement, 
    readonly gl: WebGL2RenderingContext,
    readonly ctx: CanvasRenderingContext2D, 
    readonly camera: Camera) {

    let v = load_shader(gl, gl.VERTEX_SHADER, vs)
    let f = load_shader(gl, gl.FRAGMENT_SHADER, fs)

    let program = gl.createProgram()!
    gl.attachShader(program, v)
    gl.attachShader(program, f)
    gl.linkProgram(program)
    gl.useProgram(program)

    this.vao = gl.createVertexArray()!
    gl.bindVertexArray(this.vao)

    this.a_buff = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.a_buff)
    gl.bufferData(gl.ARRAY_BUFFER, MAX_NB * 5 * 4 * 4, gl.DYNAMIC_DRAW)


    this.i_buff = gl.createBuffer()!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.i_buff)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, MAX_NB * 6 * 4, gl.DYNAMIC_DRAW)

    let stride = 3 * 4 + 2 * 4

    let a_pos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(a_pos)
    gl.vertexAttribPointer(a_pos, 3, gl.FLOAT, false, stride, 0)

    let a_tex = gl.getAttribLocation(program, 'a_tex')
    gl.enableVertexAttribArray(a_tex)
    gl.vertexAttribPointer(a_tex, 2, gl.FLOAT, false, stride, 3 * 4)

    gl.bindVertexArray(null)

    this.u_matrix_loc = gl.getUniformLocation(program, 'u_matrix')!

    this.canvas_texture = gl.createTexture()!
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.canvas_texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    this.available_texture_spaces = []
    for (let x = 0; x < 2048; x+=256) {
      for (let y = 0; y < 2048; y+=256) {
        this.available_texture_spaces.push([x, y])
      }
    }
  }

  available_texture_spaces: [number, number][]

  borrow_texture_space() {
    return this.available_texture_spaces.shift()
  }

  release_texture_space(x: number, y: number) {
    this.available_texture_spaces.push([x, y])
  }

  begin_rect(x: number, y: number) {
    this.ctx.save()
    this.ctx.translate(x, y)
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0)'
    this.ctx.clearRect(0, 0, 256, 256)
  }

  end_rect() {
    this.ctx.restore()
  }

  circle(x: number, y: number, r: number, fill?: string, stroke?: string) {
    if (fill) { this.ctx.fillStyle = fill }
    if (stroke) { this.ctx.strokeStyle = stroke }
    this.ctx.beginPath()
    this.ctx.arc(x, y, r, 0, Math.PI * 2)
    this.ctx.closePath()
    fill && this.ctx.fill()
    stroke && this.ctx.stroke()
  }
  path(definition: string, color: string, line_width = 1) {
    let path = new Path2D(definition)
    this.ctx.strokeStyle = color
    this.ctx.lineWidth = line_width
    this.ctx.stroke(path)
  }

  push_el(rx: number, ry: number, rz: number, x: number, y: number, z: number, tx: number, ty: number, sx: number = 1, sy: number = sx, sz: number = sx) {
    let q = Quat.identity
    .rotateX(rx)
    .rotateY(ry)
    .rotateZ(rz)

    let matrix = Mat4.identity
    .translate(Vec3.make(x, y, z))
    .rotate(q)
    .scale(Vec3.make(256, 256, 128))
    .scale(Vec3.make(sx, sy, sz))
    //.translate(Vec3.make(-1/2, 1/2, -1/2))

    this.els.push([matrix, tx, ty])
  }

  _uni() {
    this.gl.uniformMatrix4fv(this.u_matrix_loc, false, this.u_matrix.out)
  }


  once() {
    this.gl.viewport(0, 0, 1920, 1080)
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0)
    this.gl.enable(this.gl.DEPTH_TEST)
    this.gl.enable(this.gl.BLEND)
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA)
    /* https://stackoverflow.com/questions/9057401/why-is-gl-lequal-recommended-for-the-gl-depth-function-and-why-doesnt-it-work */
    this.gl.depthFunc(this.gl.LEQUAL)
  }

  clear() {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT)
  }


  draw() {
    let { gl } = this

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.canvas_texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.ctx.canvas)

    let nb = this.els.length

    let i_buff_data = new Uint16Array(nb * 6)
    let a_buff_data = new Float32Array(nb * 5 * 4)

    let a_index = 0
    let i_index = 0

    //console.log(this.els[0][0].mVec3(Vec3.zero))
    let zz = this.els
    .sort((a: DrawElement, b: DrawElement) => {
      let bb = b[0].mVec3(Vec3.zero)
      let aa = a[0].mVec3(Vec3.zero)

      if (bb.z === aa.z) {
        return aa.y - bb.y
      } else {
        return bb.z - aa.z
      }

    })

    zz.forEach((el, i) => {

      let [matrix, x, y] = el

      let uv_data = [
        x, y,
        x + 256, y,
        x + 256, y + 256,
        x, y + 256,
      ].map(_ => _ / 2048)

      let { vertex_data, indices } = Billboard.unit.transform(matrix)

      for (let k = 0; k < vertex_data.length; k+=3) {
        a_buff_data[a_index++] = vertex_data[k]
        a_buff_data[a_index++] = vertex_data[k + 1]
        a_buff_data[a_index++] = vertex_data[k + 2]

        a_buff_data[a_index++] = uv_data[k / 3 * 2]
        a_buff_data[a_index++] = uv_data[k / 3 * 2 + 1]
      }

      for (let k = 0; k < indices.length; k++) {
        i_buff_data[i_index++] = i * 4 + indices[k]
      }
    })

    this._uni()

    this.els = []

    gl.bindBuffer(gl.ARRAY_BUFFER, this.a_buff)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, a_buff_data, 0)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.i_buff)
    gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, i_buff_data, 0)

    gl.bindVertexArray(this.vao)
    gl.drawElements(gl.TRIANGLES, nb * 6, gl.UNSIGNED_SHORT, 0)
  }
}


class Camera {


  get v_matrix() {
    return this.c_matrix.inverse ?? Mat4.identity
  }

  get vp_matrix() {
    return this.p_matrix.clone.mul(this.v_matrix)
  }

  //p_matrix = Mat4.perspective(Math.PI*0.4, 16/9, 10, 1000)
  p_matrix = Mat4.perspective_from_frust(Math.PI*0.4, 16/9, 10, 1000)

  get c_matrix() {
    //return Mat4.identity.translate(Vec3.make(100, 100, 500))
    return Mat4.lookAt(this.o, this.l, Vec3.up)
  }

  constructor(readonly o: Vec3, readonly l: Vec3) {}
 
}