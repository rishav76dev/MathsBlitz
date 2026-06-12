/**
 * Socket event type definitions (JSDoc).
 * These mirror the TypeScript interfaces in the client's gameTypes.ts.
 */

/**
 * @typedef {Object} QueueEntry
 * @property {string} userId
 * @property {string} socketId
 * @property {number} wager
 * @property {number} joinedAt  - timestamp ms
 */

/**
 * @typedef {Object} Question
 * @property {string} id
 * @property {string} question
 * @property {number} difficulty  - 1=easy 2=medium 3=hard
 */

/**
 * @typedef {Object} QuestionWithAnswer
 * @property {string} id
 * @property {string} question
 * @property {number} answer
 * @property {number} difficulty
 */

/**
 * Server → Client event payloads
 *
 * queue_joined     { wager: number }
 * queue_left       { }
 * match_found      { matchId: string, opponentAddress: string, wager: number }
 * game_started     { matchId: string, durationSeconds: number }
 * new_question     { matchId: string, question: Question }
 * score_update     { matchId: string, scores: { [userId]: number } }
 * game_ended       { matchId: string, winner: string|null, scores: { [userId]: number } }
 * opponent_disconnected { matchId: string }
 *
 * Client → Server event payloads
 *
 * join_queue       { token: string, wager: number }
 * leave_queue      { }
 * submit_answer    { matchId: string, questionId: string, answer: number }
 */

module.exports = {};
