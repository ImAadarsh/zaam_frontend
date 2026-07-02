'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import JsBarcode from 'jsbarcode';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download, Loader2, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import { BarcodePreview } from '@/components/barcode-preview';
import { resolveBarcodeSymbology, toJsBarcodeFormat } from '@/lib/barcodeSymbology';

export type LabelProduct = {
  product_id: string;
  product_name: string;
  product_sku: string;
  barcode: string | null;
  selling_price: string;
};

export type LabelLayout = {
  unit: 'inch' | 'mm';
  sheetWidth: number;
  sheetHeight: number;
  verticalSpacing: number;
  horizontalSpacing: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  labelWidth: number;
  labelHeight: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  barcodeWidth: number;
  barcodeHeight: number;
  labelCount: number;
};

export const DEFAULT_LABEL_LAYOUT: LabelLayout = {
  unit: 'inch',
  sheetWidth: 8.5,
  sheetHeight: 11,
  verticalSpacing: 0,
  horizontalSpacing: 0.125,
  marginTop: 0.5,
  marginRight: 0.188,
  marginBottom: 0.5,
  marginLeft: 0.188,
  labelWidth: 2.625,
  labelHeight: 1,
  paddingTop: 0.1,
  paddingRight: 0.1,
  paddingBottom: 0.1,
  paddingLeft: 0.1,
  barcodeWidth: 2,
  barcodeHeight: 0.5,
  labelCount: 30
};

export const DEFAULT_LABEL_TEMPLATE = `<p style="padding: 0; margin: 0;">[op_product attribute="name"]</p>
<p style="padding: 0; margin: 0;">[barcode]</p>
<p style="padding: 0; margin: 0;">[op_product attribute="barcode"]</p>`;

const DPI = 96;

function toPx(value: number, unit: 'inch' | 'mm'): number {
  if (unit === 'mm') return (value / 25.4) * DPI;
  return value * DPI;
}

function pdfUnit(unit: 'inch' | 'mm'): 'in' | 'mm' {
  return unit === 'inch' ? 'in' : 'mm';
}

function BarcodeSvg({
  value,
  widthIn,
  heightIn,
  unit
}: {
  value: string;
  widthIn: number;
  heightIn: number;
  unit: 'inch' | 'mm';
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;
    try {
      const { symbology, encodeValue } = resolveBarcodeSymbology(value);
      JsBarcode(svgRef.current, encodeValue, {
        format: toJsBarcodeFormat(symbology),
        width: 2,
        height: Math.max(24, toPx(heightIn, unit) * 0.55),
        displayValue: false,
        margin: 0
      });
      svgRef.current.style.width = `${toPx(widthIn, unit)}px`;
      svgRef.current.style.maxWidth = '100%';
      svgRef.current.style.height = 'auto';
    } catch {
      /* invalid barcode value */
    }
  }, [value, widthIn, heightIn, unit]);

  if (!value) {
    return <span className="text-[10px] text-red-500">No barcode — generate first</span>;
  }

  return <svg ref={svgRef} />;
}

function LabelCell({
  product,
  layout,
  template
}: {
  product: LabelProduct;
  layout: LabelLayout;
  template: string;
}) {
  const barcodeValue = product.barcode ?? '';
  const showBarcodeImage = /\[barcode\]|\{\{barcode\}\}/i.test(template);

  const textLines = template
    .split('\n')
    .map((line) =>
      line
        .replace(/<[^>]+>/g, '')
        .replace(/\[op_product attribute="name"\]/gi, product.product_name)
        .replace(/\[op_product attribute="barcode"\]/gi, barcodeValue)
        .replace(/\[op_product attribute="sku"\]/gi, product.product_sku)
        .replace(/\[op_product attribute="price"\]/gi, `£${product.selling_price}`)
        .replace(/\[barcode[^\]]*\]/gi, '')
        .replace(/\{\{name\}\}/gi, product.product_name)
        .replace(/\{\{barcode\}\}/gi, barcodeValue)
        .replace(/\{\{sku\}\}/gi, product.product_sku)
        .replace(/\{\{price\}\}/gi, `£${product.selling_price}`)
        .trim()
    )
    .filter(Boolean);

  return (
    <div
      className="label-cell bg-white border border-dashed border-gray-400 overflow-hidden text-[10px] leading-snug flex flex-col items-center justify-center text-center"
      style={{
        width: toPx(layout.labelWidth, layout.unit),
        height: toPx(layout.labelHeight, layout.unit),
        padding: `${toPx(layout.paddingTop, layout.unit)}px ${toPx(layout.paddingRight, layout.unit)}px ${toPx(layout.paddingBottom, layout.unit)}px ${toPx(layout.paddingLeft, layout.unit)}px`,
        boxSizing: 'border-box'
      }}
    >
      {textLines.map((line, i) => {
        const isBarcodeLine = template.split('\n')[i]?.toLowerCase().includes('[barcode]');
        if (isBarcodeLine && showBarcodeImage) {
          return (
            <div key={i} className="w-full flex flex-col items-center gap-0.5">
              <BarcodeSvg
                value={barcodeValue}
                widthIn={layout.barcodeWidth}
                heightIn={layout.barcodeHeight}
                unit={layout.unit}
              />
            </div>
          );
        }
        if (!line) return null;
        const isBarcodeNumberLine = /\[op_product attribute="barcode"\]|\{\{barcode\}\}/i.test(
          template.split('\n')[i] ?? ''
        );
        return (
          <p
            key={i}
            className={`m-0 p-0 w-full ${isBarcodeNumberLine ? 'font-mono text-[8px]' : 'truncate'}`}
            style={{ fontSize: isBarcodeNumberLine ? '8px' : '9px' }}
          >
            {line}
          </p>
        );
      })}
    </div>
  );
}

type Props = {
  products: LabelProduct[];
  onClose: () => void;
};

export function EposLabelDesigner({ products, onClose }: Props) {
  const [layout, setLayout] = useState<LabelLayout>(DEFAULT_LABEL_LAYOUT);
  const [template, setTemplate] = useState(DEFAULT_LABEL_TEMPLATE);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [mounted, setMounted] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const uniqueProducts = useMemo(() => {
    const seen = new Set<string>();
    return products.filter((p) => {
      if (seen.has(p.product_id)) return false;
      seen.add(p.product_id);
      return true;
    });
  }, [products]);

  const missingBarcodes = uniqueProducts.filter((p) => !p.barcode?.trim());

  const sheetPx = useMemo(
    () => ({
      w: toPx(layout.sheetWidth, layout.unit),
      h: toPx(layout.sheetHeight, layout.unit)
    }),
    [layout]
  );

  const labelPx = useMemo(
    () => ({
      w: toPx(layout.labelWidth, layout.unit),
      h: toPx(layout.labelHeight, layout.unit),
      gapX: toPx(layout.horizontalSpacing, layout.unit),
      gapY: toPx(layout.verticalSpacing, layout.unit),
      mt: toPx(layout.marginTop, layout.unit),
      ml: toPx(layout.marginLeft, layout.unit)
    }),
    [layout]
  );

  const cols = Math.max(
    1,
    Math.floor(
      (sheetPx.w - labelPx.ml - toPx(layout.marginRight, layout.unit) + labelPx.gapX) /
        (labelPx.w + labelPx.gapX)
    )
  );

  const previewProducts = useMemo(() => {
    const source = products.length ? products : [];
    const out: LabelProduct[] = [];
    const sample: LabelProduct = source[0] ?? {
      product_id: 'sample',
      product_name: 'Sample Product',
      product_sku: 'SKU-001',
      barcode: '2001234567890',
      selling_price: '9.99'
    };
    for (let i = 0; i < layout.labelCount; i++) {
      out.push(source[i % source.length] ?? sample);
    }
    return out;
  }, [products, layout.labelCount]);

  const waitForBarcodes = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 400));
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    const sheet = printRef.current?.querySelector('.sheet') as HTMLElement | null;
    if (!sheet) return;
    if (missingBarcodes.length) return;

    setDownloadingPdf(true);
    try {
      await waitForBarcodes();
      const canvas = await html2canvas(sheet, {
        scale: 3,
        backgroundColor: '#f5e6a3',
        useCORS: true,
        logging: false
      });

      const pdf = new jsPDF({
        orientation: layout.sheetWidth > layout.sheetHeight ? 'landscape' : 'portrait',
        unit: pdfUnit(layout.unit),
        format: [layout.sheetWidth, layout.sheetHeight]
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      pdf.addImage(imgData, 'PNG', 0, 0, layout.sheetWidth, layout.sheetHeight);

      const name =
        uniqueProducts.length === 1
          ? `barcode-${uniqueProducts[0]!.product_sku.slice(0, 30)}.pdf`
          : `barcode-labels-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(name);
      toast.success('PDF downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setDownloadingPdf(false);
    }
  }, [layout, missingBarcodes.length, uniqueProducts, waitForBarcodes]);

  const handlePrint = useCallback(async () => {
    const node = printRef.current;
    if (!node) return;
    await waitForBarcodes();
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
      <!DOCTYPE html><html><head><title>Print Labels</title>
      <style>
        body { margin: 0; }
        .sheet { background: #fff !important; }
        @page { size: ${layout.sheetWidth}${layout.unit === 'mm' ? 'mm' : 'in'} ${layout.sheetHeight}${layout.unit === 'mm' ? 'mm' : 'in'}; margin: 0; }
      </style></head><body>${node.innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }, [layout.sheetWidth, layout.sheetHeight, layout.unit, waitForBarcodes]);

  const setNum = (key: keyof LabelLayout, value: string) => {
    const n = parseFloat(value);
    if (!Number.isNaN(n)) setLayout((l) => ({ ...l, [key]: n }));
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex bg-black/50">
      <div className="flex flex-1 flex-col lg:flex-row bg-background m-2 lg:m-4 rounded-xl overflow-hidden shadow-2xl max-h-[calc(100vh-1rem)]">
        {/* Left — settings */}
        <div className="w-full lg:w-[380px] shrink-0 border-r overflow-y-auto p-4 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Barcode Labels</h2>
            <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-muted">
              <X size={18} />
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Step 1: review barcodes below. Step 2: check the sheet preview. Step 3: download PDF or print.
          </p>

          {missingBarcodes.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              {missingBarcodes.length} product(s) have no barcode. Generate barcodes in Browse EPOS first.
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="col-span-2 font-medium">Unit
              <select className="mt-1 w-full rounded border px-2 py-1.5" value={layout.unit} onChange={(e) => setLayout({ ...layout, unit: e.target.value as 'inch' | 'mm' })}>
                <option value="inch">Inch</option>
                <option value="mm">mm</option>
              </select>
            </label>
            <label>Sheet W<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.sheetWidth} onChange={(e) => setNum('sheetWidth', e.target.value)} /></label>
            <label>Sheet H<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.sheetHeight} onChange={(e) => setNum('sheetHeight', e.target.value)} /></label>
            <label>V. Spacing<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.verticalSpacing} onChange={(e) => setNum('verticalSpacing', e.target.value)} /></label>
            <label>H. Spacing<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.horizontalSpacing} onChange={(e) => setNum('horizontalSpacing', e.target.value)} /></label>
            <label>Margin T<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.marginTop} onChange={(e) => setNum('marginTop', e.target.value)} /></label>
            <label>Margin R<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.marginRight} onChange={(e) => setNum('marginRight', e.target.value)} /></label>
            <label>Margin B<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.marginBottom} onChange={(e) => setNum('marginBottom', e.target.value)} /></label>
            <label>Margin L<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.marginLeft} onChange={(e) => setNum('marginLeft', e.target.value)} /></label>
            <label>Label W<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.labelWidth} onChange={(e) => setNum('labelWidth', e.target.value)} /></label>
            <label>Label H<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.labelHeight} onChange={(e) => setNum('labelHeight', e.target.value)} /></label>
            <label>Pad T/R/B/L<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.paddingTop} onChange={(e) => setLayout({ ...layout, paddingTop: parseFloat(e.target.value) || 0, paddingRight: parseFloat(e.target.value) || 0, paddingBottom: parseFloat(e.target.value) || 0, paddingLeft: parseFloat(e.target.value) || 0 })} /></label>
            <label>Barcode W<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.barcodeWidth} onChange={(e) => setNum('barcodeWidth', e.target.value)} /></label>
            <label>Barcode H<input type="number" step="0.001" className="mt-1 w-full rounded border px-2 py-1" value={layout.barcodeHeight} onChange={(e) => setNum('barcodeHeight', e.target.value)} /></label>
            <label className="col-span-2">Number of labels
              <input type="number" className="mt-1 w-full rounded border px-2 py-1" value={layout.labelCount} onChange={(e) => setNum('labelCount', e.target.value)} />
            </label>
          </div>

          <label className="block text-xs font-medium">Template
            <textarea
              className="mt-1 w-full rounded border px-2 py-2 font-mono text-[11px] h-24"
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
            />
          </label>

          <button type="button" onClick={onClose} className="w-full rounded-lg border px-4 py-2 text-sm">Close</button>
        </div>

        {/* Right — preview first, then download */}
        <div className="flex-1 flex flex-col overflow-hidden bg-muted/30">
          <div className="border-b bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Preview</h3>
              <p className="text-xs text-muted-foreground">{cols} columns · {layout.labelCount} labels on sheet</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={downloadingPdf || missingBarcodes.length > 0}
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              >
                {downloadingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Download PDF
              </button>
              <button
                type="button"
                disabled={missingBarcodes.length > 0}
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm disabled:opacity-50"
              >
                <Printer size={16} /> Print
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4">
            {/* Individual barcode preview — show first */}
            <div className="rounded-xl border bg-card p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Barcode preview ({uniqueProducts.length} product{uniqueProducts.length !== 1 ? 's' : ''})
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {uniqueProducts.map((p) => (
                  <div
                    key={p.product_id}
                    className="rounded-lg border bg-white p-3 flex flex-col items-center gap-2 min-h-[100px]"
                  >
                    <p className="text-xs font-medium text-center line-clamp-2 w-full" title={p.product_name}>
                      {p.product_name}
                    </p>
                    {p.barcode ? (
                      <>
                        <BarcodePreview value={p.barcode} width={1.8} height={36} showText={false} />
                        <p className="text-[10px] text-muted-foreground font-mono">{p.barcode}</p>
                      </>
                    ) : (
                      <span className="text-xs text-amber-600 py-4">Generate barcode first</span>
                    )}
                    <p className="text-[10px] text-muted-foreground truncate w-full text-center" title={p.product_sku}>
                      {p.product_sku.length > 40 ? `${p.product_sku.slice(0, 40)}…` : p.product_sku}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Full sheet preview */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Sheet layout preview
              </h4>
              <div ref={printRef} className="inline-block">
                <div
                  className="sheet bg-[#f5e6a3] shadow-lg"
                  style={{
                    width: sheetPx.w,
                    height: sheetPx.h,
                    padding: `${labelPx.mt}px ${toPx(layout.marginRight, layout.unit)}px ${toPx(layout.marginBottom, layout.unit)}px ${labelPx.ml}px`,
                    boxSizing: 'border-box'
                  }}
                >
                  <div
                    className="flex flex-wrap content-start"
                    style={{ gap: `${labelPx.gapY}px ${labelPx.gapX}px`, width: '100%' }}
                  >
                    {previewProducts.map((p, i) => (
                      <LabelCell key={`${p.product_id}-${i}`} product={p} layout={layout} template={template} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
