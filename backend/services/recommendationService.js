const axios = require("axios");

const RECOMMENDER_URL = process.env.RECOMMENDER_URL || "http://localhost:8001";

async function getRecommendedPosts(userId) {
  const res = await axios.get(`${RECOMMENDER_URL}/recommend/posts/${userId}`);
  return res.data.items;
}

async function getRecommendedUsers(userId) {
  const res = await axios.get(`${RECOMMENDER_URL}/recommend/users/${userId}`);
  return res.data.items;
}

async function getSimilarPosts(postId) {
  const res = await axios.get(`${RECOMMENDER_URL}/recommend/similar/${postId}`);
  return res.data.items;
}

async function getPersonalizedTrending(userId) {
  const res = await axios.get(`${RECOMMENDER_URL}/recommend/trending/${userId}`);
  return res.data.items;
}

async function getPersonalizedSearch(userId, q) {
  const res = await axios.get(`${RECOMMENDER_URL}/recommend/search`, {
    params: { user_id: userId, q }
  });
  return res.data.items;
}

async function getUserMemory(userId) {
  const res = await axios.get(`${RECOMMENDER_URL}/recommend/memory/${userId}`);
  return res.data;
}

async function getUserAIProfile(userId) {
  const res = await axios.get(`${RECOMMENDER_URL}/user-profile/${userId}`);
  return res.data;
}

module.exports = {
  getRecommendedPosts,
  getRecommendedUsers,
  getSimilarPosts,
  getPersonalizedTrending,
  getPersonalizedSearch,
  getUserMemory,
  getUserAIProfile
};