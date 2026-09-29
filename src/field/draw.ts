import type { RackId } from '../sim/types';
import type { ModeledRackInput } from './diffusion';
import type { Geometry } from './geometry';
import type { Streamline } from './streamlines';
import {
  CHIP_BG,
  CHIP_INK,
  CHIP_STROKE_CALM,
  CRAC,
  CRAC_FILL,
  CRAC_INK_BOOSTED,
  CRAC_INK_IDLE,
  CRAC_STROKE_BOOSTED,
  CRAC_STROKE_IDLE,
  GH,
  GW,
  MODELED_RACK_IDS,
  RACK_DOWN_FILL,
  RACK_DOWN_STROKE,
  RACK_FILL,
  RACK_LABEL_CALM,
  RACK_STROKE_CALM,
  STATE_COLOR,
  STREAM_ALPHA_IDLE,
  STREAM_ALPHA_BOOSTED,
  STREAM_BASE_ALPHA,
  STREAM_DASH_BOOSTED,
  STREAM_DASH_IDLE,
  STREAM_DASH_SPEED_BOOSTED,
  STREAM_DASH_SPEED_IDLE,
  STREAM_DASH_WIDTH_BOOSTED,
  STREAM_DASH_WIDTH_IDLE,
  STREAM_MID_ALPHA_FACTOR,
  STROKE_CHIP,
  STROKE_CRAC_BOOSTED,
  STROKE_CRAC_IDLE,
  STROKE_RACK_ALERT,
  STROKE_RACK_CALM,
  STROKE_RACK_DOWN,
  STROKE_RACK_DOWN_DASH,
  STROKE_RACK_FOCUSED,
  STROKE_STREAM_BOOSTED,
  STROKE_STREAM_IDLE,
  streamMid,
  streamNear,
} from './tokens';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

export interface DrawFieldInput {
  ctx: CanvasRenderingContext2D;
  cw: number;
  ch: number;
  /** RGBA bytes, GW*GH*4 long — the caller owns this buffer and has already painted it from U via the LUT. */
  heatImage: ImageData;
  offscreen: CanvasRenderingContext2D;
  geometry: Geometry;
  modeled: Record<RackId, ModeledRackInput>;
  focus: RackId;
  boosted: boolean;
  aim: RackId;
  streamlines: (boost: boolean, aim: RackId) => Streamline[];
  reducedMotion: boolean;
}

/** reference/prototype.html's drawField(): the heat image, rack outlines/labels, streamlines, live chips, CRAC-3. */
export function drawField(input: DrawFieldInput): void {
  const { ctx, cw, ch, heatImage, offscreen, geometry, modeled, focus, boosted, aim, streamlines, reducedMotion } = input;
  if (!cw || !ch) return;

  offscreen.putImageData(heatImage, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(offscreen.canvas, 0, 0, cw, ch);

  const sx = cw / GW;
  const sy = ch / GH;
  const fs = clamp(sy * 2, 9, 11.5);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const r of geometry.racks) {
    const m = (MODELED_RACK_IDS as string[]).includes(r.id) ? modeled[r.id as RackId] : undefined;
    const alert = !!m && m.state !== 'calm' && !m.down;
    const foc = alert && r.id === focus;
    const x = r.x * sx + 1.5;
    const y = r.y * sy;
    const w = r.w * sx - 3;
    const h = r.h * sy;
    roundRectPath(ctx, x, y, w, h, Math.min(5, h / 3));

    if (m?.down) {
      ctx.fillStyle = RACK_DOWN_FILL;
      ctx.fill();
      ctx.setLineDash(STROKE_RACK_DOWN_DASH);
      ctx.lineWidth = STROKE_RACK_DOWN;
      ctx.strokeStyle = RACK_DOWN_STROKE;
      ctx.stroke();
      ctx.setLineDash([]);
      if (h > 13) {
        ctx.font = `650 ${fs}px Archivo, sans-serif`;
        ctx.fillStyle = RACK_DOWN_STROKE;
        ctx.fillText(`${r.id} off`, x + w / 2, y + h / 2 + 0.5);
      }
      continue;
    }

    ctx.fillStyle = RACK_FILL;
    ctx.fill();
    if (foc) {
      ctx.save();
      ctx.shadowColor = STATE_COLOR[m!.state];
      ctx.shadowBlur = 14;
    }
    ctx.lineWidth = foc ? STROKE_RACK_FOCUSED : alert ? STROKE_RACK_ALERT : STROKE_RACK_CALM;
    ctx.strokeStyle = alert ? STATE_COLOR[m!.state] : RACK_STROKE_CALM;
    ctx.stroke();
    if (foc) ctx.restore();
    if (h > 13) {
      ctx.font = `${alert ? 650 : 500} ${fs}px Archivo, sans-serif`;
      ctx.fillStyle = alert ? STATE_COLOR[m!.state] : RACK_LABEL_CALM;
      ctx.fillText(r.id, x + w / 2, y + h / 2 + 0.5);
    }
  }

  drawStreams({ ctx, boosted, aim, streamlines, reducedMotion, sx, sy });

  // live chips on the aisle side of each alerting rack
  for (const id of MODELED_RACK_IDS) {
    const m = modeled[id];
    if (id !== 'B-07' && m.state === 'calm') continue;
    const h = geometry.racks[geometry.rackIndex[id]];
    const cy = (h.y + h.h / 2) * sy - (boosted && id === aim ? h.h * sy * 0.8 : 0); // clear the airflow's path
    const label = m.down ? 'Offline' : m.T >= 35 ? `${m.T.toFixed(1)}° throttling` : `${m.T.toFixed(1)}°`;
    ctx.font = '650 12px Archivo, sans-serif';
    const tw = ctx.measureText(label).width + 14;
    const cx = h.side ? h.x * sx - 8 - tw : (h.x + h.w) * sx + 8;
    roundRectPath(ctx, cx, cy - 11, tw, 22, 11);
    ctx.fillStyle = CHIP_BG;
    ctx.fill();
    ctx.strokeStyle = m.down ? RACK_DOWN_STROKE : m.state === 'calm' ? CHIP_STROKE_CALM : STATE_COLOR[m.state];
    ctx.lineWidth = STROKE_CHIP;
    ctx.stroke();
    ctx.fillStyle = CHIP_INK;
    ctx.fillText(label, cx + tw / 2, cy + 0.5);
  }

  // CRAC-3 at the aisle end
  const cx0 = CRAC.x * sx;
  const cy0 = CRAC.y * sy;
  const cwid = CRAC.w * sx;
  const chgt = Math.max(CRAC.minPixelHeight, CRAC.h * sy - 4);
  roundRectPath(ctx, cx0, cy0, cwid, chgt, 7);
  ctx.fillStyle = CRAC_FILL;
  ctx.fill();
  ctx.lineWidth = boosted ? STROKE_CRAC_BOOSTED : STROKE_CRAC_IDLE;
  ctx.strokeStyle = boosted ? CRAC_STROKE_BOOSTED : CRAC_STROKE_IDLE;
  ctx.stroke();
  ctx.font = `${boosted ? 650 : 500} 11px Archivo, sans-serif`;
  ctx.fillStyle = boosted ? CRAC_INK_BOOSTED : CRAC_INK_IDLE;
  ctx.fillText(boosted ? 'CRAC-3 at 100%' : 'CRAC-3 at 60%', cx0 + cwid / 2, cy0 + chgt / 2 + 0.5);
}

interface DrawStreamsInput {
  ctx: CanvasRenderingContext2D;
  boosted: boolean;
  aim: RackId;
  streamlines: (boost: boolean, aim: RackId) => Streamline[];
  reducedMotion: boolean;
  sx: number;
  sy: number;
}

/** reference/prototype.html's drawStreams(): CRAC-3's airflow as glowing, optionally-dashed streamlines. */
function drawStreams({ ctx, boosted, aim, streamlines, reducedMotion, sx, sy }: DrawStreamsInput): void {
  const lines = streamlines(boosted, aim);
  const g = ctx.createLinearGradient(0, CRAC.y * sy, 0, 0);
  const a = boosted ? STREAM_ALPHA_BOOSTED : STREAM_ALPHA_IDLE;
  g.addColorStop(0, streamNear(a));
  g.addColorStop(0.7, streamMid(a * STREAM_MID_ALPHA_FACTOR));
  g.addColorStop(1, 'rgba(116,207,234,0)');

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = (pts: Streamline) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0] * sx, pts[0][1] * sy);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0] * sx, pts[i][1] * sy);
  };
  ctx.strokeStyle = g;
  ctx.lineWidth = boosted ? STROKE_STREAM_BOOSTED : STROKE_STREAM_IDLE;
  ctx.globalAlpha = STREAM_BASE_ALPHA;
  for (const pts of lines) {
    path(pts);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (!reducedMotion) {
    const t = performance.now() / 1000;
    ctx.lineWidth = boosted ? STREAM_DASH_WIDTH_BOOSTED : STREAM_DASH_WIDTH_IDLE;
    ctx.setLineDash(boosted ? STREAM_DASH_BOOSTED : STREAM_DASH_IDLE);
    lines.forEach((pts, i) => {
      ctx.lineDashOffset = -(t * (boosted ? STREAM_DASH_SPEED_BOOSTED : STREAM_DASH_SPEED_IDLE) + i * 19);
      path(pts);
      ctx.stroke();
    });
    ctx.setLineDash([]);
  }
  ctx.restore();
}
