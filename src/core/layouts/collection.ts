import Graph from "graphology";
import ForceSupervisor, { ForceLayoutSupervisorParameters } from "graphology-layout-force/worker";
import { ForceAtlas2LayoutParameters, inferSettings } from "graphology-layout-forceatlas2";
import FA2Layout from "graphology-layout-forceatlas2/worker";
import NoverlapLayout, { NoverlapLayoutSupervisorParameters } from "graphology-layout-noverlap/worker";
import circlepack from "graphology-layout/circlepack";
import circular, { CircularLayoutOptions } from "graphology-layout/circular";
import random, { RandomLayoutOptions } from "graphology-layout/random";
import { isNil, isObject } from "lodash";

import { graphDatasetAtom } from "../graph";
import { DataGraph, ItemData } from "../graph/types";
import { dataGraphToFullGraph } from "../graph/utils";
import { Layout, LayoutMapping, SyncLayout, WorkerLayout } from "./types";

// definition of a custom layout function
// eslint-disable-next-line no-new-func
const nodeCoordinatesCustomFn = new Function(`return (
function nodeCoordinates(id, attributes, index, graph) {
  // / Your code goes here
  const width = 1000;  // Total width of the layout
  const height = 1000; // Total height of the layout
  const margin = 50;   // Margin around the layout

  // Determine the x position based on the label
  let x;
  if (attributes.label === "Anomaly") {
    x = margin + Math.random() * (width / 2 - 2 * margin);
  } else if (attributes.label === "Normal") {
    x = width / 2 + margin + Math.random() * (width / 2 - 2 * margin);
  } else {
    // If the label is neither "Anomaly" nor "Normal", place it randomly
    x = margin + Math.random() * (width - 2 * margin);
  }

  // Random y position within the height
  const y = margin + Math.random() * (height - 2 * margin);

  return { x, y };
} )`)();

const threasholdFunc = new Function(`return (
  function threasholdFunc(id, attributes, index, graph, threshold) {
    const width = 1000;
    const height = 1000;
    const margin = 50;
  
    let x;
    if (isNaN(attributes.label)){
        if (attributes.label === "Anomaly"){
          attributes.label = 1
        }else{
          attributes.label = 0
        }
    }
    if (!isNaN(labelValue)) {
      if (labelValue > threshold) {
        // Right side for values above threshold
        x = width/2 + margin + Math.random() * (width/2 - 2*margin);
      } else {
        // Left side for values below or equal to threshold
        x = margin + Math.random() * (width/2 - 2*margin);
      }
    } else {
      // Fallback for non-numeric labels
      x = margin + Math.random() * (width - 2*margin);
    }
  
    const y = margin + Math.random() * (height - 2*margin);
    return { x, y };
  } )`)();
/**
 * List of available layouts
 */
export const LAYOUTS: Array<Layout> = [
  {
    id: "random",
    type: "sync",
    description: true,
    parameters: [
      {
        id: "center",
        type: "number",
        description: true,
        defaultValue: 0.5,
      },
      {
        id: "scale",
        type: "number",
        description: true,
        defaultValue: 1000,
      },
    ],
    run: (graph, options) => random(graph, options?.settings) as unknown as LayoutMapping,
  } as SyncLayout<RandomLayoutOptions>,
  {
    id: "anomaly",
    type: "sync",
    description: true,
    parameters: [
      {
        id: "threshold",
        type: "number",
        required: true,
        defaultValue: 0,
        description: "Threshold value to separate nodes"
      },
      {
        id: "script",
        type: "script",
        functionJsDoc: `/**
  * Function that return coordinates for the specified node.
  *
  * @param {string} id The ID of the node
  * @param {Object.<string, number | string | boolean | undefined | null>} attributes Attributes of the node
  * @param {number} index The index position of the node in the graph 
  * @param {Graph} graph The graphology instance
  * @param {number} threshold The threshold value from user input
  * @returns {x: number, y: number} The computed coordinates
  */`,
        defaultValue: threasholdFunc,
        // functionCheck: (fn_) => {
        //   if (!fn_) throw new Error("Function is not defined");
        //   const fullGraph = dataGraphToFullGraph(graphDatasetAtom.get());
        //   const id = fullGraph.nodes()[0];
        //   const attributes = fullGraph.getNodeAttributes(id);
        //   // 测试时传入默认threshold 0
        //   const result = fn_(id, attributes, 0, fullGraph, 0);
        //   if (!isObject(result)) throw new Error("Function must return an object");
        //   if (isNil(result.x)) throw new Error("Missing x property");
        //   if (isNil(result.y)) throw new Error("Missing y property");
        // }
      }
    ],
    run(graph: Graph, options) {
      const { script, threshold } = options?.settings || {};
      if (!script || typeof threshold !== "number") {
        console.error("[layout] Missing script or threshold");
        return {};
      }
      
      const graphCopy = graph.copy();
      Object.freeze(graphCopy);
  
      const res: LayoutMapping = {};
      graph.nodes().forEach((id, index) => {
        res[id] = script(
          id,
          graph.getNodeAttributes(id),
          index,
          graphCopy,
          threshold // 传递用户输入的阈值
        );
      });
      return res;
    },
  } as SyncLayout<{
    script?: (id: string, attributes: ItemData, index: number, graph: Graph, threshold: number) => { x: number; y: number };
    threshold?: number;
  }>,
  {
    id: "circular",
    type: "sync",
    description: true,
    parameters: [
      {
        id: "center",
        type: "number",
        description: true,
        defaultValue: 0,
        step: 1,
      },
      {
        id: "scale",
        type: "number",
        description: true,
        defaultValue: 1000,
      },
    ],
    run: (graph, options) => circular(graph, options?.settings) as unknown as LayoutMapping,
  } as SyncLayout<CircularLayoutOptions>,
  {
    id: "circlePack",
    type: "sync",
    description: true,
    parameters: [
      {
        id: "groupingField",
        type: "attribute",
        itemType: "nodes",
        required: false,
      },
      {
        id: "center",
        type: "number",
        description: true,
        defaultValue: 0.5,
        step: 0.1,
      },
      {
        id: "scale",
        type: "number",
        description: true,
        defaultValue: 1,
      },
    ],
    run(graph: Graph, options) {
      const { groupingField, center, scale } = options?.settings || {};

      return circlepack(graph, {
        center,
        scale,
        hierarchyAttributes: groupingField ? [groupingField] : [],
      });
    },
  } as SyncLayout<{ scale?: number; groupingField?: string; center?: number }>,
  {
    id: "fa2",
    type: "worker",
    supervisor: FA2Layout,
    buttons: [
      {
        id: "autoSettings",
        description: true,
        getSettings(currentSettings, dataGraph: DataGraph) {
          const infer = inferSettings(dataGraph);
          return infer;
        },
      },
    ],
    parameters: [
      {
        id: "adjustSizes",
        type: "boolean",
        description: true,
        defaultValue: false,
      },
      {
        id: "barnesHutOptimize",
        type: "boolean",
        description: true,
        defaultValue: false,
      },
      { id: "barnesHutTheta", type: "number", description: true, defaultValue: 0.5, min: 0, step: 0.1 },
      {
        id: "edgeWeightInfluence",
        type: "number",
        description: true,
        defaultValue: 1.0,
        min: 0,
        step: 0.1,
      },
      { id: "gravity", type: "number", description: true, defaultValue: 1.0, min: 0, step: 0.01, required: true },
      { id: "linLogMode", type: "boolean", description: true, defaultValue: false },
      { id: "outboundAttractionDistribution", type: "boolean", defaultValue: false },
      { id: "scalingRatio", type: "number", defaultValue: 1, min: 0, step: 1, required: true },
      { id: "slowDown", type: "number", defaultValue: 10, min: 1, step: 1 },
      { id: "strongGravityMode", type: "boolean", defaultValue: false },
    ],
  } as WorkerLayout<ForceAtlas2LayoutParameters>,
  {
    id: "force",
    type: "worker",
    supervisor: ForceSupervisor,
    parameters: [
      { id: "attraction", type: "number", description: true, defaultValue: 0.0005, min: 0, step: 0.0001 },
      { id: "repulsion", type: "number", description: true, defaultValue: 0.1, min: 0, step: 0.1 },
      { id: "gravity", type: "number", description: true, defaultValue: 0.0001, min: 0, step: 0.0001 },
      { id: "inertia", type: "number", description: true, defaultValue: 0.6, min: 0, max: 1, step: 0.1 },
      { id: "maxMove", type: "number", description: true, defaultValue: 200 },
    ],
  } as WorkerLayout<ForceLayoutSupervisorParameters>,
  {
    id: "noverlap",
    type: "worker",
    description: true,
    supervisor: NoverlapLayout,
    parameters: [
      { id: "gridSize", type: "number", description: true, defaultValue: 20 },
      { id: "margin", type: "number", description: true, defaultValue: 5 },
      { id: "expansion", type: "number", description: true, defaultValue: 1.1, step: 0.1 },
      { id: "ratio", type: "number", description: true, defaultValue: 1 },
      { id: "speed", type: "number", description: true, defaultValue: 3 },
    ],
  } as WorkerLayout<NoverlapLayoutSupervisorParameters>,
  {
    id: "script",
    type: "sync",
    description: true,
    parameters: [
      {
        id: "script",
        type: "script",
        functionJsDoc: `/**
* Function that return coordinates for the specified node.
*
* @param {string} id The ID of the node
* @param {Object.<string, number | string | boolean | undefined | null>} attributes Attributes of the node
* @param {number} index The index position of the node in the graph
* @param {Graph} graph The graphology instance (documentation: https://graphology.github.io/ )
* @returns {x: number, y: number} The computed coordinates of the node
*/`,
        defaultValue: nodeCoordinatesCustomFn,
        functionCheck: (fn) => {
          if (!fn) throw new Error("Function is not defined");
          // Check & test the function
          const fullGraph = dataGraphToFullGraph(graphDatasetAtom.get());
          const id = fullGraph.nodes()[0];
          const attributs = fullGraph.getNodeAttributes(id);
          const result = fn(id, attributs, 0, fullGraph);
          if (!isObject(result)) throw new Error("Function must returned an object");
          if (isNil(result.x)) throw new Error("Function must returned an object with a `x` property");
          if (isNil(result.y)) throw new Error("Function must returned an object with a `y` property");
        },
      },
    ],
    run(graph: Graph, options) {
      const { script } = options?.settings || {};
      if (!script) {
        console.error("[layout] Custom function is not defined");
        return {};
      }
      // we copy the graph to avoid user to modify it
      const graphCopy = graph.copy();
      Object.freeze(graphCopy);

      const res: LayoutMapping = {};
      graph.nodes().forEach((id, index) => {
        res[id] = script(id, graph.getNodeAttributes(id), index, graphCopy);
      });
      return res;
    },
  } as SyncLayout<{
    script?: (id: string, attributes: ItemData, index: number, graph: Graph) => { x: number; y: number };
  }>,
];
