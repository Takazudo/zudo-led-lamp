import { readEvidenceIndex } from "../adapters/circuit/index.ts";
import { readCircuitReferenceContract } from "../adapters/circuit/references.ts";
import { CIRCUIT_SELECTION } from "../adapters/circuit/selection.ts";
import type { FootprintSelection } from "./manifest.ts";

export async function readFootprintSelections(): Promise<readonly FootprintSelection[]> {
  const index = await readEvidenceIndex();
  const contract = await readCircuitReferenceContract(index, CIRCUIT_SELECTION);
  return contract.packages.map((entry) => ({
    packageId: entry.packageId,
    footprintName: entry.footprintName,
    footprintPath: entry.footprintPath,
    recordIds: entry.recordIds,
  }));
}
