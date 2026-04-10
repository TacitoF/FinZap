#!/usr/bin/env python3
import struct, zlib, base64, os

def make_png(size, bg, fg):
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xffffffff
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)
    
    pixels = []
    cx, cy = size // 2, size // 2
    r = size * 0.3
    lw = size * 0.06
    
    for y in range(size):
        row = b'\x00'
        for x in range(size):
            dx, dy = x - cx, y - cy
            dist = (dx*dx + dy*dy) ** 0.5
            
            # Background circle
            if dist < size * 0.48:
                # Letter F shape
                in_f = False
                nx, ny = (x - cx) / size, (y - cy) / size
                # vertical bar
                if -0.22 < nx < -0.04 and -0.28 < ny < 0.28:
                    in_f = True
                # top bar
                if -0.22 < nx < 0.22 and -0.28 < ny < -0.10:
                    in_f = True
                # middle bar
                if -0.22 < nx < 0.14 and -0.04 < ny < 0.10:
                    in_f = True
                
                if in_f:
                    row += fg
                else:
                    row += bg
            else:
                row += bytes([0,0,0,0])
        pixels.append(row)
    
    raw = b''.join(pixels)
    compressed = zlib.compress(raw, 9)
    
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', ihdr_data)
    png += chunk(b'IDAT', compressed)
    png += chunk(b'IEND', b'')
    return png

os.makedirs('icons', exist_ok=True)

bg = bytes([30, 27, 75, 255])   # #1e1b4b
fg = bytes([165, 180, 252, 255]) # #a5b4fc

for size in [192, 512]:
    png = make_png(size, bg, fg)
    with open(f'icons/icon-{size}.png', 'wb') as f:
        f.write(png)
    print(f"icon-{size}.png criado ({len(png)} bytes)")
