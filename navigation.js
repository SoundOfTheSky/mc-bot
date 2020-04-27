const aStar = require('./aStar');
const vec3 = require('vec3');
const cardinalDirectionVectors = [
  vec3(-1, 0, 0), // north
  vec3(1, 0, 0), // south
  vec3(0, 0, -1), // east
  vec3(0, 0, 1) // west
]
const jumpHeights = [0,1,1,1,1,-1];
const blocksToAvoid=[];
function Node(point,action) {
  this.point=point;
  this.action=action;
  this.toString = ()=>{
    return this.point.x+'_'+this.point.y+'_'+this.point.z;
  }
}
const vecMid = v=>v.floored().offset(.5,0,.5);
function moveToPoint(bot,p,sprint=true, jump=false, longjump=false,swim=false) {
  bot.entity.position=vecMid(bot.entity.position);
  return new Promise((r,j)=>{
    const interval = setInterval(()=>{
      bot.lookAt(vec3(p.x+0.5,bot.entity.position.y+1.9,p.z+0.5));
      if(longjump&&bot.entity.position.distanceTo(vecMid(bot.entity.position.floored()))>0.4) bot.setControlState('jump', true);
      if(jump) bot.setControlState('jump', true);
      if(swim) {
        bot.entity.position.x +=p.x > bot.entity.position.x?0.1:-0.1;
        bot.entity.position.y +=p.y > bot.entity.position.y?0.1:-0.1;
        bot.entity.position.z +=p.x > bot.entity.position.z?0.1:-0.1;
      }
      /*console.log(vecMid(p));
      console.log(bot.entity.position);
      console.log(bot.entity.position.distanceTo(vecMid(p)));*/
      if(bot.entity.position.distanceTo(vecMid(p))<0.2) {
        console.log('ok');
        clearInterval(interval);
        bot.setControlState('forward', false);
        bot.setControlState('sprint', false);
        bot.setControlState('jump', false);
        r();
      }
    },50);
    bot.setControlState('forward', true);
    bot.setControlState('sprint', true);
  });
}
const navigate = async (bot,coords, options={})=>{
  const end = coords.floored();
  const results = aStar({
    start: new Node(bot.entity.position.floored(), 'walk'),
    isEnd: node=>node.point.distanceTo(end) <= 0.1,
    neighbor: node=>getNeighbors(node,bot),
    distance: (a,b)=>a.point.distanceTo(b.point),
    heuristic: node=>node.point.distanceTo(end)
  });
  if(results.status==='success') {
    for(const node of results.path) {
      console.log(node);
      await moveToPoint(bot,node.point,false,node.action==='jump', node.action==='longjump', node.action==='swim');
    }
    console.log('FINISH')
  }
  //results.path = results.path.map(nodeCenterOffset)
  return results
}
function getNeighbors(node,bot) {
  const blocks={};
  function getBlock(p) {
    let block=blocks[p.x+'_'+p.y+'_'+p.z];
    if(!block) block=bot.blockAt(p);
    return block;
  }
  const point = node.point
  const result = [];
  const a = [-1,1];
  a.forEach(dv=>{
    const block0 = getBlock(point.offset(0,dv,0));
    if(block0.type===8||block0.type===9) return result.push({p:point.offset(0,dv,0), a:'swim'});
  });
  const isFloor = b=>b.boundingBox==='block'||b.type===8||b.type===9;
  function getSafeFloor(x,z) {
    for(let y=-1; y<point.y; y++) {
      const b=getBlock(point.offset(x,-y,z))
      if(b.boundingBox==='block'||b.type===8||b.type===9) return result.push({p:point.offset(x,-y+1,z),a:'walk'});
    }
  }
  cardinalDirectionVectors.forEach(dv=>{
    if(getBlock(point.offset(dv.x,1,dv.z)).boundingBox==='block') return;
    if(getBlock(point.offset(dv.x,0,dv.z)).boundingBox==='block') {
      if(getBlock(point.offset(0, 2, 0)).boundingBox==='block') return;
      if(getBlock(point.offset(dv.x, 2, dv.z)).boundingBox==='block') return;
      return result.push({p:point.offset(dv.x,1,dv.z),a:'jump'});
    }
    const block = getBlock(point);
    if(block.type===8||block.type===9) {
      if(getBlock(point.offset(0,2,0)).boundingBox==='empty') result.push({p:point.offset(0,1,0),a:'swim'});
      if(getBlock(point.offset(0,-1,0)).boundingBox==='empty') result.push({p:point.offset(0,-1,0),a:'swim'});
       result.push({p:point.offset(dv.x,0,dv.z),a:'swim'});
      return;
    }
    if(getBlock(point.offset(dv.x,-1,dv.z)).boundingBox==='block') return result.push({p:point.offset(dv.x,0,dv.z),a:'walk'});
    if(getBlock(point.offset(dv.x,-2,dv.z)).boundingBox==='block') return result.push({p:point.offset(dv.x,-1,dv.z),a:'walk'});
    if(getBlock(point.offset(dv.x,-3,dv.z)).boundingBox==='block') return result.push({p:point.offset(dv.x,-2,dv.z),a:'walk'});
    if(getBlock(point.offset(dv.x,-4,dv.z)).boundingBox==='block') return result.push({p:point.offset(dv.x,-3,dv.z),a:'walk'});
    const maxHeight=point.y+1;
    for(let i=1; i<jumpHeights.length;i++) {
      const j = jumpHeights[i];
      const h=maxHeight-point.offset(0,j,0).y;
      if(getBlock(point.offset(dv.x*i,j,dv.z*i)).boundingBox==='empty') {
        if (getBlock(point.offset(dv.x*i, j + 1, dv.z*i)).boundingBox === 'empty' && getBlock(point.offset(dv.x*i, j - 1, dv.z*i)).boundingBox === 'block')
          return result.push({p:point.offset(dv.x*i, j, dv.z*i),a:'longjump'});
        if (h<=3&&getBlock(point.offset(dv.x*i, j - 1, dv.z*i)).boundingBox === 'empty' && getBlock(point.offset(dv.x*i, j - 2, dv.z*i)).boundingBox === 'block')
          return result.push({p:point.offset(dv.x*i, j - 1, dv.z*i),a:'longjump'});
      }
      if(getBlock(point.offset(dv.x*i,j-2,dv.z*i)).boundingBox==='empty') {
        if(h<=2&&getBlock(point.offset(dv.x*i, j - 1, dv.z*i)).boundingBox === 'empty'&& getBlock(point.offset(dv.x*i, j - 3, dv.z*i)).boundingBox === 'block')
          return result.push({p:point.offset(dv.x*i, j - 2, dv.z*i),a:'longjump'});
        if(h<=1&&getBlock(point.offset(dv.x*i, j - 3, dv.z*i)).boundingBox === 'empty'&& getBlock(point.offset(dv.x*i, j - 4, dv.z*i)).boundingBox === 'block')
          return result.push({p:point.offset(dv.x*i, j - 3, dv.z*i),a:'longjump'});
      }
    }
  });
  return result.map(el=>new Node(el.p, el.a));
}
module.exports = {
  navigate: navigate,
  cardinalDirectionVectors: cardinalDirectionVectors
}
