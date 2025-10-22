import type { TableRow } from "../../pages/comparison/types.ts";

export const controlFeaturesData: TableRow[] = [
  {
    feature: "Host Controls",
    isHeader: true,
    sonacove: { value: null },
    zoom: { value: null },
    googleMeet: { value: null },
  },
  {
    feature: "Meeting lock",
    sonacove: { value: null, icon: "check" },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: null, icon: "check" },
  },
  {
    feature: "Waiting room/lobby",
    sonacove: { value: null, icon: "check" },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: null, icon: "check" },
  },
  {
    feature: "Remove participants",
    sonacove: { value: null, icon: "check" },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: null, icon: "check" },
  },
  {
    feature: "Mute participants",
    sonacove: { value: "Fine-grained control", icon: "check", isPrimary: true },
    zoom: { value: "Basic control" },
    googleMeet: { value: "Basic on/off" },
  },
  {
    feature: "Prevent unmuting",
    sonacove: { value: "All users or select", icon: "check", isPrimary: true },
    zoom: { value: "All users only" },
    googleMeet: { value: "All users only" },
  },
  {
    feature: "Stop video",
    sonacove: { value: null, icon: "check" },
    zoom: { value: null, icon: "check" },
    googleMeet: { value: null, icon: "check" },
  },
  {
    feature: "Spotlight/Pin",
    sonacove: { value: "Multiple users", icon: "check", isPrimary: true },
    zoom: { value: "Spotlight" },
    googleMeet: { value: "Limited pinning" },
  },
  {
    feature: "Co-hosts",
    sonacove: { value: null, icon: "check" },
    zoom: { value: "Paid plans only" },
    googleMeet: { value: null, icon: "check" },
  },
  {
    feature: "Breakout rooms",
    sonacove: { value: "Pre-assign & dynamic", icon: "check", isPrimary: true },
    zoom: { value: "Limited assignment" },
    googleMeet: { value: "Basic rooms" },
  },
];
