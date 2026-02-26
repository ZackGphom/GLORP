# ---------------------------------------------------------
#  GLORP: The Pixel-to-Vector Beast
#  (c) 2026 ZackGphom. All rights reserved.
#  This code is for NON-COMMERCIAL use only. 
#  If you use this code, you MUST credit ZackGphom.
# ---------------------------------------------------------
#  SPECIAL THANKS TO:
#  Harry Tsang (https://www.linkedin.com/in/cheuk-nam-tsang-2997671b3/)
#  For the implementation of the high-performance Contour Meshing Engine.
# ---------------------------------------------------------

import os
import sys
import threading
import ctypes
from PIL import Image
from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout,
                               QHBoxLayout, QPushButton, QLabel, QFileDialog,
                               QRadioButton, QScrollArea, QFrame, QGraphicsOpacityEffect,
                               QMessageBox, QCheckBox, QMenu)
from PySide6.QtCore import Qt, QSize, QPropertyAnimation, QPoint, Signal, QObject, QTimer, QRect, QEasingCurve, QParallelAnimationGroup
from PySide6.QtGui import QPixmap, QMovie, QIcon
import numpy as np
from glorp_meshing import path_finding

APP_BG = "#0f0f0f"
APP_LIGHT = "#1a1a1a"
APP_HOVER = "#252525"
APP_TEXT = "#e6e6e6"
WARNING_COLOR = "#ff4444"
OVERLAY_COLOR = "#151515"
RADIUS = "10px"
LEGO_DANGER_LIMIT = 50_000

def resource_path(relative_path):
    try:
        base_path = getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__)))
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

class ClickableLabel(QLabel):
    clicked = Signal()
    def __init__(self, text="", parent=None):
        super().__init__(text, parent)
        self.setCursor(Qt.PointingHandCursor)
    def mousePressEvent(self, e):
        if e.button() == Qt.LeftButton:
            self.clicked.emit()
            e.accept()

class AnimatedButton(QPushButton):
    def __init__(self, text, base_color=APP_LIGHT, hover_color=APP_HOVER, is_accent=False, padding=10):
        super().__init__(text)
        self.base_color = base_color
        self.hover_color = hover_color
        self.padding = padding
        self.setCursor(Qt.PointingHandCursor)
        self.update_style(self.base_color)
    def update_style(self, color):
        self.setStyleSheet(f"QPushButton {{ background-color: {color}; border: none; border-radius: {RADIUS}; "
                           f"font-weight: bold; color: white; padding: {self.padding}px; }}")
    def enterEvent(self, e): self.update_style(self.hover_color)
    def leaveEvent(self, e): self.update_style(self.base_color)
    def set_custom_padding(self, p):
        self.padding = p
        self.update_style(self.base_color)

class WorkerSignals(QObject):
    update_status = Signal(str)
    finished = Signal()
    error = Signal(str)

class FileLabel(QLabel):
    def __init__(self, text, path, app=None):
        super().__init__(text)
        self.path = path
        self.app = app
        self.preview_window = None
        self.not_pixel_art = False

    def enterEvent(self, event):
        if os.path.isdir(self.path):
            return
        try:
            pix = QPixmap(self.path)
            if pix.isNull():
                return
            self.preview_window = QWidget(None, Qt.ToolTip | Qt.FramelessWindowHint)
            self.preview_window.setFixedSize(180, 190)
            layout = QVBoxLayout(self.preview_window)
            layout.setContentsMargins(4,4,4,4)
            img_lbl = QLabel()
            img_lbl.setAlignment(Qt.AlignCenter)
            scaled = pix.scaled(170, 132, Qt.KeepAspectRatio, Qt.FastTransformation)
            img_lbl.setPixmap(scaled)
            img_lbl.setStyleSheet(f"background: {APP_LIGHT}; border: 1px solid #444; border-radius: {RADIUS};")
            layout.addWidget(img_lbl)

            show_note = False
            try:
                if self.not_pixel_art and self.app is not None:
                    if not getattr(self.app, "rb_webp", None) or not self.app.rb_webp.isChecked():
                        show_note = True
            except Exception:
                show_note = False

            if show_note:
                note = QLabel("This doesn't look like pixel art.")
                note.setAlignment(Qt.AlignCenter)
                note.setStyleSheet(f"color: {WARNING_COLOR}; font-size: 11px;")
                layout.addWidget(note)
            else:
                spacer = QLabel("")
                spacer.setFixedHeight(12)
                layout.addWidget(spacer)

            pos = self.mapToGlobal(self.rect().center())
            x = pos.x() + 20
            y = pos.y() - 100
            screen = QApplication.primaryScreen().availableGeometry()
            if x + self.preview_window.width() > screen.right() - 10:
                x = screen.right() - self.preview_window.width() - 10
            if y < screen.top() + 10:
                y = screen.top() + 10
            self.preview_window.move(x, y)
            self.preview_window.show()
        except Exception:
            if self.preview_window:
                self.preview_window.close()
                self.preview_window = None

    def leaveEvent(self, event):
        if self.preview_window:
            self.preview_window.close()
            self.preview_window = None

class GlorpApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("GLORP")
        self.setFixedSize(680, 600)

        fav = resource_path("favicon.png")
        if os.path.exists(fav):
            self.setWindowIcon(QIcon(fav))

        self.setStyleSheet(f"background-color: {APP_BG}; color: {APP_TEXT}; font-family: 'Segoe UI';")
        self.setAcceptDrops(True)

        self.selected_files = []
        self.output_folder = ""
        self.save_to_source = False
        self.signals = WorkerSignals()

        self.type_timer = QTimer(); self.type_timer.timeout.connect(self.tick_typewriter)
        self.erase_timer = QTimer(); self.erase_timer.timeout.connect(self.tick_eraser)
        self.wait_timer = QTimer(); self.wait_timer.setSingleShot(True); self.wait_timer.timeout.connect(self.start_erasing)
        self.full_msg = ""
        self.current_idx = 0

        self.processing_movie = QMovie(resource_path("processing.gif"))
        try:
            self.processing_movie.setCacheMode(QMovie.CacheAll)
            try:
                self.processing_movie.setLoopCount(0)
            except Exception:
                pass
        except Exception:
            pass
        self._proc_refs = 0
        self._proc_stop_timer = QTimer(self); self._proc_stop_timer.setSingleShot(True); self._proc_stop_timer.timeout.connect(self._finalize_proc_stop)

        self.signals.update_status.connect(self.show_status)
        self.signals.finished.connect(self.on_process_finished)
        self.signals.error.connect(self.show_critical_error)

        self.init_ui()
        self.setup_lego_overlay()
        self.setup_drag_overlay()

    def _proc_ref_inc(self):
        self._proc_refs += 1
        if self._proc_stop_timer.isActive():
            self._proc_stop_timer.stop()
        try:
            if hasattr(self, "proc_fade_anim") and self.proc_fade_anim.state() == QPropertyAnimation.Running:
                self.proc_fade_anim.stop()
        except Exception:
            pass
        if self._proc_refs == 1:
            try:
                self.proc_label.show(); self.proc_label.raise_()
                start_op = self.proc_opacity.opacity() if hasattr(self, "proc_opacity") else 0.0
                self.proc_fade_anim.setStartValue(start_op); self.proc_fade_anim.setEndValue(1.0); self.proc_fade_anim.start()
                try:
                    self.processing_movie.start()
                except Exception:
                    pass
            except Exception:
                pass

    def _finalize_proc_stop(self):
        try:
            self.processing_movie.stop()
        except Exception:
            pass
        try:
            self.proc_label.hide()
        except Exception:
            pass

    def _proc_ref_dec(self):
        if self._proc_refs <= 0:
            self._proc_refs = 0; return
        self._proc_refs -= 1
        if self._proc_refs == 0:
            try:
                self.proc_fade_anim.stop()
                start_op = self.proc_opacity.opacity() if hasattr(self, "proc_opacity") else 1.0
                self.proc_fade_anim.setStartValue(start_op); self.proc_fade_anim.setEndValue(0.0); self.proc_fade_anim.start()
                dur = self.proc_fade_anim.duration() if hasattr(self, "proc_fade_anim") else 300
                if self._proc_stop_timer.isActive(): self._proc_stop_timer.stop()
                self._proc_stop_timer.start(dur + 10)
            except Exception:
                try:
                    self.processing_movie.stop()
                except Exception:
                    pass
                try:
                    self.proc_label.hide()
                except Exception:
                    pass

    def _show_processing(self, show: bool):
        if show: self._proc_ref_inc()
        else: self._proc_ref_dec()

    def _show_processing_transient(self, duration_ms: int = 800):
        self._show_processing(True)
        QTimer.singleShot(duration_ms, lambda: self._show_processing(False))

    def show_status(self, msg):
        try:
            self.type_timer.stop(); self.erase_timer.stop(); self.wait_timer.stop()
        except Exception:
            pass
        if hasattr(self, "convert_btn") and not self.convert_btn.isEnabled():
            try:
                self.status_label.setText(msg)
            except Exception:
                pass
            return
        self.full_msg = msg; self.current_idx = 0
        try:
            self.status_label.setText("")
            self.type_timer.start(40)
        except Exception:
            pass

    def tick_typewriter(self):
        if self.current_idx < len(self.full_msg):
            self.current_idx += 1
            try:
                self.status_label.setText(self.full_msg[:self.current_idx])
            except Exception:
                pass
        else:
            self.type_timer.stop()
            self.wait_timer.start(5000)

    def start_erasing(self):
        self.erase_timer.start(30)

    def tick_eraser(self):
        if self.current_idx > 0:
            self.current_idx -= 1
            try:
                self.status_label.setText(self.full_msg[:self.current_idx])
            except Exception:
                pass
        else:
            self.erase_timer.stop()

    def show_critical_error(self, text):
        try:
            while self._proc_refs > 0:
                self._proc_refs -= 1
            if self._proc_stop_timer.isActive(): self._proc_stop_timer.stop()
            try:
                self.processing_movie.stop()
            except Exception:
                pass
            try:
                self.proc_label.hide()
            except Exception:
                pass
        except Exception:
            pass
        QMessageBox.critical(self, "Error", text)

    def init_ui(self):
        self.main_container = QWidget(self); self.setCentralWidget(self.main_container)

        self.logo_label = QLabel(self.main_container)
        pix = QPixmap(resource_path("logo.png"))
        if not pix.isNull():
            self.logo_label.setPixmap(pix.scaledToHeight(220, Qt.SmoothTransformation))
        self.logo_label.setAlignment(Qt.AlignCenter)
        self.logo_label.setGeometry(0,40,680,240)

        self.extra_controls = QWidget(self.main_container)
        self.extra_controls.setGeometry(100,310,260,240)

        self.folder_btn = AnimatedButton("Choose Output Folder"); self.folder_btn.setParent(self.extra_controls)
        self.folder_btn.setGeometry(30,0,200,42); self.folder_btn.clicked.connect(self.set_folder)

        self.mode_container = QWidget(self.extra_controls); self.mode_container.setGeometry(30,50,200,30)
        ml = QHBoxLayout(self.mode_container); ml.setContentsMargins(0,0,0,0); ml.setSpacing(15); ml.setAlignment(Qt.AlignCenter)
        self.rb_monolith = QRadioButton("Monolith"); self.rb_monolith.setChecked(True)
        self.rb_lego = QRadioButton("Lego"); self.rb_lego.toggled.connect(self.update_stats)
        self.rb_webp = QRadioButton("WebP")
        self.rb_lego.toggled.connect(self._update_folder_btn_state)
        self.rb_webp.toggled.connect(self._update_folder_btn_state)
        self.rb_monolith.toggled.connect(self._update_folder_btn_state)
        ml.addWidget(self.rb_monolith); ml.addWidget(self.rb_lego); ml.addWidget(self.rb_webp)

        radio_style = """
        QRadioButton::indicator { width: 14px; height: 14px; border-radius: 7px; border: 2px solid #555; background: transparent; }
        QRadioButton::indicator:checked { background-color: #e6e6e6; border: 2px solid #2a2a2a; }
        QRadioButton { spacing:6px; }
        """
        self.rb_monolith.setStyleSheet(radio_style); self.rb_lego.setStyleSheet(radio_style); self.rb_webp.setStyleSheet(radio_style)

        self.convert_btn = AnimatedButton("Convert", is_accent=True); self.convert_btn.setParent(self.extra_controls)
        self.convert_btn.setGeometry(30,90,200,42); self.convert_btn.clicked.connect(self.start_convert)

        self.chk_save_to_source = QCheckBox("Save to source", self.extra_controls)
        self.chk_save_to_source.setGeometry(30,135,200,20); self.chk_save_to_source.stateChanged.connect(self.on_chk_save_changed)

        self.lego_warning_lbl = ClickableLabel("⚠️ Performance Warning (Click for info)", self.extra_controls)
        self.lego_warning_lbl.setFixedWidth(260); self.lego_warning_lbl.setAlignment(Qt.AlignCenter)
        self.lego_warning_lbl.setStyleSheet(f"color: {WARNING_COLOR}; font-size: 11px; text-decoration: underline;")
        self.lego_warning_lbl.clicked.connect(self.show_lego_page); self.lego_warning_lbl.setGeometry(0,160,260,30)
        self.lego_warning_lbl.hide()

        self.stats_label = QLabel("", self.extra_controls)
        self.stats_label.setFixedWidth(260); self.stats_label.setAlignment(Qt.AlignCenter)
        self.stats_label.setStyleSheet("color:#666; text-decoration:underline; font-size: 11px;")
        self.stats_label.setGeometry(0,185,260,30)

        self.extra_opacity = QGraphicsOpacityEffect(self.extra_controls)
        self.extra_controls.setGraphicsEffect(self.extra_opacity); self.extra_opacity.setOpacity(0); self.extra_controls.hide()

        self.select_btn = AnimatedButton("Select Images", padding=15); self.select_btn.setParent(self.main_container)
        self.select_btn.setGeometry(220,310,240,52); self.select_btn.clicked.connect(self.on_select_button)

        self.status_label = QLabel("", self.main_container)
        self.status_label.setFixedWidth(240); self.status_label.setAlignment(Qt.AlignCenter)
        self.status_label.setStyleSheet("color:#aaa; font-size: 11px;")
        self.status_label.setGeometry(220, 410, 240, 30)

        self.proc_label = QLabel(self.main_container)
        self.proc_label.setGeometry(12,8,32,32); self.proc_label.setScaledContents(True)
        if not self.processing_movie.isValid():
            self.proc_label.hide()
        else:
            self.proc_label.setMovie(self.processing_movie)
            self.proc_opacity = QGraphicsOpacityEffect(self.proc_label)
            self.proc_label.setGraphicsEffect(self.proc_opacity)
            self.proc_opacity.setOpacity(0.0)
            self.proc_label.hide()
            self.proc_fade_anim = QPropertyAnimation(self.proc_opacity, b"opacity", self)
            self.proc_fade_anim.setDuration(300); self.proc_fade_anim.setEasingCurve(QEasingCurve.OutCubic)

        self.right_panel = QFrame(self.main_container)
        self.right_panel.setGeometry(680,0,220,600)
        self.right_panel.setStyleSheet(f"background:{APP_BG}; border-left:1px solid #1a1a1a;")
        self.right_layout = QVBoxLayout(self.right_panel)
        header = QWidget(); hl = QHBoxLayout(header)
        self.q_count = QLabel("(0)"); self.q_count.setStyleSheet("color:#555; font-weight:bold;")
        hl.addWidget(QLabel("FILE QUEUE")); hl.addWidget(self.q_count); hl.addStretch()
        self.clear_btn = QPushButton("Clear All"); self.clear_btn.setStyleSheet("color:#777; border:none; font-size:10px; text-decoration:underline; background:transparent;")
        self.clear_btn.setCursor(Qt.PointingHandCursor); self.clear_btn.clicked.connect(self.clear_queue)
        hl.addWidget(self.clear_btn)
        self.scroll = QScrollArea(); self.scroll.setWidgetResizable(True)
        self.scroll.setVerticalScrollBarPolicy(Qt.ScrollBarAlwaysOff); self.scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        self.scroll.setStyleSheet("border:none; background:transparent;")
        self.queue_widget = QWidget(); self.queue_layout = QVBoxLayout(self.queue_widget); self.queue_layout.setAlignment(Qt.AlignTop)
        self.scroll.setWidget(self.queue_widget); self.right_layout.addWidget(header); self.right_layout.addWidget(self.scroll)

    def on_select_button(self):
        menu = QMenu(self)
        act_files = menu.addAction("Select Images...")
        act_folder = menu.addAction("Add Folder...")
        action = menu.exec(self.select_btn.mapToGlobal(self.select_btn.rect().bottomLeft()))
        if action == act_files:
            self.select_images_files()
        elif action == act_folder:
            self.add_folder_dialog()

    def select_images_files(self):
        files, _ = QFileDialog.getOpenFileNames(self, "Select Images", "", "Images (*.png *.jpg *.jpeg *.gif)")
        if not files: return
        self._show_processing_transient()
        for f in files:
            if f not in self.selected_files: self.selected_files.append(f)
        self.refresh_file_list()

    def add_folder_dialog(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Folder to Add")
        if folder:
            self._show_processing_transient()
            if folder not in self.selected_files: self.selected_files.append(folder)
            self.refresh_file_list()

    def update_stats(self):
        is_lego = self.rb_lego.isChecked()
        self.lego_warning_lbl.setVisible(is_lego)
        if is_lego:
            self.extra_controls.raise_(); self.lego_warning_lbl.raise_()
        if not self.selected_files or not is_lego:
            self.stats_label.setText("")
            if not is_lego: self.lego_warning_lbl.hide()
            return
        total = 0
        for p in self.selected_files:
            if os.path.isdir(p):
                for root, dirs, files in os.walk(p):
                    for name in files:
                        if name.lower().endswith(('.png','.jpg','.jpeg','.gif')):
                            try:
                                im = Image.open(os.path.join(root, name))
                                total += im.size[0]*im.size[1]; im.close()
                            except Exception:
                                continue
            else:
                try:
                    im = Image.open(p); total += im.size[0]*im.size[1]; im.close()
                except Exception:
                    continue
        color = WARNING_COLOR if total > LEGO_DANGER_LIMIT else "#666"
        self.stats_label.setText(f"Lego Mode: ~{total:,} shapes")
        self.stats_label.setStyleSheet(f"color:{color}; text-decoration:underline; font-size: 11px;")

    def refresh_file_list(self):
        count = len(self.selected_files); self.q_count.setText(f"({count})")
        if count > 0 and self.right_panel.pos().x() >= 680: self.animate_transition(True)
        elif count == 0 and self.right_panel.pos().x() < 680: self.animate_transition(False)
        for i in reversed(range(self.queue_layout.count())):
            w = self.queue_layout.itemAt(i).widget()
            if w: w.setParent(None)
        mode_is_webp = self.rb_webp.isChecked()
        for f in self.selected_files:
            row = QWidget(); rl = QHBoxLayout(row); rl.setContentsMargins(5,2,5,2)
            display_name = os.path.basename(f) + ("/" if os.path.isdir(f) else "")
            lbl = FileLabel(display_name, f, app=self)
            not_pixel_art = False
            if not os.path.isdir(f) and f.lower().endswith(('.png','.jpg','.jpeg','.gif')):
                try:
                    im = Image.open(f)
                    w,h = im.size
                    if w > 512 or h > 512:
                        not_pixel_art = True
                    im.close()
                except Exception:
                    not_pixel_art = False
            lbl.not_pixel_art = not_pixel_art
            if not_pixel_art and not mode_is_webp:
                lbl.setStyleSheet(f"color: {WARNING_COLOR};")
            else:
                lbl.setStyleSheet("color: #e6e6e6;")
            lbl.setText(lbl.fontMetrics().elidedText(display_name, Qt.ElideRight, 150))
            btn = QPushButton("×"); btn.setFixedSize(24,24); btn.setCursor(Qt.PointingHandCursor)
            btn.setStyleSheet("border:none; color:#777; font-weight:bold; font-size:18px; background:transparent;")
            btn.clicked.connect(lambda _, p=f: self.remove_file(p))
            rl.addWidget(lbl,1); rl.addWidget(btn)
            self.queue_layout.addWidget(row)
        self.update_stats()
        try:
            self.extra_controls.raise_()
        except Exception:
            pass

    def remove_file(self, path):
        if path in self.selected_files: self.selected_files.remove(path); self.refresh_file_list()

    def clear_queue(self):
        self.selected_files = []; self.refresh_file_list()

    def set_folder(self):
        f = QFileDialog.getExistingDirectory(self, "Select Output Folder")
        if f:
            self.output_folder = f
            self.show_status("Folder selected")

    def start_convert(self):
        save_next = self.chk_save_to_source.isChecked()
        self.folder_btn.setEnabled(not save_next)
        if not save_next and not self.output_folder:
            self.show_status("Select folder!"); return
        if not self.selected_files:
            self.show_status("No files selected"); return
        self.convert_btn.setEnabled(False)
        self._show_processing(True)
        self.show_status("Processing...")
        threading.Thread(target=self.process, daemon=True).start()

    def process(self):
        mode = "webp" if self.rb_webp.isChecked() else ("lego" if self.rb_lego.isChecked() else "monolith")
        save_next = self.chk_save_to_source.isChecked()
        files_to_process = []
        for item in self.selected_files:
            if os.path.isdir(item):
                for root, _, files in os.walk(item):
                    for name in files:
                        if name.lower().endswith(('.png','.jpg','.jpeg','.gif')):
                            files_to_process.append(os.path.join(root, name))
            else:
                files_to_process.append(item)
        total = len(files_to_process)
        if total == 0:
            self.signals.error.emit("No images found to process."); self.signals.finished.emit(); return
        for i, file in enumerate(files_to_process):
            try:
                self.signals.update_status.emit(f"Processing {i+1}/{total}...")
                img = Image.open(file).convert("RGBA")
                w, h = img.size
                if save_next:
                    dest_dir = os.path.dirname(file) or os.getcwd()
                else:
                    dest_dir = self.output_folder
                if not dest_dir: dest_dir = os.path.dirname(file) or os.getcwd()
                if mode == "webp":
                    base = os.path.splitext(os.path.basename(file))[0]; dest = os.path.join(dest_dir, f"{base}.webp")
                    counter = 1
                    while os.path.exists(dest):
                        dest = os.path.join(dest_dir, f"{base}_{counter}.webp"); counter += 1
                    img.save(dest, "WEBP", quality=90, lossless=True)
                elif mode == "lego":
                    pixels = img.load()
                    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" shape-rendering="crispEdges">']
                    for y in range(h):
                        for x in range(w):
                            r,g,b,a = pixels[x,y]
                            if a > 0:
                                svg.append(f'<rect x="{x}" y="{y}" width="1" height="1" fill="#{r:02x}{g:02x}{b:02x}" fill-opacity="{a/255}"/>')
                    svg.append("</svg>")
                    out = "\n".join(svg)
                    dest = os.path.join(dest_dir, f"{os.path.splitext(os.path.basename(file))[0]}.svg")
                    counter = 1
                    while os.path.exists(dest):
                        dest = os.path.join(dest_dir, f"{os.path.splitext(os.path.basename(file))[0]}_{counter}.svg"); counter += 1
                    with open(dest, "w", encoding="utf-8") as f: f.write(out)
                else:
                    pixels = np.asarray(img)
                    colors = np.unique(pixels.reshape(-1,4), axis=0)
                    colors = colors[colors[:,3] != 0]
                    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" shape-rendering="crispEdges">', "<style>"]
                    for idx, c in enumerate(colors):
                        svg.append(f'.c{idx} {{ fill:#{c[0]:02x}{c[1]:02x}{c[2]:02x}; fill-opacity:{c[3]/255}; }}')
                    svg.append("</style>")
                    try:
                        grid = pixels.view(np.uint32).reshape(pixels.shape[0], pixels.shape[1])
                    except Exception:
                        grid = pixels.copy().astype(np.uint32)
                        grid = (grid[:,:,0] << 24) | (grid[:,:,1] << 16) | (grid[:,:,2] << 8) | grid[:,:,3]
                    for idx, c in enumerate(colors):
                        color_int = c.view(np.uint32)[0] if hasattr(c, "view") else int((c[0]<<24)|(c[1]<<16)|(c[2]<<8)|c[3])
                        path_data = path_finding(grid, color_int)
                        svg.append(f'<path class="c{idx}" d="{path_data}"/>')
                    svg.append("</svg>")
                    out = "\n".join(svg)
                    dest = os.path.join(dest_dir, f"{os.path.splitext(os.path.basename(file))[0]}.svg")
                    counter = 1
                    while os.path.exists(dest):
                        dest = os.path.join(dest_dir, f"{os.path.splitext(os.path.basename(file))[0]}_{counter}.svg"); counter += 1
                    with open(dest, "w", encoding="utf-8") as f: f.write(out)
                img.close()
            except Exception as e:
                self.signals.error.emit(str(e)); return
        self.signals.finished.emit()

    def on_process_finished(self):
        self._show_processing(False)
        self.convert_btn.setEnabled(True)
        self.refresh_file_list()
        self.show_status("Done!")

    def animate_transition(self, show_queue):
        self.group = QParallelAnimationGroup()
        self.select_btn.raise_()
        anim_logo = QPropertyAnimation(self.logo_label, b"geometry")
        anim_btn = QPropertyAnimation(self.select_btn, b"geometry")
        anim_status = QPropertyAnimation(self.status_label, b"geometry")
        anim_panel = QPropertyAnimation(self.right_panel, b"pos")
        anim_fade = QPropertyAnimation(self.extra_opacity, b"opacity")
        if show_queue:
            self.extra_controls.show(); self.extra_controls.raise_(); self.status_label.raise_()
            anim_logo.setEndValue(QRect(-110,15,680,240)); anim_btn.setEndValue(QRect(130,260,200,42))
            anim_status.setEndValue(QRect(113,550,260,30)); anim_panel.setEndValue(QPoint(460,0)); anim_fade.setEndValue(1)
            self.select_btn.set_custom_padding(10)
        else:
            anim_logo.setEndValue(QRect(0,40,680,240)); anim_btn.setEndValue(QRect(220,310,240,52))
            anim_status.setEndValue(QRect(220,410,240,30)); anim_panel.setEndValue(QPoint(680,0)); anim_fade.setEndValue(0)
            self.select_btn.set_custom_padding(15)
            self.group.finished.connect(lambda: self.extra_controls.hide() if not self.selected_files else None)
        for a in [anim_logo, anim_btn, anim_status, anim_panel, anim_fade]:
            a.setDuration(600); a.setEasingCurve(QEasingCurve.OutExpo); self.group.addAnimation(a)
        self.group.start()

    def setup_lego_overlay(self):
        self.lego_overlay = QFrame(self); self.lego_overlay.setGeometry(0,600,680,600)
        self.lego_overlay.setStyleSheet(f"background:{APP_BG};")
        glay = QVBoxLayout(self.lego_overlay); glay.setContentsMargins(40,40,40,20)
        t1 = QLabel("LEGO MODE PERFORMANCE WARNING"); t1.setStyleSheet(f"color:{WARNING_COLOR}; font-weight:bold; font-size:18px;"); t1.setAlignment(Qt.AlignCenter)
        t2 = QLabel("Software may lag or crash due to high object count."); t2.setStyleSheet("color:#888; font-size:13px;"); t2.setAlignment(Qt.AlignCenter)
        self.movie = QMovie(resource_path("lego_warning.gif"))
        self.gif_view = QLabel(); self.gif_view.setMovie(self.movie); self.gif_view.setFixedSize(500,350); self.gif_view.setScaledContents(True); self.gif_view.setAlignment(Qt.AlignCenter)
        close_tip = QLabel("<u>Click anywhere to close</u>"); close_tip.setStyleSheet("color:#444; font-size:10px;"); close_tip.setAlignment(Qt.AlignCenter)
        glay.addWidget(t1); glay.addWidget(t2); glay.addStretch(1); glay.addWidget(self.gif_view, 10, Qt.AlignCenter); glay.addStretch(1); glay.addWidget(close_tip)
        self.lego_overlay.mousePressEvent = lambda e: self.hide_lego_page()

    def show_lego_page(self):
        self.lego_overlay.show();
        self.lego_overlay.raise_();
        try:
            self.movie.start()
        except Exception:
            pass
        self.lego_anim = QPropertyAnimation(self.lego_overlay, b"pos"); self.lego_anim.setDuration(400); self.lego_anim.setEndValue(QPoint(0,0)); self.lego_anim.setEasingCurve(QEasingCurve.OutExpo); self.lego_anim.start()

    def hide_lego_page(self):
        self.lego_anim = QPropertyAnimation(self.lego_overlay, b"pos"); self.lego_anim.setDuration(300); self.lego_anim.setEndValue(QPoint(0,600))
        self.lego_anim.finished.connect(self.lego_overlay.hide); self.lego_anim.finished.connect(lambda: self.movie.stop()); self.lego_anim.start()

    def setup_drag_overlay(self):
        self.drag_overlay = QFrame(self); self.drag_overlay.setGeometry(self.rect())
        self.drag_overlay.setStyleSheet(f"background-color: {OVERLAY_COLOR};"); self.drag_overlay.setAttribute(Qt.WA_TransparentForMouseEvents); self.drag_overlay.hide()
        self.drag_opacity = QGraphicsOpacityEffect(self.drag_overlay); self.drag_overlay.setGraphicsEffect(self.drag_opacity)
        lay = QVBoxLayout(self.drag_overlay); self.drop_img = QLabel()
        pix = QPixmap(resource_path("DropUrStuffHere.png"))
        if not pix.isNull(): self.drop_img.setPixmap(pix.scaled(pix.width()//2, pix.height()//2, Qt.KeepAspectRatio, Qt.SmoothTransformation))
        self.drop_img.setAlignment(Qt.AlignCenter); lay.addWidget(self.drop_img)

    def fade_overlay(self, show=True):
        if show:
            self.drag_overlay.show(); self.drag_overlay.raise_(); self.drag_overlay.setAttribute(Qt.WA_TransparentForMouseEvents, False)
            self.anim_drag = QPropertyAnimation(self.drag_opacity, b"opacity"); self.anim_drag.setDuration(250); self.anim_drag.setStartValue(0.0); self.anim_drag.setEndValue(1.0); self.anim_drag.start()
        else:
            self.drag_overlay.setAttribute(Qt.WA_TransparentForMouseEvents, True)
            self.anim_drag = QPropertyAnimation(self.drag_opacity, b"opacity"); self.anim_drag.setDuration(250); self.anim_drag.setEndValue(0.0); self.anim_drag.finished.connect(self.drag_overlay.hide); self.anim_drag.start()

    def dragEnterEvent(self, e):
        if e.mimeData().hasUrls():
            e.acceptProposedAction(); self.fade_overlay(True)

    def dragLeaveEvent(self, e):
        self.fade_overlay(False)

    def dropEvent(self, e):
        if not e.mimeData().hasUrls():
            return
        e.acceptProposedAction()
        self.fade_overlay(False)
        self._show_processing_transient()
        added = False
        for u in e.mimeData().urls():
            local = u.toLocalFile()
            if not local:
                continue
            try:
                if os.path.isdir(local):
                    if local not in self.selected_files:
                        self.selected_files.append(local); added = True
                elif local.lower().endswith(('.png','.jpg','.jpeg','.gif')):
                    if local not in self.selected_files:
                        self.selected_files.append(local); added = True
                else:
                    continue
            except Exception:
                continue
        if added:
            self.refresh_file_list()

    def _update_folder_btn_state(self):
        try:
            save_next = getattr(self, 'chk_save_to_source', None) and self.chk_save_to_source.isChecked()
            self.folder_btn.setEnabled(not save_next)
        except Exception:
            pass

    def on_chk_save_changed(self, _state):
        self._update_folder_btn_state()

if __name__ == "__main__":
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(u'zackgphom.glorp.v3')
    except Exception:
        pass
    app = QApplication(sys.argv)
    fav_path = resource_path("favicon.png")
    if os.path.exists(fav_path):
        app.setWindowIcon(QIcon(fav_path))
    win = GlorpApp()
    win.show()
    sys.exit(app.exec())
