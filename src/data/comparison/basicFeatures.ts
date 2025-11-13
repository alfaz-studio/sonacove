import type { TableRow } from "../../pages/comparison/types.ts";

export const basicFeaturesData: TableRow[] = [
  {
    feature: "Audio",
    isHeader: true,
    sonacove: { value: null },
    zoom: { value: null },
    googleMeet: { value: null },
  },
  {
    feature: "Microphone selection",
    sonacove: { value: null, icon: "check" },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: null, icon: "check" },
  },
  {
    feature: "Speaker selection",
    sonacove: { value: null, icon: "check" },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: null, icon: "check" },
  },
  {
    feature: "Push-to-Talk",
    sonacove: { value: "Configurable key", icon: "check", isPrimary: true },
    zoom: { value: "Fixed key" },
    googleMeet: { value: "Spacebar only" },
  },
  {
    feature: "Mic hotkeys",
    sonacove: { value: "Fully configurable", icon: "check", isPrimary: true },
    zoom: { value: "Fixed" },
    googleMeet: { value: "Fixed (Cmd+D)" },
  },
  {
    feature: "Advanced noise suppression",
    sonacove: { value: null, icon: "check" },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: null, icon: "check" },
  },
  {
    feature: "Audio level indicators",
    sonacove: { value: null, icon: "check" },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: null, icon: "check" },
  },
  {
    feature: "Speaker test",
    sonacove: { value: null, icon: "check" },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: "Pre-recorded sound" },
  },
  {
    feature: "Video",
    isHeader: true,
    sonacove: { value: null },
    zoom: { value: null },
    googleMeet: { value: null },
  },
  {
    feature: "Camera selection",
    sonacove: { value: null, icon: "check" },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: null, icon: "check" },
  },
  {
    feature: "Quality settings",
    sonacove: {
      value: "Performance/stability optimization",
      icon: "check",
      isPrimary: true,
    },
    zoom: { value: "Limited options" },
    googleMeet: { value: "Limited options" },
  },
  {
    feature: "Background blur",
    sonacove: { value: "AI-powered", icon: "check", isPrimary: true },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: null, icon: "check" },
  },
  {
    feature: "Virtual backgrounds",
    sonacove: { value: "Unlimited custom", icon: "check", isPrimary: true },
    zoom: { value: "Limited presets + custom" },
    googleMeet: { value: "Limited presets" },
  },
  {
    feature: "Hardware acceleration",
    sonacove: { value: null, icon: "check" },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: null, icon: "check" },
  },
];
