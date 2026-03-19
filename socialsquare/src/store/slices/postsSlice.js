import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export const fetchPosts = createAsyncThunk("posts/fetchPosts", async ({ cursor = null, userId = null } = {}, thunkAPI) => {
    try {
        const params = new URLSearchParams({ limit: 10 });
        if (cursor) params.append('cursor', cursor);
        if (userId) params.append('userId', userId);
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/post/?${params}`);
        return await response.json();
    } catch (error) {
        return thunkAPI.rejectWithValue(error.message);
    }
});

export const fetchCategories = createAsyncThunk("posts/fetchCategories", async (_, thunkAPI) => {
    try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/post/categories`);
        return await response.json();
    } catch (error) {
        return thunkAPI.rejectWithValue(error.message);
    }
});

export const likepost = createAsyncThunk("posts/likepost", async ({ postId, userId }) => {
    try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/post/like`, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId, userId }),
        });
        if (!response.ok) throw new Error("Failed to like post");
        return { userId, postId };
    } catch (error) { console.error("Error in liking"); }
});

export const unlikepost = createAsyncThunk("posts/unlikepost", async ({ postId, userId }) => {
    try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/post/unlike`, {
            method: 'POST', headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId, userId }),
        });
        if (!response.ok) throw new Error("Failed to unlike post");
        return { userId, postId };
    } catch (error) { console.error("Error in unliking"); }
});

export const fetchComments = createAsyncThunk('posts/fetchComments', async (postId) => {
    try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/post/comments`, {
            method: "GET", headers: { Authorization: `${postId}` },
        });
        return await response.json();
    } catch (error) { console.error("Error fetching comments"); }
});

export const createComment = createAsyncThunk('posts/createComment', async ({ postId, content, user }) => {
    try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/post/comments/add`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, content, user }),
        });
        return { data: await response.json(), postId };
    } catch (error) { console.error("Error commenting"); }
});

export const updatePost = createAsyncThunk('posts/updatePost', async ({ postId, userId, caption, category }, { rejectWithValue }) => {
    try {
        const response = await axios.put(`${process.env.REACT_APP_BACKEND_URL}/api/post/update/${postId}`, { userId, caption, category });
        return response.data;
    } catch (error) { return rejectWithValue(error.response?.data); }
});

export const deletePost = createAsyncThunk('posts/deletePost', async ({ postId, userId }, { rejectWithValue }) => {
    try {
        await axios.delete(`${process.env.REACT_APP_BACKEND_URL}/api/post/delete/${postId}`, { data: { userId } });
        return postId;
    } catch (error) { return rejectWithValue(error.response?.data); }
});

const postsSlice = createSlice({
    name: "posts",
    initialState: {
        posts: [],
        categories: [],
        comments: [],
        nextCursor: null,
        hasMore: true,
        loading: { posts: null, categories: null, comments: null, like: null, unlike: null, deletePost: null, addPost: null },
        error: { posts: null, categories: null, comments: null, like: null, unlike: null, deletePost: null, addPost: null },
    },
    reducers: {
        addNewPost: (state, action) => { state.posts.unshift(action.payload); },
    },
    extraReducers: (builder) => {
        builder
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

            .addCase(fetchCategories.pending, (state) => { state.loading.categories = true; })
            .addCase(fetchCategories.fulfilled, (state, action) => { state.loading.categories = false; state.categories = action.payload; })
            .addCase(fetchCategories.rejected, (state, action) => { state.loading.categories = false; state.error.categories = action.payload; })

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

            .addCase(createComment.fulfilled, (state, action) => {
                const { data, postId } = action.payload;
                state.comments.push(data);
                const post = state.posts.find(p => p._id === postId);
                if (post) post.comments.push(data._id);
            })
            .addCase(fetchComments.pending, (state) => { state.loading.comments = true; state.comments = null; })
            .addCase(fetchComments.fulfilled, (state, action) => { state.loading.comments = false; state.comments = action.payload; })
            .addCase(fetchComments.rejected, (state, action) => { state.loading.comments = false; state.error.comments = action.payload; })

            .addCase(updatePost.fulfilled, (state, action) => {
                const index = state.posts.findIndex(p => p._id === action.payload._id);
                if (index !== -1) state.posts[index] = action.payload;
            })

            .addCase(deletePost.pending, (state) => { state.loading.deletePost = true; })
            .addCase(deletePost.fulfilled, (state, action) => {
                state.loading.deletePost = false;
                state.posts = state.posts.filter(p => p._id !== action.payload);
            })
            .addCase(deletePost.rejected, (state, action) => { state.loading.deletePost = false; state.error.deletePost = action.payload; });
    },
});

export const { addNewPost } = postsSlice.actions;
export default postsSlice.reducer;