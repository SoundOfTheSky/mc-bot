const aStar = require('./aStar');
const Vec3 = require('vec3');
const { Physics, PlayerState } = require('prismarine-physics');
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
function Node(d) {
  this.point = d.pos;
  this.action = d.action || 'move';
  this.toString = () => this.point.toString();
}
class Navigator {
  constructor(bot) {
    this.bot = bot;
    this.bot.navigate = this.navigate;
    this.bot.physics.jumpSpeed = 10;
    this.physics = Physics(require('minecraft-data')(this.bot.version), { getBlock: this.bot.blockAt });
  }
  moveToPoint(node) {
    console.log(node);
    return new Promise(r => {
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
          if (
            Math.abs(this.bot.entity.position.x - node.point.x) > 0.1 ||
            Math.abs(this.bot.entity.position.z - node.point.z) > 0.1
          ) {
            this.bot.setControlState('forward', true);
            this.bot.setControlState('sprint', true);
          }
          if (
            this.bot.entity.onGround &&
            (Math.floor(this.bot.entity.position.y) < Math.floor(p.y) ||
              (node.action === 'jump' && this.bot.entity.position.distanceTo(p) > 1))
          )
            this.bot.setControlState('jump', true);
        }
        if (this.bot.entity.position.distanceTo(p) < 0.2) {
          this.bot.clearControlStates();
          clearInterval(interval);
          r();
        }
      }, 1);
    });
  }
  navigate = async p => {
    const end = p.floored();
    const results = aStar({
      start: new Node({ pos: this.bot.entity.position.floored() }),
      isEnd: node => node.point.distanceTo(end) <= 0.1,
      neighbor: node => this.getNeighborsSimple(node),
      distance: (a, b) => a.point.distanceTo(b.point),
      heuristic: node => node.point.distanceTo(end),
    });
    this.bot.viewer.drawLine(
      'navigation',
      results.path.map(el => vecMid(el.point)),
      0x0089ff,
    );
    if (results.status === 'success') for (const node of results.path) await this.moveToPoint(node);
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
  isSafePos(pos) {
    const block0 = this.bot.blockAt(pos.offset(0, -1, 0));
    const block1 = this.bot.blockAt(pos);
    const block2 = this.bot.blockAt(pos.offset(0, 1, 0));
    if (block1.boundingBox === 'block' || block2.boundingBox === 'block') return false;
    if (isWater(block0) || isWater(block1) || isWater(block2)) return true;
    return block0.boundingBox === 'block';
  }
  emulateTill(state = {}, controls = {}, isEnd = () => {}, tickTimeout = 400) {
    const player = {
      version: this.bot.version,
      inventory: {
        slots: state.inventory?.slots ? [...state.inventory.slots] : [],
      },
      entity: {
        position: state.entity?.position ? state.entity.position.clone() : new Vec3(0, 0, 0),
        velocity: state.entity?.velocity ? state.entity.velocity.clone() : new Vec3(0, 0, 0),
        onGround: state.entity?.onGround ? state.entity.onGround : true,
        isInWater: state.entity?.isInWater ? state.entity.isInWater : false,
        isInLava: state.entity?.isInLava ? state.entity.isInLava : false,
        isInWeb: state.entity?.isInWeb ? state.entity.isInWeb : false,
        isCollidedHorizontally: false,
        isCollidedVertically: false,
        effects: state.entity?.effects ? [...state.entity.effects] : [],
        yaw: state.entity?.yaw ? state.entity.yaw : 0,
      },
      jumpTicks: state.jumpTicks || 0,
      jumpQueued: state.jumpQueued || false,
    };
    const playerState = new PlayerState(player, {
      ...{
        forward: true,
        back: false,
        left: false,
        right: false,
        jump: true,
        sprint: true,
        sneak: false,
      },
      ...controls,
    });
    let ticksLeft = tickTimeout;
    while (!isEnd(player) && ticksLeft--)
      this.physics.simulatePlayer(playerState, { getBlock: this.bot.blockAt }).apply(player);
    return player;
  }
  getNeighborsSimple(node) {
    try {
      const p = node.point.floored();
      const results = [];
      const freeDirections = [];
      let canJump = this.bot.blockAt(p.offset(0, 2, 0)).boundingBox === 'empty';
      // jump, drop, swim up and down
      if (this.isSafePos(p.offset(0, 1, 0))) results.push({ pos: p.offset(0, 1, 0) });
      if (this.isSafePos(p.offset(0, -1, 0))) results.push({ pos: p.offset(0, -1, 0) });
      const checkDir = (d, i) => {
        const b = (y, m = 1) => p.offset(d.x * m, y, d.z * m);
        // if block at head level cant go in this direction
        if (this.bot.blockAt(b(1)).boundingBox === 'block') return;
        if (i !== undefined) freeDirections[i] = true;
        // walk forward
        if (this.isSafePos(b(0))) return results.push({ pos: b(0) });
        // walk up
        if (canJump && this.isSafePos(b(1))) return results.push({ pos: b(1) });
        // walk down
        for (let hy = 1; hy <= 3; hy++) if (this.isSafePos(b(-hy))) return results.push({ pos: b(-hy) });
        if (this.isSafePos(b(-3, 2))) return results.push({ pos: b(-3, 2) });
      };
      // check cardinal dirs
      for (let i = 0; i < directions.length; i++) checkDir(directions[i], i);
      // check diagonal dirs
      for (let i = 0; i < diagonalDirections.length; i++)
        if (freeDirections[i] && freeDirections[(i + 1) % 4]) checkDir(diagonalDirections[i]);
      // eslint-disable-next-line no-constant-condition
      if (canJump)
        for (let yaw = 0; yaw < 360; yaw += 15) {
          const player = this.emulateTill({ entity: { position: p, yaw } }, {}, p => p.entity.isCollidedVertically);
          if (player.entity.isInWater || player.entity.isInWeb || p.y - player.entity.position.y < 2) {
            console.log(yaw, player.entity.position.floored(), p.y - player.entity.position.y);
            results.push({ pos: player.entity.position.floored(), action: 'jump' });
          }
        }
      return results.map(el => new Node(el));
    } catch (e) {
      console.log(e);
      return [];
    }
  }
}
module.exports = Navigator;
