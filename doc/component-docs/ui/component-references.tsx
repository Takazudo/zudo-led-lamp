/** @jsxRuntime automatic */
/** @jsxImportSource preact */

import { decodeComponentReferencesDescriptor } from "../core/reference-descriptor.ts";
import { FootprintPreview } from "./footprint-preview.tsx";
import { PackageModelViewer } from "./package-model-viewer.tsx";

export type ComponentReferencesProps = { readonly descriptor: string };

/**
 * The compact, server-rendered reference shortcut for a component detail page.
 * Its source data is an encoded, validated descriptor rather than prose parsed
 * from the MDX file, keeping PDF labels and asset paths faithful to the model.
 */
export function ComponentReferences({ descriptor: encoded }: ComponentReferencesProps) {
  const descriptor = decodeComponentReferencesDescriptor(encoded);
  const { document, footprint } = descriptor;
  return (
    <section className="zld-component-references" aria-labelledby="component-references-heading">
      <h2 id="component-references-heading" className="zld-component-references__heading">Component references</h2>
      <div className="zld-component-references__grid">
        <article className="zld-component-references__card">
          <h3 className="zld-component-references__card-heading">Selected document</h3>
          <p className="zld-component-references__document-label">{document.label}</p>
          <p className="zld-component-references__document-title">
            <a href={document.url}>{document.title}</a>
          </p>
          <dl className="zld-component-references__metadata">
            <div><dt>Authority</dt><dd>{document.authority}</dd></div>
            <div><dt>Availability</dt><dd>{document.availability}</dd></div>
          </dl>
        </article>
        <article className="zld-component-references__card">
          {footprint === null ? <>
            <h3 className="zld-component-references__card-heading">Panel mounting</h3>
            <p>External panel-mounted component, hand-wired to the PCB. J5 is the wire connection; the rocker does not mount on those pads.</p>
            <p>Use the datasheet for the panel cutout and terminal orientation.</p>
            {descriptor.sourceCadUrl && <p><a href={descriptor.sourceCadUrl} download>Download original STL</a> (inch coordinates)</p>}
          </> : <>
            <h3 className="zld-component-references__card-heading">Footprint preview</h3>
            <FootprintPreview assetUrl={footprint.assetUrl} footprintName={footprint.name} />
          </>}
        </article>
        <article className="zld-component-references__card zld-component-references__model-card">
          <h3 className="zld-component-references__card-heading">{footprint === null ? "Panel component model" : "Package model"}</h3>
          <PackageModelViewer descriptor={descriptor.modelDescriptor} />
          {footprint === null && descriptor.sourceCadUrl && <p><a href={descriptor.sourceCadUrl.replace(/\.stl$/u, ".wrl")} download>Download KiCad WRL</a></p>}
        </article>
      </div>
    </section>
  );
}
