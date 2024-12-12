// Redux Slice (store/slices/postsSlice.js)
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// Fetch Posts
export const fetchPosts = createAsyncThunk("posts/fetchPosts", async (_, thunkAPI) => {
  try {
    const response = await fetch("http://localhost:5000/api/post/");
    return await response.json();
  } catch (error) {
    return thunkAPI.rejectWithValue(error.message);
  }
});

// Fetch Categories
export const fetchCategories = createAsyncThunk("posts/fetchCategories", async (_, thunkAPI) => {
  try {
    const response = await fetch("http://localhost:5000/api/post/categories");
    return await response.json();
  } catch (error) {
    return thunkAPI.rejectWithValue(error.message);
  }
});

// Create New Post
export const newPost = createAsyncThunk("posts/newPost", async (postData, thunkAPI) => {
  try {
    const response = await fetch("http://localhost:5000/api/post/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });

    if (response.ok) {
      return await response.json();
    } else {
      const error = await response.json();
      return thunkAPI.rejectWithValue(error.error);
    }
  } catch (error) {
    return thunkAPI.rejectWithValue(error.message);
  }
});

const postsSlice = createSlice({
  name: "posts",
  initialState: {
    posts: [],
    categories: [],
    loading: {
      posts: null,
      newpost: null,
      categories: null
    },
    error: {
      posts: null,
      newpost: null,
      categories: null
    },
    newpostsuccess: null
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Handle Fetch Posts
      .addCase(fetchPosts.pending, (state) => {
        state.loading.posts = true;
        state.error.posts = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.loading.posts = false;
        state.posts = action.payload;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.loading.posts = false;
        state.error.posts = action.payload;
      })

      // Handle Fetch Categories
      .addCase(fetchCategories.pending, (state) => {
        state.loading.categories = true;
        state.error.categories = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.loading.categories = false;
        state.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.loading.categories = false;
        state.error.categories = action.payload;
      })

      // Handle New Post 
      .addCase(newPost.pending, (state) => {
        state.loading.newpost = true;
        state.error.newpost = null;
        state.newpostsuccess = null;
      })
      .addCase(newPost.fulfilled, (state, action) => {
        state.loading.newpost = false;
        state.posts.push(action.payload);
        state.newpostsuccess = 'Post created successfully!';
      })
      .addCase(newPost.rejected, (state, action) => {
        state.loading.newpost = false;
        state.error.newpost = action.payload || 'Failed to create post.';
      });
  },
});

export default postsSlice.reducer;

