const { User } = require("../models");

const UserRepository = {
  /**
   * Create a new user. Throws if walletAddress already exists.
   * @param {{ walletAddress: string, username?: string }} data
   */
  async create(data) {
    const user = new User({
      walletAddress: data.walletAddress.toLowerCase(),
      ...(data.username ? { username: data.username } : {}),
    });
    return user.save();
  },

  /**
   * Find a user by their MongoDB ObjectId.
   * @param {string} id
   */
  async findById(id) {
    return User.findById(id).exec();
  },

  /**
   * Find a user by their wallet address (case-insensitive).
   * @param {string} walletAddress
   */
  async findByWallet(walletAddress) {
    return User.findOne({ walletAddress: walletAddress.toLowerCase() }).exec();
  },

  /**
   * Find a user by their username.
   * @param {string} username
   */
  async findByUsername(username) {
    return User.findOne({ username }).exec();
  },

  /**
   * Set/update a user's username. Returns null if the name is already taken.
   * @param {string} id
   * @param {string} username
   */
  async setUsername(id, username) {
    try {
      return await User.findByIdAndUpdate(
        id,
        { $set: { username } },
        { new: true, runValidators: true }
      ).exec();
    } catch (err) {
      // Duplicate key on the unique username index.
      if (err && err.code === 11000) return null;
      throw err;
    }
  },

  /**
   * Update a user's ELO and win/loss stats after a match.
   * @param {string} id
   * @param {{ elo: number, wins?: number, losses?: number, matchesPlayed?: number }} data
   */
  async updateElo(id, data) {
    return User.findByIdAndUpdate(
      id,
      {
        $set: { elo: data.elo },
        $inc: {
          wins: data.wins ?? 0,
          losses: data.losses ?? 0,
          matchesPlayed: data.matchesPlayed ?? 0,
        },
      },
      { new: true }
    ).exec();
  },

  /**
   * Get the global leaderboard sorted by ELO descending.
   * @param {number} limit
   * @param {number} skip
   */
  async getLeaderboard(limit = 50, skip = 0) {
    return User.find().sort({ elo: -1 }).skip(skip).limit(limit).exec();
  },

  /**
   * Generic find with an arbitrary filter.
   * @param {object} filter
   */
  async find(filter) {
    return User.find(filter).exec();
  },

  /**
   * Delete a user by ID.
   * @param {string} id
   */
  async deleteById(id) {
    const result = await User.deleteOne({ _id: id }).exec();
    return result.deletedCount === 1;
  },
};

module.exports = { UserRepository };
