export const TABS = {
  youtube:   { label:"YouTube",   accent:"#ff4d6d", accentBg:"rgba(255,77,109,0.1)",  darkBg:"#150608", border:"#ff4d6d33", emoji:"\u{1F4FA}" },
  instagram: { label:"Instagram", accent:"#e1306c", accentBg:"rgba(225,48,108,0.1)",  darkBg:"#150610", border:"#e1306c33", emoji:"\u{1F4F8}" },
  facebook:  { label:"Facebook",  accent:"#4a90d9", accentBg:"rgba(74,144,217,0.1)",  darkBg:"#050d18", border:"#4a90d933", emoji:"\u{1F44D}" },
  local:     { label:"Local",     accent:"#06b6d4", accentBg:"rgba(6,182,212,0.1)",   darkBg:"#020e10", border:"#06b6d433", emoji:"\u{1F3AC}" },
};

export const PRIORITIES = {
  urgent:  { label:"Urgent",  color:"#ff4d6d", bg:"rgba(255,77,109,0.12)", dot:"#ff4d6d" },
  soon:    { label:"Soon",    color:"#ffb830", bg:"rgba(255,184,48,0.12)",  dot:"#ffb830" },
  someday: { label:"Someday", color:"#4ade80", bg:"rgba(74,222,128,0.12)",  dot:"#4ade80" },
  none:    { label:"None",    color:"#3a3a55", bg:"transparent",            dot:"#3a3a55" },
};

export const CAT_COLORS = ["#7c6af7","#f97316","#06b6d4","#ec4899","#84cc16","#f59e0b","#8b5cf6","#10b981"];

export const THUMB_WIDTH = 320;
export const THUMB_HEIGHT = 180;
export const THUMB_QUALITY = 0.75;
export const THUMB_SEEK_SECONDS = 1.5;
export const THUMB_SEEK_RATIO = 0.08;
export const THUMB_TIMEOUT_MS = 5000;
export const MESSAGE_TIMEOUT_MS = 2500;
export const CARD_ANIMATION_STAGGER_MS = 35;
export const MAX_FILE_SIZE = 500 * 1024 * 1024;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-matroska"];
