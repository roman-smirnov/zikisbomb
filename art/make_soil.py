"""Bake a repeatable soil texture without third-party data or libraries."""
import math
import random
import struct
import zlib
from pathlib import Path

size = 256
rng = random.Random(27361)
rgb = []
for y in range(size):
    for x in range(size):
        u, v = x * math.tau / size, y * math.tau / size
        noise = (
            5 * math.sin(u + 2*v) + 4 * math.cos(3*u - v)
            + 4 * math.sin(5*u + 7*v + math.cos(3*v))
            + 3 * math.cos(11*u - 9*v + math.sin(4*u))
            + rng.uniform(-7, 7)
        )
        rgb.append([131 + noise, 89 + noise*.84, 63 + noise*.65])

def spot(x, y, rad, color, strength):
    for j in range(math.floor(y-rad), math.ceil(y+rad+1)):
        for i in range(math.floor(x-rad), math.ceil(x+rad+1)):
            k = max(0, 1 - math.hypot(i-x, j-y)/rad) * strength
            a = rgb[(j % size)*size + i % size]
            for c in range(3):
                a[c] += (color[c] - a[c]) * k

for _ in range(220):
    spot(rng.uniform(0,size), rng.uniform(0,size), rng.uniform(2.0,12.0),
         rng.choice([(107,70,47), (169,109,72), (143,93,65)]), rng.uniform(.13,.37))
for _ in range(1200):
    spot(rng.uniform(0,size), rng.uniform(0,size), rng.uniform(.8,3.2),
         rng.choice([(70,40,29), (168,112,75), (214,165,117)]), rng.uniform(.2,.7))
for _ in range(36):
    x, y, r = rng.uniform(0,size), rng.uniform(0,size), rng.uniform(1.2,3.2)
    spot(x, y+.65, r+.7, (67,45,31), .75)
    spot(x, y, r, (194,160,125), .9)

def chunk(tag, data):
    body = tag + data
    return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body))

data = b''.join(b'\0' + bytes(round(v) for pixel in rgb[i:i+size] for v in pixel) for i in range(0,len(rgb),size))
png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>2I5B', size,size,8,2,0,0,0)) + chunk(b'IDAT',zlib.compress(data,9)) + chunk(b'IEND',b'')
(Path(__file__).resolve().parents[1] / 'public/assets/soil.png').write_bytes(png)
