let faceX = 0;
let faceY = 0;
let faceWidth = 400;
let faceHeight = 550;
let blinkLoaded = false;

let currentTool = "blush";
window.addEventListener("keydown", (e) => {
  if (e.key === "b") currentTool = "blush";
  if (e.key === "l") currentTool = "lip";
});

const canvas = document.getElementById("faceCanvas");
const ctx = canvas.getContext("2d");

const makeupCanvas = document.createElement("canvas");
const makeupCtx = makeupCanvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  makeupCanvas.width = canvas.width;
  makeupCanvas.height = canvas.height;
}


resizeCanvas();
window.addEventListener("resize", resizeCanvas);
const faceImage = new Image();
faceImage.src = "assets/face.png";

faceImage.onload = () => {
  drawFace();
  startBlinking();
};


const blinkImage = new Image();
blinkImage.src = "assets/face_blink.png";

blinkImage.onload = () => {
  blinkLoaded = true;
};


let isBlinking = false;


function drawFace() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  faceX = (canvas.width - faceWidth) / 2;
  faceY = (canvas.height - faceHeight) / 2;

  const imgToDraw = (isBlinking && blinkLoaded)
    ? blinkImage
    : faceImage;

  // Draw face once
  ctx.drawImage(imgToDraw, faceX, faceY, faceWidth, faceHeight);

  // Draw makeup ON TOP
  ctx.drawImage(makeupCanvas, 0, 0);
}


// redraw makeup layers after face


function startBlinking() {
  function blink() {
    isBlinking = true;
    drawFace();

   setTimeout(() => {
  isBlinking = false;
  drawFace();
}, 120); // natural blink

    const nextBlink = 2500 + Math.random() * 2000;
    setTimeout(blink, nextBlink);
  }

  blink();
}



let isApplyingBlush = false;
canvas.addEventListener("mousedown", () => {
  isApplyingBlush = true;
});

canvas.addEventListener("mouseup", () => {
  isApplyingBlush = false;
});

canvas.addEventListener("mouseleave", () => {
  isApplyingBlush = false;
});

canvas.addEventListener("mousemove", (e) => {
  if (!isApplyingBlush) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if (currentTool === "blush") {
    applyBlush(x, y);
  } else if (currentTool === "lip") {
    applyLipTint(x, y);
  }
});

function applyBlush(x, y) {
  const radius = 40;

  const gradient = makeupCtx.createRadialGradient(
    x, y, 0,
    x, y, radius
  );

  gradient.addColorStop(0, "rgba(255, 120, 150, 0.08)");
  gradient.addColorStop(1, "rgba(255, 120, 150, 0)");

  makeupCtx.fillStyle = gradient;
  makeupCtx.beginPath();
  makeupCtx.arc(x, y, radius, 0, Math.PI * 2);
  makeupCtx.fill();

  drawFace(); // 🔥 re-compose after drawing
}

function getLipsArea() {
  return {
    x: faceX + faceWidth / 2,
    y: faceY + 288,   // 👈 THIS IS THE FIX
    width: 120,
    height: 30
  };
}


function applyLipTint(x, y) {
  const lips = getLipsArea();

  // Outside lips? Do nothing.
  if (
    x < lips.x - lips.width / 2 ||
    x > lips.x + lips.width / 2 ||
    y < lips.y - lips.height / 2 ||
    y > lips.y + lips.height / 2
  ) return;

  const isUpperLip = y < lips.y; // 🔥 THIS IS THE KEY LINE

  const radius = 8;

  const gradient = makeupCtx.createRadialGradient(
    x, y, 0,
    x, y, radius
  );

  if (isUpperLip) {
    // Upper lip = slightly muted, deeper
    gradient.addColorStop(0, "rgba(170, 60, 80, 0.065)");
    gradient.addColorStop(1, "rgba(170, 60, 80, 0)");
  } else {
    // Lower lip = juicier, softer
    gradient.addColorStop(0, "rgba(190, 75, 95, 0.08)");
    gradient.addColorStop(1, "rgba(190, 75, 95, 0)");
  }

  makeupCtx.fillStyle = gradient;
  makeupCtx.beginPath();
  makeupCtx.arc(x, y, radius, 0, Math.PI * 2);
  makeupCtx.fill();

  if (!isUpperLip) {
  applyLipGloss(x, y);
}

drawFace();

}

function applyLipGloss(x, y) {
  const lips = getLipsArea();

  // Only lower lip
  if (y < lips.y) return;

  const radius = 5;

  const gradient = makeupCtx.createRadialGradient(
    x, y, 0,
    x, y, radius
  );

  gradient.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  makeupCtx.globalCompositeOperation = "screen"; // ✨ LIGHT BLEND
  makeupCtx.fillStyle = gradient;
  makeupCtx.beginPath();
  makeupCtx.arc(x, y, radius, 0, Math.PI * 2);
  makeupCtx.fill();
  makeupCtx.globalCompositeOperation = "source-over"; // reset
}


