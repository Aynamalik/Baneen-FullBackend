import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import logger from '../utils/logger.js';

const ROBOFLOW_BASE_URL = 'https://detect.roboflow.com';

const normalizeClassName = (value) => {
  if (!value) return '';
  return String(value).toLowerCase().trim();
};

const includesAny = (haystack, needles) => needles.some((n) => haystack.includes(n));

/**
 * Calls Roboflow Hosted Inference API to detect helmet/seatbelt.
 * Expects your Roboflow model to have classes that include (case-insensitive):
 * - "helmet"
 * - "seatbelt" (or "seat belt")
 */
export async function detectHelmetAndSeatbeltRoboflow(imagePath) {
  const apiKey = process.env.ROBOFLOW_API_KEY;
  const model = process.env.ROBOFLOW_MODEL_NAME;
  const version = process.env.ROBOFLOW_MODEL_VERSION;
  const confidence = process.env.ROBOFLOW_CONFIDENCE ? Number(process.env.ROBOFLOW_CONFIDENCE) : undefined;

  if (!apiKey) throw new Error('ROBOFLOW_API_KEY env var is required');
  if (!model) throw new Error('ROBOFLOW_MODEL_NAME env var is required');
  if (!version) throw new Error('ROBOFLOW_MODEL_VERSION env var is required');

  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error(`Image not found at path: ${imagePath}`);
  }

  const url = `${ROBOFLOW_BASE_URL}/${model}/${version}`;

  const form = new FormData();
  const stream = fs.createReadStream(imagePath);

  // Roboflow typically expects a multipart field named `file`.
  // Adding `image` too doesn't hurt in practice and increases compatibility.
  form.append('file', stream, { filename: 'driver-photo' });
  form.append('image', stream, { filename: 'driver-photo' });

  const params = { api_key: apiKey };
  if (confidence !== undefined && Number.isFinite(confidence)) params.confidence = confidence;

  logger.info('Running Roboflow safety inference...');

  const resp = await axios.post(url, form, {
    params,
    headers: form.getHeaders(),
    timeout: 60000,
  });

  const predictions =
    resp?.data?.predictions ||
    resp?.data?.data?.predictions ||
    [];

  let helmetDetected = false;
  let seatbeltDetected = false;

  // Track best confidence if you later want to expose it.
  // (Not required for gating logic.)
  let bestHelmet = 0;
  let bestSeatbelt = 0;

  for (const p of predictions) {
    const className = normalizeClassName(p?.class);
    const conf = Number(p?.confidence ?? 0);

    if (includesAny(className, ['helmet'])) {
      helmetDetected = true;
      bestHelmet = Math.max(bestHelmet, conf);
    }

    if (includesAny(className, ['seatbelt', 'seat belt'])) {
      seatbeltDetected = true;
      bestSeatbelt = Math.max(bestSeatbelt, conf);
    }
  }

  return {
    helmetDetected,
    seatbeltDetected,
    bestHelmetConfidence: bestHelmet,
    bestSeatbeltConfidence: bestSeatbelt,
  };
}

