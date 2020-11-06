module.exports = aStar;

function aStar(params) {
  return new Promise(r => {
    // g - path cost
    // h - distance to end
    const startNode = {
      data: params.start,
      g: 0,
      h: params.heuristic(params.start),
    };
    let closestNode = startNode;
    const checked = [];
    const unchecked = [];
    unchecked.push(startNode);
    const interval = setInterval(() => {
      if (!unchecked.length) {
        clearInterval(interval);
        return r({
          status: 'noPath',
          path: reconstructPath(closestNode),
        });
      }
      const node = unchecked.pop();
      if (params.isEnd(node.data))
        return r({
          status: 'success',
          path: reconstructPath(node),
        });
      checked.push(node.data.toString());
      for (const neighborData of params.getNeighbors(node.data)) {
        if (checked.includes(neighborData.toString())) continue;
        const neighborNode = {
          data: neighborData,
          parent: node,
          g: node.g + params.distance(node.data, neighborData),
          h: params.heuristic(neighborData),
        };
        if (closestNode.h > neighborNode.h) closestNode = neighborNode;
        unchecked.push(neighborNode);
      }
      unchecked.sort((a, b) => b.g + b.h - (a.g + a.h));
    }, params.interval || 10);
  });
}
function reconstructPath(node) {
  if (node.parent !== undefined) {
    const pathSoFar = reconstructPath(node.parent);
    pathSoFar.push(node.data);
    return pathSoFar;
  } else return [node.data];
}
