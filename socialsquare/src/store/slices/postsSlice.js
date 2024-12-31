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

// handle like
export const likepost = createAsyncThunk("posts/likepost", async ({ postId, userId }) => {
  try {
    const response = await fetch("http://localhost:5000/api/post/like", {
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
    const response = await fetch("http://localhost:5000/api/post/unlike", {
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
      const response = await fetch("http://localhost:5000/api/post/comments", {
        method: "GET",
        headers: {
          Authorization: `${postId}`,
        },
      });
      const data = await response.json()
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
      const response = await fetch("http://localhost:5000/api/post/comments/add", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          content,
          user
        })

      });
      const data = await response.json();
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
      categories: null,
      comments: null,
      like: null,
      unlike: null,
    },
    error: {
      posts: null,
      categories: null,
      comments: null,
      like: null,
      unlike: null,
    },
  },
  reducers: {

    addNewPost: (state, action) => {
      state.posts.unshift(action.payload)
    },
  },
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

      // Handle Like Post 
      .addCase(likepost.pending, (state, action) => {
        const { userId, postId } = action.meta.arg; // Assuming `meta.arg` contains the payload
        const postIndex = state.posts.findIndex(post => post._id === postId);
        if (postIndex !== -1 && !state.posts[postIndex].likes.includes(userId)) {
          state.posts[postIndex].likes.push(userId); // Optimistic update
        }
        state.loading.like = true;
      })

      .addCase(likepost.fulfilled, (state, action) => {
        state.loading.like = false; // No need to update likes; already handled optimistically
      })

      .addCase(likepost.rejected, (state, action) => {
        const { userId, postId } = action.meta.arg;
        const postIndex = state.posts.findIndex(post => post._id === postId);
        if (postIndex !== -1) {
          state.posts[postIndex].likes = state.posts[postIndex].likes.filter(id => id !== userId); // Rollback
        }
        state.loading.like = false;
      })


      .addCase(unlikepost.pending, (state, action) => {
        const { userId, postId } = action.meta.arg; // Assuming `meta.arg` contains the payload
        const postIndex = state.posts.findIndex(post => post._id === postId);
        if (postIndex !== -1 && state.posts[postIndex].likes.includes(userId)) {
          state.posts[postIndex].likes = state.posts[postIndex].likes.filter((id) => id !== userId); // Optimistic update
        }
        state.loading.unlike = true;
      })

      .addCase(unlikepost.fulfilled, (state, action) => {
        state.loading.unlike = false; // No need to update likes; already handled optimistically
      })

      .addCase(unlikepost.rejected, (state, action) => {
        const { userId, postId } = action.meta.arg;
        const postIndex = state.posts.findIndex(post => post._id === postId);
        if (postIndex !== -1 && !state.posts[postIndex].likes.includes(userId)) {
          state.posts[postIndex].likes.push(userId); // Rollback if unliking failed
        }
        state.loading.unlike = false;
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
export const { addNewPost } = postsSlice.actions;
export default postsSlice.reducer;

