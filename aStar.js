const assert = require('assert');

module.exports = aStar;

function aStar(params) {
  const startNode = {
    data: params.start,
    g: 0,
    h: params.heuristic(params.start),
  };
  let bestNode = startNode;
  startNode.f = startNode.h;
  const closedDataSet = [];
  const openHeap = [];
  const openDataMap = {};
  openHeap.push(startNode);
  openDataMap[startNode.toString()]=startNode;
  while (openHeap.length) {
    const node = openHeap.pop();
    delete openDataMap[node.data.toString()];
    if (params.isEnd(node.data))
      return {
        status: 'success',
        cost: node.g,
        path: reconstructPath(node),
      }
    closedDataSet.push(node.data.toString());
    const neighbors = params.neighbor(node.data);
    for(const neighborData of neighbors) {
      if (closedDataSet.includes(neighborData.toString())) continue;
      const gFromThisNode = node.g + params.distance(node.data, neighborData);
      let neighborNode = openDataMap[neighborData.toString()];
      let update = false;
      if (neighborNode === undefined) {
        neighborNode = {
          data: neighborData,
        };
        openDataMap[neighborData.toString()]=neighborNode;
      }
      else {
        if (neighborNode.g < gFromThisNode)
          continue;
        update = true;
      }
      neighborNode.parent = node;
      neighborNode.g = gFromThisNode;
      neighborNode.h = params.heuristic(neighborData);
      neighborNode.f = gFromThisNode + neighborNode.h;
      if(neighborNode.h < bestNode.h) bestNode = neighborNode;
      if (!update)
        openHeap.push(neighborNode);
      openHeap.sort((a,b)=>b.f - a.f);
    }
  }
  return {
    status: "noPath",
    cost: bestNode.g,
    path: reconstructPath(bestNode),
  };
}

function reconstructPath(node) {
  if (node.parent !== undefined) {
    const pathSoFar = reconstructPath(node.parent);
    pathSoFar.push(node.data);
    return pathSoFar;
  } else {
    // this is the starting node
    return [node.data];
  }
}
