# ---------------------------------------------------------
#  GLORP: The Pixel-to-Vector Beast
#  (c) 2026 ZackGphom. All rights reserved.
#  This code is for NON-COMMERCIAL use only. 
#  If you use this code, you MUST credit ZackGphom.
# ---------------------------------------------------------

import os
import sys
import threading
import ctypes
from collections import defaultdict
from PIL import Image
from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QPushButton, QLabel, QFileDialog, 
                             QRadioButton, QScrollArea, QFrame, QGraphicsOpacityEffect, QMessageBox)
from PySide6.QtCore import Qt, QSize, QPropertyAnimation, QPoint, Signal, QObject, QTimer, QRect, QEasingCurve, QParallelAnimationGroup
from PySide6.QtGui import QPixmap, QDragEnterEvent, QDropEvent, QMovie, QIcon

# --- Global UI Constants ---
APP_BG = "#0f0f0f"
APP_LIGHT = "#1a1a1a"
APP_HOVER = "#252525"
APP_TEXT = "#e6e6e6"
ACCENT = "#2a2a2a"
ACCENT_HOVER = "#3a3a3a"
WARNING_COLOR = "#ff4444"
OVERLAY_COLOR = "#151515"
RADIUS = "10px"
MAX_PIXELS = 1_000_000 
LEGO_DANGER_LIMIT = 50_000 

def resource_path(relative_path):
    """
    Retrieves the absolute path to resources for both development and frozen application states.
    Nuitka/PyInstaller unpacks resources into a temporary directory during onefile execution.
    """
    try:
        # sys._MEIPASS is used by bootloaders to store resource temporary paths
        base_path = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# --- UI Components ---
class ClickableLabel(QLabel):
    """ Custom QLabel implementation to handle mouse click signals. """
    clicked = Signal()
    def __init__(self, text, parent=None):
        super().__init__(text, parent)
        self.setCursor(Qt.PointingHandCursor)
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.clicked.emit()
            event.accept() 

class AnimatedButton(QPushButton):
    """ QPushButton subclass with hover state styling and custom padding support. """
    def __init__(self, text, base_color=APP_LIGHT, hover_color=APP_HOVER, is_accent=False, padding=10):
        super().__init__(text)
        self.base_color = ACCENT if is_accent else base_color
        self.hover_color = ACCENT_HOVER if is_accent else hover_color
        self.padding = padding
        self.setCursor(Qt.PointingHandCursor)
        self.update_style(self.base_color)

    def update_style(self, color):
        self.setStyleSheet(f"QPushButton {{ background-color: {color}; border: none; border-radius: {RADIUS}; "
                           f"font-weight: bold; color: white; padding: {self.padding}px; }}")

    def set_custom_padding(self, p):
        self.padding = p
        self.update_style(self.base_color)

    def enterEvent(self, event): self.update_style(self.hover_color); super().enterEvent(event)
    def leaveEvent(self, event): self.update_style(self.base_color); super().leaveEvent(event)

# --- Core Logic ---
def build_svg_optimized(file_path, mode="monolith"):
    """
    Main transformation engine: Converts pixel data into optimized SVG vector paths.
    Implements a greedy rectangular path merger to reduce total object count in 'monolith' mode.
    """
    img = Image.open(file_path).convert("RGBA")
    w, h = img.size
    if w * h > MAX_PIXELS: raise ValueError(f"Image dimensions exceed limit ({w}x{h}). Max {MAX_PIXELS} pixels.")
    pixels = img.load()
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" shape-rendering="crispEdges">']
    
    if mode == "lego":
        # Unoptimized mode: Every pixel becomes an individual rect element
        for y in range(h):
            for x in range(w):
                r, g, b, a = pixels[x, y]
                if a > 0:
                    color_hex = f"#{r:02x}{g:02x}{b:02x}"
                    svg.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{color_hex}"'
                               f'{f' fill-opacity="{a/255}"' if a < 255 else ""}/>')
    else:
        # Optimized mode: Groups pixels by color and performs 2D rectangular merging
        color_map = defaultdict(set)
        for y in range(h):
            for x in range(w):
                r, g, b, a = pixels[x, y]
                if a > 0: color_map[(r, g, b, a)].add((x, y))
        
        classes = {c: f"c{idx}" for idx, c in enumerate(color_map.keys())}
        svg.append("<style>")
        for c, cls in classes.items(): svg.append(f'.{cls} {{ fill:#{c[0]:02x}{c[1]:02x}{c[2]:02x}; fill-opacity:{c[3]/255}; }}')
        svg.append("</style>")
        
        for color, coords in color_map.items():
            cls = classes[color]
            path_data = []
            visited = set()
            sorted_coords = sorted(coords, key=lambda p: (p[1], p[0]))
            for x, y in sorted_coords:
                if (x, y) in visited: continue
                rw = 1
                while (x + rw, y) in coords and (x + rw, y) not in visited: rw += 1
                rh = 1
                while True:
                    can_v = True
                    for i in range(rw):
                        if (x + i, y + rh) not in coords or (x + i, y + rh) in visited: can_v = False; break
                    if not can_v: break
                    rh += 1
                path_data.append(f"M{x},{y}h{rw}v{rh}h-{rw}z")
                for i in range(rw):
                    for j in range(rh): visited.add((x + i, y + j))
            svg.append(f'<path class="{cls}" d="{"".join(path_data)}"/>')
    
    svg.append("</svg>")
    return "\n".join(svg), w, h

class WorkerSignals(QObject):
    """ Signal bridge for cross-thread communication between backend and UI. """
    update_status = Signal(str); finished = Signal(); error = Signal(str)

class FileLabel(QLabel):
    """ Interactive UI label with dynamic tooltip preview on mouse hover. """
    def __init__(self, text, path):
        super().__init__(text); self.path = path; self.preview_window = None
    def enterEvent(self, event):
        self.preview_window = QWidget(None, Qt.ToolTip | Qt.FramelessWindowHint); self.preview_window.setFixedSize(160, 160) 
        layout = QVBoxLayout(self.preview_window); layout.setContentsMargins(2, 2, 2, 2); lbl = QLabel()
        try: pix = QPixmap(self.path).scaled(150, 150, Qt.KeepAspectRatio, Qt.FastTransformation); lbl.setPixmap(pix)
        except: pass
        lbl.setAlignment(Qt.AlignCenter); lbl.setStyleSheet(f"background: {APP_LIGHT}; border: 1px solid #444; border-radius: {RADIUS};")
        layout.addWidget(lbl); pos = self.mapToGlobal(self.rect().center()); self.preview_window.move(pos.x() + 20, pos.y() - 80); self.preview_window.show()
    def leaveEvent(self, event):
        if self.preview_window: self.preview_window.close(); self.preview_window = None

# --- Main Application Window ---
class GlorpApp(QMainWindow):
    """ Main GUI Controller responsible for state management and user interaction. """
    def __init__(self):
        super().__init__()
        self.setWindowTitle("GLORP")
        self.setFixedSize(680, 560)
        
        # Load window icon using resource path resolution
        fav_path = resource_path("favicon.png")
        if os.path.exists(fav_path):
            self.setWindowIcon(QIcon(fav_path))
        
        self.setStyleSheet(f"background-color: {APP_BG}; color: {APP_TEXT}; font-family: 'Segoe UI';")
        self.setAcceptDrops(True); self.selected_files = []; self.output_folder = ""; self.signals = WorkerSignals()
        
        # Initialize animated resources
        self.movie = QMovie(resource_path("lego_warning.gif"))
        
        self.type_timer = QTimer(); self.type_timer.timeout.connect(self.tick_typewriter)
        self.erase_timer = QTimer(); self.erase_timer.timeout.connect(self.tick_eraser)
        self.wait_timer = QTimer(); self.wait_timer.setSingleShot(True); self.wait_timer.timeout.connect(self.start_erasing)
        
        self.full_msg = ""; self.current_idx = 0
        self.signals.update_status.connect(self.show_status)
        self.signals.finished.connect(self.on_process_finished)
        self.signals.error.connect(self.show_critical_error)
        
        self.init_ui(); self.setup_lego_overlay(); self.setup_drag_overlay()

    def init_ui(self):
        """ Initializes and positions all static and interactive UI elements. """
        self.main_container = QWidget(self); self.setCentralWidget(self.main_container)
        
        self.logo_label = QLabel(self.main_container); pix = QPixmap(resource_path("logo.png"))
        if not pix.isNull(): self.logo_label.setPixmap(pix.scaledToHeight(220, Qt.SmoothTransformation))
        self.logo_label.setAlignment(Qt.AlignCenter); self.logo_label.setGeometry(0, 40, 680, 240)
        
        self.extra_controls = QWidget(self.main_container); self.extra_controls.setGeometry(100, 310, 260, 240)
        
        self.folder_btn = AnimatedButton("Choose Output Folder"); self.folder_btn.setParent(self.extra_controls); self.folder_btn.setGeometry(30, 0, 200, 42)
        self.folder_btn.clicked.connect(self.set_folder)
        
        self.mode_container = QWidget(self.extra_controls); self.mode_container.setGeometry(30, 50, 200, 30)
        ml = QHBoxLayout(self.mode_container); ml.setContentsMargins(0, 0, 0, 0); ml.setSpacing(20); ml.setAlignment(Qt.AlignCenter)
        self.rb_monolith = QRadioButton("Monolith"); self.rb_monolith.setChecked(True)
        self.rb_lego = QRadioButton("Lego"); self.rb_lego.toggled.connect(self.on_mode_changed)
        ml.addWidget(self.rb_monolith); ml.addWidget(self.rb_lego)
        
        self.convert_btn = AnimatedButton("Convert", is_accent=True); self.convert_btn.setParent(self.extra_controls); self.convert_btn.setGeometry(30, 90, 200, 42)
        self.convert_btn.clicked.connect(self.start_convert)
        
        self.lego_warning_lbl = ClickableLabel("⚠️ Performance Warning (Click for info)", self.extra_controls)
        self.lego_warning_lbl.setFixedWidth(260); self.lego_warning_lbl.setAlignment(Qt.AlignCenter); self.lego_warning_lbl.setStyleSheet(f"color: {WARNING_COLOR}; font-size: 11px; text-decoration: underline;")
        self.lego_warning_lbl.clicked.connect(self.show_lego_page); self.lego_warning_lbl.setGeometry(0, 140, 260, 30); self.lego_warning_lbl.hide()
        
        self.stats_label = QLabel("", self.extra_controls); self.stats_label.setFixedWidth(260); self.stats_label.setAlignment(Qt.AlignCenter)
        self.stats_label.setStyleSheet("color:#666; text-decoration:underline; font-size: 11px;"); self.stats_label.setGeometry(0, 165, 260, 30)
        
        self.extra_opacity = QGraphicsOpacityEffect(self.extra_controls); self.extra_controls.setGraphicsEffect(self.extra_opacity); self.extra_opacity.setOpacity(0); self.extra_controls.hide()
        
        self.select_btn = AnimatedButton("Select Images", padding=15); self.select_btn.setParent(self.main_container); self.select_btn.setGeometry(220, 310, 240, 52); self.select_btn.clicked.connect(self.select_images); self.select_btn.raise_() 
        
        self.status_label = QLabel("", self.main_container); self.status_label.setFixedWidth(240); self.status_label.setAlignment(Qt.AlignCenter)
        self.status_label.setStyleSheet("color:#aaa; font-size: 11px;"); self.status_label.setGeometry(220, 370, 240, 30)
        
        self.right_panel = QFrame(self.main_container); self.right_panel.setGeometry(680, 0, 220, 560); self.right_panel.setStyleSheet(f"background:{APP_BG}; border-left:1px solid #1a1a1a;")
        self.right_layout = QVBoxLayout(self.right_panel); header = QWidget(); hl = QHBoxLayout(header)
        self.q_count = QLabel("(0)"); self.q_count.setStyleSheet("color:#555; font-weight:bold;"); hl.addWidget(QLabel("FILE QUEUE")); hl.addWidget(self.q_count); hl.addStretch()
        self.clear_btn = QPushButton("Clear All"); self.clear_btn.setStyleSheet("color:#777; border:none; font-size:10px; text-decoration:underline; background:transparent;"); self.clear_btn.setCursor(Qt.PointingHandCursor); self.clear_btn.clicked.connect(self.clear_queue); hl.addWidget(self.clear_btn)
        self.scroll = QScrollArea(); self.scroll.setWidgetResizable(True); self.scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff); self.scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff); self.scroll.setStyleSheet("border:none; background:transparent;")
        self.queue_widget = QWidget(); self.queue_layout = QVBoxLayout(self.queue_widget); self.queue_layout.setAlignment(Qt.AlignTop); self.scroll.setWidget(self.queue_widget); self.right_layout.addWidget(header); self.right_layout.addWidget(self.scroll)

    def on_mode_changed(self): self.update_stats()
    def update_stats(self):
        """ Dynamically updates pixel count estimation and UI warnings based on the selected mode. """
        is_lego = self.rb_lego.isChecked()
        self.lego_warning_lbl.setVisible(is_lego)
        if not self.selected_files or not is_lego: self.stats_label.setText(""); return
        total = 0
        for f in self.selected_files:
            try:
                with Image.open(f) as img: total += (img.size[0] * img.size[1])
            except: pass
        color = WARNING_COLOR if total > LEGO_DANGER_LIMIT else "#666"
        self.stats_label.setText(f"Lego Mode: ~{total:,} shapes"); self.stats_label.setStyleSheet(f"color:{color}; text-decoration:underline; font-size: 11px;")

    def show_status(self, msg):
        """ Triggers typewriter animation for status label updates. """
        self.type_timer.stop(); self.erase_timer.stop(); self.wait_timer.stop()
        self.full_msg = msg; self.current_idx = 0; self.status_label.setText(""); self.type_timer.start(40)

    def tick_typewriter(self):
        if self.current_idx < len(self.full_msg):
            self.current_idx += 1; self.status_label.setText(self.full_msg[:self.current_idx])
        else: self.type_timer.stop(); self.wait_timer.start(5000)

    def start_erasing(self): self.erase_timer.start(30)
    def tick_eraser(self):
        if self.current_idx > 0: self.current_idx -= 1; self.status_label.setText(self.full_msg[:self.current_idx])
        else: self.erase_timer.stop()

    def show_critical_error(self, text): QMessageBox.critical(self, "Error", text)

    def animate_transition(self, show_queue):
        """ Smoothly transitions UI layout between 'Empty' and 'Processing' states using parallel animations. """
        self.group = QParallelAnimationGroup(); self.select_btn.raise_()
        anim_logo = QPropertyAnimation(self.logo_label, b"geometry"); anim_btn = QPropertyAnimation(self.select_btn, b"geometry")
        anim_status = QPropertyAnimation(self.status_label, b"geometry")
        anim_panel = QPropertyAnimation(self.right_panel, b"pos"); anim_fade = QPropertyAnimation(self.extra_opacity, b"opacity")
        if show_queue:
            self.extra_controls.show(); self.extra_controls.raise_(); self.status_label.raise_()
            anim_logo.setEndValue(QRect(-110, 15, 680, 240)); anim_btn.setEndValue(QRect(130, 260, 200, 42)) 
            anim_status.setEndValue(QRect(113, 510, 260, 30))
            anim_panel.setEndValue(QPoint(460, 0)); anim_fade.setEndValue(1); self.select_btn.set_custom_padding(10)
        else:
            anim_logo.setEndValue(QRect(0, 40, 680, 240)); anim_btn.setEndValue(QRect(220, 310, 240, 52)) 
            anim_status.setEndValue(QRect(220, 370, 240, 30))
            anim_panel.setEndValue(QPoint(680, 0)); anim_fade.setEndValue(0); self.select_btn.set_custom_padding(15)
            self.group.finished.connect(lambda: self.extra_controls.hide() if len(self.selected_files) == 0 else None)
        for a in [anim_logo, anim_btn, anim_status, anim_panel, anim_fade]:
            a.setDuration(600); a.setEasingCurve(QEasingCurve.OutExpo); self.group.addAnimation(a)
        self.group.start()

    def setup_lego_overlay(self):
        """ Configures the full-screen warning overlay for high-complexity conversion modes. """
        self.lego_overlay = QFrame(self); self.lego_overlay.setGeometry(0, 560, 680, 560); self.lego_overlay.setStyleSheet(f"background:{APP_BG};")
        glay = QVBoxLayout(self.lego_overlay); glay.setContentsMargins(40, 40, 40, 20)
        t1 = QLabel("LEGO MODE PERFORMANCE WARNING"); t1.setStyleSheet(f"color:{WARNING_COLOR}; font-weight:bold; font-size:18px;")
        t2 = QLabel("Software may lag or crash due to thousands of separate objects."); t2.setStyleSheet("color:#888; font-size:13px;")
        t1.setAlignment(Qt.AlignCenter); t2.setAlignment(Qt.AlignCenter)
        self.gif_view = QLabel(); self.gif_view.setMovie(self.movie); self.gif_view.setFixedSize(500, 350); self.gif_view.setScaledContents(True); self.gif_view.setAlignment(Qt.AlignCenter)
        close_tip = QLabel("<u>Click anywhere to close</u>"); close_tip.setStyleSheet("color: #444; font-size: 10px;"); close_tip.setAlignment(Qt.AlignCenter)
        glay.addWidget(t1); glay.addWidget(t2); glay.addStretch(1); glay.addWidget(self.gif_view, 10, Qt.AlignCenter); glay.addStretch(1); glay.addWidget(close_tip)
        self.lego_overlay.mousePressEvent = lambda e: self.hide_lego_page()

    def show_lego_page(self):
        self.lego_overlay.show(); self.lego_overlay.raise_()
        if self.movie: self.movie.start()
        self.lego_anim = QPropertyAnimation(self.lego_overlay, b"pos"); self.lego_anim.setDuration(400); self.lego_anim.setEndValue(QPoint(0,0)); self.lego_anim.setEasingCurve(QEasingCurve.OutExpo); self.lego_anim.start()
    def hide_lego_page(self):
        self.lego_anim = QPropertyAnimation(self.lego_overlay, b"pos"); self.lego_anim.setDuration(300); self.lego_anim.setEndValue(QPoint(0,560)); self.lego_anim.finished.connect(self.lego_overlay.hide)
        if self.movie: self.lego_anim.finished.connect(self.movie.stop); self.lego_anim.start()

    def setup_drag_overlay(self):
        """ Prepares the drop-zone overlay that activates during file drag-and-drop operations. """
        self.drag_overlay = QFrame(self); self.drag_overlay.setGeometry(self.rect()); self.drag_overlay.setStyleSheet(f"background-color: {OVERLAY_COLOR};"); self.drag_overlay.setAttribute(Qt.WA_TransparentForMouseEvents); self.drag_overlay.hide()
        self.drag_opacity = QGraphicsOpacityEffect(self.drag_overlay); self.drag_overlay.setGraphicsEffect(self.drag_opacity)
        lay = QVBoxLayout(self.drag_overlay); self.drop_img = QLabel(); pix = QPixmap(resource_path("DropUrStuffHere.png"))
        if not pix.isNull(): self.drop_img.setPixmap(pix.scaled(pix.width()//2, pix.height()//2, Qt.KeepAspectRatio, Qt.SmoothTransformation))
        self.drop_img.setAlignment(Qt.AlignCenter); lay.addWidget(self.drop_img)

    def fade_overlay(self, show=True):
        """ Smoothly fades the drag-and-drop overlay in or out. """
        if show:
            self.drag_overlay.show(); self.drag_overlay.raise_(); self.drag_overlay.setAttribute(Qt.WA_TransparentForMouseEvents, False); self.anim_drag = QPropertyAnimation(self.drag_opacity, b"opacity")
            self.anim_drag.setDuration(250); self.anim_drag.setStartValue(0.0); self.anim_drag.setEndValue(1.0); self.anim_drag.start()
        else:
            self.drag_overlay.setAttribute(Qt.WA_TransparentForMouseEvents, True); self.anim_drag = QPropertyAnimation(self.drag_opacity, b"opacity")
            self.anim_drag.setDuration(250); self.anim_drag.setEndValue(0.0); self.anim_drag.finished.connect(self.drag_overlay.hide); self.anim_drag.start()

    def dragEnterEvent(self, e):
        if e.mimeData().hasUrls(): e.acceptProposedAction(); self.fade_overlay(True)
    def dragLeaveEvent(self, e): self.fade_overlay(False)
    def dropEvent(self, e):
        self.fade_overlay(False); files = [u.toLocalFile() for u in e.mimeData().urls() if u.toLocalFile().lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))]
        for f in files:
            if f not in self.selected_files: self.selected_files.append(f)
        self.refresh_file_list()

    def refresh_file_list(self):
        """ Updates the visual queue with selected file names and triggers appropriate layout animations. """
        count = len(self.selected_files); self.q_count.setText(f"({count})")
        if count > 0 and self.right_panel.pos().x() >= 680: self.animate_transition(True)
        elif count == 0 and self.right_panel.pos().x() < 680: self.animate_transition(False)
        for i in reversed(range(self.queue_layout.count())):
            w = self.queue_layout.itemAt(i).widget()
            if w: w.setParent(None)
        for f in self.selected_files:
            row = QWidget(); rl = QHBoxLayout(row); rl.setContentsMargins(5,2,5,2); lbl = FileLabel(os.path.basename(f), f); lbl.setText(lbl.fontMetrics().elidedText(os.path.basename(f), Qt.ElideRight, 150))
            btn = QPushButton("×"); btn.setFixedSize(24,24); btn.setCursor(Qt.PointingHandCursor); btn.setStyleSheet("border:none; color:#777; font-weight:bold; font-size:18px; background:transparent;"); btn.clicked.connect(lambda c=0, p=f: self.remove_file(p)); rl.addWidget(lbl, 1); rl.addWidget(btn); self.queue_layout.addWidget(row)
        self.update_stats()

    def select_images(self):
        files, _ = QFileDialog.getOpenFileNames(self, "Select Images", "", "Images (*.png *.jpg *.jpeg *.gif)")
        for f in files:
            if f not in self.selected_files: self.selected_files.append(f)
        self.refresh_file_list()

    def remove_file(self, path):
        if path in self.selected_files: self.selected_files.remove(path); self.refresh_file_list()

    def clear_queue(self): self.selected_files = []; self.refresh_file_list()
    def set_folder(self):
        f = QFileDialog.getExistingDirectory(self, "Select Output Folder")
        if f: self.output_folder = f; self.show_status("Folder selected")

    def start_convert(self):
        if not self.output_folder: self.show_status("Select folder!"); return
        self.convert_btn.setEnabled(False); threading.Thread(target=self.process, daemon=True).start()

    def process(self):
        """ Background processing loop: Converts queued images to SVG and writes them to the target directory. """
        mode = "lego" if self.rb_lego.isChecked() else "monolith"; done = []
        for i, file in enumerate(list(self.selected_files)):
            try:
                self.signals.update_status.emit(f"Processing {i+1}/{len(self.selected_files)}...")
                svg, w, h = build_svg_optimized(file, mode)
                base_name = os.path.splitext(os.path.basename(file))[0]; dest = os.path.join(self.output_folder, f"{base_name}.svg")
                counter = 1
                while os.path.exists(dest): dest = os.path.join(self.output_folder, f"{base_name}_{counter}.svg"); counter += 1
                with open(dest, "w", encoding="utf-8") as f: f.write(svg)
                done.append(file)
            except Exception as e: self.signals.error.emit(str(e)); break
        for f in done: self.selected_files.remove(f)
        self.signals.finished.emit()

    def on_process_finished(self): self.refresh_file_list(); self.convert_btn.setEnabled(True); self.show_status("Done!")

if __name__ == "__main__":
    # Windows shell ID configuration for taskbar icon grouping
    try:
        myappid = u'zackgphom.glorp.converter.v1' 
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(myappid)
    except Exception: pass
    app = QApplication(sys.argv)
    
    # App icon initialization
    fav_path = resource_path("favicon.png")
    if os.path.exists(fav_path): app.setWindowIcon(QIcon(fav_path))
    
    win = GlorpApp(); win.show(); sys.exit(app.exec())
