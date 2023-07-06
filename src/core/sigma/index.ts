import Sigma from "sigma";
import { Extent } from "graphology-metrics/graph/extent";
import { max } from "lodash";

import { SigmaState } from "./types";
import { atom } from "../utils/atoms";
import { filteredGraphAtom, graphDatasetAtom, sigmaGraphAtom } from "../graph";
import { SigmaGraph } from "../graph/types";
import { getEmptySigmaState } from "./utils";
import { Producer, producerToAction } from "../utils/producers";

/**
 * Producers:
 * **********
 */
export const resetState: Producer<SigmaState, []> = () => {
  return () => getEmptySigmaState();
};

export const setHighlightedNodes: Producer<SigmaState, [Set<string> | null]> = (items) => {
  return (state) => ({
    ...state,
    highlightedNodes: items,
  });
};
export const resetHighlightedNodes: Producer<SigmaState, []> = () => {
  return (state) => ({
    ...state,
    highlightedNodes: null,
  });
};

export const setHighlightedEdges: Producer<SigmaState, [Set<string> | null]> = (items) => {
  return (state) => ({
    ...state,
    highlightedEdges: items,
  });
};
export const resetHighlightedEdges: Producer<SigmaState, []> = () => {
  return (state) => ({
    ...state,
    highlightedEdges: null,
  });
};

export const setHoveredNode: Producer<SigmaState, [string | null]> = (node) => {
  return (state) => ({
    ...state,
    hoveredNode: node,
  });
};
export const resetHoveredNode: Producer<SigmaState, []> = () => {
  return (state) => ({
    ...state,
    hoveredNode: null,
  });
};

export const setHoveredEdge: Producer<SigmaState, [string | null]> = (edge) => {
  return (state) => ({
    ...state,
    hoveredEdge: edge,
  });
};
export const resetHoveredEdge: Producer<SigmaState, []> = () => {
  return (state) => ({
    ...state,
    hoveredEdge: null,
  });
};

/**
 * Public API:
 * ***********
 */
export const sigmaAtom = atom<Sigma<SigmaGraph>>(
  new Sigma(sigmaGraphAtom.get(), document.createElement("div"), { allowInvalidContainer: true }),
);
export const sigmaStateAtom = atom<SigmaState>(getEmptySigmaState());

/**
 * This function sets sigma's bounding box so that the whole graph is on screen,
 * with default camera state.
 *
 * If `forceRefresh` is true, a `sigma.refresh()` is called right after.
 *
 * The `source` parameter matters as well, since it determines whether the
 * bounding should be computed on the sigma graph or the dataset:
 * - When an "iterative" layout algorithm is running (FA2 for instance), then
 *   sigma has the latest data
 * - When this is called right after applying a single step layout algorithm
 *   (circular for instance), then the dataset is updated before, and using
 *   sigma as the source would require having a first rendered frame with the
 *   "old" bounding box
 */
export const resetCamera = ({
  source = "dataset",
  forceRefresh,
}: {
  forceRefresh?: boolean;
  source?: "sigma" | "dataset";
} = {}) => {
  const sigma = sigmaAtom.get();
  sigma.getCamera().setState({ angle: 0, x: 0.5, y: 0.5, ratio: 1 });

  if (source === "dataset") {
    const dataset = graphDatasetAtom.get();
    const filteredGraph = filteredGraphAtom.get();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const nodes = filteredGraph.nodes();
    for (let i = 0, l = nodes.length; i < l; i++) {
      const node = nodes[i];
      const { x, y } = dataset.nodeRenderingData[node];
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }

    const bbox = { x: [minX, maxX] as Extent, y: [minY, maxY] as Extent };
    sigma.setCustomBBox(bbox);
  } else {
    sigma.setCustomBBox(sigma.getBBox());
  }

  if (forceRefresh) sigma.refresh();
};

export const sigmaActions = {
  resetState: producerToAction(resetState, sigmaStateAtom),
  setHighlightedNodes: producerToAction(setHighlightedNodes, sigmaStateAtom),
  resetHighlightedNodes: producerToAction(resetHighlightedNodes, sigmaStateAtom),
  setHighlightedEdges: producerToAction(setHighlightedEdges, sigmaStateAtom),
  resetHighlightedEdges: producerToAction(resetHighlightedEdges, sigmaStateAtom),
  setHoveredNode: producerToAction(setHoveredNode, sigmaStateAtom),
  resetHoveredNode: producerToAction(resetHoveredNode, sigmaStateAtom),
  setHoveredEdge: producerToAction(setHoveredEdge, sigmaStateAtom),
  resetHoveredEdge: producerToAction(resetHoveredEdge, sigmaStateAtom),
} as const;

export function focusCameraOnNode(id: string) {
  const sigma = sigmaAtom.get();
  const nodeDisplayData = sigma.getNodeDisplayData(id);
  const graphDimensions = sigma.getGraphDimensions();
  if (nodeDisplayData) {
    sigma.getCamera().animate({
      x: nodeDisplayData.x,
      y: nodeDisplayData.y,
      // we zoom to see a box of X times the size of the node
      ratio: max([
        (nodeDisplayData.size * 10) / graphDimensions.width,
        (nodeDisplayData.size * 10) / graphDimensions.height,
      ]) as number,
    });
  }
}

export function focusCameraOnEdge(id: string) {
  const sigma = sigmaAtom.get();
  const sourceId = sigma.getGraph().source(id);
  const sourceDisplayData = sigma.getNodeDisplayData(sourceId);
  const sourceData = sigma.getGraph().getNodeAttributes(sourceId);

  const targetId = sigma.getGraph().target(id);
  const targetDisplayData = sigma.getNodeDisplayData(targetId);
  const targetData = sigma.getGraph().getNodeAttributes(targetId);

  if (sourceData && targetData && targetDisplayData && sourceDisplayData) {
    // margin is the size of the biggest node;
    const margin = max([sourceDisplayData?.size, targetDisplayData?.size, 10]) as number;

    // we compute the width/height of the edge (with margin) in  the graph referencial
    const focusWidth = Math.abs(targetData.x - sourceData.x) + margin * 2;
    const focusHeight = Math.abs(targetData.y - sourceData.y) + margin * 2;

    // we compute the zoom ratio (in the graph ref, which should be the same in the viewport)
    const graphDimensions = sigma.getGraphDimensions();
    const focusRatio = max([focusHeight / graphDimensions.height, focusWidth / graphDimensions.width]) as number;

    sigma.getCamera().animate({
      x: (sourceDisplayData.x + targetDisplayData.x) / 2,
      y: (sourceDisplayData.y + targetDisplayData.y) / 2,
      ratio: focusRatio,
    });
  }
}
