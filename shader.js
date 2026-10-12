/* shader.js – erzeugt mit dem Raster-Shader-Werkzeug.
   Zeichnet den Hintergrund in <canvas id="shader">. Lage und Grösse des
   Canvas kommen aus dem CSS der Seite.
   Die Einstellungen stehen ganz unten in dieser Datei. */
   (function () {
    function createShaderBackground(canvas, P) {
      const VERT = `
    attribute vec2 a_pos;
    void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;
    
      const FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    
    uniform float u_dpr, u_time;
    uniform float u_scale, u_stretch, u_warp, u_warpScale, u_bands, u_detail;
    uniform float u_gamma, u_contrast, u_bright, u_drift;
    uniform vec2  u_seed;
    uniform float u_raster, u_shape, u_cell, u_angle, u_gain, u_soft, u_clean;
    uniform vec3  u_ink, u_paper;
    uniform vec2  u_ptr;
    uniform float u_ptrAmt, u_ptrRadius, u_ptrSoft, u_ptrFlow;
    uniform float u_scroll, u_height, u_fadeTop, u_fadeBottom;
    
    // Simplex Noise 3D – Ian McEwan / Ashima Arts (MIT)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    float snoise(vec3 v) {
      const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);
      vec3 g  = step(x0.yzx, x0.xyz);
      vec3 l  = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);
      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;
      i = mod289(i);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));
      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;
      vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);
      vec4 x  = x_ * ns.x + ns.yyyy;
      vec4 y  = y_ * ns.x + ns.yyyy;
      vec4 h  = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);
      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
    
    float fbm(vec3 p) {
      float amp = 0.5, sum = 0.0, total = 0.0;
      for (int i = 0; i < 4; i++) {
        if (float(i) >= u_detail) break;
        sum += amp * snoise(p);
        total += amp;
        p.xy *= 2.03;
        p.z  *= 1.3;
        amp  *= 0.5;
      }
      return sum / total;
    }
    
    // ---- Ebene 1: die Fläche. Liefert Helligkeit 0..1 an einer Stelle (CSS-Pixel).
    float surface(vec2 px) {
      vec2 p = px / 1000.0 * u_scale;
      p.y /= u_stretch;
      p += u_seed;
      p.y -= u_time * u_drift;
    
      vec3 w = vec3(p * u_warpScale, u_time * 0.5);
      vec2 q = vec2(snoise(w), snoise(w + vec3(19.1, 7.3, 3.7)));
      p += u_warp * q;
    
      float n = fbm(vec3(p, u_time * 0.35));
      float v = 0.5 + 0.5 * sin(n * 3.14159265 * u_bands);
      v = pow(clamp(v, 0.0, 1.0), u_gamma);
      v = (v - 0.5) * u_contrast + 0.5 + u_bright;
      v = clamp(v, 0.0, 1.0);
    
      // ---- Zeigerlicht: hebt die Fläche rund um Maus oder Finger an.
      // Der Rand wird mit derselben Verwirbelung verzogen wie die Fläche.
      if (u_ptrAmt > 0.0) {
        vec2  d = (px - u_ptr) / u_ptrRadius;
        float r = length(d + u_ptrFlow * 0.6 * q * length(d)) * (1.0 + u_ptrFlow * 0.5 * n);
        float l = 1.0 - smoothstep((1.0 - u_ptrSoft) * 0.98, 1.0, r);
        v += (1.0 - v) * l * u_ptrAmt;
      }
      return v;
    }
    
    // ---- Randauslauf: 1 in der Bildmitte, 0 am oberen und unteren Canvasrand.
    // sy ist die Höhe über dem unteren Rand in CSS-Pixeln (Bildschirm, nicht Muster).
    float edge(float sy) {
      float f = 1.0;
      if (u_fadeBottom > 0.0) f *= smoothstep(0.0, u_fadeBottom, sy);
      if (u_fadeTop > 0.0)    f *= smoothstep(0.0, u_fadeTop, u_height - sy);
      return f;
    }
    
    // ---- Ebene 2: das Raster.
    void main() {
      vec2 px = gl_FragCoord.xy / u_dpr;
      px.y -= u_scroll;   // Mitscrollen: das Muster wandert mit dem Inhalt
    
      if (u_raster < 0.5) {
        float v = 1.0 - (1.0 - surface(px)) * edge(px.y + u_scroll);
        gl_FragColor = vec4(mix(u_ink, u_paper, v), 1.0);
        return;
      }
    
      float c = cos(u_angle), s = sin(u_angle);
      vec2 g  = vec2(c * px.x + s * px.y, -s * px.x + c * px.y) / u_cell;
      vec2 id = floor(g) + 0.5;
      vec2 q  = g - id;
    
      float T;      // Schwellwert 0..1: ab welcher Dunkelheit dieser Pixel Farbe bekommt
      vec2  sp;     // Messpunkt im Rasterraum
      if (u_shape < 0.5) {
        // Klassischer Rasterpunkt: Punkt -> Schachbrett -> Loch
        T = 0.5 - 0.25 * (cos(6.2831853 * q.x) + cos(6.2831853 * q.y));
        float a = floor(g.x + g.y + 0.5);
        float b = floor(g.x - g.y + 0.5);
        sp = vec2(a + b, a - b) * 0.5;
      } else if (u_shape < 1.5) {
        T = dot(q, q) * 2.0;
        sp = id;
      } else if (u_shape < 2.5) {
        T = abs(q.y) * 2.0;
        sp = vec2(g.x, id.y);
      } else {
        T = abs(q.x) + abs(q.y);
        sp = id;
      }
      if (u_clean < 0.5) sp = g;
    
      vec2 spx = vec2(c * sp.x - s * sp.y, s * sp.x + c * sp.y) * u_cell;
      float k = clamp(1.0 - surface(spx) + u_gain, 0.0, 1.0);
      k *= edge(spx.y + u_scroll);   // zum Rand hin werden die Punkte kleiner und verschwinden
    
      float e = u_soft * 0.5 + 1.2 / (u_cell * u_dpr);
      k = k * (1.0 + 2.0 * e) - e;
      float ink = smoothstep(T - e, T + e, k);
    
      gl_FragColor = vec4(mix(u_paper, u_ink, ink), 1.0);
    }`;
    
      const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
      if (!gl) return null;
    
      function compile(type, src) {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        return sh;
      }
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
    
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'a_pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    
      const FLOATS = ['scale', 'stretch', 'warp', 'warpScale', 'bands', 'detail', 'gamma', 'contrast',
                      'bright', 'drift', 'raster', 'shape', 'cell', 'gain', 'soft', 'clean',
                      'ptrRadius', 'ptrSoft', 'ptrFlow'];
      const U = {};
      FLOATS.concat(['dpr', 'time', 'seed', 'angle', 'ink', 'paper', 'ptr', 'ptrAmt',
                     'scroll', 'height', 'fadeTop', 'fadeBottom'])
        .forEach(function (n) { U[n] = gl.getUniformLocation(prog, 'u_' + n); });
    
      const hex = function (h) {
        return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; });
      };
      const reduced = !P.ignoreReducedMotion &&
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
      let t = P.t0 || 0, last = 0, dpr = 1, dirty = true;
    
      // ---- Mitscrollen: P.scroll ist der Anteil der Scrollstrecke, um den das Bild mitwandert
      const scrollShift = function () {
        return reduced ? 0 : (window.scrollY || 0) * (+P.scroll || 0);
      };
      window.addEventListener('scroll', function () { dirty = true; }, { passive: true });
    
      // ---- Randauslauf: P.fadeTop / P.fadeBottom in CSS-Pixeln (0 = aus).
      // Mit P.fadeTouchOnly nur auf Touch-Geräten, weil Safari auf dem iPhone den
      // fixierten Canvas unter Status- und Browserleiste nicht zeichnet.
      const touch = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
      const fadeOn = function () { return !P.fadeTouchOnly || touch || P.fadePreview ? 1 : 0; };
    
      // ---- Zeigerlicht: x/y ziehen dem Ziel tx/ty nach, a ist die aktuelle Leuchtkraft 0..1
      const ptr = { x: 0, y: 0, tx: 0, ty: 0, a: 0, on: false, seen: false, last: 0 };
      const skip = P.ptrIgnore ? document.querySelector(P.ptrIgnore) : null;
      const skipped = function (el) { return !!(skip && el && el.nodeType && skip.contains(el)); };
    
      function ptrMove(cx, cy, el) {
        if (skipped(el)) return;
        const r = canvas.getBoundingClientRect();
        ptr.tx = cx - r.left;
        ptr.ty = r.height - (cy - r.top);
        if (ptr.a < 0.01) { ptr.x = ptr.tx; ptr.y = ptr.ty; }
        ptr.on = true; ptr.seen = true; ptr.last = performance.now();
      }
    
      // Die Listener hängen am Fenster, weil der Canvas hinter dem Inhalt liegt.
      // Alle sind passiv, das Scrollen wird nicht gebremst.
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'touch') ptrMove(e.clientX, e.clientY, e.target);
      }, { passive: true });
      document.documentElement.addEventListener('mouseleave', function () { ptr.on = false; });
      ['touchstart', 'touchmove'].forEach(function (name) {
        window.addEventListener(name, function (e) {
          const f = e.touches[0];
          if (f) ptrMove(f.clientX, f.clientY, e.target);
        }, { passive: true });
      });
      ['touchend', 'touchcancel'].forEach(function (name) {
        window.addEventListener(name, function (e) {
          if (!e.touches.length && !skipped(e.target)) ptr.on = false;
        }, { passive: true });
      });
    
      function ptrStep(dt, now) {
        if (!P.pointer) return false;
        const goal = ptr.on && (!P.ptrIdle || now - ptr.last < 400) ? 1 : 0;
        const tau = goal > ptr.a ? 0.1 : Math.max(P.ptrFade / 3, 0.01);
        let a = ptr.a + (goal - ptr.a) * (1 - Math.exp(-dt / tau));
        if (Math.abs(goal - a) < 0.003) a = goal;
        const k = P.ptrLag > 0 ? 1 - Math.exp(-dt / (P.ptrLag / 3)) : 1;
        let x = ptr.x + (ptr.tx - ptr.x) * k;
        let y = ptr.y + (ptr.ty - ptr.y) * k;
        if (Math.abs(ptr.tx - x) + Math.abs(ptr.ty - y) < 0.2) { x = ptr.tx; y = ptr.ty; }
        const moved = a !== ptr.a || (a > 0 && (x !== ptr.x || y !== ptr.y));
        ptr.a = a; ptr.x = x; ptr.y = y;
        return moved;
      }
    
      function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width === w && canvas.height === h) return false;
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
        return true;
      }
    
      function draw() {
        gl.uniform1f(U.dpr, dpr);
        gl.uniform1f(U.time, t);
        FLOATS.forEach(function (n) { gl.uniform1f(U[n], +P[n]); });
        gl.uniform1f(U.angle, P.angle * Math.PI / 180);
        gl.uniform2f(U.seed, (P.seed * 12.9898) % 57, (P.seed * 78.233) % 57);
        gl.uniform3fv(U.ink, hex(P.ink));
        gl.uniform3fv(U.paper, hex(P.paper));
        const shift = scrollShift();
        gl.uniform1f(U.scroll, shift);
        gl.uniform1f(U.height, canvas.height / dpr);
        gl.uniform1f(U.fadeTop, fadeOn() * (+P.fadeTop || 0));
        gl.uniform1f(U.fadeBottom, fadeOn() * (+P.fadeBottom || 0));
        gl.uniform2f(U.ptr, ptr.x, ptr.y - shift);   // das Licht bleibt unter dem Zeiger
        gl.uniform1f(U.ptrAmt, P.pointer ? ptr.a * P.ptrStrength : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    
      function frame(now) {
        const dt = Math.min((now - last) / 1000, 0.1);
        last = now;
        const moving = !P.paused && !reduced && P.speed > 0;
        if (moving) t += dt * P.speed;
        const lit = ptrStep(dt, now);
        if (resize() || moving || lit || dirty) { draw(); dirty = false; }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    
      return {
        invalidate: function () { dirty = true; },
        time: function () { return t; },
        // Licht einschalten: an der letzten Zeigerstelle, sonst an der angegebenen
        light: function (cx, cy) {
          if (ptr.seen) { ptr.on = true; ptr.last = performance.now(); }
          else ptrMove(cx, cy, null);
        }
      };
    }
    
      const settings = {
        "scale": 1.79,
        "stretch": 1.8,
        "warp": 0,
        "warpScale": 0.66,
        "bands": 1.17,
        "detail": 3,
        "gamma": 0.58,
        "contrast": 0.83,
        "bright": 0.04,
        "speed": 0.18,
        "drift": 0.18,
        "seed": 9,
        "raster": 1,
        "shape": 1,
        "cell": 6.5,
        "angle": 45,
        "gain": 0.05,
        "soft": 0.17,
        "clean": 1,
        "pointer": 1,
        "ptrRadius": 655,
        "ptrStrength": 0.42,
        "ptrSoft": 0.7,
        "ptrFlow": 0.75,
        "ptrLag": 1.4,
        "ptrFade": 4,
        "ptrIdle": 1,
        "scroll": 0.1,
        "fadeTop": 50,
        "fadeBottom": 50,
        "fadeTouchOnly": 1,
        "ink": "#302528",
        "paper": "#be939e",
        "paused": false,
        "t0": 55.31
      };
    
      function start() {
        const canvas = document.getElementById("shader");
        if (canvas) createShaderBackground(canvas, settings);
      }
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
      else start();
    })();
    