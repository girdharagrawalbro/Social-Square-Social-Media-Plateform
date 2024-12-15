// Redux Slice (store/slices/postsSlice.js)
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

// Fetch Posts
export const fetchPosts = createAsyncThunk("posts/fetchPosts", async (_, thunkAPI) => {
  try {
    const response = await fetch("https://social-square-social-media-plateform.onrender.com/api/post/");
    return await response.json();
  } catch (error) {
    return thunkAPI.rejectWithValue(error.message);
  }
});

// Fetch Categories
export const fetchCategories = createAsyncThunk("posts/fetchCategories", async (_, thunkAPI) => {
  try {
    const response = await fetch("https://social-square-social-media-plateform.onrender.com/api/post/categories");
    return await response.json();
  } catch (error) {
    return thunkAPI.rejectWithValue(error.message);
  }
});

// Create New Post
export const newPost = createAsyncThunk("posts/newPost", async (postData, thunkAPI) => {
  try {
    const response = await fetch("https://social-square-social-media-plateform.onrender.com/api/post/create", {
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

// handle like
export const likepost = createAsyncThunk("posts/likepost", async ({ postId, userId }) => {
  try {
    const response = await fetch("https://social-square-social-media-plateform.onrender.com/api/post/like", {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        postId,
        userId,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to like post");
    }
    const data = await response.json();
    return { userId, postId, data };
  }
  catch (error) {
    console.error("Error in likeing ");
  }
});
// handle unlike
export const unlikepost = createAsyncThunk("posts/unlikepost", async ({ postId, userId }) => {
  try {
    const response = await fetch("https://social-square-social-media-plateform.onrender.com/api/post/unlike", {
      method: 'POST',
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        postId,
        userId,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to like post");
    }
    const data = await response.json();
    return { userId, postId, data };
  }
  catch (error) {
    console.error("Error in likeing ");
  }
});

export const fetchComments = createAsyncThunk(
  'posts/fetchComments',
  async (postId) => {
    try {
      const response = await fetch("https://social-square-social-media-plateform.onrender.com/api/post/comments", {
        method: "GET",
        headers: {
          Authorization: `${postId}`,
        },
      });
      const data = response.json()
      return data;
    }
    catch (error) {
      console.error("Error in fetching comments");
    }
  }
);

export const createComment = createAsyncThunk(
  'posts/createComment',
  async ({ postId, content, user }) => {
    try {
      const response = await fetch("https://social-square-social-media-plateform.onrender.com/api/post/comments/add", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          content,
          user
        })

      });
      const data = response.json();
      return { data, postId };
    } catch (error) {
      console.error("Error in commenting");
    }
  }
);

const postsSlice = createSlice({
  name: "posts",
  initialState: {
    posts: [],
    categories: [],
    comments: [],
    loading: {
      posts: null,
      newpost: null,
      categories: null,
      comments: null,
    },
    error: {
      posts: null,
      newpost: null,
      categories: null,
      comments: null
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
        state.posts.unshift(action.payload); // Insert at the beginning
        state.newpostsuccess = 'Post created successfully!';
      })

      .addCase(newPost.rejected, (state, action) => {
        state.loading.newpost = false;
        state.error.newpost = action.payload || 'Failed to create post.';
      })

      // Handle Like Post 
      .addCase(likepost.fulfilled, (state, action) => {
        const { userId, postId } = action.payload;
        const postIndex = state.posts.findIndex(post => post._id === postId);
        if (postIndex !== -1) {
          state.posts[postIndex].likes.push(userId);
        }
      })
      .addCase(unlikepost.fulfilled, (state, action) => {
        const { userId, postId } = action.payload;
        const postIndex = state.posts.findIndex(post => post._id === postId);
        if (postIndex !== -1) {
          state.posts[postIndex].likes = state.posts[postIndex].likes.filter((id) => id !== userId);
        }
      })
      // add comment
      .addCase(createComment.fulfilled, (state, action) => {
        const { data, postId } = action.payload;
        state.comments.push(data);
        const postIndex = state.posts.findIndex(post => post._id === postId);
        if (postIndex !== -1) {
          state.posts[postIndex].comments.push(data._id);
        }
      })

      // fetch comments
      .addCase(fetchComments.pending, (state, action) => {
        state.loading.comments = true;

        state.comments = null;
      })
      .addCase(fetchComments.fulfilled, (state, action) => {
        state.loading.comments = false;
        state.comments = action.payload;
      })
      .addCase(fetchComments.rejected, (state, action) => {
        state.loading.comments = false;
        state.error.comments = action.payload;
      });




  },
});

export default postsSlice.reducer;

