# 1pip install opencv-python PyQt5 numpy

import sys
import os
import cv2
import numpy as np
from PyQt5.QtWidgets import (
    QApplication, QWidget, QLabel, QVBoxLayout, QHBoxLayout,
    QMessageBox, QSizePolicy, QShortcut, QSizeGrip
)
from PyQt5.QtCore import QTimer, Qt, QPoint
from PyQt5.QtGui import QImage, QPixmap, QKeySequence

class CameraOverlayApp(QWidget):
    def __init__(self):
        super().__init__()
        # Always-on-top, frameless, and fully transparent background window
        self.setWindowFlags(self.windowFlags() | Qt.WindowStaysOnTopHint | Qt.FramelessWindowHint)
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setWindowTitle("Camera Overlay")
        self.resize(800, 600)
        # Allow window to be resized as small as OS permits
        self.setMinimumSize(1, 1)

        # Camera capture object
        self.cap = None

        # Camera enumeration and current index
        self.cameras = self.scan_cameras()
        if not self.cameras:
            QMessageBox.critical(self, "Error", "No cameras found.")
            sys.exit(1)
        self.current_camera_idx = 0
        # Load default logo for overlay
        logo_path = os.path.join(os.path.dirname(__file__), "logo.png")
        self.logo = cv2.imread(logo_path, cv2.IMREAD_UNCHANGED)
        if self.logo is None:
            QMessageBox.warning(self, "Warning", f"Logo file '{logo_path}' not found. Continuing without logo.")

        # GUI setup
        self.init_ui()

        # Start default camera
        self.open_camera(self.cameras[self.current_camera_idx])
        # Shortcut to cycle cameras: Ctrl+Shift+Up
        self.next_cam_shortcut = QShortcut(QKeySequence("Ctrl+Shift+Up"), self)
        self.next_cam_shortcut.activated.connect(self.cycle_camera)
        # Shortcut to toggle square frame: Ctrl+Shift+Right
        self.toggle_square_shortcut = QShortcut(QKeySequence("Ctrl+Shift+Right"), self)
        self.toggle_square_shortcut.activated.connect(self.on_style_change)
        # Shortcut for help: F1
        self.help_shortcut = QShortcut(QKeySequence("F1"), self)
        self.help_shortcut.activated.connect(self.show_help)
        # Shortcut to close application: Escape
        self.escape_shortcut = QShortcut(QKeySequence(Qt.Key_Escape), self)
        self.escape_shortcut.activated.connect(self.close)

        # Frame update timer
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(30)

        # Initialize drag/resize state
        self._dragging = False
        self._resizing = False

        # Square frame toggle state (controlled via shortcut)
        self.square_enabled = False

    def scan_cameras(self):
        """Detect available cameras by attempting to open indices 0-9."""
        available = []
        for i in range(10):
            cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
            if cap.isOpened():
                available.append(i)
                cap.release()
        return available

    def init_ui(self):
        """Set up GUI components: camera selector and toggles."""
        layout = QVBoxLayout()

        # Video display label
        self.video_label = QLabel()
        self.video_label.setAlignment(Qt.AlignCenter)
        # Allow video label to shrink below its size hint
        self.video_label.setMinimumSize(1, 1)
        self.video_label.setSizePolicy(QSizePolicy.Ignored, QSizePolicy.Ignored)
        # Make video_label transparent to mouse events so parent can handle drag/resize
        self.video_label.setAttribute(Qt.WA_TransparentForMouseEvents)
        layout.addWidget(self.video_label)

        # Resize handle (visible grip) at bottom-right
        grip_layout = QHBoxLayout()
        grip_layout.addStretch()
        self.size_grip = QSizeGrip(self)
        grip_layout.addWidget(self.size_grip)
        layout.addLayout(grip_layout)

        self.setLayout(layout)

    def open_camera(self, index):
        """Open the selected camera index for video capture."""
        if self.cap:
            self.cap.release()
        self.cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        if not self.cap.isOpened():
            QMessageBox.critical(self, "Error", f"Cannot open camera {index}")
            sys.exit(1)

    def on_style_change(self):
        """Toggle square frame cropping."""
        self.square_enabled = not self.square_enabled

    def update_frame(self):
        """Capture frame, apply masking/cropping, overlay logo, and display it."""
        if not self.cap:
            return
        ret, frame = self.cap.read()
        if not ret:
            return

        # Square cropping
        if self.square_enabled:
            h, w = frame.shape[:2]
            m = min(h, w)
            x = (w - m) // 2
            y = (h - m) // 2
            frame = frame[y:y+m, x:x+m]

        # Overlay logo in top-right corner at 1/10th of frame width
        if hasattr(self, 'logo') and self.logo is not None:
            fh, fw = frame.shape[:2]
            lh, lw = self.logo.shape[:2]
            new_w = fw // 10
            scale = new_w / lw
            new_h = int(lh * scale)
            logo_resized = cv2.resize(self.logo, (new_w, new_h), interpolation=cv2.INTER_AREA)
            x_offset = fw - new_w - 10
            y_offset = 10
            # overlay with alpha channel if present
            if logo_resized.shape[2] == 4:
                alpha = logo_resized[:, :, 3] / 255.0
                for c in range(3):
                    frame[y_offset:y_offset+new_h, x_offset:x_offset+new_w, c] = (
                        alpha * logo_resized[:, :, c] +
                        (1 - alpha) * frame[y_offset:y_offset+new_h, x_offset:x_offset+new_w, c]
                    ).astype(frame.dtype)
            else:
                frame[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = logo_resized

        # Convert BGR to RGB and to QImage
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h, w, ch = rgb.shape
        bytes_per_line = ch * w
        qt_img = QImage(rgb.data, w, h, bytes_per_line, QImage.Format_RGB888)

        # Convert to QPixmap and scale
        pixmap = QPixmap.fromImage(qt_img)
        pixmap = pixmap.scaled(
            self.video_label.size(), Qt.KeepAspectRatio, Qt.SmoothTransformation
        )
        self.video_label.setPixmap(pixmap)

    def closeEvent(self, event):
        """Release camera and cleanup on application close."""
        if self.cap:
            self.cap.release()
        event.accept()

    def cycle_camera(self):
        """Cycle to the next camera in the list."""
        self.current_camera_idx = (self.current_camera_idx + 1) % len(self.cameras)
        self.open_camera(self.cameras[self.current_camera_idx])

    def show_help(self):
        """Display help dialog listing shortcuts and controls."""
        help_text = (
            "Shortcut Keys and Controls:\n"
            "Ctrl+Shift+Up: Cycle through available cameras\n"
            "Ctrl+Shift+Right: Toggle square framing\n"
            "F1: Display this help dialog\n"
            "Escape: Close the application\n\n"
            "Window Controls:\n"
            "- Click and drag anywhere to move the window\n"
            "- Use the resize handle (bottom-right) to resize the window"
        )
        QMessageBox.information(self, "Help", help_text)

    def mousePressEvent(self, event):
        """Enable window dragging and corner resizing."""
        if event.button() == Qt.LeftButton:
            pos = event.pos()
            margin = 10
            w = self.width()
            h = self.height()
            if pos.x() >= w - margin and pos.y() >= h - margin:
                self._resizing = True
                self._resize_start_geom = self.geometry()
                self._resize_start_pos = event.globalPos()
            else:
                self._dragging = True
                self._drag_offset = event.globalPos() - self.frameGeometry().topLeft()
        super().mousePressEvent(event)

    def mouseMoveEvent(self, event):
        if self._resizing:
            delta = event.globalPos() - self._resize_start_pos
            new_w = max(1, self._resize_start_geom.width() + delta.x())
            new_h = max(1, self._resize_start_geom.height() + delta.y())
            self.resize(new_w, new_h)
        elif self._dragging:
            new_pos = event.globalPos() - self._drag_offset
            self.move(new_pos)
        else:
            super().mouseMoveEvent(event)

    def mouseReleaseEvent(self, event):
        self._dragging = False
        self._resizing = False
        super().mouseReleaseEvent(event)

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = CameraOverlayApp()
    window.show()
    sys.exit(app.exec_()) 