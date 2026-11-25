"use client";

import { Printer } from "./icons";

export default function PrintButton() {
  return (
    <button className="btn btn-primary" onClick={() => window.print()}>
      <Printer size={16} /> Print
    </button>
  );
}
