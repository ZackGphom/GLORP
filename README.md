# GLORP: The Pixel-to-Vector Beast

**Bzibi&ti tpi$onch… BLAP BLAP BLAAA…**

GLORP is a tiny desktop monster written in Python + Tkinter that  
**devours raster pixels** and **spits out clean, optimized SVG vectors**.

Born to serve pixel artists, indie devs, and UI gremlins who demand  
**crisp edges**, **zero blur**, and **maximum munch**.

Mi mi mi… *GLORP hungers for squares.* 🧱

---

## 🧪 The Sacred Rules (Preparation)

To avoid cursed, bloated, blurry SVGs — obey:

- **Original Size Only**  
  Feed GLORP your true pixels.  
  `16×16`, `32×32`, `64×64` — **no fake upscales**.

- **Nearest Neighbor or Death**  
  If you resize — **NEAREST ONLY**.  
  Bilinear = heresy. Bicubic = exile.

- **PNG with Transparency**  
  Alpha is holy. JPG is chaos.

- **Hard Edges Only**  
  No photos. No gradients. No blur.  
  GLORP only understands square truth.

---

## 🛠 How to Use the Beast

1. **Feed the Beast**  
   Click **Select Images** → add files to the queue.

2. **Gaze into the Void**  
   Hover over a filename to see a pixel-perfect preview.

3. **Set the Lair**  
   Click **Choose Output Folder**.

4. **Pick Your Mutation Mode**

### 🗿 Monolith (Recommended)
Uses a greedy meshing algorithm:
- Fuses same-colored pixels into large shapes
- Generates compact `<path>` blocks
- Fast and editor-friendly

*Blu blu blu… MUNCH.*

### 🧱 Lego
Every pixel becomes a 1×1 `<rect>`.  
Beautiful. Dangerous. Lag-inducing.

---

5. **Execute**  
   Hit **Convert** and watch the status bar scream.

---

## ⚠️ Technical Warnings (Z-Z-ZAP!)

- **Lego Mode Risk**  
  256×256 = **65,536 objects** 💀  
  Your vector editor will lag… then cry.

- **No Photos**  
  Blur creates massive, broken SVGs.

- **Give Me the Truth**  
  Upscaled pixel art will ruin optimization.

**BZIBI&TI TPI$ONCH!!**

---

## 🧬 What’s Inside

- Python + Tkinter GUI
- Pillow (PIL) for image processing
- Two conversion modes:
  - `lego` → `<rect>` per pixel
  - `monolith` → greedy merged `<path>`
- Alpha support
- Auto file renaming
- Hover previews
- Threaded processing (no UI freeze)

---

## 🩸 Run the Ritual

-```bash```

-pip install -r requirements.txt

-python glorp.py

---

## Optional offerings (same folder):

logo.png — app icon / splash

close.png — remove-file button

GLORP does not upscale.
GLORP does not forgive.

GLORP CONSUMES.

