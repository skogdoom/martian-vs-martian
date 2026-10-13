// Canvas paths preserve curved strokes/caps; Phaser displays the generated texture.
export function colorCss(color) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function multiplyColor(a, b) {
  let color = 0;
  for (const shift of [16, 8, 0]) color |= Math.round((((a >> shift) & 255) * ((b >> shift) & 255)) / 255) << shift;
  return color;
}

export function path(ctx, draw, { fill, stroke, width = 1, alpha = 1, cap = 'butt', join = 'miter' }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  draw(ctx);
  if (fill !== undefined) {
    ctx.fillStyle = colorCss(fill);
    ctx.fill();
  }
  if (stroke !== undefined) {
    ctx.strokeStyle = colorCss(stroke);
    ctx.lineWidth = width;
    ctx.lineCap = cap;
    ctx.lineJoin = join;
    ctx.stroke();
  }
  ctx.restore();
}

export function ellipse(ctx, x, y, rx, ry, style) {
  path(ctx, (p) => p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2), style);
}

export function circle(ctx, x, y, radius, style) {
  ellipse(ctx, x, y, radius, radius, style);
}

export function rect(ctx, x, y, width, height, style) {
  path(ctx, (p) => p.rect(x, y, width, height), style);
}

export function roundRect(ctx, x, y, width, height, radius, style) {
  path(ctx, (p) => p.roundRect(x, y, width, height, radius), style);
}

export function polygon(ctx, points, style) {
  path(
    ctx,
    (p) => {
      p.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) p.lineTo(points[i], points[i + 1]);
      p.closePath();
    },
    style,
  );
}

export function starPoints(x, y, points, outer, inner, rotation = 0) {
  const vertices = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + rotation + (i * Math.PI) / points;
    const radius = i % 2 ? inner : outer;
    vertices.push(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  }
  return vertices;
}
