"use client";

/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { useEffect, useRef } from "preact/hooks";

import { decodeModelDescriptor } from "../../component-docs/core/model-descriptor.ts";
import { setViewerState } from "./viewer-state.ts";

export type PackageModelViewerIslandProps = { readonly descriptor: string };

export function PackageModelViewerIsland({ descriptor: encoded }: PackageModelViewerIslandProps) {
  const descriptor = decodeModelDescriptor(encoded);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;
    setViewerState(root, "loading", "Loading interactive package model…");

    void import("./viewer-runtime.ts")
      .then(({ mountModelViewer }) => mountModelViewer(root, descriptor))
      .then((mounted) => {
        if (disposed) mounted.dispose();
        else cleanup = () => mounted.dispose();
      })
      .catch(() => {
        if (!disposed) {
          setViewerState(
            root,
            "error",
            "The interactive package model could not be displayed. The package reference below is still available.",
          );
        }
      });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [encoded]);

  return (
    <figure
      ref={rootRef}
      className="zld-model-viewer"
      data-component-model-viewer-root=""
      data-model-url={descriptor.modelUrl}
      data-viewer-state="no-js"
      aria-labelledby={`package-model-${descriptor.packageId}`}
    >
      <figcaption id={`package-model-${descriptor.packageId}`} className="zld-model-viewer__caption">
        <strong>Shared footprint package:</strong> {descriptor.packageLabel}
      </figcaption>
      <div
        className="zld-model-viewer__viewport"
        data-model-viewer-viewport=""
        tabIndex={0}
        aria-label={`Interactive 3D view of shared footprint package ${descriptor.packageLabel}`}
      />
      <p className="zld-model-viewer__status" data-model-viewer-status="" role="status" aria-live="polite">
        Interactive inspection requires JavaScript and WebGL. The package identity remains available in this page.
      </p>
      <p className="zld-model-viewer__notice">
        This geometry represents a shared footprint package and may not exactly match the manufacturer part.
      </p>
    </figure>
  );
}

PackageModelViewerIsland.displayName = "PackageModelViewerIsland";
