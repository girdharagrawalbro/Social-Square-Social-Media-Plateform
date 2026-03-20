// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import axios from "axios";

// const BASE = process.env.REACT_APP_BACKEND_URL;

// export const fetchPosts = createAsyncThunk("posts/fetchPosts", async ({ cursor = null, userId = null } = {}, thunkAPI) => {
//     try {
//         const params = new URLSearchParams({ limit: 10 });
//         if (cursor) params.append('cursor', cursor);
//         if (userId) params.append('userId', userId);
//         const res = await fetch(`${BASE}/api/post/?${params}`);
//         return await res.json();
//     } catch (error) { return thunkAPI.rejectWithValue(error.message); }
// });

// export const fetchUserPosts = createAsyncThunk("posts/fetchUserPosts", async ({ userId, cursor = null } = {}, thunkAPI) => {
//     try {
//         const params = new URLSearchParams({ limit: 12 });
//         if (cursor) params.append('cursor', cursor);
//         const res = await fetch(`${BASE}/api/post/user/${userId}?${params}`);
//         return await res.json();
//     } catch (error) { return thunkAPI.rejectWithValue(error.message); }
// });

// export const fetchSavedPosts = createAsyncThunk("posts/fetchSavedPosts", async (userId, thunkAPI) => {
//     try {
//         const res = await fetch(`${BASE}/api/post/saved/${userId}`);
//         return await res.json();
//     } catch (error) { return thunkAPI.rejectWithValue(error.message); }
// });

// export const fetchMoodFeed = createAsyncThunk("posts/fetchMoodFeed", async ({ mood, userId }, thunkAPI) => {
//     try {
//         const res = await fetch(`${BASE}/api/ai/mood-feed/${userId}?mood=${mood}`);
//         return await res.json(); // { posts, mood, relatedMoods }
//     } catch (error) { return thunkAPI.rejectWithValue(error.message); }
// });

// export const savePost = createAsyncThunk("posts/savePost", async ({ postId, userId }, thunkAPI) => {
//     try {
//         const res = await fetch(`${BASE}/api/post/save`, {
//             method: 'POST', headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ postId, userId }),
//         });
//         return { postId, saved: (await res.json()).saved };
//     } catch (error) { return thunkAPI.rejectWithValue(error.message); }
// });

// export const fetchCategories = createAsyncThunk("posts/fetchCategories", async (_, thunkAPI) => {
//     try {
//         const res = await fetch(`${BASE}/api/post/categories`);
//         return await res.json();
//     } catch (error) { return thunkAPI.rejectWithValue(error.message); }
// });

// export const likepost = createAsyncThunk("posts/likepost", async ({ postId, userId }) => {
//     try {
//         const res = await fetch(`${BASE}/api/post/like`, {
//             method: 'POST', headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ postId, userId }),
//         });
//         if (!res.ok) throw new Error("Failed to like post");
//         return { userId, postId };
//     } catch (error) { console.error("Error liking", error); }
// });

// export const unlikepost = createAsyncThunk("posts/unlikepost", async ({ postId, userId }) => {
//     try {
//         const res = await fetch(`${BASE}/api/post/unlike`, {
//             method: 'POST', headers: { "Content-Type": "application/json" },
//             body: JSON.stringify({ postId, userId }),
//         });
//         if (!res.ok) throw new Error("Failed to unlike post");
//         return { userId, postId };
//     } catch (error) { console.error("Error unliking", error); }
// });

// export const fetchComments = createAsyncThunk('posts/fetchComments', async (postId) => {
//     try {
//         const res = await fetch(`${BASE}/api/post/comments`, { method: "GET", headers: { Authorization: `${postId}` } });
//         return await res.json();
//     } catch (error) { console.error("Error fetching comments", error); }
// });

// export const createComment = createAsyncThunk('posts/createComment', async ({ postId, content, user, parentId }) => {
//     try {
//         const res = await fetch(`${BASE}/api/post/comments/add`, {
//             method: 'POST', headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ postId, content, user, parentId }),
//         });
//         return { data: await res.json(), postId, parentId };
//     } catch (error) { console.error("Error commenting", error); }
// });

// export const updatePost = createAsyncThunk('posts/updatePost', async ({ postId, userId, caption, category }, { rejectWithValue }) => {
//     try {
//         const res = await axios.put(`${BASE}/api/post/update/${postId}`, { userId, caption, category });
//         return res.data;
//     } catch (error) { return rejectWithValue(error.response?.data); }
// });

// export const deletePost = createAsyncThunk('posts/deletePost', async ({ postId, userId }, { rejectWithValue }) => {
//     try {
//         await axios.delete(`${BASE}/api/post/delete/${postId}`, { data: { userId } });
//         return postId;
//     } catch (error) { return rejectWithValue(error.response?.data); }
// });

// const postsSlice = createSlice({
//     name: "posts",
//     initialState: {
//         // Main feed
//         posts: [],
//         nextCursor: null,
//         hasMore: true,

//         // Confessions feed (anonymous posts)
//         confessions: [],
//         confessionsNextCursor: null,
//         confessionsHasMore: true,

//         // Profile
//         userPosts: [],
//         userPostsNextCursor: null,
//         userPostsHasMore: true,

//         // Saved
//         savedPosts: [],
//         savedPostIds: [],

//         // Mood feed
//         moodPosts: [],
//         activeMood: null,

//         // Misc
//         categories: [],
//         comments: [],
//         loading: {
//             posts: null, userPosts: null, savedPosts: null, savePost: null, moodFeed: null,
//             categories: null, comments: null, like: null, unlike: null,
//             deletePost: null, updatePost: null,
//         },
//         error: {
//             posts: null, userPosts: null, savedPosts: null, categories: null,
//             comments: null, like: null, unlike: null, deletePost: null, updatePost: null,
//         },
//     },
//     reducers: {
//         addNewPost: (state, action) => {
//             const post = action.payload;
//             // Anonymous posts go to confessions, not main feed
//             if (post.isAnonymous) {
//                 state.confessions.unshift(post);
//             } else {
//                 state.posts.unshift(post);
//             }
//             // Always add to own profile posts
//             state.userPosts.unshift(post);
//         },
//         resetUserPosts: (state) => {
//             state.userPosts = [];
//             state.userPostsNextCursor = null;
//             state.userPostsHasMore = true;
//         },

//         // ✅ Socket: new post pushed to feed from server (non-anonymous only)
//         socketNewFeedPost: (state, action) => {
//             const post = action.payload;
//             if (post.isAnonymous) return; // never add anonymous posts to main feed via socket
//             const exists = state.posts.some(p => p._id === post._id);
//             if (!exists) state.posts.unshift(post);
//         },

//         // ✅ Socket: new anonymous confession post — goes to confessions state only
//         socketNewConfessionPost: (state, action) => {
//             const post = action.payload;
//             const exists = state.confessions.some(p => p._id === post._id);
//             if (!exists) state.confessions.unshift(post);
//         },

//         // ✅ Socket: like count synced from server
//         socketPostLiked: (state, action) => {
//             const { postId, userId, likesCount } = action.payload;
//             const post = state.posts.find(p => p._id === postId);
//             if (post) {
//                 if (!post.likes.includes(userId)) post.likes.push(userId);
//                 // Sync exact count from server
//                 post.likes = post.likes.slice(0, likesCount);
//             }
//         },

//         // ✅ Socket: unlike count synced from server
//         socketPostUnliked: (state, action) => {
//             const { postId, userId, likesCount } = action.payload;
//             const post = state.posts.find(p => p._id === postId);
//             if (post) {
//                 post.likes = post.likes.filter(id => id !== userId);
//             }
//         },

//         // ✅ Socket: new comment pushed to post
//         socketNewComment: (state, action) => {
//             const { postId, comment, parentId, commentsCount } = action.payload;
//             // Update comments count on the post
//             const post = state.posts.find(p => p._id === postId);
//             if (post && commentsCount) post.comments = new Array(commentsCount).fill(null);

//             // If comments panel is open for this post, add the comment
//             if (state.comments && state.comments[0]?.postId === postId) {
//                 if (!parentId) {
//                     const exists = state.comments.some(c => c._id === comment._id);
//                     if (!exists) state.comments.push({ ...comment, repliesList: [] });
//                 } else {
//                     const parent = state.comments.find(c => c._id === parentId);
//                     if (parent) {
//                         if (!parent.repliesList) parent.repliesList = [];
//                         const replyExists = parent.repliesList.some(r => r._id === comment._id);
//                         if (!replyExists) parent.repliesList.push(comment);
//                     }
//                 }
//             }
//         },

//         // ✅ Socket: comment deleted
//         socketCommentDeleted: (state, action) => {
//             const { commentId, postId, parentId } = action.payload;
//             const post = state.posts.find(p => p._id === postId);
//             if (post && post.comments.length > 0) {
//                 post.comments = post.comments.filter(c => c !== commentId && c?._id !== commentId);
//             }
//             if (!parentId) {
//                 state.comments = state.comments?.filter(c => c._id !== commentId) || [];
//             } else {
//                 const parent = state.comments?.find(c => c._id === parentId);
//                 if (parent?.repliesList) {
//                     parent.repliesList = parent.repliesList.filter(r => r._id !== commentId);
//                 }
//             }
//         },

//         // ✅ Socket: post updated by owner
//         socketPostUpdated: (state, action) => {
//             const { postId, caption, category } = action.payload;
//             const post = state.posts.find(p => p._id === postId);
//             if (post) { if (caption) post.caption = caption; if (category) post.category = category; }
//         },

//         // ✅ Socket: post deleted by owner
//         socketPostDeleted: (state, action) => {
//             const { postId } = action.payload;
//             state.posts = state.posts.filter(p => p._id !== postId);
//             state.userPosts = state.userPosts.filter(p => p._id !== postId);
//         },
//     },
//     extraReducers: (builder) => {
//         builder
//             .addCase(fetchPosts.pending, (state) => { state.loading.posts = true; state.error.posts = null; })
//             .addCase(fetchPosts.fulfilled, (state, action) => {
//                 state.loading.posts = false;
//                 const { posts, nextCursor, hasMore } = action.payload;
//                 const existingIds = new Set(state.posts.map(p => p._id));
//                 state.posts = [...state.posts, ...posts.filter(p => !existingIds.has(p._id))];
//                 state.nextCursor = nextCursor;
//                 state.hasMore = hasMore;
//             })
//             .addCase(fetchPosts.rejected, (state, action) => { state.loading.posts = false; state.error.posts = action.payload; })

//             .addCase(fetchUserPosts.pending, (state) => { state.loading.userPosts = true; })
//             .addCase(fetchUserPosts.fulfilled, (state, action) => {
//                 state.loading.userPosts = false;
//                 const { posts, nextCursor, hasMore } = action.payload;
//                 const existingIds = new Set(state.userPosts.map(p => p._id));
//                 state.userPosts = [...state.userPosts, ...posts.filter(p => !existingIds.has(p._id))];
//                 state.userPostsNextCursor = nextCursor;
//                 state.userPostsHasMore = hasMore;
//             })
//             .addCase(fetchUserPosts.rejected, (state, action) => { state.loading.userPosts = false; })

//             .addCase(fetchSavedPosts.pending, (state) => { state.loading.savedPosts = true; })
//             .addCase(fetchSavedPosts.fulfilled, (state, action) => {
//                 state.loading.savedPosts = false;
//                 state.savedPosts = Array.isArray(action.payload) ? action.payload : [];
//                 state.savedPostIds = state.savedPosts.map(p => p._id);
//             })
//             .addCase(fetchSavedPosts.rejected, (state) => { state.loading.savedPosts = false; })

//             .addCase(savePost.pending, (state) => { state.loading.savePost = true; })
//             .addCase(savePost.fulfilled, (state, action) => {
//                 state.loading.savePost = false;
//                 const { postId, saved } = action.payload;
//                 if (saved) {
//                     if (!state.savedPostIds.includes(postId)) {
//                         state.savedPostIds.push(postId);
//                         const post = state.posts.find(p => p._id === postId);
//                         if (post) state.savedPosts.push(post);
//                     }
//                 } else {
//                     state.savedPostIds = state.savedPostIds.filter(id => id !== postId);
//                     state.savedPosts = state.savedPosts.filter(p => p._id !== postId);
//                 }
//             })
//             .addCase(savePost.rejected, (state) => { state.loading.savePost = false; })

//             .addCase(fetchCategories.pending, (state) => { state.loading.categories = true; })
//             .addCase(fetchCategories.fulfilled, (state, action) => { state.loading.categories = false; state.categories = action.payload; })
//             .addCase(fetchCategories.rejected, (state, action) => { state.loading.categories = false; })

//             .addCase(likepost.pending, (state, action) => {
//                 const { userId, postId } = action.meta.arg;
//                 const post = state.posts.find(p => p._id === postId);
//                 if (post && !post.likes.includes(userId)) post.likes.push(userId);
//                 state.loading.like = true;
//             })
//             .addCase(likepost.fulfilled, (state) => { state.loading.like = false; })
//             .addCase(likepost.rejected, (state, action) => {
//                 const { userId, postId } = action.meta.arg;
//                 const post = state.posts.find(p => p._id === postId);
//                 if (post) post.likes = post.likes.filter(id => id !== userId);
//                 state.loading.like = false;
//             })

//             .addCase(unlikepost.pending, (state, action) => {
//                 const { userId, postId } = action.meta.arg;
//                 const post = state.posts.find(p => p._id === postId);
//                 if (post) post.likes = post.likes.filter(id => id !== userId);
//                 state.loading.unlike = true;
//             })
//             .addCase(unlikepost.fulfilled, (state) => { state.loading.unlike = false; })
//             .addCase(unlikepost.rejected, (state, action) => {
//                 const { userId, postId } = action.meta.arg;
//                 const post = state.posts.find(p => p._id === postId);
//                 if (post && !post.likes.includes(userId)) post.likes.push(userId);
//                 state.loading.unlike = false;
//             })

//             .addCase(createComment.fulfilled, (state, action) => {
//                 const { data, postId, parentId } = action.payload;
//                 if (!parentId) {
//                     if (state.comments) state.comments.push({ ...data, repliesList: [] });
//                     const post = state.posts.find(p => p._id === postId);
//                     if (post) post.comments.push(data._id);
//                 }
//             })
//             .addCase(fetchComments.pending, (state) => { state.loading.comments = true; state.comments = null; })
//             .addCase(fetchComments.fulfilled, (state, action) => { state.loading.comments = false; state.comments = action.payload; })
//             .addCase(fetchComments.rejected, (state) => { state.loading.comments = false; })

//             .addCase(updatePost.pending, (state) => { state.loading.updatePost = true; })
//             .addCase(updatePost.fulfilled, (state, action) => {
//                 state.loading.updatePost = false;
//                 const updated = action.payload;
//                 const fi = state.posts.findIndex(p => p._id === updated._id);
//                 if (fi !== -1) state.posts[fi] = updated;
//                 const pi = state.userPosts.findIndex(p => p._id === updated._id);
//                 if (pi !== -1) state.userPosts[pi] = updated;
//             })
//             .addCase(updatePost.rejected, (state) => { state.loading.updatePost = false; })

//             .addCase(deletePost.pending, (state) => { state.loading.deletePost = true; })
//             .addCase(deletePost.fulfilled, (state, action) => {
//                 state.loading.deletePost = false;
//                 const postId = action.payload;
//                 state.posts = state.posts.filter(p => p._id !== postId);
//                 state.userPosts = state.userPosts.filter(p => p._id !== postId);
//                 state.savedPosts = state.savedPosts.filter(p => p._id !== postId);
//                 state.savedPostIds = state.savedPostIds.filter(id => id !== postId);
//             })
//             .addCase(deletePost.rejected, (state) => { state.loading.deletePost = false; })

//             // ── Mood Feed ──────────────────────────────────────────────────────────────
//             .addCase(fetchMoodFeed.pending, (state) => { state.loading.moodFeed = true; state.moodPosts = []; })
//             .addCase(fetchMoodFeed.fulfilled, (state, action) => {
//                 state.loading.moodFeed = false;
//                 state.moodPosts = action.payload.posts || [];
//                 state.activeMood = action.payload.mood || null;
//             })
//             .addCase(fetchMoodFeed.rejected, (state) => { state.loading.moodFeed = false; });
//     },
// });

// export const {
//     addNewPost, resetUserPosts,
//     socketNewFeedPost, socketNewConfessionPost,
//     socketPostLiked, socketPostUnliked,
//     socketNewComment, socketCommentDeleted,
//     socketPostUpdated, socketPostDeleted,
// } = postsSlice.actions;

// export default postsSlice.reducer;


// ⚠️ Redux has been removed. This file is a compatibility stub.
// Migrate to: import usePostStore from '../zustand/usePostStore'
//             and TanStack Query hooks from '../../hooks/queries/usePostQueries'
export const fetchPosts = () => () => {};
export const fetchUserPosts = () => () => {};
export const fetchSavedPosts = () => () => {};
export const fetchCategories = () => () => {};
export const likepost = () => () => {};
export const unlikepost = () => () => {};
export const fetchComments = () => () => {};
export const createComment = () => () => {};
export const updatePost = () => () => {};
export const deletePost = () => () => {};
export const savePost = () => () => {};
export const fetchMoodFeed = () => () => {};
export const addNewPost = () => ({ type: 'NOOP' });
export const resetUserPosts = () => ({ type: 'NOOP' });
export const socketNewFeedPost = () => ({ type: 'NOOP' });
export const socketPostLiked = () => ({ type: 'NOOP' });
export const socketPostUnliked = () => ({ type: 'NOOP' });
export const socketNewComment = () => ({ type: 'NOOP' });
export const socketCommentDeleted = () => ({ type: 'NOOP' });
export const socketPostUpdated = () => ({ type: 'NOOP' });
export const socketPostDeleted = () => ({ type: 'NOOP' });
export const socketNewConfessionPost = () => ({ type: 'NOOP' });
export default { reducer: (s = {}) => s };