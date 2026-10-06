import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { readJsonBody, requireSecret } from '@/lib/apiGuard';

// The container user cannot write to /app. Use the OS temp dir (ephemeral on Cloud Run).
// For data that must survive a restart, move this to GCS or Firestore.
const DATA_DIR = path.join(os.tmpdir(), 'protash-data');
const FILE = path.join(DATA_DIR, 'visa-evidence.json');
const MAX_BODY_BYTES = 256 * 1024;

async function readData() {
  try {
    const raw = await fs.readFile(FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeData(data: unknown) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export async function GET(req: NextRequest) {
  const denied = requireSecret(req, process.env.CRON_SECRET);
  if (denied) return denied;

  const data = await readData();
  if (!data) {
    return NextResponse.json({ error: 'no_data' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const denied = requireSecret(req, process.env.CRON_SECRET);
  if (denied) return denied;

  const body = await readJsonBody(req, MAX_BODY_BYTES);
  if (!body.ok) return body.response;

  try {
    await writeData(body.data);
    return NextResponse.json({ ok: true, saved_at: new Date().toISOString() });
  } catch (e) {
    console.error('[visa/evidence] write failed:', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
