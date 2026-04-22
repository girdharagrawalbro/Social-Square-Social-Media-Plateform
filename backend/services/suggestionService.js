const path = require('path');
const { spawn } = require('child_process');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const logger = require('../utils/logger');

const PYTHON_ENABLED = (process.env.SUGGESTIONS_PYTHON_ENABLED || 'false').toLowerCase() !== 'false';
const PYTHON_EXECUTABLE = process.env.SUGGESTIONS_PYTHON_EXECUTABLE || 'python';
const PYTHON_TIMEOUT_MS = Number(process.env.SUGGESTIONS_PYTHON_TIMEOUT_MS || 2000);
const PYTHON_SCRIPT = path.join(__dirname, '..', 'ml', 'suggestion_rerank.py');

const LIMIT_CANDIDATES = 250;
const RECENT_ACTIVITY_DAYS = 45;

function toId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  return String(value);
}

function clamp(v, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

function normalizeLog(value, maxValue) {
  if (!value || !maxValue) return 0;
  return clamp(Math.log1p(value) / Math.log1p(maxValue));
}

function daysSince(dateValue) {
  if (!dateValue) return 999;
  const ts = new Date(dateValue).getTime();
  if (Number.isNaN(ts)) return 999;
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

async function buildUserInterest(loggedUserId, savedPostIds) {
  const [likedPosts, savedPosts, userComments] = await Promise.all([
    Post.find({ likes: loggedUserId }).select('_id category mood user').lean(),
    savedPostIds?.length
      ? Post.find({ _id: { $in: savedPostIds } }).select('_id category mood user').lean()
      : [],
    Comment.find({ 'user._id': loggedUserId }).select('postId').lean(),
  ]);

  const commentedPostIds = [...new Set(userComments.map(c => toId(c.postId)).filter(Boolean))];
  const commentedPosts = commentedPostIds.length
    ? await Post.find({ _id: { $in: commentedPostIds } }).select('_id category mood user').lean()
    : [];

  const categoryScores = new Map();
  const moodScores = new Map();

  const addTaxonomy = (post, weight) => {
    if (post?.category) categoryScores.set(post.category, (categoryScores.get(post.category) || 0) + weight);
    if (post?.mood) moodScores.set(post.mood, (moodScores.get(post.mood) || 0) + weight);
  };

  likedPosts.forEach(p => addTaxonomy(p, 2));
  savedPosts.forEach(p => addTaxonomy(p, 3));
  commentedPosts.forEach(p => addTaxonomy(p, 2));

  const topCategories = [...categoryScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topMoods = [...moodScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);

  return {
    categoryScores,
    moodScores,
    topCategories,
    topMoods,
  };
}

async function buildCandidateSignals(loggedUserId, followingIds) {
  const mongoose = require('mongoose');
  const excludeStrings = [String(loggedUserId), ...(followingIds || []).map(id => String(id))];
  const excludeSet = new Set(excludeStrings);
  const excludeObjectIds = excludeStrings.map(id => new mongoose.Types.ObjectId(id));

  const followingDocs = followingIds?.length
    ? await User.find({ _id: { $in: followingIds } }).select('following').lean()
    : [];

  const mutualCounts = new Map();
  for (const doc of followingDocs) {
    if (!Array.isArray(doc.following)) continue;
    for (const candidate of doc.following) {
      const candidateId = String(candidate);
      if (!candidateId || excludeSet.has(candidateId)) continue;
      mutualCounts.set(candidateId, (mutualCounts.get(candidateId) || 0) + 1);
    }
  }

  const since = new Date(Date.now() - RECENT_ACTIVITY_DAYS * 24 * 60 * 60 * 1000);
  const activeCreators = await Post.aggregate([
    { $match: { createdAt: { $gte: since } } },
    {
      $project: {
        creatorId: '$user._id',
        likesCount: { $size: { $ifNull: ['$likes', []] } },
        score: { $ifNull: ['$score', 0] },
        createdAt: 1,
        category: 1,
        mood: 1,
      }
    },
    {
      $group: {
        _id: '$creatorId',
        postsCount: { $sum: 1 },
        avgLikes: { $avg: '$likesCount' },
        avgScore: { $avg: '$score' },
        latestPostAt: { $max: '$createdAt' },
        topCategories: { $push: '$category' },
        topMoods: { $push: '$mood' },
      }
    },
    { $sort: { postsCount: -1, avgLikes: -1, avgScore: -1 } },
    { $limit: 200 },
  ]);

  const activityByUser = new Map();
  for (const row of activeCreators) {
    const id = String(row._id);
    if (!id || excludeSet.has(id)) continue;

    const categoryCount = {};
    for (const c of row.topCategories || []) {
      if (!c) continue;
      categoryCount[c] = (categoryCount[c] || 0) + 1;
    }
    const moodCount = {};
    for (const m of row.topMoods || []) {
      if (!m) continue;
      moodCount[m] = (moodCount[m] || 0) + 1;
    }

    activityByUser.set(id, {
      postsCount: row.postsCount || 0,
      avgLikes: row.avgLikes || 0,
      avgScore: row.avgScore || 0,
      latestPostAt: row.latestPostAt || null,
      categoryCount,
      moodCount,
    });
  }

  const randomUsers = await User.aggregate([
    { $match: { _id: { $nin: excludeObjectIds }, isBanned: { $ne: true } } },
    { $sample: { size: 120 } },
    { $project: { _id: 1 } },
  ]);

  const candidateIds = new Set([...mutualCounts.keys(), ...activityByUser.keys(), ...randomUsers.map(u => toId(u._id))]);
  return {
    candidateIds: [...candidateIds].slice(0, LIMIT_CANDIDATES),
    mutualCounts,
    activityByUser,
  };
}

function computeInterestSimilarity(interest, candidateActivity) {
  let score = 0;
  let totalWeight = 0;

  for (const [category, weight] of interest.topCategories) {
    totalWeight += weight;
    if (candidateActivity?.categoryCount?.[category]) {
      score += Math.min(weight, candidateActivity.categoryCount[category]);
    }
  }
  for (const [mood, weight] of interest.topMoods) {
    totalWeight += weight;
    if (candidateActivity?.moodCount?.[mood]) {
      score += Math.min(weight, candidateActivity.moodCount[mood]);
    }
  }

  if (!totalWeight) return 0;
  return clamp(score / totalWeight);
}

function reasonFromSignals(candidate, mutualCount) {
  if (mutualCount >= 2) return `${mutualCount} mutual follows`;
  if (candidate.interestScore >= 0.45) return 'Similar interests';
  if (candidate.activityScore >= 0.5) return 'Active creator';
  if (candidate.socialScore >= 0.5) return 'Popular in community';
  return 'People you may know';
}

function rerankWithPython(payload) {
  return new Promise((resolve, reject) => {
    if (!PYTHON_ENABLED) {
      resolve(null);
      return;
    }

    const child = spawn(PYTHON_EXECUTABLE, [PYTHON_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Python rerank timed out'));
    }, PYTHON_TIMEOUT_MS);

    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });

    child.on('error', reject);
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr || `Python rerank exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(error);
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function diversifyByPrimaryCategory(candidates, limit) {
  const byCategory = new Map();
  for (const c of candidates) {
    const key = c.primaryCategory || 'uncategorized';
    if (!byCategory.has(key)) byCategory.set(key, []);
    byCategory.get(key).push(c);
  }

  const result = [];
  const buckets = [...byCategory.values()];
  while (result.length < limit && buckets.some(b => b.length)) {
    for (const bucket of buckets) {
      if (!bucket.length) continue;
      result.push(bucket.shift());
      if (result.length >= limit) break;
    }
  }

  return result;
}

async function getSuggestedUsers(loggedUserId, limit = 10, page = 1) {
  const user = await User.findById(loggedUserId).select('_id following savedPosts').lean();
  if (!user) return [];

  const followingIds = Array.isArray(user.following) ? user.following.map(toId).filter(Boolean) : [];

  const [interest, candidateSignals] = await Promise.all([
    buildUserInterest(loggedUserId, user.savedPosts || []),
    buildCandidateSignals(loggedUserId, followingIds),
  ]);

  if (!candidateSignals.candidateIds.length) return [];

  const candidateUsers = await User.find({
    _id: { $in: candidateSignals.candidateIds },
    isBanned: { $ne: true },
  })
    .select('_id fullname profile_picture followers following created_at')
    .lean();

  const maxMutual = Math.max(1, ...candidateUsers.map(u => candidateSignals.mutualCounts.get(toId(u._id)) || 0));
  const maxFollowers = Math.max(1, ...candidateUsers.map(u => (u.followers || []).length));
  const maxPosts = Math.max(1, ...candidateUsers.map(u => candidateSignals.activityByUser.get(toId(u._id))?.postsCount || 0));

  let ranked = candidateUsers.map(candidate => {
    const id = toId(candidate._id);
    const mutualCount = candidateSignals.mutualCounts.get(id) || 0;
    const activity = candidateSignals.activityByUser.get(id) || null;

    const mutualScore = normalizeLog(mutualCount, maxMutual);
    const interestScore = computeInterestSimilarity(interest, activity);

    const postDensity = normalizeLog(activity?.postsCount || 0, maxPosts);
    const likeStrength = clamp((activity?.avgLikes || 0) / 20);
    const scoreStrength = clamp((activity?.avgScore || 0) / 100);
    const recencyFactor = clamp(1 - (daysSince(activity?.latestPostAt) / 60));
    const activityScore = clamp((postDensity * 0.35) + (likeStrength * 0.3) + (scoreStrength * 0.2) + (recencyFactor * 0.15));

    const socialScore = normalizeLog((candidate.followers || []).length, maxFollowers);
    const freshnessScore = clamp(1 - (daysSince(candidate.created_at) / 180));

    const score = clamp(
      (mutualScore * 0.38) +
      (interestScore * 0.28) +
      (activityScore * 0.22) +
      (socialScore * 0.08) +
      (freshnessScore * 0.04)
    );

    const topCategory = activity?.categoryCount
      ? Object.entries(activity.categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0]
      : null;

    return {
      _id: candidate._id,
      fullname: candidate.fullname,
      profile_picture: candidate.profile_picture,
      followersCount: (candidate.followers || []).length,
      followingCount: (candidate.following || []).length,
      score,
      mutualCount,
      mutualScore,
      interestScore,
      activityScore,
      socialScore,
      freshnessScore,
      primaryCategory: topCategory,
    };
  });

  ranked.sort((a, b) => b.score - a.score);

  try {
    const pyResult = await rerankWithPython({
      userId: String(loggedUserId),
      candidates: ranked.map(c => ({
        userId: String(c._id),
        score: c.score,
        mutualCount: c.mutualCount,
        mutualScore: c.mutualScore,
        interestScore: c.interestScore,
        activityScore: c.activityScore,
        socialScore: c.socialScore,
        freshnessScore: c.freshnessScore,
        followersCount: c.followersCount,
        followingCount: c.followingCount,
      })),
      limit: 50, // Rank more candidates to support pagination
    });

    if (pyResult?.ranked?.length) {
      const rerankMap = new Map(pyResult.ranked.map((r, i) => [String(r.userId), { i, score: r.score }]));
      ranked = ranked
        .filter(c => rerankMap.has(String(c._id)))
        .sort((a, b) => rerankMap.get(String(a._id)).i - rerankMap.get(String(b._id)).i)
        .map(c => {
          const py = rerankMap.get(String(c._id));
          return { ...c, score: clamp(py.score) };
        });
    }
  } catch (error) {
    logger.warn('[Suggestions] Python rerank skipped: %s', error.message);
  }

  // Diversify a larger set then slice for current page
  const diversified = diversifyByPrimaryCategory(ranked, 100); 
  
  const startIndex = (page - 1) * limit;
  const selected = diversified.slice(startIndex, startIndex + limit).map(c => ({
    _id: c._id,
    fullname: c.fullname,
    profile_picture: c.profile_picture,
    followersCount: c.followersCount,
    score: Number(c.score.toFixed(4)),
    reason: reasonFromSignals(c, c.mutualCount),
  }));

  return selected;
}

module.exports = {
  getSuggestedUsers,
};
