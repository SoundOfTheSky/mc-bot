const aStar = require('./aStar');
const Vec3 = require('vec3');
const vecMid = v => v.floored().offset(0.5, 0, 0.5);
const isWater = b => b.type === 8 || b.type === 9;
const radians = [
  Math.PI * 2, //0 z-
  Math.PI / 4, //45 x-z-
  Math.PI / 2, //90 x-
  (3 * Math.PI) / 4, //135 x-z+
  Math.PI, //180 z+
  (5 * Math.PI) / 4, //225 x+z+
  (3 * Math.PI) / 2, //270 x+
  (7 * Math.PI) / 4, //315 x+z-
];
const diagonalDirections = [Vec3(-1, 0, -1), Vec3(-1, 0, 1), Vec3(1, 0, 1), Vec3(1, 0, -1)];
const directions = [Vec3(0, 0, -1), Vec3(-1, 0, 0), Vec3(0, 0, 1), Vec3(1, 0, 0)];
function Node(pos, action = 'move') {
  this.point = pos;
  this.action = action;
  this.toString = () => this.point.toString();
}
class Navigator {
  constructor(bot) {
    console.log('[Navigator] Calculating physics for bot...');
    this.bot = bot;
    this.bot.navigate = this.navigate;
    this.emuJumps = radians.map(r => this.emulateJump(r));
    console.log('[Navigator] Ready!');
  }
  moveToPoint(node) {
    return new Promise((r, j) => {
      if (node.action === 'move') {
        // center player
        const p = vecMid(node.point);
        this.bot.entity.position = vecMid(this.bot.entity.position);
        const interval = setInterval(() => {
          // look at point
          const delta = p.minus(this.bot.entity.position);
          this.bot.look(Math.atan2(-delta.x, -delta.z), 0);
          // set controls
          this.bot.clearControlStates();
          // is swimming
          if (
            isWater(this.bot.blockAt(this.bot.entity.position)) ||
            isWater(this.bot.blockAt(this.bot.entity.position.offset(0, 1, 0))) ||
            isWater(this.bot.blockAt(this.bot.entity.position.offset(0, -1, 0)))
          ) {
            this.bot.entity.position.x += node.point.x > this.bot.entity.position.x ? 0.1 : -0.1;
            this.bot.entity.position.y += node.point.y > this.bot.entity.position.y ? 0.1 : -0.1;
            this.bot.entity.position.z += node.point.x > this.bot.entity.position.z ? 0.1 : -0.1;
          } else {
            this.bot.setControlState('forward', true);
            this.bot.setControlState('sprint', true);
            if (this.bot.entity.onGround && Math.floor(this.bot.entity.position.y) < Math.floor(p.y))
              this.bot.setControlState('jump', true);
          }
          if (this.bot.entity.position.distanceTo(p) < 0.2) {
            this.bot.clearControlStates();
            clearInterval(interval);
            r();
          }
        }, 50);
      } else {
        let stop = false;
        const interval = setInterval(() => {
          this.bot.look(node.yaw, 0);
          this.bot.clearControlStates();
          if (node.forward === 1) this.bot.setControlState('forward', true);
          if (node.forward === -1) this.bot.setControlState('back', true);
          if (node.right === 1) this.bot.setControlState('right', true);
          if (node.right === -1) this.bot.setControlState('left', true);
          if (node.jump) this.bot.setControlState('jump', true);
          if (node.sprint) this.bot.setControlState('sprint', true);
          const d = this.bot.entity.position.distanceTo(node.point);
          console.log(d);
          if (d < 0.1) {
            this.bot.clearControlStates();
            clearInterval(interval);
            r();
          }
          if (this.bot.entity.onGround)
            if (stop) {
              this.bot.clearControlStates();
              clearInterval(interval);
              console.log(this.bot.entity.position);
              console.log(node.point);
            } else stop = true;
        }, 50);
      }
    });
  }
  navigate = async p => {
    this.bot.physics.jumpSpeed = 10;
    const end = p.floored();
    const results = aStar({
      start: new Node(this.bot.entity.position.floored(), 'move', this.bot.entity.yaw),
      isEnd: node => node.point.distanceTo(end) <= 0.1,
      neighbor: node => this.getNeighborsSimple(node),
      distance: (a, b) => a.point.distanceTo(b.point),
      heuristic: node => node.point.distanceTo(end),
    });
    if (results.status === 'success') {
      for (const node of results.path) {
        await this.moveToPoint(node);
      }
    }
    console.log(results.status);
  };
  getBoundingBox = pos => ({
    min: new Vec3(pos.x - this.bot.physics.playerApothem, pos.y, pos.z - this.bot.physics.playerApothem).floor(),
    max: new Vec3(
      pos.x + this.bot.physics.playerApothem,
      pos.y + this.bot.physics.playerHeight,
      pos.z + this.bot.physics.playerApothem,
    ).floor(),
  });
  collisionInRange(boundingBox) {
    const cursor = new Vec3(0, 0, 0);
    let block;
    for (cursor.x = boundingBox[0].x; cursor.x <= boundingBox[1].x; cursor.x++) {
      for (cursor.y = boundingBox[0].y; cursor.y <= boundingBox[1].y; cursor.y++) {
        for (cursor.z = boundingBox[0].z; cursor.z <= boundingBox[1].z; cursor.z++) {
          block = this.bot.blockAt(cursor);
          if (block && block.boundingBox === 'block') return true;
        }
      }
    }
    return false;
  }
  emulateJump(yaw, pos = new Vec3(0, 0, 0), sprint = true) {
    let vel = new Vec3(
      this.bot.physics.maxGroundSpeed * this.bot.physics.sprintSpeed * -Math.sin(yaw),
      this.bot.physics.jumpSpeed,
      this.bot.physics.maxGroundSpeed * this.bot.physics.sprintSpeed * -Math.cos(yaw),
    );
    let results = [];
    while (true) {
      vel.y -= this.bot.physics.gravity * 0.05;
      vel.y = Math.min(Math.max(vel.y, -this.bot.physics.terminalVelocity), this.bot.physics.terminalVelocity);
      pos.x += vel.x * 0.05;
      pos.z += vel.z * 0.05;
      pos.y += vel.y * 0.05;
      results.push(pos);
      if (pos.y < -255) return results;
    }
  }
  isSafePos(pos) {
    const block0 = this.bot.blockAt(pos.offset(0, -1, 0));
    const block1 = this.bot.blockAt(pos);
    const block2 = this.bot.blockAt(pos.offset(0, 1, 0));
    if (block1.boundingBox === 'block' || block2.boundingBox === 'block') return false;
    if (isWater(block0) || isWater(block1) || isWater(block2)) return true;
    return block0.boundingBox === 'block';
  }
  getNeighborsSimple(node) {
    try {
      const p = node.point.floored();
      const results = [];
      let canJump;
      // jump, drop, swim up and down
      if (this.isSafePos(p.offset(0, 1, 0))) results.push({ pos: p.offset(0, 1, 0) });
      if (this.isSafePos(p.offset(0, -1, 0))) results.push({ pos: p.offset(0, -1, 0) });
      // if player on ground check cardinal directions
      if (this.bot.blockAt(p.offset(0, -0.1, 0)).boundingBox === 'block') {
        const checkDir = (d, i) => {
          const b = (y, m = 1) => p.offset(d.x * m, y, d.z * m);
          // if block at head level cant go in this direction
          if (this.bot.blockAt(b(1)).boundingBox === 'block') return;
          if (i !== undefined) freeDirections[i] = true;
          // walk forward
          if (this.isSafePos(b(0))) return results.push({ pos: b(0) });
          // walk up
          canJump = this.bot.blockAt(p.offset(0, 2, 0)).boundingBox === 'empty';
          if (canJump && this.isSafePos(b(1))) return results.push({ pos: b(1) });
          // walk down
          for (let hy = 1; hy <= 3; hy++) if (this.isSafePos(b(-hy))) return results.push({ pos: b(-hy) });
          if (this.isSafePos(b(-3, 2))) return results.push({ pos: b(-3, 2) });
        };
        const freeDirections = [];
        for (let i = 0; i < directions.length; i++) {
          checkDir(directions[i], i);
        }
        for (let i = 0; i < diagonalDirections.length; i++) {
          if (freeDirections[i] && freeDirections[(i + 1) % 4]) checkDir(diagonalDirections[i]);
        }
        for (let i = 0; i < radians.length; i++) {
          const r = radians[i];
          this.emuJumps[i].forEach(ep => {
            for (let y = p.yep.y; y > 0; y--) {
              let cursor = new Vec3(p.x + ep.x, py, p.z);
              let block = this.bot.blockAt(cursor.offset(0, -0.1, 0));
              if ((p.y - y <= 3 && block.boundingBox === 'block') || isWater(block)) {
                results.push({ pos: cursor });
                break;
              }
            }
          });
        }
      } else return [];
      return results.map(el => new Node(el.pos));
    } catch (e) {
      console.log(e);
      return [];
    }
  }
}
module.exports = Navigator;
