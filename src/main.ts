import { make_graphics } from './graphics'
//import { SceneManager } from './scenes'
import SceneManager from './scenes2'


function my_app(el: HTMLElement) {

  let g = make_graphics(1920, 1080)

  el.appendChild(g.canvas)

  SceneManager(g)
}


my_app(document.getElementById('app')!)