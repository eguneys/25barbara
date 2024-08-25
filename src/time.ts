const Time = {
  rem_dt: 0,
  dt: 0.025,
  time: 0,
  t_slow: 0,
  on_interval(interval: number, offset = 0) {
    let { dt, time } = this

    let last = Math.floor((time - offset - dt) / interval)
    let next = Math.floor((time - offset) / interval)
    return last < next
  }
}

export type Lerpable = {
  integrate(): Lerpable
  lerp(next_state: Lerpable, alpha: number): Lerpable,
}

export interface State {
  lerpables: Lerpable[],
  integrate(): void,
  render(): void
}

export function my_loop(current_state: State) {

  let last_t: number | undefined
  const step = (t: number) => {
    let frame_time = t - (last_t ?? t)
    if (frame_time > 0.025) { frame_time = 0.025 }

    last_t = t

    Time.rem_dt += frame_time

    current_state.integrate()
    while (Time.rem_dt >= Time.dt) {
      current_state.lerpables = current_state.lerpables.map(_ => _.integrate())
      Time.time += Time.dt
      Time.rem_dt -= Time.dt
    }
    let next_state_lerpables = current_state.lerpables.map(_ => _.integrate())

    let alpha = Time.rem_dt / Time.dt

    let render_state_lerpables = current_state.lerpables.map((_, i) => _.lerp(next_state_lerpables[i], alpha))

    let cache = current_state.lerpables 
    current_state.lerpables = render_state_lerpables
    current_state.render()
    current_state.lerpables = cache

    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}


export default Time