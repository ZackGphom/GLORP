# ---------------------------------------------------------
#  GLORP: The Pixel-to-Vector Beast
#  (c) 2026 ZackGphom. All rights reserved.
#  This code is for NON-COMMERCIAL use only. 
#  If you use this code, you MUST credit ZackGphom.
# ---------------------------------------------------------
import os
import sys
import tkinter as tk
from tkinter import filedialog, Canvas
from PIL import Image, ImageTk
from collections import defaultdict
import threading

APP_BG = "#0f0f0f"
APP_LIGHT = "#1a1a1a"
APP_TEXT = "#e6e6e6"
ACCENT = "#2a2a2a"
BTN_WIDTH = 26

def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def build_svg_optimized(file_path, mode="monolith"):
    img = Image.open(file_path).convert("RGBA")
    w, h = img.size
    pixels = img.load()
    
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" shape-rendering="crispEdges">']
    
    if mode == "lego":
        
        for y in range(h):
            for x in range(w):
                r, g, b, a = pixels[x, y]
                if a > 0:
                    color_hex = f"#{r:02x}{g:02x}{b:02x}"
                    opacity_attr = f' fill-opacity="{a/255}"' if a < 255 else ""
                    svg.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{color_hex}"{opacity_attr}/>')
    else:
        color_map = defaultdict(set)
        for y in range(h):
            for x in range(w):
                r, g, b, a = pixels[x, y]
                if a > 0:
                    color_map[(r, g, b, a)].add((x, y))

        colors = list(color_map.keys())
        classes = {c: f"c{idx}" for idx, c in enumerate(colors)}
        
        svg.append("<style>")
        for c, cls in classes.items():
            svg.append(f'.{cls} {{ fill:#{c[0]:02x}{c[1]:02x}{c[2]:02x}; fill-opacity:{c[3]/255}; }}')
        svg.append("</style>")

        for color, coords in color_map.items():
            cls = classes[color]
            path_data = []
            visited = set()
            sorted_coords = sorted(coords, key=lambda p: (p[1], p[0]))
            
            for x, y in sorted_coords:
                if (x, y) in visited: continue
                rw = 1
                while (x + rw, y) in coords and (x + rw, y) not in visited:
                    rw += 1
                rh = 1
                while True:
                    can_expand_v = True
                    for i in range(rw):
                        if (x + i, y + rh) not in coords or (x + i, y + rh) in visited:
                            can_expand_v = False
                            break
                    if not can_expand_v: break
                    rh += 1
                path_data.append(f"M{x},{y}h{rw}v{rh}h-{rw}z")
                for i in range(rw):
                    for j in range(rh):
                        visited.add((x + i, y + j))
            svg.append(f'<path class="{cls}" d="{"".join(path_data)}"/>')
                
    svg.append("</svg>")
    return "\n".join(svg), w, h

class Tooltip:
    def __init__(self, widget, text):
        self.widget = widget
        self.text = text
        self.tip_window = None
        self.widget.bind("<Enter>", self.show_tip)
        self.widget.bind("<Leave>", self.hide_tip)

    def show_tip(self, event=None):
        if self.tip_window or not self.text: return
        x, y, _, _ = self.widget.bbox("insert")
        x += self.widget.winfo_rootx() + 25
        y += self.widget.winfo_rooty() + 25
        self.tip_window = tw = tk.Toplevel(self.widget)
        tw.wm_overrideredirect(True)
        tw.wm_geometry(f"+{x}+{y}")
        label = tk.Label(tw, text=self.text, justify='left',
                         background="#333333", foreground=APP_TEXT,
                         relief='solid', borderwidth=1, font=("Segoe UI", 8))
        label.pack(ipadx=5, ipady=2)

    def hide_tip(self, event=None):
        if self.tip_window:
            self.tip_window.destroy()
            self.tip_window = None

class FilePreview:
    def __init__(self, widget, image_path):
        self.widget = widget
        self.image_path = image_path
        self.tip_window = None
        self.widget.bind("<Enter>", self.show_tip)
        self.widget.bind("<Leave>", self.hide_tip)
        self.widget.bind("<Motion>", self.move_tip)

    def show_tip(self, event=None):
        try:
            img = Image.open(self.image_path).convert("RGBA")
            w, h = img.size
            ratio = min(150 / w, 150 / h)
            new_w, new_h = int(w * ratio), int(h * ratio)
            img = img.resize((new_w, new_h), Image.NEAREST)
            self.preview_img = ImageTk.PhotoImage(img)
            self.tip_window = tw = tk.Toplevel(self.widget)
            tw.wm_overrideredirect(True)
            label = tk.Label(tw, image=self.preview_img, bg=APP_LIGHT, relief='solid', borderwidth=1)
            label.pack()
            self.move_tip(event)
        except: pass

    def move_tip(self, event):
        if self.tip_window:
            x, y = event.x_root + 15, event.y_root + 15
            self.tip_window.wm_geometry(f"+{x}+{y}")

    def hide_tip(self, event=None):
        if self.tip_window:
            self.tip_window.destroy()
            self.tip_window = None

class GlorpApp:
    def __init__(self, root):
        self.root = root
        self.root.title("GLORP")
        self.root.geometry("680x520")
        self.root.configure(bg=APP_BG)
        self.root.resizable(False, False)

        self.selected_files = []
        self.output_folder = ""
        self.mode_var = tk.StringVar(value="monolith")

        self.setup_ui()
        self.load_icon()

    def load_icon(self):
        icon_path = resource_path("logo.png")
        if os.path.exists(icon_path):
            try:
                icon_img = Image.open(icon_path)
                self.icon_photo = ImageTk.PhotoImage(icon_img)
                self.root.iconphoto(False, self.icon_photo)
            except: pass

    def setup_ui(self):
        self.top_frame = tk.Frame(self.root, bg=APP_BG, height=180)
        self.top_frame.pack(fill="x")
        self.top_frame.pack_propagate(False)

        logo_path = resource_path("logo.png")
        if os.path.exists(logo_path):
            img = Image.open(logo_path).convert("RGBA")
            new_size = (int(img.width * (160 / img.height)), 160)
            img = img.resize(new_size, Image.LANCZOS)
            self.logo_photo = ImageTk.PhotoImage(img)
            tk.Label(self.top_frame, image=self.logo_photo, bg=APP_BG).pack(pady=(35, 0))

        self.center_container = tk.Frame(self.root, bg=APP_BG)
        self.center_container.place(relx=0.5, rely=0.55, anchor="center")

        self.select_btn = tk.Button(self.center_container, text="Select Images", command=self.select_images, bg=APP_LIGHT, fg=APP_TEXT, bd=0, width=BTN_WIDTH, pady=10)
        self.select_btn.pack(pady=8)

        self.folder_btn = tk.Button(self.center_container, text="Choose Output Folder", command=self.set_folder, bg=APP_LIGHT, fg=APP_TEXT, bd=0, width=BTN_WIDTH, pady=10)
        self.convert_btn = tk.Button(self.center_container, text="Convert", command=self.start_convert, bg=ACCENT, fg="white", bd=0, width=BTN_WIDTH, pady=12)

        self.mode_frame = tk.Frame(self.center_container, bg=APP_BG)
        rb_m = tk.Radiobutton(self.mode_frame, text="Monolith", variable=self.mode_var, value="monolith", bg=APP_BG, fg=APP_TEXT, selectcolor=APP_LIGHT, activebackground=APP_BG)
        rb_l = tk.Radiobutton(self.mode_frame, text="Lego", variable=self.mode_var, value="lego", bg=APP_BG, fg=APP_TEXT, selectcolor=APP_LIGHT, activebackground=APP_BG)
        rb_m.pack(side="left", padx=10); rb_l.pack(side="left", padx=10)
        
        Tooltip(rb_m, "Optimized mode: Merges pixels of the same color into large shapes.")
        Tooltip(rb_l, "Pixel mode: EACH pixel becomes a separate mesh/object.")

        self.files_panel = tk.Frame(self.root, bg=APP_BG, width=220)
        self.files_panel.pack(side="right", padx=20, fill="y", pady=(0, 60))
        self.files_panel.pack_propagate(False)

        self.queue_header = tk.Frame(self.files_panel, bg=APP_BG)
        tk.Label(self.queue_header, text="FILE QUEUE:", bg=APP_BG, fg="#555555", font=("Segoe UI", 8, "bold")).pack(side="left")
        tk.Button(self.queue_header, text="Clear All", bg=APP_BG, fg="#777777", bd=0, font=("Segoe UI", 7, "underline"), activebackground=APP_BG, activeforeground=APP_TEXT, command=self.clear_queue).pack(side="right")

        self.canvas = Canvas(self.files_panel, bg=APP_BG, highlightthickness=0, width=200)
        self.scrollbar = tk.Scrollbar(self.files_panel, orient="vertical", command=self.canvas.yview, width=10)
        self.scroll_frame = tk.Frame(self.canvas, bg=APP_BG)
        self.scroll_frame.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.create_window((0, 0), window=self.scroll_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        
        self.root.bind_all("<MouseWheel>", self._on_mousewheel)
        self.status_label = tk.Label(self.root, text="", bg=APP_BG, fg="#aaaaaa", font=("Segoe UI", 9, "underline"))
        self.status_label.place(relx=0.5, rely=0.95, anchor="center")

        self.update_ui_state()

    def _on_mousewheel(self, event):
        if len(self.selected_files) > 10: self.canvas.yview_scroll(int(-1*(event.delta/120)), "units")

    def select_images(self):
        files = filedialog.askopenfilenames(filetypes=[("Images", "*.png *.jpg *.jpeg *.gif")])
        if files:
            new = [f for f in files if f not in self.selected_files]
            self.selected_files.extend(new)
            self.refresh_file_list()

    def set_folder(self):
        f = filedialog.askdirectory()
        if f: 
            self.output_folder = f
            self.show_status("Output folder selected")

    def clear_queue(self):
        self.selected_files = []
        self.refresh_file_list()

    def remove_file(self, path):
        self.selected_files.remove(path)
        self.refresh_file_list()

    def refresh_file_list(self):
        for w in self.scroll_frame.winfo_children(): w.destroy()
        if not self.selected_files:
            self.canvas.pack_forget(); self.scrollbar.pack_forget(); self.queue_header.pack_forget()
        else:
            self.queue_header.pack(fill="x", pady=(0, 5))
            self.canvas.pack(side="left", fill="both", expand=True)
            if len(self.selected_files) > 10: self.scrollbar.pack(side="right", fill="y")
        
        close_icon_path = resource_path("close.png")
        for file in self.selected_files:
            row = tk.Frame(self.scroll_frame, bg=APP_BG)
            row.pack(fill="x", pady=3)
            lbl = tk.Label(row, text=os.path.basename(file), bg=APP_BG, fg=APP_TEXT, font=("Segoe UI", 9), width=18, anchor="w")
            lbl.pack(side="left")
            FilePreview(lbl, file)
            if os.path.exists(close_icon_path):
                img_c = Image.open(close_icon_path).resize((14,14), Image.LANCZOS)
                photo_c = ImageTk.PhotoImage(img_c)
                btn = tk.Button(row, image=photo_c, bg=APP_BG, bd=0, activebackground=APP_LIGHT, command=lambda f=file: self.remove_file(f))
                btn.image = photo_c
                btn.pack(side="right", padx=5)
        self.update_ui_state()

    def update_ui_state(self):
        if self.selected_files:
            self.folder_btn.pack(pady=8); self.convert_btn.pack(pady=12); self.mode_frame.pack(pady=5)
        else:
            self.folder_btn.pack_forget(); self.convert_btn.pack_forget(); self.mode_frame.pack_forget()

    def show_status(self, msg):
        self.status_label.config(text=msg)
        if "Processing" not in msg:
            self.root.after(5000, lambda: self.status_label.config(text=""))

    def start_convert(self):
        if not self.selected_files or not self.output_folder:
            self.show_status("Select files and folder first")
            return
        self.convert_btn.config(state="disabled")
        threading.Thread(target=self.process, daemon=True).start()

    def process(self):
        mode = self.mode_var.get()
        total = len(self.selected_files)
        files_to_do = list(self.selected_files)
        processed_successfully = []

        for i, file in enumerate(files_to_do):
            try:
                self.root.after(0, lambda x=i+1: self.show_status(f"Processing: {x}/{total}..."))
                svg_content, w, h = build_svg_optimized(file, mode)
                name = os.path.splitext(os.path.basename(file))[0] + ".svg"
                dest = os.path.join(self.output_folder, name)
                if os.path.exists(dest):
                    base, ext = os.path.splitext(dest); c = 1
                    while os.path.exists(f"{base}_{c}{ext}"): c += 1
                    dest = f"{base}_{c}{ext}"
                with open(dest, "w", encoding="utf-8") as f: f.write(svg_content)
                processed_successfully.append(file)
            except Exception as e: print(f"Error: {e}")

        for f in processed_successfully:
            if f in self.selected_files: self.selected_files.remove(f)
        self.root.after(0, self.refresh_file_list)
        self.root.after(0, lambda: (self.show_status("Conversion complete"), self.convert_btn.config(state="normal")))

if __name__ == "__main__":
    root = tk.Tk()
    app = GlorpApp(root)

    root.mainloop()
