import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;

// ─── THUNKS ───────────────────────────────────────────────────────────────────

export const fetchPosts = createAsyncThunk("posts/fetchPosts", async ({ cursor = null, userId = null } = {}, thunkAPI) => {
    try {
        const params = new URLSearchParams({ limit: 10 });
        if (cursor) params.append('cursor', cursor);
        if (userId) params.append('userId', userId);
        const res = await fetch(`${BASE}/api/post/?${params}`);
        return await res.json(); // { posts, nextCursor, hasMore }
    } catch (error) { return thunkAPI.rejectWithValue(error.message); }
});

export const fetchUserPosts = createAsyncThunk("posts/fetchUserPosts", async ({ userId, cursor = null } = {}, thunkAPI) => {
    try {
        const params = new URLSearchParams({ limit: 12 });
        if (cursor) params.append('cursor', cursor);
        const res = await fetch(`${BASE}/api/post/user/${userId}?${params}`);
        return await res.json(); // { posts, nextCursor, hasMore }
    } catch (error) { return thunkAPI.rejectWithValue(error.message); }
});

export const fetchSavedPosts = createAsyncThunk("posts/fetchSavedPosts", async (userId, thunkAPI) => {
    try {
        const res = await fetch(`${BASE}/api/post/saved/${userId}`);
        return await res.json(); // array of posts
    } catch (error) { return thunkAPI.rejectWithValue(error.message); }
});

export const savePost = createAsyncThunk("posts/savePost", async ({ postId, userId }, thunkAPI) => {
    try {
        const res = await fetch(`${BASE}/api/post/save`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, userId }),
        });
        const data = await res.json(); // { saved: true/false }
        return { postId, saved: data.saved };
    } catch (error) { return thunkAPI.rejectWithValue(error.message); }
});

export const fetchCategories = createAsyncThunk("posts/fetchCategories", async (_, thunkAPI) => {
    try {
        const res = await fetch(`${BASE}/api/post/categories`);
        return await res.json();
    } catch (error) { return thunkAPI.rejectWithValue(error.message); }
});

export const likepost = createAsyncThunk("posts/likepost", async ({ postId, userId }) => {
    try {
        const res = await fetch(`${BASE}/api/post/like`, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId, userId }),
        });
        if (!res.ok) throw new Error("Failed to like post");
        return { userId, postId };
    } catch (error) { console.error("Error liking post", error); }
});

export const unlikepost = createAsyncThunk("posts/unlikepost", async ({ postId, userId }) => {
    try {
        const res = await fetch(`${BASE}/api/post/unlike`, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId, userId }),
        });
        if (!res.ok) throw new Error("Failed to unlike post");
        return { userId, postId };
    } catch (error) { console.error("Error unliking post", error); }
});

export const fetchComments = createAsyncThunk('posts/fetchComments', async (postId) => {
    try {
        const res = await fetch(`${BASE}/api/post/comments`, {
            method: "GET", headers: { Authorization: `${postId}` },
        });
        return await res.json();
    } catch (error) { console.error("Error fetching comments", error); }
});

export const createComment = createAsyncThunk('posts/createComment', async ({ postId, content, user }) => {
    try {
        const res = await fetch(`${BASE}/api/post/comments/add`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, content, user }),
        });
        return { data: await res.json(), postId };
    } catch (error) { console.error("Error commenting", error); }
});

export const updatePost = createAsyncThunk('posts/updatePost', async ({ postId, userId, caption, category }, { rejectWithValue }) => {
    try {
        const res = await axios.put(`${BASE}/api/post/update/${postId}`, { userId, caption, category });
        return res.data;
    } catch (error) { return rejectWithValue(error.response?.data); }
});

export const deletePost = createAsyncThunk('posts/deletePost', async ({ postId, userId }, { rejectWithValue }) => {
    try {
        await axios.delete(`${BASE}/api/post/delete/${postId}`, { data: { userId } });
        return postId;
    } catch (error) { return rejectWithValue(error.response?.data); }
});

// ─── SLICE ────────────────────────────────────────────────────────────────────

const postsSlice = createSlice({
    name: "posts",
    initialState: {
        // Feed
        posts: [],
        nextCursor: null,
        hasMore: true,

        // Profile - own posts
        userPosts: [],
        userPostsNextCursor: null,
        userPostsHasMore: true,

        // Saved posts
        savedPosts: [],        // array of full post objects
        savedPostIds: [],      // array of post _ids for quick lookup

        // Misc
        categories: [],
        comments: [],

        loading: {
            posts: null,
            userPosts: null,
            savedPosts: null,
            savePost: null,
            categories: null,
            comments: null,
            like: null,
            unlike: null,
            deletePost: null,
            updatePost: null,
        },
        error: {
            posts: null,
            userPosts: null,
            savedPosts: null,
            categories: null,
            comments: null,
            like: null,
            unlike: null,
            deletePost: null,
            updatePost: null,
        },
    },
    reducers: {
        addNewPost: (state, action) => {
            state.posts.unshift(action.payload);
            state.userPosts.unshift(action.payload); // also add to profile
        },
        resetUserPosts: (state) => {
            state.userPosts = [];
            state.userPostsNextCursor = null;
            state.userPostsHasMore = true;
        },
    },
    extraReducers: (builder) => {
        builder

            // ── Feed ──────────────────────────────────────────────────────────
            .addCase(fetchPosts.pending, (state) => { state.loading.posts = true; state.error.posts = null; })
            .addCase(fetchPosts.fulfilled, (state, action) => {
                state.loading.posts = false;
                const { posts, nextCursor, hasMore } = action.payload;
                const existingIds = new Set(state.posts.map(p => p._id));
                state.posts = [...state.posts, ...posts.filter(p => !existingIds.has(p._id))];
                state.nextCursor = nextCursor;
                state.hasMore = hasMore;
            })
            .addCase(fetchPosts.rejected, (state, action) => { state.loading.posts = false; state.error.posts = action.payload; })

            // ── User Posts (profile) ──────────────────────────────────────────
            .addCase(fetchUserPosts.pending, (state) => { state.loading.userPosts = true; state.error.userPosts = null; })
            .addCase(fetchUserPosts.fulfilled, (state, action) => {
                state.loading.userPosts = false;
                const { posts, nextCursor, hasMore } = action.payload;
                const existingIds = new Set(state.userPosts.map(p => p._id));
                state.userPosts = [...state.userPosts, ...posts.filter(p => !existingIds.has(p._id))];
                state.userPostsNextCursor = nextCursor;
                state.userPostsHasMore = hasMore;
            })
            .addCase(fetchUserPosts.rejected, (state, action) => { state.loading.userPosts = false; state.error.userPosts = action.payload; })

            // ── Saved Posts ───────────────────────────────────────────────────
            .addCase(fetchSavedPosts.pending, (state) => { state.loading.savedPosts = true; })
            .addCase(fetchSavedPosts.fulfilled, (state, action) => {
                state.loading.savedPosts = false;
                state.savedPosts = Array.isArray(action.payload) ? action.payload : [];
                state.savedPostIds = state.savedPosts.map(p => p._id);
            })
            .addCase(fetchSavedPosts.rejected, (state, action) => { state.loading.savedPosts = false; state.error.savedPosts = action.payload; })

            // ── Save / Unsave ─────────────────────────────────────────────────
            .addCase(savePost.pending, (state) => { state.loading.savePost = true; })
            .addCase(savePost.fulfilled, (state, action) => {
                state.loading.savePost = false;
                const { postId, saved } = action.payload;
                if (saved) {
                    // Add to saved
                    if (!state.savedPostIds.includes(postId)) {
                        state.savedPostIds.push(postId);
                        // Add full post object if available in feed
                        const post = state.posts.find(p => p._id === postId);
                        if (post) state.savedPosts.push(post);
                    }
                } else {
                    // Remove from saved
                    state.savedPostIds = state.savedPostIds.filter(id => id !== postId);
                    state.savedPosts = state.savedPosts.filter(p => p._id !== postId);
                }
            })
            .addCase(savePost.rejected, (state) => { state.loading.savePost = false; })

            // ── Categories ────────────────────────────────────────────────────
            .addCase(fetchCategories.pending, (state) => { state.loading.categories = true; })
            .addCase(fetchCategories.fulfilled, (state, action) => { state.loading.categories = false; state.categories = action.payload; })
            .addCase(fetchCategories.rejected, (state, action) => { state.loading.categories = false; state.error.categories = action.payload; })

            // ── Like (optimistic) ─────────────────────────────────────────────
            .addCase(likepost.pending, (state, action) => {
                const { userId, postId } = action.meta.arg;
                const post = state.posts.find(p => p._id === postId);
                if (post && !post.likes.includes(userId)) post.likes.push(userId);
                state.loading.like = true;
            })
            .addCase(likepost.fulfilled, (state) => { state.loading.like = false; })
            .addCase(likepost.rejected, (state, action) => {
                const { userId, postId } = action.meta.arg;
                const post = state.posts.find(p => p._id === postId);
                if (post) post.likes = post.likes.filter(id => id !== userId);
                state.loading.like = false;
            })

            // ── Unlike (optimistic) ───────────────────────────────────────────
            .addCase(unlikepost.pending, (state, action) => {
                const { userId, postId } = action.meta.arg;
                const post = state.posts.find(p => p._id === postId);
                if (post) post.likes = post.likes.filter(id => id !== userId);
                state.loading.unlike = true;
            })
            .addCase(unlikepost.fulfilled, (state) => { state.loading.unlike = false; })
            .addCase(unlikepost.rejected, (state, action) => {
                const { userId, postId } = action.meta.arg;
                const post = state.posts.find(p => p._id === postId);
                if (post && !post.likes.includes(userId)) post.likes.push(userId);
                state.loading.unlike = false;
            })

            // ── Comments ──────────────────────────────────────────────────────
            .addCase(createComment.fulfilled, (state, action) => {
                const { data, postId } = action.payload;
                state.comments.push(data);
                const post = state.posts.find(p => p._id === postId);
                if (post) post.comments.push(data._id);
            })
            .addCase(fetchComments.pending, (state) => { state.loading.comments = true; state.comments = null; })
            .addCase(fetchComments.fulfilled, (state, action) => { state.loading.comments = false; state.comments = action.payload; })
            .addCase(fetchComments.rejected, (state, action) => { state.loading.comments = false; state.error.comments = action.payload; })

            // ── Update Post ───────────────────────────────────────────────────
            .addCase(updatePost.pending, (state) => { state.loading.updatePost = true; })
            .addCase(updatePost.fulfilled, (state, action) => {
                state.loading.updatePost = false;
                const updated = action.payload;
                // Update in feed
                const feedIndex = state.posts.findIndex(p => p._id === updated._id);
                if (feedIndex !== -1) state.posts[feedIndex] = updated;
                // Update in userPosts
                const profileIndex = state.userPosts.findIndex(p => p._id === updated._id);
                if (profileIndex !== -1) state.userPosts[profileIndex] = updated;
            })
            .addCase(updatePost.rejected, (state) => { state.loading.updatePost = false; })

            // ── Delete Post ───────────────────────────────────────────────────
            .addCase(deletePost.pending, (state) => { state.loading.deletePost = true; })
            .addCase(deletePost.fulfilled, (state, action) => {
                state.loading.deletePost = false;
                const postId = action.payload;
                state.posts = state.posts.filter(p => p._id !== postId);
                state.userPosts = state.userPosts.filter(p => p._id !== postId);
                state.savedPosts = state.savedPosts.filter(p => p._id !== postId);
                state.savedPostIds = state.savedPostIds.filter(id => id !== postId);
            })
            .addCase(deletePost.rejected, (state) => { state.loading.deletePost = false; });
    },
});

export const { addNewPost, resetUserPosts } = postsSlice.actions;
export default postsSlice.reducer;