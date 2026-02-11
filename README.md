<p align="center">
  <img src="assets/logo.png" alt="GLORP Logo" width="600">
</p>

# GLORP: The Pixel-to-Vector Beast

**Bzibi&ti tpi$onch… BLAP BLAP BLAAA…**

GLORP is a tiny desktop monster written in Python + Tkinter that  
**devours raster pixels** and **spits out clean, optimized SVG vectors**.

Born to serve pixel artists, indie devs, and UI gremlins who demand  
**crisp edges**, **zero blur**, and **maximum munch**.

## 🚀 Download & Examples

If you just want to use the tool without running the script, you can download the compiled version here:

**[👉 Download GLORP on Itch.io](https://zackdurec.itch.io/glorp-pixel-to-svg)**

On the Itch.io page, you'll also find:
* **Visual Examples**: Comparison between original PNG and optimized SVG.
* **Mode Previews**: See the difference between "Monolith" and "Lego" modes.
* **UI Screenshots**: A quick look at the simple 3-button interface.

  ### 🖼️ Why use GLORP?

* **For Printing**: Perfect for stickers, t-shirts, and posters where you need infinite scaling.
* **For Web**: Optimized SVGs are tiny and look crisp on any screen.
* **Batch Processing**: Drop 100 files and convert them all in seconds.

Mi mi mi… *GLORP hungers for squares.* 

---

## 🧪 The Sacred Rules (Preparation)

To avoid cursed, bloated, blurry SVGs — obey:

- **Original Size Only**  
  Feed GLORP your true pixels.  
  `16×16`, `32×32`, `64×64` etc.

- **Nearest Neighbor or Death**  
  If you resize — **NEAREST ONLY!!!**.  
  Bilinear = heresy. Bicubic = exile.

- **PNG with Transparency**  
  Alpha is holy. JPG is chaos.

- **Hard Edges Only**  
  No photos. No hard gradients. No blur.  
  GLORP only understands square truth. Upload HighRes at your own risk. (But seriously, don't...)

---

## 🛠 How to Use the Beast

1. **Feed the Beast**  
   Click **Select Images** → add files to the queue.

2. **Gaze into the Void**  
   Hover over a filename to see a pixel-perfect preview.

3. **Set the Lair**  
   Click **Choose Output Folder**.

4. **Pick Your Mutation Mode :**

# 🗿 Monolith (Recommended)
Uses a greedy meshing algorithm:
- Fuses same-colored pixels into large shapes
- Generates compact `<path>` blocks
- Fast and editor-friendly

*Blu blu blu… MUNCH.*

# 🧱 Lego
Every pixel becomes a 1×1 `<rect>`.  
Beautiful. Dangerous. Lag-inducing.

5. **Execute**  
   Hit **Convert** and watch the status bar scream.

---

## ⚠️ Technical Warnings (Z-Z-ZAP!)

- **Lego Mode Risk**  
  260 × 260 = **67,600** 💀💀💀  
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

```bash```

- pip install -r requirements.txt

- python glorp.py

---
## 🍕 Appetite (Batch Processing)

GLORP is a glutton. There is **no hard limit** on how many files you can select at once. 

* **The Queue:** GLORP devours files one by one, so it won't choke.
* **No Freezing:** Thanks to threaded processing, the UI remains alive while the Beast works.
* **Memory Limits:** Your RAM is the only ceiling. Converting 1,000 massive images in **Lego Mode** might make your PC sweat.

> *Zup-zup! Give me a single sprite or a whole folder—I will munch them all!* 👾

---

## Optional offerings (same folder):

logo.png — app icon / splash

close.png — remove-file button

GLORP does not upscale.
GLORP does not forgive.

GLORP CONSUMES.











