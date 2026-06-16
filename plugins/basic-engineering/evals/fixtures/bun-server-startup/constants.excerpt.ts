import { homedir } from "node:os";

const BASE = `${homedir()}/.lotra`;

export const PORT_DIR = BASE;
export const PORT_FILE = `${BASE}/port`;
export const DEFAULT_PORT = 17824;
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
