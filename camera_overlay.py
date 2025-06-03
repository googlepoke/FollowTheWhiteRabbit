# pip install opencv-python PyQt5 numpy

import sys
import cv2
import numpy as np
from PyQt5.QtWidgets import (
    QApplication, QWidget, QLabel, QVBoxLayout, QHBoxLayout,
    QComboBox, QCheckBox, QMessageBox
)
from PyQt5.QtCore import QTimer, Qt
from PyQt5.QtGui import QImage, QPixmap

class CameraOverlayApp(QWidget):
    def __init__(self):
        super().__init__()
        # Always-on-top flag
        self.setWindowFlags(self.windowFlags() | Qt.WindowStaysOnTopHint)
        self.setWindowTitle("Camera Overlay")
        self.resize(800, 600)

        # Camera capture object
        self.cap = None

        # Camera enumeration
        self.cameras = self.scan_cameras()
        if not self.cameras:
            QMessageBox.critical(self, "Error", "No cameras found.")
            sys.exit(1)

        # GUI setup
        self.init_ui()

        # Start default camera
        default_cam = self.cameras[0]
        self.open_camera(default_cam)

        # Frame update timer
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.update_frame)
        self.timer.start(30)

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
        controls = QHBoxLayout()

        # Camera dropdown
        self.camera_selector = QComboBox()
        for idx in self.cameras:
            self.camera_selector.addItem(f"Camera {idx}", idx)
        self.camera_selector.currentIndexChanged.connect(self.on_camera_change)

        # Toggle checkboxes
        self.square_cb = QCheckBox("Square Frame")
        self.square_cb.stateChanged.connect(self.on_style_change)
        self.circle_cb = QCheckBox("Circle Frame")
        self.circle_cb.stateChanged.connect(self.on_style_change)

        controls.addWidget(self.camera_selector)
        controls.addWidget(self.square_cb)
        controls.addWidget(self.circle_cb)
        layout.addLayout(controls)

        # Video display label
        self.video_label = QLabel()
        self.video_label.setAlignment(Qt.AlignCenter)
        layout.addWidget(self.video_label)

        self.setLayout(layout)

    def open_camera(self, index):
        """Open the selected camera index for video capture."""
        if self.cap:
            self.cap.release()
        self.cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
        if not self.cap.isOpened():
            QMessageBox.critical(self, "Error", f"Cannot open camera {index}")
            sys.exit(1)

    def on_camera_change(self, idx):
        """Handle camera selection change from the dropdown."""
        cam_idx = self.camera_selector.currentData()
        self.open_camera(cam_idx)

    def on_style_change(self, state):
        """Handle toggling of square/circle frame options."""
        # Styles are applied in update_frame
        pass

    def update_frame(self):
        """Capture frame, apply masking/cropping, and display it."""
        if not self.cap:
            return
        ret, frame = self.cap.read()
        if not ret:
            return

        # Square cropping
        if self.square_cb.isChecked():
            h, w = frame.shape[:2]
            m = min(h, w)
            x = (w - m) // 2
            y = (h - m) // 2
            frame = frame[y:y+m, x:x+m]

        # Circular mask
        if self.circle_cb.isChecked():
            h, w = frame.shape[:2]
            mask = np.zeros((h, w), dtype=np.uint8)
            center = (w//2, h//2)
            radius = min(w, h)//2
            cv2.circle(mask, center, radius, 255, -1)
            mask_3ch = cv2.merge([mask, mask, mask])
            frame = cv2.bitwise_and(frame, mask_3ch)

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

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = CameraOverlayApp()
    window.show()
    sys.exit(app.exec_()) 