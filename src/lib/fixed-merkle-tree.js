import utils from 'ethereumjs-util'
import {Buffer} from 'safe-buffer'

const sha3 = utils.sha3

export default class FixedMerkleTree {
  constructor(depth, leaves = []) {
    const l = leaves.concat(
      Array.from(Array(2 ** depth - leaves.length), () => utils.zeros(32))
    )

    this.leaves = l
    this.layers = [l]
    this.createHashes(this.leaves)
  }

  createHashes(nodes) {
    if (nodes.length === 1) {
      return false
    }

    const treeLevel = []
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i]
      const right = nodes[i + 1]
      const data = Buffer.concat([left, right])
      treeLevel.push(sha3(data))
    }

    // is odd number of nodes
    if (nodes.length % 2 === 1) {
      treeLevel.push(nodes[nodes.length - 1])
    }

    this.layers.push(treeLevel)
    this.createHashes(treeLevel)
  }

  getLeaves() {
    return this.leaves
  }

  getLayers() {
    return this.layers
  }

  getRoot() {
    return this.layers[this.layers.length - 1][0]
  }

  getPlasmaProof(leaf) {
    let index = -1
    for (let i = 0; i < this.leaves.length; i++) {
      if (Buffer.compare(leaf, this.leaves[i]) === 0) {
        index = i
      }
    }

    const proof = []
    if (index <= this.getLeaves().length) {
      let siblingIndex
      for (let i = 0; i < this.layers.length - 1; i++) {
        if (index % 2 === 0) {
          siblingIndex = index + 1
        } else {
          siblingIndex = index - 1
        }
        index = parseInt(index / 2)
        proof.push(this.layers[i][siblingIndex])
      }
    }
    return proof
  }

  getProof(leaf, index) {
    const proof = []

    if (typeof index !== 'number') {
      index = -1
      for (let i = 0; i < this.leaves.length; i++) {
        if (Buffer.compare(leaf, this.leaves[i]) === 0) {
          index = i
        }
      }
    }

    if (index <= -1) {
      return []
    }

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i]
      const isRightNode = index % 2
      const pairIndex = isRightNode ? index - 1 : index + 1

      if (pairIndex < layer.length) {
        proof.push({
          position: isRightNode ? 'left' : 'right',
          data: layer[pairIndex]
        })
      }

      // set index to parent index
      index = (index / 2) | 0
    }

    return proof
  }

  verify(proof, targetNode, root) {
    let hash = targetNode

    if (!Array.isArray(proof) || !proof.length || !targetNode || !root) {
      return false
    }

    for (let i = 0; i < proof.length; i++) {
      const node = proof[i]
      const isLeftNode = node.position === 'left'
      const buffers = []
      buffers.push(hash)
      buffers[isLeftNode ? 'unshift' : 'push'](node.data)
      hash = sha3(Buffer.concat(buffers))
    }

    return Buffer.compare(hash, root) === 0
  }
}
