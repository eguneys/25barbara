#version 300 es
precision highp float;

in vec2 v_tex;
uniform sampler2D u_texture;

out vec4 out_color;

void main() {
    vec4 t_color = texture(u_texture, v_tex);
    out_color = vec4(t_color.rgb, 1.0);
}