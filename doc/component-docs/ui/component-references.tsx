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
    <section className="zld-component-references" aria-label="Selected document and package previews">
      <div className="zld-component-references__document">
        <div>
          <p className="zld-component-references__document-label">{document.label}</p>
          <p className="zld-component-references__document-title"><a href={document.url}>{document.title}</a></p>
        </div>
        <dl className="zld-component-references__metadata">
          <div><dt>Authority</dt><dd>{document.authority}</dd></div>
          <div><dt>Availability</dt><dd>{document.availability}</dd></div>
        </dl>
      </div>
      <div className="zld-component-references__previews">
        <article className="zld-component-references__preview">
          <h3 className="zld-component-references__card-heading">Footprint preview</h3>
          <FootprintPreview assetUrl={footprint.assetUrl} footprintName={footprint.name} />
        </article>
        <article className="zld-component-references__preview zld-component-references__model-card">
          <h3 className="zld-component-references__card-heading">Package model</h3>
          <PackageModelViewer descriptor={descriptor.modelDescriptor} />
        </article>
      </div>
    </section>
  );
}
