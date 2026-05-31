/** Square avatar crop — returns a JPEG File for upload. */

const VIEW = 280;
const OUTPUT = 512;

let dialog;
let canvas;
let zoomInput;
let img = null;
let scale = 1;
let zoom = 1;
let offsetX = 0;
let offsetY = 0;
let dragging = false;
let dragStart = { x: 0, y: 0, ox: 0, oy: 0 };
let resolveCrop;
let rejectCrop;

function clampOffsets() {
  if (!img) return;
  const w = img.naturalWidth * scale * zoom;
  const h = img.naturalHeight * scale * zoom;
  const maxX = Math.max(0, (w - VIEW) / 2);
  const maxY = Math.max(0, (h - VIEW) / 2);
  offsetX = Math.min(maxX, Math.max(-maxX, offsetX));
  offsetY = Math.min(maxY, Math.max(-maxY, offsetY));
}

function drawPreview() {
  if (!canvas || !img) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, VIEW, VIEW);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, VIEW, VIEW);
  ctx.clip();
  const w = img.naturalWidth * scale * zoom;
  const h = img.naturalHeight * scale * zoom;
  ctx.drawImage(img, VIEW / 2 - w / 2 + offsetX, VIEW / 2 - h / 2 + offsetY, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, VIEW - 2, VIEW - 2);
}

function resetTransform() {
  if (!img) return;
  scale = Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight);
  zoom = 1;
  offsetX = 0;
  offsetY = 0;
  if (zoomInput) zoomInput.value = '1';
  drawPreview();
}

function canvasPoint(evt) {
  const rect = canvas.getBoundingClientRect();
  const clientX = evt.touches?.[0]?.clientX ?? evt.clientX;
  const clientY = evt.touches?.[0]?.clientY ?? evt.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function onPointerDown(evt) {
  evt.preventDefault();
  dragging = true;
  const p = canvasPoint(evt);
  dragStart = { x: p.x, y: p.y, ox: offsetX, oy: offsetY };
}

function onPointerMove(evt) {
  if (!dragging) return;
  evt.preventDefault();
  const p = canvasPoint(evt);
  offsetX = dragStart.ox + (p.x - dragStart.x);
  offsetY = dragStart.oy + (p.y - dragStart.y);
  clampOffsets();
  drawPreview();
}

function onPointerUp() {
  dragging = false;
}

function exportCroppedFile() {
  const out = document.createElement('canvas');
  out.width = OUTPUT;
  out.height = OUTPUT;
  const ctx = out.getContext('2d');
  const displayW = img.naturalWidth * scale * zoom;
  const displayH = img.naturalHeight * scale * zoom;
  const r = OUTPUT / VIEW;
  ctx.drawImage(
    img,
    OUTPUT / 2 - (displayW * r) / 2 + offsetX * r,
    OUTPUT / 2 - (displayH * r) / 2 + offsetY * r,
    displayW * r,
    displayH * r
  );
  const sourceName = dialog?.dataset.sourceName || 'avatar';
  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not crop photo.'));
          return;
        }
        const base = sourceName.replace(/\.[^.]+$/, '') || 'avatar';
        resolve(new File([blob], `${base}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92
    );
  });
}

function closeDialog() {
  dialog?.close();
  img = null;
}

export function initAvatarCrop() {
  dialog = document.getElementById('avatar-crop-dialog');
  canvas = document.getElementById('avatar-crop-canvas');
  zoomInput = document.getElementById('avatar-crop-zoom');
  if (!dialog || !canvas || dialog.dataset.bound) return;
  dialog.dataset.bound = '1';

  canvas.width = VIEW;
  canvas.height = VIEW;

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('touchstart', onPointerDown, { passive: false });
  canvas.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp);

  zoomInput?.addEventListener('input', () => {
    zoom = Number(zoomInput.value) || 1;
    clampOffsets();
    drawPreview();
  });

  document.getElementById('avatar-crop-cancel')?.addEventListener('click', () => {
    closeDialog();
    rejectCrop?.(new Error('cancelled'));
    resolveCrop = null;
    rejectCrop = null;
  });

  document.getElementById('avatar-crop-apply')?.addEventListener('click', async () => {
    try {
      const file = await exportCroppedFile();
      closeDialog();
      resolveCrop?.(file);
    } catch (err) {
      rejectCrop?.(err);
    }
    resolveCrop = null;
    rejectCrop = null;
  });

  dialog.addEventListener('close', () => {
    if (resolveCrop) {
      rejectCrop?.(new Error('cancelled'));
      resolveCrop = null;
      rejectCrop = null;
    }
  });
}

export function openAvatarCrop(file) {
  initAvatarCrop();
  if (!dialog || !canvas) return Promise.reject(new Error('Crop UI not available.'));

  return new Promise((resolve, reject) => {
    resolveCrop = resolve;
    rejectCrop = reject;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      img = image;
      dialog.dataset.sourceName = file.name || 'avatar';
      resetTransform();
      dialog.showModal();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load photo.'));
    };
    image.src = url;
  });
}
