#version 300 es
in vec4 a_pos;
in vec2 a_tex;

out vec2 v_tex;

uniform mat4 u_matrix;

void main() {
    gl_Position = u_matrix * a_pos;
    v_tex = a_tex;
}