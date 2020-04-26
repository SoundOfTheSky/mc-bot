const aStar = require('a-star');
const cardinalDirectionVectors = [
  vec3(-1, 0, 0), // north
  vec3(1, 0, 0), // south
  vec3(0, 0, -1), // east
  vec3(0, 0, 1) // west
]
const navigate = (bot,coords, options={})=>{
  const end = coords.floored();
  const results = aStar({
    start: {
      point: bot.entity.position.floored(),
      water: 0
    },
    isEnd: node=>node.point.distanceTo(end) <= 0.1,
    neighbor: getNeighbors,
    distance: (a,b)=>a.point.distanceTo(b.point),
    heuristic: node=>node.point.distanceTo(end) + 5 * node.water,
    timeout: 10000
  })
  //results.path = results.path.map(nodeCenterOffset)
  return results
}
module.exports = {
  navigate: navigate,
  cardinalDirectionVectors: cardinalDirectionVectors
}
