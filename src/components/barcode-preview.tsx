'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

type Props = {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
  className?: string;
};

/** Renders a CODE128 barcode SVG for on-screen preview. */
export function BarcodePreview({ value, width = 2, height = 40, showText = true, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value?.trim()) return;
    try {
      JsBarcode(svgRef.current, value.trim(), {
        format: 'CODE128',
        width,
        height,
        displayValue: showText,
        fontSize: 11,
        margin: 4,
        textMargin: 2
      });
    } catch {
      /* invalid barcode */
    }
  }, [value, width, height, showText]);

  if (!value?.trim()) {
    return <span className="text-xs text-amber-600">No barcode</span>;
  }

  return <svg ref={svgRef} className={className} role="img" aria-label={`Barcode ${value}`} />;
}
