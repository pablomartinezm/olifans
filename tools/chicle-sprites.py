# Sprites de «Flappy Chicle»: genera el bloque SPR de lib/chicle-art.ts.
#   python3 tools/chicle-sprites.py            → reescribe el bloque SPR
#   python3 tools/chicle-sprites.py preview.png → además, hoja de vista previa (necesita Pillow)
# Cada cara se pinta por capas sobre una cabeza común de 16 de ancho y el contorno sale solo.
# Para añadir a alguien (Marc, Sergio...): una función como las de abajo + su entrada en SPRITES y ORDER.
import sys
class G:
    def __init__(s, w, h): s.w, s.h = w, h; s.g = [['.'] * w for _ in range(h)]
    def put(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = c
    def get(s, x, y): return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else '.'
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, c)
    def sym(s, x, y, c): s.put(x, y, c); s.put(s.w - 1 - x, y, c)
    def symrect(s, x0, y0, x1, y1, c): s.rect(x0, y0, x1, y1, c); s.rect(s.w - 1 - x1, y0, s.w - 1 - x0, y1, c)
    def stamp(s, x0, y0, rows):
        for j, r in enumerate(rows):
            for i, c in enumerate(r):
                if c != ' ': s.put(x0 + i, y0 + j, c if c != '_' else '.')
    def spans(s, y0, spans, c):
        for i, (a, b) in enumerate(spans):
            for x in range(a, b + 1): s.put(x, y0 + i, c)
    def outline(s, c='o'):
        add = [(x, y) for y in range(s.h) for x in range(s.w) if s.g[y][x] == '.' and
               any(s.get(x + dx, y + dy) not in '.' + c for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
        for x, y in add: s.g[y][x] = c
    def rows(s): return [''.join(r) for r in s.g]

# Cabeza de 16 de ancho (columnas 2-17), filas 1-17; orejas en 1 y 18.
HEAD = [(6, 13), (4, 15), (3, 16), (2, 17), (2, 17), (2, 17), (2, 17), (2, 17), (2, 17), (2, 17), (2, 17), (2, 17), (3, 16), (3, 16), (4, 15), (5, 14), (7, 12)]
def head(skin='s', h=32):
    g = G(20, h)
    g.spans(1, HEAD, skin)
    g.symrect(1, 9, 1, 11, 'd')          # orejas
    g.rect(7, 18, 12, 19, 's')           # cuello
    g.rect(8, 18, 11, 18, 'd')
    return g
def eyes(g, kind='open', y=8):
    if kind == 'open':
        for x in (6, 12): g.stamp(x, y, ["we", "ee"])
    elif kind == 'squint':
        for x in (6, 12): g.stamp(x, y + 1, ["ee"])
        g.put(5, y + 1, 'e'); g.put(14, y + 1, 'e')
    elif kind == 'blue':
        for x in (6, 12): g.stamp(x, y, ["wi", "ei"])
    elif kind == 'crazy':
        g.stamp(5, y - 1, ["www", "wew", "www"]); g.stamp(12, y, ["ww", "ew"])
def brows(g, c='B', y=6, thick=False):
    g.symrect(5, y, 7, y, c)
    if thick: g.symrect(5, y + 1, 5, y + 1, c)
def nose(g, y=10):
    g.put(10, y, 'd'); g.rect(9, y + 1, 10, y + 1, 'd')
def blush(g, y=11): g.sym(4, y, 'r')
def grin(g, y=12, wide=0, open_=False):
    g.rect(6 - wide, y, 13 + wide, y, 't'); g.put(6 - wide, y, 'm'); g.put(13 + wide, y, 'm')
    g.rect(7 - wide, y + 1, 12 + wide, y + 1, 'm' if open_ else 't')
    if open_: g.rect(8, y + 2, 11, y + 2, 'n'); g.rect(7, y + 2, 7, y + 2, 'm'); g.rect(12, y + 2, 12, y + 2, 'm')
    else: g.rect(7 - wide, y + 2, 12 + wide, y + 2, 'd')
def body(g, y=20, arms='s', kick=False):
    g.spans(y, [(3, 16), (2, 17), (2, 17), (2, 17), (2, 17), (2, 17), (3, 16)], 'c')
    g.symrect(2, y + 1, 3, y + 5, 'C'); g.symrect(4, y + 1, 4, y + 5, 'C')
    g.symrect(2, y + 5, 3, y + 6, arms)  # manos
    if kick:  # pataleo al soplar: piernas abiertas
        g.rect(5, y + 7, 14, y + 7, 'p')
        g.rect(4, y + 8, 7, y + 8, 'p'); g.rect(12, y + 8, 15, y + 8, 'p')
        g.rect(3, y + 9, 6, y + 9, 'P'); g.rect(13, y + 9, 16, y + 9, 'P')
        g.rect(1, y + 10, 5, y + 10, 'f'); g.rect(14, y + 10, 18, y + 10, 'f')
        return
    g.rect(5, y + 7, 9, y + 9, 'p'); g.rect(10, y + 7, 14, y + 9, 'p'); g.rect(9, y + 7, 10, y + 9, '.')
    g.rect(5, y + 9, 8, y + 9, 'P'); g.rect(11, y + 9, 14, y + 9, 'P')
    g.rect(4, y + 10, 8, y + 10, 'f'); g.rect(11, y + 10, 15, y + 10, 'f')
def ko(g, skin='s'):
    # ojos en X (encima de lo que haya, gafas incluidas) y boca abierta
    for x in (5, 12):
        g.rect(x, 7, x + 2, 9, skin); g.stamp(x, 7, ["e e", " e ", "e e"])
    g.stamp(8, 12, ["mmmm", "mnnm", "mmmm"])
BASE = {"o": "#2a1812", "e": "#2a1812", "s": "#efb896", "d": "#d9967a", "l": "#f9d2b4", "r": "#f09a8a",
        "t": "#fdf6ec", "m": "#6e2630", "n": "#d77d74", "w": "#ffffff", "p": "#2e4577", "P": "#1f2f52", "f": "#2a1812"}
def S(grid_, **pal):
    grid_.outline(); rows = grid_.rows()
    while rows and set(rows[-1]) == {'.'}: rows.pop()
    return {"rows": rows, "pal": {**BASE, **pal}}

def gon(kick=False, ko_=False):
    g = head()
    g.spans(1, [(6, 13), (4, 15), (3, 16), (2, 17), (2, 17)], 'h')        # pelo corto con algo de tupé
    g.stamp(5, 1, ["HHH"]); g.stamp(4, 2, ["HH"]); g.symrect(2, 6, 2, 7, 'h')
    brows(g, 'B', 6)
    # gafas redondas gruesas
    for x in (5, 11):
        g.stamp(x, 7, [" gggg ", "gvwevg", "gveevg", " gggg "])
    g.rect(9, 8, 10, 8, 'g'); g.symrect(2, 8, 4, 8, 'g')
    nose(g, 11)
    # carcajada con barba clara
    g.spans(12, [(2, 17), (2, 17), (3, 16), (3, 16), (4, 15), (5, 14)], 'b')
    g.stamp(6, 12, ["mttttttm", " mmmmmm ", "  nnnn  "])
    g.stamp(6, 11, ["bbbbbbbb"])
    g.rect(7, 18, 12, 19, 's')
    body(g, kick=kick); g.stamp(8, 20, ["k  k"]); g.stamp(8, 21, ["k  k"])
    if ko_: ko(g)
    return S(g, h="#a0805a", H="#c4a276", b="#b38556", B="#6e5238", g="#1d1b20", v="#a9bfcf", c="#3a74b8", C="#2a5590", k="#e8e8e8")

def marcos(kick=False, ko_=False):
    g = head()
    g.spans(0, [(5, 13), (4, 15), (3, 16), (2, 17), (2, 17), (2, 17)], 'h')  # pelo hacia arriba con volumen
    g.stamp(6, 0, ["HHHH"]); g.stamp(5, 1, ["HHH  HH"]); g.symrect(2, 6, 2, 8, 'h')
    g.put(2, 5, 'h'); g.put(17, 5, 'h')
    brows(g, 'B', 6, thick=True)
    eyes(g, 'open')
    nose(g)
    g.spans(11, [(2, 3), (2, 4), (3, 16), (3, 16), (4, 15), (5, 14)], 'b')   # barba de tres días
    g.symrect(15, 11, 17, 12, 'b')
    grin(g, 12)
    g.rect(7, 11, 12, 11, 'b')
    body(g, kick=kick)
    if ko_: ko(g)
    return S(g, h="#3b2619", H="#5a3a26", b="#7a5440", B="#2a1a12", c="#d4a03a", C="#a87a24")

def hugo(kick=False, ko_=False):
    g = head()
    g.spans(1, [(6, 13), (4, 15), (3, 16), (2, 17), (2, 17)], 'h')
    g.stamp(3, 5, ["hhh hhhhhhh"]); g.stamp(4, 6, ["h  hh hh"])        # flequillo de puntas
    g.symrect(2, 5, 2, 8, 'h')
    # gafas de sol doradas apoyadas en el pelo
    g.stamp(3, 1, [" yyyyyyyyyyyy ", "yzzzzyyyyzzzzy", "yzZzzy  yzZzzy", " yyyy    yyyy "])
    brows(g, 'B', 7)
    eyes(g, 'squint')
    nose(g)
    blush(g)
    grin(g, 12, wide=1)
    body(g, kick=kick); g.stamp(4, 20, ["kk"]); g.stamp(5, 21, ["kk"]); g.stamp(6, 22, ["kk"]); g.stamp(7, 23, ["kk"]); g.stamp(8, 24, ["kk"]); g.stamp(9, 25, ["kk"])
    if ko_: ko(g)
    return S(g, h="#1f1612", H="#3a2a20", y="#e8b84a", z="#3a2a10", Z="#8a6a2a", B="#1f1612", c="#f2efe8", C="#d2cdc0", k="#18181c")

def arro(kick=False, ko_=False):
    g = head()
    g.spans(1, [(6, 13), (4, 15), (3, 16), (2, 17), (2, 17)], 'h')
    g.symrect(2, 6, 2, 9, 'h'); g.put(3, 5, 'h'); g.put(16, 5, 'h')
    # gafas de sol negras subidas a la cabeza
    g.stamp(4, 2, ["zzzzz  zzzzz", "zZzzz  zZzzz", " zzz    zzz "]); g.rect(9, 2, 10, 2, 'z')
    brows(g, 'B', 6, thick=True)
    eyes(g, 'open')
    nose(g)
    g.spans(11, [(2, 17), (2, 17), (3, 16), (3, 16), (4, 15), (5, 14), (7, 12)], 'b')  # barba corta poblada
    g.rect(5, 10, 14, 10, 's')
    grin(g, 12)
    g.rect(7, 11, 12, 11, 'B')
    body(g, kick=kick)
    if ko_: ko(g)
    g.rect(13, 13, 17, 13, 'W'); g.put(18, 13, 'O'); g.put(17, 13, 'A')         # el cigarro: siempre en la boca
    return S(g, h="#2e2018", H="#4a3426", z="#141418", Z="#4a4a58", b="#3a2a20", B="#24180f", c="#b8bcc6", C="#8e93a0", W="#f4f1ea", O="#ff7a2a", A="#9a9a9a")

def ricky(kick=False, ko_=False):
    g = head()
    g.stamp(6, 2, ["llll"]); g.stamp(5, 3, ["ll"])                            # calva con brillo
    brows(g, 'B', 7)
    eyes(g, 'open', 8)
    nose(g)
    g.stamp(5, 11, ["bbbbbbbbbb", "b        b"])                            # bigote
    g.stamp(7, 13, ["tttttt"]); g.put(6, 13, 'm'); g.put(13, 13, 'm')
    g.put(9, 16, 'd')
    g.spans(20, [(3, 16), (2, 17), (2, 17)], 'c')                             # camiseta de tirantes
    g.symrect(2, 20, 4, 22, 's'); g.symrect(3, 22, 3, 22, 'd')               # brazos al aire
    g.rect(6, 20, 13, 20, 's'); g.rect(6, 20, 13, 20, 'k'); g.rect(9, 21, 10, 21, 'K')  # cadena
    g.put(5, 19, 'k'); g.put(14, 19, 'k')
    g.rect(4, 23, 15, 23, 'p')                                                  # vaqueros, piernas cortas
    if kick: g.rect(3, 24, 6, 24, 'p'); g.rect(13, 24, 16, 24, 'p'); g.rect(1, 25, 5, 25, 'f'); g.rect(14, 25, 18, 25, 'f')
    else: g.rect(5, 24, 8, 24, 'p'); g.rect(11, 24, 14, 24, 'p'); g.rect(4, 25, 8, 25, 'f'); g.rect(11, 25, 15, 25, 'f')
    if ko_: ko(g, 's')
    return S(g, s="#f2b8a0", d="#dc9a84", l="#ffe6d8", b="#8a5a3a", B="#7a5236", k="#cfd3db", K="#9aa0aa", c="#f2efe8")

def javi(kick=False, ko_=False):
    g = head()
    g.spans(1, [(6, 13), (4, 15), (3, 16), (2, 17)], 'h')                    # corto, tupé hacia un lado
    g.stamp(5, 1, ["HHHHH"]); g.stamp(4, 2, ["HHH"]); g.symrect(2, 5, 2, 7, 'h'); g.put(3, 5, 'h'); g.put(16, 5, 'h')
    brows(g, 'B', 7)
    eyes(g, 'blue')
    nose(g)
    g.spans(12, [(2, 3), (3, 4), (4, 15), (5, 14), (7, 12)], 'b')
    g.symrect(15, 12, 16, 13, 'b')
    grin(g, 12, wide=1)
    body(g, kick=kick)
    if ko_: ko(g)
    return S(g, h="#9a6e44", H="#c08d5a", B="#6e4a2c", i="#5f93c0", b="#d0a888", c="#24262c", C="#141518")

def moreno(kick=False, ko_=False):
    g = head()
    g.spans(0, [(4, 14), (3, 16), (2, 17), (2, 17), (2, 17), (2, 17)], 'h')  # pelo negro abundante y revuelto
    g.stamp(3, 0, ["H  HH   H"]); g.stamp(4, 1, ["HH   HH"]); g.symrect(2, 6, 2, 8, 'h')
    g.put(1, 3, 'h'); g.put(18, 2, 'h')
    brows(g, 'B', 6, thick=True)
    eyes(g, 'crazy')
    nose(g)
    g.spans(11, [(2, 17), (2, 17), (3, 16), (3, 16), (4, 15), (5, 14), (7, 12)], 'b')
    g.rect(5, 10, 14, 10, 's')
    grin(g, 12, wide=1)
    g.stamp(8, 15, ["GG"]); g.stamp(11, 16, ["G"])
    g.rect(7, 18, 12, 18, 'q'); g.put(9, 19, 'Q')
    body(g, kick=kick)
    if ko_: ko(g)
    return S(g, h="#1c130e", H="#3a281c", B="#120c08", b="#2a1c14", G="#8a8078", q="#c0302a", Q="#e0e0e0", c="#f2efe8", C="#d2cdc0")

def sanlle():
    g = head("s")
    g.symrect(1, 8, 1, 11, 'd'); g.symrect(0, 9, 0, 10, 'd')                    # orejas de soplillo
    g.spans(0, [(6, 13), (4, 15), (3, 16), (3, 16)], 'h')                        # rizos apretados arriba
    for y, (a, b) in enumerate([(6, 13), (4, 15), (3, 16), (3, 16)]):
        for x in range(a, b + 1):
            if (x + 2 * y) % 3 == 0: g.put(x, y, 'H')
    g.put(5, 0, 'h'); g.put(14, 0, 'h')
    g.symrect(2, 4, 2, 6, 'f'); g.symrect(3, 4, 3, 4, 'f')                     # degradado a los lados
    brows(g, 'B', 6)
    eyes(g, 'squint')
    nose(g)
    g.spans(12, [(2, 4), (3, 16), (3, 16), (4, 15), (5, 14), (7, 12)], 'b')
    g.symrect(15, 12, 17, 12, 'b')
    grin(g, 12, wide=1)
    g.rect(9, 11, 10, 11, 'w')
    return S(g, h="#16100c", H="#3a2c22", f="#5a4636", s="#d89a70", d="#b87b54", l="#e8b48c", b="#5a4030", B="#1a120d")

def uli_body(g, y=20, kick=False):
    g.spans(y, [(3, 16), (2, 17), (2, 17), (2, 17), (2, 17), (2, 17), (3, 16)], 'c')
    g.rect(6, y, 13, y, 'b')                                       # la barba cae sobre el cuello
    g.rect(9, y + 1, 10, y + 6, 'C')                               # botonadura
    g.symrect(2, y + 1, 3, y + 2, 'C')                             # manga corta
    g.symrect(2, y + 3, 3, y + 5, 's'); g.symrect(3, y + 5, 3, y + 5, 'd')
    for x, dy, c in ((5, 1, 'k'), (6, 2, 'K'), (13, 1, 'f'), (14, 3, 'k'), (15, 4, 'K'), (6, 5, 'f'), (12, 4, 'k'), (12, 5, 'K'), (7, 3, 'f')):
        g.put(x, y + dy, c)
    g.rect(4, y + 7, 15, y + 9, 'q'); g.rect(4, y + 9, 15, y + 9, 'Q'); g.rect(9, y + 8, 10, y + 9, '.')  # bermudas
    if kick:  # pataleo al soplar
        for i, (lx, rx) in enumerate(((5, 12), (4, 13), (3, 14))):
            c = 'w' if i == 2 else 's'
            g.rect(lx, y + 10 + i, lx + 2, y + 10 + i, c); g.rect(rx, y + 10 + i, rx + 2, y + 10 + i, c)
        g.rect(1, y + 13, 4, y + 13, 'z'); g.rect(15, y + 13, 18, y + 13, 'z')
    else:     # piernas colgando
        g.rect(5, y + 10, 7, y + 12, 's'); g.rect(12, y + 10, 14, y + 12, 's')
        g.rect(7, y + 10, 7, y + 12, 'd'); g.rect(14, y + 10, 14, y + 12, 'd')
        g.rect(5, y + 13, 7, y + 13, 'w'); g.rect(12, y + 13, 14, y + 13, 'w')
        g.rect(4, y + 14, 7, y + 14, 'z'); g.rect(12, y + 14, 15, y + 14, 'z')

ULI_PAL = dict(h="#33211a", H="#4a3024", b="#40281e", B="#2a1a14", g="#2f2f36", v="#dcf0ff", c="#cbe8c0", C="#a0ce9e", k="#43ab8e", K="#1f7a68", f="#f3a84f", q="#c9a86a", Q="#a8884f", z="#e4574a")

def uli(kick=False):
    g = head(h=37)
    g.spans(1, [(6, 13), (4, 15), (3, 16), (2, 17), (2, 17)], 'h')
    g.stamp(6, 2, ["HHH  H"]); g.symrect(2, 6, 2, 9, 'h')
    # gafas grandes de pasta
    for x in (4, 11):
        g.stamp(x, 7, ["ggggg", "gvwvg", "gveeg", "ggggg"])
    g.rect(9, 8, 10, 8, 'g'); g.symrect(2, 8, 3, 8, 'g')
    g.spans(11, [(2, 17), (2, 17), (2, 17), (3, 16), (3, 16), (4, 15), (5, 14), (7, 12)], 'b')  # barbaza
    g.rect(5, 11, 14, 11, 'b'); g.rect(8, 11, 11, 11, 's')
    g.put(10, 11, 'd')
    g.rect(9, 13, 10, 13, 'n'); g.put(9, 13, 'm')
    g.stamp(4, 15, ["B  B  B  B"]); g.stamp(6, 17, ["B B"])
    uli_body(g, 20, kick)
    return S(g, **ULI_PAL)

def uli_ko():
    g = head(h=37)
    g.spans(1, [(6, 13), (4, 15), (3, 16), (2, 17), (2, 17)], 'h')
    g.stamp(6, 2, ["HHH  H"]); g.symrect(2, 6, 2, 9, 'h')
    for x in (5, 12): g.stamp(x, 7, ["e e", " e ", "e e"])                      # ojos en X, sin gafas
    g.spans(11, [(2, 17), (2, 17), (2, 17), (3, 16), (3, 16), (4, 15), (5, 14), (7, 12)], 'b')
    g.rect(5, 11, 14, 11, 'b'); g.rect(8, 11, 11, 11, 's'); g.put(10, 11, 'd')
    g.stamp(8, 12, ["mmmm", "mnnm", "mmmm"])                                        # boca abierta
    g.stamp(4, 15, ["B  B  B  B"]); g.stamp(6, 17, ["B B"])
    uli_body(g, 20)
    return S(g, **ULI_PAL)

def gorila(air=False, ko_=False):
    g = G(30, 38)
    head_ = sanlle()
    for y, r in enumerate(head_["rows"][:19]):
        for x, c in enumerate(r):
            if c not in '.o': g.put(x + 5, y, c)
    if ko_:
        for x in (10, 17):
            g.rect(x, 7, x + 2, 9, 's'); g.stamp(x, 7, ["e e", " e ", "e e"])
        g.stamp(13, 12, ["mmmm", "mnnm", "mmmm"])
    y0 = 17
    g.spans(y0, [(9, 20), (6, 23), (4, 25), (3, 26)], 'G')                         # hombros y cuello de gorila
    g.spans(y0 + 4, [(6, 23)] * 6 + [(7, 22)] * 3, 'G')                              # tronco
    g.spans(y0 + 3, [(10, 19), (9, 20), (9, 20), (9, 20), (10, 19), (11, 18)], 'k')  # pecho
    g.rect(11, y0 + 5, 13, y0 + 5, 'K'); g.rect(16, y0 + 5, 18, y0 + 5, 'K')        # pectorales
    g.spans(y0 + 9, [(12, 17), (13, 16)], 'k')                                       # barriga
    g.rect(5, y0 + 2, 8, y0 + 3, 'H'); g.rect(21, y0 + 2, 24, y0 + 3, 'H')          # luz en los hombros
    if air:  # brazos arriba, puños cerrados junto a la cabeza
        g.rect(1, 6, 5, y0 + 4, 'G'); g.rect(24, 6, 28, y0 + 4, 'G')
        g.rect(2, 8, 2, y0 + 2, 'H'); g.rect(27, 8, 27, y0 + 2, 'H')
        g.rect(1, 3, 5, 6, 'j'); g.rect(24, 3, 28, 6, 'j')
        g.rect(9, y0 + 13, 12, y0 + 16, 'G'); g.rect(17, y0 + 13, 20, y0 + 16, 'G')      # piernas colgando
        g.rect(8, y0 + 17, 12, y0 + 18, 'j'); g.rect(17, y0 + 17, 21, y0 + 18, 'j')
    else:    # en el suelo: brazos largos con los nudillos abajo y piernas arqueadas
        g.rect(0, y0 + 4, 5, y0 + 15, 'G'); g.rect(24, y0 + 4, 29, y0 + 15, 'G')
        g.rect(1, y0 + 5, 1, y0 + 13, 'H'); g.rect(28, y0 + 5, 28, y0 + 13, 'H')
        g.rect(0, y0 + 16, 5, y0 + 18, 'j'); g.rect(24, y0 + 16, 29, y0 + 18, 'j')
        g.rect(6, y0 + 6, 6, y0 + 18, '.'); g.rect(23, y0 + 6, 23, y0 + 18, '.')     # el contorno separa brazos y tronco
        g.rect(8, y0 + 13, 11, y0 + 16, 'G'); g.rect(18, y0 + 13, 21, y0 + 16, 'G')
        g.rect(7, y0 + 17, 12, y0 + 18, 'j'); g.rect(17, y0 + 17, 22, y0 + 18, 'j')
    pal = {**head_["pal"], "G": "#565664", "H": "#8a8a9c", "k": "#a8989e", "K": "#86767e", "j": "#2c2830"}
    return S(g, **pal)

def barril():
    g = G(28, 20)
    g.spans(1, [(3, 24), (2, 25), (2, 25), (1, 26), (1, 26), (1, 26), (1, 26), (1, 26), (1, 26), (1, 26), (1, 26), (1, 26), (1, 26), (2, 25), (2, 25), (3, 24)], 'b')
    for x in (7, 14, 21): g.rect(x, 1, x, 16, 'B')
    g.rect(1, 4, 26, 5, 'k'); g.rect(1, 4, 26, 4, 'K'); g.rect(1, 12, 26, 13, 'k'); g.rect(1, 12, 26, 12, 'K')
    g.rect(2, 6, 3, 11, 'l'); g.rect(24, 6, 25, 11, 'd'); g.rect(3, 1, 24, 1, 'B'); g.rect(3, 16, 24, 16, 'B')
    return S(g, b="#9a6236", B="#6e4428", l="#c08a52", d="#7a4a28", k="#3e3e46", K="#7a7a86")

def tapa():
    g = G(28, 6)
    g.spans(1, [(5, 22), (3, 24), (3, 24)], 'W'); g.rect(6, 2, 21, 2, 'w'); g.rect(5, 3, 22, 3, 'W')
    return S(g, W="#c08a52", w="#9a6236")

def billete():
    g = G(13, 9)
    g.rect(1, 1, 11, 7, 'G'); g.rect(2, 2, 10, 6, 'g'); g.rect(5, 3, 7, 5, 'G'); g.put(6, 4, 'g'); g.put(2, 2, 'G'); g.put(10, 6, 'G')
    return S(g, G="#4f9a5c", g="#9ad7a8", o="#1f4a28")

def arpa():
    g = G(16, 24)
    g.rect(1, 2, 2, 21, 'y'); g.rect(1, 2, 1, 21, 'Y')
    g.spans(1, [(1, 5), (1, 8), (3, 11), (8, 13)], 'y')
    for i, x in enumerate((4, 6, 8, 10, 12)):
        g.rect(x, 3 + (x > 9), x, 21 - i * 3, 'l')
    for y in range(4, 22):
        g.put(min(14, 13 - (y - 4) * 10 // 17 + 1), y, 'y')
    g.rect(1, 21, 6, 22, 'y')
    return S(g, y="#e0b040", Y="#f5d66a", l="#f6ead2")

def novia():
    g = G(12, 10)
    g.rect(1, 0, 10, 3, 'k'); g.rect(1, 3, 10, 3, 'K')
    g.rect(2, 4, 9, 7, 's'); g.rect(3, 7, 3, 8, 'q'); g.rect(5, 7, 5, 8, 'q'); g.rect(7, 7, 7, 8, 'q'); g.rect(9, 6, 9, 7, 'q')
    return S(g, k="#ff6fb4", K="#c93a7d", q="#e0302a")

def gafas():
    g = G(17, 6)
    g.stamp(1, 1, ["ggggg  ggggg", "gvwvg  gvwvg", "gvvvg  gvvvg", "ggggg  ggggg"]); g.rect(6, 2, 7, 2, 'g')
    g.g = [r[:17] for r in g.g]
    return S(g, g="#2f2f36", v="#dcf0ff")

def brazo():
    g = G(36, 8)
    g.rect(1, 2, 8, 5, 'k'); g.rect(1, 2, 8, 2, 'K')                               # manga de la camiseta
    g.rect(9, 3, 27, 5, 's'); g.rect(9, 3, 27, 3, 'l'); g.rect(9, 5, 27, 5, 'd')   # brazo de tres de grueso
    g.rect(15, 2, 19, 2, 's')                                                      # bíceps
    g.rect(28, 2, 34, 5, 's'); g.rect(28, 5, 34, 5, 'd'); g.rect(28, 2, 34, 2, 'l')  # mano plana, dedos juntos
    g.rect(29, 1, 31, 1, 's')                                                      # pulgar
    g.put(33, 3, 'd'); g.put(31, 4, 'd')
    return S(g, k="#24262c", K="#3e424c")

def puno():
    g = G(24, 9)
    g.rect(1, 2, 7, 6, 'c'); g.rect(1, 2, 7, 2, 'C')
    g.rect(8, 3, 16, 5, 's'); g.rect(8, 3, 16, 3, 'l'); g.rect(8, 5, 16, 5, 'd')
    g.rect(17, 1, 22, 7, 's'); g.rect(17, 7, 22, 7, 'd'); g.rect(17, 1, 22, 1, 'l')  # puño cerrado
    for y in (3, 5): g.rect(20, y, 22, y, 'd')
    return S(g, c="#b8bcc6", C="#d8dce4")

# Rollo de papel higiénico gigante: el cuerpo de la columna de abajo
def rollo():
    g = G(28, 18)
    g.rect(1, 1, 26, 16, 'w')
    g.rect(1, 1, 3, 16, 'W'); g.rect(22, 1, 24, 16, 'g'); g.rect(25, 1, 26, 16, 'G')
    for x in (9, 17):
        for y in range(2, 16, 2): g.put(x, y, 'g')                                  # trepado
    for y in (4, 8, 12):
        for x in range(5, 22, 4): g.put(x + ((y // 4) % 2) * 2, y, 'd')             # relieve del papel
    g.rect(1, 1, 26, 1, 'g'); g.rect(1, 16, 26, 16, 'g')
    return S(g, w="#f2efe6", W="#ffffff", g="#d6d0c2", G="#b8b0a0", d="#e2dcd0")

def tapa():
    g = G(28, 8)
    g.spans(1, [(5, 22), (2, 25), (1, 26), (1, 26), (2, 25), (5, 22)], 'w')
    g.spans(2, [(11, 16), (10, 17), (10, 17), (11, 16)], 'c')                     # tubo de cartón
    g.spans(3, [(12, 15), (12, 15)], 'h')
    return S(g, w="#ffffff", c="#b07a4a", h="#3a2416")

# Tapper: jarra de cerveza (llena y vacía) y el grifo de la barra
def jarra(full=True):
    g = G(12, 12)
    g.rect(1, 2, 7, 10, 'v')                                      # cristal
    g.rect(8, 4, 9, 4, 'v'); g.rect(9, 5, 9, 7, 'v'); g.rect(8, 8, 9, 8, 'v')  # asa
    if full:
        g.rect(2, 4, 6, 10, 'y'); g.rect(3, 5, 3, 9, 'Y')          # cerveza
        g.rect(1, 1, 7, 3, 'w'); g.rect(2, 0, 5, 0, 'w')          # espuma que rebosa
    else:
        g.rect(2, 3, 6, 10, 'e'); g.rect(3, 4, 3, 9, 'W'); g.rect(2, 9, 6, 10, 'y')  # vacía, con un culín
    return S(g, v="#cfe6ee", y="#f0b43a", Y="#f8d56a", w="#fffaf0", e="#9fb6be", W="#e6f4f8")

def grifo():
    g = G(13, 18)
    g.rect(5, 5, 7, 15, 'c'); g.rect(5, 5, 5, 15, 'C')           # columna de acero
    g.rect(1, 11, 4, 12, 'c'); g.rect(1, 13, 2, 13, 'c')          # caño
    g.rect(5, 0, 7, 4, 'r'); g.rect(5, 0, 5, 4, 'R')              # maneta
    g.rect(3, 16, 9, 16, 'k')                                      # base
    return S(g, c="#b8c0cc", C="#eef3f8", r="#c0302a", R="#e4574a", k="#5a6270")

def nota():
    g = G(8, 11)
    g.rect(4, 1, 4, 7, 'w'); g.rect(5, 1, 6, 2, 'w'); g.rect(6, 3, 6, 3, 'w'); g.rect(1, 6, 4, 9, 'w'); g.rect(2, 9, 3, 9, 'w')
    g.rect(1, 6, 1, 6, '.'); g.rect(4, 9, 4, 9, '.')
    return S(g, w="#f6ead2", o="#2a1812")

PJS = ["uli", "gon", "marcos", "hugo", "arro", "javi", "moreno", "sanlle", "ricky"]
MAKERS = {"uli": uli, "gon": gon, "marcos": marcos, "hugo": hugo, "arro": arro, "javi": javi, "moreno": moreno, "ricky": ricky}
SPRITES = {}
for pj in PJS:
    if pj == "sanlle":
        SPRITES.update(sanlle=gorila(air=True), sanlle_kick=gorila(), sanlle_ko=gorila(air=True, ko_=True))
    elif pj == "uli":
        SPRITES.update(uli=uli(), uli_kick=uli(kick=True), uli_ko=uli_ko())
    else:
        f = MAKERS[pj]
        SPRITES.update({pj: f(), pj + "_kick": f(kick=True), pj + "_ko": f(ko_=True)})
SPRITES.update(jarra=jarra(), vacia=jarra(full=False), grifo=grifo(), rollo=rollo(), tapa=tapa(), billete=billete(), arpa=arpa(), novia=novia(), gafas=gafas(), nota=nota(), brazo=brazo(), puno=puno())
ORDER = list(SPRITES)

if __name__ == "__main__":
    out = []
    for name in ORDER:
        spr = SPRITES[name]
        used = sorted({ch for r in spr["rows"] for ch in r if ch != "."})
        pal = ", ".join(f'{k}: "{spr["pal"][k]}"' for k in used)
        rows = ",\n".join(f'    "{r}"' for r in spr["rows"])
        out.append(f'  {name}: {{ rows: [\n{rows},\n  ], pal: {{ {pal} }} }},')
    path = __file__.rsplit("/", 2)[0] + "/lib/chicle-art.ts"
    art = open(path).read()
    a = art.index("export const SPR = {") + len("export const SPR = {\n"); b = art.index("} satisfies Record<string, Def>;")
    open(path, "w").write(art[:a] + "\n".join(out) + "\n" + art[b:])
    print("SPR actualizado:", ", ".join(ORDER))
    if len(sys.argv) > 1:
        from PIL import Image, ImageDraw
        SC, PER = 10, 6
        cw = max(len(v["rows"][0]) for v in SPRITES.values()) * SC + 20
        ch = max(len(v["rows"]) for v in SPRITES.values()) * SC + 30
        sheet = Image.new("RGB", (cw * PER, ch * ((len(ORDER) + PER - 1) // PER)), (19, 39, 31)); d = ImageDraw.Draw(sheet)
        for i, name in enumerate(ORDER):
            spr, ox, oy = SPRITES[name], (i % PER) * cw + 10, (i // PER) * ch
            d.text((ox, oy + 2), name, fill=(255, 220, 120))
            for y, row in enumerate(spr["rows"]):
                for x, c in enumerate(row):
                    if spr["pal"].get(c): d.rectangle([ox + x * SC, oy + 20 + y * SC, ox + x * SC + SC - 1, oy + 20 + y * SC + SC - 1], fill=spr["pal"][c])
        sheet.save(sys.argv[1]); print("vista previa:", sys.argv[1])
